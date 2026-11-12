/* =====================================================================
   MÉMOIRE LOCALE
   Le téléphone se souvient du candidat. Celui qui a déjà créé son
   compte ne revoit jamais « Étape 1 sur 3 » : il retombe directement
   sur l'actualité, avant même que le réseau ait répondu.
   ===================================================================== */
/* Tout texte venu de la base ou d'un candidat passe par ici avant
   d'entrer dans la page. Sans cela, un nom ou un énoncé contenant une
   balise deviendrait du code exécuté. */
function E(v){
  if(v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/* Coordonnées publiques du projet */
const CONTACT = {
  canal:    'https://whatsapp.com/channel/0029Vb9boQ990x32o1rJTm07',
  facebook: 'https://www.facebook.com/share/18zvk8fdA3/',
  adminTel: '77959848',
  adminTel2: '73767397',     /* deuxième numéro WhatsApp, affiché sur tous les documents */
  /* Numéros qui reçoivent les paiements. À CONFIRMER avant l'ouverture du payant :
     un seul endroit à changer. */
  paiement: { orange:'77959848', moov:'73767397', wave:'77959848' },
  /* Paiement direct (Orange, Moov, Wave) : mis de côté, pas supprimé.
     Passer à true pour tout réafficher. Tant que c'est false, on ne paie qu'avec un conseiller. */
  paiementDirect: false,
  site:     'https://monconcoursbf.com',
  playStore: ''              /* le lien Play Store de Mon Concours, dès qu'il est publié */
};

/* « Mot de passe oublié » : le message part vers l'un des deux numéros, en alternance.
   Le candidat n'a rien à choisir. */
function ouvrirWhatsappOubli(){
  const tels = [CONTACT.adminTel, CONTACT.adminTel2];
  let i = 0;
  try{
    i = (parseInt(localStorage.getItem('mc.oubli.alt') || '0', 10) + 1 + Math.floor(Math.random() * 2)) % 2;
    localStorage.setItem('mc.oubli.alt', String(i));
  }catch(e){ i = Math.floor(Math.random() * 2); }
  const msg = "Bonjour, j'ai oublié mon mot de passe Mon Concours. Mon numéro : " + ((S.form && S.form.tel) || '');
  window.open('https://wa.me/226' + tels[i] + '?text=' + encodeURIComponent(msg), '_blank', 'noopener');
}

const REGLAGES = 'monconcours.reglages';

function lireReglages(){
  try{ return JSON.parse(localStorage.getItem(REGLAGES) || '{}') || {}; }catch(e){ return {}; }
}
function sauverTaches(){
  ecrireReglage('taches', Array.from(S.taches || []));
  ecrireReglage('tachesJour', new Date().toDateString());
}
function ecrireReglage(cle, valeur){
  try{
    const r = lireReglages(); r[cle] = valeur;
    localStorage.setItem(REGLAGES, JSON.stringify(r));
  }catch(e){}
}

const MEMOIRE = 'monconcours.candidat';

function lireMemoire(){
  try{ return JSON.parse(localStorage.getItem(MEMOIRE) || 'null'); }
  catch(e){ return null; }
}
function ecrireMemoire(o){
  try{
    const ancien = lireMemoire() || {};
    const base = { dejaVenu:true };
    if(ancien.testFait) base.testFait = true;       // le test de niveau ne s'oublie jamais
    localStorage.setItem(MEMOIRE, JSON.stringify(Object.assign(base, o)));
  }
  catch(e){}
}
/* À la déconnexion on oublie l'identité, jamais le fait d'être déjà venu. */
function oublierIdentite(){
  const m = lireMemoire() || {};
  ecrireMemoire({ niveau: m.niveau || null, testFait: !!m.testFait });
}
function testDejaFait(){ return !!(lireMemoire() || {}).testFait; }

/* =====================================================================
   ÉTAT
   ===================================================================== */
/* Parcours actifs : A (normal), B, E1 (Élite 1), E2 (Élite 2). X, C, D ne reçoivent plus personne ; les anciens comptes les gardent. */
var PARCOURS_CONNUS = ['A','B','C','D','X','E1','E2'];
const S = {
  ecran:'engagement', phase:0, parcours:null,
  testRep:{}, testChrono:120, testTimer:null, testCorrige:false, testNote:null,
  taches:[false,false,false], actuOnglet:'national', cahierFiltre:false,
  niveau:'Troisième', matiere:null, qcmIdx:0, qcmRep:undefined, qcmJustes:0, qcmSerie:0,
  voirClassement:false, voirDiagnostic:false, voirDefi:false, voirBadges:false,
  util:{nom:'', tel:'', pin:'', connecte:false},
  form:{nom:'', tel:'', pin:'', pin2:'', couleur:''}, codeVisible:false, erreur:'',
  abo:{actif:false, formule:null, jours_restants:0, echeance:'abonnement gratuit'},
  gratuit:true,             // phase de lancement : tout est gratuit (le serveur fait foi)
  theme:'clair', sessionCounter:0, cahierDepuisGrille:false,
  modal:null, modalDejaVu:false, matiereOuverte:null, sync:null, bloque:false, qcmPos:{}, rechercheCours:'', compositions:[], niveauConnu:false, notifications:[], notifCharge:false, dateConcours:null, nomConcours:null, typeEpreuve:'Concours direct · épreuve écrite',
  choixFormule:'mensuelle', operateur:'orange', paieTel:'', paieEtape:0,
  concours:'', sujetRef:'', seuil:null, compoEtat:null, compoMessage:'', corrigeServeur:null,
  qcmCorrection:null, qcmAttente:false, banque:null, progression:null, banqueEtat:'vide',
  repriseCorrection:null, paiementEtat:null,
  cahier:[],
  grille:[],
  ressources:null, ressourceOuverte:null, erreurCours:'', classement:null, stats:null, compoReprise:null, compositionId:null, reponses:{}, sujetVu:false, apercu:null, corrige:false, chrono:2400, timer:null, compoTab:'feuille',
  grilleNote:null
};

/* =====================================================================
   OUTILS
   ===================================================================== */
const $ = s => document.querySelector(s);
const vue = () => $('#vue');
let audioCtx = null;
function ctx(){
  if(S.sonCoupe) return null;            // le candidat a coupé le son
  try{ audioCtx = audioCtx || new (window.AudioContext||window.webkitAudioContext)(); return audioCtx; }
  catch(e){ return null; }
}
function ton(freq, depart, duree, volume, forme){
  const a = ctx(); if(!a) return;
  const o = a.createOscillator(), g = a.createGain();
  const t = a.currentTime + depart;
  o.type = forme || 'sine'; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(volume, t + 0.018);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
  o.connect(g); g.connect(a.destination);
  o.start(t); o.stop(t + duree + 0.02);
}
function bip(fois){
  for(let k=0;k<fois;k++) ton(880, k*0.42, 0.32, 0.22);
}
function sonJuste(){
  ton(523.25, 0, 0.22, 0.15);
  ton(659.25, 0.085, 0.22, 0.15);
  ton(783.99, 0.17, 0.26, 0.15);
}
/* Sonnerie de départ : trois notes qui montent, comme la cloche d'une
   salle d'examen. Celle de la mi-parcours est différente, à deux tons
   qui descendent, pour qu'on ne les confonde pas sans regarder. */
function sonDepart(){
  ton(659.25, 0, 0.3, 0.2);
  ton(880, 0.22, 0.3, 0.2);
  ton(1318.5, 0.44, 0.55, 0.2);
}
function sonMiParcours(){
  for(let k = 0; k < 2; k++){
    ton(784, k*0.7, 0.28, 0.2, 'triangle');
    ton(523.25, k*0.7 + 0.3, 0.34, 0.2, 'triangle');
  }
}
/* Couleur du chronomètre : vert au début, orange passé la moitié,
   rouge dans le dernier cinquième, rouge qui bat dans la dernière minute. */
function couleurChrono(reste, total){
  const r = total > 0 ? reste / total : 1;
  if(reste <= 60) return 'c-urgent';
  if(r <= 0.2) return 'c-rouge';
  if(r <= 0.5) return 'c-orange';
  return 'c-vert';
}
function peindreChrono(el, reste, total){
  if(!el) return;
  const c = couleurChrono(reste, total);
  if(!el.classList.contains(c)){
    el.classList.remove('c-vert','c-orange','c-rouge','c-urgent');
    el.classList.add(c);
  }
}
function sonFaux(){
  const a = ctx(); if(!a) return;
  const o = a.createOscillator(), g = a.createGain();
  const t = a.currentTime;
  o.type = 'triangle';
  o.frequency.setValueAtTime(330, t);
  o.frequency.exponentialRampToValueAtTime(175, t + 0.24);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.09, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  o.connect(g); g.connect(a.destination);
  o.start(t); o.stop(t + 0.32);
}
function signalCandidat(txt){
  const z = document.getElementById('annonce');
  if(z) z.textContent = txt;
  const b = document.createElement('div');
  b.className = 'message-flottant';
  b.textContent = txt;
  document.body.appendChild(b);
  setTimeout(() => b.classList.add('vu'), 20);
  setTimeout(() => { b.classList.remove('vu'); setTimeout(() => b.remove(), 400); }, 3600);
}

function annonceTemps(txt){
  const z = document.getElementById('sonnerie');
  if(!z) return;
  z.textContent = txt; z.classList.add('vu');
  clearTimeout(z._t);
  z._t = setTimeout(()=>z.classList.remove('vu'), 4000);
}
const nombreFr = n => (n ?? 0).toLocaleString('fr-FR');

/* La date du jour et le compte à rebours viennent de l'horloge, plus du code.
   S.dateConcours est renseignée depuis la base quand elle existe. */
function dateDuJour(){
  const d = new Date();
  const t = d.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}
/* Le compte à rebours ne s'affiche que si une date d'écrit est renseignée
   en base (table concours, colonne date_ecrit). Pas de date inventée. */
function compteARebours(){
  const j = joursAvantConcours();
  if(j === null){
    /* aucune date d'écrit en base : on compte jusqu'à la prochaine composition nationale (date et heure réelles) */
    const ep = S.epreuve;
    if(ep && ep.etat === 'a_venir' && ep.debut_le){
      const reste = new Date(ep.debut_le) - Date.now();
      const nom = E(ep.concours || 'Composition nationale');
      if(reste <= 0) return '';
      if(memeJourQue(ep.debut_le)) return `<span class="pastille-j urgent"><b class="num">Aujourd'hui, ${heureH(ep.debut_le)}</b>${nom}</span>`;
      const jr = Math.ceil(reste / 86400000);
      return `<span class="pastille-j urgent"><b class="num">J−${jr}</b>Nationale · ${nom}</span>`;
    }
    return '';
  }
  const nom = E(S.nomConcours || 'le concours');
  const date = new Date(S.dateConcours + 'T08:00:00').toLocaleDateString('fr-FR', { day:'numeric', month:'short' });
  if(j <= 0)  return `<span class="pastille-j urgent"><b class="num">Écrit aujourd'hui</b>${nom}</span>`;
  if(j <= 60) return `<span class="pastille-j urgent" title="Écrit le ${date}"><b class="num">J−${j}</b>${nom}</span>`;
  const mois = Math.round(j / 30.44);
  return `<span class="pastille-j" title="Écrit le ${date}"><b class="num">Dans ${mois} mois</b>${nom} · ${date}</span>`;
}
function joursAvantConcours(){
  if(!S.dateConcours) return null;
  const cible = new Date(S.dateConcours + 'T08:00:00');
  const reste = Math.ceil((cible - new Date()) / 86400000);
  return reste >= 0 ? reste : null;
}

/* Un message court, en bas de l'écran. Sert aussi bien à confirmer
   qu'à prévenir que le réseau est tombé. */
let minuteurToast = null;
function toast(message, duree){
  let z = document.getElementById('toast');
  if(!z){
    z = document.createElement('div');
    z.id = 'toast'; z.setAttribute('role','status'); z.setAttribute('aria-live','polite');
    document.body.appendChild(z);
  }
  z.textContent = message;
  z.classList.add('on');
  clearTimeout(minuteurToast);
  minuteurToast = setTimeout(() => z.classList.remove('on'), duree || 3800);
}

function masquerToast(){
  const z = document.getElementById('toast');
  if(z) z.classList.remove('on');
  clearTimeout(minuteurToast);
}

window.addEventListener('offline', () =>
  { toast('Réseau perdu. Vos réponses partiront au retour. Pour réviser sans connexion : « Réviser sans connexion » dans Réviser.', 6500); if(S.ecran === 'aujourdhui') rendre(); });
window.addEventListener('online', () => { toast('Réseau retrouvé.'); if(['aujourdhui','horsligne'].includes(S.ecran)) rendre(); });
const mmss = s => String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
const PALIERS = [3, 7, 21];               // jours entre deux reprises
const JOUR = 86400000;
const aujourdhuiZero = () => { const d=new Date(); d.setHours(0,0,0,0); return d.getTime(); };
function joursRestants(e){
  if(e.revoirLe === undefined) return 0;
  return Math.max(0, Math.round((e.revoirLe - aujourdhuiZero())/JOUR));
}
const DELAI_SORTIE_MS = 0;   // une erreur retrouvée quitte la liste tout de suite

/* « Reprendre » une erreur : la bonne réponse la referme aussitôt (le
   serveur applique la même règle), une mauvaise la garde à reprendre. */
function programmer(e, juste){
  if(juste){
    e.suite = Math.max(3, e.suite + 1);
    e.revoirLe = aujourdhuiZero() + (PALIERS[PALIERS.length-1] * JOUR);
    if(!e.valideLe) e.valideLe = Date.now();   // horodate le moment de la maîtrise
  } else {
    e.suite = 0; e.rate++; e.valideLe = null;
    e.revoirLe = aujourdhuiZero();       // à reprendre aujourd'hui même
  }
}
/* Une erreur est « active » si elle n'est pas encore maîtrisée, ou si elle
   vient tout juste de l'être : les 5 premières minutes servent de
   confirmation visuelle, pas de disparition immédiate et abrupte. */
const active = e => e.suite < 3 || (e.valideLe && Date.now() - e.valideLe < DELAI_SORTIE_MS);
const recemmentValidee = e => e.suite >= 3 && e.valideLe && Date.now() - e.valideLe < DELAI_SORTIE_MS;
const ouvertes = () => S.cahier.filter(e => e.suite < 3).length;
const dues = () => S.cahier.filter(e => e.suite < 3 && joursRestants(e) === 0).length;
const aReprendre = () => S.cahier.filter(active);

/* =====================================================================
   C1 — LA COMPOSITION EN COURS EST GARDÉE SUR LE TÉLÉPHONE
   Fermer l'application, perdre le réseau, actualiser par erreur : le
   candidat retrouve sa feuille exactement où il l'a laissée.
   ===================================================================== */
const EPREUVE = 'monconcours.epreuve';

function sauverEpreuve(){
  try{
    if(S.corrige || !Object.keys(S.reponses || {}).length){ localStorage.removeItem(EPREUVE); return; }
    localStorage.setItem(EPREUVE, JSON.stringify({
      reponses: S.reponses, chrono: S.chrono,
      compositionId: S.compositionId || null, le: Date.now()
    }));
  }catch(e){}
}
function effacerEpreuve(){ try{ localStorage.removeItem(EPREUVE); }catch(e){} }

(function reprendreEpreuve(){
  try{
    const e = JSON.parse(localStorage.getItem(EPREUVE) || 'null');
    if(!e || !e.reponses) return;
    /* au-delà de vingt-quatre heures la copie est abandonnée */
    if(Date.now() - (e.le || 0) > 86400000){ localStorage.removeItem(EPREUVE); return; }
    S.reponses = e.reponses;
    if(typeof e.chrono === 'number') S.chrono = e.chrono;
    if(e.compositionId) S.compositionId = e.compositionId;
  }catch(err){}
})();

/* On prévient avant de quitter une composition en cours. La copie est
   sauvegardée, mais le chronomètre du serveur, lui, continue de tourner. */
window.addEventListener('keydown', e => {
  if(e.ctrlKey || e.metaKey || e.altKey) return;
  const champ = document.activeElement;
  if(champ && /INPUT|TEXTAREA|SELECT/.test(champ.tagName)) return;
  const lettre = (e.key || '').toUpperCase();
  const rang = 'ABCD'.indexOf(lettre);
  const chiffre = '1234'.indexOf(e.key);
  const i = rang >= 0 ? rang : chiffre;
  if(i < 0) return;
  /* on clique la proposition correspondante de la question à l'écran */
  const cible = document.querySelector(
    S.ecran === 'qcm'  ? `[data-qcm="${i}"]` :
    S.ecran === 'test' ? `[data-tb$="-${i}"]` : null);
  if(cible && !cible.disabled){ e.preventDefault(); cible.click(); }
});

window.addEventListener('beforeunload', e => {
  if(S.ecran === 'grille' && !S.corrige && Object.keys(S.reponses || {}).length){
    e.preventDefault(); e.returnValue = '';
  }
});

/* Réglages gardés d'une visite à l'autre : thème, tâches cochées,
   position dans un QCM. Le candidat ne recommence rien. */
(function reprendreReglages(){
  const r = lireReglages();
  if(r.theme === 'sombre' || r.theme === 'clair') S.theme = r.theme;
  if(PARCOURS_CONNUS.includes(r.parcours)) S.parcours = r.parcours;
  /* Lien d'aperçu : ?apercu=normal | b | e1 | e2 (et l'ancien xx1) montre ce parcours sur ce téléphone */
  try{
    const ap = (new URLSearchParams(location.search).get('apercu') || '').toLowerCase();
    const P = { xx1:'X', actuel:'B', normal:'A', a:'A', b:'B', e1:'E1', e2:'E2', elite1:'E1', elite2:'E2' }[ap];
    if(P){ S.parcours = P; ecrireReglage('parcours', P); ecrireReglage('apercuX', true); }
  }catch(e){}
  /* S.taches est un TABLEAU. Object.assign en aurait fait un objet,
     qui n'a pas de .filter : l'accueil plantait et l'écran restait noir. */
  if(Array.isArray(r.taches) && r.tachesJour === new Date().toDateString()){
    S.taches = S.taches.map((v, i) => !!r.taches[i]);
  }
  if(r.qcmPos && typeof r.qcmPos === 'object') S.qcmPos = r.qcmPos;
  if(r.musique) S.musiqueVoulue = true;   // relancée au premier geste du candidat
  if(r.sonCoupe) S.sonCoupe = true;
  if(r.sansAnim) S.sansAnim = true;
  if(r.concentration) S.concentration = true;
})();

/* =====================================================================
   REPRENDRE OÙ L'ON S'EST ARRÊTÉ
   Une leçon se rouvre à l'endroit exact où l'on a quitté ; un QCM, à la
   question suivante. Le serveur est prévenu (au plus une fois par
   45 secondes) : si le candidat part en plein milieu et ne revient pas,
   une notification lui demande s'il veut reprendre, et un toucher le
   ramène au bon endroit. Un cours lu jusqu'au bout n'est plus proposé.
   ===================================================================== */
const REPRISE_VALIDE_MS = 60 * 86400000;           // au-delà de deux mois, on repart du début
const lecturePos = () => { const p = lireReglages().lecturePos; return p && typeof p === 'object' ? p : {}; };

const repriseEnvoi = { dernier: 0, tampon: null, minuteur: null };
function envoyerReprise(x){
  if(!base || !S.util.connecte) return;
  repriseEnvoi.tampon = x;
  clearTimeout(repriseEnvoi.minuteur);
  repriseEnvoi.minuteur = setTimeout(viderReprise, Math.max(0, 45000 - (Date.now() - repriseEnvoi.dernier)));
}
function viderReprise(){
  const x = repriseEnvoi.tampon;
  if(!x || !base || !S.util.connecte) return;
  repriseEnvoi.tampon = null; repriseEnvoi.dernier = Date.now();
  base.rpc('noter_reprise', { p_type:x.type, p_matiere:x.matiere, p_position:x.position, p_total:x.total, p_titre:x.titre || '' }).then(() => {}, () => {});
}
document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'hidden') viderReprise(); });

function noterReprise(type, matiere, position, total, titre){
  const r = Object.assign({}, lireReglages().reprise);
  r[type] = { matiere, niveau: S.niveau, le: Date.now() };
  ecrireReglage('reprise', r);
  envoyerReprise({ type, matiere, position, total, titre });
}
function retirerReprise(type, matiere){
  const r = Object.assign({}, lireReglages().reprise);
  if(r[type] && r[type].matiere === matiere){ delete r[type]; ecrireReglage('reprise', r); }
  if(repriseEnvoi.tampon && repriseEnvoi.tampon.type === type){ repriseEnvoi.tampon = null; clearTimeout(repriseEnvoi.minuteur); }
  if(base && S.util.connecte) base.rpc('clore_reprise', { p_type:type }).then(() => {}, () => {});
}

/* leçon : le chapitre, et l'endroit exact dans ce chapitre */
function noterLecture(matiere, chap, n, titre, off){
  const p = lecturePos();
  p[matiere] = { chap, n, off: Math.round(off * 1000) / 1000, niveau: S.niveau, le: Date.now() };
  ecrireReglage('lecturePos', p);
  noterReprise('cours', matiere, chap, n, titre);
}
function lectureTerminee(matiere){
  const p = lecturePos();
  if(p[matiere]){ delete p[matiere]; ecrireReglage('lecturePos', p); }
  retirerReprise('cours', matiere);
}
/* QCM : la position est dans qcmPos ; ici on prévient le serveur */
function retenirQcm(){
  const m = banqueDe(S.matiere);
  if(!m || !m.questions.length) return;
  const total = m.questions.length, pos = (S.qcmPos && S.qcmPos[S.matiere]) || 0;
  if(pos >= total) retirerReprise('qcm', S.matiere);      // toute la matière est faite
  else noterReprise('qcm', S.matiere, pos, total, '');
}

/* ouverture par la notification « Voulez-vous reprendre ? » */
function repriseCible(type){
  const r = (lireReglages().reprise || {})[type];
  if(!r || Date.now() - (r.le || 0) > REPRISE_VALIDE_MS) return 'revisions';
  if(r.niveau && r.niveau !== S.niveau){
    S.niveau = r.niveau; S.ressources = null; S.banque = null; S.progression = null;
    chargerRessources(); chargerQuestions(true);
  }
  if(type === 'cours'){ S.matiereOuverte = r.matiere; S.ressourceOuverte = null; return 'lecture'; }
  S.matiere = r.matiere; S.qcmIdx = (S.qcmPos && S.qcmPos[r.matiere]) || 0;
  S.qcmRep = undefined; S.qcmCorrection = null; S.qcmSerie = 0; S.qcmDebut = Date.now();
  return 'qcm';
}

/* =====================================================================
   MÉMOIRE DU TÉLÉPHONE
   Ce que l'application a déjà reçu s'affiche tout de suite à la
   prochaine ouverture ; le réseau met ensuite les chiffres à jour.
   Les données personnelles sont liées au numéro du candidat.
   ===================================================================== */
const MEMO = 'monconcours.memo.';
/* une réponse identique à ce qui est déjà affiché ne redessine pas l'écran */
const pareil = (a, b) => { try{ return JSON.stringify(a) === JSON.stringify(b); }catch(e){ return false; } };
const memoQui = () => (S.util && S.util.connecte && S.util.tel) || '';
function memoLire(k, perso){
  try{
    const c = JSON.parse(localStorage.getItem(MEMO + k));
    if(!c || (perso && (!memoQui() || c.u !== memoQui()))) return null;
    return c.d;
  }catch(e){ return null; }
}
function memoEcrire(k, d, perso){
  if(perso && !memoQui()) return;
  try{ localStorage.setItem(MEMO + k, JSON.stringify({ u: perso ? memoQui() : '', d })); }catch(e){}
}
function memoVider(){
  try{ Object.keys(localStorage).filter(k => k.startsWith(MEMO)).forEach(k => { if(JSON.parse(localStorage.getItem(k)).u) localStorage.removeItem(k); }); }catch(e){}
}
function memoReprendre(){
  const perso = ['journee', 'stats', 'details', 'classement', 'notifications', 'rappel', 'top', 'lus', 'elan'];
  perso.forEach(k => { const v = memoLire(k, true); if(v !== null && (S[k] === undefined || S[k] === null || (Array.isArray(S[k]) && !S[k].length))) S[k] = v; });
  const ep = memoLire('epreuve', true); if(ep) S.epreuve = ep;
  const cahier = memoLire('cahier', true); if(cahier && (!S.cahier || !S.cahier.length)) S.cahier = cahier;
  if(S.notifications) S.notifCharge = true;
  if(S.lus) S.lusCharges = false;
  const actu = memoLire('actu');
  if(actu && actu.liste && actu.liste.length && !S.actuChargee){ ACTU.length = 0; actu.liste.forEach(a => ACTU.push(a)); S.actuDerniere = actu.der; S.actuChargee = true; }
}

/* Avant le premier dessin : si ce téléphone connaît déjà le candidat,
   on ouvre l'application sur l'actualité et non sur l'engagement. */
(function accueilDirect(){
  const m = lireMemoire();
  if(!m || !m.dejaVenu) return;
  S.ecran = 'aujourdhui';
  S.modalDejaVu = true;                       // pas de relance d'inscription
  if(m.niveauProfil) S.niveauProfil = m.niveauProfil;
  if(m.nom) S.util = { nom:m.nom, tel:m.tel || '', pin:'', connecte:true };
  try{ memoReprendre(); }catch(e){}
})();

/* Écrans de première visite : on n'y renvoie plus personne par accident. */
const ECRANS_DECOUVERTE = ['engagement','testIntro','test','resultat','verrou','verrou_d'];

const derniersAppels = {};
function pasTropSouvent(cle, ms){
  const t = Date.now();
  if(derniersAppels[cle] && t - derniersAppels[cle] < ms) return false;
  derniersAppels[cle] = t; return true;
}
/* les outils PDF ne se chargent que sur les écrans qui ont un bouton « Télécharger » */
function prechargerOutilsPdf(){
  if(prechargerOutilsPdf.fait) return;
  const c = navigator.connection;
  if(c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ''))) return;
  prechargerOutilsPdf.fait = true;
  ['/lib/html2canvas-1.4.1.min.js', '/lib/jspdf-2.5.2.umd.min.js'].forEach(h => {
    const l = document.createElement('link'); l.rel = 'prefetch'; l.as = 'script'; l.href = h; document.head.appendChild(l);
  });
}
function aller(e){
  if(['resultat', 'gagnants', 'copie'].includes(S.ecran)) S.dernierResultatA = Date.now();
  if(paiementObligatoire() && !S.util.connecte && ['testIntro', 'test'].includes(e)){ S.modal = 'inscription'; S.erreur = ''; return surcouche(); }
  if(e !== 'abonnement' && S.raisonAbo) S.raisonAbo = '';
  /* Une copie remise ne se noircit plus. Revenir sur « Composition »
     après avoir quitté ou terminé ouvre donc un nouveau sujet, au lieu de
     rouvrir la feuille corrigée. Si la copie n'est pas encore partie
     (envoi en cours ou en échec), on reste sur son écran : rien ne se perd. */
  if(e === 'grille' && S.corrige){
    if(S.remiseEtat === 'ok') reinitialiserComposition();
    else return aller('copie');
  }
  /* un nouvel appui sur « Composition » après un échec retente une fois */
  if(e === 'grille' && S.compoEtat === 'erreur' && !ouvertureEnCours) S.compoEtat = null;
  /* le test de niveau se passe une seule fois : plus jamais d'étapes 1, 2, 3 ensuite */
  if(['engagement','testIntro','test'].includes(e) && testDejaFait()) e = 'aujourdhui';
  if(e === 'resultat' && testDejaFait() && S.testNote === null) e = 'aujourdhui';
  if(S.gratuit && !paiementObligatoire() && (e === 'abonnement' || e === 'paiement')) e = 'compte';   // pas de formules pendant la phase gratuite
  if(['abonnement','paiement'].includes(e) && !S.gratuit) chargerPromo();
  if(e === 'abonnement' && paiementObligatoire() && S.util.connecte) chargerAbonnement();
  if(['revisions','qcm'].includes(e)){ progressionMemo(); chargerQuestions(); }
  if(e === 'horsligne'){ S.packOuvert = false; if(!S.ressources) chargerRessources(); }
  if(e !== 'lecture'){ S.matiereOuverte = null; S.lectureReprise = null; }
  if(S.timer && e!=='grille'){clearInterval(S.timer);S.timer=null;}
  if(S.testTimer && e!=='test'){clearInterval(S.testTimer);S.testTimer=null;}
  /* chaque écran entre dans l'historique : le bouton retour du téléphone
     ramène à l'écran précédent au lieu de fermer l'application */
  if(typeof retourEnCours !== 'undefined' && !retourEnCours && e !== S.ecran){
    try{ history.pushState({ ecran:e }, ''); }catch(err){}
  }
  /* on rafraîchit en arrière-plan, au plus toutes les 20 secondes : l'écran s'affiche d'abord avec ce qu'on a */
  if(e === 'aujourdhui' && pasTropSouvent('accueil', 20000)){ chargerJournee(); chargerEpreuve(); chargerDetails(); }
  if((e === 'compte' || e === 'parcours') && pasTropSouvent('compte', 20000)){ chargerJournee(); chargerRappel(); chargerDetails(); chargerProgression(); chargerPlan(); chargerCommInfo(); }
  if(e === 'cahier' && pasTropSouvent('cahier', 20000)){ chargerDetails(); chargerCahier(); }
  if(['copie','gagnants','cahier','revisions','defi'].includes(e)) prechargerOutilsPdf();
  if(e === 'notion' && S.notion && S.notion.jour !== new Date().toDateString()) S.notion = null;
  if(e === 'top') chargerTop();
  if(['recherche','defi','proposer'].includes(e) && !S.banque) chargerQuestions();
  if(e === 'qdj' && S.qdj && S.qdj.jourLocal !== new Date().toDateString()){ S.qdj = null; S.qdjRep = undefined; S.qdjCorrection = null; }
  if(e !== 'grille' && S.ecran === 'grille' && document.fullscreenElement){ try{ document.exitFullscreen(); }catch(err){} }
  if(e === 'grille' && S.ecran !== 'grille' && !S.corrige) pleinEcranAuto();
  S.ecran = e; rendre(); vue().scrollTop = 0;
  try{ vue().focus({preventScroll:true}); }catch(err){}
}

/* =====================================================================
   NAVIGATION
   ===================================================================== */
const ONGLETS = [
  {id:'aujourdhui', g:'actualite', l:'Actualité'},
  {id:'revisions',  g:'revisions', l:'Mes cours'},
  {id:'grille',     g:'grille',    l:'Composition'},
  {id:'cahier',     g:'erreurs',   l:'Mes erreurs'},
  {id:'compte',     g:'compte',    l:'Mon compte'}
];
function nav(){
  const n = $('#nav'), r = $('#rail');
  const cache = ['engagement','testIntro','test','resultat','verrou','verrou_d','seance','inscription','connexion','paiement','xreprise','xbravo'].concat(bloqueParPartenaire() ? ['abonnement'] : []).includes(S.ecran);
  n.style.display = cache ? 'none' : 'grid';
  r.style.display = cache ? 'none' : '';
  const app = document.querySelector('.app'); if(app) app.classList.toggle('sans-rail', cache);
  if(cache) return;
  const OG = estXX1() || estE2() ? ONGLETS_X : ONGLETS;
  n.style.gridTemplateColumns = 'repeat(' + OG.length + ',1fr)';
  n.innerHTML = OG.map(o=>{
    const on = (o.id===S.ecran || (o.id==='grille'&&S.ecran==='copie')
      || (o.id==='aujourdhui'&&['actualite','pourtoi','qdj','gagnants','correctionnat','discussion','question','notion','recherche','defi','top','proposer'].includes(S.ecran))
      || (o.id==='compte'&&(S.ecran==='parcours'||S.ecran==='communaute'||S.ecran==='parrainage'))
      || (o.id==='revisions'&&(S.ecran==='qcm'||S.ecran==='cours'))) ? 'on':'';
    const p = (o.id==='cahier' && ouvertes()) ? `<i class="pastille num">${ouvertes()}</i>`:'';
    const centre = o.id === 'grille' ? ' pivot' : '';
    return `<button class="${on}${centre}" data-go="${o.id}"${on?' aria-current="page"':''}>${p}<span class="g">${ico(o.g, o.id==='grille'?26:19)}</span>${o.l}</button>`;
  }).join('');
  r.innerHTML = OG.map(o=>{
    const on = (o.id===S.ecran || (o.id==='grille'&&S.ecran==='copie')
      || (o.id==='aujourdhui'&&['actualite','pourtoi','qdj','gagnants','correctionnat','discussion','question','notion','recherche','defi','top','proposer'].includes(S.ecran))
      || (o.id==='compte'&&(S.ecran==='parcours'||S.ecran==='communaute'||S.ecran==='parrainage'))
      || (o.id==='revisions'&&(S.ecran==='qcm'||S.ecran==='cours'))) ? 'on':'';
    const p = (o.id==='cahier' && ouvertes()) ? `<span class="pastille num">${ouvertes()}</span>`:'';
    return `<button class="${on}" data-go="${o.id}"${on?' aria-current="page"':''}>
      <span class="g">${ico(o.g,19)}</span>${o.l}${p}</button>`;
  }).join('') + `<div class="bas">${S.gratuit
      ? 'Accès gratuit à tout le site pendant le lancement'
      : S.abo.actif
      ? nomFormule(S.abo.formule) + ' · ' + E(S.abo.echeance)
      : 'Abonnement gratuit · l\'actualité du matin reste gratuite à vie'}</div>`;
}

/* =====================================================================
   ÉCRAN 1 — DIAGNOSTIC
   ===================================================================== */
const TEST = [
  {q:'« Le pays des hommes intègres » est quelle figure de style ?',
   o:['Comparaison','Métaphore','Périphrase','Personnification'],i:2,d:'Français',e:"« Le pays des hommes intègres » désigne le Burkina Faso sans le nommer : c'est une périphrase."},
  {q:'Accord : « les lettres que j\'ai … »',
   o:['écrit','écrite','écrits','écrites'],i:3,d:'Français',e:"Le complément « que » (les lettres) est placé avant « avoir » : le participe s'accorde avec lui, féminin pluriel, donc « écrites »."},
  {q:'Seul cours d\'eau pérenne du Burkina Faso',
   o:['Le Nakambé','Le Nazinon','Le Mouhoun','La Comoé'],i:2,d:'Histoire-géographie',e:"Le Mouhoun (ancienne Volta Noire) est le cours d'eau pérenne que retiennent les programmes. Le Nakambé et le Nazinon se tarissent en saison sèche."},
  {q:'Le pays a pris le nom de Burkina Faso en',
   o:['1960','1983','1984','1987'],i:2,d:'Histoire-géographie',e:'Le 4 août 1984, la Haute-Volta devient le Burkina Faso.'},
  {q:'L\'Alliance des États du Sahel réunit',
   o:['Burkina, Mali, Guinée','Burkina, Mali, Niger','Burkina, Niger, Tchad','Mali, Niger, Guinée'],i:1,d:'Institutions et AES',e:"L'Alliance des États du Sahel réunit le Burkina Faso, le Mali et le Niger."},
  {q:'Date d\'effet du retrait de la CEDEAO',
   o:['28 janvier 2024','29 janvier 2025','1ᵉʳ juillet 2024','16 septembre 2023'],i:1,d:'Institutions et AES',e:'Le retrait de la CEDEAO est devenu effectif le 29 janvier 2025.'},
  {q:'La glycogénolyse est',
   o:['la synthèse du glycogène','la dégradation du glycogène','l\'absorption du glucose','la formation de lipides'],i:1,d:'Sciences de la vie et de la Terre',e:"La glycogénolyse est la dégradation du glycogène en glucose. La synthèse du glycogène s'appelle la glycogénogenèse."},
  {q:'Hormone qui fait baisser la glycémie',
   o:['Le glucagon','L\'insuline','L\'adrénaline','Le cortisol'],i:1,d:'Sciences de la vie et de la Terre',e:"L'insuline fait baisser la glycémie. Le glucagon, lui, la fait monter."},
  {q:'Capitale économique du Burkina Faso',
   o:['Ouagadougou','Bobo-Dioulasso','Koudougou','Banfora'],i:1,d:'Culture générale',e:'Bobo-Dioulasso est la capitale économique. Ouagadougou est la capitale politique.'},
  {q:'Solution de l\'équation 2x + 6 = 0',
   o:['x = 3','x = −3','x = 12','x = −12'],i:1,d:'Logique et calcul',e:'2x + 6 = 0 donne 2x = −6, donc x = −3.'}
];
/* Avis de candidats choisis par l'équipe : nom abrégé s'il est long, rotation automatique */
function lignesAvis(n){
  const l = S.avisVitrine || [];
  if(!l.length) return '';
  const k = Math.min(n, l.length), p = (S.avisPos || 0) % l.length;
  let h = '';
  for(let i = 0; i < k; i++){
    const a = l[(p + i) % l.length];
    h += `<blockquote>« ${E(a.message)} »<cite>${E(a.nom || 'Un candidat')}</cite></blockquote>`;
  }
  return h;
}
function blocAvisVitrine(){
  if(!(S.avisVitrine || []).length) return '';
  return `<div class="avis-vitrine" data-avis-n="3">${lignesAvis(3)}</div>`;
}
function blocAvisAccueil(){
  chargerAvisVitrine();
  if(!(S.avisVitrine || []).length) return '';
  return `<section class="bloc avis-accueil" aria-label="Ce que disent les candidats">
    <div class="libelle">Ce que disent les candidats</div>
    <div class="avis-vitrine" data-avis-n="1">${lignesAvis(1)}</div></section>`;
}
function majAvisDom(){
  document.querySelectorAll('.avis-vitrine[data-avis-n]').forEach(c => { c.innerHTML = lignesAvis(+c.dataset.avisN || 1); });
}
setInterval(() => {
  const l = S.avisVitrine || [];
  if(l.length < 2 || document.hidden) return;
  const cs = document.querySelectorAll('.avis-vitrine[data-avis-n]');
  if(!cs.length) return;
  S.avisPos = ((S.avisPos || 0) + 1) % l.length;
  cs.forEach(c => { c.classList.add('passe'); });
  setTimeout(() => { majAvisDom(); document.querySelectorAll('.avis-vitrine.passe').forEach(c => c.classList.remove('passe')); }, 350);
}, 7000);
async function chargerAvisVitrine(){
  if(!base || S.avisVitrineCharge) return;
  S.avisVitrineCharge = true;
  try{
    const { data } = await base.rpc('avis_vitrine');
    if(Array.isArray(data) && data.length){
      S.avisVitrine = data;
      if(['engagement'].includes(S.ecran)) rendre();
      else if(S.ecran === 'aujourdhui') rendre();
    }
  }catch(e){ S.avisVitrineCharge = false; }
}
/* --- 1 sur 3 : l'engagement --- */
function ecranEngagement(){
  chargerAvisVitrine();
  vue().innerHTML = `
  <div class="hero">
    <div class="marquehero">${logoSvg(38)}
      <div><div class="mot">MON <i>CONCOURS</i></div>
        <div class="devise">Prépare ton concours, un jour après l'autre.</div></div></div>
    <div class="progression"><i class="on"></i><i></i><i></i></div>
    <div class="pastille-etape" style="margin:12px 0 0">Étape 1 sur 3 · l'engagement</div>
    <div class="reveal" style="padding-top:24px">
      <div class="serment">Es-tu prêt<br>à réussir ton<br>concours <em>cette année</em> ?</div>
      <div class="compteur-place" style="margin-top:18px">
        <p style="font-size:13.5px;line-height:1.5">Ceux qui ont obtenu les concours n'étaient pas plus intelligents. Ils étaient prêts.</p>
      </div>
      <p class="sous" style="margin:14px 0 0;font-size:13px;line-height:1.5">Compositions chronométrées, corrections détaillées, cours et actualité utile aux concours.</p>
      <p class="sous" style="margin:6px 0 0;font-size:13px"><b>Plus de 1 000 candidats</b> préparent leur concours ici.</p>
      <button class="cta" style="margin-top:16px" data-go="testIntro">Oui, je vais réussir</button>
      <button class="lien" style="display:block;margin:12px auto 0" data-modal="connexion">J'ai déjà un compte</button>
      ${blocAvisVitrine()}
    </div>
  </div>`;
}

/* --- 2 sur 3 : l'annonce du test --- */
function ecranTestIntro(){
  vue().innerHTML = `
  <div class="hero">
    <div class="marquehero">${logoSvg(38)}
      <div><div class="mot">MON <i>CONCOURS</i></div>
        <div class="devise">Prépare ton concours, un jour après l'autre.</div></div></div>
    <div class="progression"><i class="on"></i><i class="on"></i><i></i></div>
    <div class="pastille-etape" style="margin:12px 0 0">Étape 2 sur 3 · le diagnostic</div>
    <div class="reveal" style="padding-top:24px">
      <div class="serment" style="font-size:32px">Prouve-nous<br>que tu en es<br><em>capable</em>.</div>
      <p class="hero-texte">Dix questions du type de celles des concours, deux minutes. Tu sauras par où commencer.</p>
      <div class="compteur-place" style="margin-top:16px">
        <p style="font-size:13.5px;line-height:1.5">Tu composes sur la vraie feuille : des cercles à noircir, une machine qui lit.</p>
      </div>
      <button class="cta" style="margin-top:16px" data-test="go">Tester mon niveau</button>
    </div>
  </div>`;
}

/* --- 2 sur 3 : la feuille --- */
function ecranTest(){
  const rep = Object.keys(S.testRep).length;
  vue().innerHTML = `
  <div class="grille">
    <div class="gr-tete">
      <div><h1 class="t">Votre feuille de composition</h1>
        <div class="eyebrow" style="color:#B5AC96">Test de niveau · 10 questions</div></div>
      <div style="text-align:right">
        <div class="gr-chrono ${couleurChrono(S.testChrono, 120)}" id="tchrono">${mmss(S.testChrono)}</div>
        <div class="eyebrow" style="color:#B5AC96">temps restant</div></div>
    </div>
    <div class="sonnerie" id="sonnerie" role="status" aria-live="polite"></div>
    <div class="gr-consigne"><span>Une, plusieurs ou aucune réponse</span><span>Aucun retour en arrière</span></div>
    <div class="gr-corps" id="tcorps">
      ${TEST.map((g,qi)=>{
        const r = S.testRep[qi] || [];
        return `<div class="gr-q">
          <div class="en"><div class="no">${String(qi+1).padStart(2,'0')}</div><div class="tx">${E(g.q)}</div></div>
          <div class="reponses">
            ${g.o.map((o,i)=>{
              const choisi = r.includes(i);
              let c = choisi?'noirci':'', l='';
              if(S.testCorrige){
                c = choisi ? ((i===g.i)?'ok':'ko') : ((i===g.i)?'vraie':'');
                if(i===g.i) l = 'juste-rep';
              }
              return `<button class="rep ${l}" data-tb="${qi}-${i}" ${choisi&&!S.testCorrige?'disabled':''}
                aria-label="Question ${qi+1}, réponse ${'ABCD'[i]} : ${E(o)}" aria-pressed="${choisi}">
                <span class="bulle ${c}">${'ABCD'[i]}</span><span class="lib">${E(o)}</span></button>`;
            }).join('')}
          </div>
        </div>`;
      }).join('')}
    </div>
    <div class="gr-pied">
      <div class="compte"><span>${rep} sur 10 traitées</span><span>un cercle noirci est définitif</span></div>
      <button class="remettre" data-tremettre="1">Remettre ma copie</button>
    </div>
  </div>`;
  if(!S.testTimer && !S.testCorrige){
    if(S.testChrono >= 120){ sonDepart(); setTimeout(() => annonceTemps('L\'épreuve commence'), 50); }
    S.testTimer = setInterval(()=>{
      S.testChrono--;
      const c = document.getElementById('tchrono');
      if(c){ c.textContent = mmss(S.testChrono); peindreChrono(c, S.testChrono, 120); }
      if(S.testChrono===60){ sonMiParcours(); annonceTemps('Mi-parcours : il reste 1 minute'); }
      if(S.testChrono===30){ bip(3); annonceTemps('Plus que 30 secondes'); }
      if(S.testChrono<=0){ clearInterval(S.testTimer); S.testTimer=null; bip(4); remettreTest(); }
    },1000);
  }
}
/* « Remettre » avec des questions sans réponse : on prévient avant d'envoyer. Le temps écoulé remet toujours, sans demander. */
function confirmerRemise(sans, avecMoyenne, quandOui, repondues){
  const ancien = document.getElementById('confirm-remise'); if(ancien) ancien.remove();
  const ov = document.createElement('div');
  ov.id = 'confirm-remise'; ov.setAttribute('role','dialog'); ov.setAttribute('aria-modal','true');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9100;display:flex;align-items:center;justify-content:center;padding:20px';
  ov.innerHTML = `<div style="background:var(--ardoise);border:1px solid var(--trait);border-radius:16px;padding:22px 18px;width:100%;max-width:360px;box-shadow:0 8px 32px rgba(0,0,0,.35)">
    <div style="font-size:18px;font-weight:700;margin-bottom:8px">Il te reste ${sans} question${sans>1?'s':''} sans réponse.</div>
    <p class="sous" style="margin:0 0 6px">Remettre quand même ?</p>
    ${avecMoyenne ? '<p class="sous" style="margin:0 0 ' + (repondues < 10 ? 6 : 14) + 'px;font-size:13px">Ceux qui composent jusqu\'au bout font 33/50 en moyenne.</p>' : '<div style="height:8px"></div>'}
    ${avecMoyenne && repondues < 10 ? '<p class="sous" style="margin:0 0 14px;font-size:13px">Avec moins de 10 réponses, cette composition ne compte pas parmi tes compositions offertes.</p>' : ''}
    <button class="cta" data-cr="non" style="margin-top:0">Continuer à composer</button>
    <button class="cta creux" data-cr="oui" style="margin-top:9px">Remettre quand même</button>
  </div>`;
  ov.addEventListener('click', e => {
    const b = e.target.closest('[data-cr]');
    if(!b && e.target !== ov) return;
    ov.remove();
    if(b && b.dataset.cr === 'oui') quandOui();
  });
  document.body.appendChild(ov);
}
function remettreTest(){
  const cr = document.getElementById('confirm-remise'); if(cr) cr.remove();
  if(S.testTimer){clearInterval(S.testTimer);S.testTimer=null;}
  S.testCorrige = true;
  ecrireMemoire(Object.assign({}, lireMemoire() || {}, { testFait:true }));
  pister('DIAGNOSTIC_COMPLETED', { repondues: Object.keys(S.testRep).length });
  let n=0; TEST.forEach((g,i)=>{ const r=S.testRep[i]||[]; if(r.length===1 && r[0]===g.i) n++; });
  S.testNote = n;
  noterSucces('test');
  // les fautes du test ouvrent le cahier
  TEST.forEach((g,i)=>{
    const r = S.testRep[i] || [];
    const juste = r.length===1 && r[0]===g.i;
    if(r.length && !juste && !S.cahier.some(e=>e.q===g.q))
      S.cahier.push({q:g.q, mien:r.map(x=>g.o[x]).join(' + '), bon:g.o[g.i], opts:g.o, i:g.i, rate:1, suite:0, revoirLe:0, session:0,
        note:'Ratée au test d\'entrée. Elle ouvre ton cahier : elle reviendra jusqu\'à être acquise.'});
  });
  ecranTest();
  const corps = document.getElementById('tcorps');
  if(corps){
    const s=document.createElement('div'); s.className='scan'; corps.appendChild(s);
    setTimeout(()=>{ s.remove(); pister('DIAGNOSTIC_RESULT_VIEWED', { note: S.testNote, parcours: S.parcours });
      if((S.parcours === 'B' || S.parcours === 'C' || S.parcours === 'X' || estElite()) && !S.util.connecte){ pister('RESULT_LOCKED'); aller('verrou'); }
      else if(S.parcours === 'D' && !S.util.connecte){ pister('RESULT_LOCKED'); aller('verrou_d'); }
      else aller('resultat'); }, 1600);
  }
}

/* --- parcours D : popup paiement optionnel après le résultat --- */
function ouvrirPopupPaiementD(){
  if(document.getElementById('popup-paiement-d')) return; // déjà ouvert
  pister('PARCOURS_D_PAYWALL_SHOWN');
  const overlay = document.createElement('div');
  overlay.id = 'popup-paiement-d';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9000;display:flex;align-items:flex-end;justify-content:center';
  overlay.innerHTML = `
  <div style="background:var(--fond);border-radius:20px 20px 0 0;padding:24px 20px 36px;width:100%;max-width:480px;box-shadow:0 -4px 32px rgba(0,0,0,.18)">
    <div style="width:40px;height:4px;background:var(--bord);border-radius:2px;margin:0 auto 20px"></div>
    <div style="font-size:22px;font-weight:700;margin-bottom:8px">Continue à te préparer 🎯</div>
    <p style="color:var(--sous);margin:0 0 20px;font-size:14px;line-height:1.5">Accède à toutes les révisions, compositions et ton plan personnalisé. Résilie à tout moment.</p>
    <div style="display:grid;gap:10px;margin-bottom:18px">
      <button class="cta" style="margin:0" data-go="abonnement" data-paiement-plus-tard-close="1">
        Voir les offres<small>À partir de 1 000 FCFA par mois</small>
      </button>
      <button class="lien" style="display:block;text-align:center;padding:12px 0" data-paiement-plus-tard="1">
        Plus tard
      </button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  /* fermer en cliquant l'overlay */
  overlay.addEventListener('click', ev => {
    const btn = ev.target.closest('[data-paiement-plus-tard],[data-go]');
    if(btn){
      overlay.remove();
      if(btn.dataset.go === 'abonnement'){ pister('PARCOURS_D_PAYWALL_CLICKED'); aller('abonnement'); }
      else pister('PARCOURS_D_PAYWALL_DISMISSED');
    } else if(ev.target === overlay){
      overlay.remove(); pister('PARCOURS_D_PAYWALL_DISMISSED');
    }
  });
}

/* --- 3 sur 3 : le résultat --- */
function bilanDomaines(){
  const m = {};
  TEST.forEach((g,i)=>{
    m[g.d] = m[g.d] || {j:0,f:0,n:0};
    m[g.d].n++;
    const r = S.testRep[i] || [];
    if(r.length===1 && r[0]===g.i) m[g.d].j++; else m[g.d].f++;
  });
  return m;
}
function ecranResultat(){
  if(S.testNote === null || S.testNote === undefined) return ecranTestIntro();   // pas de note sans test passé
  const n = S.testNote, dom = bilanDomaines();
  const forces = Object.keys(dom).filter(d=>dom[d].f===0);
  const faibles = Object.keys(dom).filter(d=>dom[d].f>0).sort((a,b)=>dom[b].f-dom[a].f);
  const solide = n >= 6;

  const analyse = n <= 1
    ? `Ce test te donne un point de départ, pas un verdict. ${faibles.length?`Tu as surtout perdu des points en ${faibles.slice(0,2).join(' et ').toLowerCase()}.`:''} Reprends tes fautes une par une : elles reviennent jusqu'à être acquises, et la note monte vite quand on part de là.`
    : n <= 3
    ? `Il y a beaucoup à reprendre, et c'est normal pour un premier test. ${faibles.length?`Tes pertes se concentrent sur ${faibles.slice(0,2).join(' et ').toLowerCase()}.`:''} Commence par tes fautes, puis une matière à la fois.`
    : solide
    ? `Tu as des bases solides${forces.length?` — ${forces.slice(0,2).join(' et ').toLowerCase()} ${forces.length>1?'ne te posent':'ne te pose'} pas de problème`:''}. Mais ${faibles.length?`${faibles.length>1?'certaines lacunes précises':'une lacune précise'} — ${faibles.slice(0,2).join(', ').toLowerCase()} —`:'quelques lacunes'} peuvent te coûter des points le jour du concours.`
    : `Les bases sont là, mais elles ne tiennent pas encore sous chronomètre. ${faibles.length?`Tes pertes se concentrent sur ${faibles.slice(0,2).join(' et ').toLowerCase()}.`:''} Ce n'est pas un problème d'intelligence : c'est un problème d'entraînement, et il se règle.`;

  vue().innerHTML = `
  <div class="pad" style="padding-top:20px">
    <div class="marquehero">${logoSvg(38)}
      <div><div class="mot">MON <i>CONCOURS</i></div>
        <div class="devise">Prépare ton concours, un jour après l'autre.</div></div></div>
    <div class="progression"><i class="on"></i><i class="on"></i><i class="on"></i></div>
    <div class="pastille-etape" style="margin:14px 0 10px">Étape 3 sur 3 · ton résultat</div>

    <div class="bloc-note">
      <div class="marque-note ${solide?'ok':''}">
        <span class="v num">${n}</span><span class="d num">/10</span>
      </div>
      <div class="note-legende">
        <div class="l1">Note obtenue</div>
        <div class="l2">${n} bonne${n>1?'s':''} réponse${n>1?'s':''} sur 10 questions</div>
        <div class="l3 ${solide?'ok':''}">${solide?'Bonne base de départ':(n<=3?'Point de départ':'Base à consolider')}</div>
      </div>
    </div>

    <div class="echelle">
      <div class="ec-tete"><span>Ton niveau aujourd'hui</span><span class="num">${n}/10</span></div>
      <div class="barre-seuil">
        <div class="piste"></div>
        <div class="moi" style="width:${Math.min(100,n*10)}%;background:${solide?'var(--cachet)':'var(--or)'}"></div>
      </div>
      <div class="ec-pied">
        <span class="num">0</span>
        <span class="num">10</span>
      </div>
    </div>

    <div class="bloc">
      <div class="libelle">Ce que ta copie dit exactement</div>
      <div class="carte">
        ${Object.keys(dom).map(d=>`
          <div class="domaine"><span class="n">${d}</span>
            <span class="pts">${Array.from({length:dom[d].n},(_,k)=>`<i class="${k<dom[d].j?'j':'f'}"></i>`).join('')}</span>
            <span class="val num" style="width:34px;text-align:right">${dom[d].j}/${dom[d].n}</span></div>`).join('')}
      </div>
    </div>

    <div class="verdict ${solide?'solide':'fragile'}">
      <b>L'analyse</b>${analyse}
    </div>

    <div class="bonne-nouvelle">
      <h2>Tes trois prochaines actions</h2>
      <ol class="actions-diag">
        <li><b>Reprendre tes fautes de ce test.</b> Elles sont déjà dans « Mes erreurs » et reviendront jusqu'à être acquises.</li>
        <li><b>${faibles.length ? 'Réviser ' + E(faibles[0]) : 'Garder ton avance'}.</b> ${faibles.length ? 'C\'est là que tu as perdu le plus de points : dix questions par jour suffisent pour commencer.' : 'Aucune matière faible sur ce test : passe directement aux questions du niveau de ton concours.'}</li>
        <li><b>Faire ta première composition.</b> 50 questions en 40 minutes, sur la vraie feuille : tu verras ton niveau en conditions réelles.</li>
      </ol>
    </div>

    ${S.util.connecte ? lignesSuiteX('resultat') : ''}
    ${S.parcours === 'B' || S.parcours === 'C' || estElite() ? feuilleTestCorrigee() : ''}
    ${S.parcours === 'C' ? blocPlanPaiement(faibles) : ''}
    ${S.parcours === 'E1' ? blocPlanRattrapage(faibles) : ''}
    <button class="cta" style="margin-top:18px" data-entrer="1" data-fautes="${n < 10 ? 1 : 0}">${n < 10 ? 'Reprendre mes fautes maintenant' : (S.parcours === 'B' || S.parcours === 'C' || estElite() ? 'Continuer dans l\'application' : 'Entrer dans l\'application')}<small>${n < 10 ? (10 - n) + ' faute' + (10 - n > 1 ? 's' : '') + ' dans « Mes erreurs »' : 'Actualité · révisions · composition · erreurs'}</small></button>
  </div>`;
  /* Parcours D : proposer le paiement après 3 secondes, avec bouton "Plus tard" */
  if(S.parcours === 'D'){
    setTimeout(() => ouvrirPopupPaiementD(), 3000);
  }
}

/* --- parcours C : le plan de rattrapage et les prix, juste après la feuille corrigée --- */
function blocPlanPaiement(faibles){
  if(S.gratuit || estAbonnePaye()) return '';
  const cible = faibles.length ? faibles.slice(0,2).map(x => E(x)).join(' et ') : 'les matières du concours';
  const f = FORMULES, an = f.annuelle;
  const ligne = (k, nom, sous) => carteFormule(k, sous);
  return `<div class="bonne-nouvelle" style="margin-top:18px">
    <h2>Ton plan pour rattraper ${cible}</h2>
    <p class="sous" style="margin:0 0 10px">La première séance est ouverte pour toi dans l'application. Le plan complet se débloque avec un pass.</p>
    ${S.offre ? `<div class="offre-kicker" style="margin:0 0 8px">Offre du jour · valable aujourd'hui seulement · il reste <b data-offre-reste="1">${resteOffre()}</b></div>` : ''}
    ${S.offre ? ligne('annuelle', 'Abonnement Année', '12 mois sans limite, à moitié prix. L\'offre expire ' + jourOffre() + ' à minuit.') : ''}
    ${ligne('mensuelle', 'Abonnement Mois', '30 jours pour travailler chaque jour.')}
    ${S.offre ? '' : ligne('annuelle', 'Abonnement Année', '12 mois sans limite.')}
  </div>`;
}

/* --- parcours D : install PWA + notifs obligatoires avant de voir le résultat --- */
function ecranVerrouD(){
  const etapeD = S.verrouDEtape || 1; // 1=inscription, 2=install, 3=notifs
  let contenu = '';
  if(etapeD === 1){
    contenu = `
    <div class="marquehero">${logoSvg(38)}
      <div><div class="mot">MON <i>CONCOURS</i></div>
        <div class="devise">Prépare ton concours, un jour après l'autre.</div></div></div>
    <div class="progression"><i class="on"></i><i class="on"></i><i class="on"></i></div>
    <div class="pastille-etape" style="margin:14px 0 10px">Ta copie est corrigée</div>
    <div class="bloc-note">
      <div class="marque-note"><span class="v num">?</span><span class="d num">/10</span></div>
      <div class="note-legende">
        <div class="l1">Ta note est prête</div>
        <div class="l2">Dix questions corrigées</div>
        <div class="l3">Inscris-toi pour la voir</div>
      </div>
    </div>
    <div class="verdict fragile"><b>Inscris-toi gratuitement pour voir ta réponse.</b>
      Tu découvres ta note, ta feuille corrigée avec l'explication de chaque question, et les matières à travailler en premier.</div>
    <button class="cta" style="margin-top:18px" data-modal="inscription">Voir ma note et mes erreurs : inscription gratuite<small>30 secondes, sans e-mail</small></button>
    <button class="lien" style="display:block;margin:12px auto 0" data-modal="connexion">J'ai déjà un compte</button>`;
  } else if(etapeD === 2){
    contenu = `
    <div class="marquehero">${logoSvg(38)}
      <div><div class="mot">MON <i>CONCOURS</i></div></div></div>
    <div class="pastille-etape" style="margin:20px 0 10px">Étape 1 sur 2 · installe l'application</div>
    <div class="bloc-note" style="padding:20px 16px">
      <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="var(--accent)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:block;margin:0 auto 12px"><path d="M12 2v13M8 11l4 4 4-4"/><rect x="3" y="17" width="18" height="4" rx="2"/></svg>
      <div class="note-legende" style="text-align:center">
        <div class="l1">Télécharge l'application</div>
        <div class="l2">Accède à ta note depuis ton écran d'accueil, même sans connexion.</div>
      </div>
    </div>
    <div class="verdict fragile">Une fois installée, tu accèdes à ta note et à toutes les fonctionnalités : révisions quotidiennes, compositions, plan de correction.</div>
    <button class="cta" style="margin-top:18px" data-installe-d="1">Installer l'application<small>Gratuit · sur ton écran d'accueil</small></button>`;
  } else if(etapeD === 3){
    contenu = `
    <div class="marquehero">${logoSvg(38)}
      <div><div class="mot">MON <i>CONCOURS</i></div></div></div>
    <div class="pastille-etape" style="margin:20px 0 10px">Étape 2 sur 2 · active les rappels</div>
    <div class="bloc-note" style="padding:20px 16px">
      <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="var(--accent)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:block;margin:0 auto 12px"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
      <div class="note-legende" style="text-align:center">
        <div class="l1">Active les notifications</div>
        <div class="l2">Reçois tes rappels de révision et les alertes de composition.</div>
      </div>
    </div>
    <div class="verdict fragile">Tu recevras une alerte le matin pour réviser et un rappel avant chaque composition nationale.</div>
    <button class="cta" style="margin-top:18px" data-notifs-d="1">Activer les notifications<small>Tu peux les désactiver à tout moment</small></button>`;
  }
  vue().innerHTML = `<div class="pad" style="padding-top:20px">${contenu}</div>`;
}

/* --- parcours B : la note reste cachée jusqu'à l'inscription --- */
function ecranVerrou(){
  vue().innerHTML = `
  <div class="pad" style="padding-top:20px">
    <div class="marquehero">${logoSvg(38)}
      <div><div class="mot">MON <i>CONCOURS</i></div>
        <div class="devise">Prépare ton concours, un jour après l'autre.</div></div></div>
    <div class="progression"><i class="on"></i><i class="on"></i><i class="on"></i></div>
    <div class="pastille-etape" style="margin:14px 0 10px">Ta copie est corrigée</div>
    <div class="bloc-note">
      <div class="marque-note"><span class="v num">?</span><span class="d num">/10</span></div>
      <div class="note-legende">
        <div class="l1">Ta note est prête</div>
        <div class="l2">Dix questions corrigées</div>
        <div class="l3">Inscris-toi pour la voir</div>
      </div>
    </div>
    <div class="verdict fragile"><b>Inscris-toi gratuitement pour voir ta réponse.</b>
      Tu découvres ta note, ta feuille corrigée avec l'explication de chaque question, et les matières à travailler en premier.</div>
    <button class="cta" style="margin-top:18px" data-modal="inscription">Voir ma note et mes erreurs : inscription gratuite<small>30 secondes, sans e-mail</small></button>
    <button class="lien" style="display:block;margin:12px auto 0" data-modal="connexion">J'ai déjà un compte</button>
  </div>`;
}
function feuilleTestCorrigee(){
  return `<div class="bloc">
    <div class="libelle">Ta feuille corrigée</div>
    ${TEST.map((g,qi) => {
      const r = S.testRep[qi] || [];
      const juste = r.length === 1 && r[0] === g.i;
      const mien = r.length ? r.map(x => g.o[x]).join(' + ') : 'sans réponse';
      return `<div class="carte" style="margin-bottom:10px">
        <div class="eyebrow">${String(qi+1).padStart(2,'0')} · ${E(g.d)} · ${juste ? 'juste' : 'faux'}</div>
        <p style="margin:6px 0;font-weight:600;font-size:14px">${E(g.q)}</p>
        <p class="sous" style="margin:0">Ta réponse : ${E(mien)}</p>
        <p class="sous" style="margin:2px 0 0"><b>Bonne réponse : ${E(g.o[g.i])}</b></p>
        <p class="sous" style="margin:6px 0 0">${E(g.e || '')}</p>
      </div>`;
    }).join('')}
  </div>`;
}

/* =====================================================================
   ÉCRAN 2 — AUJOURD'HUI
   ===================================================================== */


/* =====================================================================
   LES QUESTIONS VIENNENT DE LA BASE
   ===================================================================== */
const niveauBase = () => S.niveau.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
/* le niveau du candidat (inscription) pour composer et pour le fil ; à défaut, celui affiché */
const niveauCand = () => S.niveauProfil || niveauBase();

/* La banque de révision du niveau choisi. Les questions arrivent sans
   leurs corrigés : la correction est donnée par le serveur, question par
   question, après la réponse du candidat. */
let banqueNiveau = null;
async function chargerQuestions(force){
  if(!base) return;
  const niv = niveauBase();
  if(!force && banqueNiveau === niv && S.banque && S.banqueEtat === 'pret') return;
  banqueNiveau = niv;
  const memo = memoLire('banque-' + niv);
  if(memo && memo.length){ S.banque = memo; S.banqueEtat = 'pret'; if(['revisions','qcm'].includes(S.ecran)) rendre(); }
  else S.banqueEtat = 'chargement';
  try{
    /* par pages de 1000 : la base en renvoie 1000 au plus d'un coup, et les dernières matières ajoutées
       (psychotechnique) restaient dehors dès que le niveau dépassait 1000 questions. */
    let data = [];
    for(let a = 0; a < 8000; a += 1000){
      const { data: page, error } = await base.from('questions')
        .select('id, enonce, niveau, difficulte, matiere_id, matieres(nom, ordre, niveaux), question_options(position, texte)')
        .eq('statut', 'publie')
        .or('niveau.eq.' + niv + ',niveau.is.null')
        .order('cree_le').order('id')
        .range(a, a + 999);
      if(error) throw error;
      data = data.concat(page || []);
      if(!page || page.length < 1000) break;
    }
    const parMatiere = {};
    (data || []).forEach(q => {
      if(!q.matieres) return;
      if(q.matieres.niveaux && !q.matieres.niveaux.includes(niv)) return;   /* Droit, Économie : licence seulement */
      const o = (q.question_options || []).slice().sort((a,b) => a.position - b.position);
      if(o.length < 2) return;
      const m = q.matieres.nom;
      (parMatiere[m] = parMatiere[m] || { nom:m, ordre:q.matieres.ordre || 99, questions:[] })
        .questions.push({ id:q.id, q:q.enonce, o:o.map(x => x.texte), d:q.difficulte || 2 });
    });
    /* Les questions ont été saisies par lots du même sujet : on les écarte les unes des autres (ordre fixe, pas aléatoire). */
    Object.values(parMatiere).forEach(m => {
      const n = m.questions.length;
      if(n < 6) return;
      let pas = Math.max(2, Math.round(n * 0.618));
      const pgcd = (a, b) => b ? pgcd(b, a % b) : a;
      while(pgcd(pas, n) !== 1) pas++;
      m.questions = m.questions.map((_, i) => m.questions[(i * pas) % n]);
    });
    /* Les questions difficiles passent devant : le candidat attaque par le niveau du concours, les plus simples viennent ensuite. */
    Object.values(parMatiere).forEach(m => {
      const dures = m.questions.filter(x => x.d >= 3), autres = m.questions.filter(x => x.d < 3);
      m.questions = dures.concat(autres);
    });
    S.banque = Object.values(parMatiere).sort((x,y) => x.ordre - y.ordre);
    S.banqueEtat = 'pret';
    memoEcrire('banque-' + niv, S.banque);
  }catch(e){
    if(S.banqueEtat !== 'pret') S.banqueEtat = 'erreur';
  }
  chargerProgressionMatieres();
  if(['revisions','qcm'].includes(S.ecran)) rendre();
}
function progressionMemo(){ if(!S.progression){ const p = memoLire('progression-' + niveauBase(), true); if(p) S.progression = p; } }

/* Ce que le candidat a réellement fait, matière par matière. */
async function chargerProgressionMatieres(){
  if(!base) return;
  try{
    const { data } = await base.rpc('ma_progression', { p_niveau: niveauBase() });
    S.progression = {};
    (data || []).forEach(m => { S.progression[m.matiere] = m; });
    memoEcrire('progression-' + niveauBase(), S.progression, true);
    if(S.ecran === 'revisions') rendre();
  }catch(e){}
}

const banqueDe = nom => (S.banque || []).find(m => m.nom === nom);

/* Pendant que le candidat lit l'accueil : question du jour, top 10 et
   un premier fil « Pour toi » arrivent en silence. Toucher le bouton
   ne fait alors plus attendre. Rien de lourd en 2G : la banque de
   questions n'est préchargée que si le réseau est correct. */
function prechargerSuite(){
  if(!base) return;
  const lent = navigator.connection && (navigator.connection.saveData || /(^|-)2g$/.test(navigator.connection.effectiveType || ''));
  if(!S.qdj) chargerQdj();
  if(S.epreuve && S.epreuve.etat === 'terminee') chargerClassement(S.epreuve.id);
  if(S.util.connecte){
    chargerTop();
    if(!S.filPret) base.rpc('fil_pour_toi', { p_niveau: niveauCand(), p_nombre: 10 }).then(({ data }) => { if(Array.isArray(data) && data.length) S.filPret = { liste:data, t:Date.now() }; }, () => {});
    if(!S.rappel) chargerRappel();
  }
  if(!lent && !memoLire('banque-' + niveauBase())) chargerQuestions();
}

/* =====================================================================
   RELIRE SA PROGRESSION
   ===================================================================== */
/* messages de l'administration qui s'ouvrent en fenêtre (réponse à un avis, annonce à tous) */
const NOTIFS_FENETRE = ['annonce_plein', 'annonce_popup', 'reponse_admin_plein'];
async function chargerNotifications(){
  if(!base) return;
  try{
    const uid = await utilisateurCourant();
    if(!uid) return;
    const { data: brut } = await base.rpc('mes_notifications');
    const data = (brut || []).filter(n => n.type !== 'annonce_popup');   // une annonce « fenêtre seule » n'entre pas dans la cloche
    const avant = new Set((S.notifications || []).map(n => n.id));
    const memes = pareil(data, S.notifications);
    S.notifications = data;
    memoEcrire('notifications', S.notifications, true);
    /* une nouvelle notification : un son léger et un bandeau qu'on peut toucher */
    const vues = lireReglages().notifVues || [];
    const neuves = S.notifications.filter(n => !n.lue && !vues.includes(n.id) && !NOTIFS_FENETRE.includes(n.type) && (S.notifCharge ? !avant.has(n.id) : true));
    S.notifCharge = true;
    if(!memes) rendre();
    /* l'administration a écrit : une fenêtre plein écran, qu'on ferme d'un geste */
    const fenetres = (brut || []).filter(n => NOTIFS_FENETRE.includes(n.type) && !n.lue && (!n.cree_le || Date.now() - new Date(n.cree_le) < 7 * 86400000));
    if(fenetres.length && !enComposition() && !document.querySelector('.fenetre-evt')){
      fenetreAnnonce(fenetres[fenetres.length - 1]);
    } else if(!document.querySelector('.fenetre-evt') && !enComposition()){
      verifierChangementCode();
    }
    if(neuves.length && !enComposition()){
      ecrireReglage('notifVues', S.notifications.slice(0, 60).map(n => n.id));
      /* une décision de l'administrateur sur un abonnement s'affiche dans une vraie fenêtre */
      const evt = neuves.find(n => n.type === 'paiement' && (!n.cree_le || Date.now() - new Date(n.cree_le) < 3 * 86400000));
      if(evt) fenetreEvenement(evt); else bandeauNotif(neuves[0], neuves.length);
    }
  }catch(e){}
}
setInterval(() => { if(document.visibilityState === 'visible' && S.util.connecte && !enComposition()) chargerNotifications(); }, 60000);
function sonNotif(){
  const a = ctx(); if(!a) return;
  const t = a.currentTime;
  [[880, 0], [1320, 0.12]].forEach(([f, d]) => {
    const o = a.createOscillator(), g = a.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t + d);
    g.gain.exponentialRampToValueAtTime(0.05, t + d + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.35);
    o.connect(g); g.connect(a.destination); o.start(t + d); o.stop(t + d + 0.4);
  });
}
/* écarter d'un geste : glisser du doigt vers le haut (ou le bas), la gauche ou la droite
   fait partir l'élément ; un simple toucher reste un toucher.
   o.sens : -1 part vers le haut, 1 vers le bas · o.pose(dx, dy) donne la position
   o.toucher() / o.relacher(ecarte) : pour mettre un minuteur en pause · o.apres() après le départ
   o.zone : parties qui bloquent le défilement du navigateur (toute la fenêtre si absent)
   o.ignore : parties où le geste ne doit pas partir (champ de saisie, boutons) */
function glisserPourEcarter(el, o){
  const sens = o.sens || -1;
  let x0 = 0, y0 = 0, dx = 0, dy = 0, tire = false, depart = 0;
  (o.zone ? Array.from(el.querySelectorAll(o.zone)) : [el]).forEach(z => { z.style.touchAction = 'none'; });
  el.addEventListener('pointerdown', e => {
    if(e.button > 0) return;
    if(o.ignore && e.target.closest && e.target.closest(o.ignore)) return;
    x0 = e.clientX; y0 = e.clientY; dx = 0; dy = 0; tire = false; depart = Date.now(); el._glisse = false;
    try{ el.setPointerCapture(e.pointerId); }catch(_){}
    if(o.toucher) o.toucher();
  });
  el.addEventListener('pointermove', e => {
    if(!el.hasPointerCapture || !el.hasPointerCapture(e.pointerId)) return;
    dx = e.clientX - x0; dy = e.clientY - y0;
    if(!tire && Math.hypot(dx, dy) < 8) return;
    tire = true; el._glisse = true;
    const v = sens < 0 ? Math.min(0, dy) : Math.max(0, dy);
    el.style.transition = 'none';
    el.style.transform = o.pose(dx, v);
    el.style.opacity = String(Math.max(0.25, 1 - Math.max(Math.abs(dx) / 240, Math.abs(v) / 120)));
  });
  const fin = () => {
    if(!tire){ if(o.relacher) o.relacher(false); return; }
    const v = sens < 0 ? -dy : dy;
    const vite = Math.hypot(dx, dy) / Math.max(1, Date.now() - depart) > 0.5 && Math.hypot(dx, dy) > 24;
    const part = Math.abs(dx) > 70 || v > 40 || vite;
    el.style.transition = 'transform .22s ease-out, opacity .22s ease-out';
    if(part){
      if(Math.abs(dx) >= Math.max(v, 0)) el.style.transform = o.pose(Math.sign(dx || 1) * window.innerWidth, 0);
      else el.style.transform = o.pose(0, sens * 220);
      el.style.opacity = '0';
      setTimeout(() => { el.remove(); if(o.apres) o.apres(); }, 230);
      if(o.relacher) o.relacher(true);
    } else {
      el.style.transform = o.pose(0, 0); el.style.opacity = '1';
      setTimeout(() => { el.style.transition = ''; el.style.transform = ''; el.style.opacity = ''; }, 240);
      if(o.relacher) o.relacher(false);
    }
  };
  el.addEventListener('pointerup', fin);
  el.addEventListener('pointercancel', fin);
  /* après un glissement, le « clic » qui suit ne doit rien ouvrir */
  el.addEventListener('click', e => { if(el._glisse){ e.stopImmediatePropagation(); e.preventDefault(); el._glisse = false; } }, true);
}
function bandeauNotif(n, combien){
  sonNotif();
  document.querySelectorAll('.bandeau-notif').forEach(x => x.remove());
  const b = document.createElement('button');
  b.className = 'bandeau-notif';
  b.setAttribute('role', 'status');
  b.innerHTML = `<span class="ic">${ico(ICONE_NOTIF[n.type] || 'cloche', 18)}</span><span class="co"><b>${E(n.titre)}</b><span>${E(n.message)}</span>${combien > 1 ? `<i>et ${combien - 1} autre${combien > 2 ? 's' : ''} notification${combien > 2 ? 's' : ''}</i>` : ''}</span>`;
  let minuteur;
  const partir = () => { b.classList.remove('vu'); setTimeout(() => b.remove(), 400); };
  const armer = ms => { clearTimeout(minuteur); minuteur = setTimeout(partir, ms); };
  b.onclick = () => { clearTimeout(minuteur); b.remove(); ouvrirNotif(n); };
  b.addEventListener('keydown', e => { if(e.key === 'Escape'){ clearTimeout(minuteur); partir(); } });
  /* on l'écarte du doigt vers le haut, la gauche ou la droite ; tant qu'on le touche, il reste */
  glisserPourEcarter(b, {
    sens: -1,
    pose: (dx, dy) => `translate(calc(-50% + ${dx}px), ${dy}px)`,
    toucher: () => clearTimeout(minuteur),
    relacher: ecarte => { if(!ecarte) armer(3000); }
  });
  document.body.appendChild(b);
  setTimeout(() => b.classList.add('vu'), 30);
  armer(7000);
}
/* La fenêtre qui s'ouvre quand l'administrateur valide ou rejette un abonnement :
   « Félicitations » avec une petite fête, ou « Abonnement rejeté » avec la suite à donner. */
function fenetreEvenement(n){
  const refus = /rejet|refus/i.test(n.titre || '');
  sonNotif();
  document.querySelectorAll('.fenetre-evt').forEach(x => x.remove());
  const f = document.createElement('div');
  f.className = 'fenetre-evt ' + (refus ? 'refus' : 'ok');
  f.setAttribute('role', 'dialog'); f.setAttribute('aria-modal', 'true');
  f.setAttribute('aria-label', refus ? 'Abonnement rejeté' : 'Félicitations');
  const msgWa = "Bonjour, mon abonnement Mon Concours a été rejeté. Mon numéro : " + ((S.util && S.util.tel) || '');
  f.innerHTML = `<div class="fe-carte">
    <div class="fe-badge" aria-hidden="true">${refus ? '✕' : '✓'}</div>
    ${refus ? '' : '<div class="fe-confettis" aria-hidden="true">' + Array.from({ length:16 }, (_, i) => `<i style="--i:${i}"></i>`).join('') + '</div>'}
    <h2 class="fe-titre">${refus ? 'Abonnement rejeté' : 'Félicitations !'}</h2>
    ${refus ? '' : '<p class="fe-sous">Votre abonnement est actif</p>'}
    <p class="fe-texte">${E(n.message || '')}</p>
    ${refus
      ? `<button class="cta" data-fe="abonnement">Renvoyer une capture</button>
         <a class="cta creux" style="display:block;margin-top:9px;text-decoration:none" href="https://wa.me/226${CONTACT.adminTel}?text=${encodeURIComponent(msgWa)}" target="_blank" rel="noopener">Écrire sur WhatsApp</a>`
      : `<button class="cta" data-fe="fermer">Continuer</button>`}
  </div>`;
  const fermer = suite => {
    f.classList.remove('vu'); setTimeout(() => f.remove(), 300);
    if(!n.lue) marquerNotifsLues(n.id);
    if(suite === 'abonnement') aller('abonnement');
  };
  f.addEventListener('click', e => {
    const b = e.target.closest('[data-fe]');
    if(b) fermer(b.dataset.fe);
    else if(e.target === f) fermer();
  });
  f.addEventListener('keydown', e => { if(e.key === 'Escape') fermer(); });
  document.body.appendChild(f);
  setTimeout(() => { f.classList.add('vu'); const b = f.querySelector('button'); if(b) b.focus(); }, 30);
  chargerAbonnement().then(() => { if(['abonnement','compte','aujourdhui'].includes(S.ecran)) rendre(); }, () => {});
  pister(refus ? 'PAYMENT_REJECTED_POPUP' : 'PAYMENT_CONFIRMED_POPUP', {});
}
/* Les messages de l'administration qui s'ouvrent en fenêtre : voir NOTIFS_FENETRE plus haut */
function fenetreAnnonce(n){
  sonNotif();
  document.querySelectorAll('.fenetre-evt').forEach(x => x.remove());
  const reponse = n.type === 'reponse_admin_plein';
  const f = document.createElement('div');
  f.className = 'fenetre-evt annonce';
  f.setAttribute('role', 'dialog'); f.setAttribute('aria-modal', 'true');
  f.setAttribute('aria-label', n.titre || 'Message de Mon Concours');
  const [genre, idLien] = String(n.lien || '').split(':');
  const suite = { abonnement:'Voir mon abonnement', compte:'Ouvrir mon compte', parcours:'Ouvrir mon parcours', offre:'Voir l\'offre', resultats:'Voir mes résultats', communaute:'Entrer dans la communauté', epreuve:(S.epreuve && S.epreuve.id === idLien && salleOuverte(S.epreuve) ? 'Rejoindre la salle' : 'Oui, je participe') }[genre];
  const guide = String(n.lien || '') === 'annonce:guide-compo';
  if(guide){
    f.classList.add('guide-compo');
    f.innerHTML = `<div class="fe-carte">
      <div class="fe-marque" style="color:var(--erreur,#C2392E)">IMPORTANT</div>
      <h2 class="fe-titre">Comment se passe une composition ?</h2>
      <ol class="gc-etapes">
        <li><b>Je m'inscris.</b><span>C'est gratuit. Sans inscription, vous ne pouvez pas entrer.</span></li>
        <li><b>Je viens à l'heure.</b><span>La composition commence à 19 h, heure du Burkina. Tous les candidats composent en même temps, sur le même sujet.</span></li>
        <li><b>J'entre dans la salle de composition.</b><span>À 19 h, le bouton « Entrer » apparaît. Le temps de la composition est de 40 minutes.</span></li>
        <li><b>Je compose.</b><span>Je m'assois, je noircis ma feuille de réponses et je valide avant la fin du temps.</span></li>
        <li><b>Je regarde mon classement.</b><span>Il paraît juste après la composition, avec votre rang parmi tous les candidats.</span></li>
        <li><b>Je regarde mes erreurs et je m'améliore.</b><span>Chaque erreur est corrigée et expliquée, pour mieux réussir la prochaine fois.</span></li>
      </ol>
      <div class="gc-retard"><b>Je suis en retard, puis-je encore composer ?</b><span>Oui. Vous pouvez entrer tant que l'heure de la composition n'est pas terminée. Le temps qui vous reste est celui qui reste jusqu'à la fin.</span></div>
      <button class="cta" data-fe="fermer">J'ai compris</button>
    </div>`;
  } else if(genre === 'resultats'){
    f.classList.add('obligatoire');
    f.innerHTML = `<div class="fe-carte">
      <div class="fe-badge" aria-hidden="true">🏆</div>
      <div class="fe-marque">Mon Concours · Composition nationale</div>
      <h2 class="fe-titre">${E(n.titre || 'Vérifie tes résultats')}</h2>
      <p class="fe-texte fe-long">${E(n.message || '').replace(/\n/g, '<br>')}</p>
      <button class="cta" data-fe="suite">Voir mes résultats</button>
      <p class="fe-compte" style="text-align:center;margin:12px 0 0;font-size:13px;opacity:.7">Cette fenêtre se ferme dans <b class="num" data-cpt>30</b> s</p>
    </div>`;
    let reste = 30;
    const cpt = setInterval(() => {
      reste--; const c = f.querySelector('[data-cpt]'); if(c) c.textContent = reste;
      if(reste <= 0 || !f.isConnected){ clearInterval(cpt); if(f.isConnected) fermer(false); }
    }, 1000);
  } else if(genre === 'bilan'){
    const toutes = String(n.message || '').split('\n').map(l => l.split('|')).filter(l => l.length === 2);
    const sem = toutes.find(l => l[0] === 'Semaine');
    const lignes = toutes.filter(l => l[0] !== 'Semaine');
    const place = lignes.find(l => l[0] === 'Ta place');
    f.innerHTML = `<div class="fe-carte">
      <div class="fe-marque">Mon Concours · Ta semaine</div>
      <h2 class="fe-titre">Ta semaine sur Mon Concours</h2>
      <p class="fe-texte" style="margin-bottom:10px">${sem ? E(sem[1]) + '.' : 'Tes 7 derniers jours, en chiffres.'}</p>
      <div class="bilan-lignes">${lignes.map(l => `<div class="bilan-l"><span>${E(l[0])}</span><b class="num">${E(l[1])}</b></div>`).join('')}</div>
      <button class="cta" data-fe="partager-bilan">Partager mon bilan sur WhatsApp</button>
      <button class="cta creux" style="margin-top:10px" data-fe="suite-erreurs">Voir mes erreurs</button>
      <button class="lien" style="display:block;margin:12px auto 0" data-fe="fermer">Fermer</button>
    </div>`;
    f._bilan = lignes;
  } else
  f.innerHTML = `<div class="fe-carte">
    <div class="fe-badge" aria-hidden="true">${reponse ? '✉' : '📣'}</div>
    <div class="fe-marque">Mon Concours · ${reponse ? 'Réponse de l\'administration' : 'Message de l\'équipe'}</div>
    <h2 class="fe-titre">${E(reponse ? 'Votre avis a été lu' : (n.titre || 'Information'))}</h2>
    <p class="fe-texte fe-long">${E(n.message || '').replace(/\n/g, '<br>')}</p>
    ${genre === 'inscrire' ? `${(S.epreuve && S.epreuve.id === idLien && S.epreuve.inscrit) ? '' : '<button class="cta" data-fe="inscrire">Oui, je m\'inscris</button>'}${notifsAEncourager() ? '<button class="cta creux" style="margin-top:10px" data-fe="notifs">Oui, j\'active les notifications</button>' : ''}<button class="lien" style="display:block;margin:12px auto 0" data-fe="fermer">${(S.epreuve && S.epreuve.id === idLien && S.epreuve.inscrit && !notifsAEncourager()) ? 'J\'ai compris' : 'Plus tard'}</button>`
    : suite ? `<button class="cta" data-fe="suite">${suite}</button><button class="lien" style="display:block;margin:10px auto 0" data-fe="fermer">${genre === 'epreuve' ? 'Plus tard' : 'Fermer'}</button>`
            : `<button class="cta" data-fe="fermer">J'ai compris</button>`}
  </div>`;
  const fermer = aller_ => {
    f.classList.remove('vu'); setTimeout(() => f.remove(), 300);
    if(!n.lue) marquerNotifsLues(n.id);
    if(aller_) ouvrirNotif(Object.assign({}, n, { lue:true }));
    else setTimeout(verifierChangementCode, 400);
  };
  f.addEventListener('click', e => {
    const b = e.target.closest('[data-fe]');
    if(b && b.dataset.fe === 'inscrire'){ fermer(false); S.sansInvitation = notifsAEncourager(); inscrireNationale(idLien, false).finally(() => { S.sansInvitation = false; }); }
    else if(b && b.dataset.fe === 'partager-bilan'){
      const l = f._bilan || [], g = k => (l.find(x => x[0] === k) || [])[1] || '';
      const t = `Ma semaine sur Mon Concours : ${g('Jours travaillés')} jours travaillés, ${g('Questions faites')} questions, ${g('Bonnes réponses')} de bonnes réponses, ${g('Erreurs refermées')} erreurs refermées. ${g('Ta place')}. Prépare ton concours avec moi : ${CONTACT.site}`;
      pister('WEEK_REPORT_SHARED', {});
      window.open('https://wa.me/?text=' + encodeURIComponent(t), '_blank', 'noopener');
    }
    else if(b && b.dataset.fe === 'suite-erreurs'){ fermer(false); aller('cahier'); }
    else if(b && b.dataset.fe === 'notifs'){ fermer(false); pister('COMPO_COMMUNE_NOTIFS_CLICKED', {}); activerNotifsSeules(); }
    else if(b) fermer(b.dataset.fe === 'suite');
    else if(e.target === f && !guide && genre !== 'resultats') fermer(false);
  });
  f.addEventListener('keydown', e => { if(e.key === 'Escape' && !guide && genre !== 'resultats') fermer(false); });
  document.body.appendChild(f);
  setTimeout(() => { f.classList.add('vu'); const b = f.querySelector('button'); if(b) b.focus(); }, 30);
  pister(reponse ? 'ADMIN_REPLY_POPUP' : (guide ? 'COMPO_GUIDE_SHOWN' : 'ADMIN_ANNOUNCE_POPUP'), {});
}
/* L'administrateur a demandé un nouveau code : à la prochaine ouverture, on le demande deux fois */
async function verifierChangementCode(force){
  if(!base || !S.util.connecte) return;
  if(!force && S.codeDemandeVu) return;
  try{
    const { data } = await base.rpc('mon_changement_code');
    if(data === true){ S.codeDemandeVu = true; fenetreNouveauCode(); }
  }catch(e){}
}
function fenetreNouveauCode(){
  if(document.querySelector('.fenetre-evt.nouveau-code')) return;
  document.querySelectorAll('.fenetre-evt').forEach(x => x.remove());
  const f = document.createElement('div');
  f.className = 'fenetre-evt nouveau-code';
  f.setAttribute('role', 'dialog'); f.setAttribute('aria-modal', 'true'); f.setAttribute('aria-label', 'Choisir un nouveau mot de passe');
  f.innerHTML = `<div class="fe-carte">
    <div class="fe-badge" aria-hidden="true">🔑</div>
    <div class="fe-marque">Mon Concours · Sécurité</div>
    <h2 class="fe-titre">Choisissez un nouveau code</h2>
    <p class="fe-texte">L'administration a demandé le changement de votre mot de passe. Choisissez 4 chiffres, écrivez-les deux fois, et gardez-les en tête : ils serviront à votre prochaine connexion.</p>
    <div class="fe-alerte" id="nc-err" role="alert" hidden></div>
    <label class="fe-etiq" for="nc-1">Nouveau code (4 chiffres)</label>
    <input class="fe-champ" id="nc-1" type="password" inputmode="numeric" maxlength="4" autocomplete="new-password" placeholder="••••">
    <label class="fe-etiq" for="nc-2">Confirmez le nouveau code</label>
    <input class="fe-champ" id="nc-2" type="password" inputmode="numeric" maxlength="4" autocomplete="new-password" placeholder="••••">
    <button class="cta" id="nc-ok" style="margin-top:14px">Enregistrer mon nouveau code</button>
    <button class="lien" id="nc-plus" style="display:block;margin:10px auto 0">Plus tard</button>
  </div>`;
  const fermer = () => { f.classList.remove('vu'); setTimeout(() => f.remove(), 300); };
  const err = t => { const e = f.querySelector('#nc-err'); e.textContent = t; e.hidden = !t; };
  f.querySelector('#nc-plus').onclick = fermer;
  f.querySelectorAll('.fe-champ').forEach(c => c.addEventListener('input', () => { c.value = c.value.replace(/\D/g, '').slice(0, 4); err(''); }));
  f.querySelector('#nc-ok').onclick = async () => {
    const a = f.querySelector('#nc-1').value, b = f.querySelector('#nc-2').value;
    if(a.length !== 4) return err('Le nouveau code doit comporter 4 chiffres.');
    if(a !== b) return err('Les deux codes ne sont pas identiques.');
    const btn = f.querySelector('#nc-ok'); btn.disabled = true; btn.textContent = 'Enregistrement…';
    try{
      const { data, error } = await base.rpc('changer_mon_code', { p_nouveau: a, p_confirmation: b });
      if(error) throw error;
      if(!data || !data.ok){ btn.disabled = false; btn.textContent = 'Enregistrer mon nouveau code'; return err((data && data.message) || 'Le code n\'a pas pu être changé.'); }
      fermer();
      pister('CODE_CHANGED_BY_USER', {});
      signalCandidat('Votre nouveau code est enregistré. Utilisez-le à votre prochaine connexion.');
      chargerNotifications();
    }catch(e){ btn.disabled = false; btn.textContent = 'Enregistrer mon nouveau code'; err(enFrancais(e, 'Vérifiez votre connexion et réessayez.')); }
  };
  document.body.appendChild(f);
  setTimeout(() => { f.classList.add('vu'); const c = f.querySelector('#nc-1'); if(c) c.focus(); }, 30);
}
/* toucher une notification mène à ce dont elle parle */
function ouvrirNotif(n){
  if(!n) return;
  if(!n.lue) marquerNotifsLues(n.id);
  const v = document.getElementById('voile'); if(v){ v.hidden = true; v.innerHTML = ''; } S.modal = null;
  const [genre, id] = String(n.lien || '').split(':');
  if(genre === 'copie' && id) return feuilleArchive(id);
  if(genre === 'epreuve' && id){
    if(S.epreuve && S.epreuve.id === id && salleOuverte(S.epreuve) && S.util.connecte) return entrerEnSalle(id, 'notification');
    if(S.epreuve && S.epreuve.id === id && S.epreuve.etat !== 'terminee') return aller('aujourdhui');
    compterVueResultats(id); chargerClassement(id); return aller('gagnants');
  }
  if(genre === 'resultats' && id){ compterVueResultats(id); chargerClassement(id); return aller('gagnants'); }
  if(genre === 'inscrire' && id) return fenetreAnnonce(Object.assign({}, n, { type:'annonce_plein', lue:true }));
  if(genre === 'defi' && id) return ouvrirDefi(id);
  if(genre === 'communaute') return ouvrirCommunaute(id);
  if(genre === 'nouveau-code') return verifierChangementCode(true);
  if(genre === 'avis' || genre === 'annonce'){
    if(NOTIFS_FENETRE.includes(n.type) || n.type === 'reponse_admin' || n.type === 'annonce') return fenetreAnnonce(Object.assign({}, n, { type: n.type === 'reponse_admin' ? 'reponse_admin_plein' : (n.type === 'annonce' ? 'annonce_plein' : n.type), lue:true, lien:(/^(epreuve|inscrire|bilan|resultats):/.test(String(n.lien || '')) ? n.lien : '') }));
  }
  if(genre === 'compte') return aller('compte');
  if(genre === 'abonnement'){ chargerPromo().then(() => aller('abonnement')); return; }
  if(genre === 'conseiller'){
    pister('PAY_ADVISOR_WHATSAPP', { point:'relance', formule:null });
    window.open('https://wa.me/226' + numeroConseiller() + '?text=' + encodeURIComponent(messageConseiller(S.choixFormule || 'mensuelle')), '_blank', 'noopener');
    return aller('abonnement');
  }
  if(genre === 'fautes') return lancerFautes();
  if(genre === 'reprendre') return aller(repriseCible(id) || 'aujourdhui');
  if(genre === 'parcours') return aller('parcours');
  if(genre === 'installer') return installerAppli();
  if(genre === 'offre'){ chargerOffre(false).then(() => aller('abonnement')); return; }
  if(n.type === 'paiement' && !S.gratuit) return aller('abonnement');
  if(genre === 'accueil' || genre === 'aujourdhui') return aller('aujourdhui');
  if(n.type === 'resultat') return aller('gagnants');
  if(n.type === 'rappel' || n.type === 'motivation') return aller('aujourdhui');
  if(!genre) return aller('aujourdhui');
}

/* chaque jour, une notification : série, minutes, niveau et ce qui reste à faire */
async function notificationsDuJour(){
  if(!base || !S.util.connecte || !S.stats || !S.details) return;
  const jour = new Date().toISOString().slice(0, 10);
  const r = lireReglages();
  if(r.progNotif === jour) return;
  ecrireReglage('progNotif', jour);
  const st = S.stats, dt = S.details, n = niveauCandidat();
  const duree = m => m >= 60 ? Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0') : m + ' min';
  const serie = st.serie || 0;
  const reste = n.suivant ? n.suivant.crit(n.v).filter(([k, c]) => n.v[k] < c).map(([k, c, l, court]) => nombreFr(c - n.v[k]) + ' ' + court) : [];
  const msg = (serie >= 2 ? 'Félicitations : ' + serie + ' jours d\'affilée. ' : '') +
    duree(dt.minutes_semaine || 0) + ' de travail cette semaine, ' + duree(dt.minutes_mois || 0) + ' ce mois. ' +
    'Vous êtes au niveau ' + n.nom.toLowerCase() + '.' +
    (n.suivant ? ' Pour atteindre le niveau « ' + n.suivant.nom + ' », il vous reste ' + reste.join(', ') + '.' : '');
  try{
    await base.rpc('ma_notification', { p_type:'progression', p_titre: serie >= 2 ? 'Bravo, ' + serie + ' jours d\'affilée' : 'Votre progression du jour',
      p_message: msg.slice(0, 500), p_cle:'progression-' + jour, p_lien:'compte' });
    if(!estInstallee() && !r.installNotif){
      ecrireReglage('installNotif', true);
      await base.rpc('ma_notification', { p_type:'installation', p_titre:'Installer l\'application Mon Concours',
        p_message:'Installez Mon Concours sur votre téléphone : elle s\'ouvre comme une application, même avec peu de réseau.',
        p_cle:'installation-1', p_lien:'installer' });
    }
    chargerNotifications();
  }catch(e){}
}
const estInstallee = () => window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
function installerAppli(){
  if(CONTACT.playStore) return window.open(CONTACT.playStore, '_blank', 'noopener');
  if(S.installer){ S.installer.prompt(); S.installer.userChoice.then(() => { S.installer = null; }); return; }
  if(estInstallee()) return toast('L\'application est déjà installée sur ce téléphone.');
  /* Pas de fenêtre d'installation : on est sans doute dans WhatsApp ou Facebook, ou sur un iPhone.
     Au lieu de ne rien faire, on guide la personne (Android : vers Chrome ; iPhone : Safari). */
  if(/iPhone|iPad|iPod/i.test(navigator.userAgent)) return fenetreInstallerPas('iphone');
  if(/Android/i.test(navigator.userAgent)) return fenetreInstallerPas(new URLSearchParams(location.search).get('via') === 'chrome' ? 'manuel' : 'chrome');
  toast('Pour installer Mon Concours, ouvrez ce site sur votre téléphone.', 7000);
}
function fenetreInstallerPas(type){
  const v = document.getElementById('voile'); if(!v) return;
  S.modal = 'rappel'; v.hidden = false;
  const fermer = '<button class="lien" style="display:block;margin:12px auto 0" data-rappel-fermer="1">Fermer</button>';
  const T = {
    chrome: ['Ouvrez dans Chrome', 'L\'installation ne se fait pas depuis cette fenêtre. Touchez Continuer : le site s\'ouvre dans Chrome, et l\'installation s\'y fait.', '<button class="cta" data-ouvrir-chrome="1">Continuer</button>'],
    manuel: ['Ouvrir Mon Concours', 'Touchez l\'icône Mon Concours sur l\'écran d\'accueil de votre téléphone.', ''],
    iphone: ['Installer sur iPhone', 'Ouvrez ce site dans Safari. Touchez le bouton Partager (le carré avec une flèche), puis « Sur l\'écran d\'accueil ».', '']
  }[type] || [];
  v.innerHTML = `<div class="panneau pop-nat" role="dialog" aria-modal="true" aria-labelledby="pr-titre">
    <button class="pn-x" data-rappel-fermer="1" aria-label="Fermer">×</button>
    <h3 id="pr-titre">${T[0]}</h3><p class="intro">${T[1]}</p>${T[2]}${fermer}</div>`;
  pister('INSTALL_GUIDE_SHOWN', { type });
}
/* « Continuer » : on envoie la page dans Chrome, sur l'écran d'installation. Si le téléphone refuse, on montre le menu à la main. */
function ouvrirDansChrome(){
  pister('INSTALL_OPEN_CHROME');
  const u = new URL(location.href);
  u.searchParams.set('installer', '1'); u.searchParams.set('via', 'chrome');
  const secours = u.toString();
  location.href = 'intent://' + u.host + u.pathname + u.search + '#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=' + encodeURIComponent(secours) + ';end';
  setTimeout(() => { if(!document.hidden && S.modal === 'rappel') fenetreInstallerPas('manuel'); }, 2000);
}
/* Première ouverture de l'application installée : un seul écran pour les notifications, une fois. */
function inviterNotifsPremiereOuverture(essai){
  if(!estInstallee() || lireReglages().notifsOuverture || !pushPossible() || Notification.permission !== 'default') return;
  const v = document.getElementById('voile');
  if(!S.util.connecte || S.rappel || S.ecran === 'compte' || S.modal || !v || !v.hidden || enComposition() || document.getElementById('invitation')){
    if((essai || 0) < 6) setTimeout(() => inviterNotifsPremiereOuverture((essai || 0) + 1), 6000);
    return;
  }
  ecrireReglage('notifsOuverture', true);
  S.modal = 'rappel'; v.hidden = false;
  v.innerHTML = `<div class="panneau pop-nat" role="dialog" aria-modal="true" aria-labelledby="pr-titre">
    <button class="pn-x" data-rappel-fermer="1" aria-label="Fermer">×</button>
    <h3 id="pr-titre">Activer les notifications</h3>
    <p class="intro">Recevez vos rappels de révision et l'annonce des compositions, même quand l'application est fermée.</p>
    <button class="cta" data-notifs-lien="1">Activer les notifications</button>
    <button class="lien" style="display:block;margin:12px auto 0" data-rappel-fermer="1">Plus tard</button></div>`;
  pister('INSTALL_FIRST_OPEN_NOTIFS_SHOWN');
}

function majPanneauNotifs(){
  if(S.modal === 'notifications' && !document.getElementById('voile').hidden){
    const v = document.getElementById('voile'), p = v.querySelector('.panneau'), haut = p ? (p.querySelector('div[style*="overflow-y"]') || {}).scrollTop || 0 : 0;
    ouvrirNotifications(true);
    const l = v.querySelector('div[style*="overflow-y"]'); if(l) l.scrollTop = haut;
  }
}
async function marquerNotifsLues(id){
  const avant = S.notifications;
  S.notifications = (avant || []).map(n => (!id || n.id === id) ? {...n, lue:true} : n);
  memoEcrire('notifications', S.notifications, true);
  majPanneauNotifs();
  if(!base) return;
  try{
    const r = await base.rpc('marquer_notifications_lues', { p_id: id || null });
    if(r && r.error) throw r.error;
  }catch(e){ /* l'état local reste lu ; le prochain rafraîchissement remettra le serveur d'accord */ }
}
async function supprimerNotifs(){
  const avant = S.notifications;
  S.notifications = []; memoEcrire('notifications', [], true);
  majPanneauNotifs();
  if(!base) return;
  try{
    const r = await base.rpc('supprimer_notifications');
    if(r && r.error) throw r.error;
  }catch(e){
    S.notifications = avant; memoEcrire('notifications', avant, true);
    majPanneauNotifs();
    toast('Suppression non enregistrée : vérifiez votre connexion.');
  }
}

async function chargerAbonnement(){
  if(!base) return;
  try{
    const { data: g } = await base.rpc('plateforme_gratuite');
    if(typeof g === 'boolean' && g !== S.gratuit){ S.gratuit = g; rendre(); }
    const uid = await utilisateurCourant();
    if(!uid) return;
    const { data: lignes } = await base.from('mon_abonnement').select('*').eq('user_id', uid).order('fin_le', { ascending:false }).limit(1);
    const data = (lignes && lignes[0]) || null;
    const etaitActif = !!(S.abo && S.abo.actif);
    if(data && data.actif){
      if(!etaitActif && data.formule !== 'essai' && lireReglages().rappelPaiementVu !== data.fin_le){ ecrireReglage('rappelPaiementVu', data.fin_le); noterSucces('paiement'); }
      S.abo = {
        actif: true, formule: data.formule, fin_le: data.fin_le,
        jours_restants: data.jours_restants,
        echeance: data.jours_restants + ' jour' + (data.jours_restants > 1 ? 's' : '') + ' restant' + (data.jours_restants > 1 ? 's' : '')
      };
    } else {
      S.abo = {actif:false, formule:null, jours_restants:0, echeance:'abonnement gratuit'};
    }
    /* la dernière demande de paiement : en attente, confirmée (reçu), refusée */
    const { data: dem } = await base.rpc('mon_paiement_en_cours');
    S.paiementEtat = (dem && dem.ok && dem.statut) ? dem : null;
    S.paieEnAttente = (S.paiementEtat && S.paiementEtat.statut === 'en_attente') ? S.paiementEtat : null;
    await chargerPromo();
    const of = await chargerOffre(true);   // l'offre naît tout de suite, avec sa notification
    if(of && of.nouvelle) chargerNotifications();
    if(['compte','abonnement','aujourdhui','resultat'].includes(S.ecran)) rendre();
  }catch(e){}
}

/* =====================================================================
   PROMOTION : un prix réduit lancé à la main par l'administration, pour
   tous, un groupe ou des numéros précis. Le serveur fixe le prix au
   paiement ; l'écran ne fait que l'afficher.
   ===================================================================== */
let _formulesBase = null;
const formulesBase = () => _formulesBase || (_formulesBase = { mensuelle:Object.assign({}, FORMULES.mensuelle), annuelle:Object.assign({}, FORMULES.annuelle) });
function appliquerPromo(p){
  const b = formulesBase();
  const actif = !!(p && p.actif && (!p.fin_le || new Date(p.fin_le) > new Date()));
  S.promo = actif ? p : null;
  [['mensuelle', 30], ['annuelle', 365]].forEach(([k, j]) => {
    const x = actif && p.prix && p.prix[k];
    FORMULES[k] = x
      ? Object.assign({}, b[k], { prix: fmtFcfa(x.promo), montant: x.promo, ancien: b[k].prix, jour: Math.round(x.promo / j) + ' F par jour' })
      : Object.assign({}, b[k]);
  });
}
async function chargerPromo(){
  if(!base || !S.util.connecte || S.gratuit) { if(S.promo) appliquerPromo(null); return null; }
  try{
    const { data, error } = await base.rpc('ma_promotion');
    if(error) throw error;
    const avant = S.promo && S.promo.id, apres = data && data.actif ? data.id : null;
    appliquerPromo(data);
    if(avant !== apres && ['abonnement','paiement','compte','aujourdhui'].includes(S.ecran)) rendre();
    return data;
  }catch(e){ return null; }
}
const promoFin = () => (S.promo && S.promo.fin_le)
  ? 'Jusqu\'au ' + new Date(S.promo.fin_le).toLocaleDateString('fr-FR', { day:'numeric', month:'long' }) + ' à ' + heureH(S.promo.fin_le)
  : 'Promotion en cours';

/* =====================================================================
   OFFRE FLASH : le Abonnement Année à moitié prix pendant 24 heures.
   Le serveur fixe le prix et la fin ; l'écran ne fait que l'afficher.
   ===================================================================== */
let _annuelleBase = null;
const annuelleBase = () => _annuelleBase || (_annuelleBase = Object.assign({}, FORMULES.annuelle));
const fmtFcfa = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA';
function appliquerOffre(o){
  const actif = !!(o && o.actif && o.formule === 'annuelle' && o.fin_le && new Date(o.fin_le) > new Date());
  S.offre = actif ? o : null;
  FORMULES.annuelle = actif
    ? Object.assign({}, annuelleBase(), { prix: fmtFcfa(o.montant), montant: o.montant, ancien: annuelleBase().prix, jour: Math.round(o.montant / 365) + ' F par jour' })
    : Object.assign({}, annuelleBase());
}
async function chargerOffre(creer){
  /* l'offre flash est terminée pour tout le monde : plus aucun prix barré */
  appliquerPromo(S.promo); return null;
  if(!base || !S.util.connecte || S.gratuit || estAbonne()){ appliquerOffre(null); return null; }
  try{
    const { data, error } = await base.rpc('mon_offre_flash', { p_creer: !!creer });
    if(error) throw error;
    appliquerOffre(data);
    return data;
  }catch(e){ return null; }
}
const jourOffre = () => (S.offre && new Date(S.offre.fin_le).toDateString() === new Date().toDateString()) ? 'ce soir' : 'demain';
function resteOffre(){
  const ms = S.offre ? Math.max(0, new Date(S.offre.fin_le) - Date.now()) : 0;
  const h = Math.floor(ms / 3600000), m = Math.floor(ms % 3600000 / 60000), sec = Math.floor(ms % 60000 / 1000);
  return String(h).padStart(2, '0') + ' h ' + String(m).padStart(2, '0') + ' min ' + String(sec).padStart(2, '0') + ' s';
}
/* le décompte vit tout seul : à la fin, les prix reviennent à la normale */
setInterval(() => {
  const els = document.querySelectorAll('[data-offre-reste]');
  if(!els.length && !S.offre) return;
  if(S.offre && new Date(S.offre.fin_le) <= new Date()){
    appliquerOffre(null);
    document.querySelectorAll('.offre-carte').forEach(x => x.remove());
    if(['abonnement','paiement'].includes(S.ecran) && S.paieEtape === 0) rendre();
    return;
  }
  els.forEach(el => { el.textContent = resteOffre(); });
}, 1000);

function fermerOffre(){
  document.querySelectorAll('.offre-carte').forEach(c => { c.classList.remove('vu'); setTimeout(() => c.remove(), 350); });
  const r = lireReglages().offre || {};
  r.vu = Date.now(); ecrireReglage('offre', r);
}
function afficherOffre(){
  if(!S.offre || document.querySelector('.offre-carte')) return;
  const f = FORMULES.annuelle;
  const c = document.createElement('div');
  c.className = 'offre-carte';
  c.setAttribute('role', 'dialog');
  c.setAttribute('aria-label', 'Offre flash du jour');
  c.innerHTML = `<button class="offre-x" aria-label="Fermer l'offre">×</button>
    <div class="offre-kicker">Offre flash · valable aujourd'hui seulement</div>
    <div class="offre-prix"><s>${E(f.ancien || '')}</s> <b>${E(f.prix)}</b></div>
    <div class="offre-texte">Le Abonnement Année, 12 mois sans limite, à moitié prix. L'offre expire ${jourOffre()} à minuit : il reste <b data-offre-reste="1">${resteOffre()}</b>.</div>
    <button class="cta offre-go">Profiter de l'offre</button>`;
  c.querySelector('.offre-x').onclick = fermerOffre;
  c.querySelector('.offre-go').onclick = () => {
    fermerOffre();
    S.choixFormule = 'annuelle'; S.paieEtape = 0; S.erreur = '';
    pister('FLASH_OFFER_CLICKED');
    aller('paiement');
  };
  c.addEventListener('keydown', e => { if(e.key === 'Escape') fermerOffre(); });
  document.body.appendChild(c);
  setTimeout(() => c.classList.add('vu'), 30);
  pister('FLASH_OFFER_SHOWN');
}
/* l'offre naît dès la connexion (avec sa notification) ; la fiche apparaît après dix minutes d'utilisation réelle */
const OFFRE_ATTENTE_S = 600;
async function suiviOffre(){
  if(document.visibilityState !== 'visible' || !S.util.connecte || !base || S.gratuit || estAbonne()) return;
  const r = lireReglages().offre || { s: 0, vu: 0 };
  if((r.s || 0) < OFFRE_ATTENTE_S){
    if(Date.now() - O.dernierTemps < 60000){ r.s = (r.s || 0) + 15; ecrireReglage('offre', r); }
    if(r.s < OFFRE_ATTENTE_S) return;
  }
  const enEpreuve = enComposition() || SANS_TETE.includes(S.ecran);
  if(enEpreuve){ document.querySelectorAll('.offre-carte').forEach(x => x.remove()); return; }
  if(S.modal || document.querySelector('.offre-carte')) return;
  if(!S.offre){
    if(S.offreT && Date.now() - S.offreT < 1800000) return;
    S.offreT = Date.now();
    await chargerOffre(true);
    if(S.ecran === 'abonnement') rendre();
  }
  /* première apparition tout de suite, rappel toutes les 3 heures tant que l'offre dure */
  if(S.offre && Date.now() - (r.vu || 0) > 3 * 3600000){ chargerNotifications(); afficherOffre(); }
}
setInterval(suiviOffre, 15000);

async function chargerConcours(){
  if(!base) return;
  try{
    const { data } = await base.from('concours')
      .select('nom, sigle, date_ecrit, type_epreuve, seuil_dernier_admis')
      .eq('actif', true).not('date_ecrit','is',null)
      .order('date_ecrit').limit(1);
    if(data && data[0]){
      S.dateConcours = data[0].date_ecrit;
      S.nomConcours  = data[0].sigle || data[0].nom;
      S.typeEpreuve  = data[0].type_epreuve || S.typeEpreuve;
      if(S.ecran === 'aujourdhui') rendre();
    }
  }catch(e){}
}

async function chargerCompositions(){
  if(!base || !S.util.connecte) return;
  try{
    const { data } = await base.from('compositions')
      .select('id, debut_le, score, nb_traitees, nb_questions, terminee')
      .order('debut_le', { ascending:false }).limit(20);
    S.compositions = data || [];
    if(S.ecran === 'compte') rendre();
  }catch(e){}
}

/* Chaque source charge et s'affiche independamment des trois autres.
   Le classement, souvent le plus lent a calculer cote serveur, ne doit
   plus jamais retenir le reste du profil : chacune rafraichit l'ecran
   des qu'elle a sa reponse, sans attendre les autres. */
function rafraichirSiVisible(){
  if(['compte','cahier','aujourdhui','parcours'].includes(S.ecran)) rendre();
}

async function chargerProgression(){
  if(!base) return;
  const uid = await utilisateurCourant();
  if(!uid) return;
  if(S.sessionPrete) chargerEpreuve();

  S.classementCharge = false;

  base.rpc('mon_classement').then(({data}) => {
    S.classementCharge = true;
    if(data && !pareil(data, S.classement)){ S.classement = data; memoEcrire('classement', data, true); rafraichirSiVisible(); }
  }).catch(() => { S.classementCharge = true; });

  base.rpc('mes_stats').then(({data}) => {
    if(data && !pareil(data, S.stats)){ S.stats = data; memoEcrire('stats', data, true); rafraichirSiVisible(); }
    if(data) setTimeout(notificationsDuJour, 2500);
  }).catch(() => {});

  chargerCahier();
  chargerJournee();
  chargerDetails();
  setTimeout(envoyerPack, 3000);
}

/* Le cahier d'erreurs vient de la base. Les fautes du test d'entrée,
   faites avant toute inscription, restent sur le téléphone. */
async function chargerCahier(){
  if(!base) return;
  try{
    const { data } = await base.rpc('mes_erreurs');
    const locales = S.cahier.filter(e => !e.id);
    const serveur = (data || []).filter(e => e.options && e.options.length >= 2).map(e => {
      const bonne = (e.bonne === null || e.bonne === undefined) ? 0 : e.bonne;
      const mien = Array.isArray(e.derniere) && e.derniere.length
        ? e.derniere.map(k => e.options[k]).filter(Boolean).join(', ') : '';
      return {
        id: e.question_id, q: e.enonce, opts: e.options, i: bonne, bon: e.options[bonne],
        mien, matiere: e.matiere || null, theme: e.theme || null,
        note: e.explication || '', rate: e.rate || 1, suite: e.suite || 0, notePerso: e.note_perso || '',
        revoirLe: new Date(e.revoir_le + 'T00:00:00').getTime(), session: 0
      };
    });
    const neuf = serveur.concat(locales.filter(l => !serveur.some(x => x.q === l.q)));
    const ch = !pareil(neuf, S.cahier);
    S.cahier = neuf;
    memoEcrire('cahier', serveur, true);
    if(ch) rafraichirSiVisible();
  }catch(e){}
}

/* =====================================================================
   LES COMPTES CANDIDATS
   ===================================================================== */
/* Les messages du serveur arrivent en anglais : on les dit en français.
   Un message inconnu n'est jamais montré tel quel. */
const MESSAGES_FR = [
  [/banned|suspendu/i, "Ce compte est suspendu. Pour en savoir plus, écrivez à l'administrateur sur WhatsApp."],
  [/rate limit|too many requests|429/i, "Trop d'essais en peu de temps. Attendez quelques minutes, puis réessayez."],
  [/already registered|already been registered|already exists|duplicate key/i, "Ce numéro a déjà un compte. Choisissez « J'ai déjà un compte »."],
  [/invalid login|invalid credentials|invalid grant/i, "Numéro ou mot de passe incorrect."],
  [/password should be|password is too short|weak password/i, "Le mot de passe doit comporter 4 chiffres."],
  [/email not confirmed/i, "Votre compte n'est pas encore activé. Écrivez à l'administrateur sur WhatsApp."],
  [/signups? not allowed|signup is disabled/i, "Les inscriptions sont fermées pour le moment."],
  [/user not found/i, "Aucun compte avec ce numéro."],
  [/captcha/i, "La vérification anti-robot a échoué. Rechargez la page et réessayez."],
  [/jwt expired|session.*(expired|missing)|refresh token/i, "Votre session a expiré. Reconnectez-vous."],
  [/failed to fetch|networkerror|network request failed|load failed|timeout|timed out|fetch/i, "Pas de connexion. Vérifiez votre réseau et réessayez."],
  [/payload too large|file size|too large/i, "Fichier trop lourd."],
  [/permission denied|not authorized|unauthorized|forbidden|row-level security/i, "Action non autorisée. Reconnectez-vous puis réessayez."],
  [/internal server error|500|502|503|504|bad gateway|service unavailable/i, "Le serveur ne répond pas pour l'instant. Réessayez dans un moment."]
];
function enFrancais(msg, defaut){
  const m = String((msg && msg.message) || msg || '');
  for(const [re, fr] of MESSAGES_FR) if(re.test(m)) return fr;
  /* déjà en français (message de nos fonctions) : on le garde */
  if(/[éèàùâêîôûç]|\b(le|la|les|des|votre|vous|une?)\b/i.test(m) && !/\b(the|is|not|and|with|for)\b/i.test(m)) return m;
  return defaut || "Une erreur est survenue. Réessayez dans un moment.";
}
/* Partenaires : le code arrive par le lien ?p=CODE, on le garde jusqu'à l'inscription */
const CLE_PARTENAIRE = 'mc_partenaire';
(function(){
  try{
    const c = (new URLSearchParams(location.search).get('p') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 14);
    if(c.length >= 3) localStorage.setItem(CLE_PARTENAIRE, c);
  }catch(e){}
})();
/* Parrainage : le lien d'un candidat porte ?r=CODE, gardé jusqu'à l'inscription */
const CLE_PARRAIN = 'mc_parrain';
(function(){
  try{
    const c = (new URLSearchParams(location.search).get('r') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    if(c.length >= 4) localStorage.setItem(CLE_PARRAIN, c);
  }catch(e){}
})();
function codeParrain(){ try{ return localStorage.getItem(CLE_PARRAIN) || ''; }catch(e){ return ''; } }
function codePartenaire(){ try{ return localStorage.getItem(CLE_PARTENAIRE) || ''; }catch(e){ return ''; } }
function codeSaisiPartenaire(){
  const v = S.form.codeP !== undefined ? S.form.codeP : codePartenaire();
  return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 14);
}
/* renvoie un message d'erreur si le code est écrit mais n'existe pas, sinon rien */
async function verifierCodePartenaire(cp){
  if(cp.length < 3 || !base) return '';
  try{
    const { data } = await base.rpc('partenaire_code_valide', { p_code: cp });
    if(data && data.ok === false) return "Ce code partenaire n'existe pas. Corrige-le ou laisse la case vide.";
  }catch(e){}
  return '';
}

/* Le nom du partenaire s'affiche sous le code : venu par son lien, la personne voit tout de suite à qui elle s'inscrit */
let _minuteurNomP = null;
function majNomPartenaire(){
  const champ = document.getElementById('m-codep'), zone = document.getElementById('m-codep-nom');
  if(!champ || !zone || !base) return;
  const code = String(champ.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const parLien = champ.dataset.lien === '1';
  clearTimeout(_minuteurNomP);
  if(code.length < 3){ zone.textContent = ''; return; }
  _minuteurNomP = setTimeout(() => {
    base.rpc('partenaire_nom_code', { p_code: code }).then(({ data }) => {
      if(!document.getElementById('m-codep-nom')) return;
      if(data && data.ok){ zone.style.color = ''; zone.textContent = 'Partenaire : ' + data.nom; return; }
      if(parLien){
        /* le code du lien n'existe plus : la case redevient libre */
        try{ localStorage.removeItem(CLE_PARTENAIRE); }catch(e){}
        champ.removeAttribute('readonly'); delete champ.dataset.lien; champ.value = ''; maj('codeP', '');
        const lb = document.querySelector('label[for="m-codep"]'); if(lb) lb.innerHTML = 'Code partenaire <span style="font-weight:400">(facultatif)</span>';
        zone.textContent = '';
      } else { zone.style.color = 'var(--rouge, #b3382f)'; zone.textContent = 'Ce code n\'existe pas.'; }
    }, () => {});
  }, parLien ? 0 : 350);
}
window.majNomPartenaire = majNomPartenaire;
/* Une visite venue par un lien partenaire (?p=CODE) : comptée une fois par ouverture de l'application */
function noterVisitePartenaire(){
  if(!base) return;
  try{
    const c = (new URLSearchParams(location.search).get('p') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 14);
    if(c.length < 3 || sessionStorage.getItem('mc_pv_' + c)) return;
    const v = idVisiteur(); if(!v) return;
    sessionStorage.setItem('mc_pv_' + c, '1');
    base.rpc('noter_visite_partenaire', { p_code: c, p_visiteur: v }).then(() => {}, () => {});
  }catch(e){}
}
const adresseTechnique = tel => tel + '@candidat.monconcours.bf';
const motDePasse = (tel, pin) => tel + '#' + pin;

async function creerCompte(nom, tel, pin){
  if(!base) return { erreur: "Pas de connexion au serveur pour l'instant." };
  const { data, error } = await base.auth.signUp({
    email: adresseTechnique(tel),
    password: motDePasse(tel, pin),
    options: { data: { nom, telephone: tel, couleur: (S.form.couleur||'').toLowerCase(),
      niveau: S.niveau.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'') } }
  });
  if(error){
    return { erreur: enFrancais(error) };
  }
  if(!data.session){
    const r = await base.auth.signInWithPassword({
      email: adresseTechnique(tel), password: motDePasse(tel, pin) });
    if(r.error) return { erreur: enFrancais(r.error) };
    S.deconnexionVoulue = false;
    return { session: r.data.session };
  }
  S.deconnexionVoulue = false;
  return { session: data.session };
}

async function ouvrirSession(tel, pin){
  if(!base) return { erreur: "Pas de connexion au serveur pour l'instant." };
  const { data, error } = await base.auth.signInWithPassword({
    email: adresseTechnique(tel), password: motDePasse(tel, pin) });
  if(error){
    return { erreur: enFrancais(error) };
  }
  S.deconnexionVoulue = false;
  return { session: data.session };
}

async function reprendreSession(){
  if(!base) return;
  try{ await reprendreSession0(); }finally{ noterVisitePartenaire(); chargerRegleVisiteur(); S.sessionPrete = true; chargerEpreuve(); setTimeout(() => rappelFinEssai(0), 5000); setTimeout(() => proposerRappel(0), 12000); }
}
async function reprendreSession0(){
  let data = null, erreurSession = null;
  try{ ({ data, error: erreurSession } = await base.auth.getSession()); }catch(e){ erreurSession = e; }
  if(!data || !data.session){
    /* Réseau ou serveur indisponible : on garde le candidat connecté et on réessaie plus tard.
       On ne l'oublie que si la session a réellement expiré (réponse sans erreur). */
    if(erreurSession){
      clearTimeout(S.retrySession); S.retrySession = setTimeout(reprendreSession0, 20000);
      return;
    }
    if(S.util.connecte){ S.util = {nom:'', tel:'', pin:'', connecte:false}; oublierIdentite(); rendre(); }
    return;
  }
  const uid = data.session.user.id;
  /* la session est connue : les chiffres partent tout de suite, sans attendre le profil */
  if(S.util.connecte){ S.progLancee = Date.now(); chargerProgression(); }
  const { data: profil } = await base.from('profils')
    .select('nom, telephone, niveau').eq('id', uid).maybeSingle();
  if(profil){
    S.util = { nom: profil.nom, tel: profil.telephone || '', pin: '', connecte: true };
    S.modalDejaVu = true;
    /* « Mes cours » s'ouvre sur Troisième ; le niveau déclaré sert aux compositions et au fil */
    S.niveauProfil = profil.niveau || null;
    ecrireMemoire({ nom: profil.nom, tel: profil.telephone || '', niveauProfil: S.niveauProfil });
    await chargerRegleP();
    const dejaLance = S.progLancee && Date.now() - S.progLancee < 8000;
    if(ECRANS_DECOUVERTE.includes(S.ecran)){ aller('aujourdhui'); if(!dejaLance) chargerProgression(); return; }
    rendre();
    if(!dejaLance) chargerProgression();
  }
}

/* =====================================================================
   ACTUALITÉ EN DIRECT DE LA BASE
   Les informations écrites plus bas servent de secours : si le réseau
   ne répond pas, le candidat garde un bulletin lisible.
   ===================================================================== */
const BASE_URL = 'https://uonhpsumbfuahipbdjnu.supabase.co';
const BASE_CLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvbmhwc3VtYmZ1YWhpcGJkam51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMjg1MTQsImV4cCI6MjEwMTcwNDUxNH0.UR2CSJaK0AyyIRDzDBoALcU7OeE9SdQESHI9ASZMYIk';

let base = null;

/* La base arrive après le premier affichage : l'application est
   utilisable immédiatement, sans attendre le réseau. */
function brancherBase(){
  if(base) return;
  try{
    if(typeof supabase === 'undefined' || !supabase.createClient) return;
    /* Une panne du service de connexion (erreur 5xx, réseau coupé) ne doit jamais
       effacer la session gardée sur le téléphone : elle reste valide côté serveur
       et reprend dès que le service revient. Seules une déconnexion voulue et une
       session réellement refusée par le serveur l'effacent. */
    const surAuth = url => String(url).includes('/auth/v1/');
    /* maintenance.js écoute ces signaux : trois échecs rapprochés, puis une vérification, déclenchent le mode « QCM en attendant » */
    const signaler = ok => { try{ if(window.mcPanne) window.mcPanne(ok); }catch(e){} };
    const fetchSurveille = async (url, opts) => {
      try{
        const r = await fetch(url, opts);
        if(surAuth(url) && r.status >= 500) S.authPanneJusqua = Date.now() + 120000;
        if(!surAuth(url)) signaler(r.status < 500);
        return r;
      }catch(e){
        if(surAuth(url)) S.authPanneJusqua = Date.now() + 120000;
        else if(!(e && e.name === 'AbortError') && navigator.onLine !== false) signaler(false);
        throw e;
      }
    };
    const stockage = {
      getItem: k => { try{ return localStorage.getItem(k); }catch(e){ return null; } },
      setItem: (k, v) => { try{ localStorage.setItem(k, v); }catch(e){} },
      removeItem: k => {
        if(!S.deconnexionVoulue && Date.now() < (S.authPanneJusqua || 0)) return;
        try{ localStorage.removeItem(k); }catch(e){}
      }
    };
    base = supabase.createClient(BASE_URL, BASE_CLE, { auth: { persistSession: true, storage: stockage }, global: { fetch: fetchSurveille } });
  }catch(e){ base = null; return; }

  /* on étale les appels pour ne pas saturer une connexion lente */
  ouvrirSessionObservation();
  chargerActualites();
  reprendreSession();
  /* U7 — on ne rapatrie plus la banque entière au démarrage : elle arrive
     quand le candidat ouvre réellement les révisions ou la composition. */
  chargerEpreuve(); chargerConcours(); chargerAbonnement(); chargerNotifications();
  setTimeout(chargerDirect, 600);
  setTimeout(chargerRessources, 900);
  /* ce que le candidat ouvrira probablement ensuite, chargé pendant qu'il lit */
  setTimeout(prechargerSuite, 1500);
  /* un lien direct ouvert avant l'arrivée de la base charge maintenant son contenu */
  if(S.ecran === 'qdj') chargerQdj();
  if(S.lienQuestion) chargerQuestionPartagee(S.lienQuestion);
  if(S.lienEpreuve) chargerClassement(S.lienEpreuve);
  if(S.lienDefi){ const id = S.lienDefi; S.lienDefi = null; ouvrirDefi(id); }
}


/* =====================================================================
   OBSERVATION — collecte des événements
   Rien de personnel : ni saisie, ni mot de passe, ni position.
   ===================================================================== */
const VERSION_APP = 'v24';

const O = {
  session: null, precedent: null, dernierTemps: Date.now(), entreeEcran: Date.now(),
  dernierEcran: null, file: [], actif: true, dureeActive: 0,
  nbEcrans: 0, nbActions: 0, demarree: false, rattachee: false
};

function identifiant(){
  try{ if(window.crypto && crypto.randomUUID) return crypto.randomUUID(); }catch(e){}
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random()*16|0, v = c === 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
}
function appareil(){
  const l = window.innerWidth;
  if(l < 700) return 'mobile';
  if(l < 1100) return 'tablette';
  return 'ordinateur';
}
function navigateur(){
  const u = navigator.userAgent;
  if(/Edg\//.test(u)) return 'Edge';
  if(/OPR\/|Opera/.test(u)) return 'Opera';
  if(/Chrome\//.test(u)) return 'Chrome';
  if(/Firefox\//.test(u)) return 'Firefox';
  if(/Safari\//.test(u)) return 'Safari';
  return 'autre';
}
function systeme(){
  const u = navigator.userAgent;
  if(/Android/.test(u)) return 'Android';
  if(/iPhone|iPad|iPod/.test(u)) return 'iOS';
  if(/Windows/.test(u)) return 'Windows';
  if(/Mac OS/.test(u)) return 'macOS';
  if(/Linux/.test(u)) return 'Linux';
  return 'autre';
}

/* D'où vient la visite : un mot en minuscules (facebook, whatsapp, google…), ou « direct » */
function origineVisite(){
  const nettoie = t => String(t || '').toLowerCase().replace(/[^a-z]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 20);
  try{
    const p = new URLSearchParams(location.search);
    const explicite = nettoie(p.get('utm_source') || p.get('depuis') || p.get('src'));
    if(explicite) return explicite;
    if(p.has('fbclid')) return 'facebook';
    const r = document.referrer || '';
    if(!r) return 'direct';
    if(/^android-app:\/\//.test(r)){
      if(/whatsapp/.test(r)) return 'whatsapp';
      if(/facebook|katana|lite/.test(r)) return 'facebook';
      if(/telegram/.test(r)) return 'telegram';
      if(/google/.test(r)) return 'google';
      return 'appli_android';
    }
    const h = new URL(r).hostname.replace(/^www\.|^m\./, '');
    if(h === location.hostname.replace(/^www\./, '')) return 'direct';
    if(/(^|\.)(facebook|fb)\.com$|^l\.facebook|lm\.facebook/.test(h)) return 'facebook';
    if(/whatsapp|^wa\.me$/.test(h)) return 'whatsapp';
    if(/google\./.test(h)) return 'google';
    if(/instagram/.test(h)) return 'instagram';
    if(/tiktok/.test(h)) return 'tiktok';
    if(/youtube|youtu\.be/.test(h)) return 'youtube';
    if(/^t\.me$|telegram/.test(h)) return 'telegram';
    if(/^(t\.co|x\.com|twitter)/.test(h)) return 'x';
    return 'autre_site';
  }catch(e){ return 'lien'; }
}

async function ouvrirSessionObservation(){
  if(!base || O.demarree) return;
  O.demarree = true;
  O.session = identifiant();
  try{
    await base.from('sessions').insert({
      id: O.session, appareil: appareil(), navigateur: navigateur(), systeme: systeme(),
      version_app: VERSION_APP, langue: navigator.language, largeur: window.innerWidth,
      premiere_visite: !document.referrer, source: window.__origine || origineVisite()
    });
  }catch(e){}
  pister(document.referrer ? 'USER_RETURNED' : 'USER_FIRST_VISIT');
  pister('SESSION_STARTED');
}

function pister(nom, meta, element){
  const maintenant = Date.now();
  const delta = maintenant - O.dernierTemps;
  O.dernierTemps = maintenant;
  O.nbActions++;
  O.file.push({
    cree_le: new Date(maintenant).toISOString(),
    session_id: O.session, nom: nom, ecran: S.ecran,
    element: element || (meta && meta.element) || null,
    meta: meta || null, precedent: O.precedent,
    delta_ms: Math.min(delta, 3600000), version_app: VERSION_APP
  });
  O.precedent = nom;
  if(O.file.length > 200) O.file.splice(0, O.file.length - 200);
  if(base && O.file.length >= 25) viderFile();
}

async function viderFile(){
  if(!base || !O.file.length || !O.session) return;
  const lot = O.file.splice(0, O.file.length);
  try{
    const { data } = await base.auth.getSession();
    const uid = data && data.session ? data.session.user.id : null;
    if(uid && !O.rattachee){
      O.rattachee = true;
      base.rpc('rattacher_session', { p_id: O.session }).then(()=>{}, ()=>{});
    }
    await base.from('evenements').insert(lot.map(e => ({ ...e, user_id: uid, session_id: O.session })));
  }catch(e){}
}

function fermerSession(){
  pister('SESSION_ENDED', { duree_active_s: Math.round(O.dureeActive/1000) });
  if(base && O.session){
    try{
      base.rpc('fermer_session', {
        p_id: O.session, p_duree: Math.round(O.dureeActive/1000),
        p_ecrans: O.nbEcrans, p_actions: O.nbActions
      }).then(()=>{}, ()=>{});
    }catch(e){}
  }
  viderFile();
}

setInterval(() => {
  if(document.visibilityState === 'visible' && O.actif) O.dureeActive += 5000;
}, 5000);
['click','keydown','scroll','touchstart'].forEach(t =>
  document.addEventListener(t, () => { O.actif = true; }, { passive: true }));
setInterval(() => { O.actif = false; }, 60000);
document.addEventListener('visibilitychange', () => {
  pister(document.visibilityState === 'visible' ? 'APP_FOREGROUND' : 'APP_BACKGROUND');
  if(document.visibilityState === 'hidden') viderFile();
});
window.addEventListener('pagehide', fermerSession);
setInterval(viderFile, 45000);
window.addEventListener('error', e => {
  /* « Script error. » sans fichier = un script étranger à l'application (navigateur intégré de Facebook, extension, traduction) :
     on garde la trace, mais avec le navigateur d'origine pour pouvoir en trouver la source */
  const ua = navigator.userAgent || '';
  const nav = /FBAN|FBAV|FB_IAB|FBIOS/.test(ua) ? 'facebook' : /Instagram/.test(ua) ? 'instagram' : /TikTok|musical_ly/.test(ua) ? 'tiktok' : /; wv\)/.test(ua) ? 'webview' : 'autre';
  const meta = { message: String(e.message).slice(0,200), nav };
  if(e.filename){ meta.fichier = String(e.filename).split('/').pop().slice(0,60); meta.ligne = e.lineno; meta.colonne = e.colno; }
  else meta.etranger = true;
  pister('ERROR_OCCURRED', meta);
});

let profondeurVue = 0;
document.addEventListener('scroll', () => {
  const v = document.getElementById('vue');
  if(!v) return;
  const p = Math.round(100 * (v.scrollTop + v.clientHeight) / Math.max(1, v.scrollHeight));
  [25,50,75,100].forEach(seuil => {
    if(p >= seuil && profondeurVue < seuil){
      profondeurVue = seuil;
      pister('SCROLL_DEPTH_REACHED', { profondeur: seuil });
    }
  });
}, { capture: true, passive: true });

/* =====================================================================
   SAUVEGARDE DE LA PROGRESSION
   ===================================================================== */
async function utilisateurCourant(){
  if(!base) return null;
  try{
    const { data } = await base.auth.getSession();
    return data && data.session ? data.session.user.id : null;
  }catch(e){ return null; }
}

/* Une réponse de révision ou de reprise est corrigée par le serveur.
   Il enregistre la tentative, le cahier d'erreurs, les points et l'assiduité. */
async function corrigerAuServeur(questionId, choix, contexte, tempsMs){
  if(!base) return { ok:false, message:"Pas de connexion au serveur pour l'instant." };
  try{
    const { data, error } = await base.rpc('corriger_question', {
      p_question: questionId, p_choix: choix, p_contexte: contexte,
      p_temps_ms: tempsMs || null, p_session: O.session || null });
    if(error) throw error;
    return data || { ok:false, message:'Réponse vide du serveur.' };
  }catch(e){
    return { ok:false, reseau:true, message:"La correction n'a pas pu être chargée. Vérifiez votre connexion et réessayez." };
  }
}

/* Ouvrir une composition : le serveur choisit un sujet du niveau, le
   moins composé par ce candidat, et reprend celle qui serait en cours. */
let ouvertureEnCours = false;

/* Repart d'une feuille vierge : plus de copie corrigée, plus de sujet
   gardé, le prochain affichage de la grille demande un nouveau sujet. */
function reinitialiserComposition(){
  if(S.sync){ clearInterval(S.sync); S.sync = null; }
  S.reponses = {}; S.corrige = false; S.grilleNote = null; S.corrigeServeur = null; effacerEpreuve();
  S.compoTab = 'feuille'; S.sujetVu = false; S.apercu = null; S.compositionId = null; S.remiseEtat = null;
  S.derniereQ = null; S.qRef = null; S.poseScroll = null; S.cibleQuestion = null; S.ongletRendu = null;
  S.grille.length = 0; S.compoEtat = null; S.epreuveCompo = null; S.correctionLe = null; S.compoLent = false;
}

/* Une requête qui ne répond pas ne doit jamais figer l'écran : sur un
   réseau qui coupe, elle restait en attente sans fin et le bouton
   « Réessayer » ne servait à rien. Chaque essai a donc un délai, et le
   serveur reprend la composition déjà ouverte si le premier essai avait
   abouti sans que la réponse n'arrive. */
async function appelerAvecDelai(construire, delaiMs){
  const ctl = new AbortController();
  const minuteur = setTimeout(() => ctl.abort(), delaiMs);
  try{
    return await construire().abortSignal(ctl.signal);
  }finally{ clearTimeout(minuteur); }
}

async function ouvrirComposition(){
  if(ouvertureEnCours) return;
  if(!base){ S.compoEtat = 'erreur'; S.compoMessage = "Pas de connexion au serveur pour l'instant."; return rendre(); }
  ouvertureEnCours = true;
  S.compoEtat = 'chargement'; S.compoLent = false; rendre();
  /* au bout de quelques secondes, on dit au candidat que ça continue */
  const lent = setTimeout(() => {
    if(S.compoEtat === 'chargement'){ S.compoLent = true; if(S.ecran === 'grille') ecranCompoAttente(); }
  }, 6000);
  try{
    /* une composition nationale se rejoint par son identifiant ;
       sinon le serveur choisit le sujet, ou reprend celui en cours */
    const rejoindre = S.rejoindre;
    const construire = () => rejoindre
      ? base.rpc('rejoindre_epreuve', { p_epreuve: rejoindre })
      : base.rpc('ouvrir_composition', { p_niveau: niveauCand() });
    let data = null, error = null;
    for(let essai = 0; essai < 2; essai++){
      try{
        const r = await appelerAvecDelai(construire, essai === 0 ? 12000 : 20000);
        data = r.data; error = r.error;
      }catch(e){ data = null; error = e || { message:'réseau' }; }
      /* une réponse du serveur (même un refus) n'est pas rejouée ;
         seul un silence ou une coupure de réseau l'est */
      if(!error || error.code) break;
    }
    if(!error) S.rejoindre = null;       // gardé tant que le serveur n'a pas répondu
    if(error) throw error;
    if(!data || !data.ok){
      S.compoEtat = data && data.connexion ? 'connexion' : data && data.abonnement ? 'abonnement' : 'erreur';
      if(S.compoEtat === 'abonnement' && base){ base.rpc('mes_sujets_restants').then(({ data: sr }) => { S.sujetsRestants = sr; if(S.ecran === 'grille') rendre(); }, () => {}); }
      S.compoMessage = (data && data.message) || 'Composition indisponible.';
      S.compoDebloqueNotifs = !!(data && data.debloque_par_notifs);
    } else {
      S.compoDebloqueNotifs = false;
      if(S.compositionId && S.compositionId !== data.id){ S.reponses = {}; effacerEpreuve(); }
      S.compositionId = data.id;
      S.sujetRef = data.sujet || '';
      S.concours = data.concours || 'Concours direct';
      S.seuil = (typeof data.seuil === 'number') ? data.seuil : null;
      S.dureeCompo = data.duree || 2400;
      S.epreuveCompo = data.epreuve || null;
      S.grille.length = 0;
      (data.questions || []).forEach(q => S.grille.push({ id:q.id, q:q.enonce, o:q.options || [], i:null, m:q.matiere || null }));
      S.chrono = Math.max(0, data.restant ?? S.dureeCompo);
      S.corrige = false; S.grilleNote = null; S.corrigeServeur = null;
      S.compoEtat = 'pret';
    }
  }catch(e){
    S.compoEtat = 'erreur';
    S.compoMessage = "La composition n'a pas pu être chargée. Vérifiez votre connexion, puis appuyez sur « Réessayer ».";
  }
  clearTimeout(lent);
  S.compoLent = false;
  ouvertureEnCours = false;
  if(S.ecran === 'grille') rendre();
}

async function synchroniserChrono(){
  if(!base || !S.compositionId || S.corrige) return;
  try{
    const { data } = await base.rpc('temps_composition', { p_composition: S.compositionId });
    if(!data || !data.ok) return;
    if(data.termine){ effacerEpreuve(); return; }
    const ecart = Math.abs((data.restant || 0) - S.chrono);
    if(ecart > 3){                       // on ne corrige que les vrais décalages
      S.chrono = data.restant;
      if(S.ecran === 'grille') rendre();
    }
    if(S.chrono <= 0 && !S.corrige && typeof remettre === 'function') remettre();
  }catch(e){}
}

/* Une composition annulée (ou supprimée) ne laisse rien sur le téléphone :
   plus de copie gardée, plus de bouton « Renvoyer ma copie ». */
async function nettoyerCopieAbandonnee(){
  try{
    const id = S.compositionId;
    if(!id || !base || !S.util.connecte || enComposition()) return;
    const { data, error } = await base.rpc('composition_abandonnee', { p_composition: id });
    if(error || data !== true) return;
    S.compositionId = null; S.reponses = {}; S.remiseEtat = null; S.remiseMessage = '';
    effacerEpreuve();
    if(['copie','grille'].includes(S.ecran)) S.ecran = 'aujourdhui';
    rendre();
  }catch(e){}
}

/* Le téléphone envoie ses réponses ; le serveur corrige, note et renvoie le
   corrigé. La copie locale n'est effacée qu'une fois la remise acceptée. */
async function cloturerComposition(){
  if(S.sync){ clearInterval(S.sync); S.sync = null; }
  if(!base || !S.compositionId){ S.remiseEtat = 'erreur'; return; }
  S.remiseEtat = 'envoi';
  try{
    const { data, error } = await base.rpc('remettre_composition', {
      p_composition: S.compositionId, p_reponses: S.reponses, p_duree: (S.dureeCompo || 2400) - S.chrono
    });
    if(error) throw error;
    if(data && data.ok){
      S.grilleNote = data.note;
      S.dureeUtilisee = data.duree;
      /* épreuve collective : la note tout de suite, le corrigé à la fin */
      S.correctionLe = data.corrige ? null : (data.correction_le || null);
      S.epreuveRemise = data.epreuve || null;
      S.corrigeServeur = data.corrige || [];
      if(data.corrige) S.grille.forEach((g, i) => { const b = S.corrigeServeur[i]; g.bonnes = b || []; g.i = (b && b.length) ? b[0] : null; });
      S.remiseEtat = 'ok';
      S.derniereCompo = S.compositionId;
      if(data.corrige && base){
        const cid = S.compositionId;
        base.rpc('ma_copie', { p_composition: cid }).then(({ data: c }) => {
          if(!c || !c.ok || !c.questions || S.derniereCompo !== cid) return;
          c.questions.forEach((q, i) => { if(S.grille[i]){ S.grille[i].taux = q.taux; S.grille[i].expl = q.explication; } });
        }, () => {});
      }
      S.compositionId = null;
      effacerEpreuve();
      chargerCahier(); chargerProgression(); chargerCompositions();
      if(S.epreuveRemise) chargerEpreuve();
    } else {
      /* déjà remise (par exemple depuis un autre appareil) : on relit la copie */
      S.remiseEtat = 'erreur';
      S.remiseMessage = (data && data.message) || 'Remise refusée.';
      nettoyerCopieAbandonnee();
    }
  }catch(e){
    S.remiseEtat = 'erreur';
    S.remiseMessage = "La copie n'a pas pu être envoyée. Elle reste gardée sur ce téléphone.";
  }
  if(['copie','grille'].includes(S.ecran)) rendre();
}

async function chargerActualites(){
  if(!base) return;
  try{
    const { data, error } = await base
      .from('actualites')
      .select('titre, contenu, categorie, source, pourquoi, verifiee, publie_le')
      .eq('statut', 'publie')
      .lte('publie_le', new Date().toISOString())
      .order('publie_le', { ascending: false })
      .limit(40);

    if(error) throw error;
    if(!data || !data.length){ S.actuChargee = true; if(['aujourdhui','actualite'].includes(S.ecran)) rendre(); return; }

    const fraiches = data.map(a => ({
      c: a.categorie === 'international' ? 'international' : 'national',
      s: a.source || '',
      v: a.verifiee ? 1 : 0,
      t: a.titre,
      x: a.contenu || '',
      p: a.pourquoi || '',
      le: a.publie_le
    }));

    ACTU.length = 0;
    fraiches.forEach(a => ACTU.push(a));
    S.actuDerniere = data[0].publie_le || null;
    S.actuChargee = true;
    memoEcrire('actu', { liste: fraiches, der: S.actuDerniere });

    if(['aujourdhui','actualite'].includes(S.ecran)) rendre();
  }catch(e){ S.actuErreur = true; if(['aujourdhui','actualite'].includes(S.ecran)) rendre(); }
}

/* Seules les actualités publiées en base sont affichées : pas de bulletin
   de secours écrit à l'avance, qui passerait pour une information vérifiée. */
const ACTU = [];

function dateCourteFr(iso){
  if(!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', { day:'numeric', month:'long' });
}
function carteActu(a, neuf){
  return `<div class="info ok">
    ${neuf?'<div class="info-tete"><span class="tag-neuf">Nouveau</span></div>':''}
    <span class="eyebrow info-source">${E(a.s)}${a.le ? (a.s ? ' · ' : '') + E(dateCourteFr(a.le)) : ''}</span>
    <h2>${E(a.t)}</h2><p>${E(a.x)}</p>
  </div>`;
}
function blocActuVide(){
  if(S.actuErreur) return `<div class="info att"><p>L'actualité n'a pas pu être chargée. Vérifiez votre connexion, puis revenez sur cette page.</p></div>`;
  if(!S.actuChargee) return `<div class="squelette large"></div><div class="squelette"></div><span class="sr">Chargement de l'actualité</span>`;
  return `<div class="info att"><p>Aucune actualité publiée pour le moment.</p></div>`;
}

/* une tâche qui vient d'être faite : sa coche s'anime une seule fois */
function tacheNeuve(k){
  if(!S.taches[k]) return '';
  const jour = new Date().toDateString(), r = lireReglages(), vues = r.tachesVues && r.tachesVues.j === jour ? r.tachesVues.l : [];
  if(vues.includes(k)) return '';
  ecrireReglage('tachesVues', { j:jour, l:vues.concat(k) });
  return ' vient';
}
/* Un salut sobre en tête de l'accueil, pour un candidat connu seulement */
/* Le mot d'accueil apparaît à l'arrivée (ouverture ou retour sur l'application), reste quelques secondes puis s'efface et rend sa place. */
const SALUT_DUREE = 5.5;
let _salutArrivee = Date.now(), _salutRetour = false, _salutCache = 0;
function motAccueil(prenom){
  const h = new Date().getHours();
  const base = h < 5 || h >= 18 ? 'Bonsoir' : 'Bonjour';
  if(!_salutRetour) return base + ' <b>' + E(prenom) + '</b>';
  const mots = ['Bon retour <b>' + E(prenom) + '</b>', 'Content de te revoir <b>' + E(prenom) + '</b>', 'On t\'attendait <b>' + E(prenom) + '</b>', base + ' <b>' + E(prenom) + '</b>, on reprend ?'];
  return mots[_salutCache % mots.length];
}
function salutAccueil(){
  const ecoule = (Date.now() - _salutArrivee) / 1000;
  if(ecoule >= SALUT_DUREE) return '';
  const nom = ((S.util && S.util.connecte && S.util.nom) || (lireMemoire() || {}).nom || '').trim();
  if(!nom || /^candidat$/i.test(nom)) return '';
  const prenom = nom.split(/\s+/)[0];
  return `<p class="salut-accueil" style="animation-delay:-${ecoule.toFixed(2)}s">${motAccueil(prenom)}</p>`;
}
let _salutPartiLe = 0;
document.addEventListener('visibilitychange', () => {
  if(document.hidden){ _salutPartiLe = Date.now(); return; }
  if(_salutPartiLe && Date.now() - _salutPartiLe > 30000){
    _salutArrivee = Date.now(); _salutRetour = true; _salutCache = Math.floor(Math.random() * 4);
    if(S.ecran === 'aujourdhui') rendre();
  }
});
/* Pour un visiteur : un bloc net en haut de l'accueil, qui dit comment s'inscrire en trois gestes */
function blocInscriptionVisiteur(){
  if(S.util.connecte) return '';
  return `<div class="carte inscr-visiteur" role="region" aria-label="Créer mon compte">
    <div class="iv-titre">Créez votre compte gratuit</div>
    <ol class="iv-etapes">
      <li><b>1</b><span>Écrivez votre nom et votre numéro de téléphone</span></li>
      <li><b>2</b><span>Choisissez un code de 4 chiffres : c'est tout</span></li>
    </ol>
    <button class="cta" data-modal="inscription">Je m'inscris gratuitement<small>30 secondes · sans e-mail · sans carte bancaire</small></button>
    <button class="lien" style="display:block;margin:10px auto 0" data-modal="connexion">J'ai déjà un compte : me connecter</button>
  </div>`;
}
/* Les derniers jours de l'essai de 7 jours : une carte calme, sur l'accueil seulement, jamais en pleine question */
function blocPromo(){
  if(S.gratuit || !S.util.connecte || !S.promo || estAbonne()) return '';
  const p = S.promo, m = FORMULES.mensuelle, a = FORMULES.annuelle;
  const lignes = [m.ancien ? m.n + ' : <s style="opacity:.55">' + E(m.ancien) + '</s> <b>' + E(m.prix) + '</b>' : '', a.ancien ? a.n + ' : <s style="opacity:.55">' + E(a.ancien) + '</s> <b>' + E(a.prix) + '</b>' : ''].filter(Boolean);
  return `<div class="carte fin-essai" role="status">
    <div class="fe-ligne"><b>${E(p.nom)}</b></div>
    <p class="sous" style="margin:6px 0 4px">${lignes.join('<br>')}</p>
    <p class="sous" style="margin:0 0 12px;font-size:12.5px">${E(promoFin())}</p>
    <button class="cta" data-go="abonnement">Profiter de la promotion</button>
  </div>`;
}
function blocFinEssai(){
  return '';   /* l'essai de 3 jours passe en silence : les limites apparaissent d'elles-mêmes ensuite */
  const a = S.abo || {};
  if(S.gratuit || !S.util.connecte || !a.actif || a.formule !== 'essai' || a.jours_restants > 2) return '';
  const reste = a.jours_restants <= 0 ? 'se termine aujourd\'hui' : a.jours_restants === 1 ? 'se termine demain' : 'se termine dans 2 jours';
  const f = FORMULES.mensuelle;
  return `<div class="carte fin-essai" role="status">
    <div class="fe-ligne"><b>Votre essai ${reste}</b></div>
    <p class="sous" style="margin:6px 0 12px">Ensuite, l'abonnement gratuit garde 5 corrections par jour, 15 questions par matière et ${compoOffertes()} compositions. Pour tout garder sans limite : ${E(f.n)}, ${E(f.prix)} pour 30 jours.</p>
    <button class="cta" data-pass="mensuelle">Garder l'accès complet · ${E(f.prix)}</button>
    <button class="cta creux" style="margin-top:8px" data-go="abonnement">Voir tous les abonnements</button>
  </div>`;
}
/* Le jour de la composition nationale, sa carte passe en haut de l'accueil ; une fois finie, les résultats
   y restent jusqu'au lendemain. Le reste de l'écran ne change pas, et chaque bloc retrouve sa place ensuite. */
/* le jour se compte à l'heure de Ouagadougou (= UTC), comme partout ailleurs dans la composition nationale */
const memeJourQue = iso => !!iso && new Date(iso).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);
/* Un visiteur sans compte voit toujours l'actualité en premier. Dès qu'il a un compte, la règle d'avant s'applique :
   la composition passe en haut le jour où elle a lieu (avant, pendant, après), et redescend le lendemain. */
function nouveauVenu(){ return !S.util.connecte; }
/* l'heure qui suit la fin d'une composition : les résultats passent devant et battent, la composition suivante se calme */
/* Les résultats de la dernière composition restent en haut de l'accueil, qui bat comme un cœur, pendant 24 heures */
function derniereCompoFinie(){
  if(S.derniereNat && S.derniereNat.fin_le) return S.derniereNat;
  const ep = S.epreuve;
  return ep && ep.etat === 'terminee' ? ep : null;
}
function resultatsEnVedette(){
  const d = derniereCompoFinie();
  if(!d || !d.fin_le) return false;
  const t = Date.now() - new Date(d.fin_le).getTime();
  return t >= 0 && t < 86400000;
}
function nationaleEnHaut(){
  if(nouveauVenu()) return false;
  if(resultatsEnVedette()) return true;
  const ep = S.epreuve;
  if(ep && (ep.etat === 'en_cours' || (ep.etat === 'a_venir' && memeJourQue(ep.debut_le)) || (ep.etat === 'terminee' && memeJourQue(ep.fin_le)))) return true;
  const d = S.derniereNat;
  return !!(d && memeJourQue(d.fin_le));
}
/* Le progrès du candidat, en clair : le compteur du mois, et le bilan court du dimanche soir */
function blocProgres(){
  const d = S.details;
  if(!S.util.connecte || !d) return '';
  const pl = (n, a, b) => n + ' ' + (n > 1 ? b : a);
  const j = new Date(), dimanche = j.getUTCDay() === 0 && j.getUTCHours() >= 17;
  const sem = [];
  if(dimanche){
    if(d.compos_semaine > 0) sem.push(pl(d.compos_semaine, 'composition', 'compositions'));
    if(d.refermees_semaine > 0) sem.push(pl(d.refermees_semaine, 'erreur refermée', 'erreurs refermées'));
    if(d.gain_points_semaine > 0) sem.push('+' + d.gain_points_semaine + ' point' + (d.gain_points_semaine > 1 ? 's' : ''));
  }
  const err = typeof d.erreurs_mois === 'number' && d.erreurs_mois > 0;
  if(!sem.length && !err) return '';
  return `${sem.length ? `<div class="carte progres" role="status" style="margin:0 0 12px"><p style="margin:0"><b>Cette semaine :</b> ${E(sem.join(', '))}</p></div>` : ''}
    ${err ? `<button type="button" class="carte progres progres-lien" data-go="cahier" style="margin:0 0 12px">
      <span class="pl-t">Vous avez commis <b class="num">${d.erreurs_mois}</b> ${d.erreurs_mois > 1 ? 'erreurs' : 'erreur'} récemment</span>
      <span class="pl-s">Voir mon cahier d'erreurs ›</span></button>` : ''}`;
}

/* « N candidats révisent en ce moment » : chiffre réel, calculé sur les réponses des 10 dernières minutes */
async function chargerEnLigne(){
  if(!base || S.enLigneCharge) return;
  S.enLigneCharge = true;
  try{
    const { data } = await base.rpc('candidats_en_ligne');
    if(data){ const change = !S.enLigne || S.enLigne.maintenant !== data.maintenant || S.enLigne.aujourdhui !== data.aujourdhui; S.enLigne = Object.assign({ t:Date.now() }, data); if(change && S.ecran === 'aujourdhui') rendre(); }
  }catch(e){}
  setTimeout(() => { S.enLigneCharge = false; }, 60000);
}
function blocEnLigne(){
  chargerEnLigne();
  const e = S.enLigne; if(!e) return '';
  if(e.maintenant >= 15) return `<div class="en-ligne"><i class="pt-vert" aria-hidden="true"></i><span><b class="num">${nombreFr(e.maintenant)}</b> candidats révisent en ce moment</span></div>`;
  return '';
}
/* le candidat a perdu des places : on le lui dit à l'endroit du classement, avec le chemin pour les reprendre */
function blocDepasse(){
  const c = S.classement;
  if(!c || !(c.places_semaine < 0) || c.dans_le_top10 || !(c.points_pour_place > 0)) return '';
  return `<div class="depasse"><b>Un candidat vient de te dépasser</b><span>Il te manque <b class="num">${nombreFr(c.points_pour_place)} point${c.points_pour_place > 1 ? 's' : ''}</b> pour reprendre ta place.</span>
    <button class="cta" style="margin-top:8px" data-pourtoi="5">Reprendre ma place · 5 questions</button></div>`;
}
function ecranAujourdhui(){
  const f = S.taches.filter(Boolean).length;
  const enCours = !S.corrige && Object.keys(S.reponses).length > 0;
  vue().innerHTML = `
  <div class="pad">
    ${salutAccueil()}
    ${blocEnLigne()}
    ${nationaleEnHaut() ? `<section class="nat-jour${resultatsEnVedette() && blocDerniereNationale(true) ? ' res-vedette' : ''}" aria-label="Composition nationale du jour">${resultatsEnVedette() ? blocDerniereNationale(true) + (S.epreuve && S.epreuve.etat === 'terminee' ? '' : carteEpreuve()) : carteEpreuve() + blocDerniereNationale()}</section>` : ''}
    ${blocSeanceX()}
    ${estE2() && S.util.connecte ? tachesElite2() : ''}
    ${blocInscriptionVisiteur()}
    ${blocPromo()}
    ${blocFinEssai()}
    ${blocBandeauRappel()}
    ${blocProgres()}
    <div class="tete-jour">
      <span class="eyebrow">${dateDuJour()}</span>
    </div>
    ${!navigator.onLine ? carteHorsLigne() : ''}

    ${enCours?`
    <button class="reprise-compo" data-go="grille">
      <div class="rc-tete">Vous avez une composition en cours</div>
      ${S.sujetRef ? `<div class="rc-sujet">Sujet n° ${E(S.sujetRef)}</div>` : ''}
      <div class="rc-nb"><span class="num">${Object.keys(S.reponses).length}</span> question${Object.keys(S.reponses).length>1?'s':''} noircie${Object.keys(S.reponses).length>1?'s':''}${S.grille.length ? ' sur ' + S.grille.length : ''}</div>
      <div class="rc-cta">▶ Reprendre maintenant</div>
    </button>`:''}

    <h1 class="titre">L'actualité utile au concours</h1>
    <div class="ligne-direct">
      ${S.actuDerniere ? `<span class="direct"><i></i>Dernière mise à jour : ${E(dateCourteFr(S.actuDerniere))}</span>` : ''}
      <span class="sous-titre">National et international</span>
    </div>

    <div class="colonnes">
    <div>
    <div class="bloc">
      <div class="carte">
        ${ACTU.length ? ACTU.slice(0,3).map((a,k)=>carteActu(a,k===0)).join('') : blocActuVide()}
      </div>
      ${ACTU.length > 3 ? `<button class="voir-tout" data-go="actualite"><span>Voir les ${ACTU.length} informations</span><b aria-hidden="true">→</b></button>` : ''}
    </div>
    </div>
    ${estE2() && S.util.connecte ? '' : `<div>
    <div class="bloc">
      <div class="libelle">Vos tâches du jour<span class="num">${f}/3</span></div>
      <div class="carte">
        <button class="etape ${S.taches[0]?'fait':'actif'}${tacheNeuve(0)}" data-go="actualite">
          <div class="puce">${S.taches[0]?'✓':'1'}</div>
          <div><h3>Lire l'actualité</h3>
            <p>Ouvrez la page d'actualité.</p>
            <span class="dur">3 min</span>${S.taches[0] ? '<span class="etat-tache fait">✓ Déjà effectué</span>' : '<span class="etat-tache">Pas encore effectué</span>'}</div>
          <span class="fl-tache" aria-hidden="true">→</span>
        </button>
        <button class="etape ${S.taches[1]?'fait':(S.taches[0]?'actif':'')}${tacheNeuve(1)}" data-go="grille">
          <div class="puce">${S.taches[1]?'✓':'2'}</div>
          <div><h3>Composer</h3>
            <p>Une épreuve chronométrée sur la feuille de réponses.</p>
            <span class="dur">40 min</span>${S.taches[1] ? '<span class="etat-tache fait">✓ Déjà effectué</span>' : '<span class="etat-tache">Pas encore effectué</span>'}</div>
          <span class="fl-tache" aria-hidden="true">→</span>
        </button>
        <button class="etape ${S.taches[2]?'fait':(S.taches[1]?'actif':'')}${tacheNeuve(2)}" data-cahierfreq="1">
          <div class="puce">${S.taches[2]?'✓':'3'}</div>
          <div><h3>Revoir mes erreurs fréquentes</h3>
            <p>${ouvertes() ? ouvertes() + ' erreur' + (ouvertes()>1?'s':'') + ' non traitée' + (ouvertes()>1?'s':'') + ', les plus ratées en premier.' : 'Aucune erreur pour l\'instant.'}</p>
            <span class="dur">10 min</span>${S.taches[2] ? '<span class="etat-tache fait">✓ Déjà effectué</span>' : '<span class="etat-tache">Pas encore effectué</span>'}</div>
          <span class="fl-tache" aria-hidden="true">→</span>
        </button>
      </div>
    </div>
    </div>`}
    </div>

    ${nationaleEnHaut() ? '' : carteEpreuve() + blocDerniereNationale()}
    ${blocAvisAccueil()}
    ${blocPlus()}
  </div>`;
}

/* Au bas de la liste, une petite flèche replie l'actualité sur les trois
   premières informations, puis la redéploie. Rien n'est supprimé : la liste
   est seulement masquée, pour ne pas saturer l'écran quand on a fini de lire. */
const ACTU_VISIBLES_REPLIEES = 3;
const chevronActu = replie => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${replie ? 'M6 9l6 6 6-6' : 'M6 15l6-6 6 6'}"/></svg>`;

function ecranActualite(){
  S.taches[0] = true; sauverTaches();
  pister('NEWS_LIST_VIEWED', { onglet: S.actuOnglet });
  const liste = ACTU.filter(a=>a.c===S.actuOnglet);
  const peutReplier = liste.length > ACTU_VISIBLES_REPLIEES;
  const replie = peutReplier && !!(S.actuRepli && S.actuRepli[S.actuOnglet]);
  const montrees = replie ? liste.slice(0, ACTU_VISIBLES_REPLIEES) : liste;
  vue().innerHTML = `
  <div class="pad">
    <button class="retourhaut" data-go="aujourdhui">Retour</button>
    <h1 class="titre">Actualité</h1>
    <p class="sous" style="margin-top:6px">Seules les informations utiles au concours entrent ici : grandes décisions nationales, organisations internationales, dates et chiffres. Un fait divers local n'y a pas sa place.</p>

    <div class="onglets">
      <button class="${S.actuOnglet==='national'?'on':''}" data-actu="national">National</button>
      <button class="${S.actuOnglet==='international'?'on':''}" data-actu="international">International</button>
    </div>

    <div class="bloc" style="margin-top:12px">
      <div class="libelle">${S.actuOnglet==='national'?'Burkina Faso':'Monde et organisations'}<span class="num">${liste.length}</span></div>
      <div class="carte" id="liste-actu">${liste.length ? montrees.map(a => carteActu(a)).join('') : blocActuVide()}</div>
      ${peutReplier ? `<div class="actu-bascule">
        <button class="actu-chevron" data-actu-repli="1" aria-expanded="${replie ? 'false' : 'true'}"
          aria-label="${replie ? 'Afficher les ' + (liste.length - ACTU_VISIBLES_REPLIEES) + ' autres informations' : 'Réduire la liste des informations'}">
          ${replie ? `<span>+${liste.length - ACTU_VISIBLES_REPLIEES}</span>` : ''}${chevronActu(replie)}
        </button></div>` : ''}
    </div>

    <button class="cta" style="margin-top:16px" data-go="aujourdhui">J'ai lu · valider ma tâche</button>
  </div>`;
}

/* =====================================================================
   COMPTE — inscription, connexion
   ===================================================================== */

/* ---------- ICONOGRAPHIE ---------- */
/* Logos des réseaux, aux couleurs de marque. Dessinés en SVG :
   aucune image à télécharger, donc rien de plus à charger en 2G. */
function logoReseau(n){
  const p = {
    whatsapp:'<path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.48-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.14-.14.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35z"/><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.86 9.86 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91A9.85 9.85 0 0 0 12.04 2zm0 18.02h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.37c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.82 2.42a8.16 8.16 0 0 1 2.41 5.82c0 4.54-3.69 8.22-8.24 8.22z"/>',
    facebook:'<path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.5-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.45 2.91h-2.33V22c4.78-.76 8.44-4.92 8.44-9.94z"/>',
    youtube:'<path d="M21.58 7.19a2.51 2.51 0 0 0-1.77-1.77C18.25 5 12 5 12 5s-6.25 0-7.81.42A2.51 2.51 0 0 0 2.42 7.19 26.2 26.2 0 0 0 2 12a26.2 26.2 0 0 0 .42 4.81 2.51 2.51 0 0 0 1.77 1.77C5.75 19 12 19 12 19s6.25 0 7.81-.42a2.51 2.51 0 0 0 1.77-1.77A26.2 26.2 0 0 0 22 12a26.2 26.2 0 0 0-.42-4.81zM10 15.02V8.98L15.2 12z"/>'
  }[n] || '';
  return '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">' + p + '</svg>';
}

function ico(n, t){
  t = t || 20;
  const o = `width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"`;
  const p = {
    actualite:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h6M7 13h10M7 17h7"/>',
    musique:'<path d="M9 18V5l10-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
    partage:'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
    revisions:'<path d="M4 6a2 2 0 0 1 2-2h5v16H6a2 2 0 0 1-2-2z"/><path d="M20 6a2 2 0 0 0-2-2h-5v16h5a2 2 0 0 0 2-2z"/>',
    grille:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="2" fill="currentColor" stroke="none"/><circle cx="15.5" cy="8.5" r="2"/><circle cx="8.5" cy="15.5" r="2"/><circle cx="15.5" cy="15.5" r="2" fill="currentColor" stroke="none"/>',
    erreurs:'<path d="M4 5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M14 3v5h5"/><path d="M9 12l3 3m0-3l-3 3"/>',
    compte:'<circle cx="12" cy="8" r="4"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
    telecharger:'<path d="M12 4v10m0 0l-4-4m4 4l4-4"/><path d="M5 19h14"/>',
    lire:'<path d="M4 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4z"/><path d="M20 5h-6a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h6z"/>',
    cible:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>',
    duel:'<path d="M4 4l10 10M20 4L10 14"/><path d="M6 20l3-3M18 20l-3-3"/>',
    trophee:'<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3"/><path d="M10 19h4M12 14v5"/>',
    flamme:'<path d="M12 3c3 4 5 6 5 9a5 5 0 0 1-10 0c0-2 1-3.5 2.5-5C10 8.5 11 6 12 3z"/>',
    carte:'<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19"/>',
    cadenas:'<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    diagnostic:'<path d="M4 19V9M9 19V4M14 19v-7M19 19v-4"/>',
    examen:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    soleil:'<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4"/>',
    lune:'<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>',
    sortie:'<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 16l-4-4 4-4M6 12h9"/>',
    cloche:'<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    son:'<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
    muet:'<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
    drapeau:'<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
    eclair:'<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/>',
    etoile:'<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>',
    vue:'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    groupe:'<circle cx="9" cy="8.5" r="3.2"/><path d="M3 19a6 6 0 0 1 12 0"/><circle cx="17" cy="9.5" r="2.5"/><path d="M15.5 14.2A5 5 0 0 1 21 19"/>',
    question:'<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.8-2.4 2.2-2.4 3.9"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>',
    horloge:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    coche:'<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.8 2.8L16.5 9.5"/>',
    corbeille:'<path d="M4 7h16"/><path d="M9 7V4.5h6V7"/><path d="M6.5 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4L17.5 7"/><path d="M10 11v6M14 11v6"/>',
    coeur:'<path d="M12 20.2s-7.6-4.6-7.6-10.4A4.2 4.2 0 0 1 12 7.4a4.2 4.2 0 0 1 7.6 2.4c0 5.8-7.6 10.4-7.6 10.4z"/>',
    bulle:'<path d="M5 4.5h14a2 2 0 0 1 2 2v8.2a2 2 0 0 1-2 2h-6.4L8 20.5v-3.8H5a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2z"/>',
    photo:'<rect x="3" y="5" width="18" height="14" rx="2.2"/><circle cx="9" cy="10.4" r="1.7"/><path d="M21 16.2l-5-4.7L7.5 19"/>',
    epingle:'<path d="M12 21v-6"/><path d="M8.2 3.5h7.6l-1 5.3 3 3.2H6.2l3-3.2z"/>',
    envoyer:'<path d="M4 12l16-7.5-5.2 15-3.1-6.2z"/><path d="M11.7 13.3L20 4.5"/>'
  }[n] || '';
  return `<svg ${o}>${p}</svg>`;
}

/* Le logo reprend exactement la feuille de réponses de l'icône :
   une plaque crème, quatre bulles A B C D, deux noircies deux vides. */
function logoSvg(t){
  const id = 'lg' + Math.random().toString(36).slice(2, 7);
  return `<svg class="logo" width="${t}" height="${t}" viewBox="0 0 64 64" aria-hidden="true">
    <defs>
      <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#F2EADB"/><stop offset="1" stop-color="#DED3BE"/>
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#${id})"/>
    <rect x="2.9" y="2.9" width="58.2" height="58.2" rx="15.2" fill="none" stroke="#00000018"/>
    <circle cx="22" cy="22" r="10.4" fill="#FBFAF7" stroke="#C9BEA9" stroke-width="1.1"/>
    <text x="22" y="26.4" text-anchor="middle" font-family="Helvetica,Arial,sans-serif"
          font-size="12.5" fill="#8A8378">A</text>
    <circle cx="42" cy="22" r="10.4" fill="#1C1C1C"/>
    <text x="42" y="26.4" text-anchor="middle" font-family="Helvetica,Arial,sans-serif"
          font-size="12.5" fill="#FBFAF7">B</text>
    <circle cx="22" cy="42" r="10.4" fill="#1C1C1C"/>
    <text x="22" y="46.4" text-anchor="middle" font-family="Helvetica,Arial,sans-serif"
          font-size="12.5" fill="#FBFAF7">C</text>
    <circle cx="42" cy="42" r="10.4" fill="#FBFAF7" stroke="#C9BEA9" stroke-width="1.1"/>
    <text x="42" y="46.4" text-anchor="middle" font-family="Helvetica,Arial,sans-serif"
          font-size="12.5" fill="#8A8378">D</text>
  </svg>`;
}
function maj(champ, val){ S.form[champ] = val; }
function majPaieTel(val){ S.paieTel = val; }
function majPaieNom(val){ S.paieNomCompte = val; }
window.majPaieTel = majPaieTel;
window.majPaieNom = majPaieNom;

/* Le fichier choisi est prévisualisé avant tout envoi réseau. */
window.choisirPreuve = function(fichier){
  if(!fichier) return;
  if(fichier.size > 5 * 1024 * 1024){ S.erreur = 'Image trop lourde : 5 Mo maximum.'; rendre(); return; }
  const lecteur = new FileReader();
  lecteur.onload = () => {
    S.paievePreuve = { fichier, dataUrl: lecteur.result };
    S.erreur = '';
    rendre();
  };
  lecteur.readAsDataURL(fichier);
};

function ecranInscription(){
  vue().innerHTML = `
  <div class="pad" style="padding-top:22px">
    ${logoSvg(44)}
    <h1 class="titre" style="margin-top:16px">Garde ton<br>résultat</h1>
    <p class="sous" style="margin:8px 0 18px">Tu viens de composer ${S.testNote!==null?`et d'obtenir ${S.testNote}/10`:''}. Crée ton compte pour retrouver ton cahier d'erreurs, ton classement et ta série sur n'importe quel téléphone.</p>

    ${S.erreur?`<div class="alerte" role="alert">${E(S.erreur)}</div>`:''}

    <div class="champ">
      <label for="f-nom">Nom et prénom</label>
      <input id="f-nom" type="text" value="${E(S.form.nom)}" placeholder="Ouedraogo Franck" oninput="maj('nom',this.value)" autocomplete="name">
    </div>
    <div class="champ">
      <label for="f-tel">Numéro de téléphone</label>
      <div class="prefixe"><span class="ind">+226</span>
        <input id="f-tel" type="tel" inputmode="numeric" maxlength="8" value="${E(S.form.tel)}" placeholder="70 00 00 00" oninput="maj('tel',this.value)" autocomplete="tel">
      </div>
      <div class="aide">C'est ce numéro qui servira aussi pour l'abonnement. Pas d'adresse e-mail à retenir.</div>
    </div>
    <div class="champ">
      <label for="f-pin">Ton mot de passe (4 chiffres)</label>
      <input id="f-pin" type="password" inputmode="numeric" maxlength="4" value="${E(S.form.pin)}" placeholder="••••" oninput="maj('pin',this.value)">
    </div>

    <button class="cta" style="margin-top:6px" data-inscrire="1">Créer mon compte<small>Gratuit · aucune carte bancaire</small></button>
    <button class="lien" data-go="connexion">J'ai déjà un compte</button>

    <p class="sous" style="margin-top:18px;font-size:11.5px">En créant ton compte, tu acceptes les <a href="/confidentialite.html#conditions" target="_blank" rel="noopener">conditions d'utilisation</a> et la <a href="/confidentialite.html" target="_blank" rel="noopener">politique de confidentialité</a>. Ton numéro ne sert qu'à ton compte et à ton abonnement.</p>
  </div>`;
}

function ecranConnexion(){
  vue().innerHTML = `
  <div class="pad" style="padding-top:22px">
    ${logoSvg(44)}
    <h1 class="titre" style="margin-top:16px">Content de<br>te revoir</h1>
    <p class="sous" style="margin:8px 0 18px">Ton cahier d'erreurs et ta série d'assiduité t'attendent.</p>

    ${S.erreur?`<div class="alerte" role="alert">${E(S.erreur)}</div>`:''}

    <div class="champ">
      <label for="c-tel">Numéro de téléphone</label>
      <div class="prefixe"><span class="ind">+226</span>
        <input id="c-tel" type="tel" inputmode="numeric" maxlength="8" value="${E(S.form.tel)}" placeholder="70 00 00 00" oninput="maj('tel',this.value)" autocomplete="tel">
      </div>
    </div>
    <div class="champ">
      <label for="c-pin">Mot de passe</label>
      <input id="c-pin" type="password" inputmode="numeric" maxlength="4" value="${E(S.form.pin)}" placeholder="••••" oninput="maj('pin',this.value)">
    </div>

    <button class="cta" style="margin-top:6px" data-connecter="1">Me connecter</button>
    <button class="lien" data-go="inscription">Créer un compte</button>
    <button class="lien" data-oubli="1">Mot de passe oublié ?</button>

    ${S.bloque ? `
    <div class="carte" style="margin-top:14px;text-align:left">
      <div class="libelle" style="margin-bottom:6px">Vous n'arrivez pas à entrer ?</div>
      <p class="sous" style="margin:0 0 10px">Retrouvez votre compte avec votre numéro et la couleur choisie à l'inscription. Si cela ne marche toujours pas, écrivez à l'administrateur.</p>
      <button class="cta creux" data-oubli="1">Retrouver mon compte<small>Numéro + couleur</small></button>
      <a class="cta creux" style="display:block;margin-top:8px;text-decoration:none"
         href="https://wa.me/226${CONTACT.adminTel}?text=${encodeURIComponent("Bonjour, je n'arrive pas à me connecter à Mon Concours. Mon numéro : " + (S.form.tel || ''))}"
         target="_blank" rel="noopener">Écrire à l'administrateur<small>Sur WhatsApp</small></a>
    </div>` : ''}
  </div>`;
}

/* =====================================================================
   ABONNEMENT ET PAIEMENT
   ===================================================================== */
const nomFormule = f => ({ semaine:'Abonnement Semaine', mensuelle:'Abonnement Mois', annuelle:'Abonnement Année', essai:'Essai gratuit' })[f] || 'Abonnement';
/* Trois abonnements, jamais quatre. Aucun chiffre inventé : le prix par jour est un simple calcul. */
const FORMULES = {
  mensuelle:{ cle:'mensuelle', n:'Abonnement Mois',    prix:'1 000 FCFA', montant:1000, per:'30 jours', jour:'33 F par jour', reco:false },
  annuelle: { cle:'annuelle', n:'Abonnement Année',   prix:'4 000 FCFA', montant:4000, per:'12 mois',  jour:'11 F par jour', reco:true }
};
const OPERATEURS = {
  orange:{ nom:'Orange Money', pastille:'OM', cls:'om' },
  moov:  { nom:'Moov Money',   pastille:'MM', cls:'mm' },
  wave:  { nom:'Wave',         pastille:'W',  cls:'wv' }
};
const numPaie = op => (CONTACT.paiement && CONTACT.paiement[op]) || CONTACT.adminTel;
const estAbonne = () => !!(S.abo && S.abo.actif);
/* abonnement payé : pendant l'essai de 3 jours, les offres restent visibles (sans rien bloquer) */
const estAbonnePaye = () => estAbonne() && S.abo.formule !== 'essai';

/* Partenaire dont les candidats paient avant tout accès (Omer) : tant que l'abonnement n'est pas validé,
   la personne ne voit que l'offre et le paiement. La règle vient du serveur et se garde sur le téléphone. */
function lireRegleP(){ try{ return JSON.parse(localStorage.getItem('mc_regle_p') || 'null'); }catch(e){ return null; } }
function ecrireRegleP(r){ try{ if(r) localStorage.setItem('mc_regle_p', JSON.stringify(r)); else localStorage.removeItem('mc_regle_p'); }catch(e){} S.regleP = r; }
S.regleP = lireRegleP();
const paiementObligatoire = () => !!(S.regleP && S.regleP.obligatoire);
const paiementParPartenaire = () => !!(S.regleP && S.regleP.conseiller_tel);
const bloqueParPartenaire = () => paiementObligatoire() && S.util.connecte && !estAbonnePaye();
const ECRANS_AVANT_PAIEMENT = ['abonnement', 'paiement'];
const ECRANS_VISITEUR_PARTENAIRE = ['engagement', 'inscription', 'connexion'];
async function chargerRegleP(){
  if(!base) return;
  try{
    const { data } = await base.rpc('ma_regle_partenaire');
    ecrireRegleP(data && data.ok ? { nom: data.nom, obligatoire: !!data.obligatoire, conseiller_tel: data.conseiller_tel || '' } : null);
  }catch(e){}
}
/* un visiteur arrivé par le lien d'un tel partenaire : la règle est connue avant même l'inscription */
async function chargerRegleVisiteur(){
  if(!base || S.util.connecte) return;
  const c = codePartenaire();
  if(c.length < 3){ if(S.regleP) ecrireRegleP(null); return; }
  try{
    const { data } = await base.rpc('partenaire_nom_code', { p_code: c });
    ecrireRegleP(data && data.ok ? { nom: data.nom, obligatoire: !!data.obligatoire, conseiller_tel: data.conseiller_tel || '' } : null);
    rendre();
  }catch(e){}
}
/* Le candidat peut recevoir plusieurs propositions d'abonnement ; seul « À demain » les suspend 3 jours. */
function peutProposer(point){
  const blocage = point >= 1 && point <= 3;     /* le candidat est arrêté : le chemin pour continuer doit toujours se voir */
  if(S.gratuit || (blocage ? estAbonnePaye() : estAbonne())) return false;
  const t = lireReglages().pass_demain;
  if(!blocage && t && Date.now() - t < 3 * 86400000) return false;
  if(S.propositionPoint !== point){ S.propositionPoint = point; pister('PAYWALL_VIEWED', { point }); }
  return true;
}
/* Les deux abonnements, prêts à toucher : c'est ce qui s'affiche partout où le candidat est arrêté. */
/* Au blocage : ce que le candidat a déjà fait, avec ses propres chiffres */
function ligneBilanPerso(){
  if(!S.util.connecte) return '';
  const d = S.details || {};
  const c = typeof d.compos_total === 'number' ? d.compos_total : ((S.stats && S.stats.compositions) || 0), e = d.refermees_total || 0;
  if(!c && !e) return '';
  const fait = [c ? 'fait ' + c + ' composition' + (c > 1 ? 's' : '') : '', e ? (c ? 'refermé ' : 'refermé ') + e + ' erreur' + (e > 1 ? 's' : '') : ''].filter(Boolean).join(' et ');
  return `<p class="sous bilan-perso" style="margin:0 0 12px;text-align:left"><b>Tu as déjà ${fait}.</b> Avec l'abonnement : tout le reste, sans limite.</p>`;
}
/* ---- Offre unifiée (maquette C) : ses chiffres, conseiller WhatsApp, année en avant, avantages courts ---- */
function chiffresPerso(){
  if(!S.util.connecte) return { c:0, e:0, p:0, moy:null };
  const d = S.details || {};
  const c = typeof d.compos_total === 'number' ? d.compos_total : ((S.stats && S.stats.compositions) || 0);
  const cs = ((S.journee && S.journee.compositions) || []).filter(x => x.sur > 0 && !x.collective);
  const moy = cs.length ? Math.round(cs.reduce((t, x) => t + x.score / x.sur * 50, 0) / cs.length) : null;
  return { c, e: d.refermees_total || 0, p: d.gain_points_semaine || 0, moy };
}
function enteteBilan(){
  const x = chiffresPerso();
  if(!x.c && !x.e) return '';
  const fait = [x.c ? 'fait ' + x.c + ' composition' + (x.c > 1 ? 's' : '') : '', x.e ? 'refermé ' + x.e + ' erreur' + (x.e > 1 ? 's' : '') : ''].filter(Boolean).join(' et ');
  const t = (v, l) => `<div class="stat"><div class="v">${v}</div><div class="l">${l}</div></div>`;
  const tuiles = [x.moy !== null ? t(x.moy + '/50', 'ta moyenne') : '', x.e ? t(x.e, 'erreurs refermées') : '', x.p > 0 ? t('+' + x.p, 'points cette semaine') : ''].join('');
  return `<div class="offre-tete"><h1 class="titre" style="font-size:21px;line-height:1.2">Tu as déjà ${fait}.</h1>
    <p class="sous" style="margin:6px 0 0">Ne t'arrête pas là : continue sans limite jusqu'au concours.</p>
    ${tuiles ? `<div class="av-stats">${tuiles}</div>` : ''}</div>`;
}
function carteFormule(k, sous){
  const f = FORMULES[k], an = k === 'annuelle';
  const base = formulesBase();
  const douze = base.mensuelle.montant * 12;
  const sousDef = an
    ? (f.ancien ? '12 mois sans limite' : '12 mois sans limite' + (douze > f.montant ? ', <s>au lieu de ' + E(fmtFcfa(douze)) + '</s> en payant mois par mois' : ''))
    : '30 jours sans limite';
  return `<div class="formule ${an ? 'reco' : ''} ${f.ancien ? 'flash' : ''}">
    ${f.ancien ? '<span class="ruban">promotion</span>' : an ? '<span class="ruban">recommandé</span>' : ''}
    <div class="haut"><span class="nom">${E(f.n)}</span>
      <span class="prix">${f.ancien ? `<s class="barre">${E(f.ancien)}</s> ` : ''}${E(f.prix)}</span></div>
    <p class="sous" style="margin:4px 0 0">${sous || sousDef}</p>
    ${f.ancien ? `<div class="flash-reste">${E(S.promo ? promoFin() : '')}</div>` : ''}
    <button class="cta${an ? '' : ' creux'}" style="margin-top:12px" data-pass="${k}">${an ? 'Choisir l\'année' : 'Choisir le mois'}</button>
  </div>`;
}
function avantagesListe(){
  return `<ul class="inclus-liste" style="margin-top:16px">
    <li>Mes erreurs revient chaque jour, jusqu'à ce que tu aies juste</li>
    <li>Feuille corrigée de mes erreurs détaillées en PDF</li>
    <li>Compositions chronométrées, sans limite, avec ton classement</li>
    <li>Cours et questions sans connexion</li>
  </ul>
  <p class="sous" style="margin:14px 0 0;text-align:center;font-size:12.5px">${CONTACT.paiementDirect ? 'Orange Money, Moov Money ou Wave.<br>Validation souvent en quelques minutes.' : (paiementParPartenaire() ? 'Votre conseiller ' + E(S.regleP.nom) + ' vous guide sur WhatsApp.<br>Activation dès que votre paiement est vérifié.' : 'Un conseiller vous guide sur WhatsApp.<br>Activation souvent en quelques minutes.')}</p>`;
}
function offreC(point, cleConseiller, alternatives, sansEntete){
  return (sansEntete ? '' : enteteBilan()) + (point === 'abonnement' ? tableauAvantages() : '') + choixOffre(point) + (alternatives || '');
}
function offreDeuxPrix(sansEntete){
  return offreC('blocage', 'mensuelle', `<button class="lien-mini of-proche" style="margin-top:12px" data-proche="mensuelle">${ico('partage',13)} Un proche paie pour moi</button>`, !!sansEntete);
}
/* ---- Offre unique : deux choix, un seul bouton, et une feuille de trois étapes avant WhatsApp ---- */
const libelleFormule = k => (FORMULES[k] ? FORMULES[k].n.replace('Abonnement ', '') : '');
function tableauAvantages(){
  const l = (a, g, p) => `<div class="tb-l"><span>${a}</span><span>${g}</span><span class="ok">${p}</span></div>`;
  const L = 'Limité', I = 'Illimité';
  return `<div class="tb"><div class="tb-l tb-h"><span></span><span>Gratuit</span><span>Abonnement</span></div>
    ${l('Questions de toutes les matières', L, I)}${l('Corrections des QCM', L, I)}${l('Compositions chronométrées', L, I)}${l('Mes erreurs, chaque jour', L, I)}${l('Feuille corrigée détaillée en PDF', L, I)}${l('Cours et questions sans connexion', L, I)}${l('Composition nationale', 'Oui', 'Oui')}</div>`;
}
function choixOffre(point){
  const an = FORMULES.annuelle, mo = FORMULES.mensuelle, douze = formulesBase().mensuelle.montant * 12;
  const ancien = an.ancien || (douze > an.montant ? fmtFcfa(douze) : '');
  const rass = CONTACT.paiementDirect ? 'Orange Money, Moov Money ou Wave.<br>Validation souvent en quelques minutes.'
    : (paiementParPartenaire() ? 'Votre conseiller ' + E(S.regleP.nom) + ' vous guide sur WhatsApp.<br>Activation dès que votre paiement est vérifié.'
      : 'Orange Money, Moov Money ou Wave.<br>Ton accès s\'ouvre dès que le paiement est vérifié.');
  return `<div class="offre-choix" data-offre-point="${E(point || 'abonnement')}">
    <div class="of-liste" role="radiogroup" aria-label="Formule">
      <button type="button" class="of on" role="radio" aria-checked="true" data-offre-f="annuelle">
        <span class="of-ruban">Le plus choisi</span><i class="of-rad" aria-hidden="true"></i>
        <span class="of-n"><b>Année</b><small>12 mois</small></span>
        <span class="of-p"><b>${E(an.prix.replace(' FCFA', ' F'))}</b>${ancien ? `<s>${E(ancien.replace(' FCFA', ' F'))}</s>` : ''}</span></button>
      <button type="button" class="of" role="radio" aria-checked="false" data-offre-f="mensuelle">
        <i class="of-rad" aria-hidden="true"></i><span class="of-n"><b>Mois</b><small>30 jours</small></span>
        <span class="of-p"><b>${E(mo.prix.replace(' FCFA', ' F'))}</b></span></button>
    </div>
    <button type="button" class="cta vert of-go" data-offre-go="1">${logoReseau('whatsapp')}<span class="of-go-t">Continuer avec l'Année</span><small>Un conseiller t'aide à payer sur WhatsApp</small></button>
    <p class="of-rass">${rass}</p>
    ${CONTACT.paiementDirect ? `<button type="button" class="lien-mini" data-pass="annuelle" data-offre-direct="1">Payer moi-même</button>` : ''}
  </div>`;
}
function fermerFeuillePay(){ const d = document.getElementById('feuille-pay'); if(d) d.remove(); }
function ouvrirFeuillePay(k, point){
  const f = FORMULES[k] || FORMULES.annuelle; k = f.cle;
  fermerFeuillePay();
  pister('PAYWALL_CLICKED', { point: point || 'blocage', formule: k });
  const d = document.createElement('div'); d.id = 'feuille-pay'; d.className = 'fp-fond';
  d.innerHTML = `<div class="fp" role="dialog" aria-modal="true" aria-label="Comment payer"><i class="fp-poignee" aria-hidden="true"></i>
    <h2>${E(libelleFormule(k))}, ${E(f.prix.replace(' FCFA', ' F'))} : voici comment ça se passe</h2>
    <ol class="fp-etapes">
      <li><b>Le message est déjà écrit.</b><span>Tu l'envoies au conseiller sur WhatsApp.</span></li>
      <li><b>Il te donne le numéro où payer.</b><span>Orange Money, Moov Money ou Wave.</span></li>
      <li><b>Tu envoies la capture du paiement.</b><span>Ton accès s'ouvre dès qu'elle est vérifiée, et tu reprends là où tu t'es arrêté.</span></li>
    </ol>
    <a class="cta vert" href="https://wa.me/226${numeroConseiller()}?text=${encodeURIComponent(messageConseiller(k))}" target="_blank" rel="noopener" data-conseiller-wa="${E(point || 'blocage')}" data-conseiller-formule="${E(k)}" data-fp-ok="1">${logoReseau('whatsapp')} Ouvrir WhatsApp</a>
    <p class="fp-note">Tu ne paies rien dans l'application. Personne ne te demandera ton code secret.</p>
    <button type="button" class="lien" data-fp-fermer="1">Plus tard</button></div>`;
  document.body.appendChild(d);
}
document.addEventListener('click', ev => {
  const t = ev.target; if(!t || !t.closest) return;
  const f = t.closest('[data-offre-f]');
  if(f){
    const bloc = f.closest('.offre-choix'); if(!bloc) return;
    const k = f.dataset.offreF; if(!FORMULES[k]) return;
    S.choixFormule = k;
    bloc.querySelectorAll('[data-offre-f]').forEach(b => { const on = b === f; b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); });
    const tx = bloc.querySelector('.of-go-t'); if(tx) tx.textContent = k === 'annuelle' ? 'Continuer avec l\'Année' : 'Continuer avec le Mois';
    const dir = bloc.querySelector('[data-offre-direct]'); if(dir) dir.dataset.pass = k;
    pister('SUBSCRIPTION_PLAN_SELECTED', { formule: k });
    return;
  }
  const go = t.closest('[data-offre-go]');
  if(go){
    const bloc = go.closest('.offre-choix'); const on = bloc && bloc.querySelector('[data-offre-f].on');
    return ouvrirFeuillePay(on ? on.dataset.offreF : 'annuelle', bloc ? bloc.dataset.offrePoint : 'blocage');
  }
  if(t.closest('[data-fp-fermer]') || (t.classList && t.classList.contains('fp-fond'))) return fermerFeuillePay();
  if(t.closest('[data-fp-ok]')) setTimeout(fermerFeuillePay, 500);
});
document.addEventListener('keydown', ev => { if(ev.key === 'Escape') fermerFeuillePay(); });
/* Ce qui est payant : un seul passage. Un visiteur crée d'abord son compte ;
   un compte sans abonnement arrive directement sur les abonnements, avec la raison. */
function exigerAbonnement(raison, origine){
  if(S.gratuit || estAbonne()) return true;
  if(!S.util.connecte){ S.modal = 'inscription'; S.erreur = ''; surcouche(); return false; }
  S.raisonAbo = raison || '';
  pister('PAYWALL_VIEWED', { origine: origine || 'autre' });
  aller('abonnement');
  return false;
}
const peutFeuilleDetaillee = () => S.gratuit || estAbonne() || ((S.stats && S.stats.compositions) || 0) <= 2;

/* Payer avec l'aide d'un conseiller sur WhatsApp : premier choix, sans formulaire.
   Deux numéros se partagent les demandes ; un même appareil retombe toujours sur le même. */
function numeroConseiller(){
  if(paiementParPartenaire() && S.regleP.conseiller_tel) return S.regleP.conseiller_tel;
  let i = null;
  try{ i = localStorage.getItem('mc_conseiller'); }catch(e){}
  if(i !== '0' && i !== '1'){
    i = Math.random() < 0.5 ? '0' : '1';
    try{ localStorage.setItem('mc_conseiller', i); }catch(e){}
  }
  return i === '1' ? CONTACT.adminTel2 : CONTACT.adminTel;
}
function messageConseiller(cle){
  const f = cle && FORMULES[cle];
  const tel = (S.util && S.util.tel) ? S.util.tel : '';
  const prenom = ((S.util && S.util.nom) || '').trim().split(/\s+/)[0];
  const qui = (prenom && !/^candidat$/i.test(prenom) ? 'je suis ' + prenom + (S.nomConcours ? ' et je prépare le concours ' + S.nomConcours : '') + '. ' : '');
  return 'Bonjour, ' + qui + 'Je veux m\'abonner à Mon Concours' + (f ? ' (' + f.n + ', ' + f.prix + ')' : '') +
    '. Mon numéro de compte : ' + (tel || '(mon numéro)') + '. Pouvez-vous m\'aider à payer ?';
}
function blocConseiller(cle, point){
  return `<div class="conseiller">
    <a class="cta vert" href="https://wa.me/226${numeroConseiller()}?text=${encodeURIComponent(messageConseiller(cle))}" target="_blank" rel="noopener" data-conseiller-wa="${E(point || 'abonnement')}" data-conseiller-formule="${E(cle || '')}">
      ${ico('partage',16)} Payer avec l'aide d'un conseiller<small>Sur WhatsApp : on vous guide, c'est rapide</small></a>
    ${CONTACT.paiementDirect ? `<div class="ou-sep"><span>ou payer vous-même</span></div>` : ""}
  </div>`;
}
document.addEventListener('click', async ev => {
  if(ev.target.closest && ev.target.closest('[data-debloquer-notifs]')){
    pister('OFFER_B_NOTIFS_CLICK');
    await activerRappel(18, 0);
    await chargerOffreCompo();
    if(S.rappel && S.rappel.actif){ S.compoDebloqueNotifs = false; ouvrirComposition(); }
    return;
  }
  const a = ev.target.closest && ev.target.closest('[data-conseiller-wa]');
  if(a){ pister('PAY_ADVISOR_WHATSAPP', { point: a.dataset.conseillerWa, formule: a.dataset.conseillerFormule || null }); }
});

/* « Un proche paie pour moi » et « J'ai un code » : sous chaque écran de paiement */
function blocAlternatives(cle){
  const k = cle || S.choixFormule;
  return `<div class="alt-paiement">
    <button class="cta creux" data-proche="${E(k)}">${ico('partage',16)} Un proche paie pour moi<small>Un message WhatsApp prêt à envoyer</small></button>
    <button class="cta creux" data-code-ouvrir="1" aria-expanded="${!!S.codeOuvert}">${ico('cadenas',16)} J'ai un code</button>
    ${S.codeOuvert ? `<div class="champ" style="margin-top:10px">
      <label for="code-acces">Votre code</label>
      <input id="code-acces" type="text" maxlength="12" autocapitalize="characters" autocomplete="off" placeholder="XXXXX-XXXXX" value="${E(S.codeSaisi || '')}" oninput="majCode(this.value)">
      ${S.codeErreur ? `<div class="alerte" role="alert" style="margin-top:8px">${E(S.codeErreur)}</div>` : ''}
      <button class="cta vert" style="margin-top:10px" data-code-valider="1" ${S.codeEnvoi ? 'disabled' : ''}>${S.codeEnvoi ? 'Vérification…' : 'Valider mon code'}</button>
    </div>` : ''}
  </div>`;
}
window.majCode = v => { S.codeSaisi = v; };
function messageProche(cle){
  const f = FORMULES[cle] || FORMULES.mensuelle;
  const tel = (S.util && S.util.tel) ? S.util.tel : '';
  return 'Salut, je prépare mon concours sur Mon Concours (' + CONTACT.site.replace('https://', '') + '). ' +
    'Tu peux m\'offrir l\'' + f.n + ' (' + f.prix + ') ? ' +
    'Paye par Orange Money au +226 ' + fmtTel(CONTACT.paiement.orange) + ', Moov Money au +226 ' + fmtTel(CONTACT.paiement.moov) + ' ou Wave au +226 ' + fmtTel(CONTACT.paiement.wave) +
    ', puis envoie la capture sur WhatsApp au +226 ' + fmtTel(CONTACT.adminTel) + ' ' +
    'en écrivant mon numéro de compte : ' + (tel || '(mon numéro)') + '. Mon compte sera activé. Merci !';
}
async function validerCode(){
  const code = (S.codeSaisi || '').trim();
  if(code.length < 8){ S.codeErreur = 'Entrez le code reçu.'; return rendre(); }
  if(!S.util.connecte){ S.modal = 'inscription'; S.erreur = ''; return surcouche(); }
  S.codeEnvoi = true; S.codeErreur = ''; rendre();
  try{
    const { data, error } = await base.rpc('utiliser_code', { p_code: code });
    S.codeEnvoi = false;
    if(error) throw error;
    if(!data || !data.ok){ S.codeErreur = (data && data.message) || 'Code refusé.'; return rendre(); }
    pister('CODE_REDEEMED', { formule: data.formule });
    S.codeOuvert = false; S.codeSaisi = '';
    /* l'abonnement est affiché tout de suite, sans attendre la relecture */
    if(data.fin_le){
      const j = Math.max(0, Math.ceil((new Date(data.fin_le) - Date.now()) / 86400000));
      S.abo = { actif:true, formule:data.formule, fin_le:data.fin_le, jours_restants:j, echeance:j + ' jour' + (j > 1 ? 's' : '') + ' restant' + (j > 1 ? 's' : '') };
    }
    await chargerAbonnement(); chargerNotifications();
    signalCandidat((data.libelle || 'Votre abonnement') + ' est actif. Bon courage !');
    aller('abonnement');
  }catch(e){ S.codeEnvoi = false; S.codeErreur = enFrancais(e, 'Vérifiez votre connexion et réessayez.'); rendre(); }
}

/* La page « Mon abonnement » : trois cartes, deux boutons dessous */
function ecranOffrePartenaire(){
  const nom = E(S.regleP.nom), paiement = S.paieEnAttente;
  const liste = [
    ['grille', 'Des compositions nationales chronométrées, sur la vraie feuille, corrigées, avec votre classement'],
    ['cahier', 'Le cahier d\'erreurs : chaque erreur revient jusqu\'à ce que vous ayez juste'],
    ['crayon', 'Questions et corrections sans limite, matière par matière'],
    ['doc', 'La feuille corrigée détaillée, en PDF'],
    ['hors', 'Les cours et les questions sans connexion'],
    ['partage', 'Votre conseiller ' + S.regleP.nom + ' vous accompagne sur WhatsApp']
  ];
  vue().innerHTML = `
  <div class="pad">
    ${S.paiementEtat && S.paiementEtat.statut === 'refuse' ? `<div class="carte" style="margin:0 0 14px;text-align:center;border-color:var(--rouge-bord);background:var(--rouge-fond)"><div class="eyebrow">Paiement rejeté</div><p class="sous" style="margin:6px 0 0">${E(S.paiementEtat.message || '')}</p></div>` : ''}
    ${paiement ? `
    <div class="carte" style="margin:0 0 14px;text-align:center">
      <div class="eyebrow">Capture reçue</div>
      <h1 class="titre" style="font-size:22px;margin:8px 0">Paiement en cours de vérification</h1>
      <p class="sous">Votre paiement du ${new Date(paiement.cree_le).toLocaleDateString('fr-FR')} est en cours de vérification. Votre accès s'ouvre dès qu'il est confirmé, et vous recevez une notification.</p>
      <p class="sous" style="margin:8px 0 0">Besoin d'aller plus vite ? Écrivez à ${nom} : <a href="tel:+226${numeroConseiller()}" data-pister-appel="1">+226 ${fmtTel(numeroConseiller())}</a></p>
    </div>` : `
    <div class="eyebrow">Mon Concours · avec ${nom}</div>
    <div class="serment" style="font-size:34px;margin:10px 0 0">Prépare ton concours<br><em>avec méthode</em>.</div>
    <p class="hero-texte">Tout ce qu'il faut pour t'entraîner, te corriger et te situer, avec un conseiller qui t'accompagne du premier jour au concours.</p>
    <ul class="inclus-liste" style="margin-top:16px">${liste.map(x => `<li>${E(x[1])}</li>`).join('')}</ul>
    <h2 class="titre" style="font-size:19px;margin:22px 0 10px">Choisissez votre abonnement</h2>
    ${carteFormule('annuelle')}${carteFormule('mensuelle')}
    <div class="carte" style="margin-top:6px">
      <div class="eyebrow">Comment ça se passe</div>
      <ol style="margin:10px 0 0;padding-left:20px;line-height:1.6;font-size:14.5px">
        <li>Vous choisissez votre abonnement.</li>
        <li>${nom} vous guide sur WhatsApp pour le paiement.</li>
        <li>Vous envoyez votre capture ici : l'accès s'ouvre dès que le paiement est vérifié.</li>
      </ol>
    </div>`}
    <button class="lien" style="display:block;margin:18px auto 0" data-deconnecter="1">Me déconnecter</button>
  </div>`;
}

function ecranAbonnement(){
  if(bloqueParPartenaire()) return ecranOffrePartenaire();
  const abo = S.abo;
  const paiement = S.paieEnAttente;
  const verrou = bloqueParPartenaire();
  vue().innerHTML = `
  <div class="pad">
    ${verrou ? `<div class="carte" style="margin:0 0 14px"><div class="eyebrow">Bienvenue</div>
      <p class="sous" style="margin:6px 0 0">Pour accéder à Mon Concours, choisissez votre abonnement. Votre conseiller <b>${E(S.regleP.nom)}</b> vous accompagne sur WhatsApp pour le paiement.</p></div>` : '<button class="retourhaut" data-go="compte">Retour</button>'}

    ${abo && abo.actif ? `
    <div class="carte" style="text-align:center;padding:22px 16px">
      <div class="eyebrow">Mon abonnement</div>
      <h1 class="titre" style="font-size:22px;margin:8px 0">${E(nomFormule(abo.formule))}</h1>
      <p class="sous">${abo.jours_restants} jour${abo.jours_restants>1?'s':''} restant${abo.jours_restants>1?'s':''}, jusqu'au ${new Date(abo.fin_le).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})}</p>
    </div>
    <p class="sous" style="margin:14px 0 4px">Pour prolonger, choisissez un abonnement : il s'ajoute à la fin du vôtre.</p>` : `
    ${S.raisonAbo ? `<div class="raison-abo"><span>${ico('cadenas',16)}</span><p>${E(S.raisonAbo)}</p></div>` : ''}
    ${enteteBilan() || '<h1 class="titre">Prépare ton concours<br>sans limite</h1>'}`}

    ${S.paiementEtat && S.paiementEtat.statut === 'confirme' ? `
    <div class="carte" style="margin:14px 0;text-align:center">
      <div class="eyebrow">Paiement confirmé</div>
      <p class="sous" style="margin:6px 0 10px">${E(S.paiementEtat.message || '')}</p>
      <button class="cta creux" data-recu="${E(S.paiementEtat.id)}">Télécharger mon reçu</button>
    </div>` : ''}
    ${S.paiementEtat && S.paiementEtat.statut === 'refuse' ? `
    <div class="carte" style="margin:14px 0;text-align:center;border-color:var(--rouge-bord);background:var(--rouge-fond)">
      <div class="eyebrow">Paiement rejeté</div>
      <p class="sous" style="margin:6px 0 0">${E(S.paiementEtat.message || '')}</p>
    </div>` : ''}
    ${paiement ? `
    <div class="carte" style="margin:14px 0;text-align:center">
      <div class="eyebrow">Capture reçue</div>
      <p class="sous" style="margin:6px 0 0">Votre paiement du ${new Date(paiement.cree_le).toLocaleDateString('fr-FR')} est en cours de vérification. Validation souvent en quelques minutes. Vous recevrez une notification dès que c'est confirmé.</p>
      <p class="sous" style="margin:8px 0 0">Tu veux aller plus vite ? <a href="tel:+226${numeroConseiller()}" data-pister-appel="1">Appelle le +226 ${fmtTel(numeroConseiller())}</a> pour signaler ton paiement.</p>
    </div>` : `
    ${offreC('abonnement', '', verrou ? '' : blocAlternatives(), true)}`}
    ${verrou ? '<button class="lien" style="display:block;margin:18px auto 0" data-deconnecter="1">Me déconnecter</button>' : ''}
  </div>`;
}

function ecranPaiement(){
  const f = FORMULES[S.choixFormule] || FORMULES.mensuelle;
  const op = OPERATEURS[S.operateur] ? S.operateur : 'orange';
  const O = OPERATEURS[op];

  /* Candidats d'un partenaire en paiement obligatoire : pas de formulaire, le conseiller guide, puis la capture. */
  if(paiementParPartenaire() && S.paieEtape !== 3 && S.paieEtape !== 2){
    vue().innerHTML = `
    <div class="pad">
      <button class="retourhaut" data-go="abonnement">Retour</button>
      <h1 class="titre">Votre abonnement</h1>
      <div class="carte" style="margin:12px 0 16px">
        <div class="mat"><div class="nom">${E(f.n)}<em>${E(f.per)}, sans renouvellement automatique</em></div><div class="val num" style="white-space:nowrap">${E(f.prix)}</div></div>
      </div>
      <div class="carte" style="margin:0 0 16px">
        <div class="eyebrow">Comment payer</div>
        <ol style="margin:10px 0 0;padding-left:20px;line-height:1.6;font-size:14.5px">
          <li><b>Écrivez à ${E(S.regleP.nom)}</b> sur WhatsApp : il vous indique où envoyer ${E(f.prix)}.</li>
          <li><b>Payez</b>, puis gardez le message de confirmation.</li>
          <li><b>Revenez ici</b> et envoyez votre capture : c'est elle qui active votre abonnement.</li>
        </ol>
      </div>
      ${blocConseiller(f.cle, 'paiement')}
      <button class="cta" style="margin-top:12px" data-paiefin="1">J'ai payé : envoyer ma capture<small>Obligatoire pour activer l'abonnement</small></button>
    </div>`;
    return;
  }

  /* Étape 3 : la capture du paiement, dans l'application ou par WhatsApp. */
  if(S.paieEtape === 3){
    const msgWa = 'Bonjour, j\'ai payé l\'' + f.n + ' (' + f.prix + ') par ' + O.nom + '. Mon numéro de compte Mon Concours : ' + ((S.util && S.util.tel) || S.paieTel) + '. Je vous envoie ma capture.';
    vue().innerHTML = `
    <div class="pad">
      <button class="retourhaut" data-paieretour="1">Retour</button>
      <h1 class="titre">Envoyez la capture<br>de votre paiement</h1>
      <p class="sous" style="margin:10px 0 18px">${paiementParPartenaire() ? 'Capture d\'écran du message qui confirme votre paiement de ' + f.prix + '. Elle est obligatoire : sans elle, votre paiement ne peut pas être vérifié.' : 'Capture d\'écran du message ' + O.nom + ' qui confirme votre paiement de ' + f.prix + '.'}</p>

      ${S.erreur ? `<div class="alerte" role="alert">${E(S.erreur)}</div>` : ''}

      ${!S.paievePreuve ? `
      <label class="depot-preuve" for="p-preuve">
        <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></svg>
        <b>Choisir ma capture d'écran</b>
        <span>JPEG ou PNG · 5 Mo maximum</span>
      </label>
      <input id="p-preuve" type="file" accept="image/*" style="display:none" onchange="choisirPreuve(this.files[0])">
      ` : `
      <div class="apercu-preuve">
        <img src="${S.paievePreuve.dataUrl}" alt="Aperçu de la capture de paiement">
      </div>
      <div class="rangee" style="margin-top:12px;gap:9px">
        <button class="cta creux" style="flex:1" data-preuve-modifier="1">Modifier</button>
        <button class="cta" style="flex:1" data-preuve-envoyer="1" ${S.paieEnvoi ? 'disabled' : ''}>${S.paieEnvoi ? 'Envoi…' : 'J\'ai payé : envoyer'}</button>
      </div>
      `}
      <a class="cta creux" style="margin-top:12px;display:block;text-align:center;text-decoration:none"
         href="https://wa.me/226${paiementParPartenaire() ? numeroConseiller() : CONTACT.adminTel}?text=${encodeURIComponent(msgWa)}" target="_blank" rel="noopener" data-pister-wa="capture">
         ${ico('partage',16)} ${paiementParPartenaire() ? 'Envoyer aussi ma capture à ' + E(S.regleP.nom) : 'Envoyer ma capture par WhatsApp'}<small>${paiementParPartenaire() ? 'Votre conseiller la reçoit. La capture dans l\'application reste obligatoire.' : 'Si l\'envoi dans l\'application est lent'}</small></a>
      ${paiementObligatoire() ? '' : blocAlternatives(f.cle)}
    </div>`;
    return;
  }

  /* Étape 2 : la demande est enregistrée, le serveur la vérifie. */
  if(S.paieEtape === 2){
    vue().innerHTML = `
    <div class="pad" style="padding-top:44px;text-align:center">
      <div class="cachet-note" style="max-width:230px">
        <div class="n" style="font-size:34px">…</div>
        <div class="l">capture reçue</div>
      </div>
      <h1 class="titre" style="font-size:24px">Votre paiement est en<br>cours de vérification</h1>
      <p class="sous" style="margin:12px 0 6px">Nous vérifions votre capture : validation souvent en quelques minutes. Vous recevrez une notification : paiement confirmé, ou rejeté avec la raison.</p>
      <p class="sous" style="margin:0 0 6px">Tu veux aller plus vite ? <a href="tel:+226${numeroConseiller()}" data-pister-appel="1">Appelle le +226 ${fmtTel(numeroConseiller())}</a> pour signaler ton paiement.</p>
      <div class="carte" style="margin-top:16px;text-align:left">
        <div class="mat"><div class="nom">Moyen de paiement<em>${O.nom} · au +226 ${E(S.paieTel)}</em></div><div class="val">✓</div></div>
        <div class="mat"><div class="nom">Abonnement demandé<em>${f.n} · ${f.per}</em></div><div class="val num">${f.prix}</div></div>
      </div>
      ${paiementObligatoire() ? '<button class="cta" style="margin-top:18px" data-go="abonnement">Voir l\'état de mon paiement</button>' : `<button class="cta" style="margin-top:18px" data-go="revisions">Ouvrir mes révisions</button>
      <button class="cta creux" style="margin-top:9px" data-go="compte">Retour à mon compte</button>`}
    </div>`;
    return;
  }

  /* Étape 1 : où envoyer l'argent. */
  if(S.paieEtape === 1){
    vue().innerHTML = `
    <div class="pad" style="padding-top:40px;text-align:center">
      <h1 class="titre" style="font-size:22px">Payez ${f.prix}<br>par ${O.nom}</h1>
      <p class="sous" style="margin:12px 0 18px">Envoyez ${f.prix} au numéro ci-dessous, depuis le ${E(S.paieTel)}. Gardez le message de confirmation : vous en aurez besoin juste après.</p>
      <div class="ussd">
        <div class="eyebrow">numéro à créditer</div>
        <div class="code">+226 ${fmtTel(numPaie(op))}</div>
        <button class="mini" style="margin-top:8px" data-copier-num="${E(numPaie(op))}">Copier le numéro</button>
      </div>
      <button class="cta" style="margin-top:18px" data-paiefin="1">J'ai payé<small>Je vais envoyer ma capture</small></button>
      <a class="cta creux" style="margin-top:10px;display:block;text-decoration:none" href="https://wa.me/226${numeroConseiller()}?text=${encodeURIComponent(messageConseiller(f.cle))}" target="_blank" rel="noopener" data-conseiller-wa="paiement-etape1" data-conseiller-formule="${E(f.cle)}">${logoReseau('whatsapp')} Un souci pour envoyer l'argent ?<small>Un conseiller vous guide sur WhatsApp</small></a>
      <button class="lien" data-paieannul="1">Annuler</button>
      ${paiementObligatoire() ? '' : blocAlternatives(f.cle)}
    </div>`;
    return;
  }

  /* Étape 0, paiement direct mis de côté : un seul chemin, le conseiller. */
  if(!CONTACT.paiementDirect && !paiementObligatoire()){
    vue().innerHTML = `
    <div class="pad">
      <button class="retourhaut" data-go="abonnement">Retour</button>
      <h1 class="titre">Paiement</h1>
      <p class="sous" style="margin:8px 0 18px">${f.n} · ${f.prix} pour ${f.per}. Sans renouvellement automatique.</p>
      <div class="carte" style="margin:0 0 16px">
        <div class="mat"><div class="nom">${f.n}<em>${f.per}</em></div><div class="val num" style="white-space:nowrap">${f.prix}</div></div>
      </div>
      ${blocConseiller(f.cle, 'paiement')}
      <p class="sous" style="margin:12px 0 0;text-align:center;font-size:12.5px">Un conseiller vous répond sur WhatsApp, vous explique comment payer et active votre abonnement.</p>
      ${blocAlternatives(f.cle)}
    </div>`;
    return;
  }

  /* Étape 0 : moyen de paiement, numéro, nom du compte. */
  vue().innerHTML = `
  <div class="pad">
    <button class="retourhaut" data-go="abonnement">Retour</button>
    <h1 class="titre">Paiement</h1>
    <p class="sous" style="margin:8px 0 18px">${f.n} · ${f.prix} pour ${f.per}. Sans renouvellement automatique.</p>

    ${S.erreur ? `<div class="alerte" role="alert">${E(S.erreur)}</div>` : ''}

    ${blocConseiller(f.cle, 'paiement')}
    <div class="libelle">Moyen de paiement</div>
    ${Object.keys(OPERATEURS).map(k => `
    <button class="operateur ${op === k ? 'on' : ''}" data-operateur="${k}" aria-pressed="${op === k}">
      <span class="pastille ${OPERATEURS[k].cls}">${OPERATEURS[k].pastille}</span><span><b>${OPERATEURS[k].nom}</b><span>${op === k ? 'Sélectionné' : 'Toucher pour choisir'}</span></span></button>`).join('')}

    <div class="champ" style="margin-top:16px">
      <label for="p-tel">Numéro ${O.nom}</label>
      <div class="prefixe"><span class="ind">+226</span>
        <input id="p-tel" type="tel" inputmode="numeric" maxlength="8" value="${E(S.paieTel)}" placeholder="70 00 00 00" oninput="majPaieTel(this.value)">
      </div>
      <div class="aide">Le numéro qui va effectuer la transaction.</div>
    </div>

    <div class="champ" style="margin-top:12px">
      <label for="p-nom">Nom du compte</label>
      <input id="p-nom" type="text" value="${E(S.paieNomCompte)}" placeholder="Nom sur le compte ${O.nom}" oninput="majPaieNom(this.value)">
      <div class="aide">Le nom associé au numéro qui paie, pour retrouver votre transaction.</div>
    </div>

    <div class="carte" style="margin-top:16px">
      <div class="mat"><div class="nom">${f.n}<em>${f.per}</em></div><div class="val num" style="white-space:nowrap">${f.prix}</div></div>
      <div class="mat"><div class="nom" style="font-weight:600">Total à payer</div><div class="val num" style="color:var(--craie);white-space:nowrap">${f.prix}</div></div>
    </div>

    <button class="cta vert" style="margin-top:16px" data-payer="1">Continuer<small>${f.prix} par ${O.nom}</small></button>
    ${paiementObligatoire() ? '' : blocAlternatives(f.cle)}
  </div>`;
}

/* =====================================================================
   MES RÉVISIONS — QCM par matière
   ===================================================================== */
const PROGRAMME = {
  'Troisième':'Programme du BEPC · concours de niveau troisième',
  'Terminale':'Programme du baccalauréat · concours de niveau terminale',
  'Licence':'Programme supérieur · concours de niveau licence'
};
const SIGLE = { 'Français':'FR', 'Mathématiques':'MA', 'Sciences de la vie et de la Terre':'SVT', 'Sciences de la vie':'SVT', 'Sciences physiques':'PC',
  'Histoire':'HI', 'Géographie':'GE', 'Culture générale':'CG', 'Institutions et AES':'IN',
  'Géopolitique':'GP', 'Droit':'DR', 'Économie':'EC', 'Tests psychotechniques':'PT' };
const sigle = nom => SIGLE[nom] || (nom || '?').slice(0, 2).toUpperCase();

const LIMITE_MATIERE = 15;
function ecranRevisions(){
  if(!S.banque && S.banqueEtat !== 'chargement') chargerQuestions();
  if((S.ressources === null || S.ressources === undefined) && !S.ressourcesEnCours) chargerRessources();
  chargerLectures();
  const banque = S.banque || [];
  const total = banque.reduce((a, m) => a + m.questions.length, 0);
  const prog = S.progression || {};
  const lus = S.lus || [];
  /* une seule liste : chaque matière avec son cours et ses QCM */
  const mats = [];
  banque.forEach(m => mats.push(m.nom));
  (S.ressources || []).filter(r => r.type_ressource !== 'annale' && r.matiere !== 'Autres documents')
    .forEach(r => { if(!mats.includes(r.matiere)) mats.push(r.matiere); });
  const limiteMatiere = S.util.connecte && !S.gratuit && !estAbonne();
  vue().innerHTML = `
  <div class="pad">
    <div class="eyebrow">Mes cours</div>
    <h1 class="titre">Cours et QCM</h1>

    <div class="niveaux" role="group" aria-label="Niveau" style="margin-top:16px">
      ${['Troisième','Terminale','Licence'].map(n=>`<button class="${S.niveau===n?'on':''}" data-niv="${n}" aria-pressed="${S.niveau===n}">${n}</button>`).join('')}
    </div>

    <div class="bandeau-niveau reveal" key="${S.niveau}">
      <div><b>${PROGRAMME[S.niveau]}</b>
        <span>${S.banqueEtat === 'pret' ? `${mats.length} matière${mats.length>1?'s':''} · <span class="num">${total.toLocaleString('fr-FR')}</span> question${total>1?'s':''} à ce niveau` : 'Chargement…'}</span></div>
      <span class="tampon t-ok">${S.niveau}</span>
    </div>
    ${carteHorsLigne()}

    ${S.banqueEtat === 'erreur' ? `<div class="carte"><p class="sous">La banque de questions n'a pas pu être chargée. Vérifiez votre connexion et revenez sur cet écran.</p></div>` : ''}
    ${S.banqueEtat === 'pret' && !mats.length ? `<div class="carte"><p class="sous">Rien n'est encore publié pour ce niveau. La banque se remplit au fur et à mesure des validations.</p></div>` : ''}

    <div class="reveal" id="listecours">
    ${mats.map(nom => {
      const m = banque.find(x => x.nom === nom);
      const nb = m ? m.questions.length : 0, p = prog[nom];
      const faites = p ? Math.min(p.faites, nb) : 0;
      const pc = nb ? Math.round(faites / nb * 100) : 0;
      const chap = (S.ressources || []).filter(r => r.matiere === nom && r.texte && r.type_ressource !== 'annale');
      const fich = (S.ressources || []).filter(r => r.matiere === nom && r.fichier_chemin && r.type_ressource !== 'annale');
      const nLus = chap.filter(r => lus.includes(r.id)).length;
      return `<div class="mat-rev">
        <div class="mr-tete">
          <span class="ic">${E(sigle(nom))}</span>
          <div class="mr-co"><b>${E(nom)}</b>
            ${nb ? `<span class="bar"><i style="width:${pc}%"></i></span>
            <span class="pc">${faites} sur ${nb} question${nb>1?'s':''} travaillée${nb>1?'s':''}${p && p.faites ? ' · ' + Math.round(100 * p.reussies / Math.max(1, p.faites)) + ' % de réussite' : ''}</span>
            ${limiteMatiere ? `<span class="pc gratuit-reste">${faites >= LIMITE_MATIERE ? 'Abonnement gratuit terminé' : 'Gratuit : ' + faites + ' sur ' + LIMITE_MATIERE + ' questions'}</span>` : ''}` : ''}
            ${chap.length ? `<span class="pc">${chap.length} chapitre${chap.length>1?'s':''} de cours${S.util.connecte ? ' · ' + nLus + ' lu' + (nLus>1?'s':'') : ''}</span>` : ''}
          </div>
        </div>
        <div class="mr-actions">
          ${chap.length ? `<button data-matiere="${encodeURIComponent(nom)}">${ico('lire',16)}<span>${lecturePos()[nom] ? 'Reprendre le cours' : 'Lire le cours'}</span></button>` : ''}
          ${nb ? (limiteMatiere && faites >= LIMITE_MATIERE
            ? `<button class="plein verrou" data-abo-matiere="${E(nom)}">${ico('cadenas',16)}<span>Débloquer la suite</span></button>`
            : `<button class="plein" data-mat="${E(nom)}">${ico('revisions',16)}<span>${faites > 0 ? 'Continuer' : 'Faire les QCM'}</span></button>`) : ''}
        </div>
      </div>`;
    }).join('')}
    </div>

    <button class="lien-mini" style="margin-top:14px" data-go="cours">${ico('lire',13)} Anciens sujets et recherche dans les cours</button>
    ${!S.util.connecte ? `<div class="carte" style="margin-top:12px">
      <p class="sous">${S.gratuit ? "Sans compte, tu peux lire les questions. Pour voir la correction et garder tes erreurs, crée ton compte : c'est gratuit." : "Sans compte, tu peux lire les questions. Pour voir la correction, crée ton compte gratuit : 5 corrections par jour, sans limite avec l'abonnement."}</p>
    </div>` : (!S.abo.actif && !S.gratuit ? `<div class="carte" style="margin-top:12px">
      <p class="sous">Abonnement gratuit : 5 corrections par jour, 15 questions par matière et ${compoOffertes()} compositions offertes. L'abonnement payant les rend illimitées.</p>
    </div>` : '')}
  </div>`;
}

/* Télécharger le cours d'une matière : le texte mis en page, prêt pour le PDF */
function telechargerCoursMatiere(nom){
  const chap = (S.ressources || []).filter(r => r.matiere === nom && r.texte && r.type_ressource !== 'annale');
  const fich = (S.ressources || []).filter(r => r.matiere === nom && r.fichier_chemin && r.type_ressource !== 'annale');
  if(!chap.length){
    if(fich.length === 1) return telechargerRessource(fich[0].id);
    return aller('cours');
  }
  pister('COURSE_DOWNLOADED', { matiere: nom });
  return sortirDocument('Cours ' + nom + ' ' + S.niveau, () => docComplet(nom + ' · Mon Concours',
    'h1{font-size:24px;margin:18px 0 4px}.chap{font-size:17px;margin:26px 0 6px;border-bottom:1px solid #111;padding-bottom:3px;letter-spacing:0;text-transform:none}' +
    '.som{font-size:13px}.som li{margin:2px 0}h3{font-size:14px;letter-spacing:.06em;margin:14px 0 4px}p{margin:6px 0;font-size:13.5px}li{font-size:13.5px}' +
    '.formule{font-family:"Courier New",monospace;background:#f4f1ea;padding:4px 8px}.niv{font:11px Helvetica,Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#555;margin-top:14px}',
    docEntete('Scannez pour lire tous les cours') +
    '<div class="niv">Cours · ' + E(S.niveau) + '</div><h1>' + E(nom) + '</h1>' +
    '<ol class="som">' + chap.map(r => '<li>' + E(r.titre) + '</li>').join('') + '</ol>' +
    chap.map((r, i) => '<h2 class="chap">' + (i + 1) + '. ' + E(r.titre) + '</h2>' + miseEnPage(r.texte)).join('') +
    docPied()));
}

/* --- les fascicules de cours --- */
let minuteurRecherche = null;
window.filtrerCours = function(v){
  S.rechercheCours = v;
  clearTimeout(minuteurRecherche);
  minuteurRecherche = setTimeout(() => {
    if(S.ecran !== 'cours') return;
    const champ = document.getElementById('rech-cours');
    const pos = champ ? champ.selectionStart : null;
    ecranCours();
    const neuf = document.getElementById('rech-cours');
    if(neuf){ neuf.focus(); if(pos !== null) try{ neuf.setSelectionRange(pos, pos); }catch(e){} }
  }, 180);
};

const tailleFr = o => o >= 1048576 ? (o / 1048576).toFixed(1).replace('.', ',') + ' Mo' : Math.max(1, Math.round(o / 1024)) + ' Ko';
function ecranCours(){
  const q = (S.rechercheCours || '').trim().toLowerCase();
  const dispo = !q ? S.ressources : (S.ressources || []).filter(r =>
    ((r.titre || '') + ' ' + (r.matiere || '') + ' ' + (r.theme || '') + ' ' + (r.texte || ''))
      .toLowerCase().includes(q));
  const parMatiere = {};
  const ordreMatieres = [];                 /* on garde l'ordre du programme */
  const annales = (dispo || []).filter(r => r.type_ressource === 'annale');
  (dispo || []).filter(r => r.type_ressource !== 'annale').forEach(r => {
    const m = r.matiere || 'Autres documents';
    if(!parMatiere[m]){ parMatiere[m] = []; ordreMatieres.push(m); }
    parMatiere[m].push(r);
  });
  const TYPES = { cours:'Cours', exercices:'Exercices', corrige:'Corrigé',
                  fiche:'Fiche de révision', annale:'Ancien sujet', autre:'Document' };

  vue().innerHTML = `
  <div class="pad">
    <button class="retourhaut" data-go="revisions">Retour</button>
    <h1 class="titre">Les cours</h1>
    <p class="sous" style="margin:8px 0 16px">Les documents au programme ${S.niveau.toLowerCase()}. Ils restent lisibles sans connexion : le téléphone les garde dès que vous êtes en ligne.</p>

    <div class="champ" style="margin-bottom:12px">
      <input id="rech-cours" type="search" inputmode="search" value="${E(S.rechercheCours)}"
        placeholder="Chercher un cours, un chapitre, un mot…"
        aria-label="Rechercher dans les cours"
        oninput="filtrerCours(this.value)" autocomplete="off">
    </div>
    ${q ? `<p class="sous" style="margin:-4px 0 12px">${(dispo||[]).length} résultat${(dispo||[]).length>1?'s':''} pour « ${E(S.rechercheCours)} » · <button class="lien" style="display:inline" onclick="filtrerCours('')">effacer</button></p>` : ''}

    <div class="niveaux" role="group" aria-label="Niveau">
      ${['Troisième','Terminale','Licence'].map(n=>`<button class="${S.niveau===n?'on':''}" data-niv="${n}" aria-pressed="${S.niveau===n}">${n}</button>`).join('')}
    </div>

    ${S.erreurCours ? `<div class="carte" style="border-color:var(--rouge-bord);background:var(--rouge-fond)"><p class="sous">${E(S.erreurCours)}</p></div>` : ''}

    ${annales.length ? `<div class="carte cours-mat annales">
      <div class="cm-tete"><h2>Annales officielles</h2><span class="num">${annales.length}</span></div>
      <p class="cm-prog">Les vrais sujets des sessions passées, séparés des sujets d'entraînement.</p>
      ${annales.map(r => r.texte
        ? `<button class="lien" style="display:block;text-align:left;padding:7px 0" data-lire="${r.id}">${E(r.titre)}${r.matiere ? ' · ' + E(r.matiere) : ''}</button>`
        : `<div class="fascicule"><div class="ligne1"><span class="ic">PDF</span><div class="co"><b>${E(r.titre)}</b><span>${r.taille_octets ? tailleFr(r.taille_octets) : 'Document'}</span></div></div>
            <div class="paire"><button class="mini" data-telecharger="${r.id}">Télécharger</button></div></div>`).join('')}
    </div>` : ''}
    ${dispo === null
      ? `<div class="carte"><p class="sous">Chargement de la bibliothèque…</p></div>`
      : !dispo.length
        ? `<div class="carte"><p class="sous">Aucun document n'est encore disponible pour ce niveau. Reviens bientôt : la bibliothèque se remplit au fur et à mesure.</p></div>`
        : ordreMatieres.map(m => `
          <div class="carte cours-mat">
            <div class="cm-tete"><h2>${E(m)}</h2><span class="num">${parMatiere[m].length} partie${parMatiere[m].length>1?'s':''}</span></div>
            <p class="cm-prog">${
              parMatiere[m].slice(0,4).map(r => E(r.titre)).join(' · ')
            }${parMatiere[m].length > 4 ? ' · et ' + (parMatiere[m].length - 4) + ' autre' + (parMatiere[m].length-4>1?'s':'') : ''}</p>
            <div class="cm-actions">
              <button class="cta" data-matiere="${encodeURIComponent(m)}">${ico('lire',17)}Lire le cours</button>
              <button class="cta creux" data-cible="${E(m)}">${ico('revisions',17)}Faire les QCM</button>
            </div>
            ${parMatiere[m].filter(r => r.fichier_chemin && !r.texte).map(r => `
              <div class="fascicule">
                <div class="ligne1"><span class="ic">PDF</span>
                  <div class="co"><b>${E(r.titre)}</b><span>Document à télécharger${r.taille_octets ? ' · ' + tailleFr(r.taille_octets) : ''}</span></div></div>
                <div class="paire"><button class="mini" data-telecharger="${r.id}">Télécharger</button></div>
              </div>`).join('')}
          </div>`).join('')}
  </div>`;
}

/* Met en forme le texte brut d'un cours : titres de section, listes
   numerotees, formules isolees. Le candidat doit lire sans effort. */
function miseEnPage(texte){
  const estTitre = l => l.length < 70 && /[A-ZÀ-ÞŒ]/.test(l) && l === l.toUpperCase();
  const html = [];
  let liste = [], ouvert = false;
  const viderListe = () => {
    if(liste.length){ html.push('<ol>' + liste.join('') + '</ol>'); liste = []; }
  };
  const fermerBloc = () => { viderListe(); if(ouvert){ html.push('</div>'); ouvert = false; } };
  (texte || '').split('\n').forEach(brut => {
    const l = brut.trim().replace(/</g,'&lt;');
    if(!l){ viderListe(); return; }
    if(estTitre(l)){
      fermerBloc();
      const type = /CONCOURS|BEPC|BAC/.test(l) ? 'cible'
        : /EXEMPLE|APPLICATION|EXERCICE/.test(l) ? 'exemple'
        : /PIÈGE|PIEGE|ERREUR|ATTENTION|CONFUSION/.test(l) ? 'piege'
        : /RETENIR|ESSENTIEL|RÉSUMÉ|RESUME|MÉTHODE|METHODE|ASTUCE|RÈGLE|REGLE|DÉFINITION|DEFINITION/.test(l) ? 'retenir' : '';
      html.push('<div class="bloc' + (type ? ' bloc-' + type : '') + '"><h3>' + l + '</h3>');
      ouvert = true;
      return;
    }
    const num = l.match(/^(\d+)\.\s+(.*)$/);
    if(num){ liste.push('<li>' + num[2] + '</li>'); return; }
    viderListe();
    if(l.length <= 46 && / = /.test(l)){ html.push('<div class="formule">' + l + '</div>'); return; }
    html.push('<p>' + l + '</p>');
  });
  fermerBloc();
  return html.join('');
}

/* =====================================================================
   PARTAGE
   ===================================================================== */
function texteDePartage(quoi){
  if(quoi === 'performance' && S.classement)
    return `Je suis ${nombreFr(S.classement.rang)}e sur ${nombreFr(S.classement.population)} candidats sur Mon Concours, avec ${nombreFr(S.classement.points)} points. Prépare les concours directs avec moi.`;
  if(quoi === 'cours' && S.matiereOuverte)
    return `Je révise ${S.matiereOuverte} sur Mon Concours, pour les concours directs du Burkina Faso.`;
  return "Mon Concours : révisions, compositions et cahier d'erreurs pour les concours directs du Burkina Faso.";
}

/* Feuille de partage : les vrais logos, pas un bouton anonyme. */
/* Feuille des notifications : la cloche l'ouvre, une par une ou tout
   marquer comme lu. Le badge se vide dès l'ouverture d'une ligne. */
const ICONE_NOTIF = { resultat:'grille', paiement:'carte', nouveau_cours:'revisions', rappel:'cloche', motivation:'cloche', faiblesse:'erreurs', securite:'cadenas', defi:'duel', progression:'diagnostic', installation:'telecharger', communaute:'coeur', annonce_plein:'groupe' };

function relatif(iso){
  const d = Date.now() - new Date(iso).getTime();
  const min = Math.floor(d / 60000);
  if(min < 1) return "à l'instant";
  if(min < 60) return 'il y a ' + min + ' min';
  const h = Math.floor(min / 60);
  if(h < 24) return 'il y a ' + h + 'h';
  const j = Math.floor(h / 24);
  if(j < 7) return 'il y a ' + j + ' j';
  return new Date(iso).toLocaleDateString('fr-FR', { day:'numeric', month:'short' });
}

function ouvrirNotifications(sansAuto){
  S.modal = 'notifications';
  document.getElementById('voile').hidden = false;
  const liste = S.notifications;
  document.getElementById('voile').innerHTML = `
  <div class="panneau" role="dialog" aria-modal="true" aria-label="Notifications">
    <div class="poignee"></div>
    <div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:4px">
      <h3 style="margin:0">Notifications</h3>
    </div>
    ${liste.length ? `<div class="notif-outils">
      ${liste.some(n=>!n.lue) ? `<button class="no-btn" data-notifs-tout="1">${ico('coche',15)}<span>Tout marquer comme lu</span></button>` : ''}
      <button class="no-btn no-danger" data-notifs-vider="1">${ico('corbeille',15)}<span>Tout supprimer</span></button>
    </div>` : ''}
    ${!liste.length ? `
    <p class="sous" style="margin:18px 0">Rien pour le moment. Vos résultats et rappels apparaîtront ici.</p>
    ` : `
    <div style="max-height:56vh;overflow-y:auto;margin-top:10px">
      ${liste.map(n => `
        <button class="notif-ligne ${n.lue?'':'non-lue'}" data-notif-lire="${n.id}">
          <span class="ic">${ico(ICONE_NOTIF[n.type] || 'cloche', 17)}</span>
          <span class="co">
            <b>${E(n.titre)}</b>
            <span>${E(n.message)}</span>
            <i>${relatif(n.cree_le)}</i>
          </span>
          ${!n.lue ? '<span class="point"></span>' : ''}
        </button>`).join('')}
    </div>`}
    <button class="cta creux" style="margin-top:14px" data-fermer-partage="1">Fermer</button>
  </div>`;
  if(sansAuto !== true && liste.some(n=>!n.lue)) setTimeout(() => { if(S.modal === 'notifications') marquerNotifsLues(null); }, 2500);
}

function ouvrirPartage(quoi){
  const t = texteDePartage(quoi), lien = CONTACT.site;
  const complet = encodeURIComponent(t + ' ' + lien);
  S.modal = 'partage';
  document.getElementById('voile').hidden = false;
  document.getElementById('voile').innerHTML = `
  <div class="panneau" role="dialog" aria-modal="true" aria-label="Partager">
    <div class="poignee"></div>
    <h3 style="margin:0 0 4px">Partager</h3>
    <p class="sous" style="margin:0 0 14px">${E(t)}</p>

    ${S.util.connecte ? `<button class="pt-comm" data-cm-partager="${E(quoi)}">
      <span class="ic">${ico('groupe',22)}</span>
      <span class="tx"><b>Dans la communauté Mon Concours</b><small>Montrez-le aux autres candidats</small></span>
      <i aria-hidden="true">→</i></button>` : ''}

    <div class="partages">
      <a class="pt wa" href="https://wa.me/?text=${complet}" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.48-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.14-.14.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35z"/><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.86 9.86 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91A9.85 9.85 0 0 0 12.04 2zm0 18.02h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.37c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.82 2.42a8.16 8.16 0 0 1 2.41 5.82c0 4.54-3.69 8.22-8.24 8.22z"/></svg>
        <span>WhatsApp</span></a>

      <a class="pt fb" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(lien)}&quote=${encodeURIComponent(t)}" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true"><path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.5-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.45 2.91h-2.33V22c4.78-.76 8.44-4.92 8.44-9.94z"/></svg>
        <span>Facebook</span></a>

      <button class="pt cp" data-copier="${encodeURIComponent(t + ' ' + lien)}">
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>
        <span>Copier</span></button>

      <button class="pt au" data-partage-natif="${quoi}">
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>
        <span>Autre</span></button>
    </div>

    <button class="cta creux" style="margin-top:14px" data-fermer-partage="1">Fermer</button>
  </div>`;
  pister('SHARE_OPENED', { quoi });
}

async function partager(quoi){
  let titre = 'Mon Concours', texte = '';
  if(quoi === 'performance' && S.classement){
    texte = `Je suis ${nombreFr(S.classement.rang)}ᵉ sur ${nombreFr(S.classement.population)} candidats sur Mon Concours, `
          + `avec ${nombreFr(S.classement.points)} points. Prépare les concours directs avec moi.`;
  } else if(quoi === 'cours' && S.matiereOuverte){
    texte = `Je révise ${S.matiereOuverte} sur Mon Concours, pour les concours directs du Burkina Faso.`;
  } else {
    texte = 'Mon Concours : révisions, compositions et cahier d\'erreurs pour les concours directs du Burkina Faso.';
  }
  const charge = { title: titre, text: texte, url: CONTACT.site };
  pister('SHARE', { quoi });
  try{
    if(navigator.share){ await navigator.share(charge); return; }
  }catch(e){ return; }
  try{
    await navigator.clipboard.writeText(texte + ' ' + CONTACT.site);
    toast('Lien copié. Collez-le où vous voulez.');
  }catch(e){
    window.open('https://wa.me/?text=' + encodeURIComponent(texte + ' ' + CONTACT.site), '_blank');
  }
}

/* =====================================================================
   FEUILLE DE COMPOSITION À GARDER
   Une page propre, en-tête au nom du candidat, note et date. Le
   navigateur l'enregistre en PDF : aucune bibliothèque à télécharger,
   ce qui compte quand le réseau est faible.
   ===================================================================== */
/* QR code vers le site, calculé une fois pour toutes (rien à charger) :
   une feuille imprimée ou partagée amène directement sur Mon Concours. */
const QR_FEUILLE = '<svg width="78" height="78" aria-label="QR code vers monconcoursbf.com" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 31 31" shape-rendering="crispEdges"><path fill="#ffffff" d="M0 0h31v31H0z"/><path stroke="#111111" d="M1 1.5h7M12 1.5h1M17 1.5h4M23 1.5h7M1 2.5h1M7 2.5h1M10 2.5h1M14 2.5h1M16 2.5h1M18 2.5h1M21 2.5h1M23 2.5h1M29 2.5h1M1 3.5h1M3 3.5h3M7 3.5h1M9 3.5h3M17 3.5h2M20 3.5h2M23 3.5h1M25 3.5h3M29 3.5h1M1 4.5h1M3 4.5h3M7 4.5h1M13 4.5h3M17 4.5h1M19 4.5h2M23 4.5h1M25 4.5h3M29 4.5h1M1 5.5h1M3 5.5h3M7 5.5h1M9 5.5h2M12 5.5h1M15 5.5h1M19 5.5h1M23 5.5h1M25 5.5h3M29 5.5h1M1 6.5h1M7 6.5h1M9 6.5h2M14 6.5h2M19 6.5h2M23 6.5h1M29 6.5h1M1 7.5h7M9 7.5h1M11 7.5h1M13 7.5h1M15 7.5h1M17 7.5h1M19 7.5h1M21 7.5h1M23 7.5h7M11 8.5h1M13 8.5h1M18 8.5h4M2 9.5h1M5 9.5h1M7 9.5h1M9 9.5h1M12 9.5h1M15 9.5h1M17 9.5h1M19 9.5h1M21 9.5h2M24 9.5h2M27 9.5h1M1 10.5h1M3 10.5h3M9 10.5h2M12 10.5h1M16 10.5h2M20 10.5h2M23 10.5h7M4 11.5h1M6 11.5h2M9 11.5h4M14 11.5h1M16 11.5h1M22 11.5h1M24 11.5h2M27 11.5h1M29 11.5h1M2 12.5h4M14 12.5h1M16 12.5h1M18 12.5h2M22 12.5h1M25 12.5h2M28 12.5h2M1 13.5h3M6 13.5h2M10 13.5h1M12 13.5h1M14 13.5h5M20 13.5h2M24 13.5h1M29 13.5h1M2 14.5h3M10 14.5h1M13 14.5h2M16 14.5h4M23 14.5h1M25 14.5h1M27 14.5h3M1 15.5h1M3 15.5h2M7 15.5h9M17 15.5h1M19 15.5h1M21 15.5h3M25 15.5h1M29 15.5h1M2 16.5h2M8 16.5h2M11 16.5h2M14 16.5h1M16 16.5h1M21 16.5h1M24 16.5h1M26 16.5h1M29 16.5h1M1 17.5h2M4 17.5h2M7 17.5h1M11 17.5h1M13 17.5h3M17 17.5h1M21 17.5h2M28 17.5h1M1 18.5h1M3 18.5h1M6 18.5h1M10 18.5h2M14 18.5h1M18 18.5h4M23 18.5h1M25 18.5h3M29 18.5h1M3 19.5h1M5 19.5h3M11 19.5h1M13 19.5h4M19 19.5h1M21 19.5h1M24 19.5h4M29 19.5h1M3 20.5h4M8 20.5h2M11 20.5h3M16 20.5h4M21 20.5h1M26 20.5h1M29 20.5h1M1 21.5h3M7 21.5h1M9 21.5h1M13 21.5h1M18 21.5h1M21 21.5h6M29 21.5h1M9 22.5h1M13 22.5h1M16 22.5h2M19 22.5h3M25 22.5h1M27 22.5h3M1 23.5h7M10 23.5h1M14 23.5h1M16 23.5h1M18 23.5h1M20 23.5h2M23 23.5h1M25 23.5h1M29 23.5h1M1 24.5h1M7 24.5h1M11 24.5h2M15 24.5h1M17 24.5h5M25 24.5h2M1 25.5h1M3 25.5h3M7 25.5h1M9 25.5h3M13 25.5h3M19 25.5h7M28 25.5h2M1 26.5h1M3 26.5h3M7 26.5h1M10 26.5h1M12 26.5h2M17 26.5h2M24 26.5h1M26 26.5h3M1 27.5h1M3 27.5h3M7 27.5h1M10 27.5h2M13 27.5h3M17 27.5h1M19 27.5h4M27 27.5h3M1 28.5h1M7 28.5h1M9 28.5h7M18 28.5h1M21 28.5h1M24 28.5h1M26 28.5h1M28 28.5h2M1 29.5h7M10 29.5h1M13 29.5h2M16 29.5h1M18 29.5h1M21 29.5h3M25 29.5h2M28 29.5h1"/></svg>';

/* =====================================================================
   ANIMATIONS
   Courtes, utiles, coupées si le téléphone demande moins d'animations
   ou si le candidat les désactive dans Apparence.
   ===================================================================== */
const animOk = () => !S.sansAnim && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const dejaAnime = new Set();
function uneFois(cle){ if(dejaAnime.has(cle)) return false; dejaAnime.add(cle); return true; }
function compterJusqua(el, cible, duree){
  if(!el || !animOk()) return;
  const debut = performance.now(), suffixe = el.dataset.suffixe || '';
  const pas = now => {
    const k = Math.min(1, (now - debut) / duree), e = 1 - Math.pow(1 - k, 3);
    el.textContent = Math.round(cible * e) + suffixe;
    if(k < 1) requestAnimationFrame(pas);
  };
  el.textContent = '0' + suffixe; requestAnimationFrame(pas);
}
function confettis(zone){
  if(!animOk() || !zone) return;
  const cv = document.createElement('canvas');
  cv.className = 'confettis'; cv.setAttribute('aria-hidden', 'true');
  zone.style.position = zone.style.position || 'relative'; zone.appendChild(cv);
  const r = zone.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1), cx = cv.getContext('2d');
  cv.width = r.width * dpr; cv.height = r.height * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const couleurs = ['#E3A82B', '#0E7A54', '#4FC28F', '#EFE9DA', '#C2392E'];
  const parts = Array.from({ length: 60 }, () => ({ x: r.width / 2 + (Math.random() - .5) * 60, y: r.height * .4,
    vx: (Math.random() - .5) * 7, vy: -Math.random() * 7 - 3, a: Math.random() * 6, va: (Math.random() - .5) * .3,
    w: 5 + Math.random() * 4, h: 8 + Math.random() * 6, c: couleurs[Math.floor(Math.random() * couleurs.length)] }));
  const fin = performance.now() + 2400;
  const tour = now => {
    cx.clearRect(0, 0, r.width, r.height);
    parts.forEach(p => { p.vy += .18; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.a += p.va;
      cx.save(); cx.translate(p.x, p.y); cx.rotate(p.a); cx.fillStyle = p.c; cx.globalAlpha = Math.max(0, Math.min(1, (fin - now) / 800));
      cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); cx.restore(); });
    if(now < fin) requestAnimationFrame(tour); else cv.remove();
  };
  requestAnimationFrame(tour);
}
function animerApresRendu(){
  document.body.classList.toggle('sans-anim', !animOk());
  if(!animOk()) return;
  /* barres de niveau : elles se remplissent */
  document.querySelectorAll('.nd-barre i:not([data-vu])').forEach(i => {
    const w = i.style.width; i.dataset.vu = '1'; i.style.width = '0';
    requestAnimationFrame(() => requestAnimationFrame(() => { i.style.width = w; }));
  });
  /* copie corrigée : la note monte, puis le cachet se pose */
  const cachet = document.querySelector('.copie .cachet-note');
  if(cachet && S.ecran === 'copie' && uneFois('copie-' + (S.compositionId || S.derniereCompo || ''))){
    const n = cachet.querySelector('.n'), txt = n ? n.textContent : '';
    const m = txt.match(/^(\d+)\s*\/\s*(\d+)/);
    if(m){ n.dataset.suffixe = ' / ' + m[2]; compterJusqua(n, +m[1], 900); }
    cachet.classList.add('pose');
  }
  /* résultats de la composition nationale : podium, cachet, confettis pour les admis */
  if(S.ecran === 'gagnants' && S.classementEp && S.classementEp.termine && uneFois('res-' + S.classementEp.id)){
    const pod = document.querySelector('.podium'); if(pod) pod.classList.add('monte');
    const st = document.querySelector('.statut-nat'); if(st) st.classList.add('pose');
    const m = S.classementEp.moi;
    if(m && (m.statut === 'admis' || m.rang <= 3)) setTimeout(() => confettis(document.querySelector('.statut-nat') || pod), 700);
  }
  /* défi terminé : podium, confettis si premier */
  if(S.ecran === 'defi' && S.defi && S.defi.etat === 'resultat' && uneFois('defi-' + S.defi.id + '-' + (S.defi.participants || 0))){
    const pod = document.querySelector('.podium'); if(pod) pod.classList.add('monte');
    const moi = (S.defi.classement || []).find(l => l.moi);
    if(moi && moi.rang === 1 && (S.defi.classement || []).length > 1) setTimeout(() => confettis(pod), 700);
  }
}

/* =====================================================================
   DOCUMENTS TÉLÉCHARGÉS
   Un en-tête commun (logo, nom, site, QR, WhatsApp) et un vrai fichier
   PDF. Quand le téléphone le permet, il demande où l'enregistrer.
   ===================================================================== */
const fmtTel = t => t.replace(/(\d{2})(?=\d)/g, '$1 ');
const telAffiche = () => '+226 ' + fmtTel(CONTACT.adminTel) + ' · +226 ' + fmtTel(CONTACT.adminTel2);
const DOC_CSS = '@page{size:A4;margin:14mm}*{box-sizing:border-box}' +
  'body{font-family:Georgia,"Times New Roman",serif;color:#111;max-width:190mm;margin:0 auto;padding:0 10px;line-height:1.45;background:#fff}@media print{body{padding:0}}' +
  '.tete{display:flex;align-items:center;gap:14px;border-bottom:3px double #111;padding-bottom:12px;flex-wrap:wrap}' +
  '.marque .n{font-size:19px;font-weight:bold;letter-spacing:.04em}.marque .d{font-size:11px;color:#555;font-style:italic}' +
  '.marque .w{font:11px Helvetica,Arial,sans-serif;color:#111;margin-top:3px}' +
  '.sceau{width:52px;height:52px;border-radius:13px;background:#EDE4D3;border:1px solid #C9BEA9;display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:7px;flex:0 0 auto}' +
  '.sceau i{border-radius:50%;background:#FBFAF7;border:1px solid #C9BEA9}.sceau i:nth-child(2),.sceau i:nth-child(3){background:#1C1C1C;border-color:#1C1C1C}' +
  '.site{margin-left:auto;display:flex;align-items:center;gap:10px;text-align:right}.site .adr{font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:15px}' +
  '.site .sc{font-size:10.5px;color:#333;font-family:Helvetica,Arial,sans-serif}.site svg{display:block;border:1px solid #ccc}' +
  '.doc-titre{text-align:center;margin:18px 0 4px;font-size:19px;letter-spacing:.12em;text-transform:uppercase}.doc-st{text-align:center;font-size:13.5px;color:#333;margin:0}' +
  'h2{font-size:14px;letter-spacing:.18em;text-transform:uppercase;margin:18px 0 8px;border-bottom:1px solid #111;padding-bottom:4px;break-after:avoid}' +
  '.pied{margin-top:20px;border-top:2px solid #111;padding-top:8px;font-size:12px;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-family:Helvetica,Arial,sans-serif}' +
  '.filigrane{position:fixed;top:50%;left:50%;width:120mm;height:120mm;transform:translate(-50%,-50%) rotate(-12deg);opacity:.045;z-index:-1;pointer-events:none;display:grid;grid-template-columns:1fr 1fr;gap:9mm;padding:12mm;border-radius:28mm;background:#1C1C1C}' +
  '.filigrane i{border-radius:50%;background:#fff}' +
  '@media print{.noimp{display:none}}.noimp{text-align:center;margin:20px 0}.noimp button{font:inherit;padding:11px 22px;border:1px solid #111;background:#111;color:#fff;cursor:pointer}';
function docEntete(phraseQr){
  return '<div class="filigrane" aria-hidden="true"><i></i><i></i><i></i><i></i></div>' +
    '<div class="tete"><div class="sceau"><i></i><i></i><i></i><i></i></div>' +
    '<div class="marque"><div class="n">MON CONCOURS</div><div class="d">Préparation aux concours directs du Burkina Faso</div>' +
    '<div class="w">WhatsApp ' + telAffiche() + ' · difficulté, urgence ou recommandation</div></div>' +
    '<div class="site"><div><div class="adr">monconcoursbf.com</div><div class="sc">' + E(phraseQr || 'Scannez pour réviser gratuitement') + '</div></div>' + QR_FEUILLE + '</div></div>';
}
function docPied(){
  return '<div class="pied"><span><b>monconcoursbf.com</b> · WhatsApp <b>' + telAffiche() + '</b></span><span>Document établi le ' +
    new Date().toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' }) + '</span></div>';
}
function docComplet(titre, css, corps){
  return '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>' + E(titre) + '</title><style>' + DOC_CSS + (css || '') + '</style></head><body>' +
    corps + '<div class="noimp"><button onclick="window.print()">Enregistrer en PDF ou imprimer</button></div>' +
    '<scr' + 'ipt>setTimeout(function(){window.print();},600);<\/scr' + 'ipt></body></html>';
}

let libsPdf = null;
function chargerScript(src){
  return new Promise((ok, ko) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = ko; document.head.appendChild(s); });
}
function chargerLibsPdf(){
  if(!libsPdf) libsPdf = Promise.all([chargerScript('/lib/html2canvas-1.4.1.min.js'), chargerScript('/lib/jspdf-2.5.2.umd.min.js')])
    .catch(e => { libsPdf = null; throw e; });
  return libsPdf;
}
const nomFichier = t => (t || 'document').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 60) + '.pdf';

/* Le HTML du document devient un PDF de pages A4, coupées entre deux blocs
   (jamais au milieu d'une ligne), avec le pied Mon Concours sur chaque page. */
async function htmlVersPdf(html){
  await chargerLibsPdf();
  const ifr = document.createElement('iframe');
  ifr.setAttribute('aria-hidden', 'true');
  ifr.style.cssText = 'position:fixed;left:-12000px;top:0;width:794px;height:1123px;border:0;background:#fff';
  document.body.appendChild(ifr);
  try{
    const doc = ifr.contentDocument;
    doc.open();
    doc.write(html.replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace('</head>', '<style>.noimp,.filigrane{display:none!important}body{padding:22px 26px!important;max-width:none!important}</style></head>'));
    doc.close();
    await new Promise(r => setTimeout(r, 250));
    try{ await doc.fonts.ready; }catch(e){}
    const corps = doc.body;
    const largeur = 794;
    const hauteurTotale = Math.ceil(corps.scrollHeight);
    /* les endroits où l'on peut couper : sous chaque bloc */
    const bords = new Set(), forces = [];
    corps.querySelectorAll('*').forEach(el => {
      const st = doc.defaultView.getComputedStyle(el);
      if(st.display === 'inline' || st.position === 'fixed') return;
      const r = el.getBoundingClientRect();
      if(r.height > 0 && !el.closest('h1,h2,h3')) bords.add(Math.round(r.bottom + doc.defaultView.scrollY));
      if(el.classList.contains('saut-page')) forces.push(Math.round(r.top + doc.defaultView.scrollY));
    });
    const candidats = [...bords].sort((a, b) => a - b);
    const canvas = await window.html2canvas(corps, { scale:2, backgroundColor:'#ffffff', width:largeur, windowWidth:largeur,
      height:hauteurTotale, windowHeight:hauteurTotale, useCORS:true, logging:false });
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit:'mm', format:'a4', orientation:'portrait', compress:true });
    const mmParPx = 210 / largeur;
    const haut = 8, bas = 14;                       /* marges en mm */
    const pagePx = Math.floor((297 - haut - bas) / mmParPx);
    const coupes = [];
    let debut = 0;
    while(debut < hauteurTotale - 4){
      let limite = debut + pagePx;
      const force = forces.find(f => f > debut + 40 && f < limite);
      let fin;
      if(force) fin = force;
      else if(limite >= hauteurTotale) fin = hauteurTotale;
      else {
        const ok = candidats.filter(c => c > debut + pagePx * 0.45 && c <= limite);
        fin = ok.length ? ok[ok.length - 1] : limite;
      }
      coupes.push([debut, fin]); debut = fin;
    }
    const total = coupes.length;
    coupes.forEach(([a, b], i) => {
      if(i) pdf.addPage();
      const tranche = document.createElement('canvas');
      tranche.width = canvas.width; tranche.height = Math.max(1, Math.round((b - a) * 2));
      const ctx = tranche.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, tranche.width, tranche.height);
      ctx.drawImage(canvas, 0, Math.round(a * 2), canvas.width, tranche.height, 0, 0, canvas.width, tranche.height);
      pdf.addImage(tranche.toDataURL('image/jpeg', 0.9), 'JPEG', 0, haut, 210, (b - a) * mmParPx);
      /* filigrane discret, par-dessus, presque transparent */
      try{
        pdf.saveGraphicsState(); pdf.setGState(new pdf.GState({ opacity:0.05 }));
        pdf.setTextColor(20, 20, 20); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(54);
        pdf.text('MON CONCOURS', 105, 175, { align:'center', angle:28 });
        pdf.restoreGraphicsState();
      }catch(e){}
      pdf.setDrawColor(17); pdf.setLineWidth(0.3); pdf.line(12, 297 - bas + 3, 198, 297 - bas + 3);
      pdf.setTextColor(17); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5);
      pdf.text('Mon Concours · monconcoursbf.com · WhatsApp ' + telAffiche(), 12, 297 - bas + 8);
      pdf.text('Page ' + (i + 1) + ' sur ' + total, 198, 297 - bas + 8, { align:'right' });
    });
    return pdf.output('blob');
  } finally { ifr.remove(); }
}

/* Après l'enregistrement, un bandeau propose d'ouvrir le fichier tout de suite :
   le candidat n'a pas à chercher où le téléphone l'a rangé. */
function proposerOuverture(blob, nom){
  try{
    let z = document.getElementById('ouvrir-fichier');
    if(z) z.remove();
    const url = URL.createObjectURL(blob);
    z = document.createElement('div');
    z.id = 'ouvrir-fichier'; z.setAttribute('role', 'status');
    z.innerHTML = '<span class="of-ic" aria-hidden="true">✓</span><span class="of-txt"><b>Votre fichier a été téléchargé</b><small>' + E(nom || '') + '</small></span><button type="button" class="ouvrir">Ouvrir le fichier</button><button type="button" class="fermer" aria-label="Fermer">×</button>';
    document.body.appendChild(z);
    const fermer = () => { z.remove(); setTimeout(() => URL.revokeObjectURL(url), 120000); };
    const ouvrir = () => { if(!window.open(url, '_blank')) location.href = url; fermer(); };
    z.querySelector('.ouvrir').onclick = e => { e.stopPropagation(); ouvrir(); };
    z.querySelector('.fermer').onclick = e => { e.stopPropagation(); fermer(); };
    z.onclick = ouvrir;   /* toucher la notification ouvre aussi le fichier */
    setTimeout(() => { if(z.isConnected) fermer(); }, 30000);
  }catch(e){}
}
async function enregistrerBlob(blob, nom, poignee){
  if(poignee){
    const w = await poignee.createWritable(); await w.write(blob); await w.close();
    masquerToast();
    proposerOuverture(blob, nom);
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nom; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  masquerToast();
  proposerOuverture(blob, nom);
}

/* Lecteur intégré : le document s'ouvre dans l'application, sans rien télécharger. */
function lireDocument(titre, html, retour, telecharger){
  if(!html) return;
  S.lecteur = { titre, retour: retour || 'compte', telecharger: telecharger || null,
    html: html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<div class="noimp">[\s\S]*?<\/div>/i, '')
      .replace('</head>', '<style>body{padding:16px 14px!important;max-width:none!important}.filigrane{display:none!important}</style></head>') };
  aller('lecteur');
}
function ecranLecteur(){
  const L = S.lecteur;
  if(!L){ return aller('compte'); }
  vue().innerHTML = `<div class="lecteur">
    <div class="lecteur-barre"><button class="retourhaut" data-go="${E(L.retour)}">Retour</button>
      ${L.telecharger ? `<button class="mini" data-lecteur-dl="1">${ico('telecharger',14)} Télécharger en PDF</button>` : ''}</div>
    <iframe class="lecteur-doc" title="${E(L.titre)}" sandbox></iframe></div>`;
  const f = vue().querySelector('.lecteur-doc'); if(f) f.srcdoc = L.html;
}
/* Demande l'emplacement tout de suite (le téléphone l'exige au moment du
   toucher), puis prépare le fichier. */
async function demanderEmplacement(nom){
  if(!window.showSaveFilePicker) return null;
  try{
    return await window.showSaveFilePicker({ suggestedName:nom, types:[{ description:'Document PDF', accept:{ 'application/pdf':['.pdf'] } }] });
  }catch(e){ if(e && e.name === 'AbortError') throw e; return null; }
}
async function sortirDocument(titre, fabrique){
  const nom = nomFichier(titre);
  let poignee = null;
  try{ poignee = await demanderEmplacement(nom); }catch(e){ return; }
  toast('Téléchargement en cours…', 60000);
  let html = null;
  try{ html = await fabrique(); }catch(e){ html = null; }
  if(!html){ masquerToast(); return; }
  try{
    const blob = await htmlVersPdf(html);
    await enregistrerBlob(blob, nom, poignee);
    pister('DOCUMENT_DOWNLOADED', { titre: titre.slice(0, 40) });
  }catch(e){
    /* sans réseau pour les outils PDF : la page imprimable, comme avant */
    const f = window.open('', '_blank');
    if(!f){ toast('Le document n\'a pas pu être préparé. Réessayez avec une meilleure connexion.'); return; }
    f.document.write(html); f.document.close();
  }
}
/* Un fichier déjà prêt (PDF déposé par l'équipe) : même choix d'emplacement */
async function telechargerUrl(url, nom){
  let poignee = null;
  try{ poignee = await demanderEmplacement(nom); }catch(e){ return; }
  toast('Téléchargement en cours…', 60000);
  try{
    const r = await fetch(url); if(!r.ok) throw new Error('http');
    await enregistrerBlob(await r.blob(), nom, poignee);
  }catch(e){ window.open(url, '_blank'); }
}

function feuilleBloquee(){
  if(peutFeuilleDetaillee()) return false;
  toast('La feuille détaillée fait partie de l\'abonnement.', 4500);
  aller('abonnement'); return true;
}
function feuilleComposition(source){
  if(feuilleBloquee()) return;
  return sortirDocument('Feuille corrigée ' + (S.util.nom || 'candidat'), () => htmlFeuilleComposition(source));
}
/* Feuille corrigée : une seule feuille de style pour la copie perso et la correction nationale */
const CSS_FEUILLE =
'@page{size:A4;margin:14mm}*{box-sizing:border-box}' +
'body{font-family:Georgia,"Times New Roman",serif;color:#111;margin:0;line-height:1.45}' +
'.tete{display:flex;align-items:center;gap:14px;border-bottom:3px double #111;padding-bottom:12px;flex-wrap:wrap}' +
'body{max-width:190mm;margin:0 auto;padding:0 10px}@media print{body{padding:0}}' +
'.marque .n{font-size:19px;font-weight:bold;letter-spacing:.04em}.marque .d{font-size:11px;color:#555;font-style:italic}' +
'.sceau{width:52px;height:52px;border-radius:13px;background:#EDE4D3;border:1px solid #C9BEA9;display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:7px;flex:0 0 auto}' +
'.sceau i{border-radius:50%;background:#FBFAF7;border:1px solid #C9BEA9}.sceau i:nth-child(2),.sceau i:nth-child(3){background:#1C1C1C;border-color:#1C1C1C}' +
'h1{font-size:15px;letter-spacing:.2em;text-transform:uppercase;margin:16px 0 10px;border-bottom:1px solid #111;padding-bottom:5px;break-after:avoid}' +
'.ident{display:flex;gap:6px;flex-wrap:wrap}.ident div{flex:1 1 90px;border:1px solid #bbb;padding:3px 7px}' +
'.ident b{display:block;font-size:8.5px;letter-spacing:.12em;text-transform:uppercase;color:#666;font-weight:normal}.ident span{font-size:12px}' +
'.resultat{display:flex;gap:10px;align-items:stretch;margin-top:8px}.note{border:2px solid #111;padding:6px 12px;text-align:center;min-width:110px}' +
'.note .n{font-size:28px;font-weight:bold;line-height:1}.note .l{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#555;margin-top:5px}' +
'.rec{flex:1;border-collapse:collapse;font-size:11.5px}.rec td{border:1px solid #bbb;padding:2px 8px}.rec td:last-child{text-align:right;font-weight:bold;width:70px}' +
'ol.recos{margin:6px 0 0 18px;font-size:13px}ol.recos li{margin-bottom:5px}' +
'.saut-page{break-before:page;page-break-before:always}.bloc-fin{break-inside:avoid}' +
'.q{break-inside:avoid;margin:0 0 9px;font-size:12.5px}.q ol{margin:3px 0 0 22px;padding:0}.q li{margin:1px 0}' +
'.q li.bonne{color:#0E7A54;font-weight:bold}.q li.mauvaise{color:#B4231C;text-decoration:line-through}' +
'.etat{font-family:Helvetica,Arial,sans-serif;font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;border:1px solid #999;padding:0 4px;margin-left:4px}' +
'.etat.juste{color:#0E7A54;border-color:#0E7A54}.etat.fausse{color:#B4231C;border-color:#B4231C}.etat.blanche{color:#777}' +
'.grille{display:grid;grid-template-columns:repeat(5,1fr);gap:3px 12px;font-family:Helvetica,Arial,sans-serif}' +
'.ligne{display:flex;align-items:center;gap:3px;font-size:11px;break-inside:avoid}.no{width:20px;text-align:right;color:#666;font-size:10px}' +
'.b{width:17px;height:17px;line-height:16px;text-align:center;border:1px solid #ccc;border-radius:50%;font-size:10px;color:#bbb}' +
'.b.juste{background:#0E7A54;border-color:#0E7A54;color:#fff;font-weight:bold}.b.attendue{border:2px solid #0E7A54;color:#0E7A54;font-weight:bold}' +
'.b.faute{background:#fff;border:2px solid #B4231C;color:#B4231C;font-weight:bold;text-decoration:line-through}' +
'.legende{display:flex;gap:16px;font-size:11px;margin:8px 0 0;font-family:Helvetica,Arial,sans-serif;color:#444;flex-wrap:wrap}' +
'.legende span{display:flex;align-items:center;gap:5px}.legende i{width:14px;height:14px;border-radius:50%;display:inline-block}' +
'.pied{margin-top:20px;border-top:2px solid #111;padding-top:8px;font-size:12px;color:#111;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-family:Helvetica,Arial,sans-serif}' +
'.pied b{font-size:13px}' +
'.site{margin-left:auto;display:flex;align-items:center;gap:10px;text-align:right}' +
'.site .adr{font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:15px;color:#000;letter-spacing:.01em}' +
'.site .sc{font-size:10.5px;color:#333;font-family:Helvetica,Arial,sans-serif}' +
'.site svg{display:block;border:1px solid #ccc}' +
'.filigrane{position:fixed;top:50%;left:50%;width:120mm;height:120mm;transform:translate(-50%,-50%) rotate(-12deg);opacity:.045;z-index:-1;pointer-events:none;display:grid;grid-template-columns:1fr 1fr;gap:9mm;padding:12mm;border-radius:28mm;background:#1C1C1C}' +
'.filigrane i{border-radius:50%;background:#fff}.filigrane i:nth-child(2),.filigrane i:nth-child(3){background:#1C1C1C;border:4mm solid #fff}' +
'.filigrane b{position:absolute;bottom:-16mm;left:0;right:0;text-align:center;font:bold 13mm Helvetica,Arial,sans-serif;color:#1C1C1C;white-space:nowrap}' +
'table.mats{width:100%;border-collapse:collapse;font-size:12.5px;margin-top:6px}table.mats td{border:1px solid #bbb;padding:4px 8px}table.mats td.n{text-align:right;width:90px;font-weight:bold}' +
'@media print{.noimp{display:none}}.noimp{text-align:center;margin:20px 0}' +
'.noimp button{font:inherit;padding:11px 22px;border:1px solid #111;background:#111;color:#fff;cursor:pointer}';

function htmlFeuilleComposition(source){
  /* source : { grille:[{q, o, bonnes}], reponses:{}, note, duree, date, sujet, concours }
     Sans source, on imprime la composition qui vient d'être corrigée. */
  const S0 = source || { grille:S.grille, reponses:S.reponses, note:S.grilleNote,
    duree:S.dureeUtilisee ?? ((S.dureeCompo || 2400) - S.chrono), date:new Date(),
    sujet:S.sujetRef, concours:S.concours, seuil:S.seuil };
  if(!S0.grille.length || !S0.grille.some(g => g.bonnes)){ toast("La copie n'est pas encore corrigée."); return; }
  const total = S0.grille.length, note = S0.note ?? 0;
  const { justes, fausses, blancs } = bilanCopie(S0.grille, S0.reponses);
  const d = S0.date || new Date();
  const quand = d.toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' });
  const pct = total ? Math.round(note / total * 100) : 0;
  const seuil = (typeof S0.seuil === 'number') ? S0.seuil : null;
  const mots = (S.util.nom || 'Candidat').trim().split(/\s+/).filter(Boolean);
  const initiales = (mots.length > 1 ? mots[0][0] + mots[mots.length-1][0] : (mots[0]||'C').slice(0,2)).toUpperCase();
  const analyse = analyseCopie(S0.grille, S0.reponses);
  const matsFeuille = bilanMatieres(S0.grille, S0.reponses);

  const recommandations = [];
  if(blancs.length > total * 0.15)
    recommandations.push("Vous avez laissé " + blancs.length + " question" + (blancs.length>1?'s':'') + " blanche" + (blancs.length>1?'s':'') + ". Le jour du concours, lisez chaque énoncé jusqu'au bout avant de passer : une question lue est souvent une question trouvée.");
  if(fausses.length > justes.length)
    recommandations.push("Plus de réponses fausses que de bonnes. Ralentissez : relisez l'énoncé et éliminez d'abord les propositions impossibles.");
  if(S0.duree < 900 && blancs.length)
    recommandations.push("Vous avez rendu avant 15 minutes en laissant des blancs. Utilisez tout le temps accordé.");
  if(justes.length >= total * 0.7)
    recommandations.push("Bon niveau sur ce sujet. Travaillez maintenant la régularité : une composition par semaine, à la même heure.");
  if(analyse) recommandations.push(analyse.texte);
  if(fausses.length) recommandations.push("Reprenez vos " + fausses.length + " faute" + (fausses.length>1?'s':'') + " dans « Mes erreurs ». Chacune revient jusqu'à trois bonnes réponses d'affilée.");

  const grilleHtml = S0.grille.map((g, i) => {
    const r = S0.reponses[i] || [], bonnes = g.bonnes || [];
    return '<div class="ligne"><span class="no">' + (i+1) + '</span>' +
      g.o.map((_, k) => {
        const choisi = r.includes(k), bon = bonnes.includes(k);
        let cl = 'b';
        if(bon && choisi) cl += ' juste'; else if(bon) cl += ' attendue'; else if(choisi) cl += ' faute';
        return '<span class="' + cl + '">' + ('ABCD'[k] || '•') + '</span>';
      }).join('') + '</div>';
  }).join('');

  const sujetHtml = S0.grille.map((g, i) => {
    const r = S0.reponses[i] || [], bonnes = g.bonnes || [];
    const etat = !r.length ? 'blanche' : (r.length === bonnes.length && r.every(x => bonnes.includes(x)) ? 'juste' : 'fausse');
    return '<div class="q"><div class="qt"><b>' + (i+1) + '.</b> ' + E(g.q) +
      ' <span class="etat ' + etat + '">' + (etat === 'juste' ? 'juste' : etat === 'fausse' ? 'fausse' : 'blanche') + '</span></div><ol type="a">' +
      g.o.map((o, k) => '<li class="' + (bonnes.includes(k) ? 'bonne' : (r.includes(k) ? 'mauvaise' : '')) + '">' + E(o) +
        (bonnes.includes(k) ? ' ✓' : (r.includes(k) ? ' ✗' : '')) + '</li>').join('') + '</ol>' +
      (typeof g.taux === 'number' ? '<div style="font:11px Helvetica,Arial,sans-serif;color:#555;margin:3px 0 0 22px">' + g.taux + ' % des candidats ont trouvé</div>' : '') +
      (g.expl ? '<div style="font-size:11.5px;margin:4px 0 0 22px;padding:5px 8px;border-left:3px solid #0E7A54;background:#F3F7F5"><b>Pourquoi ?</b> ' + E(g.expl) + '</div>' : '') + '</div>';
  }).join('');

  const html = '<!doctype html><html lang="fr"><head><meta charset="utf-8">' +
'<title>Feuille corrigée — ' + E(S.util.nom || 'Candidat') + '</title>' +
'<style>' + CSS_FEUILLE +
'</style></head><body>' +
'<div class="filigrane" aria-hidden="true"><i></i><i></i><i></i><i></i><b>MON CONCOURS</b></div>' +
'<div class="tete"><div class="sceau"><i></i><i></i><i></i><i></i></div>' +
  '<div class="marque"><div class="n">MON CONCOURS</div><div class="d">Préparation aux concours directs du Burkina Faso</div></div>' +
  '<div class="site"><div><div class="adr">monconcoursbf.com</div><div class="sc">Scannez pour réviser gratuitement</div></div>' + QR_FEUILLE + '</div></div>' +

'<h1>Analyse de la copie</h1>' +
'<div class="ident">' +
  '<div><b>Candidat</b><span>' + E(S.util.nom || 'Candidat') + '</span></div>' +
  '<div><b>Initiales</b><span>' + E(initiales) + '</span></div>' +
  '<div><b>Épreuve</b><span>Entraînement type ' + E(S0.concours || 'concours direct') + '</span></div>' +
  (S0.sujet ? '<div><b>Sujet</b><span>n° ' + E(S0.sujet) + '</span></div>' : '') +
  '<div><b>Date</b><span>' + quand + '</span></div>' +
'</div>' +
'<div class="resultat">' +
  '<div class="note"><div class="n">' + note + ' / ' + total + '</div><div class="l">Note obtenue</div></div>' +
  '<table class="rec">' +
    '<tr><td>Réussite</td><td>' + pct + ' %</td></tr>' +
    '<tr><td>Bonnes réponses</td><td>' + justes.length + '</td></tr>' +
    '<tr><td>Réponses fausses</td><td>' + fausses.length + '</td></tr>' +
    '<tr><td>Questions blanches</td><td>' + blancs.length + '</td></tr>' +
    '<tr><td>Temps utilisé</td><td>' + Math.round(Math.max(0, S0.duree || 0) / 60) + ' min</td></tr>' +
    (seuil !== null ? '<tr><td>Seuil du dernier admis</td><td>' + seuil + ' / ' + total + '</td></tr>' : '') +
  '</table>' +
'</div>' +

'<h1>Votre feuille de réponses</h1>' +
'<div class="grille">' + grilleHtml + '</div>' +
'<div class="legende">' +
  '<span><i style="background:#0E7A54"></i> Bonne réponse noircie</span>' +
  '<span><i style="border:2px solid #0E7A54"></i> Réponse attendue</span>' +
  '<span><i style="border:2px solid #B4231C"></i> Noirci à tort</span>' +
  '<span><i style="border:1px solid #ccc"></i> Non noirci</span>' +
'</div>' +

(matsFeuille.length ? '<h1>Résultats par matière</h1><table class="mats">' +
  matsFeuille.map(x => '<tr><td>' + E(x.nom) + '</td><td class="n">' + x.j + ' / ' + x.n + '</td><td class="n">' + Math.round(x.j / x.n * 100) + ' %</td></tr>').join('') + '</table>' : '') +
'<h1>Recommandations</h1><ol class="recos">' + recommandations.map(r => '<li>' + E(r) + '</li>').join('') + '</ol>' +

'<h1>Le sujet corrigé</h1>' + sujetHtml +
'<div class="pied"><span><b>monconcoursbf.com</b> · WhatsApp <b>' + telAffiche() + '</b></span><span>Document remis le ' + quand + '</span></div>' +
'<div class="noimp"><button onclick="window.print()">Enregistrer en PDF ou imprimer</button></div>' +
'<scr' + 'ipt>setTimeout(function(){window.print();},600);<\/scr' + 'ipt>' +
'</body></html>';

  return html;
  pister('SHEET_DOWNLOADED', { note });
}

/* =====================================================================
   MUSIQUE DE TRAVAIL
   Une piste douce, choisie par l'administrateur. Le candidat l'allume
   comme il allume la lumière : à côté du bouton de thème.
   ===================================================================== */
const MUSIQUE = { audio:null, liste:[], index:0, actif:false, charge:false };

async function chargerMusiques(){
  if(!base || MUSIQUE.charge) return;
  MUSIQUE.charge = true;
  try{
    const { data } = await base.from('musiques')
      .select('id, titre, artiste, fichier_chemin')
      .eq('statut','publie').order('ordre').limit(20);
    MUSIQUE.liste = (data || []).map(m => ({
      ...m,
      url: base.storage.from('musiques').getPublicUrl(m.fichier_chemin).data.publicUrl
    }));
  }catch(e){ MUSIQUE.liste = []; }
}

async function basculerMusique(){
  await chargerMusiques();
  if(!MUSIQUE.liste.length){
    toast("Aucune musique disponible pour le moment.");
    return;
  }
  if(MUSIQUE.actif){
    if(MUSIQUE.audio) MUSIQUE.audio.pause();
    MUSIQUE.actif = false;
    ecrireReglage('musique', false);
    toast('Musique arrêtée.');
    return rendre();
  }
  if(!MUSIQUE.audio){
    MUSIQUE.audio = new Audio();
    MUSIQUE.audio.volume = 0.35;               // douce, elle accompagne
    MUSIQUE.audio.preload = 'none';
    MUSIQUE.audio.addEventListener('ended', () => {
      MUSIQUE.index = (MUSIQUE.index + 1) % MUSIQUE.liste.length;
      MUSIQUE.audio.src = MUSIQUE.liste[MUSIQUE.index].url;
      MUSIQUE.audio.play().catch(()=>{});
    });
    MUSIQUE.audio.addEventListener('error', () => {
      MUSIQUE.actif = false; toast("Cette piste n'a pas pu être lue."); rendre();
    });
  }
  MUSIQUE.audio.src = MUSIQUE.liste[MUSIQUE.index].url;
  try{
    await MUSIQUE.audio.play();
    MUSIQUE.actif = true;
    ecrireReglage('musique', true);
    const p = MUSIQUE.liste[MUSIQUE.index];
    toast('♪ ' + p.titre + (p.artiste ? ' · ' + p.artiste : ''));
    rendre();
  }catch(e){ toast("Touchez à nouveau pour lancer la musique."); }
}

/* Le reçu d'abonnement, après confirmation par l'administrateur : un vrai document,
   avec l'en-tête Mon Concours, le QR code, le numéro et le cachet « PAYÉ ». */
function telechargerRecu(id){
  if(!base){ toast('Connexion nécessaire.'); return; }
  return sortirDocument('Recu ' + (S.util.nom || 'abonnement'), async () => {
    const { data, error } = await base.rpc('mon_recu', { p_id: id });
    if(error || !data || !data.ok){ toast((data && data.message) || 'Reçu indisponible.'); return null; }
    const r = data.recu;
    const d = iso => iso ? new Date(iso).toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' }) : '—';
    const ligne = (l, v) => '<tr><td class="k">' + E(l) + '</td><td class="v">' + E(v) + '</td></tr>';
    const montant = (r.montant_fcfa || 0).toLocaleString('fr-FR').replace(/ | /g, ' ') + ' FCFA';
    const gratuit = !(r.montant_fcfa > 0);
    pister('RECEIPT_DOWNLOADED');
    const css =
      '.rc-meta{display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;margin:22px 0 4px;font-family:Helvetica,Arial,sans-serif;font-size:12.5px;color:#333}' +
      '.rc-titre{font-size:22px;letter-spacing:.2em;text-transform:uppercase;margin:6px 0 16px;text-align:center}' +
      'table.rc{width:100%;border-collapse:collapse;font-family:Helvetica,Arial,sans-serif;font-size:14px;border:1px solid #111}' +
      'table.rc td{padding:9px 12px;border-bottom:1px solid #ccc}table.rc td.k{width:38%;color:#444;background:#f6f3ec}table.rc td.v{font-weight:bold;text-align:right}' +
      '.rc-total{display:flex;justify-content:space-between;align-items:center;margin-top:18px;border:2px solid #111;padding:14px 18px;font-family:Helvetica,Arial,sans-serif}' +
      '.rc-total .l{font-size:13px;letter-spacing:.14em;text-transform:uppercase}.rc-total .m{font-size:26px;font-weight:bold}' +
      '.rc-bas{display:flex;justify-content:space-between;align-items:flex-end;margin-top:26px;gap:16px}' +
      '.rc-cachet{display:inline-block;border:3px solid #1d6b3a;color:#1d6b3a;padding:6px 20px;font:bold 22px Helvetica,Arial,sans-serif;letter-spacing:.2em;transform:rotate(-8deg);border-radius:6px;opacity:.85}' +
      '.rc-sign{text-align:center;font:12px Helvetica,Arial,sans-serif;color:#333;min-width:200px}.rc-sign .tr{border-top:1px solid #111;margin-top:46px;padding-top:4px}' +
      '.rc-note{margin-top:22px;font-size:12px;color:#444;line-height:1.5;font-style:italic}';
    const corps =
      docEntete('Scannez pour réviser gratuitement') +
      '<div class="rc-meta"><span>Reçu n° <b>' + E(r.numero) + '</b></span><span>Émis le <b>' + E(d(r.emis_le)) + '</b></span></div>' +
      '<h1 class="rc-titre">Reçu de paiement</h1>' +
      '<table class="rc">' +
        ligne('Candidat', r.candidat || '—') +
        ligne('Numéro du compte', r.telephone ? '+226 ' + r.telephone : '—') +
        ligne('Abonnement', r.offre) +
        ligne('Durée', (r.duree_jours || '—') + ' jours') +
        ligne('Valable du', d(r.debut_le)) +
        ligne('Jusqu\'au', d(r.fin_le)) +
        ligne('Moyen de paiement', r.operateur || '—') +
      '</table>' +
      '<div class="rc-total"><span class="l">' + (gratuit ? 'Abonnement offert' : 'Montant payé') + '</span><span class="m">' + E(montant) + '</span></div>' +
      '<div class="rc-bas"><span class="rc-cachet">' + (gratuit ? 'ACTIVÉ' : 'PAYÉ') + '</span>' +
        '<div class="rc-sign">Mon Concours<br>Service des abonnements<div class="tr">Cachet et signature</div></div></div>' +
      '<p class="rc-note">' + E(r.remerciement || 'Merci de votre confiance.') + ' Ce reçu atteste de l\'activation de votre abonnement. Il n\'y a pas de renouvellement automatique : à la fin de la période, vous choisissez librement de continuer.</p>' +
      docPied();
    return docComplet('Reçu ' + r.numero, css, corps);
  });
}

/* Rejoue une composition déjà remise pour en réimprimer la feuille. */
function feuilleArchive(id){
  if(!base){ toast('Connexion nécessaire pour retrouver cette copie.'); return; }
  if(feuilleBloquee()) return;
  return sortirDocument('Feuille corrigée ' + (S.util.nom || 'candidat'), async () => {
    const { data, error } = await base.rpc('ma_copie', { p_composition: id });
    if(error || !data || !data.ok){ toast('Impossible de retrouver cette copie.'); return null; }
    if(data.correction_le){ toast('Composition nationale : la feuille corrigée sera disponible à ' + heureFr(data.correction_le) + '.'); return null; }
    const grille = [], reponses = {};
    (data.questions || []).forEach((q, i) => {
      grille.push({ q:q.enonce, o:q.options || [], bonnes:q.bonnes || [], m:q.matiere || null, taux:q.taux, expl:q.explication });
      if(q.choisies && q.choisies.length) reponses[i] = q.choisies.map(Number);
    });
    return htmlFeuilleComposition({ grille, reponses, note:data.note || 0, duree:data.duree || 0,
      date:new Date(data.date), sujet:data.sujet, concours:null, seuil:null });
  });
}

/* Toutes les compositions corrigées dans un seul PDF : chacune sur ses pages,
   précédée d'une page de séparation « Composition N ». */
const corpsFeuille = html => html.slice(html.indexOf('<body>') + 6, html.indexOf('<div class="noimp">'));
function toutesCompositions(){
  if(!exigerAbonnement('Le PDF de toutes vos compositions fait partie de l\'abonnement.', 'compos_pdf')) return;
  if(feuilleBloquee()) return;
  if(!base){ toast('Connexion nécessaire pour réunir vos compositions.'); return; }
  const liste = ((S.journee && S.journee.compositions) || []).filter(c => c.sur > 0 && !c.collective).slice(0, 40).reverse();
  if(!liste.length){ toast('Aucune composition corrigée à réunir pour le moment.'); return; }
  return sortirDocument('Toutes mes compositions ' + (S.util.nom || 'candidat'), async () => {
    const parts = [];
    let tete = '';
    for(let i = 0; i < liste.length; i++){
      const { data } = await base.rpc('ma_copie', { p_composition: liste[i].id });
      if(!data || !data.ok || data.correction_le) continue;
      const grille = [], reponses = {};
      (data.questions || []).forEach((q, k) => {
        grille.push({ q:q.enonce, o:q.options || [], bonnes:q.bonnes || [], m:q.matiere || null, taux:q.taux, expl:q.explication });
        if(q.choisies && q.choisies.length) reponses[k] = q.choisies.map(Number);
      });
      const h = htmlFeuilleComposition({ grille, reponses, note:data.note || 0, duree:data.duree || 0,
        date:new Date(data.date), sujet:data.sujet, concours:null, seuil:null });
      if(!h) continue;
      if(!tete) tete = h.slice(0, h.indexOf('<body>') + 6);
      parts.push({ n:parts.length + 1, corps:corpsFeuille(h) });
    }
    if(!parts.length){ toast('Impossible de retrouver vos compositions.'); return null; }
    const sommaire = '<h1>Mes compositions</h1><p style="font-size:14px">' + E(S.util.nom || 'Candidat') + ' · ' + parts.length +
      ' composition' + (parts.length > 1 ? 's' : '') + ' corrigée' + (parts.length > 1 ? 's' : '') + ' dans ce document.</p>';
    return tete + sommaire + parts.map(x =>
      '<div class="saut-page"></div><h1 style="text-align:center;font-size:30px;margin:60px 0 20px">Composition ' + x.n + '</h1>' +
      '<div class="saut-page"></div>' + x.corps).join('') +
      '<div class="noimp"><button onclick="window.print()">Enregistrer en PDF ou imprimer</button></div></body></html>';
  });
}

/* Barre de progression : elle avance avec le défilement du cours. */
/* un cours lu jusqu'au bout compte pour le niveau « Prêt pour le concours » */
async function marquerLus(ids){
  ids = (ids || []).filter(id => !(S.lus || []).includes(id));
  if(!ids.length || !base || !S.util.connecte) return;
  S.lus = (S.lus || []).concat(ids);
  try{ await base.rpc('marquer_lu', { p_ressources: ids }); if(S.details) S.details.cours_lus = (S.details.cours_lus || 0) + ids.length; }catch(e){}
  pister('COURSE_READ', { n: ids.length });
}
async function chargerLectures(){
  if(!base || !S.util.connecte || S.lusCharges) return;
  try{ const { data } = await base.rpc('mes_lectures'); S.lus = data || []; memoEcrire('lus', S.lus, true); S.lusCharges = true; if(S.ecran === 'revisions') rendre(); }catch(e){}
}
function suivreLecture(ids, suivi){
  const zone = vue(), barre = document.getElementById('jauge-lecture-barre');
  if(!zone) return;
  let fait = false, termine = false, minuteur = null;
  /* on retient le chapitre et l'endroit exact où le candidat lit, pour qu'il
     retrouve sa place à son retour (sans bruit : une fois la lecture posée) */
  const retenir = () => {
    if(!suivi || S.ecran !== 'lecture') return;
    const chs = zone.querySelectorAll('.chapitre');
    if(!chs.length) return;
    const h = zone.scrollHeight - zone.clientHeight;
    const f = h <= 0 ? 1 : zone.scrollTop / h;
    if(f >= 0.92){ if(!termine){ termine = true; lectureTerminee(suivi.matiere); } return; }
    termine = false;
    if(f < 0.02) return;                               // à peine commencé : on ne retient rien
    const ligne = zone.getBoundingClientRect().top + zone.clientHeight * 0.3;
    let cur = 0;
    chs.forEach((c, i) => { if(c.getBoundingClientRect().top <= ligne) cur = i; });
    const r = chs[cur].getBoundingClientRect();
    noterLecture(suivi.matiere, cur, chs.length, (suivi.titres || [])[cur] || '',
      Math.min(1, Math.max(0, (ligne - r.top) / Math.max(1, r.height))));
  };
  const maj = () => {
    const h = zone.scrollHeight - zone.clientHeight;
    const f = h <= 0 ? 1 : Math.min(1, Math.max(0, zone.scrollTop / h));
    if(barre) barre.style.width = f * 100 + '%';
    if(!fait && f >= 0.92 && ids){ fait = true; marquerLus(ids); }
    if(suivi){ clearTimeout(minuteur); minuteur = setTimeout(retenir, 600); }
  };
  zone.removeEventListener('scroll', zone._suivi || (()=>{}));
  zone._suivi = maj;
  zone.addEventListener('scroll', maj, { passive:true });
  maj();
}

/* À l'ouverture d'un cours déjà commencé, on revient à l'endroit où l'on avait
   quitté. Une seule fois par ouverture : ensuite, le candidat lit où il veut. */
function reprendreLecture(){
  const m = S.matiereOuverte, pos = m && lecturePos()[m];
  if(!pos || S.lectureReprise === m || Date.now() - (pos.le || 0) > REPRISE_VALIDE_MS) return;
  setTimeout(() => {
    if(S.ecran !== 'lecture' || S.matiereOuverte !== m || S.lectureReprise === m) return;
    const zone = vue(), el = document.getElementById('chap-' + pos.chap);
    if(!zone || !el) return;
    S.lectureReprise = m;
    const z = zone.getBoundingClientRect(), r = el.getBoundingClientRect();
    zone.scrollTop = Math.max(0, (r.top - z.top) + zone.scrollTop + (pos.off || 0) * r.height - zone.clientHeight * 0.3);
    if(pos.chap >= 1 || pos.off > 0.1) toast('Vous reprenez là où vous vous étiez arrêté : chapitre ' + (pos.chap + 1) + ' sur ' + pos.n + '.', 4000);
  }, 80);
}

function ecranLecture(){
  /* U3 — on lit une matière entière d'un seul tenant. Le candidat déroule,
     il ne revient pas en arrière entre chaque chapitre. */
  if(S.matiereOuverte){
    /* ouvert depuis une notification, les cours peuvent ne pas être encore arrivés */
    if(S.ressources === null || S.ressources === undefined){
      if(!S.ressourcesEnCours) chargerRessources();
      vue().innerHTML = `<div class="pad"><button class="retourhaut" data-go="revisions">Retour</button>
        <div class="squelette large" style="margin-top:16px"></div><p class="sous" style="margin-top:12px">Chargement du cours…</p></div>`;
      return;
    }
    const lot = (S.ressources || []).filter(x => x.matiere === S.matiereOuverte && x.texte);
    if(!lot.length){ S.matiereOuverte = null; return ecranCours(); }
    const commun = lot.every(x => x.commun);
    vue().innerHTML = `
    <div class="pad">
      <div class="jauge-lecture" aria-hidden="true"><i id="jauge-lecture-barre"></i></div>
      <button class="retourhaut" data-go="revisions">Retour</button>
      <div class="eyebrow">${commun ? 'Toutes classes' : S.niveau}</div>
      <h1 class="titre">${E(S.matiereOuverte)}</h1>
      <p class="sous" style="margin:8px 0 0">${lot.length} chapitre${lot.length>1?'s':''} · lecture continue</p>

      <div class="carte" style="margin-top:16px">
        <div class="libelle" style="margin-bottom:8px">Sommaire</div>
        ${lot.map((r,i)=>`<button class="lien" style="display:block;text-align:left;padding:7px 0"
           data-vers="chap-${i}"><span class="num">${i+1}.</span> ${E(r.titre)}</button>`).join('')}
      </div>

      ${lot.map((r,i)=>`
        <div id="chap-${i}" class="chapitre" style="margin-top:26px;scroll-margin-top:14px">
          <div class="eyebrow">Chapitre ${i+1} sur ${lot.length}${r.theme ? ' · ' + E(r.theme) : ''}</div>
          <h2 class="titre" style="font-size:21px;margin:6px 0 0">${E(r.titre)}</h2>
          <div class="carte lecon" style="margin-top:12px">${miseEnPage(r.texte)}</div>
        </div>`).join('')}

      <div class="carte" style="margin-top:26px;text-align:center">
        <div class="libelle" style="margin-bottom:8px">Cours terminé</div>
        <p class="sous" style="margin:0 0 12px">Vous avez lu les ${lot.length} chapitres de ${E(S.matiereOuverte)}. Mettez-les à l'épreuve.</p>
        <button class="cta" data-cible="${E(S.matiereOuverte)}">Faire les QCM de ce cours</button>
        <button class="cta creux" style="margin-top:8px" data-partage="cours">${ico("partage",16)} Partager ce cours</button>
      </div>
      <button class="cta creux" style="margin-top:12px" data-go="revisions">Retour aux révisions</button>
    </div>`;
    suivreLecture(lot.map(x => x.id), { matiere: S.matiereOuverte, titres: lot.map(x => x.titre) });
    reprendreLecture();
    return;
  }

  const r = (S.ressources || []).find(x => x.id === S.ressourceOuverte);
  if(!r) return ecranCours();
  vue().innerHTML = `
  <div class="pad">
    <button class="retourhaut" data-go="cours">Retour</button>
    <div class="eyebrow">${E(r.matiere || '')}${r.theme ? ' · ' + E(r.theme) : ''}</div>
    <h1 class="titre">${E(r.titre)}</h1>
    ${r.commun ? `<p class="sous" style="margin:6px 0 0">Ce cours est le même pour la troisième, la terminale et la licence.</p>` : ''}
    <div class="carte lecon" style="margin-top:16px">${miseEnPage(r.texte)}</div>
    ${r.fichier_chemin ? `<button class="cta creux" style="margin-top:14px" data-telecharger="${r.id}">Télécharger le fichier</button>` : ''}
  </div>`;
  suivreLecture([r.id]);
}

function sansAccent(n){ return String(n || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,''); }
/* Les cours d'un niveau, tels que l'écran les lit. Un cours sans niveau est commun aux trois classes. */
async function lireRessourcesNiveau(niveau){
  const { data, error } = await base.from('ressources')
    .select('id, titre, texte, type_ressource, theme, niveau, fichier_chemin, nom_fichier, taille_octets, matieres(nom, ordre, tous_niveaux, niveaux)')
    .eq('statut','publie')
    .or('niveau.eq.' + niveau + ',niveau.is.null')
    .limit(300);
  if(error) throw error;
  return (data || [])
    .filter(r => !(r.matieres && r.matieres.niveaux && !r.matieres.niveaux.includes(niveau)))
    .map(r => ({ ...r,
      matiere: r.matieres ? r.matieres.nom : 'Autres documents',
      rang:    r.matieres ? (r.matieres.ordre || 99) : 99,
      commun:  !r.niveau }))
    /* ordre stable : matiere du programme, puis theme, puis titre. Jamais la date. */
    .sort((x, y) =>
      x.rang - y.rang
      || (x.theme || '').localeCompare(y.theme || '', 'fr')
      || x.titre.localeCompare(y.titre, 'fr'));
}
async function chargerRessources(){
  if(!base) return;
  S.ressourcesEnCours = true;
  { const n0 = sansAccent(S.niveau), m0 = memoLire('ressources-' + n0);
    if(m0 && !S.ressources){ S.ressources = m0; if(['cours','lecture','revisions'].includes(S.ecran)) rendre(); } }
  try{
    const niveau = sansAccent(S.niveau);
    S.ressources = await lireRessourcesNiveau(niveau);
    memoEcrire('ressources-' + niveau, S.ressources);
  }catch(e){ if(!S.ressources) S.ressources = []; }
  S.ressourcesEnCours = false;
  if(['cours','lecture','revisions'].includes(S.ecran)) rendre();
}
/* Lecture sans réseau : une fois connecté, le téléphone garde en silence les cours des trois
   niveaux (troisième, terminale, licence). Les cours sont du texte : quelques dizaines de Ko. */
/* Les deux premiers cours de chaque niveau sont offerts (lecture sans réseau et PDF) ; les autres font partie de l'abonnement. */
const COURS_OFFERTS = 2;
const estCours = r => r.texte && r.type_ressource !== 'annale';
function matieresCoursGratuites(liste){
  const mats = []; (liste || []).filter(estCours).forEach(r => { if(!mats.includes(r.matiere)) mats.push(r.matiere); });
  return mats.slice(0, COURS_OFFERTS);
}
const coursOuvert = nom => S.gratuit || estAbonne() || matieresCoursGratuites(S.ressources).includes(nom);
async function garderCoursHorsLigne(){
  if(!base || !navigator.onLine || garderCoursHorsLigne.enCours) return;
  garderCoursHorsLigne.enCours = true;
  try{
    const toutLeCours = S.gratuit || estAbonne();
    for(const niv of ['troisieme', 'terminale', 'licence']){
      try{
        let liste = await lireRessourcesNiveau(niv);
        if(!toutLeCours){ const ok = matieresCoursGratuites(liste); liste = liste.filter(r => !estCours(r) || ok.includes(r.matiere)); }
        if(liste.length) memoEcrire('ressources-' + niv, liste);
      }catch(e){}
    }
    ecrireReglage('cours_hors_ligne', Date.now());
  }finally{ garderCoursHorsLigne.enCours = false; }
}
setTimeout(garderCoursHorsLigne, 6000);
window.addEventListener('online', () => setTimeout(garderCoursHorsLigne, 2000));

async function telechargerRessource(id){
  const r = (S.ressources || []).find(x => x.id === id);
  if(!r || !r.fichier_chemin || !base) return;
  S.erreurCours = '';
  const nom = r.nom_fichier || nomFichier(r.titre);
  let poignee = null;
  try{ poignee = await demanderEmplacement(nom); }catch(e){ return; }
  try{
    const { data, error } = await base.storage.from(/^depot\//.test(r.fichier_chemin) ? 'documents-importes' : 'cours').createSignedUrl(r.fichier_chemin, 3600);
    if(error || !data) throw error || new Error('lien indisponible');
    pister('COURSE_DOWNLOADED', { titre: r.titre });
    toast('Téléchargement…', 2500);
    try{
      const rep = await fetch(data.signedUrl); if(!rep.ok) throw new Error('http');
      await enregistrerBlob(await rep.blob(), nom, poignee);
    }catch(e){ window.open(data.signedUrl, '_blank'); }
  }catch(e){
    S.erreurCours = "Le fichier n'a pas pu être ouvert. Réessaie avec une meilleure connexion.";
    if(S.ecran === 'cours') rendre();
  }
}

function ecranQcm(){
  const m = banqueDe(S.matiere);
  if(!m || !m.questions.length){
    vue().innerHTML = `
    <div class="qcm-tete"><span class="q">${E((S.matiere || 'Révision').toUpperCase())}</span>
      <button class="x" data-go="revisions" aria-label="Fermer">✕</button></div>
    <div class="qzone" style="padding-top:12px">
      <p class="sous">${S.banqueEtat === 'chargement' ? 'Chargement des questions…' : 'Aucune question disponible dans cette matière pour ce niveau.'}</p>
      <button class="cta" style="margin-top:12px" data-go="revisions">Retour aux matières</button>
    </div>`;
    if(!S.banque) chargerQuestions();
    return;
  }
  const total = m.questions.length;
  const idx = S.qcmIdx % total;
  const q = m.questions[idx];
  const c = S.qcmCorrection;            // la correction du serveur, quand elle est arrivée
  const rep = S.qcmRep;
  const motiv = (c && c.ok && c.correcte && S.qcmSerie > 0 && S.qcmSerie % 5 === 0)
    ? `${S.qcmSerie} bonnes réponses d'affilée.` : '';
  vue().innerHTML = `
  <div class="qcm-tete">
    <span class="q">${E(m.nom.toUpperCase())} · QUESTION ${idx + 1} / ${total}</span>
    <button class="x-mode ${S.concentration ? 'on' : ''}" data-concentration="1" aria-pressed="${!!S.concentration}" aria-label="Mode concentration">${ico('cible',15)}</button>
    <button class="x" data-go="revisions" aria-label="Fermer">✕</button>
  </div>
  <div class="qzone" style="padding-top:12px">
    <div class="progression" style="margin-bottom:18px">
      <i class="on" style="flex:${idx + 1}"></i><i style="flex:${Math.max(0, total - idx - 1)}"></i></div>
    <div class="qtexte">${E(q.q)}</div>
    ${q.o.map((o,i)=>{
      let cl = '';
      if(c && c.ok){ if((c.bonnes || []).includes(i)) cl = 'juste'; else if(i === rep) cl = 'faux'; }
      else if(i === rep) cl = S.qcmAttente ? 'choisi attente' : 'choisi';
      const fige = rep !== undefined;
      return `<button class="opt ${cl}" ${fige?'disabled':''} data-qcm="${i}">
        <span class="lettre">${'ABCD'[i] || '•'}</span>${E(o)}</button>`;
    }).join('')}
    ${rep === undefined ? `<p class="sous" style="margin-top:12px;font-family:var(--m);font-size:10.5px;letter-spacing:.05em">
        ${S.util.connecte ? 'La correction s\'affiche dès que tu réponds.' : 'Crée ton compte gratuit pour voir la correction.'}</p>` : ''}

    ${c && !c.ok ? (() => {
      const offre = c.quota && peutProposer(1);
      return `
      <div class="${c.quota ? 'mur-fini' : 'retour mal'}">
        ${c.quota
          ? (c.motif === 'matiere'
              ? `<i class="mf-coche" aria-hidden="true">✓</i><div><h2>Tes 15 questions offertes en ${E(c.matiere || m.nom)} sont faites</h2><p>Tu es lancé, ne t'arrête pas là. Les autres matières restent ouvertes.</p></div>`
              : `<i class="mf-coche" aria-hidden="true">✓</i><div><h2>Tes 5 corrections du jour sont faites</h2><p>Elles reviennent demain matin. Ou continue maintenant, sans attendre.</p></div>`)
          : `<b>${c.connexion ? 'Compte nécessaire' : 'Correction indisponible'}</b>${E(c.message || '')}`}
      </div>
      ${c.quota && c.motif === 'matiere' && total > 15 ? `<div class="mur-reste"><b>Et ${nombreFr(total - 15)} autres questions, corrigées et expliquées</b><span>Elles s'ouvrent toutes avec l'abonnement</span></div>` : ''}
      ${c.quota && c.motif !== 'matiere' && ouvertes() > 0 ? `<div class="mur-atout"><b>Corriger tes erreurs est ton meilleur atout pour progresser dans ta révision</b><span><em class="num">${nombreFr(ouvertes())}</em> ${ouvertes() > 1 ? 'erreurs attendent' : 'erreur attend'} leur correction</span></div>` : ''}
      ${offre ? `<div style="margin-top:12px">${offreDeuxPrix(!!c.quota)}</div>` : ''}
      ${c.quota ? (c.motif === 'matiere' ? `<button class="cta creux" style="margin-top:9px" data-go="revisions">Choisir une autre matière</button>` : `<button class="cta creux" style="margin-top:9px" data-demain="1">À demain</button>`) : ''}
      ${c.connexion ? `<button class="cta" style="margin-top:12px" data-modal="inscription">Créer mon compte gratuit</button>` : ''}
      ${c.reseau ? `<button class="cta" style="margin-top:12px" data-qcm-relancer="1">Réessayer</button>` : ''}
      ${c.quota ? '' : `<button class="cta creux" style="margin-top:9px" data-qsuiv="1">Question suivante →</button>`}`;
    })() : ''}
    ${c && c.ok ? `
      <div class="retour ${c.correcte?'bien':'mal'}">
        <b>${c.correcte?'Bonne réponse':'Réponse incorrecte'}</b>
        ${c.correcte?'':`<div style="margin-bottom:6px">La bonne réponse : <strong class="bonne-rep">${E((c.bonnes||[]).map(k => 'ABCD'[k] + '. ' + q.o[k]).join(' + '))}</strong></div>`}
        ${c.explication ? `<b style="margin-top:2px">Pourquoi ?</b>${E(c.explication)}` : ''}
        ${c.correcte ? '' : '<div style="margin-top:6px;font-size:12.5px">Elle entre dans « Mes erreurs ».</div>'}
      </div>
      ${motiv ? `<div class="motiv"><b>${E(motiv)}</b></div>` : ''}
      ${typeof c.quota_restant === 'number' && c.quota_restant <= 5 ? `<p class="sous" style="margin-top:8px;font-size:12px">${c.quota_restant} correction${c.quota_restant>1?'s':''} gratuite${c.quota_restant>1?'s':''} restante${c.quota_restant>1?'s':''} aujourd'hui.</p>` : ''}
      ${typeof c.matiere_restant === 'number' && c.matiere_restant <= 5 ? `<p class="sous" style="margin-top:4px;font-size:12px">${c.matiere_restant} question${c.matiere_restant>1?'s':''} gratuite${c.matiere_restant>1?'s':''} restante${c.matiere_restant>1?'s':''} en ${E(m.nom)}.</p>` : ''}
      ${!c.correcte ? `<button class="cta creux" style="margin-top:10px" data-similaires="${E(q.id)}">S'entraîner sur 3 questions similaires</button>` : ''}
      <div class="actions-q">
        <button class="lien-mini" data-signaler="${E(q.id)}">${ico('drapeau',13)} Signaler une erreur</button>
        <button class="lien-mini" data-partage-question="${E(q.id)}">${ico('partage',13)} Partager</button>
      </div>
      <button class="cta" style="margin-top:12px" data-qsuiv="1">Question suivante →</button>` : ''}
  </div>`;
}

async function repondreQcm(i){
  const m = banqueDe(S.matiere); if(!m) return;
  const q = m.questions[S.qcmIdx % m.questions.length];
  S.qcmRep = i; S.qcmCorrection = null;
  if(!S.util.connecte){
    S.qcmCorrection = { ok:false, connexion:true, message:'La correction est réservée aux comptes, même gratuits. Ça prend trente secondes.' };
    return ecranQcm();
  }
  S.qcmAttente = true; ecranQcm();
  const debut = S.qcmDebut || Date.now();
  const r = await corrigerAuServeur(q.id, [i], 'revision', Date.now() - debut);
  S.qcmAttente = false;
  S.qcmCorrection = r;
  if(r.ok){
    if(r.correcte){ S.qcmJustes++; S.qcmSerie++; sonJuste(); } else { S.qcmSerie = 0; sonFaux(); }
    compterReponse();
    pister('QUESTION_ANSWERED', { juste: !!r.correcte });
    chargerCahier();
    /* une question corrigée ne revient pas : au retour, on reprend à la suivante */
    if(S.matiere === m.nom){
      S.qcmPos = Object.assign({}, S.qcmPos, { [m.nom]: S.qcmIdx + 1 });
      ecrireReglage('qcmPos', S.qcmPos);
      retenirQcm();
    }
  }
  if(S.ecran === 'qcm') ecranQcm();
}

/* =====================================================================
   ÉCRAN 4 — LA GRILLE
   ===================================================================== */
/* Point 2 : la 3e composition. Les chiffres viennent du serveur, jamais arrondis ni inventés. */
function blocPoint2(){
  const cs = ((S.journee && S.journee.compositions) || []).filter(c => c.sur > 0 && !c.collective);
  const moy = cs.length ? Math.round(cs.slice(0, 3).reduce((a, c) => a + c.score / c.sur * 50, 0) / Math.min(3, cs.length)) : null;
  const rest = S.sujetsRestants && S.sujetsRestants.ok ? S.sujetsRestants.restants : null;
  const offre = peutProposer(2);
  const tu = (v, l) => `<div class="stat"><div class="v">${v}</div><div class="l">${l}</div></div>`;
  const rg = S.classement && S.classement.rang && S.classement.population ? S.classement : null;
  const tuiles = [moy !== null ? tu(moy + '/50', 'ta moyenne') : '', rg ? tu(nombreFr(rg.rang) + 'ᵉ', 'sur ' + nombreFr(rg.population) + ' candidats') : '',
    rest !== null && rest > 0 ? tu(rest > 10 ? '10+' : rest, rest > 1 ? 'sujets t\'attendent' : 'sujet t\'attend') : ''].join('');
  return `
    ${tuiles ? `<div class="av-stats" style="margin:0 0 6px">${tuiles}</div>` : ''}
    <p class="sous" style="margin:8px 0 0;font-size:12.5px">La composition nationale reste gratuite pour tous.</p>
    ${offre ? offreDeuxPrix(true) : ''}`;
}
function ecranCompoAttente(){
  const etat = S.compoEtat;
  const titres = { chargement:'Préparation du sujet…', connexion:'Un compte est nécessaire',
    abonnement:'Tes ' + compoOffertes() + ' compositions offertes sont faites', erreur:'Composition indisponible' };
  const textes = {
    chargement: S.compoLent
      ? 'La connexion est lente, on insiste. Ne quittez pas cette page : le sujet arrive.'
      : 'Le sujet arrive. Le chronomètre ne démarre qu\'une fois la feuille affichée.',
    connexion: 'Crée ton compte gratuit : tes premières compositions sont offertes.',
    abonnement: S.compoMessage || 'Pour composer d\'autres sujets, choisissez votre abonnement.',
    erreur: S.compoMessage || 'Le sujet n\'a pas pu être chargé.'
  };
  vue().innerHTML = `
  <div class="pad" style="padding-top:40px;text-align:center">
    ${logoSvg(44)}
    <h1 class="titre" style="font-size:24px;margin-top:16px">${titres[etat] || titres.erreur}</h1>
    <p class="sous" style="margin:10px 0 18px">${E(textes[etat] || textes.erreur)}</p>
    ${etat === 'connexion' ? `<button class="cta" data-modal="inscription">Créer mon compte</button>
      <button class="lien" data-modal="connexion">J'ai déjà un compte</button>` : ''}
    ${etat === 'abonnement' && S.compoDebloqueNotifs ? `<button class="cta" data-debloquer-notifs="1" style="margin-bottom:12px">Activer les notifications<small>Ta 4ᵉ composition offerte s'ouvre aussitôt</small></button>` : ''}
    ${etat === 'abonnement' ? blocPoint2() : ''}
    ${etat === 'erreur' ? `<button class="cta" data-compo-relancer="1">Réessayer</button>` : ''}
    ${etat !== 'chargement' ? `<button class="cta creux" style="margin-top:9px" data-go="revisions">Réviser en attendant</button>` : ''}
  </div>`;
}

/* « 3, 2, 1, c'est parti » : le départ se voit, puis le chrono s'allume */
function decompteDepart(){
  const zone = document.querySelector('.grille');
  if(!zone) return sonDepart();
  const d = document.createElement('div');
  d.className = 'decompte'; d.setAttribute('role', 'status'); d.setAttribute('aria-live', 'assertive');
  zone.appendChild(d);
  const etapes = ['3', '2', '1', 'C\'est parti !'];
  let i = 0;
  const suivant = () => {
    if(i >= etapes.length){
      d.remove();
      const c = document.getElementById('chrono');
      if(c){ c.classList.add('chrono-allume'); setTimeout(() => c.classList.remove('chrono-allume'), 9000); }
      return;
    }
    d.innerHTML = `<span class="${i === 3 ? 'parti' : ''}">${etapes[i]}</span>`;
    if(i < 3) bip(1); else { sonDepart(); annonceTemps('L\'épreuve commence. Bon courage.'); }
    i++;
    setTimeout(suivant, i === 4 ? 700 : 500);
  };
  suivant();
}
function ecranGrille(){
  if(S.compoEtat !== 'pret' || !S.grille.length){
    /* On n'ouvre le sujet qu'à la première demande. Après un échec ('erreur'),
       l'écran attend le bouton « Réessayer » : avant, chaque échec redessinait
       l'écran, qui relançait aussitôt la requête, sans fin ni pause. */
    if(!S.compoEtat || S.compoEtat === 'pret') ouvrirComposition();
    return ecranCompoAttente();
  }
  const rep = Object.keys(S.reponses).length;
  const nbQ = S.grille.length;
  const feuille = S.compoTab === 'feuille';
  /* le redessin ne doit jamais ramener le candidat en haut de la page */
  const corpsAvant = document.getElementById('corps');
  const hautAvant = corpsAvant ? corpsAvant.scrollTop : null;
  const ongletAvant = S.ongletRendu;
  vue().innerHTML = `
  <div class="grille">
    <div class="gr-tete">
      <div><h1 class="t">Votre feuille de composition</h1>
        <div class="eyebrow" style="color:#B5AC96">${S.epreuveCompo ? 'Composition nationale (simulation)' : 'Entraînement type ' + E(S.concours)} · ${nbQ} questions</div>
        <div class="gr-outils">
          <button class="gr-outil" data-quitter="1" aria-label="Quitter l'épreuve">${ico('sortie',14)}<span>Quitter</span></button>
          <button class="gr-outil" data-plein-ecran="1" aria-label="Plein écran">${ico('examen',14)}<span>${document.fullscreenElement ? 'Quitter le plein écran' : 'Plein écran'}</span></button>
        </div></div>
      <div style="text-align:right">
        <div class="gr-chrono ${couleurChrono(S.chrono, S.dureeCompo || 2400)}" id="chrono">${mmss(S.chrono)}</div>
        <div class="eyebrow" style="color:#B5AC96">temps restant</div></div>
    </div>
    <div class="sonnerie" id="sonnerie" role="status" aria-live="polite"></div>

    <div class="gr-onglets" role="tablist">
      <button class="${feuille?'':'on'} ${(feuille && !S.sujetVu)?'appel':''}" data-compotab="sujet" role="tab" aria-selected="${!feuille}">
        <span class="ico-tab">${ico('lire',15)}</span>Le sujet
        ${(feuille && !S.sujetVu)?'<i class="point"></i>':''}</button>
      <button class="${feuille?'on':''}" data-compotab="feuille" role="tab" aria-selected="${feuille}">
        <span class="ico-tab">${ico('grille',15)}</span>Feuille de réponses</button>
    </div>


    <div class="gr-corps ${feuille?'':'avec-scrub pile'}" id="corps">
      ${feuille ? feuilleOptique() : sujetComposition()}
    </div>

    ${feuille ? (S.sujetVu ? '' : `<button class="geste-feuille geste-sujet" data-compotab="sujet" aria-label="Aller au sujet pour lire les questions">
      <span class="fleche" aria-hidden="true">←</span><span>Glisser vers le sujet pour lire les questions</span></button>`)
      : `<button class="geste-feuille" data-compotab="feuille" aria-label="Aller à la feuille de réponses">
      <span>Glisser vers la feuille pour noircir la bonne réponse</span><span class="fleche" aria-hidden="true">→</span></button>`}

    ${feuille ? '' : `<div class="scrub" id="scrub" aria-hidden="true">
      <div class="rail-s"></div>
      <div class="poignee" id="poignee">⇕<span class="bulle-q" id="bulleQ"></span></div>
    </div>`}

    ${(feuille && S.apercu!==null) ? apercuQuestion() : ''}

    <div class="gr-pied compact">
      <div class="compteur-copie">
        <span class="cc-v num">${rep}</span><span class="cc-s num">/ ${nbQ}</span>
        <span class="cc-l">question${rep>1?'s':''} traitée${rep>1?'s':''}</span>
      </div>
      <button class="remettre" data-remettre="1">Remettre la copie</button>
    </div>
  </div>`;
  const corpsNeuf = document.getElementById('corps');
  if(corpsNeuf){
    if(S.cibleQuestion != null){ placerSurQuestion(corpsNeuf, feuille, S.cibleQuestion); S.cibleQuestion = null; }
    else if(hautAvant !== null && ongletAvant === S.compoTab) corpsNeuf.scrollTop = hautAvant;
  }
  S.ongletRendu = S.compoTab;
  brancherScrub();
  brancherSwipeComposition();
  brancherEnteteRepliable();
  if(!feuille) brancherPile();
  setTimeout(demoSwipeSiPremiere, 500);
  if(!S.timer && !S.corrige){
    /* Le téléphone affiche, le serveur décide. On se resynchronise à
       l'ouverture puis toutes les minutes : figer l'horloge locale ne
       donne plus une seconde de plus. */
    synchroniserChrono();
    if(S.sync) clearInterval(S.sync);
    S.sync = setInterval(synchroniserChrono, 60000);
    const total = S.dureeCompo || 2400;
    const mi = Math.floor(total / 2);
    /* sonnerie de départ : une seule fois par copie, au vrai début */
    if(S.compositionId && S.chrono >= total - 20 && S.departSonne !== S.compositionId){
      S.departSonne = S.compositionId;
      decompteDepart();
    }
    S.timer = setInterval(()=>{
      S.chrono--;
      const c = document.getElementById('chrono');
      if(c){
        c.textContent = mmss(S.chrono);
        peindreChrono(c, S.chrono, total);
      }
      if(S.chrono === mi){
        sonMiParcours(); annonceTemps('Mi-parcours : il reste ' + Math.round(S.chrono/60) + ' minutes');
      }
      if(S.chrono===300 && mi > 300){ bip(3); annonceTemps('Plus que 5 minutes'); }
      if(S.chrono===60){ bip(2); annonceTemps('Dernière minute'); }
      if(S.chrono<=0){ clearInterval(S.timer); S.timer=null; bip(4); remettre(); }
    },1000);
  }
}

/* --- curseur de navigation rapide ---
   BUG CORRIGÉ : chaque appel ajoutait de nouveaux écouteurs sur window
   sans jamais retirer les précédents. Au deuxième rendu de l'écran, les
   anciens écouteurs pointaient encore vers l'ancien #corps — détruit par
   le innerHTML suivant — pendant que le doigt du candidat déplaçait la
   poignée sur le nouveau. Résultat : la poignée bouge, le contenu reste
   figé. On détache maintenant systématiquement l'ancien jeu avant d'en
   poser un nouveau. */
let ecouteursScrub = null;
function brancherScrub(){
  if(ecouteursScrub){
    window.removeEventListener('pointermove', ecouteursScrub.suivre);
    window.removeEventListener('touchmove', ecouteursScrub.suivreTactile);
    window.removeEventListener('pointerup', ecouteursScrub.fin);
    window.removeEventListener('pointercancel', ecouteursScrub.fin);
    window.removeEventListener('touchend', ecouteursScrub.fin);
    ecouteursScrub = null;
  }
  const zone = document.getElementById('scrub');
  const main = document.getElementById('poignee');
  const corps = document.getElementById('corps');
  const bulle = document.getElementById('bulleQ');
  if(!zone || !main || !corps) return;
  const total = S.grille.length;

  const placer = (ratio)=>{
    const h = zone.clientHeight - main.offsetHeight;
    main.style.top = Math.round(ratio * h) + 'px';
    if(bulle) bulle.textContent = 'Question ' + Math.min(total, Math.max(1, Math.round(ratio*(total-1))+1));
  };
  const depuisScroll = ()=>{
    const max = corps.scrollHeight - corps.clientHeight;
    placer(max>0 ? corps.scrollTop/max : 0);
  };
  corps.addEventListener('scroll', depuisScroll);
  depuisScroll();

  let actif = false;
  const bouger = (clientY)=>{
    const r = zone.getBoundingClientRect();
    const h = zone.clientHeight - main.offsetHeight;
    let y = clientY - r.top - main.offsetHeight/2;
    y = Math.max(0, Math.min(h, y));
    const ratio = h>0 ? y/h : 0;
    placer(ratio);
    corps.scrollTop = ratio * (corps.scrollHeight - corps.clientHeight);
  };
  const debut = e=>{
    actif = true; zone.classList.add('actif');
    if(navigator.vibrate) navigator.vibrate(8);
    bouger(e.clientY);
    e.preventDefault(); e.stopPropagation();
  };
  zone.addEventListener('pointerdown', debut);
  zone.addEventListener('touchstart', e=>{ if(e.touches[0]) debut({clientY:e.touches[0].clientY, preventDefault:()=>e.preventDefault(), stopPropagation:()=>e.stopPropagation()}); }, {passive:false});

  const suivre = e=>{ if(actif) bouger(e.clientY); };
  const suivreTactile = e=>{ if(actif && e.touches[0]){ bouger(e.touches[0].clientY); e.preventDefault(); } };
  const fin = ()=>{ if(!actif) return; actif=false; zone.classList.remove('actif'); };

  window.addEventListener('pointermove', suivre);
  window.addEventListener('touchmove', suivreTactile, {passive:false});
  window.addEventListener('pointerup', fin);
  window.addEventListener('pointercancel', fin);
  window.addEventListener('touchend', fin);
  ecouteursScrub = { suivre, suivreTactile, fin };
}

/* =====================================================================
   SWIPE — bascule tactile entre le sujet et la feuille de réponses
   ===================================================================== */
let ecouteursSwipeCompo = null;
function brancherSwipeComposition(){
  if(ecouteursSwipeCompo){
    ecouteursSwipeCompo.zone.removeEventListener('touchstart', ecouteursSwipeCompo.debut);
    ecouteursSwipeCompo.zone.removeEventListener('touchmove', ecouteursSwipeCompo.bouge);
    ecouteursSwipeCompo.zone.removeEventListener('touchend', ecouteursSwipeCompo.fin);
    ecouteursSwipeCompo = null;
  }
  const zone = document.getElementById('corps');
  if(!zone) return;
  let x0 = 0, y0 = 0, tranche = null;   // tranche : 'h' horizontal, 'v' vertical, ou null tant qu'indécis

  const debut = e => {
    if(e.touches.length !== 1) return;
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; tranche = null;
  };
  const bouge = e => {
    if(!e.touches[0]) return;
    const dx = e.touches[0].clientX - x0, dy = e.touches[0].clientY - y0;
    if(tranche === null && (Math.abs(dx) > 12 || Math.abs(dy) > 12)){
      /* on tranche une seule fois par geste : au premier déplacement net,
         horizontal ou vertical, on s'y tient jusqu'au relâchement. Un
         swipe vertical ne bascule jamais la page, un swipe horizontal
         ne fait jamais défiler le sujet. */
      tranche = Math.abs(dx) > Math.abs(dy) * 1.3 ? 'h' : 'v';
    }
    if(tranche === 'h') e.preventDefault();   // on bloque le scroll vertical le temps du swipe horizontal
  };
  const fin = e => {
    if(tranche !== 'h') return;
    const dx = (e.changedTouches[0] ? e.changedTouches[0].clientX : x0) - x0;
    if(Math.abs(dx) < 60) return;
    if(dx < 0 && !S.compoTab || S.compoTab === 'sujet'){ if(dx < 0) basculerCompoTab('feuille'); }
    if(dx > 0 && S.compoTab === 'feuille') basculerCompoTab('sujet');
  };

  zone.addEventListener('touchstart', debut, { passive:true });
  zone.addEventListener('touchmove', bouge, { passive:false });
  zone.addEventListener('touchend', fin, { passive:true });
  ecouteursSwipeCompo = { zone, debut, bouge, fin };
}

/* La question où le candidat s'est arrêté, retrouvée à l'identique dans l'autre onglet.
   On travaille toujours avec une « ligne d'ancrage » : la question posée sur cette ligne
   est celle qu'on lit, et l'autre onglet pose la même question sur sa propre ligne.
   Sans cette règle commune, chaque aller-retour décalait la position de deux questions. */
const ANCRE_FEUILLE = 56, ANCRE_SUJET = 10;
function questionCourante(){
  const c = document.getElementById('corps');
  if(!c) return null;
  const feuille = S.compoTab === 'feuille';
  const els = c.querySelectorAll(feuille ? '.ligne-op' : '.sujet-q');
  if(!els.length) return null;
  const zr = c.getBoundingClientRect();
  const ligne = zr.top + (feuille ? ANCRE_FEUILLE : ANCRE_SUJET) + 4;
  if(!feuille){
    for(let i = 0; i < els.length; i++){ if(els[i].getBoundingClientRect().bottom > ligne) return i; }
    return els.length - 1;
  }
  /* la feuille est courte : la question visée ne peut pas toujours monter jusqu'à l'ancre.
     Tant que le candidat n'a pas fait défiler la feuille, la question visée reste la bonne. */
  if(S.qRef != null && S.poseScroll != null && Math.abs(c.scrollTop - S.poseScroll) < 6 && S.qRef < els.length) return S.qRef;
  /* sur la feuille : la dernière question noircie, si elle est encore à l'écran */
  if(S.derniereQ != null && S.derniereQ < els.length){
    const r = els[S.derniereQ].getBoundingClientRect();
    if(r.bottom > zr.top + 4 && r.top < zr.bottom - 4) return S.derniereQ;
  }
  /* la feuille est rangée en colonnes (1-25 à gauche, 26-50 à droite) : à une même hauteur
     il y a une question par colonne. On garde la colonne où le candidat travaillait. */
  const gauche = els[0].getBoundingClientRect().left;
  let lignes = 0;
  while(lignes < els.length && Math.abs(els[lignes].getBoundingClientRect().left - gauche) < 3) lignes++;
  let l = 0;
  for(; l < lignes - 1; l++){ if(els[l].getBoundingClientRect().bottom > ligne) break; }
  const ref = S.qRef != null ? S.qRef : 0;
  const colonne = Math.min(Math.floor(ref / Math.max(1, lignes)), Math.floor((els.length - 1) / Math.max(1, lignes)));
  return Math.min(els.length - 1, colonne * lignes + l);
}
function placerSurQuestion(corps, feuille, i){
  const els = corps.querySelectorAll(feuille ? '.ligne-op' : '.sujet-q');
  const el = els[Math.min(i, els.length - 1)];
  if(!el) return;
  const dy = el.getBoundingClientRect().top - corps.getBoundingClientRect().top;
  corps.scrollTop = Math.max(0, corps.scrollTop + dy - (feuille ? ANCRE_FEUILLE : ANCRE_SUJET));
  S.poseScroll = corps.scrollTop;
}
function basculerCompoTab(cible){
  if(S.compoTab === cible) return;
  S.cibleQuestion = questionCourante();
  if(S.cibleQuestion != null) S.qRef = S.cibleQuestion;
  const zone = document.getElementById('corps');
  if(zone) zone.classList.add(cible === 'feuille' ? 'glisse-gauche' : 'glisse-droite');
  S.compoTab = cible;
  if(cible === 'sujet') S.sujetVu = true;
  ecrireReglage('swipeCompoVu', true);   // le geste a servi : plus besoin de la démo
  ecranGrille();
}

/* Démonstration du swipe, une seule fois, à la première composition. */
function demoSwipeSiPremiere(){
  if(lireReglages().swipeCompoVu) return;
  const zone = document.getElementById('corps');
  if(!zone || document.getElementById('demo-swipe')) return;
  const versFeuille = S.compoTab === 'sujet';
  const d = document.createElement('div');
  d.id = 'demo-swipe';
  d.className = versFeuille ? 'vers-gauche' : 'vers-droite';
  d.innerHTML = `<div class="piste-doigt"><div class="doigt"></div></div>
    <span>${versFeuille ? 'Glissez vers la gauche pour cocher sur la feuille' : 'Glissez vers la droite pour lire le sujet'}</span>
    <small>Glissez dans l'autre sens pour revenir</small>`;
  document.querySelector('.grille').appendChild(d);
  const fermer = () => { d.classList.remove('joue'); setTimeout(() => d.remove(), 250); };
  d.addEventListener('pointerdown', fermer, { once:true });
  setTimeout(() => { d.classList.add('joue'); }, 200);
  setTimeout(fermer, 4200);
}

/* Le sujet en pile : en descendant, la question lue monte, s'estompe et
   laisse la place à la suivante. Le défilement s'arrête sur chaque question. */
function brancherPile(){
  const corps = document.getElementById('corps');
  if(!corps || !corps.classList.contains('pile')) return;
  const cartes = [...corps.querySelectorAll('.sujet-q')];
  let attente = false;
  const peindre = () => {
    attente = false;
    const haut = corps.getBoundingClientRect().top;
    for(const c of cartes){
      const r = c.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (haut - r.top) / Math.max(1, r.height)));
      const o = p ? String(+(1 - p * 0.85).toFixed(3)) : '';
      if(c.style.opacity !== o){
        c.style.opacity = o;
        c.style.transform = p ? `translateY(${(p * 12).toFixed(1)}px) scale(${(1 - p * 0.05).toFixed(3)})` : '';
      }
    }
  };
  corps.addEventListener('scroll', () => { if(!attente){ attente = true; requestAnimationFrame(peindre); } }, { passive:true });
  peindre();
}

/* =====================================================================
   EN-TÊTE REPLIABLE — se compacte pendant la lecture du sujet, se
   redéploie dès qu'on remonte. Basé sur le sens réel du défilement,
   jamais sur une simple position.
   ===================================================================== */
let ecouteurEnteteRepliable = null;
function brancherEnteteRepliable(){
  if(ecouteurEnteteRepliable){
    const ancien = document.getElementById('corps');
    if(ancien) ancien.removeEventListener('scroll', ecouteurEnteteRepliable);
    ecouteurEnteteRepliable = null;
  }
  const corps = document.getElementById('corps');
  const tete = document.querySelector('.gr-tete');
  if(!corps || !tete) return;
  let dernier = corps.scrollTop, accumule = 0;
  const suivre = () => {
    const y = corps.scrollTop, dy = y - dernier;
    dernier = y;
    if(y < 12){ tete.classList.remove('replie'); accumule = 0; return; }
    accumule += dy;
    if(accumule > 40){ tete.classList.add('replie'); accumule = 0; }
    else if(accumule < -30){ tete.classList.remove('replie'); accumule = 0; }
  };
  corps.addEventListener('scroll', suivre, { passive:true });
  ecouteurEnteteRepliable = suivre;
}

/* --- la feuille de sujet : lecture seule --- */
function sujetComposition(){
  return `
    ${S.grille.map((g,qi)=>{
      const r = S.reponses[qi] || [];
      return `<div class="sujet-q" id="q${qi+1}">
        <div class="sq-tete"><span class="sq-no">Question ${qi+1}</span>
          ${r.length?`<span class="sq-fait">répondu · ${r.map(x=>'ABCD'[x]).join(', ')}</span>`:''}</div>
        <div class="sq-tx">${E(g.q)}</div>
        <div class="props">
          ${g.o.map((o,i)=>`<div class="prop"><b>${'abcd'[i]}</b><span>${E(o)}</span></div>`).join('')}
        </div>
      </div>`;
    }).join('')}

    <button class="cta-feuille" data-compotab="feuille">Aller à la feuille de réponses →</button>
    <div class="fin-sujet">Fin du sujet</div>`;
}

/* --- aperçu d'une question sans quitter la feuille --- */
function apercuQuestion(){
  const qi = S.apercu, g = S.grille[qi], r = S.reponses[qi] || [];
  return `
  <div class="apercu">
    <div class="ap-tete"><span>QUESTION ${qi+1}</span>
      <button class="ap-x" data-apercu="fermer" aria-label="Fermer">✕</button></div>
    <div class="ap-tx">${E(g.q)}</div>
    <div class="ap-props">
      ${g.o.map((o,i)=>`<span class="${r.includes(i)?'pris':''}"><b>${'abcd'[i]})</b> ${E(o)}</span>`).join('')}
    </div>
    <div class="ap-nav">
      <button data-apercu="${Math.max(0,qi-1)}">← précédente</button>
      <span class="num">${qi+1} / ${S.grille.length}</span>
      <button data-apercu="${Math.min(S.grille.length-1,qi+1)}">suivante →</button>
    </div>
  </div>`;
}

/* --- la feuille optique : 1 à 50, choix multiples --- */
function feuilleOptique(){
  return `
    <div class="feuille">
      <div class="feuille-tete"><span>${E((S.util.nom || 'CANDIDAT').toUpperCase())}</span><span>${S.sujetRef ? 'SUJET N° ' + E(S.sujetRef) : ''}</span></div>
      <p class="feuille-consigne">Vous devez obligatoirement répondre sur cette feuille. Noircissez le ou les cercles correspondant aux bonnes réponses. <b>Un cercle noirci ne peut plus être effacé.</b></p>
      <div class="opt-grille">
        ${S.grille.map((g,qi)=>{
          const r = S.reponses[qi] || [];
          return `<div class="ligne-op ${r.length?'faite':''}">
            <button class="n ${S.apercu===qi?'ouvert':''}" data-apercu="${qi}" aria-label="Lire la question ${qi+1}">${qi+1}</button>
            ${g.o.map((o,i)=>{
              const choisi = r.includes(i);
              let c = choisi?'noirci':'';
              if(S.corrige && g.bonnes){ const bon = g.bonnes.includes(i); c = choisi ? (bon?'ok':'ko') : (bon?'vraie':''); }
              return `<button class="pastille-op ${c}" data-b="${qi}-${i}" ${choisi&&!S.corrige?'disabled':''}
                aria-label="Question ${qi+1}, réponse ${'ABCD'[i]}" aria-pressed="${choisi}">${'ABCD'[i]}</button>`;
            }).join('')}
          </div>`;
        }).join('')}
      </div>
      <div class="feuille-pied"><span>NE RIEN ÉCRIRE DANS CETTE ZONE</span></div>
    </div>`;
}

function remettre(){
  if(S.corrige) return;
  const cr = document.getElementById('confirm-remise'); if(cr) cr.remove();
  if(S.timer){clearInterval(S.timer);S.timer=null;}
  S.corrige = true; S.taches[1] = true; sauverTaches(); S.sessionCounter++;
  noterSucces('composition');
  S.remiseEtat = 'envoi'; S.grilleNote = null;
  pister('COMPOSITION_SUBMITTED', { traitees: Object.keys(S.reponses).length, restant_s: S.chrono });
  sauverEpreuve();
  cloturerComposition();
  rendre();
  const corps = document.getElementById('corps');
  if(corps){
    const sc = document.createElement('div'); sc.className='scan'; corps.appendChild(sc);
    setTimeout(()=>{ sc.remove(); aller('copie'); }, 1600);
  } else aller('copie');
}

/* Lecture de la copie corrigée : vrai seulement si le serveur a corrigé. */
function bilanCopie(grille, reponses){
  const justes = [], fausses = [], blancs = [];
  grille.forEach((g, i) => {
    const r = reponses[i] || [];
    const bonnes = g.bonnes || [];
    if(!r.length) blancs.push(i);
    else if(bonnes.length && r.length === bonnes.length && r.every(x => bonnes.includes(x))) justes.push(i);
    else fausses.push(i);
  });
  return { justes, fausses, blancs };
}

/* Une analyse qui ne s'affiche que si la copie la justifie. */
function analyseCopie(grille, reponses){
  const n = grille.length;
  if(n < 20) return null;
  const { justes } = bilanCopie(grille, reponses);
  const moitie = Math.floor(n / 2);
  const avant = justes.filter(i => i < moitie).length, apres = justes.filter(i => i >= moitie).length;
  const tauxA = Math.round(100 * avant / moitie), tauxB = Math.round(100 * apres / (n - moitie));
  const repondues = Object.keys(reponses).length;
  if(repondues < n * 0.5) return { titre:'Copie très incomplète', texte:`Vous avez noirci ${repondues} question${repondues>1?'s':''} sur ${n}. Avant de travailler le fond, travaillez le rythme : visez toutes les questions dans le temps donné.` };
  if(tauxA - tauxB >= 15) return { titre:`Votre réussite baisse en seconde moitié`, texte:`${tauxA} % de bonnes réponses sur les questions 1 à ${moitie}, ${tauxB} % sur les questions ${moitie+1} à ${n}. C'est souvent la fatigue ou le temps : entraînez-vous à composer d'une traite.` };
  if(tauxB - tauxA >= 15) return { titre:`Démarrage lent`, texte:`${tauxA} % sur la première moitié, ${tauxB} % sur la seconde. Les premières questions méritent la même attention que les dernières.` };
  return null;
}

function ecranCopie(){
  if(S.remiseEtat === 'envoi' || (S.remiseEtat !== 'ok' && S.remiseEtat !== 'erreur')){
    vue().innerHTML = `<div class="pad" style="padding-top:60px;text-align:center">
      <div class="attente" role="status" aria-label="Correction en cours"></div>
      <h1 class="titre" style="font-size:22px">Correction en cours</h1>
      <p class="sous">Le serveur lit votre feuille.</p></div>`;
    return;
  }
  if(S.remiseEtat === 'erreur'){
    vue().innerHTML = `<div class="pad" style="padding-top:44px;text-align:center">
      <h1 class="titre" style="font-size:22px">La copie n'est pas encore corrigée</h1>
      <p class="sous" style="margin:10px 0 18px">${E(S.remiseMessage || 'Envoi impossible.')}</p>
      ${S.compositionId ? `<button class="cta" data-remise-relancer="1">Renvoyer ma copie</button>` : ''}
      <button class="cta creux" style="margin-top:9px" data-go="aujourdhui">Revenir à l'actualité</button></div>`;
    return;
  }
  if(S.correctionLe){
    const fin = new Date(S.correctionLe);
    const passe = Date.now() >= fin.getTime();
    vue().innerHTML = `
    <div class="copie">
      <button class="retourhaut" data-go="aujourdhui">Retour</button>
      <div class="eyebrow">Composition nationale (simulation) · copie remise</div>
      <h1 class="titre" style="margin-bottom:10px">Votre copie<br>est remise</h1>
      <div class="cachet-note"><div class="n num">${S.grilleNote ?? 0} / ${S.grille.length}</div>
        <div class="l">votre note</div></div>
      <div class="carte" style="margin-top:14px">
        <p class="sous">${passe
          ? 'L\'épreuve est terminée : le corrigé et le classement national sont disponibles.'
          : `Les autres candidats composent encore. Le corrigé et le classement national seront publiés à <b>${fin.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</b>, à la fin de l'épreuve.`}</p>
      </div>
      ${passe ? `<button class="cta" style="margin-top:14px" data-correction-differee="1">Afficher ma correction</button>` : ''}
      ${S.epreuveRemise ? `<button class="cta ${passe ? 'creux' : ''}" style="margin-top:9px" data-gagnants="${E(S.epreuveRemise)}">Voir le classement</button>` : ''}
      <button class="cta creux" style="margin-top:9px" data-go="aujourdhui">Revenir à l'actualité</button>
    </div>`;
    return;
  }
  const n = S.grilleNote ?? 0, total = S.grille.length;
  const seuil = S.seuil, admis = seuil !== null && n >= seuil;
  const pos = Math.min(100, total ? n/total*100 : 0);
  const { fausses, blancs } = bilanCopie(S.grille, S.reponses);
  const analyse = analyseCopie(S.grille, S.reponses);
  const utilise = S.dureeUtilisee ?? ((S.dureeCompo || 2400) - S.chrono);
  vue().innerHTML = `
  <div class="copie">
    <button class="retourhaut" data-go="aujourdhui">Retour</button>
    <div class="eyebrow">Copie corrigée · ${new Date().toLocaleDateString('fr-FR',{day:'numeric',month:'long'})}${S.sujetRef ? ' · <span style="white-space:nowrap">sujet n° ' + E(S.sujetRef) + '</span>' : ''}</div>
    <h1 class="titre" style="margin-bottom:10px">Votre feuille<br>est corrigée</h1>

    <div class="carte-identite">
      <div class="av">${(function(){
        const m = (S.util.nom||'Candidat').trim().split(/\s+/).filter(Boolean);
        return E((m.length>1 ? m[0][0]+m[m.length-1][0] : (m[0]||'C').slice(0,2)).toUpperCase());
      })()}</div>
      <div class="qui">
        <b>${E(S.util.nom || 'Candidat')}</b>
        <span>Entraînement type ${E(S.concours || 'concours direct')}</span>
      </div>
      <div class="note-mini"><b class="num">${n}</b><i>/ ${total}</i></div>
    </div>

    <div class="cachet-note ${admis?'admis':''}">
      <div class="n num">${n} / ${total}</div>
      <div class="l">${seuil === null ? Math.round(pos) + ' % de bonnes réponses' : (admis ? 'au-dessus du seuil connu' : 'sous le seuil connu')}</div>
    </div>

    <div class="barre-seuil">
      <div class="piste"></div>
      <div class="moi" style="width:${pos}%"></div>
      ${seuil !== null ? `<div class="seuil" style="left:${seuil/total*100}%"></div>
      <div class="etq" style="left:${seuil/total*100}%">Seuil du dernier admis</div>` : ''}
    </div>
    ${seuil !== null ? `<p class="sous">${admis
      ? 'Vous êtes au-dessus du seuil du dernier admis de ce concours. Le seuil bouge d\'une année à l\'autre : gardez de la marge.'
      : `Il vous manque ${seuil-n} bonne${seuil-n>1?'s':''} réponse${seuil-n>1?'s':''} pour atteindre le seuil du dernier admis de ce concours.`}</p>` : ''}

    ${peutFeuilleDetaillee() ? `
    <button class="cta" data-feuille="1" style="margin-top:16px">${ico('telecharger',17)} Télécharger ma composition corrigée<small>Analyse, recommandations, puis le sujet complet corrigé</small></button>
    <button class="cta creux" data-lire-feuille="1" style="margin-top:8px">${ico('lire',17)} Lire directement ma feuille corrigée<small>Sans rien télécharger</small></button>` : ''}
    ${fausses.length ? `<button class="cta creux" data-erreursdusoir="1" style="margin-top:9px">Reprendre mes fautes maintenant<small>${fausses.length} question${fausses.length>1?'s':''} dans « Mes erreurs »</small></button>` : ''}
    <button class="cta creux" data-recommencer="neuve" style="margin-top:9px">Nouvelle composition<small>Le sujet que vous avez le moins composé</small></button>

    <div class="bloc">
      <div class="libelle">Ce que dit la copie</div>
      <div class="carte">
        <div class="mat"><div class="nom">Questions noircies<em>Sur ${total} · les blanches ne rapportent rien</em></div><div class="val num">${Object.keys(S.reponses).length}</div></div>
        <div class="mat"><div class="nom">Temps utilisé<em>Sur ${Math.round((S.dureeCompo || 2400)/60)} minutes accordées</em></div><div class="val num">${mmss(Math.max(0, utilise))}</div></div>
        <div class="mat"><div class="nom">Fautes ajoutées à « Mes erreurs »<em>Elles reviennent jusqu'à être acquises</em></div><div class="val num">${fausses.length}</div></div>
        ${blancs.length ? `<div class="mat"><div class="nom">Questions laissées blanches</div><div class="val num">${blancs.length}</div></div>` : ''}
        ${analyse ? `<div class="copie-retenir"><b>${E(analyse.titre)}</b><p>${E(analyse.texte)}</p></div>` : ''}
      </div>
    </div>

    ${blocMatieresCopie(S.grille, S.reponses, n, total)}
    ${blocPoint3(seuil, n, admis)}

    <button class="cta creux" data-carte-resultat="copie" style="margin-top:14px">${ico("partage",15)} Partager ma carte de résultat<small>Une image avec votre note, le logo et le QR code</small></button>
    <button class="cta discret" data-partage="performance" style="margin-top:9px">${ico("partage",15)} Partager<small>WhatsApp, Facebook, ou copier le lien</small></button>
  </div>`;
}

/* Point 3 : sous « À travailler en priorité ». La note et le détail par matière restent gratuits. */
function blocPoint3(seuil, n, admis){
  if(S.gratuit || estAbonne()) return '';
  const mats = bilanMatieres(S.grille, S.reponses).filter(x => x.n > 0).sort((a, b) => a.j / a.n - b.j / b.n).slice(0, 2).map(x => x.nom);
  const manque = (seuil !== null && !admis) ? seuil - n : 0;
  const bloquee = !peutFeuilleDetaillee();
  const offre = bloquee && peutProposer(3) && !S.copiePlusTard;
  return `
    ${manque > 0 ? `<div class="carte" style="margin-top:14px"><p class="sous" style="margin:0"><b>Il te manque ${manque} point${manque > 1 ? 's' : ''} pour le seuil.</b> Ta feuille détaillée te dit quoi réviser en premier.</p></div>` : ''}
    ${offre ? `<div class="carte" style="margin-top:14px;text-align:left">
      <p class="sous" style="margin:0 0 10px"><b>Vous avez atteint les limites de l'abonnement gratuit.</b> Faites l'abonnement pour débloquer la feuille détaillée : ${mats.length ? E(mats.join(' et ')) : 'tes matières faibles'}, question par question, avec l'explication de chaque faute.</p>
      ${offreDeuxPrix()}
      <button class="lien-mini" style="margin-top:8px" data-copie-plus-tard="1">Plus tard</button>
    </div>` : (bloquee ? `<p class="sous" style="margin-top:14px;font-size:12.5px">La feuille détaillée fait partie de l'abonnement. <button class="lien-mini" data-go="abonnement">Voir mon abonnement</button></p>` : '')}`;
}

/* =====================================================================
   ÉCRAN 5 — MON CAHIER
   ===================================================================== */
let repriseIdx = null, repriseRep = undefined;
/* « Où se concentrent mes erreurs ? » — hiérarchie visuelle forte,
   pour que le candidat voie en un regard où porter son effort. */
function repartitionErreurs(list){
  if(list.length < 3) return '';   // pas assez de matière pour qu'un classement ait un sens
  const parMatiere = {};
  list.forEach(e => {
    const m = e.matiere || 'Autres';
    (parMatiere[m] = parMatiere[m] || []).push(e);
  });
  const matieres = Object.entries(parMatiere).sort((a,b) => b[1].length - a[1].length);
  const pire = matieres[0][1].length;

  return `
  <div class="carte concentration">
    <div class="libelle" style="margin-bottom:2px">Où se concentrent mes erreurs ?</div>
    <p class="sous" style="margin:0 0 14px">La matière la plus haute mérite votre prochaine séance.</p>
    ${matieres.slice(0, 5).map(([m, es]) => {
      const parNotion = {};
      es.forEach(e => { const n = e.theme || 'Général'; parNotion[n] = (parNotion[n]||0) + 1; });
      const notions = Object.entries(parNotion).sort((a,b) => b[1]-a[1]).slice(0, 3);
      return `<div class="conc-ligne">
        <div class="conc-tete">
          <b>${E(m)}</b><span class="num">${es.length} erreur${es.length>1?'s':''}</span></div>
        <div class="conc-barre"><i style="width:${Math.round(es.length/pire*100)}%"></i></div>
        ${notions.length ? `<div class="conc-notions">${notions.map(([n,c]) =>
          `<span>${E(n)} — ${c}</span>`).join('')}</div>` : ''}
      </div>`;
    }).join('')}
  </div>`;
}

function ecranCahier(){
  let list = aReprendre();
  const scoreSession = e => (S.cahierDepuisGrille && e.session===S.sessionCounter) ? 1 : 0;
  list = [...list].sort((a,b)=> (scoreSession(b)-scoreSession(a)) || (joursRestants(a)-joursRestants(b)));
  if(S.cahierFiltre) list = [...list].sort((a,b)=>b.rate-a.rate);
  const vueC = S.cahierVue === 'jour' ? 'jour' : 'toutes';
  const nDiff = list.filter(e => e.rate >= 2 && e.suite < 3).length;
  if(vueC === 'jour') list = list.filter(e => joursRestants(e) === 0 && e.suite < 3);
  const closes = S.cahier.filter(e=>e.suite>=3);
  if(repriseIdx !== null && S.cahier[repriseIdx]){ return ecranReprise(); }
  repriseIdx = null; repriseRep = undefined;   // la liste a changé entre-temps : retour à la liste
  vue().innerHTML = `
  <div class="pad">
    <div class="eyebrow">Mes erreurs · ce qui reste à corriger</div>
    <h1 class="titre">${ouvertes()} erreur${ouvertes()>1?'s':''}<br>non traitée${ouvertes()>1?'s':''}</h1>
    ${S.cahierDepuisGrille && list.some(e=>e.session===S.sessionCounter)?`<div class="carte" style="margin-top:12px;border-color:var(--vert-bord);background:var(--vert-fond)">
      <div style="font-size:12.5px;font-weight:600;margin-bottom:4px">Tes erreurs de cette composition, en premier</div>
      <p class="sous">Elles remontent en tête tant que tu ne les as pas revues.</p></div>`:''}
    ${S.cahierFiltre?`<div class="carte" style="margin-top:12px;border-color:var(--rouge-bord);background:var(--rouge-fond)">
      <div style="font-size:12.5px;font-weight:600;margin-bottom:4px">Erreurs les plus fréquentes d'abord</div>
      <p class="sous">Triées par nombre de rechutes. Ce sont celles qui te coûteront le plus cher le jour du concours.</p>
      <button class="voirplus" style="margin-top:9px" data-toutcahier="1">VOIR TOUT LE CAHIER</button></div>`:''}

    <div class="onglets" style="margin-top:12px" role="group" aria-label="Filtrer mes erreurs">
      <button class="${vueC==='toutes'?'on':''}" data-cahier-vue="toutes">Toutes</button>
      <button class="${vueC==='jour'?'on':''}" data-cahier-vue="jour">Aujourd'hui · ${dues()}</button>
    </div>
    ${S.details && typeof S.details.erreurs_mois === 'number' ? `<p class="sous" style="margin-top:10px">Ce mois-ci : <b class="num">${S.details.erreurs_mois}</b> réponse${S.details.erreurs_mois>1?'s':''} fausse${S.details.erreurs_mois>1?'s':''} · <b class="num">${S.details.refermees_total || 0}</b> erreur${(S.details.refermees_total||0)>1?'s':''} refermée${(S.details.refermees_total||0)>1?'s':''} depuis le début.</p>` : ''}
    ${nDiff ? `<div class="conseil-err">${ico('drapeau',14)}<p><b>${nDiff} question${nDiff>1?'s':''} ratée${nDiff>1?'s':''} au moins deux fois.</b> Lis l'explication lentement, écris-toi une note, puis reprends-les une par une.</p></div>` : ''}
    ${ouvertes() ? `<button class="cta creux btn-cahier" style="margin-top:12px" data-export-cahier="1">${ico('telecharger',17)} Télécharger mon cahier d'erreurs en PDF</button>
    <button class="cta creux btn-cahier" style="margin-top:8px" data-lire-cahier="1">${ico('lire',17)} Voir mon cahier d'erreurs directement ici</button>` : ''}
    ${list.length ? `
    <div class="bloc">
      ${vueC === 'toutes' ? repartitionErreurs(list) : ''}
      <div class="libelle" style="margin-top:16px">Toutes mes erreurs<span class="num">${dues()} à revoir sur ${list.length}</span></div>
      ${list.map(e=>{
        const idx = S.cahier.indexOf(e);
        const j = joursRestants(e);
        const validee = recemmentValidee(e);
        return `<div class="err${validee?' err-validee':''}">
          <div class="q">${E(e.q)}</div>
          ${e.mien ? `<div class="ligne">Votre dernière réponse : « ${E(e.mien)} »</div>` : ''}
          <div class="ligne">Bonne réponse : <b>${E(e.bon)}</b></div>
          <div class="ligne" style="margin-top:6px;color:var(--craie2)">${E(e.note)}</div>
          ${e.rate >= 3 ? `<div class="alerte-err">${ico('drapeau',13)} Revenue ${e.rate} fois : prends le temps de comprendre pourquoi.</div>` : ''}
          ${e.id ? (S.noteOuverte === e.id
            ? `<div class="note-perso"><textarea id="note-${E(e.id)}" maxlength="300" rows="2" placeholder="Ex. : je confonds toujours le Premier ministre et le président de l'Assemblée.">${E(e.notePerso || '')}</textarea>
                <button class="mini" data-note-save="${E(e.id)}">Enregistrer</button></div>`
            : (e.notePerso ? `<button class="lien-mini" data-note-edit="${E(e.id)}">${ico('coche',13)} Note enregistrée · la relire</button>`
              : `<button class="lien-mini" data-note-edit="${E(e.id)}">${ico('lire',13)} Ajouter une note personnelle</button>`)) : ''}
          <div class="pied">
            ${validee
              ? `<span class="echeance ok">✓ VALIDÉE</span>`
              : `<span class="echeance ${j===0?'du':''}">${j===0?'À REPRENDRE AUJOURD\'HUI':'DANS '+j+' JOUR'+(j>1?'S':'')}</span>`}
            <span class="acquis">${[0,1,2].map(i=>`<i class="${i<e.suite?'on':''}"></i>`).join('')}</span>
            ${validee ? '' : `<button class="reprendre ${j===0?'':'valider'}" data-reprise="${idx}">${j===0?'Reprendre':'Valider'}</button>`}
          </div>
        </div>`;
      }).join('')}
    </div>` : `
    <div class="vide"><div class="g">✓</div>Le cahier est vide.<br>Tout ce que vous aviez raté est acquis.<br><br>
      <span class="eyebrow">La prochaine Grille le remplira à nouveau. C'est le but.</span></div>`}

    ${closes.length ? `
    <div class="bloc">
      <div class="libelle">Refermées<span class="num">${closes.length}</span></div>
      ${closes.map(e=>`<div class="err close">
        <div class="q" style="font-size:13px">${E(e.q)}</div>
        <div class="ligne"><b>${E(e.bon)}</b> · trois bonnes réponses d'affilée</div>
      </div>`).join('')}
    </div>`:''}

  </div>`;
}
function ecranReprise(){
  const e = S.cahier[repriseIdx];
  const rep = repriseRep;
  const juste = rep === e.i;
  vue().innerHTML = `
  <div class="qzone">
    <button class="retourhaut" data-sortir-reprise="1" style="margin-bottom:12px">Retour</button>
    <div class="qmeta"><span>REPRISE · CAHIER</span><span>RATÉE ${e.rate} FOIS</span></div>
    <div class="rep-bloc ${juste && e.suite >= 3 ? 'dissout' : ''}">
    <div class="qtexte">${E(e.q)}</div>
    ${e.opts.map((o,i)=>{
      let c='';
      if(rep!==undefined){ if(i===e.i) c='juste'; else if(i===rep) c='faux'; }
      return `<button class="opt ${c}" ${rep!==undefined?'disabled':''} data-rr="${i}"><span class="lettre">${'ABCD'[i]}</span>${E(o)}</button>`;
    }).join('')}
    </div>
    ${rep!==undefined?`
      <div class="retour ${juste?'bien':'mal'}">
        <b>${juste?(e.suite>=3?'Acquise — elle disparaît de la liste':(e.suite > 0 ? `Juste · ${e.suite} sur 3 · revient dans ${PALIERS[Math.min(e.suite-1,2)]} jours` : 'Juste')):'Encore ratée — le compteur repart à zéro, reprise aujourd\'hui'}</b>${e.note}
      </div>
      <div style="margin:14px 0 12px;display:flex;align-items:center;gap:10px">
        <span class="acquis">${[0,1,2].map(i=>`<i class="${i<e.suite?'on':''}"></i>`).join('')}</span>
        <span class="eyebrow">${e.suite>=3?'refermée':'trois bonnes réponses d\'affilée pour la refermer'}</span>
      </div>
      ${e.id ? `<div class="actions-q" style="margin:-4px 0 10px"><button class="lien-mini" data-signaler="${E(e.id)}">${ico('drapeau',13)} Signaler une erreur dans cette question</button></div>` : ''}
      <button class="cta" data-fin-reprise="1">Continuer</button>`:''}
  </div>`;
}

/* =====================================================================
   ÉCRAN 6 — PARCOURS
   ===================================================================== */

/* Les récompenses se calculent à partir des vraies statistiques du candidat. */
function recompenses(){
  const st = S.stats || {};
  const q = st.questions_resolues || 0, serie = st.serie || 0, jours = st.record || 0;
  const compo = st.compositions || 0, acquises = st.erreurs_acquises || 0;
  const palier = (c, t, valeur, cible, unite) => ({ c, t, on: valeur >= cible,
    d: valeur >= cible ? 'Obtenue' : `${valeur} sur ${cible}${unite ? ' ' + unite : ''}` });
  return [
    palier('50', '50 questions', q, 50),
    palier('250', '250 questions', q, 250),
    palier('1000', '1 000 questions', q, 1000),
    palier('×3', 'En progression : 3 jours d\'affilée', serie, 3, 'jours'),
    palier('×7', '7 jours d\'affilée', serie, 7, 'jours'),
    palier('R14', 'Régulier : 14 jours de travail', jours, 14, 'jours'),
    palier('50 %', 'Composition réussie (25/50 ou plus)', st.meilleure_note || 0, 25, 'points'),
    palier('×30', '30 jours de travail', jours, 30, 'jours'),
    palier('C1', 'Première composition', compo, 1),
    palier('C10', '10 compositions', compo, 10),
    palier('E10', '10 erreurs refermées', acquises, 10),
    palier('E50', '50 erreurs refermées', acquises, 50)
  ];
}

/* =====================================================================
   COMMUNAUTÉ
   L'écran, ses styles et ses échanges avec la base sont dans
   communaute.js et communaute.css : ils ne se téléchargent qu'à la
   première visite, pour que ceux qui n'y vont pas ne paient rien.
   Ici : la tuile de « Mon compte », le compteur et l'accès.
   ===================================================================== */
const COMM_VERSION = 6;
const LIEN_UUID = /^[0-9a-f-]{36}$/i;
/* « Plus de 700 candidats » : arrondi à la centaine inférieure, donc toujours vrai */
function candidatsCommunaute(){
  const n = S.commInfo && S.commInfo.membres;
  if(n === undefined || n === null) return 'Plus de 700 candidats';
  return n >= 100 ? 'Plus de ' + nombreFr(Math.floor(n / 100) * 100) + ' candidats' : 'Rejoignez les premiers candidats';
}
function tuileCommunaute(){
  const i = S.commInfo, jamais = !lireReglages().commVu;
  const neuf = jamais ? 'Nouveau' : (i && i.nouveaux > 0 ? (i.nouveaux > 99 ? '99+' : i.nouveaux) + (i.nouveaux > 1 ? ' nouveautés' : ' nouveauté') : '');
  return `<button class="stat stat-comm" data-go="communaute" aria-label="Ouvrir la communauté. ${candidatsCommunaute()}${neuf ? '. ' + neuf : ''}">
    <span class="sc-ic">${ico('groupe', 22)}</span>
    <span class="sc-t">Communauté</span>
    <span class="sc-n">${candidatsCommunaute()}</span>
    ${neuf ? `<span class="sc-new${jamais ? ' jamais' : ''}">${neuf}</span>` : ''}
  </button>`;
}
async function chargerCommInfo(){
  if(!base || !S.util.connecte) return;
  try{
    const { data } = await base.rpc('communaute_info', { p_depuis: lireReglages().commVu || null });
    if(data && data.ok && !pareil(data, S.commInfo)){ S.commInfo = data; if(S.ecran === 'compte') rendre(); }
  }catch(e){}
}
function chargerModuleCommunaute(){
  if(window.MC_COMM) return Promise.resolve(window.MC_COMM);
  if(chargerModuleCommunaute.p) return chargerModuleCommunaute.p;
  chargerModuleCommunaute.p = new Promise((ok, ko) => {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/communaute.css?v=' + COMM_VERSION;
    document.head.appendChild(l);
    const s = document.createElement('script'); s.src = '/communaute.js?v=' + COMM_VERSION;
    s.onload = () => window.MC_COMM ? ok(window.MC_COMM) : ko(new Error('module'));
    s.onerror = () => { chargerModuleCommunaute.p = null; ko(new Error('réseau')); };
    document.head.appendChild(s);
  });
  return chargerModuleCommunaute.p;
}
function ecranCommunaute(){
  if(window.MC_COMM) return window.MC_COMM.ecran();
  vue().innerHTML = `<div class="pad"><button class="retourhaut" data-go="compte">Retour</button>
    <h1 class="titre">Communauté</h1>
    <div class="squelette large" style="margin-top:16px"></div><div class="squelette" style="margin-top:10px"></div><div class="squelette court" style="margin-top:10px"></div></div>`;
  chargerModuleCommunaute().then(() => { if(S.ecran === 'communaute') rendre(); }).catch(() => {
    if(S.ecran !== 'communaute') return;
    vue().innerHTML = `<div class="pad"><button class="retourhaut" data-go="compte">Retour</button>
      <h1 class="titre">Communauté</h1>
      <p class="sous" style="margin:10px 0 16px">La communauté n'a pas pu s'ouvrir. Vérifiez votre connexion, puis réessayez.</p>
      <button class="cta" data-comm-reessayer="1">Réessayer</button></div>`;
  });
}
function ouvrirCommunaute(id){
  if(LIEN_UUID.test(id || '')) S.commFocus = id;
  aller('communaute');
}
document.addEventListener('click', ev => {
  if(ev.target.closest('[data-comm-reessayer]')) return rendre();
  /* « Partager » → « Dans la communauté » : on ouvre l'écran avec le message déjà prêt */
  const t = ev.target.closest('[data-cm-partager]');
  if(!t) return;
  const quoi = t.dataset.cmPartager, c = S.classement, v = document.getElementById('voile');
  if(v){ v.hidden = true; v.innerHTML = ''; } S.modal = null;
  S.commBrouillon = { quoi,
    texte: quoi === 'performance' && c ? `Je suis ${nombreFr(c.rang)}ᵉ sur ${nombreFr(c.population)} candidats, avec ${nombreFr(c.points)} points. Et vous, où en êtes-vous ?`
         : quoi === 'cours' && S.matiereOuverte ? `Je révise ${S.matiereOuverte} aujourd'hui. Et vous ?` : '' };
  pister('COMMUNITY_SHARE_STARTED', { quoi });
  aller('communaute');
});

function ecranCompte(){
  const mots = (S.util.nom||'Candidat').trim().split(/\s+/).filter(Boolean);
  const initiales = (mots.length > 1
    ? mots[0][0] + mots[mots.length-1][0]
    : (mots[0] || 'C').slice(0,2)).toUpperCase();
  const semaine = (S.stats && S.stats.jours_semaine && S.stats.jours_semaine.length === 7)
    ? S.stats.jours_semaine : null;
  const sem = semaine ? semaine.map(j => j.compose ? 1 : 0) : [0,0,0,0,0,0,0];
  const jours = semaine ? semaine.map(j => j.jour) : ['L','M','M','J','V','S','D'];
  const faites = sem.filter(Boolean).length;
  vue().innerHTML = `
  <div class="pad">
    ${(() => {
      const gauche = estInstallee() ? '' : (S.appliInstallee
        ? '<span class="appli-ok">Installation terminée. Ouvrez Mon Concours depuis votre écran d\'accueil.</span>'
        : `<button type="button" class="appli-flottant bat" data-appli-dl="1">${S.appliLa ? 'Ouvrir l\'application' : '↓ Télécharger l\'application'}</button>`);
      const droite = (S.gratuit || estAbonnePaye()) ? '' : `<button type="button" class="appli-flottant appli-abo bat" data-go="abonnement">Faire mon abonnement</button>`;
      return (gauche || droite) ? `<div class="appli-flottant-zone">${gauche}${droite}</div>` : '';
    })()}
    <div class="profil">
      <div class="av">${initiales}</div>
      <h1>${E(S.util.nom || 'Candidat')}${(S.journee && S.journee.pseudo && S.journee.pseudo.trim().toLowerCase() !== (S.util.nom || '').trim().toLowerCase()) ? ` <span class="pseudo-sep">/ ${E(S.journee.pseudo)}</span>` : ''}</h1>
      ${S.util.tel?`<span>+226 ${E(S.util.tel)}</span>`:''}
    </div>

    <div class="duo">
      <div class="stat stat-taux" aria-label="${S.stats ? S.stats.taux_reussite + ' % de réussite, ' + nombreFr(S.stats.questions_resolues) + ' QCM résolus et ' + nombreFr(S.stats.compositions || 0) + ' compositions' : 'Taux de réussite'}">
        <div class="v num">${S.stats ? S.stats.taux_reussite + ' %' : '—'}</div>
        <div class="l">Taux de réussite</div>
        <div class="st-sous">
          <span><b class="num">${S.stats ? nombreFr(S.stats.questions_resolues) : '—'}</b> QCM</span>
          <i aria-hidden="true"></i>
          <span><b class="num">${S.stats ? nombreFr(S.stats.compositions || 0) : '—'}</b> composition${(S.stats && (S.stats.compositions || 0) === 1) ? '' : 's'}</span>
        </div>
      </div>
      ${tuileCommunaute()}
    </div>

    ${blocNiveau(true)}
    <button class="grande" style="margin-top:10px" data-go="parcours">
      <span class="ic">${ico('diagnostic',19)}</span>
      <span><b>Mon parcours</b><span>Depuis ton premier jour, matière par matière, et ta carte à partager</span></span>
      <span class="fl">→</span></button>
    <button class="grande" style="margin-top:10px" data-go="parrainage">
      <span class="ic">${ico('partage',19)}</span>
      <span><b>Parrainage</b><span>30 amis inscrits avec ton lien : un mois offert</span></span>
      <span class="fl">→</span></button>

    <div class="classement">
      <div class="t">${ico('trophee',14)} Ta position</div>
      ${S.classement ? `
      <div class="rangbig"><span class="num">${nombreFr(S.classement.rang)}ᵉ</span></div>
      <div class="pts">sur <span class="num">${nombreFr(S.classement.population)}</span> inscrits · <span class="num">${nombreFr(S.classement.points)}</span> point${S.classement.points>1?'s':''}</div>
      <div class="up ${S.classement.places_semaine < 0 ? 'baisse' : ''}">${
        S.classement.places_semaine > 0
          ? '▲ Vous avez gagné ' + S.classement.places_semaine + ' place' + (S.classement.places_semaine>1?'s':'') + ' cette semaine'
          : S.classement.places_semaine < 0
            ? '▼ Vous avez perdu ' + Math.abs(S.classement.places_semaine) + ' place' + (Math.abs(S.classement.places_semaine)>1?'s':'') + ' cette semaine'
            : 'Aucun mouvement cette semaine'}</div>
      ${blocDepasse()}
      <p class="sous" style="margin-top:9px">${
        S.classement.dans_le_top10
          ? 'Vous êtes dans les 10 premiers. Tenez la position : les autres avancent chaque jour.'
          : (S.classement.points_pour_place > 0
              ? 'Il vous faut <b>' + nombreFr(S.classement.points_pour_place) + ' point' + (S.classement.points_pour_place > 1 ? 's' : '') + '</b> pour gagner une place, et <b>' + nombreFr(S.classement.points_pour_top10) + ' points</b> pour entrer dans les 10 premiers.'
              : 'Vous êtes en tête de ceux qui ont votre nombre de points.')}</p>`
      : (S.util.connecte
        ? `<div class="squelette large" style="margin-top:6px"></div>
           <div class="squelette"></div>
           <div class="squelette court"></div>
           <span class="sr">Chargement de votre position</span>`
        : `<p class="sous" style="margin-top:8px">Connectez-vous pour suivre vos points et votre position estimée.</p>
           <button class="cta" style="margin-top:10px" data-modal="connexion">Me connecter</button>`)}

      <div class="calcul">
        <div class="l">Comment les points se calculent</div>
        <div class="r"><span>Bonne réponse en révision</span><b class="num">+ 5</b></div>
        <div class="r"><span>Bonne réponse en composition</span><b class="num">+ 15</b></div>
        <div class="r"><span>Erreur refermée dans « Mes erreurs »</span><b class="num">+ 20</b></div>
        <div class="r"><span>Mauvaise réponse en révision</span><b class="num neg">− 3</b></div>
      </div>

      <button class="voirplus" style="margin-top:12px;border-color:var(--or-bord);color:var(--or)" data-classement="1">
        ${S.voirClassement?'MASQUER LE CLASSEMENT':'VOIR LE CLASSEMENT COMPLET →'}</button>

      ${S.voirClassement?`
      <div style="margin-top:12px;border-top:1px solid var(--or-bord);padding-top:12px">
        <p class="sous" style="margin-bottom:10px">Votre position se déplace à chaque point gagné. Voici les paliers à viser.</p>
        ${S.classement ? [
          ['Major national', 1],
          ['Top 10', 10],
          ['Top 50', 50],
          ['Top 100', 100],
          ['Votre position', S.classement.rang]
        ].sort((x,y)=>x[1]-y[1]).map(p => {
          const moi = p[0] === 'Votre position';
          const atteint = S.classement.rang <= p[1] && !moi;
          const manque = Math.max(0, ((S.classement.seuils || {})[String(p[1])] ?? S.classement.points) - S.classement.points + 1);
          return `<div class="rang ${moi?'moi':''}">
            <span class="p num">${nombreFr(p[1])}</span>
            <span class="av">${atteint ? '✓' : (moi ? '▸' : '·')}</span>
            <span class="n">${p[0]}<em>${moi ? nombreFr(S.classement.points) + ' points' :
              atteint ? 'palier atteint' : 'encore ' + nombreFr(manque) + ' points'}</em></span>
            <span class="s num">${moi ? '' : (atteint ? '' : '↑')}</span></div>`;
        }).join('') : '<div class="squelette"></div><div class="squelette"></div><div class="squelette court"></div><span class="sr">Chargement</span>'}
      </div>`:''}
    </div>

    <div class="libelle" style="margin-top:18px">Mes forces et mes faiblesses</div>
    ${(function(){
      const pm = ((S.stats && S.stats.par_matiere) || []).filter(x => x.traitees >= 5)
        .map(x => ({ ...x, taux: Number(x.taux) || 0 })).sort((a,b) => b.taux - a.taux);
      if(!pm.length) return `<div class="carte" style="margin-top:9px"><p class="sous">Il faut au moins 5 réponses dans une matière pour en mesurer le niveau. Révisez quelques questions, puis revenez ici.</p></div>`;
      const forces = pm.filter(x => x.taux >= 60), faibles = pm.filter(x => x.taux < 60).reverse();
      const ligne = (x, cl) => `<div class="mat"><div class="nom">${E(x.matiere)}<em>${x.traitees} réponses</em></div><div class="jauge ${cl}"><i style="width:${x.taux}%"></i></div><div class="val num">${x.taux}</div></div>`;
      return `<div class="carte reveal" style="margin-top:9px">
        ${forces.length ? `<div class="libelle">Mes forces</div>${forces.map(x => ligne(x,'haut')).join('')}` : ''}
        ${faibles.length ? `<div class="libelle" style="margin-top:14px">À renforcer</div>${faibles.map(x => ligne(x,'bas')).join('')}
        <div class="verdict solide" style="margin-top:14px"><b>Prochaine séance</b>Commencez par ${E(faibles[0].matiere.toLowerCase())} : ${faibles[0].taux} % de bonnes réponses sur ${faibles[0].traitees}.</div>
        <button class="cta vert" style="margin-top:12px" data-cible="${E(faibles[0].matiere)}">Réviser ${E(faibles[0].matiere)}</button>` : ''}
        <p class="sous" style="margin-top:9px;font-size:11.5px">Une matière passe dans les forces à partir de 60 % de bonnes réponses.</p>
      </div>`;
    })()}

    ${blocPlanSemaine()}

    ${blocMesCompositions()}

    <div class="bloc">
      <div class="libelle">Défis</div>
      <button class="grande" style="margin-top:0" data-go="grille">
        <span class="ic">${ico('grille',19)}</span>
        <span><b>Composer</b><span>Un sujet complet, chronométré, sur la feuille de réponses</span></span>
        <span class="fl">→</span>
      </button>

      <button class="grande" data-badges="1" aria-expanded="${S.voirBadges}">
        <span class="ic">${ico('trophee',19)}</span>
        <span><b>Mes récompenses</b><span>${recompenses().filter(r=>r.on).length} obtenue${recompenses().filter(r=>r.on).length>1?'s':''} sur ${recompenses().length}</span></span>
        <span class="fl">${S.voirBadges?'▲':'▼'}</span></button>
      ${S.voirBadges?`
      <div class="reveal">
        <div class="carte" style="margin-top:9px">
          <div class="libelle">Ma collection<span class="num">${recompenses().filter(r=>r.on).length}/${recompenses().length}</span></div>
          <div class="collection">
            ${recompenses().map(r=>`<div class="badge-carte ${r.on?'':'off'}">
              <div class="jeton ${r.on?'gagne':''}">${r.c}</div>
              <div class="bt">${r.t}</div>
              <div class="bd">${r.d}</div>
              ${r.on?'':`<div class="cadena">${ico('cadenas',13)}</div>`}
            </div>`).join('')}
          </div>
        </div>
      </div>`:''}
    </div>

    <div class="bloc">
      <div class="libelle">Assiduité</div>
      <div class="carte">
        <div style="display:flex;justify-content:space-between;align-items:flex-end">
          <div><div style="display:flex;align-items:center;gap:8px;color:var(--or)">${ico('flamme',20)}
              <span style="font-family:var(--d);font-weight:800;font-size:26px;letter-spacing:-.03em;color:var(--craie)">${S.stats ? S.stats.serie : 0} jour${(S.stats&&S.stats.serie>1)?'s':''}</span></div>
            <div class="eyebrow" style="margin-top:3px">consécutifs</div></div>
          <div style="text-align:right"><div class="num" style="font-size:15px">${S.stats ? S.stats.record : 0}</div>
            <div class="eyebrow">jours au total</div></div>
        </div>
        <div class="libelle" style="margin-top:16px">Série en cours<span class="num">${faites}/7 jours</span></div>
        <div class="semaine">
          ${jours.map((j,k)=>`<div><div class="j">${j}</div>
            <div class="c ${sem[k]?'vert':'vide'}" title="${sem[k]?'Jour travaillé':'Pas encore travaillé'}">${sem[k]?'✓':''}</div></div>`).join('')}
        </div>
        <p class="sous" style="margin-top:12px;border-left:2px solid var(--or);padding-left:11px">
          ${S.stats && S.stats.serie >= 3 ? 'Trois jours ou plus d\'affilée : c\'est la régularité qui fait la différence. Ne cassez pas la série.' : 'Un peu chaque jour vaut mieux que beaucoup une fois par semaine. Revenez demain, même pour dix questions.'}</p>
      </div>
    </div>

    <div class="bloc">
      ${S.gratuit ? '' : `<div class="libelle">Mon abonnement</div>
      <button class="grande" style="margin-top:0" data-go="abonnement">
        <span class="ic">${ico('carte',19)}</span>
        <span><b>${S.abo.actif ? nomFormule(S.abo.formule) : 'Abonnement gratuit'}</b><span>${E(S.abo.echeance)}</span></span>
        <span class="fl">${S.abo.actif?'GÉRER →':'S\'ABONNER →'}</span>
      </button>`}
      <div class="carte" style="margin-top:14px;text-align:left">
        <div class="libelle" style="margin-bottom:10px">Rester informé</div>
        <p class="sous" style="margin:0 0 12px">Les dates de concours, les nouveaux cours et les annonces passent d'abord par nos canaux.</p>

        <a class="lien-reseau wa" href="${CONTACT.canal}" target="_blank" rel="noopener">
          ${logoReseau('whatsapp')}
          <span><b>Rejoindre la chaîne WhatsApp</b><i>Annonces et dates de concours</i></span></a>

        <a class="lien-reseau fb" href="${CONTACT.facebook}" target="_blank" rel="noopener">
          ${logoReseau('facebook')}
          <span><b>Suivre Mon Concours sur Facebook</b><i>Annonces, dates et nouveaux cours</i></span></a>


        <button class="cta creux" style="margin-top:10px" data-partage="site">
          ${ico("partage",16)} Partager Mon Concours à un camarade<small>Qui prépare le concours lui aussi</small></button>
      </div>

      ${blocRappels()}

      <div class="carte" style="margin-top:14px;text-align:left">
        <div class="libelle" style="margin-bottom:10px">Aide et contact</div>
        <a class="lien-reseau wa"
           href="https://wa.me/226${CONTACT.adminTel}?text=${encodeURIComponent("Bonjour, je vous écris au sujet de Mon Concours : ")}"
           target="_blank" rel="noopener">
          ${logoReseau('whatsapp')}
          <span><b>Écrivez-nous sur WhatsApp en cas de difficulté ou recommandation</b><i>Réponse dans la journée</i></span></a>
      </div>

      <div class="carte reglages">
        <button data-go="apparence">Apparence<span>→</span></button>
        <a href="/confidentialite.html" target="_blank" rel="noopener">Confidentialité et conditions<span>→</span></a>
        ${S.util.connecte
          ? `<button class="sortie" data-deconnecter="1">Se déconnecter<span>→</span></button>`
          : `<button data-go="connexion">Se connecter<span>→</span></button>`}
      </div>
      ${S.util.connecte ? `<button class="lien-suppr" data-go="suppression">Supprimer mon compte</button>` : ''}
    </div>
  </div>`;
}

/* ---------- suppression du compte (exigée par le Play Store) ---------- */
function ecranSuppression(){
  if(!S.util.connecte) return ecranCompte();
  vue().innerHTML = `<div class="pad">
    <button class="retourhaut" data-go="compte">Retour</button>
    <div class="eyebrow">Supprimer mon compte</div>
    <h1 class="titre">Tout effacer ?</h1>
    <div class="carte suppr-carte" style="margin-top:14px">
      <p class="sous" style="margin:0 0 8px">La suppression est <b>définitive</b>. Elle efface :</p>
      <ul class="suppr-liste">
        <li>votre compte : numéro, nom, pseudo, mot de passe ;</li>
        <li>vos réponses, compositions, notes, erreurs et badges ;</li>
        <li>vos défis, classements, notifications et rappels.</li>
      </ul>
      <p class="sous" style="margin:8px 0 0">Si vous voulez seulement faire une pause, il suffit de vous déconnecter : vos progrès vous attendront.</p>
    </div>
    <div class="champ" style="margin-top:16px">
      <label for="suppr-code">Tapez votre mot de passe pour confirmer</label>
      <input id="suppr-code" type="password" inputmode="numeric" maxlength="4" placeholder="••••" autocomplete="current-password">
    </div>
    ${S.supprErreur ? `<p class="erreur-champ" style="color:var(--rouge-texte);margin:8px 0 0">${E(S.supprErreur)}</p>` : ''}
    <button class="cta danger" style="margin-top:14px" data-suppr-confirmer="1" ${S.supprEnCours ? 'disabled' : ''}>${S.supprEnCours ? 'Suppression…' : 'Supprimer définitivement mon compte'}</button>
    <button class="cta creux" style="margin-top:9px" data-go="compte">Annuler</button>
    <p class="sous" style="margin-top:14px;font-size:12.5px"><a href="/suppression-compte.html" target="_blank" rel="noopener">Ce qui est effacé, et comment faire sans accès au compte</a></p>
  </div>`;
}
async function supprimerCompte(){
  const champ = document.getElementById('suppr-code');
  const code = (champ && champ.value || '').replace(/\D/g, '');
  if(code.length !== 4){ S.supprErreur = 'Le mot de passe comporte 4 chiffres.'; return rendre(); }
  if(!base){ S.supprErreur = 'Pas de connexion au serveur. Réessayez avec du réseau.'; return rendre(); }
  S.supprEnCours = true; S.supprErreur = ''; rendre();
  try{
    const { data, error } = await base.functions.invoke('supprimer-compte', { body: { code } });
    if(error) throw error;
    if(!data || !data.ok){ S.supprEnCours = false; S.supprErreur = (data && data.message) || 'Suppression impossible.'; return rendre(); }
    pister('ACCOUNT_DELETED');
    S.deconnexionVoulue = true;
    try{ await base.auth.signOut({ scope:'local' }); }catch(e){}
    try{ localStorage.removeItem(CLE_PACK); }catch(e){}
    S.supprEnCours = false;
    S.util = {nom:'', tel:'', pin:'', connecte:false};
    S.form = {nom:'', tel:'', pin:''};
    memoVider(); S.journee = null; S.stats = null; S.details = null; S.classement = null; S.notifications = []; S.cahier = []; S.top = null; S.rappel = null; S.elan = null;
    oublierIdentite();
    toast('Votre compte a été supprimé. Merci d\'avoir révisé avec Mon Concours.', 6000);
    S.modalDejaVu = true;
    return aller('aujourdhui');
  }catch(e){
    S.supprEnCours = false;
    S.supprErreur = (!navigator.onLine || /fetch|network/i.test(String(e && e.message)))
      ? 'Pas de réseau. Réessayez quand vous serez connecté.'
      : 'La suppression n\'a pas pu se faire. Demandez-la sur WhatsApp (lien ci-dessous) : nous la faisons sous 7 jours.';
    rendre();
  }
}
document.addEventListener('click', ev => {
  const t = ev.target.closest('[data-suppr-confirmer]');
  if(t) supprimerCompte();
});

/* =====================================================================
   PROGRESSION DU JOUR, FIL « POUR TOI », COMPOSITIONS COLLECTIVES,
   QUESTION DU JOUR, SIGNALEMENTS, RAPPELS
   Tout ce qui suit lit le serveur et n'invente aucun chiffre : sans
   donnée, le bloc ne s'affiche pas.
   ===================================================================== */
const VAPID_PUBLIC = 'BKKwtq-pIHYWr7Ypi81KhbOYicKmCnOt27bmN_YLN8dhYzoxUHiofDHWBM7VFuOru8nTPAeV8vyWiSW2tfcOqT0';
const OBJECTIFS = [10, 20, 50, 100];
const enComposition = () => S.ecran === 'grille' && !S.corrige && S.compoEtat === 'pret' && S.grille.length > 0;
const heureFr = iso => new Date(iso).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
const jourFr = iso => new Date(iso).toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' });

async function chargerJournee(){
  if(!base || !S.util.connecte) return;
  try{
    const { data } = await base.rpc('ma_journee');
    if(data && !pareil(data, S.journee)){ S.journee = data; memoEcrire('journee', data, true); rafraichirSiVisible(); }
    if(!S.details) chargerDetails();
  }catch(e){}
}
/* Le candidat doit d'abord poser les yeux sur l'accueil : la fenêtre de la nationale vient après 12 secondes. */
const T_OUVERTURE = Date.now(), DELAI_NATIONALE = 12000, DELAI_BOUTON_CANAL = 40000;
async function chargerEpreuve(){
  if(!base) return;
  try{
    const { data } = await base.rpc('epreuve_du_moment');
    const change = !pareil(data || null, S.epreuve);
    S.epreuve = data || null;
    memoEcrire('epreuve', S.epreuve, true);
    noterFinCompo(S.epreuve);
    nettoyerCopieAbandonnee();
    if(S.lienSalle && S.epreuve && S.epreuve.id === S.lienSalle){
      const idSalle = S.lienSalle; S.lienSalle = null;
      if(salleOuverte(S.epreuve) && S.util.connecte && !enComposition()) return entrerEnSalle(idSalle, 'lien');
    }
    if(change && ['aujourdhui','gagnants'].includes(S.ecran)) rendre();
    setTimeout(proposerNationale, Math.max(900, DELAI_NATIONALE - (Date.now() - T_OUVERTURE)));
  }catch(e){}
  try{
    const { data } = await base.rpc('derniere_nationale');
    if(!pareil(data || null, S.derniereNat)){ S.derniereNat = data || null; if(S.ecran === 'aujourdhui') rendre(); }
  }catch(e){}
}
async function chargerDirect(){
  if(!base) return;
  try{
    const { data } = await base.rpc('activite_en_direct');
    if(data){ S.direct = data; if(S.ecran === 'aujourdhui') rendre(); }
  }catch(e){}
}
/* l'accueil se tient à jour tant qu'il est ouvert */
setInterval(() => {
  if(document.visibilityState !== 'visible' || S.ecran !== 'aujourdhui') return;
  chargerEpreuve(); chargerDirect();
}, 60000);

/* Une réponse corrigée de plus : on avance le compteur du jour sans
   attendre le serveur, et on fête une seule fois l'objectif atteint. */
function compterReponse(){
  if(!S.journee) return;
  S.journee.faites_jour = (S.journee.faites_jour || 0) + 1;
  const obj = S.journee.objectif || 20;
  const cle = 'objectifFete-' + new Date().toDateString();
  if(S.journee.faites_jour >= obj && !lireReglages()[cle]){
    ecrireReglage(cle, true);
    setTimeout(() => { sonDepart(); signalCandidat('Objectif du jour atteint : ' + obj + ' questions. Bravo !'); }, 900);
  }
}

/* ---------- bilan par matière d'une copie ---------- */
function bilanMatieres(grille, reponses){
  const m = {};
  grille.forEach((g, i) => {
    if(!g.m) return;
    const r = reponses[i] || [], bonnes = g.bonnes || [];
    const juste = r.length && bonnes.length && r.length === bonnes.length && r.every(x => bonnes.includes(x));
    (m[g.m] = m[g.m] || { nom:g.m, j:0, n:0 }).n++;
    if(juste) m[g.m].j++;
  });
  return Object.values(m).sort((a, b) => (a.j / a.n) - (b.j / b.n));
}
function blocMatieresCopie(grille, reponses, note, total){
  const mats = bilanMatieres(grille, reponses);
  const prec = ((S.journee && S.journee.compositions) || [])
    .filter(c => c.id !== S.derniereCompo && c.sur > 0);
  const pct = total ? Math.round(note / total * 100) : 0;
  let compar = '';
  if(prec.length){
    const moy = Math.round(prec.reduce((a, c) => a + c.score / c.sur, 0) / prec.length * 100);
    const ecart = pct - moy;
    compar = `<p class="sous" style="margin-top:10px">Votre moyenne sur les ${prec.length} composition${prec.length>1?'s':''} précédente${prec.length>1?'s':''} : <b>${moy} %</b>. Cette copie : <b>${pct} %</b>, soit ${ecart === 0 ? 'le même niveau' : (ecart > 0 ? '<span style="color:var(--vert-texte)">' + ecart + ' points de plus</span>' : '<span style="color:var(--rouge-texte)">' + Math.abs(ecart) + ' points de moins</span>')}.</p>`;
  }
  if(!mats.length && !compar) return '';
  const faibles = mats.filter(x => x.n >= 2 && x.j / x.n < 0.5);
  return `<div class="bloc">
    <div class="libelle">Par matière</div>
    <div class="carte">
      ${mats.map(x => {
        const t = Math.round(x.j / x.n * 100);
        return `<div class="mat"><div class="nom">${E(x.nom)}<em>${x.j} sur ${x.n}</em></div>
          <div class="jauge ${t >= 60 ? 'haut' : (t < 40 ? 'bas' : '')}"><i style="width:${t}%"></i></div><div class="val num">${t} %</div></div>`;
      }).join('')}
      ${faibles.length ? `<div class="verdict fragile" style="margin-top:12px"><b>À travailler en priorité</b>${faibles.slice(0,2).map(x => E(x.nom)).join(' et ')} : moins d'une bonne réponse sur deux.</div>
        <button class="cta creux" style="margin-top:10px" data-cible="${E(faibles[0].nom)}">Réviser ${E(faibles[0].nom)}</button>` : ''}
      ${compar}
    </div>
  </div>`;
}

/* ---------- la composition nationale : jour et heure donnés par l'administration ---------- */
const dateLongue = iso => new Date(iso).toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', timeZone:'UTC' });
/* toujours l'heure de Ouagadougou (= UTC), quelle que soit l'horloge du téléphone */
const heureH = iso => { const d = new Date(iso); return d.getUTCHours() + ' h ' + String(d.getUTCMinutes()).padStart(2,'0'); };
/* « Aujourd'hui », « Demain », sinon « Sam. 31 oct. » : le jour réel de la composition, jamais un jour fixe */
function jourCourtNat(iso){
  const d = new Date(iso), a = new Date(), j0 = x => Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate());
  const ecart = Math.round((j0(d) - j0(a)) / 86400000);
  if(ecart === 0) return 'Aujourd\'hui';
  if(ecart === 1) return 'Demain';
  const t = d.toLocaleDateString('fr-FR', { weekday:'short', day:'numeric', month:'short', timeZone:'UTC' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}
/* la prochaine composition, en toutes lettres, quand on la connaît */
const prochaineNat = () => { const e = S.epreuve; return e && e.etat === 'a_venir' && e.debut_le ? dateLongue(e.debut_le) + ' à ' + heureH(e.debut_le) : ''; };
function texteRebours(iso){
  let s = Math.max(0, Math.floor((new Date(iso) - Date.now()) / 1000));
  const j = Math.floor(s / 86400); s -= j * 86400;
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  const c = (v, l) => `<span><b class="num">${String(v).padStart(2,'0')}</b><small>${l}</small></span>`;
  return (j ? c(j, 'j') : '') + c(h, 'h') + c(m, 'min') + c(s, 's');
}
const rebours = iso => `<div class="rebours" data-rebours="${E(iso)}" aria-live="off">${texteRebours(iso)}</div>`;
setInterval(() => {
  document.querySelectorAll('[data-rebours]').forEach(el => {
    const iso = el.dataset.rebours;
    if(new Date(iso) <= Date.now()){ el.removeAttribute('data-rebours'); setTimeout(chargerEpreuve, 1500); return; }
    el.innerHTML = texteRebours(iso);
  });
}, 1000);

function carteEpreuve(){
  const ep = S.epreuve;
  if(!ep) return '';
  const moi = ep.moi;
  const faits = `${ep.nb_questions} questions · ${Math.round(ep.duree/60)} min · <b>${ep.places} postes à pourvoir</b> · <b class="num">${nombreFr(ep.inscrits || 0)}</b> inscrit${(ep.inscrits||0)>1?'s':''}`;
  let corps = '', bouton = '';
  if(ep.etat === 'a_venir'){
    corps = `<p class="cn-quand">${E(dateLongue(ep.debut_le))} à ${heureH(ep.debut_le)}</p>
      ${rebours(ep.debut_le)}
      <p class="sous cn-faits">${faits}</p>`;
    bouton = ep.inscrit
      ? `<div class="cn-inscrit">${ico('coche',15)} Inscrit · rappel 20 minutes avant le début</div>`
      : `<button class="cta" style="margin-top:12px" data-inscrire-nat="${E(ep.id)}">M'inscrire à la composition</button>`;
  } else if(ep.etat === 'en_cours'){
    const finis = Math.max(0, (ep.participants || 0) - (ep.composent || 0));
    corps = `<p class="cn-quand"><span class="cn-direct"><i></i>En cours</span> fin à ${heureH(ep.fin_le)}</p>
      ${rebours(ep.fin_le)}
      <p class="sous cn-faits">${faits}${ep.composent > 0 ? ` · <span class="num">${ep.composent}</span> en salle` : ''}${finis > 0 ? ` · <span class="num">${finis}</span> ${finis > 1 ? 'ont' : 'a'} déjà fini` : ''}</p>`;
    bouton = moi && moi.terminee
      ? `<p class="sous" style="margin-top:8px">Copie remise. Les résultats sont publiés à ${heureH(ep.fin_le)}.</p>`
      : `<button class="cta" style="margin-top:12px" data-rejoindre="${E(ep.id)}">Entrer en salle de composition</button>`;
  } else {
    const absent = ep.inscrit && !(moi && moi.terminee);
    corps = `<p class="cn-quand">${absent ? 'Terminée sans vous' : 'Résultats publiés'}</p>
      <p class="sous cn-faits">${ep.participants} candidat${ep.participants>1?'s':''} · ${ep.places} postes à pourvoir${moi && moi.score !== null && moi.score !== undefined ? ` · votre note : <span class="num">${moi.score}/${moi.sur}</span>` : ''}</p>`;
    bouton = `<button class="cta" style="margin-top:12px" data-gagnants="${E(ep.id)}">${absent ? 'Voir le classement' : 'Voir les résultats et les admis'}</button>`;
  }
  return `<div class="carte nationale">
    <div class="cn-tete"><span>${ico('groupe',14)} Composition nationale <small class="sim">(simulation)</small></span><span class="cn-samedi">${E(jourCourtNat(ep.debut_le))} · ${heureH(ep.debut_le)}</span></div>
    <h2 class="col-titre">${E(ep.concours || ep.titre.replace(/^Composition nationale( \(simulation\))? · /, ''))}</h2>
    ${corps}
    ${ep.recompense ? `<p class="sous" style="margin-top:6px">Récompense : <b>${E(ep.recompense)}</b></p>` : ''}
    ${bouton}
  </div>`;
}

/* À l'ouverture : « Voulez-vous participer ? » une fois par composition */
/* Dernier jour de l'essai : une fenêtre claire à l'ouverture, une fois par jour, avec une croix pour la fermer. */
function rappelFinEssai(essai){
  return;   /* fenêtre de fin d'essai retirée à la demande : la carte de l'accueil suffit */
  if(S.gratuit || !S.util.connecte || !S.abo || !S.abo.actif || S.abo.formule !== 'essai' || S.abo.jours_restants > 1) return;
  const jour = new Date().toISOString().slice(0, 10);
  if(lireReglages().finEssaiVu === jour) return;
  const v = document.getElementById('voile');
  if(S.ecran !== 'aujourdhui' || S.modal || enComposition() || !v || !v.hidden || document.getElementById('invitation')){
    if(essai < 4) setTimeout(() => rappelFinEssai(essai + 1), 6000);
    return;
  }
  ecrireReglage('finEssaiVu', jour);
  S.modal = 'finEssai'; v.hidden = false;
  const f = FORMULES.mensuelle || {};
  v.innerHTML = `
  <div class="panneau pop-nat" role="dialog" aria-modal="true" aria-labelledby="pfe-titre">
    <button class="pn-x" data-fin-essai-non="1" aria-label="Fermer">×</button>
    <div class="eyebrow" style="color:var(--or)">Votre essai gratuit</div>
    <h3 id="pfe-titre">${S.abo.jours_restants > 0 ? 'Il se termine demain' : 'Il se termine aujourd\'hui'}</h3>
    <p class="intro">Ensuite, l'abonnement gratuit garde 5 corrections par jour, 15 questions par matière et ${compoOffertes()} compositions. Pour tout garder sans limite : ${E(f.n || 'Abonnement Mois')}, ${E(f.prix || '1 000 FCFA')} pour 30 jours.</p>
    <button class="cta" data-fin-essai-oui="1">Choisir mon abonnement</button>
  </div>`;
  pister('TRIAL_END_POPUP');
}
/* La composition est terminée : une fenêtre annonce le classement à tous ceux qui ouvrent le site, une seule fois,
   avec une croix pour la fermer. */
function annoncerClassement(ep){
  if(S.popNatVu || !S.sessionPrete || S.ecran !== 'aujourdhui' || S.modal || enComposition()) return;
  const v = document.getElementById('voile');
  if(!v || !v.hidden) return;
  if(lireReglages()['classVu-' + ep.id]) return;
  const moi = ep.moi, composee = !!(moi && moi.terminee), absent = !!ep.inscrit && !composee;
  S.popNatVu = true; S.modal = 'classement';
  v.hidden = false;
  const texte = composee
    ? `Vous avez composé et obtenu <b class="num">${moi.score ?? '—'}</b> sur ${moi.sur || ep.nb_questions}. Voyez votre rang et la liste des admis.`
    : absent
      ? `La composition s'est terminée sans vous. Voici le classement des <b class="num">${nombreFr(ep.participants || 0)}</b> candidats, pour ${ep.places} postes à pourvoir.`
      : `<b class="num">${nombreFr(ep.participants || 0)}</b> candidat${(ep.participants||0) > 1 ? 's ont' : ' a'} composé pour ${ep.places} postes à pourvoir. Voyez qui est admis.`;
  v.innerHTML = `
  <div class="panneau pop-nat" role="dialog" aria-modal="true" aria-labelledby="pc-titre">
    <button class="pn-x" data-class-fermer="${E(ep.id)}" aria-label="Fermer">×</button>
    <div class="eyebrow" style="color:var(--or)">Composition nationale <small class="sim">(simulation)</small></div>
    <h3 id="pc-titre">Le classement est publié</h3>
    <p class="intro">${E(ep.concours || ep.titre)}. ${texte}</p>
    <button class="cta" data-class-voir="${E(ep.id)}">Voir le classement</button>
  </div>`;
  pister('RANKING_POPUP_SHOWN', { composee, absent });
}
function fermerClassement(id){
  ecrireReglage('classVu-' + id, true);
  const v = document.getElementById('voile'); if(v) v.hidden = true;
  S.modal = null;
}
/* On retient l'heure de fin des compositions vues : les 5 minutes de calme partent de là, que le candidat ait ouvert ses résultats ou non. */
function noterFinCompo(ep){
  try{
    if(!ep || !ep.fin_le) return;
    const t = new Date(ep.fin_le).getTime();
    const l = (lireReglages().finsCompo || []).filter(x => typeof x === 'number');
    if(!l.includes(t)){ l.push(t); ecrireReglage('finsCompo', l.sort((a, b) => a - b).slice(-6)); }
  }catch(e){}
}
function finCompoRecente(){
  const l = (lireReglages().finsCompo || []).filter(x => typeof x === 'number' && x <= Date.now());
  return l.length ? Math.max(...l) : 0;
}
function proposerNationale(){
  const ep = S.epreuve;
  if(ep && ep.etat === 'terminee') return annoncerClassement(ep);
  if(!ep || ep.inscrit || ep.moi || S.popNatVu || !S.sessionPrete) return;
  if(S.ecran !== 'aujourdhui' || S.modal || enComposition()) return;
  const v = document.getElementById('voile');
  if(!v || !v.hidden) return;
  if(lireReglages()['nonNat-' + ep.id]) return;
  /* l'inscription à la prochaine composition vient après 5 minutes sur le site (10 novembre),
     et jamais avant 5 minutes de calme après les résultats d'une composition : on les laisse lire */
  const attente = Math.max(
    new Date().toISOString().slice(0, 10) === '2026-11-10' ? 300000 - (Date.now() - T_OUVERTURE) : 0,
    finCompoRecente() ? 300000 - (Date.now() - finCompoRecente()) : 0);
  if(attente > 0){ setTimeout(proposerNationale, Math.max(attente, 30000) + 500); return; }
  S.popNatVu = true;
  S.modal = 'nationale';
  v.hidden = false;
  v.innerHTML = `
  <div class="panneau pop-nat" role="dialog" aria-modal="true" aria-labelledby="pn-titre">
    <div class="poignee"></div>
    <div class="eyebrow" style="color:var(--or)">Composition nationale <small class="sim">(simulation)</small></div>
    <h3 id="pn-titre">${E(dateLongue(ep.debut_le).replace(/^./, x => x.toUpperCase()))} à ${heureH(ep.debut_le)}</h3>
    <p class="intro">Concours : <b>${E(ep.concours || ep.titre)}</b>. ${ep.nb_questions} questions en ${Math.round(ep.duree/60)} minutes, le même sujet pour tous les candidats, à la même heure.
      ${ep.places} postes à pourvoir : les ${ep.places} premiers sont admis, les ${ep.places} suivants passent sur liste d'attente. Tout le monde peut composer ; les postes ne limitent pas le nombre de participants.</p>
    ${ep.etat === 'a_venir' ? rebours(ep.debut_le) : ''}
    <p class="pn-q">Voulez-vous participer ?</p>
    ${S.util.connecte ? `<label class="pn-nom"><input type="checkbox" id="pn-nom" checked> <span>Afficher mon nom dans le classement (sinon : « Candidat anonyme »)</span></label>` : ''}
    <div class="duo">
      <button class="cta creux" data-nat-non="${E(ep.id)}">Non, merci</button>
      <button class="cta" data-nat-oui="${E(ep.id)}">Oui, je participe</button>
    </div>
  </div>`;
}
/* Entrer en salle de composition : depuis le bouton de la carte, une notification ou un lien. */
function entrerEnSalle(id, origine){
  if(!S.util.connecte){ S.modal = 'inscription'; S.erreur = ''; return surcouche(); }
  const v = document.getElementById('voile'); if(v){ v.hidden = true; v.innerHTML = ''; } S.modal = null;
  S.reponses = {}; S.corrige = false; S.grilleNote = null; S.corrigeServeur = null; effacerEpreuve();
  S.compoTab = 'feuille'; S.sujetVu = false; S.apercu = null; S.compositionId = null; S.remiseEtat = null;
  S.grille.length = 0; S.compoEtat = null; S.correctionLe = null;
  S.rejoindre = id;
  pister('NATIONAL_JOINED', origine ? { origine } : undefined);
  return aller('grille');
}
const salleOuverte = ep => !!(ep && ep.etat === 'en_cours' && !(ep.moi && ep.moi.terminee));
async function inscrireNationale(id, depuisPopup){
  if(!S.util.connecte){
    document.getElementById('voile').hidden = true; S.modal = null;
    toast('Créez votre compte gratuit pour vous inscrire à la composition.');
    S.modal = 'inscription'; S.erreur = ''; return surcouche();
  }
  const caseNom = document.getElementById('pn-nom');
  const afficher = caseNom ? caseNom.checked : true;
  try{
    const { data } = await base.rpc('inscrire_epreuve', { p_epreuve: id, p_afficher_nom: afficher });
    if(!data || !data.ok){ toast((data && data.message) || 'Inscription impossible.'); return; }
    if(S.epreuve && S.epreuve.id === id){ S.epreuve.inscrit = true; S.epreuve.inscrits = data.inscrits; }
    pister('NATIONAL_REGISTERED', { nom: afficher });
    const v = document.getElementById('voile');
    /* il vient de dire oui : c'est le moment de lui proposer d'être prévenu avant le début */
    if(notifsAEncourager() && !S.sansInvitation && !document.getElementById('invitation')){
      if(v){ v.hidden = true; v.innerHTML = ''; } S.modal = null;
      fenetreInvitation({ cle:'notifs', icone:'cloche', titre:'Vous êtes inscrit',
        texte:'Autorisez les notifications pour être prévenu avant le début de la composition. Vous pourrez entrer même en retard, tant que la composition n\'est pas terminée.',
        oui:'Me prévenir', rappel:0, sansFait:true, action: () => activerRappel(18, 0) });
      if(S.ecran === 'aujourdhui') rendre();
      return;
    }
    if(depuisPopup && v && !v.hidden){
      v.innerHTML = `<div class="panneau pop-nat" role="dialog" aria-modal="true">
        <div class="pn-ok">${ico('coche',28)}</div>
        <h3 style="text-align:center">Inscrit</h3>
        <p class="intro" style="text-align:center">Rendez-vous ${E(dateLongue(S.epreuve.debut_le))} à ${heureH(S.epreuve.debut_le)}. Vous recevrez un rappel avant le début.</p>
        <p class="intro" style="text-align:center;margin-top:-6px">Bonne chance pour la composition. Nous espérons vous voir parmi les meilleurs.</p>
        <button class="cta" data-fermer-partage="1">D'accord</button>
      </div>`;
    } else toast('Inscrit. Rendez-vous ' + dateLongue(S.epreuve.debut_le) + ' à ' + heureH(S.epreuve.debut_le) + '. Bonne chance, que vous soyez parmi les meilleurs !', 6000);
    if(S.ecran === 'aujourdhui') rendre();
  }catch(e){ toast('Inscription impossible. Vérifiez votre connexion.'); }
}

const DEFIS = [
  j => ({ t:'Travailler 5 jours cette semaine', v:j.jours_semaine || 0, c:5, u:'jours' }),
  j => ({ t:'Atteindre 75 % à une composition', v:j.meilleure_semaine || 0, c:75, u:'%' }),
  j => ({ t:'Refermer 10 erreurs cette semaine', v:j.refermees_semaine || 0, c:10, u:'erreurs' }),
  j => ({ t:'Faire 3 compositions cette semaine', v:j.compos_semaine || 0, c:3, u:'compositions' })
];
function blocDefi(){
  if(!S.journee) return '';
  const d = DEFIS[(S.journee.defi || 0) % DEFIS.length](S.journee);
  const fait = d.v >= d.c;
  return `<div class="carte">
    <div class="libelle" style="margin-bottom:6px"><span>${ico('trophee',14)} Défi de la semaine</span>${fait ? '<span class="tampon t-ok">Réussi</span>' : ''}</div>
    <div style="font-weight:600;font-size:14.5px">${d.t}</div>
    <div class="jauge-defi"><i style="width:${Math.min(100, Math.round(d.v / d.c * 100))}%"></i></div>
    <div class="sous" style="font-size:12.5px">${Math.min(d.v, d.c)}${d.u === '%' ? ' %' : ''} sur ${d.c}${d.u === '%' ? ' %' : ' ' + d.u} · nouveau défi chaque lundi</div>
  </div>`;
}

/* ---------- le fil « Pour toi » ---------- */
async function lancerFil(n){
  if(!S.util.connecte){ S.modal = 'inscription'; S.erreur = ''; return surcouche(); }
  S.fil = { liste:null, idx:0, rep:undefined, c:null, justes:0, revues:0, n:+n || 10, attente:false };
  if(S.filPret && Date.now() - S.filPret.t < 15 * 60000 && (+n || 10) === 10){
    S.fil.liste = S.filPret.liste; S.fil.debut = Date.now(); S.filPret = null;
    aller('pourtoi');
    setTimeout(prechargerFil, 4000);
    return;
  }
  aller('pourtoi');
  try{
    const { data, error } = await base.rpc('fil_pour_toi', { p_niveau: niveauCand(), p_nombre: S.fil.n });
    if(error) throw error;
    S.fil.liste = data || [];
    S.fil.debut = Date.now();
  }catch(e){ S.fil.liste = []; S.fil.erreur = true; }
  pister('FEED_OPENED', { n: S.fil.n });
  if(S.ecran === 'pourtoi') rendre();
}
function prechargerFil(){
  if(!base || !S.util.connecte || S.filPret) return;
  base.rpc('fil_pour_toi', { p_niveau: niveauCand(), p_nombre: 10 }).then(({ data }) => { if(Array.isArray(data) && data.length) S.filPret = { liste:data, t:Date.now() }; }, () => {});
}

/* Le moment de payer : un seul message, choisi selon ce que le candidat fait le plus */
function offreSelonUsage(){
  const compos = (S.stats && S.stats.compositions) || 0, qcm = (S.stats && S.stats.questions_resolues) || 0, err = ouvertes();
  const rang = S.classement ? S.classement.rang : null, pop = S.classement ? S.classement.population : null;
  const place = rang && pop ? ` Tu es ${nombreFr(rang)}ᵉ sur ${nombreFr(pop)}.` : '';
  if(err >= 20 && err * 2 >= qcm / 10) return { titre:'Corriger tes erreurs est ton meilleur atout pour progresser dans ta révision', texte:`Tu as ${nombreFr(err)} erreurs à reprendre. Chacune refermée rapporte 20 points. Avec l\'abonnement, les corrections n\'ont plus de limite : tu peux toutes les reprendre.` };
  if(compos >= 3 && compos * 25 >= qcm / 4) return { titre:`Tu as déjà fait ${compos} compositions`, texte:`${place.trim()} L\'abonnement ouvre toutes les compositions chronométrées et le classement national jusqu\'au concours.`.trim() };
  return { titre:'Tu avances bien, continue sur ta lancée', texte:`${nombreFr(qcm)} questions faites.${place} L\'abonnement ouvre toutes les questions de toutes les matières, corrigées et expliquées.` };
}
function boutonConseillerAbo(){
  return `<a class="cta" style="display:block;margin-top:12px;text-align:center;text-decoration:none" href="https://wa.me/226${numeroConseiller()}?text=${encodeURIComponent(messageConseiller('annuelle'))}" target="_blank" rel="noopener" data-conseiller-wa="mur-fil" data-conseiller-formule="annuelle">${logoReseau('whatsapp')} Faire l'abonnement avec un conseiller sur WhatsApp</a>`;
}
function ecranPourToi(){
  const f = S.fil;
  if(!f) return lancerFil(10);
  const nomFil = f.titre || 'POUR TOI';
  const tete = (txt) => `<div class="qcm-tete"><span class="q">${txt.replace('POUR TOI', E(nomFil))}</span>
      <button class="x-mode ${S.concentration ? 'on' : ''}" data-concentration="1" aria-pressed="${!!S.concentration}" aria-label="Mode concentration">${ico('cible',15)}</button>
      <button class="x" data-go="aujourdhui" aria-label="Fermer">✕</button></div>`;
  if(f.liste === null){
    vue().innerHTML = tete('POUR TOI') + `<div class="qzone" style="padding-top:12px"><div class="squelette large"></div><div class="squelette"></div><p class="sous">On choisit tes questions…</p></div>`;
    return;
  }
  if(!f.liste.length){
    vue().innerHTML = tete('POUR TOI') + `<div class="qzone" style="padding-top:12px"><p class="sous">${f.erreur ? 'Le fil n\'a pas pu être chargé. Vérifie ta connexion.' : 'Aucune question disponible pour ce niveau pour le moment.'}</p>
      <button class="cta" style="margin-top:12px" data-go="aujourdhui">Revenir à l'actualité</button></div>`;
    return;
  }
  if(f.idx >= f.liste.length){
    if(f.seanceX) return finSeanceX(f, tete);
    vue().innerHTML = tete('POUR TOI · TERMINÉ') + `<div class="qzone" style="padding-top:18px">
      <h1 class="titre" style="font-size:26px">${f.liste.length} questions faites</h1>
      <div class="duo" style="margin-top:14px">
        <div class="stat"><div class="v num">${f.justes}</div><div class="l">Bonnes réponses</div></div>
        <div class="stat"><div class="v num">${f.revues}</div><div class="l">Erreurs revues</div></div>
      </div>
      ${(f.fautes || []).length ? `<div class="bloc"><div class="libelle">À revoir avant de partir</div>
        ${f.fautes.slice(0, 3).map(x => `<div class="err" style="margin-bottom:8px"><div class="q" style="font-size:13.5px">${E(x.q)}</div><div class="ligne">Bonne réponse : <b>${E(x.bon)}</b></div></div>`).join('')}</div>` : ''}
      <div class="verdict solide" style="margin-top:12px"><b>Pour ta prochaine visite</b>${E(conseilProchaineVisite(f))}</div>
      <button class="cta" style="margin-top:14px" data-pourtoi="5">Encore 5 ?</button>
      <button class="cta creux" style="margin-top:9px" data-go="aujourdhui">Revenir à l'actualité</button>
    </div>`;
    return;
  }
  const q = f.liste[f.idx], c = f.c, rep = f.rep;
  const cl = { 'Prioritaire':'t-feu', 'Recommandée':'t-att', 'À consolider':'t-att' }[q.etiquette] || 't-ok';
  vue().innerHTML = tete(`POUR TOI · ${f.idx + 1} / ${f.liste.length}`) + `
  <div class="qzone" style="padding-top:12px">
    <div class="progression" style="margin-bottom:14px"><i class="on" style="flex:${f.idx + 1}"></i><i style="flex:${f.liste.length - f.idx - 1}"></i></div>
    <div class="fil-meta"><span class="tampon ${cl}">${E(q.etiquette)}</span><span class="eyebrow">${E(q.matiere || '')}</span></div>
    <p class="fil-raison">${ico('question',13)} ${E(q.raison)}</p>
    <div class="qtexte">${E(q.enonce)}</div>
    ${(q.options || []).map((o, i) => {
      let k = '';
      if(c && c.ok){ if((c.bonnes || []).includes(i)) k = 'juste'; else if(i === rep) k = 'faux'; }
      else if(i === rep) k = 'choisi attente';
      return `<button class="opt ${k}" ${rep !== undefined ? 'disabled' : ''} data-fil-rep="${i}"><span class="lettre">${'ABCD'[i] || '•'}</span>${E(o)}</button>`;
    }).join('')}

    ${c && !c.ok && c.quota ? `<div class="mur-fini">${c.motif === 'matiere'
        ? `<i class="mf-coche" aria-hidden="true">✓</i><div><h2>Tes 15 questions offertes en ${E(c.matiere || q.matiere || 'cette matière')} sont faites</h2><p>Tu es lancé, ne t'arrête pas là.</p></div>`
        : `<i class="mf-coche" aria-hidden="true">✓</i><div><h2>Tes 5 corrections du jour sont faites</h2><p>Elles reviennent demain matin. Ou continue maintenant, sans attendre.</p></div>`}</div>
      ${(() => { const o = offreSelonUsage(); return `<div class="mur-atout"><b>${E(o.titre)}</b><span>${E(o.texte)}</span></div>`; })()}
      ${offreDeuxPrix(true)}
      ${c.motif === 'matiere' ? `<button class="cta creux" style="margin-top:9px" data-fil-suiv="1">Question suivante →</button>` : `<button class="cta creux" style="margin-top:9px" data-demain="1">À demain</button>`}` : ''}
    ${c && !c.ok && !c.quota ? `<div class="retour mal"><b>Correction indisponible</b>${E(c.message || '')}</div>
      <button class="cta" style="margin-top:12px" data-fil-suiv="1">Question suivante →</button>` : ''}
    ${c && c.ok ? `
      <div class="retour ${c.correcte ? 'bien' : 'mal'}">
        <b>${c.correcte ? 'Bonne réponse' : 'Réponse incorrecte'}</b>
        ${c.correcte ? '' : `<div style="margin-bottom:6px">La bonne réponse : <strong class="bonne-rep">${E((c.bonnes || []).map(k => 'ABCD'[k] + '. ' + q.options[k]).join(' + '))}</strong></div>`}
        ${c.explication ? `<b style="margin-top:2px">Pourquoi ?</b>${E(c.explication)}` : ''}
        ${c.acquise ? '<div style="margin-top:6px;font-size:12.5px">Trois bonnes réponses d\'affilée : elle sort de « Mes erreurs ».</div>' : (c.correcte ? '' : '<div style="margin-top:6px;font-size:12.5px">Elle reste dans « Mes erreurs ».</div>')}
      </div>
      ${!c.correcte && q.etiquette !== 'Similaire' ? `<button class="cta creux" style="margin-top:10px" data-similaires="${E(q.id)}">S'entraîner sur 3 questions similaires</button>` : ''}
      <div class="actions-q">
        <button class="lien-mini" data-signaler="${E(q.id)}">${ico('drapeau',13)} Signaler une erreur</button>
        <button class="lien-mini" data-partage-question="${E(q.id)}">${ico('partage',13)} Partager</button>
      </div>
      <p class="sous glisser-info">Glisse vers le haut pour la suite</p>
      <button class="cta" style="margin-top:12px" data-fil-suiv="1">${f.idx + 1 < f.liste.length ? 'Question suivante →' : 'Voir mon bilan'}</button>` : ''}
  </div>`;
}
function conseilProchaineVisite(f){
  const j = S.journee || {};
  const taux = f.liste.length ? f.justes / f.liste.length : 0;
  if((f.fautes || []).length >= 3) return 'Reviens demain : tes fautes d\'aujourd\'hui reviendront en premier, c\'est le meilleur moment pour les fixer.';
  if(taux >= 0.8 && !j.compos_semaine) return 'Tu es prêt pour une composition complète en conditions réelles : 50 questions, 40 minutes.';
  if(taux >= 0.8) return 'Très bonne série. Demain, essaie les questions les plus ratées par tous.';
  return 'Demain, dix minutes suffisent : le fil reprendra là où tu bloques.';
}
async function repondreFil(i){
  const f = S.fil; if(!f || f.rep !== undefined) return;
  const q = f.liste[f.idx];
  f.rep = i; f.attente = true; ecranPourToi();
  const r = await corrigerAuServeur(q.id, [i], q.contexte === 'erreurs' ? 'erreurs' : 'revision', Date.now() - (f.debut || Date.now()));
  f.attente = false; f.c = r;
  if(r.ok){
    if(r.correcte){ f.justes++; sonJuste(); } else sonFaux();
    if(q.contexte === 'erreurs') f.revues++;
    if(!r.correcte){ f.fautes = f.fautes || []; f.fautes.push({ q:q.enonce, bon:(r.bonnes || []).map(k => q.options[k]).join(' + ') }); }
    compterReponse();
    pister('FEED_ANSWERED', { juste: !!r.correcte, etiquette: q.etiquette });
  }
  if(S.ecran === 'pourtoi') ecranPourToi();
}

/* ---------- question du jour ---------- */
async function chargerQdj(){
  if(!base) return;
  try{
    const { data } = await base.rpc('question_du_jour');
    S.qdj = (data && data.ok) ? { ...data, jourLocal: new Date().toDateString() } : { vide:true };
  }catch(e){ S.qdj = { erreur:true }; }
  if(S.ecran === 'qdj') rendre();
}
function ecranQdj(){
  const q = S.qdj;
  if(!q){ chargerQdj(); vue().innerHTML = `<div class="pad"><button class="retourhaut" data-go="aujourdhui">Retour</button><div class="squelette large" style="margin-top:16px"></div></div>`; return; }
  if(q.vide || q.erreur){ vue().innerHTML = `<div class="pad"><button class="retourhaut" data-go="aujourdhui">Retour</button><h1 class="titre">Question du jour</h1><p class="sous">${q.erreur ? 'Elle n\'a pas pu être chargée. Vérifie ta connexion.' : 'Pas de question du jour pour le moment.'}</p></div>`; return; }
  const c = S.qdjCorrection, rep = S.qdjRep;
  vue().innerHTML = `
  <div class="pad">
    <button class="retourhaut" data-go="aujourdhui">Retour</button>
    <div class="eyebrow">${E(dateDuJour())} · ${E(q.matiere || '')}</div>
    <h1 class="titre">La question du jour</h1>
    <p class="sous" style="margin:6px 0 14px">La même pour tous les candidats aujourd'hui${q.repondants ? ` · <span class="num">${q.repondants}</span> ont déjà répondu` : ''}.</p>
    <div class="qtexte">${E(q.enonce)}</div>
    ${(q.options || []).map((o, i) => {
      let k = '';
      if(c && c.ok){ if((c.bonnes || []).includes(i)) k = 'juste'; else if(i === rep) k = 'faux'; }
      else if(i === rep) k = 'choisi attente';
      return `<button class="opt ${k}" ${rep !== undefined ? 'disabled' : ''} data-qdj-rep="${i}"><span class="lettre">${'ABCD'[i] || '•'}</span>${E(o)}</button>`;
    }).join('')}
    ${c && c.ok ? `
      <div class="retour ${c.correcte ? 'bien' : 'mal'}">
        <b>${c.correcte ? 'Bonne réponse' : 'Réponse incorrecte'}</b>
        ${c.correcte ? '' : `<div style="margin-bottom:6px">La bonne réponse : <strong class="bonne-rep">${E((c.bonnes || []).map(k => 'ABCD'[k] + '. ' + q.options[k]).join(' + '))}</strong></div>`}
        ${c.explication ? `<b style="margin-top:2px">Pourquoi ?</b>${E(c.explication)}` : ''}
      </div>
      ${c.taux !== null && c.taux !== undefined ? `<p class="sous" style="margin-top:10px"><span class="num">${c.taux} %</span> des candidats ont trouvé la bonne réponse aujourd'hui.</p>` : ''}
      <button class="cta" style="margin-top:12px" data-partage-qdj="1">${ico('partage',16)} Défier un camarade<small>Envoie-lui la question du jour sur WhatsApp</small></button>
      ${S.util.connecte ? `<button class="cta creux" style="margin-top:9px" data-pourtoi="10">Continuer avec 10 questions pour toi${!S.gratuit && !estAbonne() ? '<small>Gratuit : 5 corrections par jour. Sans limite avec l\'abonnement.</small>' : ''}</button>`
        : `<button class="cta creux" style="margin-top:9px" data-modal="inscription">Créer mon compte gratuit<small>Pour garder tes erreurs et ta progression</small></button>`}
      ${S.util.connecte ? `<div class="actions-q"><button class="lien-mini" data-signaler="${E(q.id)}">${ico('drapeau',13)} Signaler une erreur</button></div>` : ''}` : ''}

    ${c && !c.ok ? `<div class="retour mal"><b>Correction indisponible</b>${E(c.message || 'Réessaie dans un instant.')}</div>` : ''}
  </div>`;
}
async function repondreQdj(i){
  if(S.qdjRep !== undefined || !base) return;
  S.qdjRep = i; S.qdjCorrection = null; ecranQdj();
  try{
    const { data, error } = await base.rpc('repondre_question_du_jour', { p_choix:[i], p_session: O.session || null });
    if(error) throw error;
    S.qdjCorrection = data || { ok:false };
    if(data && data.ok){ data.correcte ? sonJuste() : sonFaux(); if(S.util.connecte) compterReponse(); }
  }catch(e){ S.qdjCorrection = { ok:false, message:'Vérifie ta connexion.' }; S.qdjRep = undefined; }
  pister('DAILY_QUESTION_ANSWERED', { juste: !!(S.qdjCorrection && S.qdjCorrection.correcte) });
  if(S.ecran === 'qdj') ecranQdj();
}

/* ---------- une question reçue par lien ---------- */
async function chargerQuestionPartagee(id){
  if(!base) return;
  S.lienQuestion = null;
  S.qp = { id, charge:false };
  try{
    const { data } = await base.rpc('question_publique', { p_id: id });
    S.qp = (data && data.ok) ? { ...data, charge:true } : { vide:true, charge:true };
  }catch(e){ S.qp = { erreur:true, charge:true }; }
  if(S.ecran === 'question') rendre();
}
function ecranQuestionPartagee(){
  const q = S.qp;
  if(!q || !q.charge){ vue().innerHTML = `<div class="pad"><div class="squelette large" style="margin-top:16px"></div></div>`; return; }
  if(q.vide || q.erreur){ vue().innerHTML = `<div class="pad"><button class="retourhaut" data-go="aujourdhui">Retour</button><h1 class="titre">Question indisponible</h1><p class="sous">Cette question n'existe plus ou n'est pas accessible pour le moment.</p><button class="cta" style="margin-top:14px" data-go="qdj">Voir la question du jour</button></div>`; return; }
  const c = q.c, rep = q.rep;
  vue().innerHTML = `
  <div class="pad">
    <button class="retourhaut" data-go="aujourdhui">Retour</button>
    <div class="eyebrow">Question partagée · ${E(q.matiere || '')}</div>
    <h1 class="titre" style="font-size:24px">Un camarade te défie</h1>
    <div class="qtexte" style="margin-top:12px">${E(q.enonce)}</div>
    ${(q.options || []).map((o, i) => {
      let k = '';
      if(c && c.ok){ if((c.bonnes || []).includes(i)) k = 'juste'; else if(i === rep) k = 'faux'; }
      else if(i === rep) k = 'choisi';
      return `<button class="opt ${k}" ${rep !== undefined ? 'disabled' : ''} data-qp-rep="${i}"><span class="lettre">${'ABCD'[i] || '•'}</span>${E(o)}</button>`;
    }).join('')}
    ${rep !== undefined && !S.util.connecte ? `<div class="retour mal"><b>Ta réponse : ${'ABCD'[rep]}</b>Crée ton compte gratuit pour voir la correction et l'explication. Ça prend trente secondes.</div>
      <button class="cta" style="margin-top:12px" data-modal="inscription">Créer mon compte et voir la correction</button>
      <button class="cta creux" style="margin-top:9px" data-go="qdj">Essayer la question du jour (correction ouverte à tous)</button>` : ''}
    ${c && c.ok ? `<div class="retour ${c.correcte ? 'bien' : 'mal'}"><b>${c.correcte ? 'Bonne réponse' : 'Réponse incorrecte'}</b>
        ${c.correcte ? '' : `<div style="margin-bottom:6px">La bonne réponse : <strong class="bonne-rep">${E((c.bonnes || []).map(k => 'ABCD'[k] + '. ' + q.options[k]).join(' + '))}</strong></div>`}
        ${c.explication ? `<b style="margin-top:2px">Pourquoi ?</b>${E(c.explication)}` : ''}</div>
      <button class="cta" style="margin-top:12px" data-pourtoi="10">Continuer avec 10 questions pour toi</button>` : ''}
    ${c && !c.ok ? `<div class="retour mal"><b>Correction indisponible</b>${E(c.message || '')}</div>` : ''}
  </div>`;
}
async function repondreQuestionPartagee(i){
  const q = S.qp; if(!q || q.rep !== undefined) return;
  q.rep = i;
  if(S.util.connecte){
    const r = await corrigerAuServeur(q.id, [i], 'revision');
    q.c = r; if(r.ok){ r.correcte ? sonJuste() : sonFaux(); compterReponse(); }
  }
  pister('SHARED_QUESTION_ANSWERED', { connecte: S.util.connecte });
  rendre();
}
function partagerQuestion(id, texteQ){
  const lien = CONTACT.site + '/?question=' + encodeURIComponent(id);
  const t = 'Tu trouves la bonne réponse ? ' + (texteQ ? '« ' + texteQ + ' »' : '') + ' Réponds ici :';
  pister('QUESTION_SHARED');
  window.open('https://wa.me/?text=' + encodeURIComponent(t + ' ' + lien), '_blank', 'noopener');
}

/* ---------- les résultats d'une composition nationale ---------- */
/* chaque ouverture des résultats compte, même par la même personne (le chiffre s'affiche sur la carte de l'accueil) */
const _vuesComptees = new Set();
function idVisiteur(){
  try{
    let v = localStorage.getItem('mc_visiteur');
    if(!v){ v = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)); localStorage.setItem('mc_visiteur', v); }
    return v;
  }catch(e){ return null; }
}
function compterVueResultats(id){
  if(!base || !id) return;
  base.rpc('compter_vue_resultats', S.util.connecte ? { p_epreuve: id } : { p_epreuve: id, p_visiteur: idVisiteur() }).then(() => {
    const d = S.derniereNat;
    if(d && d.id === id){ d.vues = (d.vues || 0) + 1; if(S.ecran === 'aujourdhui') rendre(); }
  }, () => {});
}
async function chargerClassement(id){
  /* déjà là (préchargé ou vu) : on l'affiche et on le met à jour en silence */
  if(!(S.classementEp && S.classementEp.id === id && S.classementEp.charge && S.classementEp.ok)) S.classementEp = { id, charge:false };
  if(!base){ S.lienEpreuve = id; return; }
  S.lienEpreuve = null;
  if(S.ecran === 'gagnants') rendre();
  try{
    const { data } = await base.rpc('classement_epreuve', { p_epreuve: id });
    const neuf = { ...(data || { ok:false }), id, charge:true };
    if(pareil(neuf, S.classementEp)) return;
    S.classementEp = neuf;
    if(neuf.ok && neuf.termine) chargerDiscussion(id, true);
  }catch(e){ if(!(S.classementEp && S.classementEp.ok)) S.classementEp = { id, charge:true, ok:false, erreur:true }; }
  if(S.ecran === 'gagnants') rendre();
}
const initialesPseudo = p => (p || '?').replace(/[^A-Za-zÀ-ÿ]/g, '').slice(0, 2).toUpperCase();
const mmssLong = s => s ? Math.floor(s/60) + ' min ' + String(s%60).padStart(2,'0') : '—';
const REACTIONS = [['bravo','Bravo'],['bien_joue','Bien joué'],['respect','Respect']];
function boutonsReactions(l){
  if(l.moi) return Object.keys(l.reactions || {}).length
    ? `<div class="reactions">${REACTIONS.filter(([k]) => l.reactions[k]).map(([k, t]) => `<span class="reac lu">${t} · ${l.reactions[k]}</span>`).join('')}</div>` : '';
  return `<div class="reactions">${REACTIONS.map(([k, t]) => {
    const n = (l.reactions || {})[k] || 0, mien = (l.mes_reactions || []).includes(k);
    return `<button class="reac ${mien ? 'on' : ''}" data-reagir="${E(l.composition)}|${k}" aria-pressed="${mien}">${t}${n ? ' · ' + n : ''}</button>`;
  }).join('')}</div>`;
}
/* ---------- l'entrée « dernière composition nationale » : visible par tous ---------- */
function blocDerniereNationale(force){
  const d = derniereCompoFinie();
  if(!d) return '';
  /* la carte juste au-dessus propose déjà ces résultats quand c'est la même épreuve, sauf quand ils sont mis en vedette */
  if(!force && S.epreuve && S.epreuve.id === d.id && S.epreuve.etat === 'terminee') return '';
  return `<button class="derniere-nat" data-gagnants="${E(d.id)}">
    <span class="dn-ic">${ico('trophee',22)}</span>
    <span class="dn-txt"><small>Dernière composition nationale</small><b>Voir les résultats et le classement</b><span>${E(d.concours || 'Composition nationale')} · ${E(jourFr(d.debut_le))}</span></span>
    <span class="dn-fl">→</span>${d.vues >= 1 ? `<span class="dn-vues" aria-label="${d.vues} vue${d.vues > 1 ? 's' : ''}">${ico('vue', 15)}<b>${nombreFr(d.vues)}</b></span>` : ''}</button>`;
}
async function chargerCorrectionNat(id){
  if(!(S.corrNat && S.corrNat.id === id && S.corrNat.ok)) S.corrNat = { id, charge:false };
  if(!base) return;
  try{
    const { data } = await base.rpc('correction_epreuve', { p_epreuve: id });
    S.corrNat = { ...(data || { ok:false }), id, charge:true };
  }catch(e){ S.corrNat = { id, charge:true, ok:false, erreur:true }; }
  if(S.ecran === 'correctionnat') rendre();
}
/* Synthèse de la correction générale : même contenu à l'écran et dans le PDF */
function syntheseCorrNat(corr, c){
  const qs = (corr && corr.questions) || [];
  const groupes = {};
  qs.forEach((q, i) => {
    const nom = q.matiere || 'Culture générale';
    const g = groupes[nom] || (groupes[nom] = { nom, n:0, somme:0, avec:0 });
    g.n++;
    if(typeof q.reussite === 'number'){ g.somme += q.reussite; g.avec++; }
  });
  const mats = Object.values(groupes).map(g => ({ nom:g.nom, n:g.n, pct:g.avec ? Math.round(g.somme / g.avec) : null }));
  const mesures = mats.filter(m => m.pct !== null).sort((a, b) => a.pct - b.pct);
  const recos = [];
  if(mesures.length > 1){
    const bas = mesures[0], haut = mesures[mesures.length - 1];
    recos.push('La matière la moins réussie est ' + bas.nom + ' (' + bas.pct + ' % de réussite en moyenne). Reprenez son cours avant la prochaine composition.');
    if(haut.pct - bas.pct >= 10) recos.push(haut.nom + ' a été la mieux réussie (' + haut.pct + ' %). Gardez ce niveau avec un peu de révision chaque semaine.');
  }
  const ratees = qs.map((q, i) => ({ no:i + 1, p:q.reussite })).filter(x => typeof x.p === 'number').sort((a, b) => a.p - b.p).slice(0, 3);
  if(ratees.length && ratees[0].p < 60)
    recos.push('Les questions les plus ratées sont les n° ' + ratees.map(x => x.no).join(', ') + '. Lisez leur explication ci-dessus et refaites-les dans « Mes erreurs ».');
  if(c && c.moyenne !== null && c.moyenne !== undefined && c.sur)
    recos.push('La moyenne de la composition était de ' + String(c.moyenne).replace('.', ',') + ' sur ' + c.sur + '. Pour être admis, visez la note du dernier admis, pas seulement la moyenne.');
  recos.push('Chaque jour, reprenez vos erreurs dans « Mes erreurs » : une question revient jusqu\'à trois bonnes réponses d\'affilée.');
  recos.push('Refaites un sujet complet en 40 minutes, sans interruption, comme le jour du concours.');
  return { mats, recos };
}
function lettresBonnes(q){ return (q.bonnes || []).map(k => 'ABCDEFGH'[k] || (k + 1)).join(', '); }

function ecranCorrectionNat(){
  const c = S.corrNat;
  const tete = `<button class="retourhaut" data-gagnants="${E(c ? c.id : '')}">Retour aux résultats</button>`;
  if(!c || !c.charge){ vue().innerHTML = `<div class="pad">${tete}<div class="squelette large" style="margin-top:16px"></div><div class="squelette"></div></div>`; return; }
  if(!c.ok){ vue().innerHTML = `<div class="pad">${tete}<h1 class="titre">Corrigé indisponible</h1><p class="sous">${E(c.message || 'Vérifiez votre connexion.')}</p></div>`; return; }
  if(!c.publie){
    vue().innerHTML = `<div class="pad">${tete}
      <div class="eyebrow">Composition nationale</div>
      <h1 class="titre">Corrigé bientôt disponible</h1>
      <p class="sous" style="margin-top:8px">${c.fin_le ? 'Le corrigé est publié à ' + heureH(c.fin_le) + ', à la fin de l\'épreuve.' : 'Le corrigé sera publié dans quelques heures, une fois l\'épreuve en cours terminée.'}</p></div>`;
    return;
  }
  const L = 'ABCDEFGH';
  const cl = S.classementEp && S.classementEp.id === c.id ? S.classementEp : null;
  const syn = syntheseCorrNat(c, cl);
  const nq = (c.questions || []).length;
  const grille = (c.questions || []).map((q, i) => `<div class="cg-l"><span class="cg-no">${i + 1}</span>${(q.options || []).map((_, k) =>
    `<span class="cg-b${(q.bonnes || []).includes(k) ? ' on' : ''}">${L[k] || k + 1}</span>`).join('')}</div>`).join('');
  const qs = (c.questions || []).map((q, i) => {
    const bonnes = q.bonnes || [];
    return `<div class="carte cn-corr">
      <div class="libelle" style="margin-bottom:6px"><span>Question ${i + 1}${q.matiere ? ' · ' + E(q.matiere) : ''}</span>${q.reussite !== null && q.reussite !== undefined ? `<span class="num">${q.reussite} % de réussite</span>` : ''}</div>
      <p style="font-weight:600;margin-bottom:10px">${E(q.enonce)}</p>
      ${(q.options || []).map((o, k) => `<div class="opt${bonnes.includes(k) ? ' juste' : ''}" style="cursor:default"><span class="lettre">${L[k] || k + 1}</span><span>${E(o)}</span></div>`).join('')}
      ${q.explication ? `<p class="sous" style="margin-top:8px"><b>Pourquoi ?</b> ${E(q.explication)}</p>` : ''}
    </div>`;
  }).join('');
  const mats = syn.mats.length ? `<div class="libelle" style="margin-top:22px">Résultats par matière</div><div class="carte cg-mats">${syn.mats.map(m =>
    `<div class="cg-m"><span>${E(m.nom)}</span><span class="num">${m.n} question${m.n > 1 ? 's' : ''}</span><b class="num">${m.pct === null ? '—' : m.pct + ' %'}</b></div>`).join('')}</div>` : '';
  vue().innerHTML = `<div class="pad">${tete}
    <div class="cg-tete"><span class="cg-sceau"><i></i><i></i><i></i><i></i></span>
      <div><b>MON CONCOURS</b><span>Concours directs du Burkina Faso</span></div></div>
    <h1 class="titre" style="margin:0 0 4px">Correction générale</h1>
    <p class="cg-sous">${cl ? 'Composition nationale · ' + E(cl.concours || cl.titre || '') + (cl.debut_le ? ' · ' + E(jourFr(cl.debut_le)) : '') : 'Composition nationale'}</p>
    <div class="cg-stats"><div><b class="num">${nq}</b><span>question${nq > 1 ? 's' : ''}</span></div><div><b class="num">${nombreFr(c.participants || 0)}</b><span>candidat${(c.participants||0)>1?'s':''}</span></div>${cl && cl.moyenne !== null && cl.moyenne !== undefined ? `<div><b class="num">${String(cl.moyenne).replace('.', ',')}/${cl.sur}</b><span>moyenne</span></div>` : ''}</div>
    <div style="height:16px"></div>
    <div class="libelle">Feuille de réponses</div>
    <div class="carte"><div class="cg-grille">${grille}</div><p class="sous" style="margin:10px 0 0;font-size:12px"><span class="cg-b on" style="display:inline-grid;width:16px;height:16px;font-size:9px">✓</span> Réponse attendue</p></div>
    <div class="libelle" style="margin-top:22px">Le sujet corrigé</div>
    ${qs}
    ${mats}
    <div class="libelle" style="margin-top:22px">Recommandations</div>
    <div class="carte"><ol class="cg-reco">${syn.recos.map(r => `<li>${E(r)}</li>`).join('')}</ol></div>
  </div>`;
}
const STATUTS = { admis:'Admis', attente:'Liste d\'attente', echoue:'Non admis' };

/* ---------- la discussion ouverte d'une composition nationale ---------- */
const LIB_DISC = { indispo:'La discussion est réservée aux candidats inscrits à cette composition.' };
async function chargerDiscussion(id, apercu){
  if(!base || !S.util.connecte) return;
  try{
    const { data } = await base.rpc('discussion_charger', { p_epreuve: id });
    const neuf = { ...(data || { ok:false }), id, charge:true };
    const avant = S.disc;
    S.disc = neuf;
    if(avant && avant.id === id && pareil({ ...avant, ecrivent:0, voient:0 }, { ...neuf, ecrivent:0, voient:0 }) && JSON.stringify(avant.ecrivent) === JSON.stringify(neuf.ecrivent) && avant.voient === neuf.voient) return;
    if(apercu){ if(S.ecran === 'gagnants') rendre(); }
    else majDiscussionDom();
  }catch(e){}
}
async function chargerStatsGroupe(id){
  if(!base || !S.util.connecte) return;
  if(S.statsGroupe && S.statsGroupe.id === id && S.statsGroupe.ok) return;
  try{
    const { data } = await base.rpc('stats_groupe_epreuve', { p_epreuve: id });
    S.statsGroupe = { ...(data || { ok:false }), id };
    if(S.ecran === 'discussion') majDiscussionDom();
  }catch(e){}
}
function blocDiscussionApercu(id){
  const d = S.disc && S.disc.id === id ? S.disc : null;
  if(d && !d.ok) return '';   // pas inscrit : on ne propose rien
  const tous = d && d.messages ? d.messages : [];
  const msgs = tous.slice(-3);
  const total = d && d.total ? d.total : tous.length;
  const reste = Math.max(0, total - msgs.length);
  const ecrit = d && d.ecrivent ? d.ecrivent : [];
  const voient = d && d.voient ? d.voient : 0;
  const pre = n => (n || '').split(' ').slice(0, 2).join(' ');
  const enDirect = ecrit.length || voient;
  const ligneEcrit = ecrit.length
    ? `<div class="disc-tape"><span class="pts"><i></i><i></i><i></i></span>${E(ecrit.length === 1 ? pre(ecrit[0]) + ' écrit…' : ecrit.length === 2 ? pre(ecrit[0]) + ' et ' + pre(ecrit[1]) + ' écrivent…' : pre(ecrit[0]) + ' et ' + (ecrit.length - 1) + ' autres écrivent…')}</div>` : '';
  return `<div class="disc-carte disc-vivante">
    <div class="disc-tete">
      <span class="disc-bulle">${ico('bulle', 20)}</span>
      <div class="disc-tt"><b>La discussion est ouverte</b><span>${total ? total + ' message' + (total > 1 ? 's' : '') : 'Soyez le premier à écrire'}${voient ? ' · ' + voient + ' en ligne' : ''}</span></div>
      <span class="disc-pill"><i></i>En direct</span>
    </div>
    ${msgs.length ? `<div class="disc-fil-ap">${msgs.map(m => `<div class="disc-ligne"><span class="d-av">${E(initialesPseudo(m.nom))}</span><div><b>${E(m.nom)}</b><span>${E(m.texte)}</span></div></div>`).join('')}</div>` : '<p class="sous" style="margin:10px 0 0">Comparez vos réponses, posez vos questions aux autres candidats.</p>'}
    ${ligneEcrit}
    ${reste ? `<button type="button" class="disc-reste" data-discussion="${E(id)}">Voir les ${reste} autre${reste > 1 ? 's' : ''} message${reste > 1 ? 's' : ''}</button>` : ''}
    <button type="button" class="disc-faux" data-discussion="${E(id)}"><span>${d && d.peut_ecrire === false ? 'Inscrivez-vous à la prochaine pour écrire' : 'Écrire un message…'}</span><i>${d && d.peut_ecrire === false ? '→' : '➤'}</i></button>
  </div>`;
}
function ouvrirDiscussion(id){
  S.discId = id;
  if(!(S.disc && S.disc.id === id)) S.disc = null;
  aller('discussion');
  chargerDiscussion(id, false); chargerStatsGroupe(id);
  pister('DISCUSSION_OUVERTE');
}
function lignesDiscussion(){
  const d = S.disc;
  if(!d || !d.charge) return '<div class="squelette"></div><div class="squelette"></div>';
  if(!d.ok) return `<p class="sous">${E(d.message || LIB_DISC.indispo)}</p>`;
  if(!d.messages.length) return '<p class="sous" style="text-align:center;margin:18px 0">Aucun message pour l\'instant. Écrivez le premier.</p>';
  return d.messages.map(m => `<div class="msg-d${m.moi ? ' moi' : ''}">
      <span class="d-av${m.equipe ? ' eq' : ''}">${E(initialesPseudo(m.nom))}</span>
      <div class="d-co"><div class="d-bulle"><b>${E(m.nom)}${m.equipe ? ' · équipe' : ''}</b>${E(m.texte)}</div>
        <div class="d-pied"><button class="d-coeur${m.aime ? ' on' : ''}" data-disc-aimer="${E(m.id)}" aria-pressed="${!!m.aime}">${m.aime ? '❤️' : '🤍'}${m.coeurs ? ' ' + m.coeurs : ''}</button>
        <span>${E(heureH(m.cree_le))}</span>${m.moi || d.equipe ? `<button class="d-suppr" data-disc-suppr="${E(m.id)}">Supprimer</button>` : ''}</div></div>
    </div>`).join('');
}
function texteEcrivent(){
  const e = (S.disc && S.disc.ecrivent) || [], v = (S.disc && S.disc.voient) || 0;
  const voient = v > 0 ? `<span class="disc-voient">${v} personne${v > 1 ? 's consultent' : ' consulte'} cette discussion</span>` : '';
  if(!e.length) return voient;
  const pre = n => (n || '').split(' ').slice(0, 2).join(' ');
  return voient + `<span class="disc-live"><i></i>${e.length === 1 ? E(pre(e[0])) + ' écrit…' : e.length === 2 ? E(pre(e[0])) + ' et ' + E(pre(e[1])) + ' écrivent…' : E(pre(e[0])) + ' et ' + (e.length - 1) + ' autres écrivent…'}</span>`;
}
function blocStatsGroupe(){
  const t = S.statsGroupe;
  if(!t || !t.ok || t.vide) return '';
  const barre = (lib, v, coul) => `<div class="stat-g"><div class="t"><span>${lib}</span><b class="num" style="color:${coul}">${v} %</b></div><div class="b"><i style="width:${v}%;background:${coul}"></i></div></div>`;
  return `<div class="libelle" style="margin-top:18px">Le groupe en chiffres</div>
    <div class="mini-g"><div><b class="num">${String(t.moyenne).replace('.', ',')}</b>moyenne /${t.sur}</div><div><b class="num">${t.minutes} min</b>temps moyen</div><div><b class="num">${t.participants}</b>candidats</div></div>
    ${barre('Réponses justes', t.justes, 'var(--vert-texte)')}${barre('Erreurs', t.erreurs, 'var(--rouge-texte)')}${barre('Sans réponse', t.sans_reponse, 'var(--ambre-texte)')}`;
}
function majDiscussionDom(){
  if(S.ecran !== 'discussion') return;
  const fil = document.getElementById('disc-fil'); if(!fil) return;
  const zone = vue();
  const bas = (zone.scrollTop + zone.clientHeight) >= zone.scrollHeight - 160;
  fil.innerHTML = lignesDiscussion();
  const e = document.getElementById('disc-ecrit'); if(e) e.innerHTML = texteEcrivent();
  const n = document.getElementById('disc-total'); if(n) n.textContent = (S.disc && S.disc.total ? S.disc.total : 0) + ' message' + (S.disc && S.disc.total > 1 ? 's' : '');
  const g = document.getElementById('disc-stats'); if(g) g.innerHTML = blocStatsGroupe();
  if(bas) zone.scrollTo({ top: zone.scrollHeight, behavior:'smooth' });
}
function ecranDiscussion(){
  const id = S.discId, c = S.classementEp;
  const tete = `<button class="retourhaut" data-gagnants="${E(id || '')}">Retour aux résultats</button>`;
  if(!id){ vue().innerHTML = `<div class="pad">${tete}<p class="sous" style="margin-top:16px">Ouvrez la discussion depuis les résultats de la composition.</p></div>`; return; }
  const lectureSeule = !!(S.disc && S.disc.id === id && S.disc.ok && S.disc.peut_ecrire === false);
  const podium = c && c.id === id && c.classement ? c.classement.filter(l => l.rang <= 3).slice(0, 3) : [];
  const fel = podium.length ? `<div class="felicitations" style="margin-top:12px"><div class="eyebrow" style="color:var(--or)">Félicitations aux admis</div>
    <p>Bravo à ${podium.map(l => '<b>' + E(l.nom) + '</b> (' + l.score + '/' + l.sur + ')').join(', ')}.${c.admis ? ' ' + c.admis + ' candidat' + (c.admis > 1 ? 's sont admis' : ' est admis') + '.' : ''}</p></div>` : '';
  vue().innerHTML = `<div class="pad disc-page">
    ${tete}
    <div class="eyebrow" style="margin-top:8px">Composition nationale (simulation)</div>
    <h1 class="titre">Discussion · ${E(c && c.id === id ? (c.concours || c.titre || '') : '')}</h1>
    ${fel}
    <div id="disc-stats">${blocStatsGroupe()}</div>
    <div class="libelle" style="margin-top:18px">Discussion<span class="num" id="disc-total">${S.disc && S.disc.total ? S.disc.total + ' message' + (S.disc.total > 1 ? 's' : '') : ''}</span></div>
    <div id="disc-fil" class="disc-fil">${lignesDiscussion()}</div>
    <div id="disc-ecrit" class="disc-ecrit">${texteEcrivent()}</div>
    ${lectureSeule ? `<div class="disc-invite"><b>Pour écrire, il faut être inscrit à la composition.</b>
      <span>Vous pouvez lire toute la discussion. Pour participer à la prochaine, inscrivez-vous.</span>
      ${S.epreuve && S.epreuve.etat === 'a_venir' ? `<button class="cta" data-inscrire-nat="${E(S.epreuve.id)}">M'inscrire à la prochaine composition</button>` : ''}</div>` : `<form class="disc-saisie" id="disc-form" autocomplete="off">
      <input id="disc-champ" type="text" maxlength="500" placeholder="Écrire un message…" value="${E(S.discBrouillon || '')}" enterkeyhint="send">
      <button type="submit" class="disc-envoi" aria-label="Envoyer">➤</button>
    </form>`}
  </div>`;
  const champ = document.getElementById('disc-champ'), form = document.getElementById('disc-form');
  if(!champ || !form) return;
  let dernierSignal = 0;
  champ.addEventListener('input', () => {
    S.discBrouillon = champ.value;
    const t = Date.now();
    if(champ.value.trim() && t - dernierSignal > 5000 && base){ dernierSignal = t; base.rpc('discussion_ecrit', { p_epreuve: id }).then(() => {}, () => {}); }
  });
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    const texte = champ.value.trim(); if(!texte || !base) return;
    const bouton = form.querySelector('button'); bouton.disabled = true;
    try{
      const { data } = await base.rpc('discussion_envoyer', { p_epreuve: id, p_texte: texte });
      if(data && data.ok){ champ.value = ''; S.discBrouillon = ''; pister('DISCUSSION_MESSAGE'); await chargerDiscussion(id, false); vue().scrollTo({ top: vue().scrollHeight, behavior:'smooth' }); }
      else toast((data && data.message) || 'Message non envoyé.');
    }catch(e){ toast('Message non envoyé : vérifiez votre connexion.'); }
    bouton.disabled = false;
  });
}
document.addEventListener('click', async ev => {
  const b = ev.target.closest('[data-discussion],[data-disc-aimer],[data-disc-suppr]'); if(!b) return;
  if(b.dataset.discussion){ ev.preventDefault(); return ouvrirDiscussion(b.dataset.discussion); }
  if(b.dataset.discAimer && S.disc && S.disc.messages){
    const m = S.disc.messages.find(x => x.id === b.dataset.discAimer); if(!m) return;
    m.aime = !m.aime; m.coeurs = Math.max(0, (m.coeurs || 0) + (m.aime ? 1 : -1)); majDiscussionDom();
    try{
      const { data } = await base.rpc('discussion_aimer', { p_message: m.id });
      if(data && data.ok){ m.aime = data.aime; m.coeurs = data.coeurs; majDiscussionDom(); }
    }catch(e){}
    return;
  }
  if(b.dataset.discSuppr && S.disc && S.disc.messages){
    if(!confirm('Supprimer ce message ?')) return;
    const id = b.dataset.discSuppr;
    S.disc.messages = S.disc.messages.filter(x => x.id !== id); S.disc.total = Math.max(0, (S.disc.total || 1) - 1); majDiscussionDom();
    try{ await base.rpc('discussion_supprimer', { p_message: id }); }catch(e){ toast('Suppression non enregistrée.'); }
  }
});
setInterval(() => { if(S.ecran === 'discussion' && S.discId && !document.hidden && S.modal !== 'x') chargerDiscussion(S.discId, false); }, 10000);

function ecranGagnants(){
  const c = S.classementEp;
  const tete = `<button class="retourhaut" data-go="aujourdhui">Retour</button>`;
  if(!c || !c.charge){ vue().innerHTML = `<div class="pad">${tete}<div class="squelette large" style="margin-top:16px"></div><div class="squelette"></div></div>`; return; }
  if(!c.ok){ vue().innerHTML = `<div class="pad">${tete}<h1 class="titre">Résultats indisponibles</h1><p class="sous">${E(c.message || 'Vérifiez votre connexion.')}</p></div>`; return; }
  if(!c.termine){
    vue().innerHTML = `<div class="pad">${tete}
      <div class="eyebrow">Composition nationale <small class="sim">(simulation)</small></div>
      <h1 class="titre">Résultats à ${heureH(c.fin_le)}</h1>
      ${rebours(c.fin_le)}
      <p class="sous" style="margin-top:8px"><span class="num">${c.participants}</span> candidat${c.participants>1?'s':''} en salle. Le classement, la liste des admis et le corrigé sont publiés à la fin de l'épreuve, pour que personne ne puisse souffler les réponses.</p>
      <button class="cta creux" style="margin-top:14px" data-gagnants="${E(c.id)}">Actualiser</button></div>`;
    return;
  }
  const liste = c.classement || [];
  const admis = liste.filter(l => l.statut === 'admis'), attente = liste.filter(l => l.statut === 'attente');
  const podium = liste.filter(l => l.rang <= 3).slice(0, 3);
  const dernierAdmis = admis.length ? admis[admis.length - 1] : null;
  const m = c.moi;
  const r = n => n + '<sup>' + (n === 1 ? 'er' : 'e') + '</sup>';
  let statut = '';
  if(m){
    const manque = dernierAdmis && m.statut !== 'admis' ? dernierAdmis.score - m.score : 0;
    statut = `<div class="statut-nat sn-${m.statut}">
      <div class="sn-tampon">${STATUTS[m.statut]}</div>
      <button class="mini-partage" data-carte-resultat="nationale" aria-label="Partager mon résultat">${ico('partage',14)}<span>Partager</span></button>
      <p class="sn-titre">${m.statut === 'admis' ? (m.rang <= 3 ? 'Félicitations, vous êtes sur le podium !' : 'Félicitations, vous êtes admis !')
        : m.statut === 'attente' ? 'Vous êtes sur la liste d\'attente.' : 'Vous n\'êtes pas admis cette fois.'}</p>
      <p>Votre rang : <b class="num">${r(m.rang)}</b> sur ${c.participants} · note <b class="num">${m.score}/${m.sur}</b></p>
      ${m.statut !== 'admis' && dernierAdmis ? `<p style="margin-top:4px">Le dernier admis avait <b class="num">${dernierAdmis.score}/${dernierAdmis.sur}</b>${manque > 0 ? ` : il vous a manqué ${manque} point${manque>1?'s':''}` : ''}.${prochaineNat() ? ' Prochaine composition : ' + E(prochaineNat()) + '.' : ' Rendez-vous à la prochaine composition nationale.'}</p>` : ''}
    </div>`;
  }
  const insc = S.epreuve && S.epreuve.id === c.id && S.epreuve.inscrit;
  if(!m && insc){
    statut = `<div class="statut-nat sn-absent">
      <div class="sn-tampon">Absent</div>
      <p class="sn-titre">La composition s'est terminée sans vous.</p>
      <p>Vous étiez inscrit, mais vous n'avez pas composé. Voici le classement : regardez les notes des admis pour savoir où viser. ${prochaineNat() ? 'Prochaine composition : ' + E(prochaineNat()) + '.' : 'Rendez-vous à la prochaine composition nationale.'}</p>
    </div>`;
  }
  const maCompo = S.epreuve && S.epreuve.id === c.id && S.epreuve.moi && S.epreuve.moi.composition;
  const ligne = l => `<div class="ligne-rang${l.moi ? ' moi' : ''}">
      <span class="p num">${l.rang}</span>
      <span class="n">${E(l.nom)}${l.moi ? ' (vous)' : ''}<em>${mmssLong(l.duree)}</em></span>
      <span class="s num">${l.score}/${l.sur}</span>
    </div>`;
  vue().innerHTML = `
  <div class="pad">
    ${tete}
    <div class="eyebrow">Composition nationale <small class="sim">(simulation)</small> · ${E(jourFr(c.debut_le))}</div>
    <h1 class="titre">Résultats · ${E(c.concours || c.titre)}</h1>
    <p class="sous" style="margin-top:6px"><span class="num">${c.participants}</span> candidat${c.participants>1?'s':''} · ${c.places} postes à pourvoir · moyenne <span class="num">${c.moyenne ?? '—'}/${c.sur}</span></p>
    ${statut}
    <div class="trio" style="margin-top:14px">
      <div><b class="num">${c.admis}</b><span>admis</span></div>
      <div><b class="num">${c.attente}</b><span>liste d'attente</span></div>
      <div><b class="num">${c.echoues}</b><span>non admis</span></div>
    </div>
    ${podium.length ? `<div class="felicitations">
      <div class="eyebrow" style="color:var(--or)">Félicitations</div>
      <p>Bravo à <b>${E(podium[0].nom)}</b>, major de la composition avec <b class="num">${podium[0].score}/${podium[0].sur}</b>${c.recompense ? `. ${E(c.recompense)} lui revient` : ''}.${podium.length > 1 ? ' Bravo aussi à ' + podium.slice(1).map(l => '<b>' + E(l.nom) + '</b> (' + l.rang + 'e)').join(' et ') + '.' : ''}</p>
      ${c.message ? `<p style="margin-top:8px">${E(c.message)}</p>` : ''}
    </div>
    <div class="podium">
      ${podium.map(l => `<div class="marche r${l.rang}${l.moi ? ' moi' : ''}">
        <div class="medaille">${l.rang}</div>
        <div class="av">${E(initialesPseudo(l.nom))}</div>
        <b>${E(l.nom)}${l.moi ? ' (vous)' : ''}</b>
        <div class="note num">${l.score}<small>/${l.sur}</small></div>
        <div class="duree">${mmssLong(l.duree)}</div>
        ${boutonsReactions(l)}
      </div>`).join('')}
    </div>` : '<div class="carte" style="margin-top:14px"><p class="sous">Aucune copie remise pour cette composition.</p></div>'}

    <div class="actions-res">
      <button class="cta" data-corr-nat="${E(c.id)}">${ico('lire',16)} Voir la correction</button>
      <button class="cta creux" data-resultats-pdf="1">${ico('telecharger',16)} Télécharger la correction en PDF</button>
    </div>
    ${S.util.connecte ? blocDiscussionApercu(c.id) : ''}
    ${!m && S.epreuve && S.epreuve.id !== c.id && S.epreuve.etat === 'a_venir' && !S.epreuve.inscrit ? `<div class="carte" style="margin-top:12px;text-align:left"><p class="sous" style="margin:0 0 10px">Prochaine composition nationale : ${E(dateLongue(S.epreuve.debut_le))} à ${heureH(S.epreuve.debut_le)}. Venez composer et voir votre nom dans ce classement.</p>
      <button class="cta" data-inscrire-nat="${E(S.epreuve.id)}">M'inscrire à la composition</button></div>` : ''}
    ${m && peutProposer(4) ? `<div class="carte" style="margin-top:12px;text-align:left"><p class="sous" style="margin:0 0 10px">${m.rang ? 'Vous êtes ' + r(Number(m.rang)) + ' sur ' + E(c.participants) + '. ' : ''}Pour monter à la prochaine nationale, entraînez-vous sans limite :</p>
      ${offreDeuxPrix()}</div>` : ''}

    ${admis.length ? `<div class="bloc"><div class="libelle">Liste des admis<span class="num">${admis.length}</span></div><div class="carte">${admis.map(ligne).join('')}</div></div>` : ''}
    ${attente.length ? `<div class="bloc"><div class="libelle">Liste d'attente<span class="num">${attente.length}</span></div><div class="carte">${attente.map(ligne).join('')}</div></div>` : ''}
    ${c.echoues ? `<p class="sous" style="margin-top:12px">${c.echoues} candidat${c.echoues>1?'s ne sont pas admis':' n\'est pas admis'} cette semaine. Leurs noms ne sont pas publiés.</p>` : ''}
    <p class="sous" style="margin-top:14px;font-size:12px">Classement par ordre de mérite. À note égale, le candidat le plus rapide passe devant. Un candidat qui a refusé l'affichage de son nom apparaît comme « Candidat anonyme ».</p>
  </div>`;
}
function resultatsPdf(){
  const c = S.classementEp;
  if(!c || !c.termine){ toast('Les résultats ne sont pas encore publiés.'); return; }
  return sortirDocument('Correction composition nationale ' + (c.concours || ''), async () => {
    /* le corrigé complet : déjà chargé, sinon on va le chercher */
    let corr = S.corrNat && S.corrNat.id === c.id && S.corrNat.ok && S.corrNat.publie ? S.corrNat : null;
    if(!corr && base){
      try{
        const { data } = await base.rpc('correction_epreuve', { p_epreuve: c.id });
        if(data && data.ok && data.publie) corr = { ...data, id:c.id, charge:true };
      }catch(e){}
    }
    const qs = corr ? (corr.questions || []) : [];
    const liste = c.classement || [];
    const admis = liste.filter(l => l.statut === 'admis'), attente = liste.filter(l => l.statut === 'attente');
    const podium = liste.filter(l => l.rang <= 3).slice(0, 3);
    const quand = new Date(c.debut_le).toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
    const quandCourt = new Date().toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' });
    const L = 'ABCDEFGH';
    const syn = syntheseCorrNat(corr, c);
    const grilleHtml = qs.map((q, i) => '<div class="ligne"><span class="no">' + (i+1) + '</span>' +
      (q.options || []).map((_, k) => '<span class="b' + ((q.bonnes || []).includes(k) ? ' juste' : '') + '">' + (L[k] || '•') + '</span>').join('') + '</div>').join('');
    const sujetHtml = qs.map((q, i) => {
      const bonnes = q.bonnes || [];
      return '<div class="q"><div class="qt"><b>' + (i+1) + '.</b> ' + E(q.enonce) +
        (q.matiere ? ' <span class="etat blanche">' + E(q.matiere) + '</span>' : '') + '</div><ol type="a">' +
        (q.options || []).map((o, k) => '<li class="' + (bonnes.includes(k) ? 'bonne' : '') + '">' + E(o) + (bonnes.includes(k) ? ' ✓' : '') + '</li>').join('') + '</ol>' +
        (typeof q.reussite === 'number' ? '<div style="font:11px Helvetica,Arial,sans-serif;color:#555;margin:3px 0 0 22px">' + q.reussite + ' % des candidats ont trouvé</div>' : '') +
        (q.explication ? '<div style="font-size:11.5px;margin:4px 0 0 22px;padding:5px 8px;border-left:3px solid #0E7A54;background:#F3F7F5"><b>Pourquoi ?</b> ' + E(q.explication) + '</div>' : '') + '</div>';
    }).join('');
    const tableau = l => '<table class="mats"><thead><tr><td><b>Rang</b></td><td><b>Nom</b></td><td class="n">Note</td><td class="n">Temps</td></tr></thead><tbody>' +
      l.map(x => '<tr><td style="width:60px">' + x.rang + (x.rang === 1 ? 'er' : 'e') + '</td><td>' + E(x.nom) + '</td><td class="n">' + x.score + ' / ' + x.sur + '</td><td class="n">' + mmssLong(x.duree) + '</td></tr>').join('') + '</tbody></table>';
    const html = '<!doctype html><html lang="fr"><head><meta charset="utf-8">' +
'<title>Correction — ' + E(c.concours || c.titre || 'Composition nationale') + '</title>' +
'<style>' + CSS_FEUILLE + '</style></head><body>' +
'<div class="filigrane" aria-hidden="true"><i></i><i></i><i></i><i></i><b>MON CONCOURS</b></div>' +
'<div class="tete"><div class="sceau"><i></i><i></i><i></i><i></i></div>' +
  '<div class="marque"><div class="n">MON CONCOURS</div><div class="d">Préparation aux concours directs du Burkina Faso</div></div>' +
  '<div class="site"><div><div class="adr">monconcoursbf.com</div><div class="sc">Scannez pour rejoindre la prochaine composition</div></div>' + QR_FEUILLE + '</div></div>' +
'<h1>Correction générale</h1>' +
'<div class="ident">' +
  '<div><b>Épreuve</b><span>Composition nationale · ' + E(c.concours || c.titre || '') + '</span></div>' +
  '<div><b>Date</b><span>' + E(quand) + '</span></div>' +
  '<div><b>Candidats</b><span>' + c.participants + '</span></div>' +
  '<div><b>Postes</b><span>' + c.places + '</span></div>' +
'</div>' +
'<div class="resultat">' +
  '<div class="note"><div class="n">' + (c.moyenne ?? '—') + ' / ' + c.sur + '</div><div class="l">Moyenne</div></div>' +
  '<table class="rec">' +
    '<tr><td>Admis</td><td>' + c.admis + '</td></tr>' +
    '<tr><td>Liste d\'attente</td><td>' + c.attente + '</td></tr>' +
    '<tr><td>Non admis</td><td>' + c.echoues + '</td></tr>' +
    (qs.length ? '<tr><td>Questions</td><td>' + qs.length + '</td></tr>' : '') +
  '</table>' +
'</div>' +
(qs.length ?
'<h1>Feuille de réponses</h1>' +
'<div class="grille">' + grilleHtml + '</div>' +
'<div class="legende"><span><i style="background:#0E7A54"></i> Réponse attendue</span><span><i style="border:1px solid #ccc"></i> Réponse non retenue</span></div>' +
'<h1>Le sujet corrigé</h1>' + sujetHtml +
(syn.mats.length ? '<div class="bloc-fin"><h1>Résultats par matière</h1><table class="mats">' +
  syn.mats.map(x => '<tr><td>' + E(x.nom) + '</td><td class="n">' + x.n + ' question' + (x.n > 1 ? 's' : '') + '</td><td class="n">' + (x.pct === null ? '—' : x.pct + ' %') + '</td></tr>').join('') + '</table></div>' : '') +
'<div class="bloc-fin"><h1>Recommandations</h1><ol class="recos">' + syn.recos.map(r => '<li>' + E(r) + '</li>').join('') + '</ol></div>'
: '<p class="note-bas" style="margin-top:14px;font-size:12px;color:#444">Le corrigé détaillé n\'est pas disponible pour le moment.</p>') +
(podium.length ? '<h1>Félicitations</h1><p style="font-size:13px;margin:6px 0">Mon Concours félicite les trois premiers : ' +
  podium.map(l => '<b>' + E(l.nom) + '</b> (' + (l.rang === 1 ? 'major' : l.rang + 'e') + ', ' + l.score + ' / ' + l.sur + ')').join(', ') + '.' +
  (c.recompense ? ' Récompense du major : ' + E(c.recompense) + '.' : '') + '</p>' : '') +
(admis.length ? '<div class="bloc-fin"><h1>Liste des admis par ordre de mérite</h1>' + tableau(admis) + '</div>' : '') +
(attente.length ? '<div class="bloc-fin"><h1>Liste d\'attente</h1>' + tableau(attente) + '</div>' : '') +
'<p style="font-size:11.5px;color:#444;margin-top:12px">' + (c.echoues ? 'Non admis : ' + c.echoues + ' candidat' + (c.echoues > 1 ? 's' : '') + '. Leurs noms ne sont pas publiés. ' : '') +
  'À note égale, le candidat le plus rapide est classé devant. Composition d\'entraînement (simulation) organisée par Mon Concours ; elle ne remplace pas les résultats officiels des concours de la fonction publique.</p>' +
'<div class="pied"><span><b>monconcoursbf.com</b> · WhatsApp <b>' + telAffiche() + '</b></span><span>Document remis le ' + quandCourt + '</span></div>' +
'<div class="noimp"><button onclick="window.print()">Enregistrer en PDF ou imprimer</button></div>' +
'<scr' + 'ipt>setTimeout(function(){window.print();},600);<\/scr' + 'ipt></body></html>';
    return html;
  });
}
async function reagir(val){
  if(!S.util.connecte){ S.modal = 'connexion'; S.erreur = ''; return surcouche(); }
  const [id, type] = val.split('|');
  const c = S.classementEp; if(!c || !c.classement) return;
  const l = c.classement.find(x => x.composition === id); if(!l) return;
  /* affichage immédiat, le serveur confirme */
  l.reactions = l.reactions || {}; l.mes_reactions = l.mes_reactions || [];
  const avait = l.mes_reactions.includes(type);
  l.mes_reactions = avait ? l.mes_reactions.filter(x => x !== type) : l.mes_reactions.concat(type);
  l.reactions[type] = Math.max(0, (l.reactions[type] || 0) + (avait ? -1 : 1));
  rendre();
  try{
    const { data } = await base.rpc('reagir_epreuve', { p_composition: id, p_type: type });
    if(!data || !data.ok){ if(data && data.message) toast(data.message); chargerClassement(c.id); }
  }catch(e){ chargerClassement(c.id); }
}

/* ---------- signaler une erreur dans une question ---------- */
const MOTIFS = [['reponse_fausse','La bonne réponse est fausse'],['enonce_errone','L\'énoncé est faux ou incomplet'],
  ['perime','L\'information n\'est plus à jour'],['faute','Faute d\'orthographe ou de frappe'],['autre','Autre chose']];
function ouvrirSignalement(id){
  if(!S.util.connecte){ S.modal = 'connexion'; S.erreur = ''; return surcouche(); }
  S.signal = { id, motif:null };
  S.modal = 'signal';
  const v = document.getElementById('voile'); v.hidden = false;
  v.innerHTML = `
  <div class="panneau" role="dialog" aria-modal="true" aria-label="Signaler une erreur">
    <div class="poignee"></div>
    <h3>Signaler une erreur</h3>
    <p class="intro">Merci. L'équipe vérifie chaque signalement et corrige la question si besoin.</p>
    <div class="motifs">${MOTIFS.map(([k, t]) => `<label class="motif"><input type="radio" name="motif" value="${k}"> <span>${t}</span></label>`).join('')}</div>
    <div class="champ" style="margin-top:12px"><label for="sig-com">Précision (facultatif)</label>
      <textarea id="sig-com" maxlength="500" rows="3" placeholder="Ex. : la bonne réponse est C, d'après la Constitution de 1991."></textarea></div>
    <button class="cta" data-signal-envoi="1">Envoyer le signalement</button>
    <button class="cta creux" style="margin-top:9px" data-fermer-partage="1">Annuler</button>
  </div>`;
}
async function envoyerSignalement(){
  const choix = document.querySelector('input[name="motif"]:checked');
  if(!choix){ toast('Choisis ce qui ne va pas.'); return; }
  const com = (document.getElementById('sig-com') || {}).value || '';
  try{
    const { data } = await base.rpc('signaler_question', { p_question: S.signal.id, p_motif: choix.value, p_commentaire: com });
    document.getElementById('voile').hidden = true; S.modal = null;
    toast(data && data.ok ? (data.deja ? 'Déjà signalée : merci, elle est en cours de vérification.' : 'Signalement envoyé. Merci !') : ((data && data.message) || 'Envoi impossible.'));
    pister('QUESTION_REPORTED', { motif: choix.value });
  }catch(e){ toast('Envoi impossible. Vérifie ta connexion.'); }
}

/* ---------- « Donnez votre avis » : après environ trente minutes d'utilisation ---------- */
const AVIS_SEUIL = 30 * 60;        /* secondes d'utilisation cumulées */
const AVIS_PAUSE_JOURS = 21;       /* fermé sans envoyer : pas de nouvelle demande avant trois semaines */
function etatAvis(){
  /* gardé sur le téléphone, par personne (trois derniers chiffres seulement : on ne garde pas le numéro) */
  const pour = String(S.util.tel || '').slice(-3);
  const a = lireReglages().avis;
  return (a && a.pour === pour) ? a : { pour: pour, s: 0, vu: 0, envoye: false };
}
function suiviAvis(){
  if(document.visibilityState !== 'visible' || !S.util.connecte || !base) return;
  const a = etatAvis();
  if(a.envoye) return;
  /* seul le temps où la personne agit compte : un téléphone posé sur une table ne compte pas */
  if(Date.now() - O.dernierTemps < 60000){ a.s = (a.s || 0) + 15; ecrireReglage('avis', a); }
  const carte = document.querySelector('.avis-carte');
  const enEpreuve = enComposition() || SANS_TETE.includes(S.ecran);
  if(enEpreuve){ if(carte) carte.remove(); return; }
  if(carte || S.modal) return;
  if(a.s >= AVIS_SEUIL && Date.now() - (a.vu || 0) > AVIS_PAUSE_JOURS * 86400000) proposerAvis(a);
}
setInterval(suiviAvis, 15000);
function proposerAvis(a){
  a.vu = Date.now(); ecrireReglage('avis', a);
  const c = document.createElement('div');
  c.className = 'avis-carte';
  c.setAttribute('role', 'dialog');
  c.setAttribute('aria-label', 'Donnez votre avis');
  c.innerHTML = `<div class="avis-tete"><i class="avis-poignee"></i><b>Votre avis nous aide à progresser</b>
    <span>Que pensez-vous du site ou des recommandations ? Quelques mots suffisent.</span></div>
    <textarea id="avis-texte" maxlength="1000" rows="3" aria-label="Votre avis" placeholder="Ce qui vous plaît, ce qui manque, ce qui ne va pas…"></textarea>
    <button class="cta" data-avis-envoi="1">Envoyer mon avis</button>
    <small class="avis-aide">Pas maintenant ? Faites glisser cette fenêtre pour la fermer.</small>`;
  c.querySelector('[data-avis-envoi]').onclick = () => envoyerAvis(c);
  /* le clavier du téléphone couvre le bas de l'écran : pendant la saisie, la fenêtre passe en haut */
  c.querySelector('#avis-texte').addEventListener('focus', () => c.classList.add('saisie'));
  c.addEventListener('keydown', e => { if(e.key === 'Escape') c.remove(); });
  glisserPourEcarter(c, {
    sens: 1,
    zone: '.avis-tete, .avis-aide',
    ignore: 'textarea, button',
    pose: (dx, dy) => `translate(calc(-50% + ${dx}px), ${dy}px)`
  });
  document.body.appendChild(c);
  setTimeout(() => c.classList.add('vu'), 30);
  pister('FEEDBACK_PROMPT_SHOWN');
}
async function envoyerAvis(c){
  const champ = c.querySelector('#avis-texte');
  const texte = ((champ && champ.value) || '').trim();
  if(texte.length < 3){ toast('Écrivez quelques mots avant d\'envoyer.'); if(champ) champ.focus(); return; }
  const bouton = c.querySelector('[data-avis-envoi]'); if(bouton) bouton.disabled = true;
  try{
    const { data } = await base.rpc('envoyer_avis', { p_message: texte });
    if(data && data.ok){
      const a = etatAvis(); a.envoye = true; ecrireReglage('avis', a);
      c.remove(); toast('Merci ! Votre avis est bien arrivé.');
      pister('FEEDBACK_SENT');
    } else {
      if(bouton) bouton.disabled = false;
      toast((data && data.message) || 'Envoi impossible pour le moment.');
    }
  }catch(e){ if(bouton) bouton.disabled = false; toast('Envoi impossible. Vérifiez votre connexion.'); }
}

/* ---------- quitter une épreuve ---------- */
function demanderQuitter(){
  S.modal = 'quitter';
  const v = document.getElementById('voile'); v.hidden = false;
  const nb = Object.keys(S.reponses || {}).length;
  v.innerHTML = `
  <div class="panneau" role="alertdialog" aria-modal="true" aria-labelledby="q-titre">
    <div class="poignee"></div>
    <h3 id="q-titre">Quitter l'épreuve ?</h3>
    <p class="intro">${nb ? `Vos ${nb} réponse${nb>1?'s sont gardées':' est gardée'}. ` : ''}Le chronomètre continue : vous pouvez reprendre depuis l'accueil tant qu'il reste du temps. La copie n'est corrigée que lorsque vous touchez « Remettre la copie ».</p>
    <div class="duo">
      <button class="cta creux" data-quitter-non="1">Rester</button>
      <button class="cta" data-quitter-oui="1">Quitter</button>
    </div>
  </div>`;
  setTimeout(() => { const b = document.querySelector('[data-quitter-non]'); if(b) b.focus(); }, 30);
}

/* ---------- rappels sur le téléphone ---------- */
const pushPossible = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
function cleVapid(b64){
  const p = '='.repeat((4 - b64.length % 4) % 4);
  const s = atob((b64 + p).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...s].map(c => c.charCodeAt(0)));
}
async function chargerRappel(){
  if(!base || !S.util.connecte) return;
  try{ const { data } = await base.rpc('mon_rappel'); S.rappel = data || null; S.rappelCharge = true; memoEcrire('rappel', S.rappel, true); rafraichirSiVisible(); }catch(e){}
}
/* dans combien de temps sonne le prochain rappel ? */
function delaiRappel(h, m){
  const maintenant = new Date(), cible = new Date();
  cible.setHours(h, m, 0, 0);
  if(cible <= maintenant) cible.setDate(cible.getDate() + 1);
  const min = Math.round((cible - maintenant) / 60000);
  const hh = Math.floor(min / 60), mm = min % 60;
  return hh ? hh + ' h' + (mm ? ' ' + String(mm).padStart(2, '0') + ' min' : '') : Math.max(1, mm) + ' min';
}
const hm = (h, m) => h + ' h ' + String(m).padStart(2, '0');
async function activerRappel(heure, minute){
  heure = +heure; minute = +minute || 0;
  if(!S.util.connecte){ S.modal = 'inscription'; S.erreur = ''; return surcouche(); }
  if(!pushPossible()){ pister('REMINDER_UNAVAILABLE'); fenetreRappel('impossible'); return; }
  try{
    const perm = await Notification.requestPermission();
    if(perm !== 'granted'){
      ecrireReglage('rappelRefus', Date.now()); pister('REMINDER_PERMISSION_DENIED');
      fenetreRappel('refuse'); return;
    }
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if(!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey: cleVapid(VAPID_PUBLIC) });
    const j = sub.toJSON();
    /* l'heure choisie est celle du téléphone ; le serveur compte en heure de Ouagadougou (UTC) */
    const d = new Date(); d.setHours(heure, minute, 0, 0);
    const { data } = await base.rpc('enregistrer_rappel_freq', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth,
      p_heure: d.getUTCHours(), p_minute: d.getUTCMinutes(), p_frequence: 'quotidien' });
    if(!data || !data.ok) throw new Error('refus');
    S.rappel = { heure: d.getUTCHours(), minute: d.getUTCMinutes(), actif:true, frequence:'quotidien' };
    signalCandidat('Notifications activées : la première arrive dans ' + delaiRappel(heure, minute) + ', à ' + hm(heure, minute) + ', puis chaque jour à la même heure.');
    pister('REMINDER_ENABLED', { heure, minute });
    rendre();
  }catch(e){ toast('Le rappel n\'a pas pu être activé. Réessayez avec une meilleure connexion.'); }
}
/* « Oui, j'active les notifications » : on active, rien d'autre. Pas de rappel quotidien automatique, c'est l'équipe qui envoie. */
async function activerNotifsSeules(){
  if(!S.util.connecte){ S.modal = 'inscription'; S.erreur = ''; return surcouche(); }
  if(!pushPossible()){ pister('REMINDER_UNAVAILABLE'); fenetreRappel('impossible'); return; }
  try{
    const perm = await Notification.requestPermission();
    if(perm !== 'granted'){ ecrireReglage('rappelRefus', Date.now()); pister('REMINDER_PERMISSION_DENIED'); fenetreRappel('refuse'); return; }
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if(!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey: cleVapid(VAPID_PUBLIC) });
    const j = sub.toJSON();
    const { data } = await base.rpc('activer_notifs_seules', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth });
    if(!data || !data.ok) throw new Error('refus');
    S.rappel = { heure:18, minute:0, actif:true, frequence:'quotidien' };
    signalCandidat('Notifications activées.');
    pister('REMINDER_ENABLED', { seules:true });
    rendre();
  }catch(e){ toast('Les notifications n\'ont pas pu être activées. Réessayez avec une meilleure connexion.'); }
}
async function retirerRappel(){
  try{
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if(sub){ await base.rpc('retirer_rappel', { p_endpoint: sub.endpoint }); await sub.unsubscribe(); }
  }catch(e){}
  S.rappel = null; toast('Notifications désactivées.'); pister('REMINDER_DISABLED'); rendre();
}
function blocRappels(){
  if(!S.util.connecte) return '';
  const r = S.rappel;
  let h = 19, m = 0;
  if(r){ const d = new Date(); d.setUTCHours(r.heure, r.minute || 0, 0, 0); h = d.getHours(); m = d.getMinutes(); }
  return `<div class="carte rappel-c" style="margin-top:14px">
    <div class="libelle" style="margin-bottom:8px"><span>${ico('cloche',14)} Mes notifications</span><button class="inter${r ? ' on' : ''}" role="switch" aria-checked="${r ? 'true' : 'false'}" aria-label="Notifications" data-rappel-inter="1"><i></i></button></div>
    <p class="sous" style="margin:0 0 10px;font-size:12.5px">${r ? 'Activées : vous recevez les informations importantes de Mon Concours.' : 'Recevez les nouveautés de Mon Concours : votre progression, vos erreurs, l\'actualité du concours.'}</p>
    <details class="rappel-reglage"${r ? '' : ' hidden'}><summary>Heure du rappel du jour : ${hm(h, m)}</summary>
    <div class="rappel-heure">
      <label class="sr" for="rappel-h">Heure</label>
      <select id="rappel-h">${Array.from({ length:24 }, (_, i) => `<option value="${i}" ${i === h ? 'selected' : ''}>${i} h</option>`).join('')}</select>
      <label class="sr" for="rappel-m">Minutes</label>
      <select id="rappel-m">${Array.from({ length:60 }, (_, i) => `<option value="${i}" ${i === m ? 'selected' : ''}>${String(i).padStart(2, '0')}</option>`).join('')}</select>
      <button class="mini" data-rappel-heure="1">Valider</button>
    </div></details>
    ${r ? '<button class="lien" style="margin-top:8px;padding:0" data-rappel-retirer="1">Arrêter les notifications</button>' : ''}
    ${!r && ['refuse', 'impossible'].includes(etatRappel()) ? `<p class="sous rappel-wa" style="margin:10px 0 0;font-size:12.5px">${etatRappel() === 'refuse' ? 'Les notifications sont bloquées sur ce téléphone.' : 'Ce téléphone ne permet pas les rappels.'} Recevez les annonces et les rendez-vous de composition sur WhatsApp : <a href="${E(CONTACT.canal)}" target="_blank" rel="noopener" data-rappel-wa="1">rejoindre la communauté</a>.</p>` : ''}
  </div>`;
}

/* ---------- proposer le rappel au bon moment : après un succès, jamais au premier lancement ---------- */
function etatRappel(){
  if(!S.util.connecte) return 'non';
  if(S.rappel) return 'actif';
  if(!pushPossible()) return 'impossible';
  if(Notification.permission === 'denied') return 'refuse';
  return 'possible';
}
/* Le bandeau de l'accueil : discret, masquable sept jours */
function blocBandeauRappel(){
  if(S.gratuit && !S.util.connecte) return '';
  /* on attend de savoir si le rappel est déjà actif : sinon le bandeau s'affiche puis disparaît une seconde après */
  if(!S.rappelCharge || etatRappel() !== 'possible') return '';
  const masque = lireReglages().bandeauRappel;
  if(masque && Date.now() - masque < 7 * 86400000) return '';
  return `<div class="bandeau-rappel" role="status">
    <span class="br-i">${ico('cloche', 18)}</span>
    <div class="br-t"><b>Restez informé</b><small>Votre progression, vos erreurs, l'actualité du concours.</small></div>
    <button class="mini" data-rappel-oui="1">Activer</button>
    <button class="br-x" data-rappel-masquer="1" aria-label="Masquer ce message">×</button>
  </div>`;
}
const MOTS_RAPPEL = {
  composition: ['Copie remise, bravo.', 'Revenir chaque jour fait gagner des points le jour du concours.'],
  paiement:    ['Votre abonnement est actif, bravo.', 'Revenir chaque jour, c\'est ce qui fait gagner des points le jour du concours.'],
  test:        ['Votre note est là, bravo.', 'Pour la faire monter, revenez chaque jour quelques minutes.'],
  bandeau:     ['Restez informé.', 'Revenir chaque jour fait gagner des points le jour du concours.']
};
function fenetreRappel(mode, motif){
  if(document.getElementById('mur-notifs')) return;
  const v = document.getElementById('voile'); if(!v) return;
  S.modal = 'rappel'; v.hidden = false;
  let corps;
  if(mode === 'possible'){
    const t = MOTS_RAPPEL[motif] || MOTS_RAPPEL.bandeau;
    corps = `<h3 id="pr-titre">${t[0]}</h3>
      <p class="intro">${t[1]} Restez informé de votre progression, de vos erreurs et de l'actualité du concours.</p>
      <button class="cta" data-rappel-oui="1">Oui, rester informé</button>
      <button class="lien" style="display:block;margin:12px auto 0" data-rappel-plus-tard="1">Plus tard</button>`;
  } else {
    corps = `<h3 id="pr-titre">${mode === 'refuse' ? 'Pas de notifications, pas de souci' : 'Les rappels ne marchent pas sur ce téléphone'}</h3>
      <p class="intro">${mode === 'refuse' ? 'Vous pourrez les autoriser plus tard dans les réglages du navigateur. ' : ''}En attendant, rejoignez la communauté WhatsApp : vous y recevez les annonces, les rendez-vous de composition et les conseils du jour.</p>
      <a class="cta" style="display:block;text-align:center;text-decoration:none" href="${E(CONTACT.canal)}" target="_blank" rel="noopener" data-rappel-wa="1">Rejoindre la communauté WhatsApp</a>
      <button class="lien" style="display:block;margin:12px auto 0" data-rappel-fermer="1">Fermer</button>`;
  }
  v.innerHTML = `<div class="panneau pop-nat" role="dialog" aria-modal="true" aria-labelledby="pr-titre">
    <button class="pn-x" data-rappel-fermer="1" aria-label="Fermer">×</button>${corps}</div>`;
  pister('REMINDER_PROMPT_SHOWN', { mode, motif: motif || null });
}
/* Lien à envoyer aux gens : monconcoursbf.com/?installer
   Le navigateur n'autorise l'installation qu'après un toucher : le panneau porte le bouton. */
function fenetreInstaller(){
  const v = document.getElementById('voile'); if(!v) return;
  S.modal = 'rappel'; v.hidden = false;
  const dejaLa = estInstallee();
  const notif = S.util.connecte && pushPossible() && !S.rappel;
  v.innerHTML = `<div class="panneau pop-nat" role="dialog" aria-modal="true" aria-labelledby="pr-titre">
    <button class="pn-x" data-rappel-fermer="1" aria-label="Fermer">×</button>
    <h3 id="pr-titre">${dejaLa ? 'Application déjà installée' : 'Installer Mon Concours'}</h3>
    <p class="intro">${dejaLa ? 'Elle est sur votre téléphone.' : 'Elle s\'ouvre comme une application, même avec peu de réseau.'}${notif ? ' Activez aussi les notifications pour ne rien manquer.' : ''}</p>
    ${dejaLa ? '' : '<button class="cta" data-installer-lien="1">Installer l\'application</button>'}
    ${notif ? '<button class="cta" style="margin-top:10px" data-notifs-lien="1">Activer les notifications</button>' : ''}
    <button class="lien" style="display:block;margin:12px auto 0" data-rappel-fermer="1">Fermer</button></div>`;
  pister('INSTALL_LINK_OPENED');
}
function fermerFenetreRappel(){ const v = document.getElementById('voile'); if(v) v.hidden = true; if(S.modal === 'rappel') S.modal = null; }
/* Un succès vient d'arriver : on le note, la fenêtre s'ouvre à un moment calme. */
function noterSucces(motif){
  if(!S.util.connecte || S.rappel) return;
  ecrireReglage('rappelApres', motif);
  setTimeout(() => proposerRappel(0), 9000);
}
function proposerRappel(essai){
  const r = lireReglages(), motif = r.rappelApres;
  if(!motif) return;
  const etat = etatRappel();
  if(etat === 'actif' || etat === 'non'){ if(etat === 'actif') ecrireReglage('rappelApres', null); return; }
  if(etat === 'impossible') return;                     /* rien à proposer ici : le bandeau et le compte portent le lien WhatsApp */
  const refus = r.rappelRefus || r.rappelPlusTard;
  if((r.rappelPropose || 0) >= 3 || (refus && Date.now() - refus < 14 * 86400000)){ ecrireReglage('rappelApres', null); return; }
  const v = document.getElementById('voile');
  if(S.ecran === 'compte' || S.modal || enComposition() || !v || !v.hidden || document.getElementById('invitation')){
    if(essai < 8) setTimeout(() => proposerRappel(essai + 1), 8000);
    return;
  }
  if(etat === 'refuse'){ ecrireReglage('rappelApres', null); if(r.rappelWaVu) return; ecrireReglage('rappelWaVu', true); return fenetreRappel('refuse', motif); }
  ecrireReglage('rappelApres', null); ecrireReglage('rappelPropose', (r.rappelPropose || 0) + 1);
  fenetreRappel('possible', motif);
}

/* ---------- mes compositions, dans le compte ---------- */
/* ---------- le plan de la semaine ---------- */
const lundiDeLaSemaine = () => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
const planActif = () => { const p = lireReglages().plan; return p && p.semaine === lundiDeLaSemaine() ? p : null; };
async function chargerPlan(){
  if(!base || !S.util.connecte || !planActif()) return;
  try{ const { data } = await base.rpc('mon_plan_semaine'); if(data && data.ok){ S.plan = data; if(S.ecran === 'compte') rendre(); } }catch(e){}
}
function blocPlanSemaine(){
  if(!S.util.connecte) return '';
  const p = planActif();
  if(!p){
    return `<div class="bloc"><div class="libelle">Ma semaine</div>
      <button class="grande" style="margin-top:0" data-plan-faire="1">
        <span class="ic">${ico('cible',19)}</span>
        <span><b>Faire un plan pour la semaine</b><span>3 compositions, 60 questions d'institutions, la fiche d'AES, et votre note dimanche</span></span>
        <span class="fl">→</span></button></div>`;
  }
  const d = S.plan || {};
  const compos = d.compositions || 0, inst = d.institutions || 0, fiche = (d.fiche || 0) > 0;
  const dimanche = new Date().getDay() === 0;
  const ligne = (fait, titre, etat, action) => `<div class="plan-l ${fait ? 'fait' : ''}">
    <span class="plan-c" aria-hidden="true">${fait ? '✓' : ''}</span>
    <span class="plan-t"><b>${titre}</b><em>${etat}</em></span>${fait ? '' : action}</div>`;
  return `<div class="bloc"><div class="libelle">Votre plan pour la semaine</div>
    <div class="carte">
      ${ligne(compos >= 3, '3 compositions', Math.min(compos, 3) + ' sur 3', `<button class="mini" data-go="grille">Composer</button>`)}
      ${ligne(inst >= 60, '60 questions d\'institutions', Math.min(inst, 60) + ' sur 60', `<button class="mini" data-cible="Institutions et AES">Réviser</button>`)}
      ${ligne(fiche, 'La fiche d\'AES', fiche ? 'lue cette semaine' : 'pas encore lue', `<button class="mini" data-matiere="${encodeURIComponent('Institutions et AES')}">Lire</button>`)}
      <div class="plan-l ${dimanche && d.note !== null && d.note !== undefined ? 'fait' : ''}">
        <span class="plan-c" aria-hidden="true">${dimanche ? '★' : ''}</span>
        <span class="plan-t"><b>Dimanche : votre note de la semaine</b>
          <em>${dimanche ? (d.note !== null && d.note !== undefined ? 'Moyenne de vos compositions : ' + d.note + ' %' : 'Aucune composition cette semaine') : 'Elle s\'affiche ici dimanche'}</em></span></div>
      <button class="lien-mini" style="margin-top:10px" data-plan-effacer="1">Refaire mon plan</button>
    </div></div>`;
}
function blocMesCompositions(){
  const j = S.journee; if(!j) return '';
  const cs = (j.compositions || []).filter(c => c.sur > 0);
  const st = S.stats || {}, dt = S.details || {};
  const qSemaine = (j.jours14 || []).slice(-7).reduce((a, x) => a + (x.n || 0), 0);
  let compo = '';
  if(cs.length){
    const pcts = cs.map(c => Math.round(c.score / c.sur * 100));
    const moy = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
    const best = Math.max(...pcts);
    const r3 = pcts.slice(0, 3), p3 = pcts.slice(3, 6);
    const evol = (r3.length && p3.length) ? Math.round(r3.reduce((a,b)=>a+b,0)/r3.length - p3.reduce((a,b)=>a+b,0)/p3.length) : null;
    compo = `
      <div class="trio">
        <div><b class="num">${st.compositions || cs.length}</b><span>composition${(st.compositions || cs.length)>1?'s':''}</span></div>
        <div><b class="num">${moy} %</b><span>moyenne récente</span></div>
        <div><b class="num">${best} %</b><span>meilleure note</span></div>
      </div>
      ${evol !== null ? `<p class="sous" style="margin-top:10px">Vos 3 dernières compositions : ${evol === 0 ? 'même niveau que les 3 d\'avant' : (evol > 0 ? '<b style="color:var(--vert-texte)">+' + evol + ' points</b>' : '<b style="color:var(--rouge-texte)">' + evol + ' points</b>') + ' par rapport aux 3 d\'avant'}.</p>` : ''}
      <div class="libelle" style="margin-top:14px">Mes dernières compositions</div>
      ${cs.slice(0, 3).map((c, i) => {
        const p = Math.round(c.score / c.sur * 100);
        const numero = Math.max(1, (st.compositions || cs.length) - i);
        return `<div class="copie-l">
          <div class="cl-g"><b>${c.collective ? 'Composition nationale' : 'Composition ' + numero}</b><span>${E(new Date(c.date).toLocaleDateString('fr-FR', { day:'numeric', month:'short' }))}</span></div>
          <div class="cl-barre"><i class="${p >= 60 ? 'haut' : (p < 40 ? 'bas' : '')}" style="width:${p}%"></i></div>
          <b class="num cl-n">${c.score}/${c.sur}</b>
          <button class="mini" data-archive="${E(c.id)}" aria-label="Télécharger la feuille corrigée">${ico('telecharger',14)}</button>
        </div>`;
      }).join('')}
      ${cs.length > 1 ? `<button class="cta creux" style="margin-top:12px" data-toutes-compos>${ico('telecharger',16)} Télécharger toutes mes compositions (un seul PDF)</button>` : ''}`;
  }
  return `<div class="bloc">
    <div class="libelle">Mes compositions et mon activité</div>
    <div class="carte">
      ${compo || `<p class="sous">Aucune composition terminée pour l'instant.</p><button class="cta creux" style="margin-top:10px" data-go="grille">Faire ma première composition</button>`}
      <div class="libelle" style="margin-top:16px">Cette semaine</div>
      <div class="trio">
        <div><b class="num">${j.compos_semaine || 0}</b><span>composition${(j.compos_semaine||0)>1?'s':''}</span></div>
        <div><b class="num">${nombreFr(qSemaine)}</b><span>questions</span></div>
        <div><b class="num">${typeof dt.minutes_semaine === 'number' ? dt.minutes_semaine : '—'}</b><span>minutes</span></div>
      </div>
    </div>
  </div>`;
}

/* ---------- liens directs et bouton retour du téléphone ---------- */
/* « S'entraîner sur vos 10 dernières fautes » : on rouvre le cahier sur la première à reprendre */
async function lancerFautes(){
  if(!S.util.connecte){ S.modal = 'connexion'; S.erreur = ''; return surcouche(); }
  if(!S.cahier.length) await chargerCahier();
  const liste = aReprendre();
  if(!liste.length){ toast('Aucune faute à reprendre pour le moment. Bravo !', 4500); return aller('aujourdhui'); }
  S.cahierDepuisGrille = false; S.cahierFiltre = false;
  repriseIdx = S.cahier.indexOf(liste[0]); repriseRep = undefined;
  pister('LAST_FAULTS_STARTED', { n: Math.min(10, liste.length) });
  aller('cahier');
}
function ouvrirLienDirect(){
  window.__origine = origineVisite();
  const p = new URLSearchParams(location.search);
  const depuis = p.get('depuis');
  if(depuis) pister('ARRIVED_FROM', { depuis: depuis.slice(0, 20) });
  let cible = null;
  if(p.get('q') === 'jour') cible = 'qdj';
  else if(/^[0-9a-f-]{36}$/i.test(p.get('question') || '')){ cible = 'question'; S.lienQuestion = p.get('question'); S.qp = null; }
  else if(/^[0-9a-f-]{36}$/i.test(p.get('epreuve') || '')){ cible = 'gagnants'; S.lienEpreuve = p.get('epreuve'); S.classementEp = null; S.lienSalle = p.get('epreuve'); }
  else if(/^[0-9a-f-]{36}$/i.test(p.get('defi') || '')){ cible = 'defi'; S.lienDefi = p.get('defi'); S.defi = { etat:'chargement', id:p.get('defi') }; }
  else if(/^[0-9a-f-]{36}$/i.test(p.get('copie') || '')){ const id = p.get('copie'); setTimeout(() => feuilleArchive(id), 1500); }
  else if(p.get('reprendre') === 'cours' || p.get('reprendre') === 'qcm') cible = repriseCible(p.get('reprendre'));
  else if(p.get('fautes')){ setTimeout(lancerFautes, 1200); }
  else if(p.has('nouveau-code')) setTimeout(() => verifierChangementCode(true), 1500);
  else if(p.has('avis') || p.has('annonce')) setTimeout(() => chargerNotifications(), 1200);
  else if(p.has('communaute')){ cible = 'communaute'; if(/^[0-9a-f-]{36}$/i.test(p.get('communaute') || '')) S.commFocus = p.get('communaute'); }
  else if(p.has('installer')){ S.modalDejaVu = true; setTimeout(fenetreInstaller, 1200); }
  else if(p.has('compte')) cible = 'compte';
  else if(p.has('abonnement')) cible = 'abonnement';
  else if(p.has('parcours')) cible = 'parcours';
  /* ?installer reste dans l'adresse : à la toute première visite la page se recharge une fois (service worker) */
  if(p.toString() && !p.has('installer')) try{ history.replaceState({ ecran: cible || S.ecran }, '', location.pathname); }catch(e){}
  if(cible){
    S.modalDejaVu = true;
    if(ECRANS_DECOUVERTE.includes(S.ecran)) ecrireMemoire(Object.assign({}, lireMemoire() || {}, { dejaVenu:true }));
    aller(cible);
  }
}
var retourEnCours = false;
try{ history.replaceState({ ecran: S.ecran }, ''); }catch(e){}
window.addEventListener('popstate', ev => {
  const v = document.getElementById('voile');
  /* un panneau ouvert se ferme d'abord */
  if(v && !v.hidden){
    v.hidden = true; v.innerHTML = ''; S.modal = null;
    try{ history.pushState({ ecran:S.ecran }, ''); }catch(e){}
    return;
  }
  if(enComposition()){
    try{ history.pushState({ ecran:'grille' }, ''); }catch(e){}
    return demanderQuitter();
  }
  if(S.ecran === 'cahier' && repriseIdx !== null){
    repriseIdx = null; repriseRep = undefined;
    try{ history.pushState({ ecran:'cahier' }, ''); }catch(e){}
    return rendre();
  }
  let e = (ev.state && ev.state.ecran) || 'aujourdhui';
  if(ECRANS_DECOUVERTE.includes(e) && (S.util.connecte || (lireMemoire() || {}).dejaVenu)) e = 'aujourdhui';
  retourEnCours = true;
  aller(e);
  retourEnCours = false;
});

/* Les nouveaux boutons ont leur propre écouteur : le grand aiguillage
   plus bas reste tel quel. */
document.addEventListener('click', ev => {
  const t = ev.target.closest('[data-abo-matiere],[data-corr-nat],[data-fin-essai-non],[data-fin-essai-oui],[data-class-fermer],[data-class-voir],[data-quitter],[data-quitter-oui],[data-quitter-non],[data-son],[data-correction-differee],[data-gagnants],[data-pourtoi],[data-fil-rep],[data-fil-suiv],[data-qdj-rep],[data-qp-rep],[data-signaler],[data-signal-envoi],[data-objectif],[data-rejoindre],[data-rappel-activer],[data-rappel-retirer],[data-reagir],[data-partage-question],[data-partage-qdj],[data-partage-rang],[data-carte-resultat],[data-sortir-reprise],[data-inscrire-nat],[data-correction-nat],[data-nat-oui],[data-nat-non],[data-resultats-pdf],[data-telecharger-mat],[data-rappel-heure],[data-rappel-inter],[data-rappel-oui],[data-rappel-autre],[data-rappel-plus-tard],[data-rappel-fermer],[data-rappel-masquer],[data-rappel-wa],[data-installe-d],[data-installer-lien],[data-notifs-lien],[data-notifs-d],[data-paiement-plus-tard],[data-ouvrir-chrome],[data-canal-tete]');
  if(!t) return;
  const d = t.dataset;
  try{ const cle = Object.keys(d)[0]; pister('BUTTON_CLICKED', { valeur: String(d[cle]).slice(0,40) }, cle); }catch(e){}

  if(d.correctionNat) return feuilleArchive(d.correctionNat);
  if(d.quitter){ S.apresQuitter = null; return demanderQuitter(); }
  if(d.quitterNon){ document.getElementById('voile').hidden = true; S.modal = null; return; }
  if(d.quitterOui){
    document.getElementById('voile').hidden = true; S.modal = null;
    pister('COMPOSITION_QUIT', { traitees: Object.keys(S.reponses).length, restant_s: S.chrono });
    sauverEpreuve();
    { const dest = S.apresQuitter || 'aujourdhui'; S.apresQuitter = null; return aller(dest); }
  }
  if(d.son){
    S.sonCoupe = !S.sonCoupe; ecrireReglage('sonCoupe', S.sonCoupe);
    const b = t; b.setAttribute('aria-pressed', String(!S.sonCoupe));
    b.innerHTML = ico(S.sonCoupe ? 'muet' : 'son', 14) + '<span>' + (S.sonCoupe ? 'Son coupé' : 'Son') + '</span>';
    if(!S.sonCoupe) bip(1);
    return;
  }
  if(d.correctionDifferee){
    (async () => {
      try{
        const { data } = await base.rpc('ma_copie', { p_composition: S.derniereCompo });
        if(!data || !data.ok || data.correction_le){ toast('La correction n\'est pas encore publiée.'); return; }
        (data.questions || []).forEach((q, i) => { if(S.grille[i]){ S.grille[i].bonnes = q.bonnes || []; S.grille[i].i = (q.bonnes || [])[0] ?? null; } });
        S.correctionLe = null; chargerCahier(); rendre();
      }catch(e){ toast('Vérifie ta connexion.'); }
    })();
    return;
  }
  if(d.finEssaiNon !== undefined){ document.getElementById('voile').hidden = true; S.modal = null; return; }
  if(d.finEssaiOui !== undefined){ document.getElementById('voile').hidden = true; S.modal = null; pister('TRIAL_END_POPUP_CLICKED'); return aller('abonnement'); }
  if(d.classFermer){ pister('RANKING_POPUP_CLOSED'); return fermerClassement(d.classFermer); }
  if(d.classVoir){ fermerClassement(d.classVoir); compterVueResultats(d.classVoir); chargerClassement(d.classVoir); return aller('gagnants'); }
  if(d.gagnants){ compterVueResultats(d.gagnants); chargerClassement(d.gagnants); return aller('gagnants'); }
  if(d.aboMatiere){ return exigerAbonnement('Vous avez fait les 15 questions gratuites en ' + d.aboMatiere + '. L\'abonnement ouvre toute la matière.', 'matiere'); }
  if(d.corrNat){ chargerCorrectionNat(d.corrNat); return aller('correctionnat'); }
  if(d.pourtoi){ return lancerFil(d.pourtoi); }
  if(d.filRep !== undefined) return repondreFil(+d.filRep);
  if(d.filSuiv){ const f = S.fil; f.idx++; f.rep = undefined; f.c = null; f.debut = Date.now(); vue().scrollTop = 0; return ecranPourToi(); }
  if(d.qdjRep !== undefined) return repondreQdj(+d.qdjRep);
  if(d.qpRep !== undefined) return repondreQuestionPartagee(+d.qpRep);
  if(d.signaler) return ouvrirSignalement(d.signaler);
  if(d.signalEnvoi) return envoyerSignalement();
  if(d.objectif){
    const o = +d.objectif;
    if(S.journee){ S.journee.objectif = o; rendre(); }
    base && base.rpc('definir_objectif', { p_objectif: o }).then(() => {}, () => toast('Objectif non enregistré : vérifie ta connexion.'));
    pister('DAILY_GOAL_SET', { objectif:o });
    return;
  }
  if(d.rejoindre) return entrerEnSalle(d.rejoindre);
  if(d.rappelInter !== undefined){
    if(S.rappel) return retirerRappel();
    const h = document.getElementById('rappel-h'), m = document.getElementById('rappel-m');
    return activerRappel(h ? +h.value : 19, m ? +m.value : 0);
  }
  if(d.rappelOui !== undefined){ fermerFenetreRappel(); pister('REMINDER_PROMPT_ACCEPTED'); return activerRappel(19, 0); }
  if(d.rappelAutre !== undefined){ fermerFenetreRappel(); pister('REMINDER_PROMPT_OTHER_HOUR'); return aller('compte'); }
  if(d.rappelPlusTard !== undefined || d.rappelFermer !== undefined){
    if(d.rappelPlusTard !== undefined){ ecrireReglage('rappelPlusTard', Date.now()); pister('REMINDER_PROMPT_LATER'); }
    return fermerFenetreRappel();
  }
  if(d.rappelMasquer !== undefined){ ecrireReglage('bandeauRappel', Date.now()); pister('REMINDER_BANNER_HIDDEN'); return rendre(); }
  if(d.rappelWa !== undefined){ pister('REMINDER_WHATSAPP_CLICK'); return; }
  if(d.rappelActiver) return activerRappel(d.rappelActiver, 0);
  if(d.rappelRetirer) return retirerRappel();
  if(d.installerLien){ pister('INSTALL_LINK_CLICKED'); return installerAppli(); }
  if(d.canalTete){
    pister('WHATSAPP_JOINED_CLICK', { source:'entete' });
    ecrireReglage('inv_whatsapp_fait', true);
    window.open(CONTACT.canal, '_blank', 'noopener');
    return majBoutonCanal();
  }
  if(d.ouvrirChrome) return ouvrirDansChrome();
  if(d.notifsLien){ pister('INSTALL_LINK_NOTIFS'); fermerFenetreRappel(); return activerRappel(18, 0); }
  if(d.reagir) return reagir(d.reagir);
  if(d.partageQuestion){
    const q = ((S.fil && S.fil.liste) || []).find(x => x.id === d.partageQuestion);
    const qb = (S.banque || []).flatMap(m => m.questions).find(x => x.id === d.partageQuestion);
    return partagerQuestion(d.partageQuestion, q ? q.enonce : (qb ? qb.q : ''));
  }
  if(d.partageQdj){
    const q = S.qdj || {};
    const t2 = 'Question du jour sur Mon Concours : « ' + (q.enonce || '') + ' » Tu as la réponse ? ' + CONTACT.site + '/?q=jour';
    pister('DAILY_QUESTION_SHARED');
    window.open('https://wa.me/?text=' + encodeURIComponent(t2), '_blank', 'noopener');
    return;
  }
  if(d.carteResultat) return carteResultat(d.carteResultat);
  if(d.partageRang){
    const c = S.classementEp;
    if(!c || !c.moi) return;
    const t3 = `${c.moi.statut === 'admis' ? 'Admis ! ' : ''}J'ai fini ${c.moi.rang}${c.moi.rang === 1 ? 'er' : 'e'} sur ${c.participants} à la composition nationale ${c.concours ? '(' + c.concours + ') ' : ''}de Mon Concours, avec ${c.moi.score}/${c.moi.sur}. ${prochaineNat() ? 'La prochaine : ' + prochaineNat() + '.' : ''} Viens composer : ${CONTACT.site}`;
    window.open('https://wa.me/?text=' + encodeURIComponent(t3), '_blank', 'noopener');
    return;
  }
  if(d.sortirReprise){ repriseIdx = null; repriseRep = undefined; return rendre(); }
  if(d.inscrireNat) return inscrireNationale(d.inscrireNat, false);
  if(d.natOui) return inscrireNationale(d.natOui, true);
  if(d.natNon){ ecrireReglage('nonNat-' + d.natNon, true); document.getElementById('voile').hidden = true; S.modal = null; pister('NATIONAL_DECLINED'); return; }
  if(d.resultatsPdf) return resultatsPdf();
  if(d.telechargerMat){ if(!coursOuvert(decodeURIComponent(d.telechargerMat)) && !exigerAbonnement('Les deux premiers cours de chaque niveau sont offerts. Les autres font partie de l\'abonnement.', 'cours_pdf')) return; return telechargerCoursMatiere(decodeURIComponent(d.telechargerMat)); }
  if(d.rappelHeure){ const h = document.getElementById('rappel-h'), m = document.getElementById('rappel-m'); return activerRappel(h ? +h.value : 19, m ? +m.value : 0); }
  if(d.installeD){
    pister('PARCOURS_D_INSTALL_CLICKED');
    installerAppli();
    /* On avance à l'étape notifs même si l'install échoue (iOS, navigateur incompatible) */
    setTimeout(() => { S.verrouDEtape = 3; aller('verrou_d'); }, 1200);
    return;
  }
  if(d.notifsD){
    pister('PARCOURS_D_NOTIFS_CLICKED');
    activerRappel(18, 0).then(() => {
      aller('resultat');
    }).catch(() => {
      /* La permission est refusée ou indisponible → on laisse quand même voir le résultat */
      aller('resultat');
    });
    return;
  }
  if(d.paiementPlusTard){
    pister('PARCOURS_D_PAIEMENT_PLUS_TARD');
    document.getElementById('voile').hidden = true; S.modal = null;
    return;
  }
});

/* =====================================================================
   SUITE DES PROPOSITIONS : niveaux, mission du jour, citations, notion
   du jour, questions similaires et pièges, recherche, défis entre amis,
   top 10, propositions de questions, parcours, carte de progression,
   pause de série, concours visé, plein écran, concentration, installation.
   ===================================================================== */
/* Les compositions offertes : 4 (version A) ou 3 + 1 après activation des notifications (version B test). Le serveur décide. */
const compoOffertes = () => (S.offreCompo && S.offreCompo.offertes) || 4;
async function chargerOffreCompo(){
  if(!base || !S.util.connecte) return;
  try{ const { data } = await base.rpc('mon_offre_compositions'); if(data) S.offreCompo = data; }catch(e){}
}
async function chargerDetails(){
  chargerOffreCompo();
  if(!base || !S.util.connecte) return;
  try{ const { data } = await base.rpc('mes_details'); if(data){ const ch = !pareil(data, S.details); S.details = data; memoEcrire('details', data, true); if(ch) rafraichirSiVisible(); verifierNiveau(); setTimeout(notificationsDuJour, 2500); } }catch(e){}
  chargerElan();
}

/* ---------- les niveaux : Débutant, Confirmé, Prêt pour le concours ---------- */
const NIVEAUX_C = [
  { nom:'Débutant', crit:() => [] },
  { nom:'Confirmé', crit:() => [['questions', 500, 'questions résolues (QCM)', 'questions'], ['compos', 150, 'compositions', 'compositions']] },
  { nom:'Prêt pour le concours', crit:v => [['questions', 4000, 'questions résolues (QCM)', 'questions'], ['compos', 1500, 'compositions', 'compositions'], ['cours', v.coursTotal, 'cours de votre niveau lus', 'cours lus']] }
];
function valeursNiveau(){
  const st = S.stats || {}, dt = S.details || {};
  return { questions: st.questions_resolues || 0, compos: st.compositions || 0,
    qcm: dt.qcm_revision || 0, cours: dt.cours_lus || 0, coursTotal: dt.cours_total || 0 };
}
/* on monte marche par marche : « Prêt » suppose d'être déjà « Confirmé » */
function niveauCandidat(){
  const v = valeursNiveau();
  let n = 0;
  for(let i = 1; i < NIVEAUX_C.length; i++){
    if(NIVEAUX_C[i].crit(v).every(([k, c]) => v[k] >= c)) n = i; else break;
  }
  return { i:n, nom:NIVEAUX_C[n].nom, suivant:NIVEAUX_C[n + 1] || null, v };
}
function verifierNiveau(){
  if(!S.stats) return;
  const n = niveauCandidat().i, avant = lireReglages().niveauAtteint;
  if(typeof avant === 'number' && n > avant){
    setTimeout(() => { sonDepart(); signalCandidat('Nouveau niveau : ' + NIVEAUX_C[n].nom + '. Bravo, continue !'); }, 600);
    if(base && n >= 1) base.rpc('ma_notification', { p_type:'progression', p_titre:'Niveau atteint : ' + NIVEAUX_C[n].nom,
      p_message:'Bravo ! Votre attestation PDF « ' + NIVEAUX_C[n].nom + ' » est prête dans Mon parcours.', p_cle:'progression-niveau-' + n, p_lien:'parcours' }).catch(() => {});
    pister('LEVEL_REACHED', { niveau: NIVEAUX_C[n].nom });
  }
  ecrireReglage('niveauAtteint', n);
}
/* le chemin Débutant → Confirmé → Prêt, avec des flèches */
function infoNiveau(n){
  const i = S.nivInfo;
  if(typeof i !== 'number' || !NIVEAUX_C[i]) return '';
  const niv = NIVEAUX_C[i], nom = niv.nom.toLowerCase();
  let txt;
  if(i === n.i) txt = `Vous êtes au niveau <b>${nom}</b>.`;
  else if(i < n.i) txt = `Vous avez déjà dépassé le niveau <b>${nom}</b>. Vous êtes au niveau <b>${n.nom.toLowerCase()}</b>.`;
  else txt = `Vous êtes au niveau <b>${n.nom.toLowerCase()}</b>. Pour atteindre le niveau <b>${nom}</b>, il faut :</p>` +
    '<ul class="niv-info-liste">' + niv.crit(n.v).map(([k, c, l]) => `<li><b class="num">${nombreFr(c)}</b> ${l}${n.v[k] >= c ? ' ✓' : ' <i>(vous en avez ' + nombreFr(n.v[k]) + ')</i>'}</li>`).join('') + '</ul><p style="display:none">';
  return `<div class="niv-info" role="status"><p>${txt}</p></div>`;
}
function cheminNiveaux(n){
  return `${infoNiveau(n)}<div class="niv-route">${NIVEAUX_C.map((x, i) => {
    const etat = i < n.i ? 'passe' : (i === n.i ? 'actuel' : 'avenir');
    return `${i ? `<span class="niv-fleche ${i <= n.i ? 'on' : ''}" aria-hidden="true">→</span>` : ''}
      <button type="button" class="niv-pas ${etat} ${S.nivInfo === i ? 'choisi' : ''}" data-nivinfo="${i}"><span class="niv-rond">${etat === 'passe' ? '✓' : i + 1}</span><b>${x.nom}</b>${etat === 'actuel' ? '<em>Vous êtes ici</em>' : ''}</button>`;
  }).join('')}</div>`;
}
function criteresNiveau(niv, v){
  return niv.crit(v).map(([k, c, l, court]) => {
    const fait = Math.min(v[k], c), pct = c ? Math.round(fait / c * 100) : 100;
    return `<div class="nd-crit">
      <div class="nd-l"><span>${l.charAt(0).toUpperCase() + l.slice(1)}</span><b class="num">${nombreFr(v[k])} / ${nombreFr(c)}</b></div>
      <div class="nd-barre ${pct >= 100 ? 'ok' : ''}"><i style="width:${pct}%"></i></div>
      <div class="nd-s">${pct >= 100 ? 'Atteint.' : 'Vous avez réalisé ' + nombreFr(v[k]) + ' ' + court + '. Il vous reste ' + nombreFr(c - v[k]) + '.'}</div>
    </div>`;
  }).join('');
}
function blocNiveau(court){
  if(!S.stats) return '';
  const n = niveauCandidat();
  return `<div class="carte niveau-carte" ${court ? 'style="margin-top:12px"' : ''}>
    <div class="libelle" style="margin-bottom:10px"><span>Votre niveau</span><b style="color:var(--or)">${n.nom}</b></div>
    ${cheminNiveaux(n)}
    ${n.suivant ? `<div class="nd-palier"><div class="nd-nom">Pour atteindre le niveau « ${n.suivant.nom} »</div>${criteresNiveau(n.suivant, n.v)}</div>`
      : '<p class="sous" style="margin-top:10px;font-size:12.5px">Vous avez atteint le dernier niveau. Gardez le rythme jusqu\'au jour du concours.</p>'}
  </div>`;
}
/* la page Parcours : tous les paliers qui restent */
function blocNiveauDetail(){
  if(!S.stats) return '';
  const n = niveauCandidat();
  const paliers = NIVEAUX_C.slice(n.i + 1).map(niv => `<div class="nd-palier"><div class="nd-nom">Pour atteindre le niveau « ${niv.nom} »</div>${criteresNiveau(niv, n.v)}</div>`).join('');
  return `<div class="carte niveau-carte niveau-detail" style="margin-top:14px">
    <p class="nd-titre">Vous êtes au niveau <b>${n.nom.toLowerCase()}</b>.</p>
    ${cheminNiveaux(n)}
    ${paliers || '<p class="sous" style="margin-top:10px">Vous avez atteint le dernier niveau. Gardez le rythme jusqu\'au jour du concours.</p>'}
    ${blocAttestations()}
    <p class="sous" style="margin-top:10px;font-size:12px">Tout compte : questions de révision, erreurs reprises, défis et compositions. Un cours est compté comme lu quand vous l'avez lu jusqu'au bout.</p>
  </div>`;
}

/* ---------- citations (attributions vérifiées) ---------- */
const CITATIONS = [
  ["Oser inventer l'avenir.", "Thomas Sankara"],
  ["N'an lara, an sara : si nous nous couchons, nous sommes morts.", "Joseph Ki-Zerbo"],
  ["On ne développe pas, on se développe.", "Joseph Ki-Zerbo"],
  ["Le savoir est une lumière qui est en l'homme.", "Amadou Hampâté Bâ"],
  ["En Afrique, quand un vieillard meurt, c'est une bibliothèque qui brûle.", "Amadou Hampâté Bâ"],
  ["Armez-vous de science jusqu'aux dents.", "Cheikh Anta Diop"],
  ["L'éducation est l'arme la plus puissante pour changer le monde.", "Nelson Mandela"],
  ["Cela semble toujours impossible, jusqu'à ce qu'on le fasse.", "Nelson Mandela"],
  ["Une bonne tête et un bon cœur sont toujours une combinaison formidable.", "Nelson Mandela"],
  ["Un enfant, un enseignant, un livre et un stylo peuvent changer le monde.", "Malala Yousafzai"],
  ["L'éducation est le passeport pour l'avenir : demain appartient à ceux qui s'y préparent aujourd'hui.", "Malcolm X"],
  ["Tout seul, on va plus vite ; ensemble, on va plus loin.", "Proverbe africain"],
  ["Celui qui ne sait pas où il va doit regarder d'où il vient.", "Proverbe africain"],
  ["Goutte à goutte, l'eau remplit la jarre.", "Proverbe africain"],
  ["Le chemin le plus long commence par un premier pas.", "Proverbe africain"],
  ["C'est en forgeant qu'on devient forgeron.", "Proverbe français"],
  ["Un voyage de mille lieues commence toujours par un premier pas.", "Lao Tseu"],
  ["Le hasard ne favorise que les esprits préparés.", "Louis Pasteur"],
  ["Dans la vie, rien n'est à craindre, tout est à comprendre.", "Marie Curie"],
  ["L'imagination est plus importante que le savoir.", "Albert Einstein"],
  ["Le génie, c'est 1 % d'inspiration et 99 % de transpiration.", "Thomas Edison"],
  ["Ceux qui vivent, ce sont ceux qui luttent.", "Victor Hugo"],
  ["Ce n'est pas parce que les choses sont difficiles que nous n'osons pas ; c'est parce que nous n'osons pas qu'elles sont difficiles.", "Sénèque"],
  ["Mieux vaut une tête bien faite qu'une tête bien pleine.", "Montaigne"],
  ["Science sans conscience n'est que ruine de l'âme.", "Rabelais"],
  ["Hâtez-vous lentement, et sans perdre courage, vingt fois sur le métier remettez votre ouvrage.", "Boileau"],
  ["Patience et longueur de temps font plus que force ni que rage.", "La Fontaine"]
];
const jourAnnee = () => Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
/* Une citation différente à chaque ouverture : on ne retombe jamais sur celle de la fois d'avant. */
const indexCitation = (() => {
  let i = Math.floor(Math.random() * CITATIONS.length), d = -1;
  try{ d = +localStorage.getItem('mc_citation_vue'); }catch(e){}
  if(CITATIONS.length > 1 && i === d) i = (i + 1 + Math.floor(Math.random() * (CITATIONS.length - 1))) % CITATIONS.length;
  try{ localStorage.setItem('mc_citation_vue', String(i)); }catch(e){}
  return i;
})();
function blocCitation(){
  const [t, a] = CITATIONS[indexCitation];
  return `<figure class="citation"><blockquote>« ${E(t)} »</blockquote><figcaption>${E(a)}</figcaption></figure>`;
}

/* ---------- défi du jour : il change chaque jour ---------- */
function missionDuJour(){
  const pm = ((S.stats && S.stats.par_matiere) || []).filter(x => x.traitees >= 5).map(x => ({ ...x, taux:Number(x.taux) || 0 })).sort((a, b) => a.taux - b.taux)[0];
  const m = [
    { t:'Revoir tes erreurs prévues aujourd\'hui', a:'data-pourtoi="10"' },
    pm ? { t:`Série de 10 questions en ${pm.matiere}, ta matière la plus fragile`, a:`data-cible="${E(pm.matiere)}"` } : { t:'Série de 10 questions dans une matière de ton choix', a:'data-go="revisions"' },
    { t:'Mini-test express : 5 questions sans t\'arrêter', a:'data-pourtoi="5"' },
    { t:'Lire un chapitre de cours, puis faire ses QCM', a:'data-go="revisions"' },
    { t:'Composer en conditions réelles : 50 questions, 40 minutes', a:'data-go="grille"' },
    { t:'Défier un ami : 10 questions en 5 minutes', a:'data-defi-lancer="1"' }
  ];
  return m[jourAnnee() % m.length];
}

/* ---------- l'en-tête de l'accueil : série, temps, niveau ---------- */
function bandeauAccueil(){
  if(!S.util.connecte || !S.stats) return '';
  const serie = S.stats.serie || 0, min = S.details ? S.details.minutes_semaine || 0 : null;
  const tps = min === null ? '' : (min >= 60 ? Math.floor(min / 60) + ' h ' + String(min % 60).padStart(2, '0') : min + ' min');
  return `<div class="bandeau-accueil">
    <span>${ico('flamme',16)} <b class="num">${serie}</b> jour${serie > 1 ? 's' : ''} d'affilée</span>
    ${tps ? `<span>${ico('horloge',16)} <b class="num">${tps}</b> cette semaine</span>` : ''}
    <span class="niv">${E(niveauCandidat().nom)}</span>
  </div>`;
}

/* ---------- le bas de l'accueil : progression, défis, entraînement ---------- */
function blocPlus(){
  const debutant = !S.stats || (S.stats.questions_resolues || 0) < 50;
  const mission = missionDuJour();
  const dernier = lireReglages().dernierQcm;
  const pos = dernier && S.qcmPos ? (S.qcmPos[dernier] || 0) : 0;
  return `
    ${dernier && pos > 0 ? `<button class="grande" style="margin-top:12px" data-mat="${E(dernier)}">
      <span class="ic">${ico('revisions',19)}</span><span><b>Reprendre ${E(dernier)}</b><span>Question ${pos + 1}, là où tu t'es arrêté</span></span><span class="fl">→</span></button>` : ''}
    ${debutant && S.util.connecte ? `<div class="carte" style="margin-top:12px"><div class="libelle" style="margin-bottom:6px">Pour bien commencer</div>
      <p class="sous" style="margin-bottom:10px">Commence par les bases : quelques questions chaque jour, puis ta première composition. Ton cahier d'erreurs se remplit tout seul et te guide.</p></div>` : ''}

    <h2 class="titre-section">S'entraîner autrement</h2>
    <div class="raccourcis">
      <button data-go="qdj">${ico('question',18)}<b>Question du jour</b><span>La même pour tous</span></button>
      <button data-go="top" style="align-items:center;justify-content:center;text-align:center">${ico('trophee',18)}<b>Top 10 de la semaine</b><span>Défiez les meilleurs</span></button>
    </div>
    ${blocCitation()}`;
}

/* ---------- fil générique : une liste venue du serveur ---------- */
async function lancerFilRpc(nom, params, titre){
  if(!S.util.connecte){ S.modal = 'inscription'; S.erreur = ''; return surcouche(); }
  S.fil = { liste:null, idx:0, rep:undefined, c:null, justes:0, revues:0, n:0, attente:false, titre: titre || 'POUR TOI', fautes:[] };
  aller('pourtoi');
  try{
    const { data, error } = await base.rpc(nom, params || {});
    if(error) throw error;
    S.fil.liste = Array.isArray(data) ? data : ((data && data.questions) || []);
    S.fil.debut = Date.now();
  }catch(e){ S.fil.liste = []; S.fil.erreur = true; }
  if(S.ecran === 'pourtoi') rendre();
}
function lancerFilListe(liste, titre){
  S.fil = { liste, idx:0, rep:undefined, c:null, justes:0, revues:0, n:liste.length, attente:false, titre, fautes:[], debut:Date.now() };
  aller('pourtoi');
}

/* ---------- notion du jour ---------- */
async function chargerNotion(){
  if(!base) return;
  try{ const { data } = await base.rpc('notion_du_jour', { p_niveau: niveauCand() }); S.notion = data ? { ...data, jour: new Date().toDateString() } : { vide:true }; }
  catch(e){ S.notion = { erreur:true }; }
  if(S.ecran === 'notion') rendre();
}
function ecranNotion(){
  const n = S.notion;
  const tete = `<button class="retourhaut" data-go="aujourdhui">Retour</button>`;
  if(!n){ chargerNotion(); vue().innerHTML = `<div class="pad">${tete}<div class="squelette large" style="margin-top:16px"></div><div class="squelette"></div></div>`; return; }
  if(n.vide || n.erreur){ vue().innerHTML = `<div class="pad">${tete}<h1 class="titre">Notion du jour</h1><p class="sous">${n.erreur ? 'Elle n\'a pas pu être chargée.' : 'Pas de notion disponible pour ce niveau.'}</p></div>`; return; }
  vue().innerHTML = `
  <div class="pad">
    ${tete}
    <div class="eyebrow">${E(dateDuJour())} · ${E(n.matiere || '')}${n.theme ? ' · ' + E(n.theme) : ''}</div>
    <h1 class="titre">${E(n.titre)}</h1>
    <p class="sous" style="margin:6px 0 12px">La notion du jour : lis-la, puis vérifie que tu l'as comprise avec 3 questions.</p>
    <div class="carte lecon">${miseEnPage(n.texte)}${n.coupe ? '<p class="sous"><i>… la suite est dans la bibliothèque.</i></p>' : ''}</div>
    ${(n.questions || []).length ? `<button class="cta" style="margin-top:14px" data-notion-q="1">Répondre aux ${n.questions.length} questions</button>` : ''}
    ${n.coupe && n.matiere ? `<button class="cta creux" style="margin-top:9px" data-matiere="${encodeURIComponent(n.matiere)}">Lire le cours complet</button>` : ''}
  </div>`;
}

/* ---------- recherche dans les questions ---------- */
function ecranRecherche(){
  if(!S.banque && S.banqueEtat !== 'chargement') chargerQuestions();
  const q = (S.rechQ || '').trim().toLowerCase();
  const toutes = (S.banque || []).flatMap(m => m.questions.map(x => ({ ...x, matiere:m.nom })));
  const res = q.length >= 3 ? toutes.filter(x => (x.q + ' ' + x.o.join(' ')).toLowerCase().includes(q)).slice(0, 30) : [];
  vue().innerHTML = `
  <div class="pad">
    <button class="retourhaut" data-go="aujourdhui">Retour</button>
    <h1 class="titre">Chercher une question</h1>
    <p class="sous" style="margin:6px 0 12px">Dans les ${nombreFr(toutes.length)} questions du niveau ${E(S.niveau.toLowerCase())}. Tape au moins 3 lettres : un mot, un nom, une date.</p>
    <div class="champ"><input id="rech-q" type="search" value="${E(S.rechQ || '')}" placeholder="Ex. : constitution, Sankara, glycémie…" oninput="filtrerQuestions(this.value)" autocomplete="off"></div>
    ${q.length >= 3 ? `<p class="sous" style="margin-bottom:8px">${res.length}${res.length === 30 ? '+' : ''} résultat${res.length > 1 ? 's' : ''}</p>` : ''}
    ${res.map(x => `<button class="resultat-q" data-ouvrirq="${E(x.id)}"><span class="eyebrow">${E(x.matiere)}</span><b>${E(x.q)}</b></button>`).join('')}
    ${S.banqueEtat === 'chargement' ? '<div class="squelette"></div>' : ''}
  </div>`;
}
let minuteurRechQ = null;
window.filtrerQuestions = function(v){
  S.rechQ = v; clearTimeout(minuteurRechQ);
  minuteurRechQ = setTimeout(() => {
    if(S.ecran !== 'recherche') return;
    ecranRecherche();
    const c = document.getElementById('rech-q'); if(c){ c.focus(); c.setSelectionRange(c.value.length, c.value.length); }
  }, 220);
};

/* ---------- défier un ou plusieurs amis ---------- */
/* étape 1 : les matières ; étape 2 : les numéros (ou le pseudo choisi dans le top 10) */
function nouveauDefi(cible){
  S.defi = null;
  S.defiPrep = { matieres:[], numeros:[''], pseudo: cible || null, etape:1 };
}
async function creerDefi(parWhatsapp){
  if(!S.util.connecte){ S.modal = 'inscription'; S.erreur = ''; return surcouche(); }
  const p = S.defiPrep || { matieres:[], numeros:[] };
  const numeros = [...document.querySelectorAll('[data-defi-num]')].map(x => x.value.trim()).filter(Boolean);
  p.numeros = numeros.length ? numeros : [''];
  const valides = numeros.filter(n => n.replace(/\D/g, '').length >= 8);
  /* sans numéro, le défi part par WhatsApp : l'ami ouvre le lien et crée son compte */
  if(!valides.length && !p.pseudo && !parWhatsapp){ toast('Entrez au moins un numéro, ou envoyez le défi sur WhatsApp.'); return; }
  S.defi = { etat:'chargement' }; rendre();
  try{
    const { data } = await base.rpc('creer_defi_matieres', { p_matieres: p.matieres, p_niveau: niveauCand() });
    if(!data || !data.ok){ S.defi = { etat:'erreur', message:(data && data.message) || 'Défi impossible.' }; return rendre(); }
    let r = { ok:true, invites:0 };
    if(valides.length || p.pseudo){
      const inv = await base.rpc('inviter_defi', { p_defi: data.id, p_telephones: valides, p_pseudos: p.pseudo ? [p.pseudo] : [] });
      r = inv.data || {};
    }
    if(!r.ok){ S.defi = { etat:'erreur', message: r.message || 'Invitation impossible.' }; return rendre(); }
    pister('CHALLENGE_CREATED', { matieres: p.matieres.length, invites: r.invites || 0 });
    S.defi = { etat:'envoye', id:data.id, invites:r.invites || 0, matieres:p.matieres, parWhatsapp: !!parWhatsapp };
    S.defiPrep = null;
    rendre();
    if(parWhatsapp) partagerDefiWhatsapp(S.defi);
  }catch(e){ S.defi = { etat:'erreur', message: enFrancais(e, 'Vérifiez votre connexion.') }; rendre(); }
}
/* Le texte envoyé sur WhatsApp : une invitation avant de jouer, une provocation après */
function texteDefiWhatsapp(d){
  const mat = d.matiere || (d.matieres && d.matieres.length ? d.matieres.join(', ') : '');
  const enMat = mat ? ' en ' + mat : '';
  const lien = lienDefi(d.id);
  if(typeof d.score === 'number'){
    const moi = (d.classement || []).find(l => l.moi);
    const temps = d.duree ? ' en ' + mmssLong(d.duree) : '';
    if(moi && moi.rang === 1 && (d.classement || []).length > 1)
      return `Je t'ai battu${enMat} sur Mon Concours : ${d.score}/${d.sur}${temps}. À toi de me rattraper : ${lien}`;
    return `J'ai eu ${d.score}/${d.sur}${enMat}${temps} sur Mon Concours. Tu fais mieux ? Relève le défi (c'est gratuit) : ${lien}`;
  }
  return `Je te défie sur Mon Concours : 10 questions${enMat} en 5 minutes. Inscris-toi gratuitement et relève le défi : ${lien}`;
}
function partagerDefiWhatsapp(d){
  pister('CHALLENGE_SHARED', { apres: typeof d.score === 'number' });
  window.open('https://wa.me/?text=' + encodeURIComponent(texteDefiWhatsapp(d)), '_blank', 'noopener');
}
async function repondreDefi(id, accepte){
  try{
    const { data } = await base.rpc('repondre_defi', { p_defi: id, p_accepte: accepte });
    if(!data || !data.ok) throw new Error('refus');
    pister(accepte ? 'CHALLENGE_ACCEPTED' : 'CHALLENGE_DECLINED');
    if(accepte) return ouvrirDefi(id);
    S.defi = { ...S.defi, invitation:'refuse' }; rendre();
  }catch(e){ toast('Réponse non envoyée. Vérifiez votre connexion.'); }
}
async function ouvrirDefi(id){
  S.defi = { etat:'chargement', id };
  if(S.ecran !== 'defi') aller('defi'); else rendre();
  if(!base){ S.lienDefi = id; return; }
  try{
    const { data } = await base.rpc('ouvrir_defi', { p_defi: id });
    if(!data || !data.ok){ S.defi = { etat: data && data.connexion ? 'connexion' : 'erreur', id, message:(data && data.message) || 'Défi introuvable.', auteur:data && data.auteur, matiere:data && data.matiere }; return rendre(); }
    if(data.invitation){ S.defi = { etat:'invitation', ...data, id }; return rendre(); }
    if(data.termine){
      const rep = {}; Object.entries(data.reponses || {}).forEach(([k, v]) => { rep[k] = (v || []).map(Number); });
      S.defi = { etat:'resultat', ...data, ...(data.resultat || {}), rep, corrige:(data.questions || []).map(q => q.bonnes || []) };
      return rendre();
    }
    S.defi = { etat:'jeu', id, ...data, rep:{}, chrono:data.restant };
    rendre();
    clearInterval(S.defiTimer);
    sonDepart();
    S.defiTimer = setInterval(() => {
      if(!S.defi || S.defi.etat !== 'jeu'){ clearInterval(S.defiTimer); return; }
      S.defi.chrono--;
      const c = document.getElementById('dchrono');
      if(c){ c.textContent = mmss(Math.max(0, S.defi.chrono)); peindreChrono(c, S.defi.chrono, S.defi.duree); }
      if(S.defi.chrono === 60){ bip(2); }
      if(S.defi.chrono <= 0){ clearInterval(S.defiTimer); bip(4); remettreDefi(); }
    }, 1000);
  }catch(e){ S.defi = { etat:'erreur', id, message:'Vérifiez votre connexion.' }; rendre(); }
}
async function remettreDefi(){
  const d = S.defi; if(!d || d.etat !== 'jeu') return;
  clearInterval(S.defiTimer); d.etat = 'envoi'; rendre();
  try{
    const { data } = await base.rpc('remettre_defi', { p_defi: d.id, p_reponses: d.rep });
    if(!data || !data.ok) throw new Error((data && data.message) || 'envoi');
    S.defi = { ...d, etat:'resultat', score:data.score, sur:data.sur, duree:data.duree, corrige:data.corrige, ...(data.resultat || {}) };
    data.score >= data.sur * 0.7 ? sonJuste() : sonFaux();
    pister('CHALLENGE_DONE', { score:data.score });
    chargerCahier(); chargerJournee();
  }catch(e){ d.etat = 'jeu'; toast('Envoi impossible. Vérifiez votre connexion et réessayez.'); }
  rendre();
}
function lienDefi(id){ return CONTACT.site + '/?defi=' + encodeURIComponent(id); }
/* la feuille corrigée du défi, à l'en-tête Mon Concours */
function feuilleDefi(){
  const d = S.defi; if(!d || !d.questions || !d.corrige) return;
  const moi = (d.classement || []).find(l => l.moi);
  return sortirDocument('Defi ' + (d.matiere || '') + ' ' + (S.util.nom || ''), () => docComplet('Défi · Mon Concours',
    '.q{break-inside:avoid;margin:0 0 9px;font-size:12.5px}.q ol{margin:3px 0 0 22px;padding:0}.q li{margin:1px 0}' +
    '.q li.bonne{color:#0E7A54;font-weight:bold}.q li.mauvaise{color:#B4231C;text-decoration:line-through}' +
    '.res{display:flex;gap:10px;margin-top:14px}.res div{flex:1;border:1px solid #bbb;padding:8px;text-align:center}.res b{display:block;font-size:20px}.res span{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#555}' +
    'table.cl{width:100%;border-collapse:collapse;font-size:12.5px}table.cl th{font:10px Helvetica,Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;text-align:left;border-bottom:2px solid #111;padding:4px 8px}table.cl td{border-bottom:1px solid #ddd;padding:4px 8px}',
    docEntete('Scannez pour relever un défi') +
    '<p class="doc-titre">Défi entre amis</p><p class="doc-st"><b>' + E(S.util.nom || 'Candidat') + '</b> · ' + E(d.matiere || 'toutes matières') + ' · ' + new Date().toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' }) + '</p>' +
    '<div class="res"><div><b>' + (d.score ?? '—') + ' / ' + (d.sur || d.questions.length) + '</b><span>note</span></div><div><b>' + mmssLong(d.duree) + '</b><span>temps</span></div>' +
      (moi ? '<div><b>' + moi.rang + (moi.rang === 1 ? 'er' : 'e') + '</b><span>rang sur ' + (d.participants || (d.classement || []).length) + '</span></div>' : '') + '</div>' +
    ((d.classement || []).length ? '<h2>Classement</h2><table class="cl"><thead><tr><th>Rang</th><th>Nom</th><th>Note</th><th>Temps</th></tr></thead><tbody>' +
      d.classement.map(l => '<tr><td>' + l.rang + '</td><td>' + E(l.nom || l.pseudo) + '</td><td>' + l.score + ' / ' + d.sur + '</td><td>' + mmssLong(l.duree) + '</td></tr>').join('') + '</tbody></table>' : '') +
    '<h2>Le défi corrigé</h2>' +
    d.questions.map((q, i) => {
      const b = d.corrige[i] || [], r = (d.rep || {})[i] || [];
      return '<div class="q"><b>' + (i + 1) + '.</b> ' + E(q.enonce) + '<ol type="a">' + (q.options || []).map((o, k) =>
        '<li class="' + (b.includes(k) ? 'bonne' : (r.includes(k) ? 'mauvaise' : '')) + '">' + E(o) + (b.includes(k) ? ' ✓' : (r.includes(k) ? ' ✗' : '')) + '</li>').join('') + '</ol></div>';
    }).join('') + docPied()));
}
const STATUT_INVITE = { en_attente:'n\'a pas encore répondu', accepte:'a accepté, compose', refuse:'a refusé le défi', termine:'a terminé' };
function ecranDefi(){
  const d = S.defi;
  const tete = `<button class="retourhaut" data-go="aujourdhui">Retour</button>`;
  if(!d){
    if(!S.defiPrep) nouveauDefi();
    const p = S.defiPrep;
    const mats = (S.banque || []).map(m => m.nom);
    if(!S.banque && S.banqueEtat !== 'chargement') chargerQuestions();
    if(p.etape === 1){
      vue().innerHTML = `<div class="pad">${tete}
        <div class="eyebrow">Défier ${p.pseudo ? E(p.pseudo) : 'un ami'} · étape 1 sur 2</div>
        <h1 class="titre">Choisissez les matières</h1>
        <p class="sous" style="margin:6px 0 14px">10 questions en 5 minutes, les mêmes pour tous les invités. Choisissez une ou plusieurs matières, ou toutes.</p>
        <div class="choix-mat">
          <button class="${!p.matieres.length ? 'on' : ''}" data-defi-mat="">Toutes les matières</button>
          ${mats.map(m => `<button class="${p.matieres.includes(m) ? 'on' : ''}" data-defi-mat="${E(m)}" aria-pressed="${p.matieres.includes(m)}">${E(m)}</button>`).join('')}
        </div>
        <button class="cta" style="margin-top:16px" data-defi-etape="2">Continuer</button>
      </div>`;
      return;
    }
    vue().innerHTML = `<div class="pad">${tete}
      <div class="eyebrow">Défier ${p.pseudo ? E(p.pseudo) : 'un ami'} · étape 2 sur 2</div>
      <h1 class="titre">${p.pseudo ? 'Envoyer le défi' : 'Qui voulez-vous défier ?'}</h1>
      <p class="sous" style="margin:6px 0 14px">${p.pseudo ? `<b>${E(p.pseudo)}</b> recevra votre défi dans ses notifications et pourra l'accepter ou le refuser.` : 'Entrez le numéro de téléphone de chaque ami (celui de son compte Mon Concours). Il reçoit une notification sur son téléphone et choisit d\'accepter ou de refuser.'}</p>
      <p class="sous" style="margin:-6px 0 12px;font-size:12.5px">Matières : <b>${p.matieres.length ? E(p.matieres.join(', ')) : 'toutes'}</b> · <button class="lien" style="display:inline;padding:0" data-defi-etape="1">modifier</button></p>
      ${p.pseudo ? '' : `<div class="numeros">
        ${p.numeros.map((n, i) => `<div class="champ num-ami"><label for="num-${i}">Numéro ${i + 1}</label>
          <div class="prefixe"><span class="ind">+226</span><input id="num-${i}" data-defi-num="${i}" type="tel" inputmode="numeric" maxlength="11" placeholder="70 00 00 00" value="${E(n)}" autocomplete="off"></div></div>`).join('')}
        ${p.numeros.length < 10 ? `<button class="lien-mini" data-defi-ajout="1">+ Ajouter un numéro</button>` : ''}
      </div>`}
      <button class="cta" style="margin-top:16px" data-creer-defi="1">${ico('duel',16)} Envoyer le défi</button>
      ${p.pseudo ? '' : `<div class="ou-wa"><span>Votre ami n'a pas encore de compte ?</span>
        <button class="cta wa-btn" data-creer-defi="wa">${logoReseau('whatsapp')} Envoyer le défi sur WhatsApp<small>Il ouvre le lien, crée son compte en 30 secondes et joue</small></button></div>`}
    </div>`;
    return;
  }
  if(d.etat === 'chargement' || d.etat === 'envoi'){ vue().innerHTML = `<div class="pad">${tete}<div class="squelette large" style="margin-top:16px"></div><p class="sous">${d.etat === 'envoi' ? 'Correction…' : 'Préparation du défi…'}</p></div>`; return; }
  if(d.etat === 'envoye'){
    vue().innerHTML = `<div class="pad">${tete}
      <div class="eyebrow">Défi envoyé</div>
      <h1 class="titre">${d.invites ? (d.invites > 1 ? 'Invitations transmises' : 'Invitation transmise') : 'Votre défi est prêt'}</h1>
      ${d.invites ? `<p class="sous" style="margin-top:6px">Ceux qui ont un compte reçoivent une notification. Vous verrez ici qui accepte, qui refuse, et le classement à la fin. Pour un ami sans compte, envoyez-lui le défi sur WhatsApp.</p>` : `<p class="sous" style="margin-top:6px">Envoyez-le sur WhatsApp : votre ami ouvre le lien, crée son compte gratuit et joue les mêmes 10 questions.</p>`}
      <button class="cta wa-btn" style="margin-top:12px" data-partage-defi="${E(d.id)}">${logoReseau('whatsapp')} Envoyer le défi sur WhatsApp</button>
      <button class="cta" style="margin-top:14px" data-defi-ouvrir="${E(d.id)}">Commencer mon défi maintenant</button>
    </div>`;
    return;
  }
  if(d.etat === 'invitation'){
    vue().innerHTML = `<div class="pad">${tete}
      <div class="eyebrow">Défi · ${E(d.matiere || 'toutes matières')}</div>
      <h1 class="titre">${E(d.auteur || 'Un ami')} vous défie</h1>
      <p class="sous" style="margin:8px 0 14px">${d.nb || 10} questions en ${Math.round((d.duree || 300) / 60)} minutes, les mêmes pour tous. Le chronomètre démarre dès que vous acceptez.</p>
      ${d.invitation === 'refuse' ? `<div class="carte"><p class="sous">Vous avez refusé ce défi. Vous pouvez encore changer d'avis.</p></div>` : ''}
      <button class="cta" style="margin-top:12px" data-defi-accepter="${E(d.id)}">Accepter et commencer</button>
      ${d.invitation !== 'refuse' ? `<button class="cta creux" style="margin-top:9px" data-defi-refuser="${E(d.id)}">Refuser</button>` : ''}
    </div>`;
    return;
  }
  if(d.etat === 'connexion'){ vue().innerHTML = `<div class="pad">${tete}<div class="eyebrow">Défi${d.matiere ? ' · ' + E(d.matiere) : ''}</div>
    <h1 class="titre">${d.auteur ? E(d.auteur) + ' vous défie' : 'Un ami vous défie'}</h1>
    <p class="sous" style="margin:8px 0 14px">10 questions, 5 minutes, les mêmes pour tous. Créez votre compte gratuit (trente secondes) pour relever le défi.</p>
    <button class="cta" data-modal="inscription">Créer mon compte et relever le défi</button>
    <button class="cta creux" style="margin-top:9px" data-modal="connexion">J'ai déjà un compte</button></div>`; return; }
  if(d.etat === 'erreur'){ vue().innerHTML = `<div class="pad">${tete}<h1 class="titre">Défi indisponible</h1><p class="sous">${E(d.message || '')}</p><button class="cta" style="margin-top:14px" data-defi-nouveau="1">Lancer un autre défi</button></div>`; return; }
  if(d.etat === 'jeu'){
    vue().innerHTML = `
    <div class="defi-tete"><span class="eyebrow">${d.mien ? 'Votre défi' : 'Défi de ' + E(d.auteur || 'un ami')}${d.matiere ? ' · ' + E(d.matiere) : ''}</span>
      <span class="gr-chrono ${couleurChrono(d.chrono, d.duree)}" id="dchrono">${mmss(Math.max(0, d.chrono))}</span></div>
    <div class="pad" style="padding-top:10px">
      ${(d.questions || []).map((q, i) => `<div class="defi-q">
        <div class="sq-no">Question ${i + 1}</div>
        <div class="qtexte" style="font-size:16px">${E(q.enonce)}</div>
        ${(q.options || []).map((o, k) => `<button class="opt ${(d.rep[i] || []).includes(k) ? 'choisi' : ''}" data-defi-rep="${i}-${k}"><span class="lettre">${'ABCD'[k]}</span>${E(o)}</button>`).join('')}
      </div>`).join('')}
      <button class="cta" style="margin-top:14px" data-defi-remettre="1">Remettre (${Object.keys(d.rep).length}/${(d.questions || []).length} répondues)</button>
    </div>`;
    return;
  }
  /* résultat : classement (podium des trois premiers), invités, corrigé */
  const cl = d.classement || [];
  const podium = cl.filter(l => l.rang <= 3).slice(0, 3);
  const nomL = l => E(l.nom || l.pseudo);
  vue().innerHTML = `<div class="pad">${tete}
    <div class="eyebrow">Défi${d.matiere ? ' · ' + E(d.matiere) : ''}</div>
    ${typeof d.score === 'number' ? `<h1 class="titre">${d.score}/${d.sur} en ${mmssLong(d.duree)}</h1>` : '<h1 class="titre">Résultat du défi</h1>'}
    ${typeof d.score === 'number' ? `<button class="cta wa-btn" style="margin-top:12px" data-partage-defi="${E(d.id)}">${logoReseau('whatsapp')} ${(cl.find(l => l.moi) || {}).rang === 1 && cl.length > 1 ? 'Dire à mes amis que je les ai battus' : 'Défier mes amis avec ce score'}</button>
    <button class="cta creux" style="margin-top:9px" data-carte-resultat="defi">${ico('partage',16)} Ma carte de résultat (image)</button>` : ''}
    ${d.questions && d.corrige ? `<button class="cta creux" style="margin-top:9px" data-defi-feuille="1">${ico('telecharger',16)} Télécharger ma feuille corrigée</button>` : ''}
    ${podium.length ? `<div class="podium" style="margin-top:16px">
      ${podium.map(l => `<div class="marche r${l.rang}${l.moi ? ' moi' : ''}">
        <div class="medaille">${l.rang}</div>
        <div class="av">${E(initialesPseudo(l.nom || l.pseudo))}</div>
        <b>${nomL(l)}${l.moi ? ' (vous)' : ''}</b>
        <div class="note num">${l.score}<small>/${d.sur}</small></div>
        <div class="duree">${mmssLong(l.duree)}</div>
      </div>`).join('')}
    </div>` : ''}
    ${cl.length > 3 ? `<div class="bloc"><div class="libelle">Classement</div><div class="carte">
      ${cl.filter(l => l.rang > 3).map(l => `<div class="ligne-rang${l.moi ? ' moi' : ''}"><span class="p num">${l.rang}</span><span class="n">${nomL(l)}${l.moi ? ' (vous)' : ''}<em>${mmssLong(l.duree)}</em></span><span class="s num">${l.score}/${d.sur}</span></div>`).join('')}
    </div></div>` : ''}
    ${(d.invites || []).length ? `<div class="bloc"><div class="libelle">Invités</div><div class="carte">
      ${d.invites.map(i => `<div class="invite-l"><b>${E(i.nom)}</b><span class="st-${i.statut}">${STATUT_INVITE[i.statut] || ''}</span></div>`).join('')}
    </div></div>` : ''}
    <button class="cta creux" style="margin-top:12px" data-defi-ouvrir="${E(d.id)}">Actualiser le classement</button>
    ${d.corrige && d.questions ? `<div class="bloc"><div class="libelle">Le corrigé</div><div class="carte">${d.questions.map((q, i) => {
        const b = d.corrige[i] || [], r = (d.rep || {})[i] || [];
        const ok = r.length && r.length === b.length && r.every(x => b.includes(x));
        return `<div class="defi-corr ${ok ? 'ok' : 'ko'}"><b>${i + 1}.</b> ${E(q.enonce)}<br><span>${ok ? '✓' : '✗'} Bonne réponse : ${E(b.map(k => (q.options || [])[k]).join(' + '))}</span></div>`;
      }).join('')}</div></div>` : ''}
    <button class="cta creux" style="margin-top:12px" data-defi-nouveau="1">Lancer un nouveau défi</button>
  </div>`;
}

/* ---------- top 10 de la semaine ---------- */
async function chargerTop(){
  if(!base) return;
  try{ const { data } = await base.rpc('top_semaine'); S.top = data || { top:[] }; memoEcrire('top', S.top, true); }catch(e){ if(!S.top) S.top = { erreur:true }; }
  try{ const { data } = await base.rpc('top_general'); S.topG = data || { top:[] }; }catch(e){ if(!S.topG) S.topG = { erreur:true }; }
  if(S.ecran === 'top') rendre();
}
function ecranTop(){
  const gen = (S.topMode || 'general') === 'general';
  const t = gen ? (S.topG || (S.top ? null : null)) : S.top;
  const tete = `<button class="retourhaut" data-go="aujourdhui">Retour</button>`;
  if(!t){ chargerTop(); vue().innerHTML = `<div class="pad">${tete}<div class="squelette large" style="margin-top:16px"></div></div>`; return; }
  vue().innerHTML = `<div class="pad">${tete}
    <div class="eyebrow">${gen ? 'Depuis le début' : 'Depuis lundi'}</div>
    <h1 class="titre">${gen ? 'Classement général' : 'Top 10 de la semaine'}</h1>
    <div class="duo" style="margin:10px 0 12px;gap:8px"><button class="cta ${gen ? '' : 'creux'}" data-top-mode="general">Général</button><button class="cta ${gen ? 'creux' : ''}" data-top-mode="semaine">Cette semaine</button></div>
    <p class="sous" style="margin:6px 0 14px">${gen ? 'Tous les inscrits, classés sur l\'ensemble de leurs points : bonnes réponses, compositions, erreurs refermées. Ta place est ta position réelle parmi tous les inscrits.' : 'Classé par points gagnés cette semaine, parmi tous les inscrits. Remise à zéro chaque lundi.'} Touchez « Défier » pour lancer un défi à l'un d'eux.</p>
    ${t.erreur ? '<p class="sous">Le classement n\'a pas pu être chargé.</p>' : `<div class="carte">
      ${(t.top || []).length ? t.top.map(l => `<div class="ligne-rang${l.moi ? ' moi' : ''}"><span class="p num">${l.rang}</span><span class="n">${E(l.nom || l.pseudo)}${l.moi ? ' (vous)' : ''}<em class="num">${nombreFr(l.points)} pts</em></span>${l.moi ? '' : `<button class="mini btn-defier" data-defier-pseudo="${E(l.pseudo)}">${ico('duel',13)} Défier</button>`}</div>`).join('') : '<p class="sous">Personne n\'a encore marqué de points cette semaine. Soyez le premier.</p>'}
    </div>
    ${t.moi && S.classement && gen ? blocDepasse() : ''}
    ${t.moi ? `<div class="ma-place"><span>Ta place</span><b class="num">${t.moi.rang}<sup>${t.moi.rang === 1 ? 'er' : 'e'}</sup> sur ${nombreFr(t.participants)} inscrits</b><span class="num">${nombreFr(t.moi.points)} pts</span></div>` : ''}`}
    <button class="cta" style="margin-top:14px" data-pourtoi="10">Gagner des points maintenant</button>
  </div>`;
}

/* ---------- proposer une question ---------- */
function ecranProposer(){
  if(!S.banque && S.banqueEtat !== 'chargement') chargerQuestions();
  const mats = (S.banque || []).map(m => m.nom);
  const f = S.prop || (S.prop = { enonce:'', o:['','','',''], bonne:null, expl:'', source:'', matiere:mats[0] || '' });
  vue().innerHTML = `<div class="pad">
    <button class="retourhaut" data-go="aujourdhui">Retour</button>
    <h1 class="titre">Proposer une question</h1>
    <p class="sous" style="margin:6px 0 14px">Tu connais une question tombée au concours, ou une notion qui piège souvent ? Propose-la. L'équipe la vérifie avant de la publier, et tu es prévenu quand elle entre dans la banque.</p>
    ${S.erreur ? `<div class="alerte" role="alert">${E(S.erreur)}</div>` : ''}
    <div class="champ"><label for="p-mat">Matière</label><select id="p-mat" onchange="majProp('matiere',this.value)">${mats.map(m => `<option ${m === f.matiere ? 'selected' : ''}>${E(m)}</option>`).join('')}</select></div>
    <div class="champ"><label for="p-en">La question</label><textarea id="p-en" rows="3" maxlength="400" oninput="majProp('enonce',this.value)" placeholder="Ex. : En quelle année la Haute-Volta est-elle devenue le Burkina Faso ?">${E(f.enonce)}</textarea></div>
    ${[0,1,2,3].map(i => `<div class="champ prop-opt"><label for="p-o${i}">Proposition ${'ABCD'[i]}</label>
      <div class="avec-oeil"><input id="p-o${i}" maxlength="160" value="${E(f.o[i])}" oninput="majPropOpt(${i},this.value)">
      <button class="oeil ${f.bonne === i ? 'bonne' : ''}" data-prop-bonne="${i}" aria-pressed="${f.bonne === i}">${f.bonne === i ? '✓ bonne' : 'bonne ?'}</button></div></div>`).join('')}
    <div class="champ"><label for="p-ex">Explication (facultatif mais précieux)</label><textarea id="p-ex" rows="2" maxlength="600" oninput="majProp('expl',this.value)">${E(f.expl)}</textarea></div>
    <div class="champ"><label for="p-src">Source (facultatif)</label><input id="p-src" maxlength="200" value="${E(f.source)}" oninput="majProp('source',this.value)" placeholder="Ex. : concours ENAREF 2023, Constitution art. 31"></div>
    <button class="cta" data-prop-envoyer="1">Envoyer ma proposition</button>
  </div>`;
}
window.majProp = (k, v) => { S.prop[k] = v; };
window.majPropOpt = (i, v) => { S.prop.o[i] = v; };

/* ---------- mon parcours ---------- */
/* =====================================================================
   Parrainage : 30 amis inscrits avec le lien du candidat = un mois offert
   ===================================================================== */
function ecranParrainage(){
  if(!S.util.connecte){ S.modal = 'connexion'; surcouche(); return ecranCompte(); }
  vue().innerHTML = `<div class="pad">
    <button class="retourhaut" data-go="compte">Retour</button>
    <div class="eyebrow">Parrainage</div>
    <h1 class="titre">Un mois offert pour 30 amis</h1>
    <p class="sous" style="margin-top:6px">Chaque ami qui s'inscrit avec ton lien et commence à réviser est compté. À 30 amis, un mois d'abonnement t'est offert, et ainsi de suite jusqu'à 3 mois.</p>
    <div id="parrain-corps"><div class="squelette large" style="margin-top:14px"></div><div class="squelette"></div></div>
  </div>`;
  chargerParrainage();
}
async function chargerParrainage(){
  if(!base) return;
  let d = null;
  try{ const r = await base.rpc('mon_parrainage'); d = r && r.data; }catch(e){}
  const zone = document.getElementById('parrain-corps'); if(!zone) return;
  if(!d || !d.ok){ zone.innerHTML = '<p class="sous" style="margin-top:14px">Le parrainage n\'est pas disponible pour le moment. Réessaie dans un moment.</p>'; return; }
  const lien = CONTACT.site + '/?r=' + d.code;
  const reste = Math.max(0, d.objectif - (d.comptes % d.objectif || 0));
  const prochain = d.mois_gagnes >= d.mois_max ? null : (d.mois_gagnes + 1) * d.objectif;
  const fait = d.mois_gagnes >= d.mois_max ? d.objectif : (d.comptes - d.mois_gagnes * d.objectif);
  const pct = Math.max(0, Math.min(100, Math.round(fait / d.objectif * 100)));
  const msg = "Je prépare les concours avec Mon Concours : QCM corrigés, compositions nationales chaque semaine, classement. Inscris-toi gratuitement avec mon lien : " + lien;
  zone.innerHTML = `
    <div class="carte" style="margin-top:14px">
      <div class="libelle">Tes amis</div>
      <div style="display:flex;align-items:baseline;gap:8px;margin:6px 0 8px"><b class="num" style="font-size:30px">${nombreFr(Math.max(0, fait))}</b><span class="sous">sur ${d.objectif} pour ${prochain ? 'le prochain mois offert' : 'le maximum atteint'}</span></div>
      <div style="height:10px;border-radius:6px;background:rgba(127,127,127,.25);overflow:hidden"><div style="height:100%;width:${pct}%;background:var(--or,#E3A82B)"></div></div>
      <p class="sous" style="margin-top:8px;font-size:12.5px">${nombreFr(d.inscrits)} inscrit${d.inscrits > 1 ? 's' : ''} avec ton lien, dont ${nombreFr(d.comptes)} compté${d.comptes > 1 ? 's' : ''} (ceux qui ont commencé à réviser).${d.mois_gagnes ? ' Déjà offert : ' + d.mois_gagnes + ' mois.' : ''}${prochain ? ' Il en reste ' + reste + '.' : ''}</p>
    </div>
    <div class="carte" style="margin-top:12px">
      <div class="libelle">Ton lien</div>
      <p class="num" style="margin:6px 0 10px;word-break:break-all;font-size:14px">${E(lien)}</p>
      <a class="cta vert" id="parrain-wa" style="display:block;text-decoration:none" href="https://wa.me/?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">Partager sur WhatsApp<small>Le message est déjà écrit</small></a>
      <button class="cta creux" id="parrain-copie" style="margin-top:9px">Copier mon lien</button>
    </div>`;
  const b = document.getElementById('parrain-copie');
  if(b) b.onclick = async () => {
    try{ await navigator.clipboard.writeText(lien); toast('Lien copié.'); }catch(e){ toast(lien, 8000); }
  };
  const w = document.getElementById('parrain-wa');
  if(w) w.addEventListener('click', () => { try{ pister('REFERRAL_SHARED'); }catch(e){} });
}

function ecranParcours(){
  if(!S.util.connecte){ S.modal = 'connexion'; surcouche(); return ecranCompte(); }
  const st = S.stats || {}, dt = S.details || {};
  const debut = dt.premier_jour || dt.inscrit_le;
  const jours = debut ? Math.max(1, Math.ceil((Date.now() - new Date(debut)) / 86400000)) : null;
  const mats = (dt.par_matiere || []).filter(m => m.n_recent + m.n_avant >= 5);
  vue().innerHTML = `<div class="pad">
    <button class="retourhaut" data-go="compte">Retour</button>
    <div class="eyebrow">Mon parcours</div>
    <h1 class="titre">${debut ? 'Depuis le ' + E(new Date(debut).toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' })) : 'Ton chemin'}</h1>
    ${jours ? `<p class="sous" style="margin-top:6px">${jours} jour${jours > 1 ? 's' : ''} depuis ta première séance.</p>` : ''}
    ${blocNiveauDetail()}
    ${blocChances()}
    ${blocBadges()}

    ${typeof dt.percentile === 'number' ? `<div class="carte" style="margin-top:12px"><div class="libelle" style="margin-bottom:6px">Par rapport aux autres</div>
      <p class="sous">Sur les 30 derniers jours, ta moyenne aux compositions (<b>${dt.moyenne_30j} %</b>) dépasse celle de <b>${dt.percentile} %</b> des candidats de Mon Concours.</p></div>` : ''}
    ${mats.length ? `<div class="bloc"><div class="libelle">Matière par matière</div><div class="carte">
      ${mats.map(m => {
        const evo = (m.taux_recent !== null && m.taux_avant !== null && m.n_avant >= 5 && m.n_recent >= 5) ? m.taux_recent - m.taux_avant : null;
        const err = (m.erreurs_mois_avant >= 3) ? Math.round((m.erreurs_mois - m.erreurs_mois_avant) / m.erreurs_mois_avant * 100) : null;
        return `<div class="mat"><div class="nom">${E(m.matiere)}<em>${m.minutes} min de révision${m.taux_recent !== null ? ' · ' + m.taux_recent + ' % ce mois-ci' : ''}${evo !== null ? ' · <span style="color:' + (evo >= 0 ? 'var(--vert-texte)' : 'var(--rouge-texte)') + '">' + (evo >= 0 ? '+' : '') + evo + ' points</span>' : ''}${err !== null ? ' · erreurs ' + (err <= 0 ? '<span style="color:var(--vert-texte)">' + err + ' %</span>' : '<span style="color:var(--rouge-texte)">+' + err + ' %</span>') + ' sur le mois' : ''}</em></div></div>`;
      }).join('')}
    </div></div>` : ''}
    <button class="cta" style="margin-top:14px" data-carte-progres="1">${ico('partage',16)} Partager ma carte de progression<small>Une image avec ton pseudo et tes chiffres, sans ton nom ni ton numéro</small></button>
  </div>`;
}

/* =====================================================================
   CE QUI FAIT REVENIR : badges, attestations, chances d'admission,
   révision hors ligne.
   ===================================================================== */

/* ---------- élan : jours de travail et chances (un seul appel) ---------- */
async function chargerElan(){
  if(!base || !S.util.connecte) return;
  try{
    const { data } = await base.rpc('mon_elan');
    if(!data) return;
    const ch = !pareil(data, S.elan);
    S.elan = data; memoEcrire('elan', data, true);
    if(ch) rafraichirSiVisible();
    verifierBadges();
  }catch(e){}
}

/* ---------- badges : un tous les 2 ou 3 jours de travail ---------- */
const NOMS_BADGES = { 2:'Premier élan', 4:'Bien parti', 7:'Une semaine', 14:'Deux semaines', 21:'Trois semaines',
  30:'Un mois', 50:'Cinquante jours', 60:'Deux mois', 90:'Trois mois', 100:'Cent jours', 150:'Cent cinquante jours', 200:'Deux cents jours' };
const PALIERS_BADGES = (() => {
  const l = []; let j = 2, pas = 2;
  while(j <= 365){ l.push(j); j += pas; pas = pas === 2 ? 3 : 2; }
  /* les caps ronds s'ajoutent à la suite */
  [7, 14, 21, 30, 50, 60, 90, 100, 150, 200].forEach(x => { if(!l.includes(x)) l.push(x); });
  return l.sort((a, b) => a - b);
})();
const nomBadge = j => NOMS_BADGES[j] || j + ' jours de travail';
function badgesObtenus(){
  const n = (S.elan && S.elan.jours_actifs) || 0;
  return { jours:n, obtenus: PALIERS_BADGES.filter(j => j <= n), suivant: PALIERS_BADGES.find(j => j > n) || null };
}
function verifierBadges(){
  const b = badgesObtenus(), avant = lireReglages().badgesVus;
  ecrireReglage('badgesVus', b.obtenus.length);
  if(typeof avant !== 'number' || b.obtenus.length <= avant) return;
  const dernier = b.obtenus[b.obtenus.length - 1];
  setTimeout(() => { sonDepart(); signalCandidat('Nouveau badge : ' + nomBadge(dernier) + '. ' + dernier + ' jours de travail, bravo !'); }, 900);
  pister('BADGE_EARNED', { jours: dernier });
  if(base) base.rpc('ma_notification', { p_type:'progression', p_titre:'Nouveau badge : ' + nomBadge(dernier),
    p_message:'Vous avez travaillé ' + dernier + ' jours sur Mon Concours. ' + (b.suivant ? 'Prochain badge à ' + b.suivant + ' jours.' : 'Vous avez tous les badges.'),
    p_cle:'progression-badge-' + dernier, p_lien:'parcours' }).then(() => chargerNotifications()).catch(() => {});
}
function blocBadges(){
  if(!S.elan) return '';
  const b = badgesObtenus();
  const montres = b.obtenus.slice(-6);
  const reste = b.suivant ? b.suivant - b.jours : 0;
  return `<div class="carte badges-carte" style="margin-top:12px">
    <div class="libelle" style="margin-bottom:8px">Mes badges<span class="num">${b.obtenus.length}</span></div>
    ${montres.length ? `<div class="badges">${montres.map(j => `<div class="badge-m" title="${E(nomBadge(j))}"><span class="num">${j}</span><i>${E(nomBadge(j))}</i></div>`).join('')}</div>`
      : '<p class="sous">Votre premier badge arrive après 2 jours de travail.</p>'}
    ${b.suivant ? `<p class="sous" style="margin-top:10px">${b.jours} jour${b.jours > 1 ? 's' : ''} de travail. Prochain badge, « ${E(nomBadge(b.suivant))} », dans <b>${reste} jour${reste > 1 ? 's' : ''}</b> de travail.</p>` : ''}
    <p class="sous" style="font-size:12px;margin-top:6px">Un jour compte dès que vous corrigez une question ou faites une composition.</p>
  </div>`;
}

/* ---------- attestation PDF à chaque niveau atteint ---------- */
function attestationNiveau(i){
  const niv = NIVEAUX_C[i]; if(!niv || i < 1) return;
  const n = niveauCandidat(); if(n.i < i) return;
  const v = n.v, st = S.stats || {}, b = badgesObtenus();
  const nom = S.util.nom || (S.journee && S.journee.pseudo) || 'Candidat';
  const date = new Date().toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' });
  const crit = niv.crit(v).map(([k, c, l]) => '<li>' + nombreFr(v[k]) + ' ' + E(l) + ' (seuil : ' + nombreFr(c) + ')</li>').join('');
  pister('CERTIFICATE_DOWNLOADED', { niveau: niv.nom });
  return sortirDocument('Attestation ' + niv.nom + ' ' + nom, () => docComplet('Attestation · Mon Concours',
    '.att{border:3px double #111;padding:26px 30px;margin-top:22px;text-align:center}' +
    '.att .q{font-size:14px;color:#333;margin:0}.att .nom{font-size:28px;font-weight:bold;margin:12px 0 6px;letter-spacing:.02em}' +
    '.att .niv{display:inline-block;margin:14px 0 6px;padding:8px 22px;border:2px solid #0E7A54;color:#0E7A54;font:bold 18px Helvetica,Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase}' +
    '.att ul{list-style:none;padding:0;margin:16px 0 0;font-size:13.5px}.att li{margin:4px 0}' +
    '.sign{display:flex;justify-content:space-between;margin-top:28px;font-size:12.5px;text-align:left}.sign b{display:block;font-size:14px}',
    docEntete('Scannez pour préparer votre concours') +
    '<p class="doc-titre">Attestation de niveau</p><p class="doc-st">Parcours de préparation aux concours directs</p>' +
    '<div class="att"><p class="q">Mon Concours atteste que</p><p class="nom">' + E(nom) + '</p>' +
    '<p class="q">a atteint, par son travail sur la plateforme, le niveau</p><div class="niv">' + E(niv.nom) + '</div>' +
    '<ul>' + crit + '<li>' + b.jours + ' jours de travail · ' + (st.taux_reussite || 0) + ' % de réussite</li></ul>' +
    '<div class="sign"><div>Fait le <b>' + date + '</b></div><div style="text-align:right">L\'équipe <b>Mon Concours</b></div></div></div>' +
    '<p style="font-size:11px;color:#555;margin-top:14px;text-align:center">Attestation de travail personnel sur la plateforme. Elle ne remplace pas un diplôme ni une admission.</p>' +
    docPied()));
}
function blocAttestations(){
  if(!S.stats) return '';
  const n = niveauCandidat();
  const atteints = NIVEAUX_C.map((x, i) => i).filter(i => i >= 1 && i <= n.i);
  if(!atteints.length) return `<p class="sous" style="margin-top:10px;font-size:12px">Une attestation PDF à votre nom est offerte à chaque niveau atteint, dès « ${E(NIVEAUX_C[1].nom)} ».</p>`;
  return atteints.map(i => `<button class="cta creux" style="margin-top:10px" data-attestation="${i}">${ico('telecharger',16)} Mon attestation « ${E(NIVEAUX_C[i].nom)} »<small>Un PDF à votre nom, à garder ou à montrer</small></button>`).join('');
}

/* ---------- chances d'admission ---------- */
function blocChances(){
  const c = S.elan && S.elan.chances;
  if(!S.elan) return '';
  if(!c) return `<div class="carte chances" style="margin-top:12px"><div class="libelle" style="margin-bottom:6px">Mes chances d'admission</div>
    <p class="sous">Faites une composition complète : vos chances s'afficheront ici, comparées aux résultats de la dernière composition nationale.</p>
    <button class="cta creux" style="margin-top:10px" data-go="aujourdhui">Composer</button></div>`;
  const nbc = c.compositions + ' dernière' + (c.compositions > 1 ? 's' : '') + ' composition' + (c.compositions > 1 ? 's' : '');
  if(!c.statut) return `<div class="carte chances" style="margin-top:12px"><div class="libelle" style="margin-bottom:6px">Mes chances d'admission</div>
    <p class="sous">Sur vos ${nbc}, vous avez en moyenne <b class="num">${c.note}/${c.sur}</b> (${c.pourcentage} %). Après la première composition nationale, vous verrez où cette moyenne vous classerait.</p></div>`;
  const phrase = { admis:'vous seriez <b>admis</b>', attente:'vous seriez sur la <b>liste d\'attente</b>', echoue:'vous ne seriez <b>pas admis</b>' }[c.statut];
  const conseil = c.statut === 'admis' ? 'Gardez ce niveau jusqu\'au jour J : refaites une composition chaque semaine.'
    : 'Chaque erreur reprise vous rapproche des places : commencez par « Mes erreurs ».';
  return `<div class="carte chances sn-${c.statut}" style="margin-top:12px"><div class="libelle" style="margin-bottom:6px">Mes chances d'admission</div>
    <p class="chances-phrase">Avec <b class="num">${c.note}/${c.sur}</b> de moyenne sur vos ${nbc}, ${phrase}${c.concours ? ' à la composition nationale « ' + E(c.concours) + ' »' : ''} : ${c.rang}<sup>${c.rang === 1 ? 'er' : 'e'}</sup> sur ${c.participants} candidats, pour ${c.places} postes à pourvoir.</p>
    <p class="sous" style="margin-top:8px">${conseil}</p>
    <p class="sous" style="font-size:12px;margin-top:6px">Une estimation, pas une promesse : elle compare votre moyenne aux notes de la dernière composition nationale.</p></div>`;
}

/* ---------- révision hors ligne ----------
   Un pack de questions avec leurs corrigés, gardé sur le téléphone. On
   révise sans réseau ; au retour du réseau, les réponses sont renvoyées et
   recorrigées par le serveur (erreurs, points et série comptent). */
const CLE_PACK = 'monconcours.pack';
function lirePack(){ try{ return JSON.parse(localStorage.getItem(CLE_PACK) || 'null'); }catch(e){ return null; } }
function ecrirePack(p){ try{ if(p) localStorage.setItem(CLE_PACK, JSON.stringify(p)); else localStorage.removeItem(CLE_PACK); }catch(e){ toast('Le téléphone manque de place pour garder le pack.'); } }
const enAttentePack = p => p ? Object.keys(p.faites || {}).filter(id => !(p.envoyees || []).includes(id)) : [];
async function telechargerPack(){
  if(!S.util.connecte){ S.modal = 'inscription'; S.erreur = ''; return surcouche(); }
  if(!exigerAbonnement('Les packs de questions hors connexion font partie de l\'abonnement.', 'pack')) return;
  if(!navigator.onLine){ toast('Il faut du réseau (ou du Wi-Fi) pour télécharger le pack.'); return; }
  const ancien = lirePack();
  if(ancien && enAttentePack(ancien).length) await envoyerPack();
  S.packEtat = 'chargement'; rendre();
  try{
    const { data, error } = await base.rpc('pack_hors_ligne', { p_niveau: niveauCand(), p_matieres: null, p_nombre: 30 });
    if(error) throw error;
    if(!data || !data.ok){ S.packEtat = null; toast((data && data.message) || 'Pack indisponible pour le moment.', 5000); return rendre(); }
    if(!(S.gratuit || estAbonne())) ecrireReglage('pack_gratuit_pris', true);
    ecrirePack({ cree_le: data.cree_le, niveau: niveauCand(), questions: data.questions, faites:{}, envoyees:[], i:0 });
    S.packEtat = null; S.packRep = undefined;
    pister('OFFLINE_PACK_DOWNLOADED', { n: data.questions.length });
    toast(data.questions.length + ' questions gardées sur votre téléphone. Elles marchent sans réseau.', 5000);
    rendre();
  }catch(e){ S.packEtat = null; toast(enFrancais(e, 'Téléchargement impossible. Réessayez avec du réseau.')); rendre(); }
}
let envoiPackEnCours = false;
async function envoyerPack(){
  const p = lirePack(); const ids = enAttentePack(p);
  if(!ids.length || !base || !S.util.connecte || !navigator.onLine || envoiPackEnCours) return;
  envoiPackEnCours = true;
  try{
    const lot = ids.slice(0, 150).map(id => ({ q:id, choix:p.faites[id].choix, t:p.faites[id].t }));
    const { data, error } = await base.rpc('remettre_hors_ligne', { p_reponses: lot });
    if(error || !data || !data.ok) throw error || new Error('envoi');
    const q = lirePack() || p; q.envoyees = Array.from(new Set([...(q.envoyees || []), ...lot.map(x => x.q)])); ecrirePack(q);
    if(data.enregistrees) toast(data.enregistrees + ' réponse' + (data.enregistrees > 1 ? 's' : '') + ' faite' + (data.enregistrees > 1 ? 's' : '') + ' hors ligne envoyée' + (data.enregistrees > 1 ? 's' : '') + '.');
    chargerProgressionDiscrete();
  }catch(e){}
  envoiPackEnCours = false;
}
function chargerProgressionDiscrete(){ try{ chargerProgression(); }catch(e){} }
window.addEventListener('online', () => setTimeout(envoyerPack, 1500));
function questionPack(p){
  const i = (p.questions || []).findIndex(q => !p.faites[q.id]);
  return i < 0 ? null : { q:p.questions[i], i };
}
/* Les cours, gratuits : lus sans réseau, ou téléchargés en PDF */
function blocCoursHL(){
  const liste = (S.ressources || []).filter(r => r.texte && r.type_ressource !== 'annale');
  const mats = []; liste.forEach(r => { if(!mats.includes(r.matiere)) mats.push(r.matiere); });
  const pret = lireReglages().cours_hors_ligne;
  return `<div class="bloc">
    <div class="libelle">Les cours</div>
    <div class="carte">
      <p class="sous" style="margin:0 0 10px">${mats.length
        ? (S.gratuit || estAbonne()
            ? 'Tous les cours de votre niveau sont gardés sur le téléphone dès que vous êtes en ligne : vous les lisez sans réseau. Vous pouvez aussi en télécharger un en PDF.'
            : 'Les deux premiers cours de chaque niveau sont gardés sur le téléphone : vous les lisez sans réseau et vous les téléchargez en PDF. Les autres cours font partie de l\'abonnement.')
        : (S.ressources ? 'Aucun cours n\'est encore publié pour ce niveau.' : 'Chargement des cours…')}</p>
      ${(pret || mats.length) ? `<p class="sous" style="margin:0 0 10px;font-size:12.5px"><b>${mats.length ? '✓ Cours disponibles hors ligne' + (S.gratuit || estAbonne() ? '' : ' : les ' + COURS_OFFERTS + ' premiers') : ''}</b></p>` : ''}
      ${mats.map(nom => {
        const n = liste.filter(r => r.matiere === nom).length;
        return `<div class="mat"><div class="nom">${E(nom)}<em>${n} chapitre${n > 1 ? 's' : ''}</em></div>
          <div class="paire" style="display:flex;gap:6px"><button class="mini" data-matiere="${encodeURIComponent(nom)}">Lire</button>
          <button class="mini" data-telecharger-mat="${encodeURIComponent(nom)}">${coursOuvert(nom) ? '' : ico('cadenas',12) + ' '}PDF</button></div></div>`;
      }).join('')}
    </div>
  </div>`;
}
/* Les QCM sans connexion : réservés à l'abonnement */
function blocQcmHL(p, enLigne, termine){
  const libre = packGratuitDispo();
  if(!libre) return `<div class="bloc">
    <div class="libelle">Les QCM sans connexion · abonnement</div>
    <div class="carte">
      <p class="sous" style="margin:0 0 12px">Gardez 30 questions corrigées sur votre téléphone et révisez sans réseau, dans le bus comme au village. Cette option fait partie de l'abonnement.</p>
      <button class="cta" data-pack-telecharger="1">${ico('cadenas',16)} Débloquer les packs hors ligne</button>
    </div></div>`;
  return `<div class="bloc">
    <div class="libelle">Les QCM sans connexion</div>
    <div class="carte">
      <p class="sous" style="margin:0 0 10px">${termine ? 'Votre pack est terminé.' : 'Téléchargez un pack de 30 questions de votre niveau, avec leurs corrections, quand vous avez du réseau. Vos réponses partent toutes seules au retour du réseau.'}</p>
      <button class="cta" data-pack-telecharger="1" ${S.packEtat === 'chargement' || !enLigne ? 'disabled' : ''}>${S.packEtat === 'chargement' ? '<span class="spin"></span> Téléchargement…' : ico('telecharger',16) + (termine ? ' Télécharger un nouveau pack' : ' Télécharger mon pack')}</button>
      ${!enLigne ? '<p class="sous" style="margin-top:10px">Vous êtes hors ligne : le pack se télécharge quand vous avez du réseau.</p>' : ''}
    </div></div>`;
}
/* Les packs hors ligne font partie de l'abonnement. */
const packGratuitDispo = () => S.gratuit || estAbonne();
function ecranHorsLigne(){
  const p = lirePack();
  const enLigne = navigator.onLine;
  const attente = enAttentePack(p).length;
  if(!p){
    vue().innerHTML = `<div class="pad">
      <button class="retourhaut" data-go="revisions">Retour</button>
      <div class="eyebrow">Révision hors ligne</div>
      <h1 class="titre">Réviser sans connexion</h1>
      <p class="sous" style="margin-top:8px">Une partie du travail se fait sans réseau : lire les cours, et faire des QCM.</p>
      ${blocCoursHL()}
      ${blocQcmHL(null, enLigne, false)}
    </div>`;
    return;
  }
  const total = p.questions.length, faites = Object.keys(p.faites).length;
  const justes = Object.values(p.faites).filter(x => x.ok).length;
  const cid = S.packCourant && S.packCourant.id, ci = cid ? p.questions.findIndex(x => x.id === cid) : -1;
  const cur = ci >= 0 && p.faites[cid] ? { q:p.questions[ci], i:ci } : questionPack(p);
  const etat = `<div class="pack-etat"><span><b class="num">${faites}</b> / ${total} faites · <b class="num">${justes}</b> juste${justes > 1 ? 's' : ''}</span>
    <span class="${enLigne ? 'en-ligne' : 'hors-ligne'}">${enLigne ? (attente ? attente + ' à envoyer' : 'Tout est envoyé') : 'Hors ligne' + (attente ? ' · ' + attente + ' en attente' : '')}</span></div>`;
  if(cur && !S.packOuvert){
    const reste = total - faites;
    vue().innerHTML = `<div class="pad">
      <button class="retourhaut" data-go="revisions">Retour</button>
      <div class="eyebrow">Révision hors ligne</div>
      <h1 class="titre">Réviser sans connexion</h1>
      <p class="sous" style="margin-top:8px">Une partie du travail se fait sans réseau : lire les cours, et faire des QCM.</p>
      ${blocCoursHL()}
      <div class="bloc"><div class="libelle">Les QCM sans connexion</div><div class="carte">
        ${etat}
        <button class="cta" style="margin-top:12px" data-pack-ouvrir="1">Continuer mon pack<small>${reste} question${reste > 1 ? 's' : ''} restante${reste > 1 ? 's' : ''}</small></button>
      </div></div>
    </div>`;
    return;
  }
  if(!cur){
    vue().innerHTML = `<div class="pad">
      <button class="retourhaut" data-go="revisions">Retour</button>
      <div class="eyebrow">Révision hors ligne</div>
      <h1 class="titre">Pack terminé</h1>
      ${etat}
      <div class="cachet-note ${justes / total >= .5 ? 'admis' : ''}" style="margin-top:14px"><div class="n num">${justes} / ${total}</div><div class="l">bonnes réponses</div></div>
      <p class="sous" style="margin-top:12px">${attente ? (enLigne ? 'Vos réponses partent maintenant.' : 'Vos réponses partiront au retour du réseau : vos erreurs rejoindront « Mes erreurs ».') : 'Vos réponses sont enregistrées : vos erreurs sont dans « Mes erreurs ».'}</p>
      ${blocQcmHL(p, enLigne, true)}
      ${blocCoursHL()}
      ${attente && enLigne ? '<button class="cta creux" style="margin-top:9px" data-pack-envoyer="1">Envoyer mes réponses</button>' : ''}
    </div>`;
    if(attente && enLigne) envoyerPack();
    return;
  }
  const q = cur.q, rep = p.faites[q.id];
  const bonnes = q.bonnes || [];
  vue().innerHTML = `<div class="qzone">
    <button class="retourhaut" data-go="revisions" style="margin-bottom:12px">Retour</button>
    ${etat}
    <div class="qmeta"><span>HORS LIGNE · ${E((q.matiere || '').toUpperCase())}</span><span>${cur.i + 1} / ${total}</span></div>
    <div class="qtexte">${E(q.enonce)}</div>
    ${(q.options || []).map((o, i) => {
      let c = '';
      if(rep){ if(bonnes.includes(i)) c = 'juste'; else if(rep.choix.includes(i)) c = 'faux'; }
      return `<button class="opt ${c}" ${rep ? 'disabled' : ''} data-pack-rep="${i}"><span class="lettre">${'ABCDEFGH'[i]}</span>${E(o)}</button>`;
    }).join('')}
    ${rep ? `<div class="retour ${rep.ok ? 'bien' : 'mal'}"><b>${rep.ok ? 'Juste' : 'Pas tout à fait'}</b>${q.explication ? E(q.explication) : ''}</div>
      <button class="cta" style="margin-top:14px" data-pack-suivante="1">Question suivante</button>` : ''}
  </div>`;
  S.packCourant = q; S.packDebut = S.packDebut || Date.now();
}
function repondrePack(i){
  const p = lirePack(); if(!p) return;
  const q = S.packCourant; if(!q || p.faites[q.id]) return;
  const ok = (q.bonnes || []).length === 1 && q.bonnes[0] === i;
  p.faites[q.id] = { choix:[i], ok, t: Math.min(300000, Date.now() - (S.packDebut || Date.now())) };
  ecrirePack(p);
  try{ ok ? sonJuste() : sonFaux(); }catch(e){}
  rendre();
  if(navigator.onLine) envoyerPackBientot();
}
let minuteurPack = null;
function envoyerPackBientot(){ clearTimeout(minuteurPack); minuteurPack = setTimeout(envoyerPack, 8000); }
function carteHorsLigne(){
  const p = lirePack();
  const reste = p ? p.questions.length - Object.keys(p.faites).length : 0;
  return `<button class="hl-carte" data-go="horsligne">
    <span class="ic">${ico('telecharger',18)}</span>
    <span class="co"><b>Réviser sans connexion</b><span>${p && reste ? reste + ' question' + (reste > 1 ? 's' : '') + ' de votre pack, utilisables hors ligne' : 'Les cours et les QCM, même sans réseau'}</span></span>
  </button>`;
}
document.addEventListener('click', ev => {
  const t = ev.target.closest('[data-pack-telecharger],[data-pack-ouvrir],[data-pack-rep],[data-pack-suivante],[data-pack-envoyer],[data-attestation]');
  if(!t) return;
  const d = t.dataset;
  if(d.packTelecharger) return telechargerPack();
  if(d.packOuvrir){ S.packOuvert = true; rendre(); window.scrollTo(0, 0); return; }
  if(d.packRep !== undefined) return repondrePack(Number(d.packRep));
  if(d.packSuivante){ S.packCourant = null; S.packDebut = Date.now(); rendre(); window.scrollTo(0, 0); return; }
  if(d.packEnvoyer) return envoyerPack();
  if(d.attestation) return attestationNiveau(Number(d.attestation));
});

/* ---------- carte de progression à partager (image) ---------- */
async function carteProgression(){
  const st = S.stats || {}, j = S.journee || {}, n = niveauCandidat();
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1080;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 1080); g.addColorStop(0, '#0F241C'); g.addColorStop(1, '#0C1512');
  x.fillStyle = g; x.fillRect(0, 0, 1080, 1080);
  x.fillStyle = '#E3A82B'; x.font = '700 40px Helvetica, Arial, sans-serif'; x.fillText('MON CONCOURS', 80, 130);
  x.fillStyle = '#A2B2AA'; x.font = '32px Helvetica, Arial, sans-serif'; x.fillText('Ma préparation aux concours directs', 80, 180);
  x.fillStyle = '#E9EEEA'; x.font = '800 84px Helvetica, Arial, sans-serif'; x.fillText(j.pseudo || 'Candidat', 80, 320);
  x.fillStyle = '#4FC28F'; x.font = '600 46px Helvetica, Arial, sans-serif'; x.fillText('Niveau : ' + n.nom, 80, 400);
  const cases = [[nombreFr(st.questions_resolues || 0), 'questions'], [(st.taux_reussite || 0) + ' %', 'de réussite'], [String(st.serie || 0), 'jours d\'affilée'], [String(st.compositions || 0), 'compositions']];
  cases.forEach(([v, l], i) => {
    const cx = 80 + (i % 2) * 470, cy = 480 + Math.floor(i / 2) * 230;
    x.fillStyle = '#14211C'; x.strokeStyle = '#26372F'; x.lineWidth = 3;
    x.beginPath(); x.roundRect(cx, cy, 440, 200, 28); x.fill(); x.stroke();
    x.fillStyle = '#E9EEEA'; x.font = '800 76px Helvetica, Arial, sans-serif'; x.fillText(v, cx + 36, cy + 105);
    x.fillStyle = '#A2B2AA'; x.font = '34px Helvetica, Arial, sans-serif'; x.fillText(l, cx + 36, cy + 160);
  });
  x.fillStyle = '#E3A82B'; x.font = '700 44px Helvetica, Arial, sans-serif'; x.fillText('monconcoursbf.com', 80, 1010);
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  const fichier = new File([blob], 'ma-progression-mon-concours.png', { type:'image/png' });
  pister('PROGRESS_CARD_SHARED');
  try{
    if(navigator.canShare && navigator.canShare({ files:[fichier] })){
      await navigator.share({ files:[fichier], title:'Ma progression', text:'Je prépare mon concours sur Mon Concours : ' + CONTACT.site });
      return;
    }
  }catch(e){ return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fichier.name; a.click();
  toast('Image enregistrée : partage-la sur ton statut WhatsApp.');
}

/* ---------- carte de résultat à partager (image) ----------
   Une image 1080 × 1350, prête pour WhatsApp et Facebook : la note,
   le rang quand il existe, le logo et le QR code du site. */
/* vieux téléphones : le dessin des coins arrondis n'existe pas toujours */
if(window.CanvasRenderingContext2D && !CanvasRenderingContext2D.prototype.roundRect){
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r){
    r = Math.min(+r || 0, w / 2, h / 2);
    this.moveTo(x + r, y); this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r); this.closePath(); return this;
  };
}
function chargerImage(src){
  return new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = src; });
}
function texteAjuste(x, t, px, poids, largeurMax){
  let taille = px;
  do { x.font = `${poids} ${taille}px Helvetica, Arial, sans-serif`; taille -= 2; } while(x.measureText(t).width > largeurMax && taille > 20);
}
function donneesCarte(type){
  const pseudo = (S.journee && S.journee.pseudo) || (S.util.nom || 'Candidat').split(/\s+/)[0];
  const date = new Date().toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' });
  if(type === 'nationale'){
    const c = S.classementEp; if(!c || !c.moi) return null;
    const m = c.moi;
    return { pseudo: m.nom || pseudo, tete: 'Composition nationale (simulation)', sous: c.concours || c.titre || '',
      note: m.score, sur: m.sur, rang: m.rang, sur_rang: c.participants, statut: STATUTS[m.statut] || '', statutCle: m.statut,
      date: jourFr(c.debut_le), lien: CONTACT.site, appel: prochaineNat() ? 'Prochaine composition : ' + prochaineNat() : 'Prochaine composition nationale bientôt' };
  }
  if(type === 'defi'){
    const d = S.defi; if(!d || typeof d.score !== 'number') return null;
    const moi = (d.classement || []).find(l => l.moi);
    return { pseudo, tete: 'Défi entre amis', sous: d.matiere || 'Toutes matières', note: d.score, sur: d.sur,
      rang: moi && (d.classement || []).length > 1 ? moi.rang : null, sur_rang: (d.classement || []).length,
      statut: moi && moi.rang === 1 && (d.classement || []).length > 1 ? 'EN TÊTE' : '', statutCle: 'admis',
      date, lien: lienDefi(d.id), appel: 'Fais mieux que moi : relève le défi' };
  }
  if(type === 'copie'){
    if(!S.grille || !S.grille.length) return null;
    const n = S.grilleNote ?? 0, admis = S.seuil !== null && S.seuil !== undefined && n >= S.seuil;
    return { pseudo, tete: 'Composition corrigée', sous: S.concours || 'Concours direct', note: n, sur: S.grille.length,
      rang: null, statut: admis ? 'AU-DESSUS DU SEUIL' : '', statutCle: 'admis', date, lien: CONTACT.site, appel: 'Prépare ton concours gratuitement' };
  }
  return null;
}
async function carteResultat(type){
  const k = donneesCarte(type); if(!k){ toast('Résultat indisponible pour le moment.'); return; }
  const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0F2A1F'); g.addColorStop(1, '#0B1511');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  /* bande or en haut, comme l'en-tête des feuilles */
  x.fillStyle = '#E3A82B'; x.fillRect(0, 0, W, 14);
  try{ const logo = await chargerImage('/icone-192.png'); x.drawImage(logo, 80, 70, 104, 104); }catch(e){}
  x.fillStyle = '#E3A82B'; x.font = '700 46px Helvetica, Arial, sans-serif'; x.fillText('MON CONCOURS', 210, 122);
  x.fillStyle = '#A2B2AA'; x.font = '28px Helvetica, Arial, sans-serif'; x.fillText('Concours directs du Burkina Faso', 210, 162);
  /* l'épreuve */
  x.fillStyle = '#4FC28F'; texteAjuste(x, k.tete.toUpperCase(), 34, 700, W - 160); x.fillText(k.tete.toUpperCase(), 80, 280);
  x.fillStyle = '#E9EEEA'; texteAjuste(x, k.sous, 52, 700, W - 160); x.fillText(k.sous, 80, 345);
  /* la note, en grand */
  x.fillStyle = '#14231D'; x.strokeStyle = '#2A3D34'; x.lineWidth = 3;
  x.beginPath(); x.roundRect(80, 400, W - 160, 420, 36); x.fill(); x.stroke();
  x.textAlign = 'center';
  x.fillStyle = '#A2B2AA'; x.font = '30px Helvetica, Arial, sans-serif'; x.fillText('Note de ' + k.pseudo, W / 2, 470);
  x.fillStyle = '#FFFFFF'; x.font = '800 200px Helvetica, Arial, sans-serif'; x.fillText(String(k.note), W / 2 - 40, 680);
  const lNote = x.measureText(String(k.note)).width;
  x.textAlign = 'left'; x.fillStyle = '#A2B2AA'; x.font = '700 80px Helvetica, Arial, sans-serif'; x.fillText('/' + k.sur, W / 2 - 40 + lNote / 2 + 8, 680);
  x.textAlign = 'center';
  if(k.rang){
    x.fillStyle = '#E9EEEA'; x.font = '600 44px Helvetica, Arial, sans-serif';
    x.fillText(`${k.rang}${k.rang === 1 ? 'er' : 'e'} sur ${k.sur_rang}`, W / 2, 770);
  } else {
    x.fillStyle = '#A2B2AA'; x.font = '36px Helvetica, Arial, sans-serif'; x.fillText(k.date, W / 2, 770);
  }
  /* le cachet (admis, attente…) */
  if(k.statut){
    const coul = k.statutCle === 'admis' ? '#4FC28F' : k.statutCle === 'attente' ? '#E3A82B' : '#C2392E';
    x.save(); x.translate(W / 2, 900); x.rotate(-0.05);
    x.font = '800 54px Helvetica, Arial, sans-serif'; const lw = x.measureText(k.statut).width + 80;
    x.strokeStyle = coul; x.lineWidth = 7; x.beginPath(); x.roundRect(-lw / 2, -54, lw, 92, 16); x.stroke();
    x.fillStyle = coul; x.fillText(k.statut, 0, 14); x.restore();
  }
  if(k.rang){ x.fillStyle = '#7F918A'; x.font = '30px Helvetica, Arial, sans-serif'; x.fillText(k.date, W / 2, 1005); }
  x.textAlign = 'left';
  /* le pied : QR code, adresse, appel à jouer */
  try{
    const qr = await chargerImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(QR_FEUILLE.replace('width="78" height="78"', 'width="220" height="220"')));
    x.fillStyle = '#FFFFFF'; x.beginPath(); x.roundRect(W - 80 - 236, H - 80 - 236, 236, 236, 18); x.fill();
    x.drawImage(qr, W - 80 - 228, H - 80 - 228, 220, 220);
  }catch(e){}
  x.fillStyle = '#E3A82B'; texteAjuste(x, k.appel, 40, 700, W - 160 - 270); x.fillText(k.appel, 80, H - 200);
  x.fillStyle = '#E9EEEA'; x.font = '600 36px Helvetica, Arial, sans-serif'; x.fillText('monconcoursbf.com', 80, H - 145);
  x.fillStyle = '#7F918A'; x.font = '28px Helvetica, Arial, sans-serif'; x.fillText('Gratuit · scannez le code', 80, H - 98);
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  const fichier = new File([blob], 'mon-resultat-mon-concours.png', { type:'image/png' });
  const texte = type === 'defi' ? texteDefiWhatsapp(S.defi) : `${k.tete} sur Mon Concours : ${k.note}/${k.sur}${k.rang ? `, ${k.rang}${k.rang === 1 ? 'er' : 'e'} sur ${k.sur_rang}` : ''}. ${k.appel} : ${k.lien}`;
  pister('RESULT_CARD_SHARED', { type });
  try{
    if(navigator.canShare && navigator.canShare({ files:[fichier] })){
      await navigator.share({ files:[fichier], title:'Mon résultat', text: texte });
      return;
    }
  }catch(e){ if(e && e.name === 'AbortError') return; }
  enregistrerBlob(blob, fichier.name);
  toast('Image enregistrée : publiez-la sur votre statut WhatsApp ou sur Facebook.');
}

/* ---------- concours visé ---------- */
async function chargerMonConcours(){
  if(!base || !S.util.connecte) return;
  try{
    const { data } = await base.rpc('mon_concours');
    S.monConcours = data || null;
    const c = data && data.choisi;
    if(c && c.date_ecrit){ S.dateConcours = c.date_ecrit; S.nomConcours = c.sigle || c.nom; }
    rafraichirSiVisible();
  }catch(e){}
}
function blocConcoursVise(){
  const m = S.monConcours; if(!m) return '';
  const id = m.choisi ? m.choisi.id : '';
  return `<div class="carte" style="margin-top:14px;text-align:left">
    <div class="libelle" style="margin-bottom:8px">${ico('cible',14)} Mon concours visé</div>
    <select id="concours-vise" onchange="choisirConcours(this.value)" aria-label="Concours visé">
      <option value="">— choisir —</option>
      ${(m.liste || []).map(c => `<option value="${E(c.id)}" ${c.id === id ? 'selected' : ''}>${E(c.nom)}</option>`).join('')}
    </select>
    <p class="sous" style="margin-top:8px;font-size:12.5px">${m.choisi && m.choisi.date_ecrit ? 'Écrit le ' + E(new Date(m.choisi.date_ecrit).toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' })) + ' : le compte à rebours de l\'accueil le suit.' : 'Le compte à rebours de l\'accueil suivra la date de ce concours dès qu\'elle est publiée.'}</p>
  </div>`;
}
window.choisirConcours = async function(id){
  try{
    const { data } = await base.rpc('definir_concours', { p_concours: id || null });
    if(data && data.ok){ toast('Concours visé enregistré.'); pister('TARGET_EXAM_SET'); chargerMonConcours(); }
  }catch(e){ toast('Non enregistré : vérifie ta connexion.'); }
};

/* ---------- installer l'application ---------- */
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); S.installer = e; if(S.ecran === 'aujourdhui') rendre(); });
window.addEventListener('appinstalled', () => { S.installer = null; pister('APP_INSTALLED'); });

/* ---------- export du cahier d'erreurs ---------- */
function exporterCahier(){
  if(!exigerAbonnement('Le cahier d\'erreurs en PDF fait partie de l\'abonnement.', 'cahier_pdf')) return;
  if(!S.cahier.some(e => e.suite < 3)){ toast('Ton cahier est vide.'); return; }
  pister('ERRORS_EXPORTED', { n: S.cahier.filter(e => e.suite < 3).length });
  return sortirDocument('Cahier d erreurs ' + (S.util.nom || ''), htmlCahier);
}
function lireCahier(){
  if(!S.cahier.some(e => e.suite < 3)){ toast('Ton cahier est vide.'); return; }
  pister('ERRORS_READ_INLINE');
  lireDocument('Mon cahier d\'erreurs', htmlCahier(), 'cahier', exporterCahier);
}
function htmlCahier(){
  const list = S.cahier.filter(e => e.suite < 3);
  return docComplet('Mon cahier d\'erreurs',
    '.e{break-inside:avoid;border-bottom:1px solid #ccc;padding:9px 0;font-size:13px}' +
    '.m{font:11px Helvetica,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#666}.b{color:#0E7A54;font-weight:bold}.n{font-style:italic;color:#444}',
    docEntete() +
    '<p class="doc-titre">Cahier d\'erreurs</p><p class="doc-st">' + E(S.util.nom || '') + ' · ' + list.length + ' erreur' + (list.length > 1 ? 's' : '') + ' non traitée' + (list.length > 1 ? 's' : '') + ' · ' + new Date().toLocaleDateString('fr-FR') + '</p>' +
    list.map((e, i) => '<div class="e"><div class="m">' + E(e.matiere || '') + ' · ratée ' + e.rate + ' fois</div><b>' + (i + 1) + '.</b> ' + E(e.q) +
      '<br>Bonne réponse : <span class="b">' + E(e.bon) + '</span>' + (e.note ? '<br>' + E(e.note) : '') +
      (e.notePerso ? '<br><span class="n">Ma note : ' + E(e.notePerso) + '</span>' : '') + '</div>').join('') +
    docPied());
}

/* ---------- mode concentration et plein écran ---------- */
function appliquerConcentration(){ document.body.classList.toggle('concentration', !!S.concentration && ['qcm','pourtoi','reprise','defi','notion'].includes(S.ecran)); }
/* Plein écran automatique à l'entrée en composition (silencieux si le téléphone le refuse) */
function pleinEcranAuto(){
  try{
    if(document.fullscreenElement || !document.documentElement.requestFullscreen) return;
    const p = document.documentElement.requestFullscreen({ navigationUI:'hide' });
    if(p && p.catch) p.catch(() => {});
  }catch(e){}
}
function basculerPleinEcran(){
  try{
    if(document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen({ navigationUI:'hide' }).catch(() => toast('Le plein écran n\'est pas disponible sur ce téléphone.'));
  }catch(e){ toast('Le plein écran n\'est pas disponible sur ce téléphone.'); }
}
document.addEventListener('fullscreenchange', () => { if(S.ecran === 'grille' && !S.corrige) ecranGrille(); });

/* ---------- tirer vers le bas pour actualiser, comme sur les autres applications ---------- */
const SANS_ACTUALISER = ['grille','qcm','test','testIntro','engagement','reprise','pourtoi','defi','lecteur','resultat','verrou','verrou_d','paiement','inscription','connexion','proposer','lecture'];
async function actualiserTout(){
  const tout = [];
  const lance = f => { try{ const r = f(); if(r && r.then) tout.push(r.catch(() => {})); }catch(e){} };
  if(base){
    lance(chargerNotifications); lance(chargerActualites);
    if(S.util.connecte){
      lance(chargerProgression); lance(chargerJournee); lance(chargerDetails); lance(chargerCahier);
      lance(chargerEpreuve); lance(chargerCompositions); lance(chargerRappel); lance(chargerMonConcours);
    }
    if(S.ecran === 'qdj') lance(chargerQdj);
  }
  await Promise.race([Promise.all(tout), new Promise(r => setTimeout(r, 4000))]);
  rendre();
}
(function(){
  let y0 = null, x0 = null, tire = 0, bande = null;
  const indic = () => {
    if(bande) return bande;
    bande = document.createElement('div'); bande.id = 'tirer-actualiser'; bande.setAttribute('aria-hidden', 'true');
    bande.innerHTML = '<i></i><span>Relâcher pour actualiser</span>';
    document.body.appendChild(bande); return bande;
  };
  const fin = () => { if(bande){ bande.classList.remove('on', 'pret', 'tourne'); bande.style.transform = ''; } tire = 0; y0 = null; };
  document.addEventListener('touchstart', e => {
    const v = vue();
    if(!v || SANS_ACTUALISER.includes(S.ecran) || !e.touches[0] || e.touches.length !== 1) { y0 = null; return; }
    if(e.target.closest('input,textarea,select,.gr-corps,.lecteur-doc,#voile,.panneau')) { y0 = null; return; }
    if(v.scrollTop > 0){ y0 = null; return; }
    y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; tire = 0;
  }, { passive:true });
  document.addEventListener('touchmove', e => {
    if(y0 === null || !e.touches[0]) return;
    const dy = e.touches[0].clientY - y0, dx = Math.abs(e.touches[0].clientX - x0);
    if(dy <= 8 || dx > dy){ if(tire) fin(); return; }
    tire = Math.min(dy, 140);
    const b = indic(); b.classList.add('on');
    b.style.transform = 'translate(-50%,' + Math.round(tire * 0.55 - 40) + 'px)';
    b.classList.toggle('pret', tire >= 90);
    b.querySelector('span').textContent = tire >= 90 ? 'Relâcher pour actualiser' : 'Tirer pour actualiser';
  }, { passive:true });
  document.addEventListener('touchend', async () => {
    if(y0 === null){ return; }
    const ok = tire >= 90;
    if(!ok){ fin(); return; }
    const b = indic(); b.classList.add('tourne'); b.querySelector('span').textContent = 'Actualisation…';
    y0 = null;
    try{ await actualiserTout(); toast('À jour.', 1800); }catch(e){}
    fin();
  }, { passive:true });
  document.addEventListener('touchcancel', fin, { passive:true });
})();

/* ---------- glisser vers le haut pour la question suivante (fil) ---------- */
(function(){
  let y0 = null, x0 = null;
  document.addEventListener('touchstart', e => { if(S.ecran !== 'pourtoi' || !e.touches[0]) return; y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; }, { passive:true });
  document.addEventListener('touchend', e => {
    if(S.ecran !== 'pourtoi' || y0 === null || !e.changedTouches[0]) return;
    const dy = y0 - e.changedTouches[0].clientY, dx = Math.abs(e.changedTouches[0].clientX - x0); y0 = null;
    const v = vue(); const enBas = v.scrollTop + v.clientHeight >= v.scrollHeight - 4;
    if(dy > 70 && dx < 50 && S.fil && S.fil.c && enBas){ const b = document.querySelector('[data-fil-suiv]'); if(b) b.click(); }
  }, { passive:true });
})();

document.addEventListener('click', ev => {
  const t = ev.target.closest('[data-pieges],[data-similaires],[data-notion-q],[data-ouvrirq],[data-creer-defi],[data-defi-rep],[data-defi-remettre],[data-defi-nouveau],[data-partage-defi],[data-defi-mat],[data-defi-etape],[data-defi-ajout],[data-defi-ouvrir],[data-defi-accepter],[data-defi-refuser],[data-defi-feuille],[data-defier-pseudo],[data-defi-lancer],[data-prop-bonne],[data-prop-envoyer],[data-carte-progres],[data-pause],[data-installer],[data-export-cahier],[data-cahier-vue],[data-note-edit],[data-note-save],[data-plein-ecran],[data-concentration],[data-son-global],[data-anim-global],[data-graph]');
  if(!t) return;
  const d = t.dataset;
  try{ const cle = Object.keys(d)[0]; pister('BUTTON_CLICKED', { valeur: String(d[cle]).slice(0,40) }, cle); }catch(e){}
  if(d.pieges) return lancerFilRpc('questions_plus_ratees', { p_niveau: niveauCand() }, 'LES PLUS RATÉES');
  if(d.similaires) return lancerFilRpc('questions_similaires', { p_question: d.similaires, p_nombre: 3 }, 'QUESTIONS SIMILAIRES');
  if(d.notionQ && S.notion) return lancerFilListe(S.notion.questions || [], 'NOTION DU JOUR');
  if(d.ouvrirq){
    const x = (S.banque || []).flatMap(m => m.questions.map(q => ({ ...q, matiere:m.nom }))).find(q => q.id === d.ouvrirq);
    if(!x) return;
    S.qp = { id:x.id, enonce:x.q, options:x.o, matiere:x.matiere, charge:true };
    return aller('question');
  }
  if(d.creerDefi !== undefined) return creerDefi(d.creerDefi === 'wa');
  if(d.defiMat !== undefined){
    const p = S.defiPrep; if(!p) return;
    if(!d.defiMat) p.matieres = [];
    else p.matieres = p.matieres.includes(d.defiMat) ? p.matieres.filter(x => x !== d.defiMat) : p.matieres.concat(d.defiMat);
    return rendre();
  }
  if(d.defiEtape){
    const p = S.defiPrep; if(!p) return;
    const nums = [...document.querySelectorAll('[data-defi-num]')].map(x => x.value);
    if(nums.length) p.numeros = nums;
    p.etape = +d.defiEtape; return rendre();
  }
  if(d.defiAjout){
    const p = S.defiPrep; if(!p) return;
    p.numeros = [...document.querySelectorAll('[data-defi-num]')].map(x => x.value).concat('');
    rendre(); const c = document.getElementById('num-' + (p.numeros.length - 1)); if(c) c.focus(); return;
  }
  if(d.defiOuvrir) return ouvrirDefi(d.defiOuvrir);
  if(d.defiAccepter) return repondreDefi(d.defiAccepter, true);
  if(d.defiRefuser) return repondreDefi(d.defiRefuser, false);
  if(d.defiFeuille) return feuilleDefi();
  if(d.defierPseudo){ nouveauDefi(d.defierPseudo); return aller('defi'); }
  if(d.defiLancer){ nouveauDefi(); return aller('defi'); }
  if(d.defiRep){
    const [i, k] = d.defiRep.split('-').map(Number), r = S.defi.rep;
    r[i] = (r[i] || []).includes(k) ? r[i].filter(x => x !== k) : [k];
    if(!r[i].length) delete r[i];
    const bloc = t.closest('.defi-q');
    bloc.querySelectorAll('[data-defi-rep]').forEach(b => b.classList.toggle('choisi', (r[i] || []).includes(+b.dataset.defiRep.split('-')[1])));
    const bt = document.querySelector('[data-defi-remettre]'); if(bt) bt.textContent = `Remettre (${Object.keys(r).length}/${S.defi.questions.length} répondues)`;
    return;
  }
  if(d.defiRemettre) return remettreDefi();
  if(d.defiNouveau){ nouveauDefi(); return rendre(); }
  if(d.partageDefi){ return partagerDefiWhatsapp({ ...(S.defi || {}), id: d.partageDefi }); }
  if(d.propBonne !== undefined){ S.prop.bonne = +d.propBonne; return ecranProposer(); }
  if(d.propEnvoyer){
    const f = S.prop;
    if(!S.util.connecte){ S.modal = 'connexion'; return surcouche(); }
    if(f.enonce.trim().length < 10){ S.erreur = 'Écris la question en entier.'; return ecranProposer(); }
    if(f.o.some(o => !o.trim())){ S.erreur = 'Remplis les quatre propositions.'; return ecranProposer(); }
    if(f.bonne === null){ S.erreur = 'Touche « bonne ? » à côté de la bonne réponse.'; return ecranProposer(); }
    S.erreur = '';
    base.rpc('proposer_question', { p_matiere:f.matiere, p_niveau:niveauBase(), p_enonce:f.enonce, p_options:f.o, p_bonne:f.bonne, p_explication:f.expl, p_source:f.source })
      .then(({ data }) => {
        if(data && data.ok){ S.prop = null; toast('Merci ! Ta question est envoyée à l\'équipe pour vérification.'); pister('QUESTION_PROPOSED'); aller('aujourdhui'); }
        else { S.erreur = (data && data.message) || 'Envoi impossible.'; ecranProposer(); }
      }, () => { S.erreur = 'Envoi impossible. Vérifie ta connexion.'; ecranProposer(); });
    return;
  }
  if(d.carteProgres) return carteProgression();
  if(d.pause){
    base.rpc('prendre_pause').then(({ data }) => {
      toast(data && data.ok ? 'Jour de pause pris : ta série est protégée aujourd\'hui.' : ((data && data.message) || 'Pause impossible.'), 5000);
      chargerProgression(); chargerDetails();
    }, () => toast('Vérifie ta connexion.'));
    return;
  }
  if(d.installer && S.installer){ S.installer.prompt(); S.installer.userChoice.then(() => { S.installer = null; rendre(); }); return; }
  if(d.exportCahier) return exporterCahier();
  if(d.cahierVue){ S.cahierVue = d.cahierVue; S.cahierFiltre = false; return rendre(); }
  if(d.noteEdit){ S.noteOuverte = d.noteEdit; return rendre(); }
  if(d.noteSave){
    const e = S.cahier.find(x => x.id === d.noteSave); const champ = document.getElementById('note-' + d.noteSave);
    if(!e || !champ) return;
    e.notePerso = champ.value.trim(); S.noteOuverte = null; rendre();
    base.rpc('noter_erreur', { p_question: e.id, p_note: e.notePerso }).then(() => toast('Note enregistrée.'), () => toast('Note non enregistrée.'));
    return;
  }
  if(d.pleinEcran) return basculerPleinEcran();
  if(d.concentration){ S.concentration = !S.concentration; ecrireReglage('concentration', S.concentration); return rendre(); }
  if(d.sonGlobal){ S.sonCoupe = !S.sonCoupe; ecrireReglage('sonCoupe', S.sonCoupe); if(!S.sonCoupe) bip(1); return rendre(); }
  if(d.graph){ S.graph = +d.graph; return rendre(); }
  if(d.animGlobal){ S.sansAnim = !S.sansAnim; ecrireReglage('sansAnim', S.sansAnim); return rendre(); }
});

/* =====================================================================
   RENDU + ÉVÉNEMENTS
   ===================================================================== */
const SANS_TETE = ['test','grille','engagement','testIntro','resultat','verrou','verrou_d'];
/* raccourci caché vers l'administration : cinq touchers rapides sur le logo */
let touchesLogo = [];
document.addEventListener('click', ev => {
  if(!ev.target.closest('#apptete svg, #apptete .mot')) return;
  const t = Date.now(); touchesLogo = touchesLogo.filter(x => t - x < 2500); touchesLogo.push(t);
  if(touchesLogo.length >= 5){ touchesLogo = []; location.href = '/admin.html'; }
});
function initialesCompte(){
  const m = String((S.util && S.util.nom) || '').trim().split(/\s+/).filter(Boolean);
  return ((m[0] || '?')[0] + (m.length > 1 ? m[m.length - 1][0] : '')).toUpperCase();
}
/* bouton flottant WhatsApp : en bas à droite, au-dessus de la barre du bas, sur l'accueil seulement ;
   plus du tout une fois la chaîne rejointe */
function majBoutonCanal(){
  let r = {}; try{ r = lireReglages() || {}; }catch(e){}
  const veut = !!CONTACT.canal && !['test','testIntro','verrou','verrou_d','engagement','inscription','connexion','paiement'].includes(S.ecran) && !S.modal && !enComposition() && !document.getElementById('invitation') && (Date.now() - T_OUVERTURE) > 6000;
  let b = document.getElementById('fab-canal');
  if(!veut){ if(b) b.remove(); return; }
  if(!b){
    b = document.createElement('button');
    b.id = 'fab-canal'; b.type = 'button'; b.className = 'fab-canal'; b.dataset.canalTete = '1';
    b.setAttribute('aria-label', 'Rejoindre la chaîne WhatsApp de Mon Concours');
    b.innerHTML = logoReseau('whatsapp');
    document.body.appendChild(b);
  }
  const nav = document.getElementById('nav');
  b.style.setProperty('--nav-h', ((nav && nav.offsetHeight) || 0) + 'px');
}
setInterval(() => { if(!document.hidden) majBoutonCanal(); }, 4000);
function apptete(){
  majBoutonCanal();
  const t = document.getElementById('apptete');
  if(SANS_TETE.includes(S.ecran)){ t.style.display='none'; return; }
  t.style.display='flex';
  const jr = joursAvantConcours();
  const droite = {aujourdhui: jr === null ? '' : 'J−' + jr, copie:'copie corrigée', cahier:ouvertes()+' en attente',
    compte:S.gratuit ? '' : S.abo.actif?nomFormule(S.abo.formule).toLowerCase():'abonnement gratuit',
    revisions:S.niveau.toLowerCase(), qcm:S.matiere||'', abonnement:'', paiement:'sécurisé',
    inscription:'', connexion:'', resultat:'étape 3 sur 3', actualite:'ce matin',
    pourtoi:'pour toi', qdj:'question du jour', gagnants:'classement', discussion:'discussion', notion:'notion du jour', defi:'défi', top:'top 10', parcours:'mon parcours'}[S.ecran] || '';
  const nonLues = S.notifications.filter(n => !n.lue).length;
  t.innerHTML = `${logoSvg(24)}<span class="mot">MON <i>CONCOURS</i></span>
    <span class="droite">${droite}</span>
    <button class="bouton-tete cloche" data-notifs="1" aria-label="Notifications${nonLues?', ' + nonLues + ' non lues':''}">
      ${ico('cloche',17)}${nonLues ? `<i class="pastille-cloche">${nonLues > 9 ? '9+' : nonLues}</i>` : ''}</button>
    <button class="bouton-tete ${MUSIQUE.actif?'actif':''}" data-musique="1"
      aria-pressed="${MUSIQUE.actif}"
      aria-label="${MUSIQUE.actif?'Arrêter la musique':'Mettre une musique douce'}">
      ${ico('musique',17)}<span>${MUSIQUE.actif?'Musique en cours':'Musique'}</span></button>
    <button class="bouton-tete" data-bascule-theme="1" aria-label="${S.theme==='sombre'?'Passer en mode clair':'Passer en mode sombre'}">
      ${S.theme==='sombre'?ico('soleil',17):ico('lune',17)}<span>${S.theme==='sombre'?'Mode clair':'Mode sombre'}</span></button>
    ${S.util.connecte
      ? `<button class="bouton-tete avatar-tete" data-go="compte" aria-label="Connecté : ouvrir mon compte" title="Connecté"><b>${E(initialesCompte())}</b><i aria-hidden="true"></i></button>`
      : `<button class="bouton-tete etat-tete inscrire" data-modal="inscription" aria-label="S'inscrire gratuitement"><b>S'inscrire</b></button>`}`;

}
function annoncer(){
  const n = {aujourdhui:'Actualité', actualite:'Actualité du matin', revisions:'Mes cours',
    qcm:'Question', grille:'Composition', copie:'Copie corrigée', cahier:'Mon cahier', compte:'Mon compte',
    inscription:'Création de compte', connexion:'Connexion', abonnement:'Abonnements', paiement:'Paiement',
    test:'Test de niveau', resultat:'Résultat', pourtoi:'Fil pour toi', qdj:'Question du jour',
    question:'Question partagée', gagnants:'Résultats de la composition nationale', discussion:'Discussion de la composition', notion:'Notion du jour', recherche:'Recherche de questions',
    defi:'Défi entre amis', top:'Top 10 de la semaine', proposer:'Proposer une question', parcours:'Mon parcours'}[S.ecran] || '';
  const a = document.getElementById('annonce');
  if(a && n) a.textContent = 'Écran : ' + n;
}
function appliquerTheme(){ document.body.dataset.theme = S.theme; }
function basculerTheme(){
  document.body.classList.add('en-transition');
  S.theme = S.theme==='sombre' ? 'clair' : 'sombre';
  ecrireReglage('theme', S.theme);
  rendre();
  clearTimeout(S.tTheme);
  S.tTheme = setTimeout(()=>document.body.classList.remove('en-transition'), 480);
}

/* --- surcouche d'inscription différée --- */
const COULEURS = ['Rouge','Bleu','Vert','Jaune','Orange','Noir','Blanc','Marron','Violet'];

/* ---------- bandeau « Télécharger l'application » : toujours visible, sous l'en-tête ---------- */
const CLE_BANDEAU = 'mc_bandeau_appli_ferme';
function bandeauAppliRecemmentFerme(){
  try{ const t = +localStorage.getItem(CLE_BANDEAU) || 0; return Date.now() - t < 3 * 86400000; }catch(e){ return false; }
}
function fermerBandeauAppli(){
  try{ localStorage.setItem(CLE_BANDEAU, String(Date.now())); }catch(e){}
  S.appliInstallee = false;
  const b = document.getElementById('bandeau-appli'); if(b) b.remove();
}
/* Bandeau d'accueil : seulement quand le téléphone propose vraiment d'installer, 20 secondes, puis il disparaît (3 jours de repos) */
function majBandeauAppli(){
  let b = document.getElementById('bandeau-appli');
  const visible = S.ecran === 'aujourdhui' && !estInstallee() && !enComposition() && !S.modal &&
    (S.appliInstallee || (S.installer && !S.appliLa && !bandeauAppliRecemmentFerme()));
  if(!visible){ if(b) b.remove(); return; }
  if(!b){
    b = document.createElement('div');
    b.id = 'bandeau-appli'; b.className = 'bandeau-appli';
    b.onclick = ev => {
      const t = ev.target.closest('button'); if(!t) return;
      if(t.dataset.appliOk || t.dataset.appliX){ fermerBandeauAppli(); return; }
      telechargerAppli();
    };
    document.getElementById('apptete').insertAdjacentElement('afterend', b);
    setTimeout(() => { if(!S.appliInstallee) fermerBandeauAppli(); }, 20000);
  }
  { const t = document.getElementById('apptete');
    b.style.setProperty('--tete-h', ((t && t.offsetHeight) || 56) + 8 + 'px');
  }
  b.innerHTML = S.appliInstallee
    ? `<span>Installation terminée. <b>Ouvrez Mon Concours</b> depuis votre écran d'accueil.</span><button type="button" class="bandeau-appli-go" data-appli-ok="1">Compris</button>`
    : `<button type="button" class="bandeau-appli-go">↓ Télécharger l'application</button><button type="button" class="bandeau-appli-x" data-appli-x="1" aria-label="Fermer">×</button>`;
}
document.addEventListener('click', ev => { if(ev.target.closest('[data-appli-dl]')) telechargerAppli(); });
/* L'application est-elle déjà sur ce téléphone ? Alors le bouton dit « Ouvrir », jamais « Télécharger ». */
try{
  if(navigator.getInstalledRelatedApps) navigator.getInstalledRelatedApps().then(l => {
    S.appliLa = !!(l && l.length);
    try{ majBandeauAppli(); if(S.ecran === 'compte') rendre(); }catch(e){}
  }).catch(() => {});
}catch(e){}
function ouvrirAppli(){
  try{ pister('APPLI_OUVRIR_CLIC'); }catch(e){}
  if(/Android/i.test(navigator.userAgent)){
    location.href = 'intent://' + location.host + '/#Intent;scheme=https;action=android.intent.action.VIEW;end';
    setTimeout(() => { if(!document.hidden) fenetreInstallerPas('manuel'); }, 1800);
  } else fenetreInstallerPas('manuel');
}
async function telechargerAppli(){
  try{ pister('APPLI_BANDEAU_CLIC'); }catch(e){}
  if(S.appliLa) return ouvrirAppli();
  if(!S.installer) return installerAppli();          // pas de téléchargement direct : on guide la personne
  const invite = S.installer;
  invite.prompt();
  try{
    const choix = await invite.userChoice;
    if(choix && choix.outcome === 'accepted') S.appliInstallee = true;
  }catch(e){}
  S.installer = null;
  majBandeauAppli();
  if(S.ecran === 'compte') rendre();
}

function surcouche(){
  const v = document.getElementById('voile');
  /* les autres panneaux (partage, notifications, signalement, sortie
     d'épreuve) se gèrent eux-mêmes : un rendu ne doit pas les fermer */
  if(S.modal && !['inscription','connexion','oubli'].includes(S.modal)) return;
  if(!S.modal || (S.util.connecte && S.modal !== 'oubli')){ v.hidden = true; v.innerHTML=''; return; }

  const mode = S.modal;                       // inscription · connexion · oubli
  const titres = { inscription:'Crée ton compte gratuitement en 30 secondes', connexion:'Connexion', oubli:'Mot de passe oublié' };
  const intros = {
    inscription:"",
    connexion:"Entre ton numéro et ton mot de passe pour retrouver ta progression.",
    oubli:"Donne ton numéro et la couleur choisie à l'inscription, puis choisis un nouveau mot de passe. Trois essais au plus : ensuite, l'administrateur s'en occupe sur WhatsApp."
  };

  v.hidden = false;
  v.innerHTML = `
  <div class="panneau" role="dialog" aria-modal="true" aria-label="${titres[mode]}">
    <div class="poignee"></div>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">${logoSvg(30)}
      <span style="font-family:var(--d);font-weight:800;font-size:15px">MON <i style="font-style:normal;color:var(--laterite-txt)">CONCOURS</i></span></div>

    <div class="titre-panneau">${titres[mode]}</div>
    ${intros[mode] ? `<p class="intro">${intros[mode]}</p>` : ''}

    ${S.erreur?`<div class="alerte" role="alert">${E(S.erreur)}</div>`:''}

    ${mode === 'inscription' ? `
      <div class="champ"><label for="m-nom">Nom et prénom</label>
        <input id="m-nom" type="text" value="${E(S.form.nom)}" placeholder="Ouedraogo Franck" oninput="maj('nom',this.value)" autocomplete="name"></div>` : ''}

    <div class="champ"><label for="m-tel">Numéro de téléphone</label>
      <div class="prefixe"><span class="ind">+226</span>
        <input id="m-tel" type="tel" inputmode="numeric" maxlength="8" value="${E(S.form.tel)}" placeholder="70 00 00 00" oninput="maj('tel',this.value)" autocomplete="tel"></div></div>

    ${mode === 'oubli' ? `
      <div class="champ"><label for="m-couleur">Ta couleur préférée</label>
        <select id="m-couleur" onchange="maj('couleur',this.value)">
          <option value="">— choisis —</option>
          ${COULEURS.map(c=>`<option value="${c}" ${S.form.couleur===c?'selected':''}>${c}</option>`).join('')}
        </select></div>` : ''}

    <div class="champ"><label for="m-pin">${mode==='oubli'?'Nouveau mot de passe (4 chiffres)':'Ton mot de passe (4 chiffres)'}</label>
      <div class="avec-oeil">
        <input id="m-pin" type="${S.codeVisible?'text':'password'}" inputmode="numeric" maxlength="4"
          value="${E(S.form.pin)}" placeholder="••••" oninput="maj('pin',this.value)">
        <button class="oeil" data-oeil="1" aria-label="${S.codeVisible?'Masquer le mot de passe':'Afficher le mot de passe'}">${S.codeVisible?'masquer':'voir'}</button>
      </div></div>

    ${(mode === 'inscription' || mode === 'oubli') ? `
      <div class="champ"><label for="m-pin2">Confirme le mot de passe</label>
        <input id="m-pin2" type="${S.codeVisible?'text':'password'}" inputmode="numeric" maxlength="4"
          value="${E(S.form.pin2||'')}" placeholder="••••" oninput="maj('pin2',this.value)"></div>` : ''}

    ${mode === 'inscription' ? `
      <div class="champ"><label for="m-couleur">Ta couleur préférée <span style="font-weight:400">(à retenir en cas d'oubli de ton mot de passe)</span></label>
        <select id="m-couleur" onchange="maj('couleur',this.value)">
          <option value="">— choisis —</option>
          ${COULEURS.map(c=>`<option value="${c}" ${S.form.couleur===c?'selected':''}>${c}</option>`).join('')}
        </select></div>
      ${(() => { const venuParLien = S.form.codeP === undefined && codePartenaire().length >= 3;
        return `<div class="champ"><label for="m-codep">Code partenaire${venuParLien ? '' : ' <span style="font-weight:400">(facultatif)</span>'}</label>
        <input id="m-codep" type="text" maxlength="14" autocapitalize="characters" autocomplete="off" spellcheck="false" ${venuParLien ? 'readonly data-lien="1"' : ''}
          value="${E(S.form.codeP !== undefined ? S.form.codeP : codePartenaire())}" placeholder="Si quelqu'un t'en a donné un"
          oninput="maj('codeP',this.value.toUpperCase()); majNomPartenaire()">
        <div id="m-codep-nom" style="margin-top:6px;font-weight:600"></div></div>${(setTimeout(majNomPartenaire, 0), '')}`; })()}` : ''}

    <button class="cta" data-${mode === 'inscription' ? 'inscrire' : mode === 'connexion' ? 'connecter' : 'reinitialiser'}="1">
      ${mode === 'inscription' ? 'Créer mon compte' : mode === 'connexion' ? 'Me connecter' : 'Changer mon mot de passe'}</button>

    ${mode === 'inscription'
      ? `<button class="lien" data-bascule="connexion">J'ai déjà un compte</button>`
      : mode === 'connexion'
        ? `<button class="lien" data-bascule="inscription">Créer un compte</button>
           <button class="lien" data-bascule="oubli">J'ai oublié mon mot de passe</button>`
        : `<button class="lien" data-bascule="connexion">Revenir à la connexion</button>`}
    ${mode === 'oubli' ? `<button class="cta creux" style="margin-top:10px" data-oubli-wa="1">${S.bloque ? "Écrire à l'administrateur sur WhatsApp" : "Couleur oubliée ? Écrire à l'administrateur"}<small>Il vérifie votre identité et change votre mot de passe</small></button>` : ''}
  </div>`;
}


function ecranApparence(){
  vue().innerHTML = `
  <div class="pad">
    <button class="retourhaut" data-go="compte">Retour</button>
    <h1 class="titre">Apparence</h1>
    <p class="sous" style="margin:8px 0 18px">Même application, deux ambiances. Le choix s'applique tout de suite, partout.</p>

    <button class="theme-carte ${S.theme==='sombre'?'on':''}" data-theme-choix="sombre" aria-pressed="${S.theme==='sombre'}">
      ${S.theme==='sombre'?'<span class="coche">ACTIF</span>':''}
      <div class="demo"><i style="background:#14211C"></i><i style="background:#0C1512"></i><i style="background:#13805A"></i></div>
      <b>Mode sombre</b><span>Vert Faso sur fond nuit, pensé pour le soir</span>
    </button>
    <button class="theme-carte ${S.theme==='clair'?'on':''}" data-theme-choix="clair" aria-pressed="${S.theme==='clair'}">
      ${S.theme==='clair'?'<span class="coche">ACTIF</span>':''}
      <div class="demo"><i style="background:#F5F5F0"></i><i style="background:#FFFFFF"></i><i style="background:#0B6B4A"></i></div>
      <b>Mode clair</b><span>Fond clair, cartes blanches, texte foncé, mêmes couleurs</span>
    </button>

    <div class="carte reglages" style="margin-top:16px">
      <button data-son-global="1" aria-pressed="${!S.sonCoupe}">Sons (sonneries, bonnes et mauvaises réponses)<span>${S.sonCoupe ? 'COUPÉS' : 'ACTIVÉS'}</span></button>
      <button data-anim-global="1" aria-pressed="${!S.sansAnim}">Animations (bulles, notes, podium)<span>${S.sansAnim ? 'COUPÉES' : 'ACTIVÉES'}</span></button>
      <button data-concentration="1" aria-pressed="${!!S.concentration}">Mode concentration<span>${S.concentration ? 'ACTIVÉ' : 'DÉSACTIVÉ'}</span></button>
    </div>
    <p class="sous" style="margin-top:8px;font-size:12.5px">Le mode concentration cache l'en-tête et le menu pendant les questions : il ne reste que la question. Il se règle aussi d'un geste, avec la cible en haut de chaque question.</p>
  </div>`;
}

let facadeRetiree = false;
function retirerFacade(){
  if(facadeRetiree) return;
  facadeRetiree = true;
  const f = document.getElementById('facade');
  if(!f) return;
  const partir = () => { f.classList.add('parti'); setTimeout(() => f.remove(), 320); };
  /* L'écran ne se montre qu'une fois les polices arrivées (au plus 1,5 s) : plus de texte qui change de taille sous les yeux. */
  const polices = (document.fonts && document.fonts.load)
    ? Promise.all(['800 20px "Bricolage Grotesque"', '400 16px "IBM Plex Sans"', '600 16px "IBM Plex Sans"'].map(x => document.fonts.load(x).catch(() => 0)))
    : Promise.resolve();
  Promise.race([polices, new Promise(r => setTimeout(r, 1500))]).then(() => setTimeout(partir, 120));
}

function rendre(){
  if(bloqueParPartenaire() && !ECRANS_AVANT_PAIEMENT.includes(S.ecran)) S.ecran = 'abonnement';
  else if(paiementObligatoire() && !S.util.connecte && !ECRANS_VISITEUR_PARTENAIRE.includes(S.ecran)) S.ecran = 'engagement';
  appliquerTheme();
  retirerFacade();
  if(typeof pister === 'function' && S.ecran !== O.dernierEcran){
    const passe = Date.now() - O.entreeEcran;
    if(O.dernierEcran) pister('SCREEN_LEFT', { ecran: O.dernierEcran, duree_ms: passe });
    O.dernierEcran = S.ecran; O.entreeEcran = Date.now(); O.nbEcrans++;
    profondeurVue = 0;
    pister('SCREEN_VIEWED');
  }
  const dessiner = ({engagement:ecranEngagement, testIntro:ecranTestIntro, test:ecranTest, resultat:ecranResultat, verrou:ecranVerrou, verrou_d:ecranVerrouD,
    inscription:ecranInscription, connexion:ecranConnexion,
    abonnement:ecranAbonnement, paiement:ecranPaiement,
    apparence:ecranApparence,
    aujourdhui:ecranAujourdhui, actualite:ecranActualite,
    revisions:ecranRevisions, cours:ecranCours, lecture:ecranLecture, qcm:ecranQcm,
    grille:ecranGrille, copie:ecranCopie,
    cahier:ecranCahier, lecteur:ecranLecteur, compte:ecranCompte,
    pourtoi:ecranPourToi, qdj:ecranQdj, question:ecranQuestionPartagee, gagnants:ecranGagnants, correctionnat:ecranCorrectionNat, discussion:ecranDiscussion,
    notion:ecranNotion, recherche:ecranRecherche, defi:ecranDefi, top:ecranTop, proposer:ecranProposer, parcours:ecranParcours, parrainage:ecranParrainage, xreprise:ecranRepriseX, xbravo:ecranBravoX, communaute:ecranCommunaute, horsligne:ecranHorsLigne, suppression:ecranSuppression}[S.ecran] || ecranAujourdhui);

  /* FILET — une erreur dans un seul écran ne doit plus jamais laisser
     le candidat devant une page noire. On affiche ce qui s'est passé
     et on lui donne un chemin de sortie. */
  try{
    dessiner();
  }catch(err){
    try{ pister('SCREEN_ERROR', { ecran:S.ecran, message:String(err && err.message) }); }catch(e){}
    console.error('Écran ' + S.ecran + ' :', err);
    vue().innerHTML = `
      <div class="pad" style="text-align:center;padding-top:60px">
        <h1 class="titre" style="font-size:22px">Cet écran n'a pas pu s'ouvrir</h1>
        <p class="sous" style="margin:10px 0 18px">Le reste de l'application fonctionne. Revenez à l'actualité, ou rechargez.</p>
        <button class="cta" data-go="aujourdhui">Revenir à l'actualité</button>
        <button class="cta creux" style="margin-top:9px" onclick="location.reload()">Recharger</button>
      </div>`;
  }
  try{ nav(); apptete(); majBandeauAppli(); annoncer(); surcouche(); appliquerConcentration(); }catch(e){ console.error(e); }
  try{ animerApresRendu(); }catch(e){}
}

document.addEventListener('click', ev=>{
  const t = ev.target.closest('[data-matiere],[data-vers],[data-musique],[data-notifs],[data-notifs-tout],[data-notifs-vider],[data-notif-lire],[data-copier],[data-partage-natif],[data-fermer-partage],[data-paieretour],[data-preuve-modifier],[data-preuve-envoyer],[data-plan-faire],[data-plan-effacer],[data-copie-plus-tard],[data-pass],[data-proche],[data-code-ouvrir],[data-code-valider],[data-copier-num],[data-demain],[data-feuille],[data-lire-feuille],[data-lire-cahier],[data-lecteur-dl],[data-nivinfo],[data-archive],[data-toutes-compos],[data-partage],[data-oeil],[data-reinitialiser],[data-lire],[data-telecharger],[data-apercu],[data-saut],[data-compotab],[data-bascule-theme],[data-modal],[data-entrer],[data-bascule],[data-plustard],[data-deconnecter],[data-theme-choix],[data-erreursdusoir],[data-cible],[data-cours],[data-inscrire],[data-connecter],[data-oubli],[data-oubli-wa],[data-formule],[data-operateur],[data-payer],[data-paiefin],[data-paieannul],[data-go],[data-toutcahier],[data-actu],[data-actu-repli],[data-niv],[data-mat],[data-qcm],[data-qsuiv],[data-cahierfreq],[data-classement],[data-diagnostic],[data-defi],[data-duel],[data-badges],[data-phase],[data-conc],[data-dep],[data-test],[data-tb],[data-tremettre],[data-seance],[data-rep],[data-suivante],[data-b],[data-remettre],[data-recommencer],[data-reprise],[data-xr-rep],[data-xr-suiv],[data-xseance],[data-xnotifs],[data-xinstall],[data-rr],[data-fin-reprise],[data-qcm-relancer],[data-compo-relancer],[data-remise-relancer],[data-recu]');
  if(!t) return;
  const d = t.dataset;

  try{
    const cle = Object.keys(d)[0] || 'inconnu';
    pister('BUTTON_CLICKED', { valeur: String(d[cle]).slice(0,40) }, cle);
  }catch(e){}

  if(d.go){
    /* pendant une épreuve, changer d'onglet demande confirmation */
    if(enComposition() && d.go !== 'grille'){ S.apresQuitter = d.go; return demanderQuitter(); }
    if(d.go==='testIntro') pister('ONBOARDING_STEP_COMPLETED', {etape:1}, 'engagement');
    if(d.go==='abonnement') pister('SUBSCRIPTION_PAGE_VIEWED');
    if(d.go==='paiement'){ S.paieEtape=0; pister('PAYMENT_STARTED', {formule:S.choixFormule}); }
    S.erreur=''; return aller(d.go);
  }

  if(d.inscrire){
    const f = S.form, tel = f.tel.replace(/\D/g,''), pin = f.pin.replace(/\D/g,'');
    const pin2 = (f.pin2 || '').replace(/\D/g,'');
    if(f.nom.trim().length < 3) S.erreur = "Écris ton nom et ton prénom.";
    else if(tel.length !== 8) S.erreur = "Le numéro doit comporter 8 chiffres.";
    else if(pin.length !== 4) S.erreur = "Le mot de passe doit comporter 4 chiffres.";
    else if(pin !== pin2) S.erreur = "Les deux mots de passe ne sont pas identiques.";
    else if(!f.couleur) S.erreur = "Choisis ta couleur préférée : elle servira si tu oublies ton mot de passe.";
    else {
      S.erreur = 'Création du compte…'; surcouche();
      const cp = codeSaisiPartenaire();
      const saisiACle = S.form.codeP !== undefined;
      verifierCodePartenaire(cp).then(msg => msg ? { erreur: msg } : creerCompte(f.nom.trim(), tel, pin)).then(r => {
        if(r.erreur){ S.erreur = r.erreur; return surcouche(); }
        if(cp.length >= 3 && base){
          try{ base.rpc('rattacher_partenaire_source', { p_code: cp, p_visiteur: idVisiteur(), p_saisi: saisiACle }).then(() => { try{ localStorage.removeItem(CLE_PARTENAIRE); }catch(e){} }, () => {}); }catch(e){}
        }
        { const rp = codeParrain();
          if(rp && base){ try{ base.rpc('rattacher_parrain', { p_code: rp }).then(() => { try{ localStorage.removeItem(CLE_PARRAIN); }catch(e){} }, () => {}); }catch(e){} } }
        S.erreur = ''; S.util = {nom:f.nom.trim(), tel:tel, pin:'', connecte:true};
        S.niveauProfil = niveauBase();
        ecrireMemoire({ nom:f.nom.trim(), tel:tel, niveauProfil:S.niveauProfil });
        pister('ACCOUNT_CREATED', { niveau: S.niveau });
        noterParcoursCompte();
        ecrireReglage('compteLe', Date.now());
        if(!estXX1() && !estE2()) setTimeout(() => invitationNotifsApresInscription(), 7000);
        S.modal = null; chargerProgression();
        if(paiementObligatoire()){ chargerAbonnement(); S.choixFormule = S.choixFormule || 'annuelle'; return aller('abonnement'); }
        if(S.defi && S.defi.etat === 'connexion') ouvrirDefi(S.defi.id);
        else if(S.ecran === 'verrou' && S.testNote !== null){ if(estXX1() || estE2()) lancerRepriseX(); else aller('resultat'); }
        else if(S.ecran === 'verrou_d' && S.testNote !== null){ S.verrouDEtape = 2; aller('verrou_d'); }
        else aller('aujourdhui');
      });
      return;
    }
    return rendre();
  }
  if(d.connecter){
    const tel = S.form.tel.replace(/\D/g,''), pin = S.form.pin.replace(/\D/g,'');
    if(tel.length !== 8 || pin.length !== 4){
      S.erreur = "Numéro à 8 chiffres et mot de passe à 4 chiffres."; return surcouche(); }
    S.erreur = 'Connexion…'; surcouche();
    (async () => {
      /* Un code à quatre chiffres se devine. Au bout de huit essais ratés
         on ferme quinze minutes, et on montre la sortie de secours. */
      if(base){
        try{
          const { data: v } = await base.rpc('controle_connexion', { p_telephone: tel });
          if(v && v.bloque){
            S.bloque = true;
            S.erreur = `Trop d'essais. Réessayez dans ${v.minutes} minute${v.minutes>1?'s':''}, ou utilisez « Mot de passe oublié ».`;
            return surcouche();
          }
        }catch(e){}
      }
      const r = await ouvrirSession(tel, pin);
      if(r.erreur){
        if(base){ try{ await base.rpc('controle_connexion', { p_telephone: tel, p_reussie: false }); }catch(e){} }
        S.bloque = true;                       // on montre « Code oublié » dès le 1er échec
        S.erreur = r.erreur; return surcouche();
      }
      if(base){ try{ await base.rpc('controle_connexion', { p_telephone: tel, p_reussie: true }); }catch(e){} }
      S.bloque = false;
      S.erreur = ''; S.util = { nom:'Candidat', tel:tel, pin:'', connecte:true };
      ecrireMemoire({ nom:'Candidat', tel:tel, niveau:S.niveau });
      S.modal = null;
      await reprendreSession();
      await chargerProgression();
      if(S.defi && S.defi.etat === 'connexion') ouvrirDefi(S.defi.id);
      else if(S.ecran === 'verrou' && S.testNote !== null){ if(estXX1() || estE2()) lancerRepriseX(); else aller('resultat'); }
      else if(S.ecran === 'verrou_d' && S.testNote !== null){ S.verrouDEtape = 2; aller('verrou_d'); }
      else aller('aujourdhui');
    })();
    return;
  }
  if(d.oubliWa){ pister('FORGOT_PASSWORD_WHATSAPP', {}); return ouvrirWhatsappOubli(); }
  if(d.oubli){ S.modal = 'oubli'; S.erreur = ''; pister('FORGOT_PASSWORD_WHATSAPP', {}); ouvrirWhatsappOubli(); return surcouche(); }
  if(d.recu){ telechargerRecu(d.recu); return; }
  if(d.qcmRelancer){ const r = S.qcmRep; S.qcmRep = undefined; return repondreQcm(r); }
  if(d.compoRelancer){ S.compoEtat = null; return ouvrirComposition(); }
  if(d.remiseRelancer){ S.remiseEtat = 'envoi'; rendre(); return cloturerComposition(); }
  if(d.pass){
    if(!FORMULES[d.pass]) return;
    if(!S.util.connecte){ S.modal = 'inscription'; S.erreur = ''; return surcouche(); }
    S.choixFormule = d.pass; S.paieEtape = 0; S.erreur = '';
    pister('PAYWALL_CLICKED', { point: S.propositionPoint || 5, formule: d.pass });
    pister('SUBSCRIPTION_PLAN_SELECTED', { formule: d.pass });
    pister('PAYMENT_STARTED', { formule: d.pass });
    return aller('paiement');
  }
  if(d.planFaire !== undefined){ ecrireReglage('plan', { semaine: lundiDeLaSemaine(), cree: Date.now() }); pister('WEEK_PLAN_CREATED'); chargerPlan(); signalCandidat('Votre plan de la semaine est prêt.'); return rendre(); }
  if(d.planEffacer !== undefined){ ecrireReglage('plan', null); S.plan = null; return rendre(); }
  if(d.copiePlusTard !== undefined){ S.copiePlusTard = true; return rendre(); }
  if(d.demain){ ecrireReglage('pass_demain', Date.now()); pister('PAYWALL_DISMISSED', { point: S.propositionPoint || 0 }); S.propositionPoint = null; return aller('aujourdhui'); }
  if(d.proche){
    pister('PROXY_PAY_SHARED', { formule: d.proche });
    const msg = messageProche(d.proche);
    window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank', 'noopener');
    return;
  }
  if(d.codeOuvrir){ S.codeOuvert = !S.codeOuvert; S.codeErreur = ''; return rendre(); }
  if(d.codeValider){ return validerCode(); }
  if(d.copierNum){
    try{ navigator.clipboard.writeText(d.copierNum); toast('Numéro copié.'); }catch(e){ toast('+226 ' + fmtTel(d.copierNum), 6000); }
    return;
  }
  if(d.formule){ S.choixFormule = d.formule; pister('SUBSCRIPTION_PLAN_SELECTED', { formule: d.formule }); return rendre(); }
  if(d.operateur){ S.operateur = d.operateur; S.erreur = ''; return rendre(); }
  if(d.payer){
    const tel = S.paieTel.replace(/\D/g,'');
    if(tel.length !== 8){ S.erreur = "Saisissez le numéro qui paie, à 8 chiffres."; return rendre(); }
    if(!S.paieNomCompte || S.paieNomCompte.trim().length < 2){ S.erreur = "Indiquez le nom du compte qui effectue le paiement."; return rendre(); }
    S.erreur = ''; S.paieEtape = 1; return rendre();
  }
  if(d.paiefin){
    /* Un clic du candidat ne vaut pas un paiement : on demande la
       preuve avant toute activation, et c'est le serveur qui décide. */
    pister('PAYMENT_DECLARED', { formule: S.choixFormule, operateur: S.operateur });
    if(paiementParPartenaire()){ S.paieTel = (S.util.tel || '').replace(/\D/g, ''); S.paieNomCompte = (S.util.nom && S.util.nom !== 'Candidat') ? S.util.nom : 'Candidat'; S.operateur = 'orange'; }
    S.paieEtape = 3; S.paievePreuve = null; S.erreur = '';
    return rendre();
  }
  if(d.paieretour){
    if(paiementParPartenaire()){ S.paieEtape = 0; S.erreur = ''; return rendre(); }
    S.paieEtape = S.paievePreuve ? 3 : 1; S.erreur='';
    if(S.paieEtape === 1) return rendre();
    S.paieEtape = 1; return rendre();
  }
  if(d.preuveModifier){ S.paievePreuve = null; return rendre(); }
  if(d.preuveEnvoyer){
    if(!S.paievePreuve || S.paieEnvoi) return;
    S.paieEnvoi = true; rendre();
    (async () => {
      try{
        if(!base) throw new Error('Connexion indisponible.');
        const { data: sess } = await base.auth.getSession();
        const uid = sess && sess.session && sess.session.user.id;
        if(!uid) throw new Error('Vous devez être connecté.');

        const chemin = uid + '/' + Date.now() + '-preuve.jpg';
        const { error: eUp } = await base.storage.from('preuves-paiement')
          .upload(chemin, S.paievePreuve.fichier, { contentType: S.paievePreuve.fichier.type || 'image/jpeg' });
        if(eUp) throw eUp;

        const { data, error } = await base.rpc('soumettre_paiement', {
          p_formule: S.choixFormule, p_operateur: S.operateur, p_telephone: S.paieTel,
          p_nom_compte: S.paieNomCompte, p_preuve_chemin: chemin
        });
        if(error) throw error;
        if(!data || !data.ok){ S.erreur = (data && data.message) || 'Envoi impossible.'; S.paieEnvoi = false; return rendre(); }

        pister('PAYMENT_PROOF_SENT', { formule: S.choixFormule, operateur: S.operateur });
        pister('PAYMENT_SENT', { formule: S.choixFormule });
        S.paieEnAttente = { cree_le: new Date().toISOString() };
        S.paieEnvoi = false; S.paieEtape = 2;
        rendre();
      }catch(e){
        S.erreur = enFrancais(e, "Envoi impossible. Vérifiez votre connexion.");
        S.paieEnvoi = false; rendre();
      }
    })();
    return;
  }
  if(d.paieannul){ pister('PAYMENT_ABANDONED', { formule: S.choixFormule }); S.paieEtape = 0; return aller('abonnement'); }
  if(d.erreursdusoir){ pister('ERRORS_OPENED', { depuis: 'composition' });
    S.cahierDepuisGrille = true; S.cahierFiltre=false; return aller('cahier'); }
  if(d.xrRep !== undefined){
    const x = S.xr; if(!x || x.rep !== undefined) return;
    x.rep = +d.xrRep;
    const ok = x.rep === TEST[x.liste[x.idx]].i;
    if(ok){ x.justes++; sonJuste(); } else sonFaux();
    pister('XX1_REPRISE_REPONSE', { juste: ok, rang: x.idx + 1 });
    return rendre();
  }
  if(d.xrSuiv){
    const x = S.xr; if(!x) return;
    x.idx++; x.rep = undefined;
    if(x.idx >= x.liste.length){ pister('XX1_REPRISE_FINIE', { justes: x.justes, fautes: x.liste.length }); return aller('xbravo'); }
    rendre(); vue().scrollTop = 0; return;
  }
  if(d.xseance){ pister('XX1_SEANCE_LANCEE', { depuis: d.xseance }); return lancerSeanceX(); }
  if(d.xnotifs){ pister('XX1_NOTIFS_CLIC', { depuis: d.xnotifs }); return activerRappel(18, 0); }
  if(d.xinstall){ pister('XX1_INSTALL_CLIC', { depuis: d.xinstall }); return installerAppli(); }
  if(d.entrer){
    pister('APP_ENTERED', { note_diagnostic: S.testNote });
    if(d.fautes === '1' && S.cahier.length){ pister('ERRORS_OPENED', { depuis: 'resultat_test' }); S.cahierDepuisGrille = true; S.cahierFiltre = false; aller('cahier'); }
    else aller('aujourdhui');
    if(!S.modalDejaVu && !S.util.connecte){
      clearTimeout(S.minuteur);
      bienvenue();
      S.minuteur = setTimeout(()=>{ if(!S.util.connecte && !S.inscriptionProposee){ S.inscriptionProposee=true; ecrireReglage('inscription_vue', Date.now()); S.modal='inscription'; S.modalDejaVu=true; surcouche(); } }, DELAI_INSCRIPTION);
    }
    return;
  }
  if(d.matiere){
    S.matiereOuverte = decodeURIComponent(d.matiere);
    S.ressourceOuverte = null;
    if(d.chapitre !== undefined) S.lectureReprise = S.matiereOuverte;     // un chapitre précis est demandé : on ne rejoue pas la reprise
    pister('COURSE_OPENED', { matiere: S.matiereOuverte });
    aller('lecture');
    if(d.chapitre !== undefined){
      const cible = document.getElementById('chap-' + d.chapitre);
      if(cible) cible.scrollIntoView({ block:'start' });
    }
    return;
  }
  if(d.musique){ basculerMusique(); return; }
  if(d.feuille){ feuilleComposition(); return; }
  if(d.lireFeuille){ if(feuilleBloquee()) return; lireDocument('Feuille corrigée', htmlFeuilleComposition(), 'copie', feuilleComposition); return; }
  if(d.lireCahier){ lireCahier(); return; }
  if(d.lecteurDl){ const L = S.lecteur; if(L && L.telecharger) L.telecharger(); return; }
  if(d.archive){ feuilleArchive(d.archive); return; }
  if(d.nivinfo !== undefined){ S.nivInfo = (S.nivInfo === +d.nivinfo) ? null : +d.nivinfo; rendre(); return; }
  if(d.toutesCompos !== undefined){ toutesCompositions(); return; }
  if(d.notifs){ ouvrirNotifications(); return; }
  if(d.notifsTout){ marquerNotifsLues(null); return; }
  if(d.notifsVider !== undefined){
    supprimerNotifs(); return;
  }
  if(d.notifLire){ ouvrirNotif((S.notifications || []).find(n => String(n.id) === String(d.notifLire))); return; }
  if(d.partage){ ouvrirPartage(d.partage); return; }
  if(d.partageNatif){ document.getElementById('voile').hidden = true; partager(d.partageNatif); return; }
  if(d.copier){
    const t = decodeURIComponent(d.copier);
    navigator.clipboard.writeText(t).then(() => {
      document.getElementById('voile').hidden = true;
      toast('Lien copié. Collez-le où vous voulez.');
    }).catch(() => toast('Copie impossible sur ce téléphone.'));
    return;
  }
  if(d.fermerPartage){ document.getElementById('voile').hidden = true; S.modal = null; return; }
  if(d.vers){
    const el = document.getElementById(d.vers);
    if(el) el.scrollIntoView({ behavior:'smooth', block:'start' });
    return;
  }
  if(d.bascule){ S.modal = d.bascule; S.erreur=''; if(d.bascule === 'oubli'){ pister('FORGOT_PASSWORD_WHATSAPP', {}); ouvrirWhatsappOubli(); } return surcouche(); }
  if(d.oeil){ S.codeVisible = !S.codeVisible; return surcouche(); }
  if(d.reinitialiser){
    const tel = S.form.tel.replace(/\D/g,''), pin = S.form.pin.replace(/\D/g,''), pin2 = (S.form.pin2||'').replace(/\D/g,'');
    if(tel.length !== 8) S.erreur = "Le numéro doit comporter 8 chiffres.";
    else if(!S.form.couleur) S.erreur = "Choisis la couleur donnée à l'inscription.";
    else if(pin.length !== 4) S.erreur = "Le nouveau mot de passe doit comporter 4 chiffres.";
    else if(pin !== pin2) S.erreur = "Les deux mots de passe ne sont pas identiques.";
    else {
      S.erreur = 'Vérification…'; surcouche();
      base.rpc('reinitialiser_code', { p_telephone: tel, p_couleur: S.form.couleur, p_nouveau: pin })
        .then(r => {
          const d2 = r.data || {};
          if(!d2.ok){ S.bloque = !!d2.bloque; S.erreur = d2.message || "Impossible de changer le code."; return surcouche(); }
          S.erreur = ''; S.modal = 'connexion'; S.form.pin = ''; S.form.pin2 = '';
          surcouche();
          signalCandidat('Mot de passe changé. Connecte-toi avec le nouveau.');
        });
      return;
    }
    return surcouche();
  }
  if(d.toutcahier){ S.cahierFiltre=false; S.cahierDepuisGrille=false; return rendre(); }
  if(d.actu){ S.actuOnglet = d.actu; return rendre(); }
  if(d.actuRepli){
    S.actuRepli = S.actuRepli || {};
    S.actuRepli[S.actuOnglet] = !S.actuRepli[S.actuOnglet];
    rendre();
    /* en repliant, on remonte au début de la liste */
    if(S.actuRepli[S.actuOnglet]){
      const tete = document.getElementById('liste-actu');
      if(tete) tete.scrollIntoView({ block:'start' });
    }
    return;
  }
  if(d.niv){
    S.niveau = d.niv; S.ressources = null; S.banque = null; S.progression = null;
    chargerRessources(); chargerQuestions(true);
    pister('LEVEL_CHANGED', { niveau: d.niv });
    return rendre();
  }
  if(d.lire){ S.ressourceOuverte = d.lire; pister('COURSE_OPENED'); return aller('lecture'); }
  if(d.telecharger){ if(!exigerAbonnement('Le téléchargement des documents fait partie de l\'abonnement.', 'document')) return; telechargerRessource(d.telecharger); return; }
  if(d.mat){
    ecrireReglage('dernierQcm', d.mat);
    S.matiere = d.mat; S.qcmIdx = (S.qcmPos && S.qcmPos[d.mat]) || 0; S.qcmRep=undefined; S.qcmCorrection=null; S.qcmSerie=0; S.qcmDebut=Date.now(); S.ecran='qcm';
    pister('COURSE_STARTED', { matiere: d.mat, niveau: S.niveau });
    return rendre();
  }
  if(d.qcm !== undefined){
    if(S.qcmRep !== undefined) return;
    return repondreQcm(+d.qcm);
  }
  if(d.qsuiv){
    S.qcmIdx++; S.qcmRep=undefined; S.qcmCorrection=null; S.qcmDebut=Date.now();
    S.qcmPos = Object.assign({}, S.qcmPos, { [S.matiere]: S.qcmIdx });
    ecrireReglage('qcmPos', S.qcmPos);
    retenirQcm();
    return ecranQcm();
  }
  if(d.cahierfreq){ S.cahierFiltre=true; S.taches[2]=true; sauverTaches(); return aller('cahier'); }
  if(d.classement){ S.voirClassement = !S.voirClassement; return rendre(); }
  if(d.diagnostic){ S.voirDiagnostic = !S.voirDiagnostic; return rendre(); }
  if(d.defi){ S.voirDefi = !S.voirDefi; return rendre(); }
  if(d.cours){ return; }
  if(d.badges){ S.voirBadges = !S.voirBadges; return rendre(); }
  if(d.themeChoix){
    if(d.themeChoix===S.theme) return;
    document.body.classList.add('en-transition');
    S.theme = d.themeChoix; ecrireReglage('theme', S.theme); rendre();
    clearTimeout(S.tTheme);
    S.tTheme = setTimeout(()=>document.body.classList.remove('en-transition'), 480);
    return;
  }
  if(d.basculeTheme){ return basculerTheme(); }
  if(d.modal){ S.modal = d.modal; S.erreur=''; return surcouche(); }
  if(d.deconnecter){
    S.deconnexionVoulue = true;
    if(base) base.auth.signOut();
    S.util = {nom:'', tel:'', pin:'', connecte:false};
    S.form = {nom:'', tel:'', pin:''};
    S.lus = null; S.lusCharges = false; S.popNatVu = false;
    memoVider(); S.journee = null; S.stats = null; S.details = null; S.classement = null; S.notifications = []; S.cahier = []; S.top = null; S.rappel = null;
    oublierIdentite(); chargerRegleVisiteur();
    const connu = !!(lireMemoire() || {}).dejaVenu;
    S.modalDejaVu = connu;                    // on ne relance pas l'inscription d'un habitué
    return aller(connu ? 'aujourdhui' : 'engagement');
  }
  if(d.cible){
    /* les cours portent parfois un nom de matière différent de la banque */
    const nom = banqueDe(d.cible) ? d.cible : ((S.banque || []).find(m => m.nom.toLowerCase().startsWith(d.cible.toLowerCase().slice(0,5))) || {}).nom || d.cible;
    ecrireReglage('dernierQcm', nom);
    S.matiere = nom; S.qcmIdx = (S.qcmPos && S.qcmPos[nom]) || 0; S.qcmRep=undefined; S.qcmCorrection=null; S.qcmSerie=0; S.qcmDebut=Date.now(); return aller('qcm');
  }
  if(d.test){ S.ecran='test'; pister('DIAGNOSTIC_STARTED'); return rendre(); }
  if(d.tb && !S.testCorrige){
    const [q,i] = d.tb.split('-').map(Number);
    const l = S.testRep[q] || [];
    if(l.includes(i)) return;              // définitif
    S.testRep[q] = [...l, i].sort();
    pister('DIAGNOSTIC_ANSWER_SELECTED', { question: q + 1 });
    return ecranTest();
  }
  if(d.tremettre){
    const sans = 10 - Object.keys(S.testRep).filter(k => (S.testRep[k] || []).length).length;
    if(sans > 0) return confirmerRemise(sans, false, remettreTest);
    return remettreTest();
  }

  if(d.compotab){
    basculerCompoTab(d.compotab);
    return;
  }
  if(d.apercu !== undefined){
    S.apercu = (d.apercu==='fermer' || String(S.apercu)===d.apercu) ? null : +d.apercu;
    return ecranGrille();
  }
  if(d.saut){
    const el = document.getElementById('q'+d.saut);
    if(el) el.scrollIntoView({behavior:'smooth', block:'start'});
    return;
  }
  if(d.b && !S.corrige){
    const [q,i] = d.b.split('-').map(Number);
    const l = S.reponses[q] || [];
    if(l.includes(i)) return;              // définitif : pas de retour en arrière
    S.reponses[q] = [...l, i].sort();
    S.derniereQ = q; S.qRef = q; S.poseScroll = null;
    sauverEpreuve();
    pister('COMPOSITION_ANSWER_SELECTED', { question: q + 1, total: S.grille.length });
    ecranGrille();
    const bulle = document.querySelector('[data-b="' + q + '-' + i + '"]');
    if(bulle) bulle.classList.add('encre');
    return;
  }

  if(d.remettre){
    const rep = Object.keys(S.reponses).filter(k => (S.reponses[k] || []).length).length, sans = S.grille.length - rep;
    if(sans > 0) return confirmerRemise(sans, true, remettre, rep);
    return remettre();
  }

  if(d.recommencer){
    reinitialiserComposition();
    pister('COMPOSITION_RESTARTED', { type: d.recommencer });
    return aller('grille');
  }

  if(d.reprise !== undefined){ repriseIdx=+d.reprise; repriseRep=undefined; return rendre(); }

  if(d.rr !== undefined){
    const i = +d.rr, e = S.cahier[repriseIdx];
    if(!e || repriseRep !== undefined) return;
    repriseRep = i;
    const juste = i === e.i;
    if(juste) sonJuste(); else sonFaux();
    pister('ERROR_REATTEMPTED', { juste });
    programmer(e, juste);                    // affichage immédiat, même règle que le serveur
    if(e.id) compterReponse();
    if(juste && e.suite >= 3) pister('ERROR_FIXED');
    if(e.id){
      corrigerAuServeur(e.id, [i], 'erreurs').then(r => {
        if(r && r.ok && r.correcte !== juste) chargerCahier();   // le serveur fait foi
      });
    }
    return ecranReprise(), nav();
  }

  if(d.fin_reprise || d.finReprise){
    repriseIdx=null; repriseRep=undefined;
    return rendre();
  }
});

/* ---------- bienvenue, puis fenêtres d'invitation (installer, notifications) ----------
   Rien ne tombe d'un coup : le candidat a le temps de découvrir l'application.
   La fenêtre d'inscription vient après 30 secondes, l'installation après 3 minutes,
   les notifications après 5 minutes et demie. Un « Plus tard » repousse de 3 jours. */
const DELAI_INSCRIPTION = 35000;
/* Plus de message flottant en bas de l'écran : le salut est dans l'en-tête de l'accueil. */
function saluerRetour(){}
function bienvenue(){}
const ECRANS_CALMES = ['grille','qcm','test','testIntro','engagement','reprise','pourtoi','defi','resultat','verrou','verrou_d','lecture','paiement','lecteur'];
function peutInviter(){ return !ECRANS_CALMES.includes(S.ecran) && !S.modal && !document.getElementById('invitation') && !enComposition(); }
function fenetreInvitation(o){
  const z = document.createElement('div');
  z.id = 'invitation'; z.setAttribute('role', 'dialog'); z.setAttribute('aria-modal', 'true'); z.setAttribute('aria-label', o.titre);
  /* o.obligatoire : pas de bouton « Plus tard » ni de fermeture en touchant le fond */
  z.innerHTML = '<div class="inv-carte"><div class="inv-ic">' + (o.icone === 'whatsapp' ? logoReseau('whatsapp') : ico(o.icone, 26)) + '</div><h2>' + E(o.titre) + '</h2><p>' + E(o.texte) + '</p>' +
    '<button type="button" class="cta inv-oui">' + E(o.oui) + '</button>' +
    (o.obligatoire ? '' : '<button type="button" class="lien-mini inv-non">Plus tard</button>') + '</div>';
  document.body.appendChild(z);
  const noter = () => ecrireReglage('inv_' + o.cle, Date.now());
  const fermer = () => { z.remove(); noter(); };
  z.querySelector('.inv-oui').onclick = () => {
    z.remove(); noter();
    if(!o.sansFait) ecrireReglage('inv_' + o.cle + '_fait', true);
    try{ o.action(); }catch(e){}
  };
  if(!o.obligatoire){
    z.querySelector('.inv-non').onclick = fermer;
    z.addEventListener('click', e => { if(e.target === z) fermer(); });
  }
  noter();
  pister('INVITATION_SHOWN', { cle:o.cle, rappel:o.rappel || 0 });
}
/* une invitation déjà « faite » ne revient plus ; sinon, jamais deux fois à moins de 4 minutes d'écart */
function invitationPossible(cle, ecart){
  const r = lireReglages();
  if(r['inv_' + cle + '_fait']) return false;
  const t = r['inv_' + cle];
  return !(t && Date.now() - t < (ecart === undefined ? 240000 : ecart));
}
const TEXTES_WHATSAPP = [
  { titre:'Rejoignez la communauté', texte:'Intégrez la communauté WhatsApp de Mon Concours pour rester informé : dates des concours, compositions nationales, nouveautés.' },
  { titre:'Vous avez oublié quelque chose', texte:'Vous avez oublié de vous intégrer dans le groupe WhatsApp de Mon Concours. C\'est là que sont annoncées les dates et les nouveautés.' },
  { titre:'Ne ratez pas les annonces', texte:'Vous n\'êtes toujours pas dans la communauté WhatsApp de Mon Concours. Rejoignez-la en un geste pour ne rien manquer.' }
];
function notifsAEncourager(){
  return S.util.connecte && pushPossible() && 'Notification' in window && Notification.permission !== 'denied' &&
    !(S.rappel && S.rappel.actif && Notification.permission === 'granted');
}
function planifierInvitations(){
  const essayer = (delai, cle, condition, config, ecart) => setTimeout(function tente(essais){
    if(!condition() || !invitationPossible(cle, ecart)) return;
    if(!peutInviter()){ essais = (essais || 0) + 1; if(essais < 30) setTimeout(() => tente(essais), 20000); return; }
    fenetreInvitation(Object.assign({ cle }, config));
  }, delai);
  /* installation : vers 1 minute, sans bouton « Plus tard » ; si le téléphone refuse, on redemande après 1 heure */
  essayer(180000, 'install', () => !estInstallee() && !CONTACT.playStore,
    { icone:'telecharger', titre:'Installer Mon Concours', texte:'Installez l\'application sur votre téléphone : elle s\'ouvre comme une application, même avec peu de réseau.',
      oui:'Installer l\'application', obligatoire:true, sansFait:true, action: () => installerAppli() }, 3600000);
  /* communauté WhatsApp : 2 minutes, 10 minutes, 1 heure ; plus jamais une fois rejointe */
  [300000, 900000, 3600000].forEach((d, i) => essayer(d, 'whatsapp', () => !!CONTACT.canal,
    { icone:'whatsapp', titre:TEXTES_WHATSAPP[i].titre, texte:TEXTES_WHATSAPP[i].texte, oui:'Rejoindre la communauté', rappel:i,
      action: () => { window.open(CONTACT.canal, '_blank', 'noopener'); pister('WHATSAPP_JOINED_CLICK', {}); } }, 120000));
  /* notifications : mêmes moments, décalés d'une minute pour ne pas empiler deux fenêtres ; s'arrête dès qu'elles sont acceptées */
  const TEXTES_NOTIFS = [
    'Autorisez les notifications : Mon Concours vous prévient, même quand vous êtes sur Facebook ou WhatsApp, pour le rappel du soir, vos résultats et les compositions nationales.',
    'Vous n\'avez pas encore autorisé les notifications. Sans elles, vous ne serez pas prévenu des compositions ni de vos rappels.',
    'Dernier rappel : autorisez les notifications pour recevoir vos rappels et ne pas rater la composition nationale.'
  ];
  [420000, 1200000, 3660000].forEach((d, i) => {
    setTimeout(() => { if(S.util.connecte && !S.rappel) chargerRappel(); }, d - 15000);
    essayer(d, 'notifs', notifsAEncourager,
      { icone:'cloche', titre:i ? 'Notifications toujours coupées' : 'Être prévenu à temps', texte:TEXTES_NOTIFS[i], oui:'Autoriser les notifications', rappel:i, sansFait:true,
        action: () => activerRappel(18, 0) }, 120000);
  });
}
planifierInvitations();
/* Juste après la création du compte, quand l'envie est la plus forte : la demande d'autorisation des notifications.
   C'est ce qui permet à Mon Concours d'apparaître par-dessus Facebook ou WhatsApp. */
function invitationNotifsApresInscription(){
  if(!notifsAEncourager() || !peutInviter() || !invitationPossible('notifs', 60000)) return;
  fenetreInvitation({ cle:'notifs', icone:'cloche', titre:'Être prévenu à temps',
    texte:'Autorisez les notifications : Mon Concours s\'affiche même quand vous êtes sur Facebook ou WhatsApp, pour votre rappel du soir, vos résultats et la composition nationale.',
    oui:'Autoriser les notifications', rappel:0, sansFait:true, action: () => activerRappel(18, 0) });
}

/* Inscription : un visiteur qui n'a pas de compte la voit assez vite, même s'il est déjà venu.
   Une fois par visite au plus, et pas plus d'une fois toutes les 6 heures. */
(function planifierInscription(){
  const tente = essais => {
    if(S.util.connecte || S.inscriptionProposee) return;
    const r = lireReglages();
    if(r.inscription_vue && Date.now() - r.inscription_vue < 6 * 3600000) return;
    if(!peutInviter()){ essais = (essais || 0) + 1; if(essais < 40) setTimeout(() => tente(essais), 10000); return; }
    S.inscriptionProposee = true; S.modalDejaVu = true;
    ecrireReglage('inscription_vue', Date.now());
    S.modal = 'inscription'; surcouche();
  };
  setTimeout(() => tente(0), 40000);
})();


/* =====================================================================
   PARCOURS ÉLITE (12 novembre 2026)
   Élite 1 : les meilleures pièces des anciens parcours. Note cachée jusqu'à l'inscription,
     feuille corrigée juste après, « Reprendre mes fautes maintenant », plan de rattrapage sans prix.
   Notifications et application : proposées à tout le monde dès le premier jour (décision du 12 novembre),
     à chaque moment de réussite (note du test, fautes reprises, séance finie, inscription à la nationale).
   Élite 2 : construit sur ce que les candidats font vraiment (base du 12 novembre).
     Le premier jour, on pratique tout de suite : reprise des fautes du test, puis « encore 5 »,
     et la prochaine composition nationale. L'accueil met la séance, les erreurs et la composition
     avant l'actualité. Les prix n'apparaissent qu'aux limites, dans les deux parcours.
   ===================================================================== */
function estElite(){ return S.parcours === 'E1' || S.parcours === 'E2'; }
function estE2(){ return S.parcours === 'E2'; }
/* Élite 1 : le plan de rattrapage, sans aucun prix */
function blocPlanRattrapage(faibles){
  const nf = fautesDuTest().length;
  const mat = faibles.length ? E(faibles[0]) : 'les matières du concours';
  const ep = S.epreuve && S.epreuve.etat === 'a_venir' ? S.epreuve : null;
  return `<div class="bonne-nouvelle plan-elite" style="margin-top:18px">
    <h2>Ton plan pour les prochains jours</h2>
    <ol class="actions-diag">
      <li><b>Aujourd'hui : ${nf ? 'tes ' + nf + ' faute' + (nf > 1 ? 's' : '') + ' du test' : 'ta première séance'}.</b> ${nf ? 'Une par une, avec l\'explication. Elles sont déjà dans « Mes erreurs ».' : 'Cinq questions de ton niveau, environ 2 minutes.'}</li>
      <li><b>Les trois jours suivants : 10 questions par jour en ${mat}.</b> C'est là que tu as perdu le plus de points. Dix minutes suffisent.</li>
      <li><b>${ep ? E(dateLongue(ep.debut_le)) + ' à ' + heureH(ep.debut_le) : 'Samedi soir'} : la composition nationale.</b> 50 questions en 40 minutes, avec ton rang parmi tous les candidats.</li>
    </ol>
  </div>`;
}
/* Élite 2 : ce qui suit la reprise des fautes, le premier jour */
function suiteElite2(depuis){
  const ep = S.epreuve && (S.epreuve.etat === 'a_venir' || S.epreuve.etat === 'en_cours') ? S.epreuve : null;
  return (ep ? `<div class="bloc"><div class="libelle">Ton prochain rendez-vous</div>${carteEpreuve()}</div>` : '') + lignesSuiteX(depuis);
}
/* Élite 2 : les tâches du jour, dans l'ordre où les candidats travaillent vraiment */
function tachesElite2(){
  const fait = seanceXFaite(), dues = S.cahier.filter(e => e.suite < 3 && joursRestants(e) === 0).length, ep = S.epreuve;
  const nat = ep && ep.etat === 'a_venir' ? (ep.inscrit ? 'Inscrit · ' + E(jourCourtNat(ep.debut_le)) + ' à ' + heureH(ep.debut_le) : E(jourCourtNat(ep.debut_le)) + ' à ' + heureH(ep.debut_le) + ' · inscription gratuite')
    : ep && ep.etat === 'en_cours' ? 'En cours : entrez en salle' : 'Une épreuve chronométrée sur la feuille de réponses';
  const ligne = (ok, num, attr, titre, texte, duree) => `<button class="etape ${ok ? 'fait' : 'actif'}" ${attr}>
      <div class="puce">${ok ? '✓' : num}</div>
      <div><h3>${titre}</h3><p>${texte}</p><span class="dur">${duree}</span></div>
      <span class="fl-tache" aria-hidden="true">→</span></button>`;
  return `<div class="bloc taches-e2"><div class="libelle">Ta journée</div><div class="carte">
    ${ligne(fait, 1, 'data-xseance="accueil"', 'Ma séance', fait ? 'Faite aujourd\'hui. Tu peux en refaire une.' : 'Tes erreurs d\'abord, puis des questions de ton niveau.', '2 min')}
    ${ligne(!dues, 2, 'data-cahierfreq="1"', 'Mes erreurs du jour', dues ? dues + ' question' + (dues > 1 ? 's' : '') + ' à revoir aujourd\'hui.' : 'Rien à revoir aujourd\'hui.', '5 min')}
    ${ligne(!!(ep && ep.inscrit), 3, ep && ep.etat === 'en_cours' ? `data-rejoindre="${E(ep.id)}"` : (ep && ep.etat === 'a_venir' && !ep.inscrit ? `data-inscrire-nat="${E(ep.id)}"` : 'data-go="grille"'), 'La composition', nat, '40 min')}
  </div></div>`;
}

/* =====================================================================
   PARCOURS XX1 — groupe de test, par lots de 100 nouveaux visiteurs.
   Jour 1 : reprise directe des fautes du test, une par une, avec la
   correction ; puis une récompense, et seulement après : rappel,
   installation, séance du jour. Chaque jour : « Ma séance du jour ».
   Les parcours A, B, C, D ne passent jamais par ici.
   ===================================================================== */
function estXX1(){ return S.parcours === 'X'; }
var ONGLETS_X = [
  {id:'aujourdhui', g:'actualite', l:'Aujourd\'hui'},
  {id:'revisions',  g:'revisions', l:'Mes cours'},
  {id:'grille',     g:'grille',    l:'Composer'},
  {id:'cahier',     g:'erreurs',   l:'Mes erreurs'},
  {id:'compte',     g:'compte',    l:'Moi'}
];
/* le groupe est noté sur le compte, pour comparer les groupes entre eux */
function noterParcoursCompte(){
  if(!S.parcours || !base) return;
  const p = S.parcours + (lireReglages().apercuX ? '-apercu' : '');
  try{ base.rpc('noter_parcours', { p_parcours: p }).then(() => {}, () => {}); }catch(e){}
}
function fautesDuTest(){
  const f = [];
  TEST.forEach((g, i) => { const r = S.testRep[i] || []; if(!(r.length === 1 && r[0] === g.i)) f.push(i); });
  return f;
}
function lancerRepriseX(){
  const liste = fautesDuTest();
  S.xr = { liste, idx:0, rep:undefined, justes:0 };
  pister('XX1_REPRISE_OUVERTE', { fautes: liste.length, note: S.testNote });
  aller(liste.length ? 'xreprise' : 'xbravo');
}
/* série : un jour compte dès qu'une reprise ou une séance est faite */
function joursX(){ const l = lireReglages().joursX; return Array.isArray(l) ? l : []; }
function noterJourX(){
  const j = new Date().toDateString(), l = joursX();
  if(!l.includes(j)){ l.push(j); ecrireReglage('joursX', l.slice(-60)); }
}
function serieX(){
  const l = new Set(joursX()), d = new Date();
  if(!l.has(d.toDateString())) d.setDate(d.getDate() - 1);
  let n = 0;
  while(l.has(d.toDateString())){ n++; d.setDate(d.getDate() - 1); }
  return n;
}
const seanceXFaite = () => lireReglages().seanceXJour === new Date().toDateString();

function ecranRepriseX(){
  const x = S.xr;
  if(!x){
    if(S.testNote === null || S.testNote === undefined || !Object.keys(S.testRep || {}).length){ S.ecran = 'aujourdhui'; return ecranAujourdhui(); }
    const liste = fautesDuTest(); S.xr = { liste, idx:0, rep:undefined, justes:0 };
    return ecranRepriseX();
  }
  if(x.idx >= x.liste.length){ S.ecran = 'xbravo'; return ecranBravoX(); }
  const qi = x.liste[x.idx], g = TEST[qi], avant = (S.testRep[qi] || []).map(k => g.o[k]).join(' + ');
  const rep = x.rep, repondu = rep !== undefined, juste = repondu && rep === g.i;
  const k = x.liste.length;
  vue().innerHTML = `
  <div class="pad" style="padding-top:18px">
    <div class="xr-tete">
      <span class="pastille-etape">Ta note au test : <b class="num">${S.testNote}/10</b></span>
      <span class="eyebrow num">${x.idx + 1} / ${k}</span>
    </div>
    <div class="progression" style="margin:10px 0 14px"><i class="on" style="flex:${x.idx + (repondu ? 1 : 0)}"></i><i style="flex:${k - x.idx - (repondu ? 1 : 0)}"></i></div>
    ${x.idx === 0 && !repondu ? `<h1 class="titre" style="font-size:22px;margin-bottom:6px">On reprend tes ${k} faute${k > 1 ? 's' : ''}, une par une</h1>
      <p class="sous" style="margin:0 0 14px">C'est là que tu gagnes des points le plus vite. Chaque question est corrigée et expliquée.</p>` : ''}
    <div class="eyebrow" style="margin-bottom:6px">${E(g.d)}</div>
    <div class="qtexte">${E(g.q)}</div>
    ${!repondu ? `<p class="sous xr-avant">Au test, tu avais répondu ${avant ? '« ' + E(avant) + ' »' : 'rien'}. Essaie à nouveau.</p>` : ''}
    ${g.o.map((o, i) => {
      let c = '';
      if(repondu){ if(i === g.i) c = 'juste'; else if(i === rep) c = 'faux'; }
      return `<button class="opt ${c}" ${repondu ? 'disabled' : ''} data-xr-rep="${i}"><span class="lettre">${'ABCD'[i]}</span>${E(o)}</button>`;
    }).join('')}
    ${repondu ? `<div class="retour ${juste ? 'bien' : 'mal'}">
        <b>${juste ? 'Juste, cette fois' : 'Pas encore'}</b>
        ${juste ? '' : `<div style="margin-bottom:6px">La bonne réponse : <strong class="bonne-rep">${'ABCD'[g.i]}. ${E(g.o[g.i])}</strong></div>`}
        ${g.e ? `<b style="margin-top:2px">Pourquoi ?</b>${E(g.e)}` : ''}
        <div style="margin-top:6px;font-size:12.5px">${juste ? 'Elle reste dans « Mes erreurs » pour être revue une fois encore, puis elle sort.' : 'Elle reste dans « Mes erreurs » : elle reviendra jusqu\'à être acquise.'}</div>
      </div>
      <button class="cta" style="margin-top:14px" data-xr-suiv="1">${x.idx + 1 < k ? 'Faute suivante' : 'Voir mon bilan'}</button>` : ''}
  </div>`;
}

/* les invitations arrivent après la récompense, jamais avant */
function lignesSuiteX(depuis){
  const l = [];
  if(etatRappel() === 'possible') l.push(`<button class="etape actif" data-xnotifs="${depuis}">
      <div class="puce">${ico('cloche', 15)}</div>
      <div><h3>Me rappeler ma séance demain à 18 h</h3><p>Une notification, même quand tu es sur WhatsApp ou Facebook.</p></div>
      <span class="fl-tache" aria-hidden="true">→</span></button>`);
  if(!estInstallee()) l.push(`<button class="etape" data-xinstall="${depuis}">
      <div class="puce">${ico('telecharger', 15)}</div>
      <div><h3>Mettre Mon Concours sur mon écran d'accueil</h3><p>Il s'ouvre comme une application, même avec peu de réseau.</p></div>
      <span class="fl-tache" aria-hidden="true">→</span></button>`);
  return l.length ? `<div class="bloc"><div class="libelle">Pour ne rien rater</div><div class="carte">${l.join('')}</div></div>` : '';
}

function ecranBravoX(){
  noterJourX();
  const x = S.xr || { liste:[], justes:0 }, k = x.liste.length, j = x.justes, reste = k - j, s = serieX() || 1;
  if(!x.vu){ x.vu = true; pister('XX1_BRAVO_VU', { justes: j, fautes: k }); }
  vue().innerHTML = `
  <div class="pad" style="padding-top:22px">
    <div class="pastille-etape">${estE2() ? 'Ta note au test : ' + S.testNote + '/10 · jour 1 fait' : 'Jour 1 · fait'}</div>
    <div class="x-bravo">
      <div class="xb-serie">${ico('flamme', 26)}<span><b class="num">${s}</b> jour${s > 1 ? 's' : ''} de suite</span></div>
      <h1 class="titre" style="font-size:25px;margin:12px 0 6px">${!k ? 'Aucune faute au test' : (j === k ? 'Toutes tes fautes sont reprises' : j + ' faute' + (j > 1 ? 's' : '') + ' reprise' + (j > 1 ? 's' : '') + ' juste' + (j > 1 ? 's' : '') + ' sur ' + k)}</h1>
      <p class="sous" style="margin:0">${!k ? 'Belle copie. Ta séance du jour va te faire travailler au niveau du concours.'
        : reste ? (reste > 1 ? `Les ${reste} qui résistent restent dans « Mes erreurs ». Tu les reverras jusqu'à ce qu'elles soient acquises.` : 'Celle qui résiste reste dans « Mes erreurs ». Tu la reverras jusqu\'à ce qu\'elle soit acquise.')
        : 'Tu as compris chacune de tes fautes. Ta séance du jour continue sur les questions de ton niveau.'}</p>
    </div>
    <div class="duo" style="margin-top:14px">
      <div class="stat"><div class="v num">${S.testNote}/10</div><div class="l">Note au test</div></div>
      <div class="stat"><div class="v num">${j}/${k}</div><div class="l">Fautes reprises justes</div></div>
    </div>
    <button class="cta" style="margin-top:16px" data-xseance="bravo">Continuer : ma séance du jour<small>5 questions choisies pour toi · environ 2 min</small></button>
    ${estE2() ? suiteElite2('bravo') : lignesSuiteX('bravo')}
    <button class="lien" style="display:block;margin:14px auto 0" data-go="resultat">Revoir ma note et ma feuille corrigée</button>
    <button class="lien" style="display:block;margin:6px auto 0" data-go="aujourdhui">Aller à l'accueil</button>
  </div>`;
}

function lancerSeanceX(){
  lancerFil(5);
  if(S.fil){ S.fil.titre = 'MA SÉANCE DU JOUR'; S.fil.seanceX = true; }
  if(S.ecran === 'pourtoi') rendre();
}

function finSeanceX(f, tete){
  if(!f.finNotee){
    f.finNotee = true; ecrireReglage('seanceXJour', new Date().toDateString()); noterJourX();
    pister('XX1_SEANCE_FINIE', { justes: f.justes, n: f.liste.length });
  }
  const s = serieX() || 1, payant = estAbonnePaye() || S.gratuit;
  vue().innerHTML = tete('MA SÉANCE DU JOUR · FAITE') + `<div class="qzone" style="padding-top:18px">
    <div class="x-bravo">
      <div class="xb-serie">${ico('flamme', 26)}<span><b class="num">${s}</b> jour${s > 1 ? 's' : ''} de suite</span></div>
      <h1 class="titre" style="font-size:25px;margin:12px 0 6px">Séance faite : ${f.justes} sur ${f.liste.length}</h1>
      <p class="sous" style="margin:0">${s > 1 ? 'Ta série tient. Reviens demain pour la garder.' : 'Le premier jour est le plus dur. Demain, une nouvelle séance t\'attend.'}</p>
    </div>
    <div class="duo" style="margin-top:14px">
      <div class="stat"><div class="v num">${f.justes}</div><div class="l">Bonnes réponses</div></div>
      <div class="stat"><div class="v num">${f.revues}</div><div class="l">Erreurs revues</div></div>
    </div>
    ${(f.fautes || []).length ? `<div class="bloc"><div class="libelle">À retenir avant de partir</div>
      ${f.fautes.slice(0, 3).map(x => `<div class="err" style="margin-bottom:8px"><div class="q" style="font-size:13.5px">${E(x.q)}</div><div class="ligne">Bonne réponse : <b>${E(x.bon)}</b></div></div>`).join('')}</div>` : ''}
    ${estE2() ? suiteElite2('seance') : lignesSuiteX('seance')}
    ${payant || estElite() ? '' : `<div class="carte xs-offre">
      <h3>Tu veux aller plus loin aujourd'hui ?</h3>
      <p class="sous">Avec l'abonnement : corrections sans limite, compositions chronométrées avec ton classement, et la feuille corrigée de tes erreurs en PDF.</p>
      <button class="cta creux" style="margin-top:10px" data-go="abonnement">Voir l'abonnement</button>
    </div>`}
    <button class="cta" style="margin-top:14px" data-pourtoi="5">Encore 5 ?<small>5 autres questions, environ 2 minutes</small></button>
    <button class="cta creux" style="margin-top:9px" data-go="aujourdhui">Revenir à l'accueil</button>
  </div>`;
}

function blocSeanceX(){
  if(!S.util.connecte) return '';
  const fait = seanceXFaite(), s = serieX();
  return `<div class="carte seance-x${fait ? ' fait' : ''}">
    <div class="sx-tete"><span class="eyebrow">Ma séance du jour</span>${s ? `<span class="sx-serie">${ico('flamme', 14)} <b class="num">${s}</b> jour${s > 1 ? 's' : ''}</span>` : ''}</div>
    <h2>${fait ? 'Séance faite aujourd\'hui' : '5 questions, environ 2 minutes'}</h2>
    <p class="sous">${fait ? 'Reviens demain pour garder ta série. Tu peux en refaire une maintenant.' : 'Tes erreurs à reprendre d\'abord, puis des questions nouvelles de ton niveau.'}</p>
    <button class="cta" style="margin-top:10px" data-xseance="accueil">${fait ? 'Encore une séance' : (s ? 'Commencer ma séance' : 'Commencer ma première séance')}</button>
    <button class="lien-mini" style="margin-top:8px" data-go="revisions">${ico('revisions', 13)} Mes cours</button>
  </div>`;
}



/* =====================================================================
   MUR DES NOTIFICATIONS — obligatoire pour tout candidat connecté.
   La fenêtre ne se ferme que par l'activation. Seul cas de sortie : un
   appareil qui ne sait pas du tout recevoir de notifications.
   Pour l'arrêter : NOTIFS_OBLIGATOIRES = false.
   ===================================================================== */
const NOTIFS_OBLIGATOIRES = false;
function murNotifsEtat(){
  if(!S.util.connecte) return 'ok';
  if(!pushPossible()) return 'impossible';
  if(Notification.permission === 'denied') return 'refuse';
  if(Notification.permission === 'granted' && S.rappel && S.rappel.actif) return 'ok';
  if(!S.rappelCharge) return 'attente';
  return 'possible';
}
function murNotifsHtml(etat){
  const iphone = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  let titre = 'Activez les notifications', texte = 'Pour continuer, autorisez les notifications. Vous serez prévenu de chaque composition nationale, de vos résultats et de votre classement, même quand l\'application est fermée.', bouton = 'Activer les notifications', plus = '';
  if(etat === 'refuse'){
    /* le navigateur ne laisse plus redemander : on guide, pas à pas, vers les réglages du site */
    titre = 'Autorisez les notifications';
    texte = 'Elles sont bloquées sur ce téléphone.\n1) Touchez le cadenas à côté de l\'adresse du site.\n2) Touchez « Notifications » ou « Autorisations ».\n3) Choisissez « Autoriser ».\nRevenez ensuite ici.';
    bouton = 'C\'est fait, continuer';
    plus = (S.murEssais || 0) >= 3 ? '<button class="lien" style="display:block;margin:12px auto 0" data-mur="passer">Plus tard</button>' : '';
  } else if(etat === 'impossible'){
    const installee = estInstallee();
    if(installee){
      titre = 'Notifications indisponibles';
      texte = 'Ce téléphone ne peut pas recevoir les notifications. Vous pouvez continuer, vous verrez vos résultats et vos rappels dans l\'application.';
      bouton = ''; plus = '<button class="cta" data-mur="passer">Continuer</button>';
    } else {
      titre = 'Installez l\'application';
      texte = iphone
        ? 'Sur iPhone, les notifications ne marchent que depuis l\'application installée. Installez Mon Concours sur l\'écran d\'accueil, puis ouvrez-le depuis son icône.'
        : 'Ce navigateur ne peut pas envoyer de notifications. Installez l\'application Mon Concours : elles marcheront ensuite.';
      bouton = iphone ? 'Voir comment installer' : 'Installer l\'application';
      plus = '<button class="lien" style="display:block;margin:12px auto 0" data-mur="passer">Plus tard</button>';
    }
  }
  return `<div class="fe-carte">
    <div class="fe-badge" aria-hidden="true">🔔</div>
    <div class="fe-marque">Mon Concours · Obligatoire</div>
    <h2 class="fe-titre">${titre}</h2>
    <p class="fe-texte fe-long" style="white-space:pre-line">${E(texte)}</p>
    ${bouton ? `<button class="cta" data-mur="${etat === 'impossible' ? 'installer' : 'activer'}">${bouton}</button>` : ''}
    <p class="fe-texte" id="mur-install" hidden style="margin-top:12px;font-size:13px"></p>
    <p class="fe-texte" id="mur-aide" hidden style="margin-top:12px;font-size:13px">Si rien ne s'affiche : touchez le cadenas à côté de l'adresse du site, puis Notifications, puis Autoriser. Revenez ensuite et touchez de nouveau le bouton.</p>${plus}
  </div>`;
}
function verifierMurNotifs(){
  let m = document.getElementById('mur-notifs');
  if(!NOTIFS_OBLIGATOIRES){ if(m) m.remove(); return; }
  const etat = murNotifsEtat();
  const enInstall = !estInstallee() && new URLSearchParams(location.search).has('installer') && S.modal === 'rappel';
  /* autour d'une composition nationale (30 min avant → 5 min après la fin) : jamais de blocage, rien ne doit gêner l'entrée en salle */
  const ep = S.epreuve, tNow = Date.now();
  const autourCompo = !!(ep && ep.debut_le && tNow >= new Date(ep.debut_le).getTime() - 30 * 60000 && tNow <= new Date(ep.fin_le || ep.debut_le).getTime() + 5 * 60000);
  const enCours = autourCompo || enInstall || enComposition() || (S.ecran === 'grille' && !S.corrige && Object.keys(S.reponses || {}).length > 0);
  const bloque = etat === 'possible' || (etat === 'refuse' && !S.murPasse) || (etat === 'impossible' && !S.murPasse);
  if(!bloque || enCours){
    if(m){ if(bloque && enCours) m.style.display = 'none'; else m.remove(); }
    return;
  }
  if(!m){
    m = document.createElement('div');
    m.id = 'mur-notifs'; m.className = 'fenetre-evt annonce mur-notifs vu';
    m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Activer les notifications');
    m.addEventListener('click', async e => {
      const b = e.target.closest('[data-mur]'); if(!b) return;
      if(b.dataset.mur === 'passer'){ S.murPasse = true; pister('MUR_NOTIFS_PASSE', {}); m.remove(); return; }
      if(b.dataset.mur === 'installer'){
        pister('MUR_NOTIFS_INSTALL', { systeme: /iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'ios' : 'autre' });
        const aide = txt => { const h = document.getElementById('mur-install'); if(h){ h.textContent = txt; h.hidden = false; } };
        const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
        if(S.installer){ S.installer.prompt(); S.installer.userChoice.then(() => { S.installer = null; }); return; }
        if(ios) return aide('Ouvrez ce site dans Safari. Touchez le bouton Partager (le carré avec une flèche), puis « Sur l\'écran d\'accueil ». Ouvrez ensuite Mon Concours depuis son icône.');
        const manuel = 'Cherchez l\'icône Mon Concours sur l\'écran d\'accueil de votre téléphone : elle est peut-être déjà installée. Touchez-la pour ouvrir l\'application.';
        if(/Android/i.test(navigator.userAgent) && new URLSearchParams(location.search).get('via') !== 'chrome'){
          ouvrirDansChrome(); setTimeout(() => { if(!document.hidden) aide(manuel); }, 2200); return;
        }
        return aide(manuel);
      }
      b.disabled = true;
      try{
        await activerRappel(18, 0);
        if(Notification.permission === 'granted' && S.rappel && S.rappel.actif) pister('MUR_NOTIFS_ACTIVE', {});
        else {
          const h = document.getElementById('mur-aide'); if(h){ if(Notification.permission === 'denied') h.textContent = 'Toujours bloqué. Suivez les 3 étapes ci-dessus, puis revenez ici.'; h.hidden = false; }
          S.murEssais = (S.murEssais || 0) + 1;
          pister('MUR_NOTIFS_ECHEC', { permission: (window.Notification && Notification.permission) || 'aucune', essai: S.murEssais });
          if(S.murEssais === 3){ const mm = document.getElementById('mur-notifs'); if(mm) mm.dataset.etat = ''; }
        }
      }catch(err){}
      b.disabled = false; verifierMurNotifs();
    });
    document.body.appendChild(m);
    pister('MUR_NOTIFS_VU', { etat });
  }
  m.style.display = '';
  if(m.dataset.etat !== etat){ m.dataset.etat = etat; m.innerHTML = murNotifsHtml(etat); }
}
function majMur(){ const m = document.getElementById('mur-notifs'); if(m) m.dataset.etat = ''; verifierMurNotifs(); }
setInterval(verifierMurNotifs, 2500);
document.addEventListener('visibilitychange', () => { if(!document.hidden) verifierMurNotifs(); });

ouvrirLienDirect();
setTimeout(inviterNotifsPremiereOuverture, 9000);
rendre();

/* Les parcours actifs tournent par blocs de 50 nouveaux visiteurs : normal, B, Élite 1, Élite 2 (le serveur compte) */
async function assignerParcours(){
  if(S.parcours){ pister('PARCOURS_ASSIGNE', { parcours: S.parcours, deja: true }); return; }
  if(testDejaFait() || S.util.connecte || !base) return;
  try{
    const { data } = await base.rpc('attribuer_parcours');
    if(PARCOURS_CONNUS.includes(data)){
      S.parcours = data; ecrireReglage('parcours', data);
      pister('PARCOURS_ASSIGNE', { parcours: data });
    }
  }catch(e){}
}
setTimeout(assignerParcours, 1500);

/* =====================================================================
   LA SURPRISE — toutes les 20 minutes d'utilisation, jamais en pleine composition.
   Elle ne déplace personne : une carte discrète propose, le candidat décide. La question
   s'ouvre PAR-DESSUS l'écran où il était ; « Revenir où j'étais » referme et il y est encore.
   ===================================================================== */
const SURPRISE_SECONDES = 1200, SURPRISE_SANS = ['test','testIntro','verrou','verrou_d','engagement','inscription','connexion','paiement','grille'];
const SURPRISE_GENRES = {
  concours: { titre:'Tombée au vrai concours', accroche:'Une question comme celles du vrai concours.' },
  piege:    { titre:'Le piège du jour',        accroche:'Beaucoup se trompent sur celle-ci.' },
  bonus:    { titre:'Question bonus',          accroche:'Une question en plus, pour le plaisir de progresser.' }
};
let SUP = { carte:null, plein:null, q:null, rep:undefined, c:null, ouvert:false };
function surprisePossible(){
  return !!base && !document.hidden && !SUP.ouvert && !S.modal && !enComposition() && !SURPRISE_SANS.includes(S.ecran) && !document.getElementById('invitation');
}
function surpriseCarte(){
  if(SUP.carte) return;
  const d = document.createElement('div');
  d.className = 'sup-carte'; d.id = 'sup-carte'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'Une surprise');
  d.innerHTML = `<div class="sup-pastille">${ico('etoile', 20)}</div>
    <div class="sup-texte"><b>Une surprise t'attend</b><span>Une question rien que pour toi, 30 secondes.</span></div>
    <button type="button" class="sup-voir" data-sup="voir">Voir la surprise</button>
    <button type="button" class="sup-x" data-sup="plus-tard" aria-label="Plus tard">✕</button>`;
  document.body.appendChild(d); SUP.carte = d;
  const nav = document.getElementById('nav');
  d.style.setProperty('--nav-h', ((nav && nav.offsetHeight) || 0) + 'px');
  pister('SURPRISE_PROPOSEE', { ecran: S.ecran });
}
function surpriseFermerCarte(){ if(SUP.carte){ SUP.carte.remove(); SUP.carte = null; } }
function surpriseRendre(){
  const q = SUP.q, c = SUP.c, g = SURPRISE_GENRES[q.genre] || SURPRISE_GENRES.bonus;
  const fin = c && c.ok;
  SUP.plein.innerHTML = `<div class="sup-pad">
    <div class="sup-tete"><span class="tampon t-att">${E(g.titre)}${q.genre === 'concours' && q.annee ? ' · ' + E(String(q.annee)) : ''}</span><span class="eyebrow">${E(q.matiere || '')}</span></div>
    <p class="sous" style="margin:0 0 12px">${E(g.accroche)}</p>
    <div class="qtexte">${E(q.enonce)}</div>
    ${(q.options || []).map((o, i) => {
      let k = '';
      if(fin){ if(i === c.bonne) k = 'juste'; else if(i === SUP.rep) k = 'faux'; }
      else if(i === SUP.rep) k = 'choisi attente';
      return `<button class="opt ${k}" ${SUP.rep !== undefined ? 'disabled' : ''} data-sup-rep="${i}"><span class="lettre">${'ABCD'[i] || '•'}</span>${E(o)}</button>`;
    }).join('')}
    ${fin ? `<div class="retour ${c.correcte ? 'bien' : 'mal'}"><b>${c.correcte ? 'Bonne réponse' : 'Réponse incorrecte'}</b>
        ${c.correcte ? '' : `<div style="margin-bottom:6px">La bonne réponse : <strong class="bonne-rep">${'ABCD'[c.bonne]}. ${E(q.options[c.bonne])}</strong></div>`}
        ${c.explication ? `<b style="margin-top:2px">Pourquoi ?</b>${E(c.explication)}` : ''}</div>` : ''}
    ${c && !c.ok ? `<div class="retour mal"><b>Correction indisponible</b>Vérifie ta connexion.</div>` : ''}
    <button type="button" class="cta" style="margin-top:16px" data-sup="retour">${fin || (c && !c.ok) ? 'Revenir où j\'étais' : 'Plus tard : revenir où j\'étais'}</button>
  </div>`;
}
async function surpriseOuvrir(){
  surpriseFermerCarte();
  SUP.ouvert = true; SUP.rep = undefined; SUP.c = null;
  let q = null;
  try{ const { data } = await base.rpc('surprise_tirer', { p_niveau: niveauCand() }); if(data && data.ok) q = data; }catch(e){}
  if(!q){ SUP.ouvert = false; return; }
  SUP.q = q;
  const p = document.createElement('div'); p.className = 'sup-plein'; p.id = 'sup-plein';
  p.setAttribute('role', 'dialog'); p.setAttribute('aria-modal', 'true');
  document.body.appendChild(p); SUP.plein = p;
  surpriseRendre();
  pister('SURPRISE_OUVERTE', { genre: q.genre });
}
function surpriseRetour(){
  if(SUP.plein){ SUP.plein.remove(); SUP.plein = null; }
  SUP.ouvert = false; SUP.q = null; SUP.c = null; SUP.rep = undefined;
}
async function surpriseRepondre(i){
  if(SUP.rep !== undefined || !SUP.q) return;
  SUP.rep = i; surpriseRendre();
  let c = { ok:false };
  try{ const { data } = await base.rpc('surprise_repondre', { p_id: SUP.q.id, p_choix: i }); if(data) c = data; }catch(e){}
  if(!SUP.q) return;
  SUP.c = c;
  if(c.ok){ c.correcte ? sonJuste() : sonFaux(); if(S.util.connecte) compterReponse(); }
  pister('SURPRISE_REPONDUE', { genre: SUP.q.genre, juste: !!c.correcte });
  surpriseRendre();
}
document.addEventListener('click', ev => {
  const b = ev.target.closest('[data-sup],[data-sup-rep]'); if(!b) return;
  if(b.dataset.supRep !== undefined) return surpriseRepondre(+b.dataset.supRep);
  if(b.dataset.sup === 'voir') return surpriseOuvrir();
  if(b.dataset.sup === 'plus-tard'){ pister('SURPRISE_REPORTEE'); return surpriseFermerCarte(); }
  if(b.dataset.sup === 'retour') return surpriseRetour();
});
/* une minute sur le site = une minute au compteur ; elle ne compte pas onglet caché */
setInterval(() => {
  if(document.hidden) return;
  if(SUP.carte && !surprisePossible()){ surpriseFermerCarte(); return; }
  if(SUP.carte || SUP.ouvert) return;
  const r = lireReglages(); let t = (+r.sup_cumul || 0) + 30;
  if(t >= SURPRISE_SECONDES && surprisePossible()){ ecrireReglage('sup_cumul', 0); surpriseCarte(); }
  else ecrireReglage('sup_cumul', Math.min(t, SURPRISE_SECONDES));
}, 30000);

document.addEventListener('click', ev => {
  const b = ev.target.closest('[data-top-mode]'); if(!b) return;
  S.topMode = b.dataset.topMode; if(S.ecran === 'top') rendre();
});
