/* =====================================================================
   MON CONCOURS — SERVICE WORKER
   Un candidat en 2G ne doit pas repayer le chargement à chaque visite,
   et un candidat sans réseau doit pouvoir relire ses cours.
   ===================================================================== */
const VERSION = 'mc-v6';
const COQUE   = VERSION + '-coque';   // les fichiers de l'application
const DONNEES = VERSION + '-donnees'; // les réponses de la base

const FICHIERS = [
  '/', '/index.html', '/app.js?v=6', '/styles.css?v=6',
  '/supabase-js.min.js?v=6', '/manifest.webmanifest', '/favicon.png', '/icone-192.png'
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

  /* 1. Les fichiers du site : on sert le cache tout de suite — c'est ce qui
        rend l'ouverture instantanée en 2G — et on va chercher la version
        fraîche en arrière-plan. Quand elle arrive, le service worker neuf
        prend la main et la page se recharge une fois, toute seule. */
  /* index.html et app.js doivent toujours voyager ensemble : on va les
     chercher sur le réseau en priorité, le cache ne sert qu'en secours.
     Sans cela, un ancien app.js peut se retrouver avec un index.html neuf. */
  if(url.origin === self.location.origin && /\/(index\.html)?$|app\.js|styles\.css|sw\.js/.test(url.pathname)){
    e.respondWith(
      fetch(req).then(rep => {
        if(rep && rep.status === 200){
          const copie = rep.clone();
          caches.open(COQUE).then(c => c.put(req, copie));
        }
        return rep;
      }).catch(() => caches.match(req).then(r => r || reponseVide(req)))
    );
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
