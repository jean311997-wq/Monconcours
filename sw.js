/* =====================================================================
   MON CONCOURS — SERVICE WORKER
   Un candidat en 2G ne doit pas repayer le chargement à chaque visite,
   et un candidat sans réseau doit pouvoir relire ses cours.
   ===================================================================== */
const VERSION = 'mc-v52';
const COQUE   = VERSION + '-coque';   // les fichiers de l'application
const DONNEES = VERSION + '-donnees'; // les réponses de la base

const FICHIERS = [
  '/', '/index.html', '/app.js?v=51', '/styles.css?v=39',
  '/supabase-js.min.js?v=13', '/manifest.webmanifest', '/favicon.png', '/icone-192.png'
];

/* Un fichier absent doit rester absent. Ne JAMAIS renvoyer la page
   d'accueil à la place d'un script ou d'une feuille de style : le
   navigateur recevrait du HTML là où il attend du code, et l'écran
   resterait noir. Seule une vraie navigation peut retomber sur l'accueil. */
function reponseVide(req){
  if(req.mode === 'navigate') return caches.match('/index.html');
  return new Response('', { status: 504, statusText: 'Hors ligne' });
}

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(COQUE)
      .then(c => c.addAll(FICHIERS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(cles => Promise.all(
        cles.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* Les seules requêtes base que l'on garde : celles qui servent à lire.
   Jamais les écritures, jamais l'authentification. */
function lectureConservable(url){
  if(!/\/rest\/v1\//.test(url.pathname)) return false;
  return /ressources|actualites|questions|sujet_questions|sujets|matieres/.test(url.pathname + url.search);
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;

  const url = new URL(req.url);

  /* 1. Les fichiers versionnés (app.js?v=…, styles.css?v=…, lib/…) ne
        changent jamais sous le même nom : on les sert depuis le cache,
        sans attendre le réseau. C'est ce qui rend l'ouverture immédiate. */
  if(url.origin === self.location.origin && (/[?&]v=\d+/.test(url.search) || url.pathname.startsWith('/lib/'))){
    e.respondWith(
      caches.match(req).then(enCache => enCache || fetch(req).then(rep => {
        if(rep && rep.status === 200){ const copie = rep.clone(); caches.open(COQUE).then(c => c.put(req, copie)); }
        return rep;
      }).catch(() => reponseVide(req)))
    );
    return;
  }

  /* 2. La page elle-même (index.html, admin) et le service worker : le
        réseau d'abord pour rester à jour, mais pas plus de 3 secondes ;
        au-delà, la dernière version connue s'affiche tout de suite. */
  if(url.origin === self.location.origin && (req.mode === 'navigate' || /\/(index\.html)?$|admin\.html|admin\.js|admin\.css|sw\.js/.test(url.pathname))){
    e.respondWith(new Promise(resoudre => {
      let fini = false;
      const secours = () => caches.match(req, { ignoreSearch: req.mode === 'navigate' })
        .then(r => r || caches.match('/index.html')).then(r => r || reponseVide(req));
      const minuteur = setTimeout(() => { secours().then(r => { if(!fini && r && r.status !== 504){ fini = true; resoudre(r); } }); }, 3000);
      fetch(req).then(rep => {
        if(rep && rep.status === 200){ const copie = rep.clone(); caches.open(COQUE).then(c => c.put(req, copie)); }
        if(!fini){ fini = true; clearTimeout(minuteur); resoudre(rep); }
      }).catch(() => { clearTimeout(minuteur); if(!fini){ fini = true; secours().then(resoudre); } });
    }));
    return;
  }

  if(url.origin === self.location.origin){
    e.respondWith(
      caches.match(req).then(enCache => {
        const reseau = fetch(req).then(rep => {
          if(rep && rep.status === 200){
            const copie = rep.clone();
            caches.open(COQUE).then(c => c.put(req, copie));
          }
          return rep;
        }).catch(() => enCache || reponseVide(req));
        return enCache || reseau;
      })
    );
    return;
  }

  /* 2. Les lectures de la base : on tente le réseau, et si le réseau
        manque on ressert la dernière réponse connue. Les cours déjà
        ouverts restent donc lisibles sans connexion. */
  if(lectureConservable(url)){
    e.respondWith(
      fetch(req).then(rep => {
        if(rep && rep.status === 200){
          const copie = rep.clone();
          caches.open(DONNEES).then(c => c.put(req, copie));
        }
        return rep;
      }).catch(() => caches.match(req).then(r => r || Response.error()))
    );
  }
});

/* L'application peut demander la mise en cache d'un cours précis. */
self.addEventListener('message', e => {
  if(e.data && e.data.type === 'active'){ self.skipWaiting(); return; }
  if(!e.data || e.data.type !== 'garder' || !e.data.url) return;
  caches.open(DONNEES).then(c => c.add(e.data.url).catch(() => {}));
});

/* Rappels : le serveur envoie un titre, un message et un lien. On
   n'affiche rien d'autre, et un toucher ouvre l'application au bon endroit. */
self.addEventListener('push', e => {
  let d = {};
  try{ d = e.data ? e.data.json() : {}; }catch(err){ d = { message: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.titre || 'Mon Concours', {
    body: d.message || 'Ta séance du jour t\'attend.',
    icon: '/icone-192.png', badge: '/favicon.png',
    /* vibration et nouvelle alerte : c'est ce qui fait descendre la bannière en haut de l'écran, même dans Facebook ou WhatsApp */
    vibrate: [220, 110, 220], renotify: true, silent: false, timestamp: Date.now(),
    /* fin d'essai : la notification reste affichée tant qu'on ne la touche pas */
    requireInteraction: /abonnement=essai|admin\.html/.test(d.lien || ''),
    data: { lien: d.lien || '/' }, tag: (d.lien || 'rappel').slice(0, 60)
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const lien = (e.notification.data && e.notification.data.lien) || '/';
  e.waitUntil(clients.matchAll({ type:'window', includeUncontrolled:true }).then(liste => {
    /* une alerte pour l'administration s'ouvre dans la fenêtre admin, jamais dans celle des candidats */
    const admin = /admin\.html/.test(lien);
    for(const c of liste){
      if(!('focus' in c) || admin !== /admin\.html/.test(c.url)) continue;
      c.navigate(lien).catch(() => {}); return c.focus();
    }
    return clients.openWindow(lien);
  }));
});
