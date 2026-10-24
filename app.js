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
  site:     'https://monconcoursbf.com',
  playStore: ''              /* le lien Play Store de Mon Concours, dès qu'il est publié */
};

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
const S = {
  ecran:'engagement', phase:0,
  testRep:{}, testChrono:120, testTimer:null, testCorrige:false, testNote:null,
  taches:[false,false,false], actuOnglet:'national', cahierFiltre:false,
  niveau:'Troisième', matiere:null, qcmIdx:0, qcmRep:undefined, qcmJustes:0, qcmSerie:0,
  voirClassement:false, voirDiagnostic:false, voirDefi:false, voirBadges:false,
  util:{nom:'', tel:'', pin:'', connecte:false},
  form:{nom:'', tel:'', pin:'', pin2:'', couleur:''}, codeVisible:false, erreur:'',
  abo:{actif:false, formule:null, jours_restants:0, echeance:'formule gratuite'},
  gratuit:true,             // phase de lancement : tout est gratuit (le serveur fait foi)
  theme:'clair', sessionCounter:0, cahierDepuisGrille:false,
  modal:null, modalDejaVu:false, matiereOuverte:null, sync:null, bloque:false, qcmPos:{}, rechercheCours:'', compositions:[], niveauConnu:false, notifications:[], notifCharge:false, dateConcours:null, nomConcours:null, typeEpreuve:'Concours direct · épreuve écrite',
  choixFormule:'mensuelle', operateur:'orange', paieTel:'', paieEtape:0,
  concours:'', sujetRef:'', seuil:null, compoEtat:null, compoMessage:'', corrigeServeur:null,
  qcmCorrection:null, qcmAttente:false, banque:null, progression:null, banqueEtat:'vide',
  repriseCorrection:null, paiementEtat:null,
  cahier:[],
  grille:[],
  ressources:null, ressourceOuverte:null, erreurCours:'', classement:null, stats:null, compoReprise:null, compositionId:null, reponses:{}, sujetVu:false, apercu:null, corrige:false, chrono:1500, timer:null, compoTab:'feuille',
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
  if(j === null) return '';
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
const ECRANS_DECOUVERTE = ['engagement','testIntro','test','resultat'];

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
  if(S.gratuit && (e === 'abonnement' || e === 'paiement')) e = 'compte';   // pas de formules pendant la phase gratuite
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
  if((e === 'compte' || e === 'parcours') && pasTropSouvent('compte', 20000)){ chargerJournee(); chargerRappel(); chargerDetails(); chargerProgression(); chargerPlan(); }
  if(e === 'cahier' && pasTropSouvent('cahier', 20000)){ chargerDetails(); chargerCahier(); }
  if(['copie','gagnants','cahier','revisions','defi'].includes(e)) prechargerOutilsPdf();
  if(e === 'notion' && S.notion && S.notion.jour !== new Date().toDateString()) S.notion = null;
  if(e === 'top') chargerTop();
  if(['recherche','defi','proposer'].includes(e) && !S.banque) chargerQuestions();
  if(e === 'qdj' && S.qdj && S.qdj.jourLocal !== new Date().toDateString()){ S.qdj = null; S.qdjRep = undefined; S.qdjCorrection = null; }
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
  const cache = ['engagement','testIntro','test','resultat','seance','inscription','connexion','paiement'].includes(S.ecran);
  n.style.display = cache ? 'none' : 'grid';
  r.style.display = cache ? 'none' : '';
  const app = document.querySelector('.app'); if(app) app.classList.toggle('sans-rail', cache);
  if(cache) return;
  n.style.gridTemplateColumns = 'repeat(5,1fr)';
  n.innerHTML = ONGLETS.map(o=>{
    const on = (o.id===S.ecran || (o.id==='grille'&&S.ecran==='copie')
      || (o.id==='aujourdhui'&&['actualite','pourtoi','qdj','gagnants','question','notion','recherche','defi','top','proposer'].includes(S.ecran))
      || (o.id==='compte'&&S.ecran==='parcours')
      || (o.id==='revisions'&&(S.ecran==='qcm'||S.ecran==='cours'))) ? 'on':'';
    const p = (o.id==='cahier' && ouvertes()) ? `<i class="pastille num">${ouvertes()}</i>`:'';
    const centre = o.id === 'grille' ? ' pivot' : '';
    return `<button class="${on}${centre}" data-go="${o.id}"${on?' aria-current="page"':''}>${p}<span class="g">${ico(o.g, o.id==='grille'?26:19)}</span>${o.l}</button>`;
  }).join('');
  r.innerHTML = ONGLETS.map(o=>{
    const on = (o.id===S.ecran || (o.id==='grille'&&S.ecran==='copie')
      || (o.id==='aujourdhui'&&['actualite','pourtoi','qdj','gagnants','question','notion','recherche','defi','top','proposer'].includes(S.ecran))
      || (o.id==='revisions'&&(S.ecran==='qcm'||S.ecran==='cours'))) ? 'on':'';
    const p = (o.id==='cahier' && ouvertes()) ? `<span class="pastille num">${ouvertes()}</span>`:'';
    return `<button class="${on}" data-go="${o.id}"${on?' aria-current="page"':''}>
      <span class="g">${ico(o.g,19)}</span>${o.l}${p}</button>`;
  }).join('') + `<div class="bas">${S.gratuit
      ? 'Accès gratuit à tout le site pendant le lancement'
      : S.abo.actif
      ? nomFormule(S.abo.formule) + ' · ' + E(S.abo.echeance)
      : 'Formule gratuite · l\'actualité du matin reste gratuite à vie'}</div>`;
}

/* =====================================================================
   ÉCRAN 1 — DIAGNOSTIC
   ===================================================================== */
const TEST = [
  {q:'« Le pays des hommes intègres » est quelle figure de style ?',
   o:['Comparaison','Métaphore','Périphrase','Personnification'],i:2,d:'Français'},
  {q:'Accord : « les lettres que j\'ai … »',
   o:['écrit','écrite','écrits','écrites'],i:3,d:'Français'},
  {q:'Seul cours d\'eau pérenne du Burkina Faso',
   o:['Le Nakambé','Le Nazinon','Le Mouhoun','La Comoé'],i:2,d:'Histoire-géographie'},
  {q:'Le pays a pris le nom de Burkina Faso en',
   o:['1960','1983','1984','1987'],i:2,d:'Histoire-géographie'},
  {q:'L\'Alliance des États du Sahel réunit',
   o:['Burkina, Mali, Guinée','Burkina, Mali, Niger','Burkina, Niger, Tchad','Mali, Niger, Guinée'],i:1,d:'Institutions et AES'},
  {q:'Date d\'effet du retrait de la CEDEAO',
   o:['28 janvier 2024','29 janvier 2025','1ᵉʳ juillet 2024','16 septembre 2023'],i:1,d:'Institutions et AES'},
  {q:'La glycogénolyse est',
   o:['la synthèse du glycogène','la dégradation du glycogène','l\'absorption du glucose','la formation de lipides'],i:1,d:'Sciences de la vie et de la Terre'},
  {q:'Hormone qui fait baisser la glycémie',
   o:['Le glucagon','L\'insuline','L\'adrénaline','Le cortisol'],i:1,d:'Sciences de la vie et de la Terre'},
  {q:'Capitale économique du Burkina Faso',
   o:['Ouagadougou','Bobo-Dioulasso','Koudougou','Banfora'],i:1,d:'Culture générale'},
  {q:'Solution de l\'équation 2x + 6 = 0',
   o:['x = 3','x = −3','x = 12','x = −12'],i:1,d:'Logique et calcul'}
];
/* --- 1 sur 3 : l'engagement --- */
function ecranEngagement(){
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
      <button class="cta" style="margin-top:16px" data-go="testIntro">Oui, je vais réussir</button>
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
function remettreTest(){
  if(S.testTimer){clearInterval(S.testTimer);S.testTimer=null;}
  S.testCorrige = true;
  ecrireMemoire(Object.assign({}, lireMemoire() || {}, { testFait:true }));
  pister('DIAGNOSTIC_COMPLETED', { repondues: Object.keys(S.testRep).length });
  let n=0; TEST.forEach((g,i)=>{ const r=S.testRep[i]||[]; if(r.length===1 && r[0]===g.i) n++; });
  S.testNote = n;
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
    setTimeout(()=>{ s.remove(); pister('DIAGNOSTIC_RESULT_VIEWED', { note: S.testNote }); aller('resultat'); }, 1600);
  }
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

  const analyse = solide
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
        <div class="l3 ${solide?'ok':''}">${solide?'Bonne base de départ':'Base à consolider'}</div>
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
        <li><b>Faire ta première composition.</b> 50 questions en 25 minutes, sur la vraie feuille : tu verras ton niveau en conditions réelles.</li>
      </ol>
    </div>

    <button class="cta" style="margin-top:18px" data-entrer="1">Entrer dans l'application<small>Actualité · révisions · composition · erreurs</small></button>
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
    const { data, error } = await base.from('questions')
      .select('id, enonce, niveau, matiere_id, matieres(nom, ordre, niveaux), question_options(position, texte)')
      .eq('statut', 'publie')
      .or('niveau.eq.' + niv + ',niveau.is.null')
      .order('cree_le')
      .limit(1000);
    if(error) throw error;
    const parMatiere = {};
    (data || []).forEach(q => {
      if(!q.matieres) return;
      if(q.matieres.niveaux && !q.matieres.niveaux.includes(niv)) return;   /* Droit, Économie : licence seulement */
      const o = (q.question_options || []).slice().sort((a,b) => a.position - b.position);
      if(o.length < 2) return;
      const m = q.matieres.nom;
      (parMatiere[m] = parMatiere[m] || { nom:m, ordre:q.matieres.ordre || 99, questions:[] })
        .questions.push({ id:q.id, q:q.enonce, o:o.map(x => x.texte) });
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
async function chargerNotifications(){
  if(!base) return;
  try{
    const uid = await utilisateurCourant();
    if(!uid) return;
    const { data } = await base.rpc('mes_notifications');
    const avant = new Set((S.notifications || []).map(n => n.id));
    const memes = pareil(data || [], S.notifications);
    S.notifications = data || [];
    memoEcrire('notifications', S.notifications, true);
    /* une nouvelle notification : un son léger et un bandeau qu'on peut toucher */
    const vues = lireReglages().notifVues || [];
    const neuves = S.notifications.filter(n => !n.lue && !vues.includes(n.id) && (S.notifCharge ? !avant.has(n.id) : true));
    S.notifCharge = true;
    if(!memes) rendre();
    if(neuves.length && !enComposition()){
      ecrireReglage('notifVues', S.notifications.slice(0, 60).map(n => n.id));
      bandeauNotif(neuves[0], neuves.length);
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
/* toucher une notification mène à ce dont elle parle */
function ouvrirNotif(n){
  if(!n) return;
  if(!n.lue) marquerNotifsLues(n.id);
  const v = document.getElementById('voile'); if(v){ v.hidden = true; v.innerHTML = ''; } S.modal = null;
  const [genre, id] = String(n.lien || '').split(':');
  if(genre === 'copie' && id) return feuilleArchive(id);
  if(genre === 'epreuve' && id){
    if(S.epreuve && S.epreuve.id === id && S.epreuve.etat !== 'terminee') return aller('aujourdhui');
    chargerClassement(id); return aller('gagnants');
  }
  if(genre === 'defi' && id) return ouvrirDefi(id);
  if(genre === 'compte') return aller('compte');
  if(genre === 'fautes') return lancerFautes();
  if(genre === 'reprendre') return aller(repriseCible(id) || 'aujourdhui');
  if(genre === 'parcours') return aller('parcours');
  if(genre === 'installer') return installerAppli();
  if(genre === 'offre'){ chargerOffre(false).then(() => aller('abonnement')); return; }
  if(n.type === 'paiement' && !S.gratuit) return aller('abonnement');
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
  toast('Dans Chrome : touchez le menu ⋮ en haut à droite, puis « Installer l\'application ».', 7000);
}

async function marquerNotifsLues(id){
  if(!base) return;
  try{
    await base.rpc('marquer_notifications_lues', { p_id: id || null });
    if(id) S.notifications = S.notifications.map(n => n.id === id ? {...n, lue:true} : n);
    else S.notifications = S.notifications.map(n => ({...n, lue:true}));
    rendre();
  }catch(e){}
}

async function chargerAbonnement(){
  if(!base) return;
  try{
    const { data: g } = await base.rpc('plateforme_gratuite');
    if(typeof g === 'boolean' && g !== S.gratuit){ S.gratuit = g; rendre(); }
    const uid = await utilisateurCourant();
    if(!uid) return;
    const { data } = await base.from('mon_abonnement').select('*').maybeSingle();
    if(data && data.actif){
      S.abo = {
        actif: true, formule: data.formule, fin_le: data.fin_le,
        jours_restants: data.jours_restants,
        echeance: data.jours_restants + ' jour' + (data.jours_restants > 1 ? 's' : '') + ' restant' + (data.jours_restants > 1 ? 's' : '')
      };
    } else {
      S.abo = {actif:false, formule:null, jours_restants:0, echeance:'formule gratuite'};
    }
    /* la dernière demande de paiement : en attente, confirmée (reçu), refusée */
    const { data: dem } = await base.rpc('mon_paiement_en_cours');
    S.paiementEtat = (dem && dem.ok && dem.statut) ? dem : null;
    S.paieEnAttente = (S.paiementEtat && S.paiementEtat.statut === 'en_attente') ? S.paiementEtat : null;
    const of = await chargerOffre(true);   // l'offre naît tout de suite, avec sa notification
    if(of && of.nouvelle) chargerNotifications();
    if(['compte','abonnement','aujourdhui'].includes(S.ecran)) rendre();
  }catch(e){}
}

/* =====================================================================
   OFFRE FLASH : le Pass Année à moitié prix pendant 24 heures.
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
    <div class="offre-texte">Le Pass Année, 12 mois sans limite, à moitié prix. L'offre expire ${jourOffre()} à minuit : il reste <b data-offre-reste="1">${resteOffre()}</b>.</div>
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
  [/invalid login|invalid credentials|invalid grant/i, "Numéro ou code secret incorrect."],
  [/password should be|password is too short|weak password/i, "Le code secret doit comporter 4 chiffres."],
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
    return { session: r.data.session };
  }
  return { session: data.session };
}

async function ouvrirSession(tel, pin){
  if(!base) return { erreur: "Pas de connexion au serveur pour l'instant." };
  const { data, error } = await base.auth.signInWithPassword({
    email: adresseTechnique(tel), password: motDePasse(tel, pin) });
  if(error){
    return { erreur: enFrancais(error) };
  }
  return { session: data.session };
}

async function reprendreSession(){
  if(!base) return;
  try{ await reprendreSession0(); }finally{ S.sessionPrete = true; chargerEpreuve(); }
}
async function reprendreSession0(){
  const { data } = await base.auth.getSession();
  if(!data || !data.session){
    /* La session du serveur a expiré : on corrige l'affichage optimiste,
       mais le candidat reste sur l'application, pas sur les trois étapes. */
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
    base = supabase.createClient(BASE_URL, BASE_CLE, { auth: { persistSession: true } });
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

async function ouvrirSessionObservation(){
  if(!base || O.demarree) return;
  O.demarree = true;
  O.session = identifiant();
  try{
    await base.from('sessions').insert({
      id: O.session, appareil: appareil(), navigateur: navigateur(), systeme: systeme(),
      version_app: VERSION_APP, langue: navigator.language, largeur: window.innerWidth,
      premiere_visite: !document.referrer, source: document.referrer ? 'lien' : 'direct'
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
  if(base && O.file.length >= 8) viderFile();
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
setInterval(viderFile, 15000);
window.addEventListener('error', e => {
  pister('ERROR_OCCURRED', { message: String(e.message).slice(0,200) });
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
    } else {
      if(S.compositionId && S.compositionId !== data.id){ S.reponses = {}; effacerEpreuve(); }
      S.compositionId = data.id;
      S.sujetRef = data.sujet || '';
      S.concours = data.concours || 'Concours direct';
      S.seuil = (typeof data.seuil === 'number') ? data.seuil : null;
      S.dureeCompo = data.duree || 1500;
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

/* Le téléphone envoie ses réponses ; le serveur corrige, note et renvoie le
   corrigé. La copie locale n'est effacée qu'une fois la remise acceptée. */
async function cloturerComposition(){
  if(S.sync){ clearInterval(S.sync); S.sync = null; }
  if(!base || !S.compositionId){ S.remiseEtat = 'erreur'; return; }
  S.remiseEtat = 'envoi';
  try{
    const { data, error } = await base.rpc('remettre_composition', {
      p_composition: S.compositionId, p_reponses: S.reponses, p_duree: (S.dureeCompo || 1500) - S.chrono
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
      S.compositionId = null;
      effacerEpreuve();
      chargerCahier(); chargerProgression(); chargerCompositions();
      if(S.epreuveRemise) chargerEpreuve();
    } else {
      /* déjà remise (par exemple depuis un autre appareil) : on relit la copie */
      S.remiseEtat = 'erreur';
      S.remiseMessage = (data && data.message) || 'Remise refusée.';
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
function ecranAujourdhui(){
  const f = S.taches.filter(Boolean).length;
  const enCours = !S.corrige && Object.keys(S.reponses).length > 0;
  vue().innerHTML = `
  <div class="pad">
    <div class="tete-jour">
      <span class="eyebrow">${dateDuJour()}</span>
      ${compteARebours()}
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
    <div>
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
            <span class="dur">25 min</span>${S.taches[1] ? '<span class="etat-tache fait">✓ Déjà effectué</span>' : '<span class="etat-tache">Pas encore effectué</span>'}</div>
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
    </div>
    </div>

    ${carteEpreuve()}
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
    groupe:'<circle cx="9" cy="8.5" r="3.2"/><path d="M3 19a6 6 0 0 1 12 0"/><circle cx="17" cy="9.5" r="2.5"/><path d="M15.5 14.2A5 5 0 0 1 21 19"/>',
    question:'<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.8-2.4 2.2-2.4 3.9"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>',
    horloge:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    coche:'<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.8 2.8L16.5 9.5"/>'
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
      <label for="f-pin">Code secret à 4 chiffres</label>
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
      <label for="c-pin">Code secret</label>
      <input id="c-pin" type="password" inputmode="numeric" maxlength="4" value="${E(S.form.pin)}" placeholder="••••" oninput="maj('pin',this.value)">
    </div>

    <button class="cta" style="margin-top:6px" data-connecter="1">Me connecter</button>
    <button class="lien" data-go="inscription">Créer un compte</button>
    <button class="lien" data-oubli="1">Code oublié ?</button>

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
const nomFormule = f => ({ semaine:'Pass Semaine', mensuelle:'Pass Mois', annuelle:'Pass Année', essai:'Essai gratuit' })[f] || 'Pass';
/* Trois Pass, jamais quatre. Aucun chiffre inventé : le prix par jour est un simple calcul. */
const FORMULES = {
  semaine:  { cle:'semaine',  n:'Pass Semaine', prix:'500 FCFA',   montant:500,  per:'7 jours',  jour:'71 F par jour', reco:false },
  mensuelle:{ cle:'mensuelle', n:'Pass Mois',    prix:'1 000 FCFA', montant:1000, per:'30 jours', jour:'33 F par jour', reco:true },
  annuelle: { cle:'annuelle', n:'Pass Année',   prix:'4 000 FCFA', montant:4000, per:'12 mois',  jour:'11 F par jour', reco:false }
};
const OPERATEURS = {
  orange:{ nom:'Orange Money', pastille:'OM', cls:'om' },
  moov:  { nom:'Moov Money',   pastille:'MM', cls:'mm' },
  wave:  { nom:'Wave',         pastille:'W',  cls:'wv' }
};
const numPaie = op => (CONTACT.paiement && CONTACT.paiement[op]) || CONTACT.adminTel;
const estAbonne = () => !!(S.abo && S.abo.actif);
/* Le candidat peut recevoir plusieurs propositions d'abonnement ; seul « À demain » les suspend 3 jours. */
function peutProposer(point){
  if(S.gratuit || estAbonne()) return false;
  const t = lireReglages().pass_demain;
  if(t && Date.now() - t < 3 * 86400000) return false;
  if(S.propositionPoint !== point){ S.propositionPoint = point; pister('PAYWALL_VIEWED', { point }); }
  return true;
}
const peutFeuilleDetaillee = () => S.gratuit || estAbonne() || ((S.stats && S.stats.compositions) || 0) <= 2;

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
    'Tu peux m\'offrir le ' + f.n + ' (' + f.prix + ') ? ' +
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
    await chargerAbonnement(); chargerNotifications();
    signalCandidat((data.libelle || 'Votre Pass') + ' est actif. Bon courage !');
    aller('abonnement');
  }catch(e){ S.codeEnvoi = false; S.codeErreur = enFrancais(e, 'Vérifiez votre connexion et réessayez.'); rendre(); }
}

/* La page « Mon Pass » : trois cartes, deux boutons dessous */
function ecranAbonnement(){
  const abo = S.abo;
  const paiement = S.paieEnAttente;
  vue().innerHTML = `
  <div class="pad">
    <button class="retourhaut" data-go="compte">Retour</button>

    ${abo && abo.actif ? `
    <div class="carte" style="text-align:center;padding:22px 16px">
      <div class="eyebrow">Mon Pass</div>
      <h1 class="titre" style="font-size:22px;margin:8px 0">${E(nomFormule(abo.formule))}</h1>
      <p class="sous">${abo.jours_restants} jour${abo.jours_restants>1?'s':''} restant${abo.jours_restants>1?'s':''}, jusqu'au ${new Date(abo.fin_le).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})}</p>
    </div>
    <p class="sous" style="margin:14px 0 4px">Pour prolonger, choisissez un Pass : il s'ajoute à la fin du vôtre.</p>` : `
    <h1 class="titre">Prépare ton concours<br>sans limite</h1>
    <p class="sous" style="margin:10px 0 18px">Corrections illimitées, compositions illimitées, feuille corrigée détaillée, plan de révision et mode hors ligne.</p>`}

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
      <p class="sous" style="margin:6px 0 0">Votre paiement du ${new Date(paiement.cree_le).toLocaleDateString('fr-FR')} est en cours de vérification : deux heures au plus. Vous recevrez une notification dès que c'est confirmé.</p>
    </div>` : `
    <div class="libelle" style="margin-top:6px">Choisissez votre Pass</div>
    ${Object.keys(FORMULES).map(k => {
      const f = FORMULES[k];
      return `<div class="formule ${f.reco ? 'reco' : ''} ${f.ancien ? 'flash' : ''}">
        ${f.ancien ? '<span class="ruban">offre flash</span>' : f.reco ? '<span class="ruban">recommandé</span>' : ''}
        <div class="haut"><span class="nom">${f.n}</span>
          <span class="prix">${f.ancien ? `<s class="barre">${f.ancien}</s> ` : ''}${f.prix} <em>${f.per}</em></span></div>
        ${f.ancien ? `<div class="flash-reste">Expire ${jourOffre()} à minuit · il reste <b data-offre-reste="1">${resteOffre()}</b></div>` : ''}
        <button class="mini" style="margin-top:12px" data-pass="${k}">Prendre le ${f.n}</button>
      </div>`;
    }).join('')}
    ${blocAlternatives()}`}

    <div class="bloc" style="margin-top:20px">
      <div class="libelle">Toujours gratuit</div>
      <div class="carte"><p class="sous" style="margin:0">Avec ton inscription : l'actualité du matin, le test de niveau, le cahier d'erreurs, des corrections chaque jour, des compositions pour t'essayer et la composition nationale du samedi.</p></div>
    </div>
  </div>`;
}

function ecranPaiement(){
  const f = FORMULES[S.choixFormule] || FORMULES.mensuelle;
  const op = OPERATEURS[S.operateur] ? S.operateur : 'orange';
  const O = OPERATEURS[op];

  /* Étape 3 : la capture du paiement, dans l'application ou par WhatsApp. */
  if(S.paieEtape === 3){
    const msgWa = 'Bonjour, j\'ai payé le ' + f.n + ' (' + f.prix + ') par ' + O.nom + '. Mon numéro de compte Mon Concours : ' + ((S.util && S.util.tel) || S.paieTel) + '. Je vous envoie ma capture.';
    vue().innerHTML = `
    <div class="pad">
      <button class="retourhaut" data-paieretour="1">Retour</button>
      <h1 class="titre">Envoyez la capture<br>de votre paiement</h1>
      <p class="sous" style="margin:10px 0 18px">Capture d'écran du message ${O.nom} qui confirme votre paiement de ${f.prix}.</p>

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
         href="https://wa.me/226${CONTACT.adminTel}?text=${encodeURIComponent(msgWa)}" target="_blank" rel="noopener" data-pister-wa="capture">
         ${ico('partage',16)} Envoyer ma capture par WhatsApp<small>Si l'envoi dans l'application est lent</small></a>
      ${blocAlternatives(f.cle)}
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
      <p class="sous" style="margin:12px 0 6px">Nous vérifions votre capture, au plus tard dans les 2 heures. Vous recevrez une notification : paiement confirmé, ou rejeté avec la raison.</p>
      <div class="carte" style="margin-top:16px;text-align:left">
        <div class="mat"><div class="nom">Moyen de paiement<em>${O.nom} · au +226 ${E(S.paieTel)}</em></div><div class="val">✓</div></div>
        <div class="mat"><div class="nom">Pass demandé<em>${f.n} · ${f.per}</em></div><div class="val num">${f.prix}</div></div>
      </div>
      <button class="cta" style="margin-top:18px" data-go="revisions">Ouvrir mes révisions</button>
      <button class="cta creux" style="margin-top:9px" data-go="compte">Retour à mon compte</button>
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
      <button class="lien" data-paieannul="1">Annuler</button>
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
    ${blocAlternatives(f.cle)}
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
  'Géopolitique':'GP', 'Droit':'DR', 'Économie':'EC' };
const sigle = nom => SIGLE[nom] || (nom || '?').slice(0, 2).toUpperCase();

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
            <span class="pc">${faites} sur ${nb} question${nb>1?'s':''} travaillée${nb>1?'s':''}${p && p.faites ? ' · ' + Math.round(100 * p.reussies / Math.max(1, p.faites)) + ' % de réussite' : ''}</span>` : ''}
            ${chap.length ? `<span class="pc">${chap.length} chapitre${chap.length>1?'s':''} de cours${S.util.connecte ? ' · ' + nLus + ' lu' + (nLus>1?'s':'') : ''}</span>` : ''}
          </div>
        </div>
        <div class="mr-actions">
          ${chap.length ? `<button data-matiere="${encodeURIComponent(nom)}">${ico('lire',16)}<span>${lecturePos()[nom] ? 'Reprendre le cours' : 'Lire le cours'}</span></button>` : ''}
          ${nb ? `<button class="plein" data-mat="${E(nom)}">${ico('revisions',16)}<span>${faites > 0 ? 'Continuer' : 'Faire les QCM'}</span></button>` : ''}
        </div>
      </div>`;
    }).join('')}
    </div>

    <button class="lien-mini" style="margin-top:14px" data-go="cours">${ico('lire',13)} Anciens sujets et recherche dans les cours</button>
    ${!S.util.connecte ? `<div class="carte" style="margin-top:12px">
      <p class="sous">${S.gratuit ? "Sans compte, tu peux lire les questions. Pour voir la correction et garder tes erreurs, crée ton compte : c'est gratuit." : "Sans compte, tu peux lire les questions. Pour voir la correction, crée ton compte gratuit : 20 corrections par jour, sans limite avec l'abonnement."}</p>
    </div>` : (!S.abo.actif && !S.gratuit ? `<div class="carte" style="margin-top:12px">
      <p class="sous">Formule gratuite : 10 corrections par jour. L'abonnement les rend illimitées et ouvre les compositions.</p>
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
  let liste = [];
  const viderListe = () => {
    if(liste.length){ html.push('<ol>' + liste.join('') + '</ol>'); liste = []; }
  };
  (texte || '').split('\n').forEach(brut => {
    const l = brut.trim().replace(/</g,'&lt;');
    if(!l){ viderListe(); return; }
    if(estTitre(l)){
      viderListe();
      const cible = /CONCOURS|BEPC|BAC/.test(l) ? ' class="cible"' : '';
      html.push('<h3' + cible + '>' + l + '</h3>');
      return;
    }
    const num = l.match(/^(\d+)\.\s+(.*)$/);
    if(num){ liste.push('<li>' + num[2] + '</li>'); return; }
    viderListe();
    if(l.length <= 46 && / = /.test(l)){ html.push('<div class="formule">' + l + '</div>'); return; }
    html.push('<p>' + l + '</p>');
  });
  viderListe();
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
const ICONE_NOTIF = { resultat:'grille', paiement:'carte', nouveau_cours:'revisions', rappel:'cloche', motivation:'cloche', faiblesse:'erreurs', securite:'cadenas', defi:'duel', progression:'diagnostic', installation:'telecharger' };

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

function ouvrirNotifications(){
  S.modal = 'notifications';
  document.getElementById('voile').hidden = false;
  const liste = S.notifications;
  document.getElementById('voile').innerHTML = `
  <div class="panneau" role="dialog" aria-modal="true" aria-label="Notifications">
    <div class="poignee"></div>
    <div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:4px">
      <h3 style="margin:0">Notifications</h3>
      <span class="notif-actions">
      ${liste.some(n=>!n.lue) ? `<button class="lien" data-notifs-tout="1">Tout marquer comme lu</button>` : ''}
      ${liste.length ? `<button class="lien" data-notifs-vider="1">Tout supprimer</button>` : ''}
      </span>
    </div>
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
  if(liste.some(n=>!n.lue)) setTimeout(() => marquerNotifsLues(null), 1200);
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
      if(r.height > 0) bords.add(Math.round(r.bottom + doc.defaultView.scrollY));
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
    z.innerHTML = '<span>Fichier enregistré dans vos téléchargements.</span><button type="button" class="ouvrir">Ouvrir le fichier</button><button type="button" class="fermer" aria-label="Fermer">×</button>';
    document.body.appendChild(z);
    const fermer = () => { z.remove(); setTimeout(() => URL.revokeObjectURL(url), 120000); };
    z.querySelector('.ouvrir').onclick = () => { if(!window.open(url, '_blank')) location.href = url; fermer(); };
    z.querySelector('.fermer').onclick = fermer;
    setTimeout(() => { if(z.isConnected) fermer(); }, 20000);
  }catch(e){}
}
async function enregistrerBlob(blob, nom, poignee){
  if(poignee){
    const w = await poignee.createWritable(); await w.write(blob); await w.close();
    toast('Fichier enregistré : ' + nom);
    proposerOuverture(blob, nom);
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nom; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  toast('Téléchargement lancé : ' + nom, 4500);
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
  toast('Préparation du document…', 2500);
  let html = null;
  try{ html = await fabrique(); }catch(e){ html = null; }
  if(!html){ return; }
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
  toast('Téléchargement…', 2500);
  try{
    const r = await fetch(url); if(!r.ok) throw new Error('http');
    await enregistrerBlob(await r.blob(), nom, poignee);
  }catch(e){ window.open(url, '_blank'); }
}

function feuilleBloquee(){
  if(peutFeuilleDetaillee()) return false;
  toast('La feuille détaillée fait partie du Pass.', 4500);
  aller('abonnement'); return true;
}
function feuilleComposition(source){
  if(feuilleBloquee()) return;
  return sortirDocument('Feuille corrigée ' + (S.util.nom || 'candidat'), () => htmlFeuilleComposition(source));
}
function htmlFeuilleComposition(source){
  /* source : { grille:[{q, o, bonnes}], reponses:{}, note, duree, date, sujet, concours }
     Sans source, on imprime la composition qui vient d'être corrigée. */
  const S0 = source || { grille:S.grille, reponses:S.reponses, note:S.grilleNote,
    duree:S.dureeUtilisee ?? ((S.dureeCompo || 1500) - S.chrono), date:new Date(),
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
        (bonnes.includes(k) ? ' ✓' : (r.includes(k) ? ' ✗' : '')) + '</li>').join('') + '</ol></div>';
  }).join('');

  const html = '<!doctype html><html lang="fr"><head><meta charset="utf-8">' +
'<title>Feuille corrigée — ' + E(S.util.nom || 'Candidat') + '</title>' +
'<style>' +
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
'.saut-page{break-before:page;page-break-before:always}' +
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
'.noimp button{font:inherit;padding:11px 22px;border:1px solid #111;background:#111;color:#fff;cursor:pointer}' +
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

'<div class="saut-page"></div>' +
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

/* Le reçu d'abonnement, après confirmation par l'administrateur. */
async function telechargerRecu(id){
  if(!base) return toast('Connexion nécessaire.');
  const f = window.open('', '_blank');
  if(!f){ toast("Autorisez les fenêtres pour télécharger votre reçu."); return; }
  f.document.write('<p style="font-family:sans-serif">Préparation du reçu…</p>');
  try{
    const { data, error } = await base.rpc('mon_recu', { p_id: id });
    if(error || !data || !data.ok) throw new Error((data && data.message) || 'Reçu indisponible.');
    const r = data.recu;
    const d = iso => iso ? new Date(iso).toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' }) : '—';
    const ligne = (l, v) => '<tr><td>' + E(l) + '</td><td>' + E(v) + '</td></tr>';
    f.document.open();
    f.document.write('<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Reçu ' + E(r.numero) + '</title>' +
      '<style>@page{size:A5;margin:12mm}body{font-family:Georgia,serif;color:#111;margin:0}' +
      '.tete{display:flex;align-items:center;gap:12px;border-bottom:3px double #111;padding-bottom:10px}' +
      '.sceau{width:46px;height:46px;border-radius:12px;background:#EDE4D3;border:1px solid #C9BEA9;display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:6px}' +
      '.sceau i{border-radius:50%;background:#FBFAF7;border:1px solid #C9BEA9}.sceau i:nth-child(2),.sceau i:nth-child(3){background:#1C1C1C}' +
      'h1{font-size:15px;letter-spacing:.18em;text-transform:uppercase;margin:16px 0 8px}table{width:100%;border-collapse:collapse;font-size:13px}' +
      'td{border-bottom:1px solid #ccc;padding:6px 4px}td:last-child{text-align:right;font-weight:bold}.merci{margin-top:16px;font-style:italic;font-size:13px}' +
      '.noimp{text-align:center;margin:18px 0}@media print{.noimp{display:none}}</style></head><body>' +
      '<div class="tete"><div class="sceau"><i></i><i></i><i></i><i></i></div><div><b style="letter-spacing:.05em">MON CONCOURS</b><br><small>Préparation aux concours directs du Burkina Faso</small></div></div>' +
      '<h1>Reçu de paiement</h1><table>' +
      ligne('Numéro', r.numero) + ligne('Émis le', d(r.emis_le)) + ligne('Candidat', r.candidat || '—') +
      ligne('Offre', r.offre) + ligne('Durée', (r.duree_jours || '—') + ' jours') +
      ligne('Valable du', d(r.debut_le)) + ligne('Jusqu\'au', d(r.fin_le)) +
      ligne('Payé par', (r.operateur || '') + ' · +226 ' + (r.telephone || '')) +
      ligne('Montant', (r.montant_fcfa || 0).toLocaleString('fr-FR') + ' FCFA') + '</table>' +
      '<p class="merci">' + E(r.remerciement || '') + '</p>' +
      '<div class="noimp"><button onclick="window.print()">Enregistrer en PDF ou imprimer</button></div>' +
      '</body></html>');
    f.document.close();
    pister('RECEIPT_DOWNLOADED');
  }catch(e){
    f.document.body.innerHTML = '<p style="font-family:sans-serif">' + E(enFrancais(e, 'Reçu indisponible.')) + '</p>';
  }
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
      grille.push({ q:q.enonce, o:q.options || [], bonnes:q.bonnes || [], m:q.matiere || null });
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
        grille.push({ q:q.enonce, o:q.options || [], bonnes:q.bonnes || [], m:q.matiere || null });
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
async function garderCoursHorsLigne(){
  if(!base || !navigator.onLine || garderCoursHorsLigne.enCours) return;
  garderCoursHorsLigne.enCours = true;
  try{
    for(const niv of ['troisieme', 'terminale', 'licence']){
      try{
        const liste = await lireRessourcesNiveau(niv);
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
    const { data, error } = await base.storage.from('cours').createSignedUrl(r.fichier_chemin, 3600);
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
      <div class="retour mal">
        ${c.quota
          ? `<b>Vous avez atteint votre limite d'essai gratuit.</b>Vos 10 corrections du jour sont faites : elles reviennent demain. Pour continuer maintenant, faites l'abonnement.`
          : `<b>${c.connexion ? 'Compte nécessaire' : 'Correction indisponible'}</b>${E(c.message || '')}`}
      </div>
      ${offre ? `<button class="cta" style="margin-top:12px" data-go="abonnement">Faire l'abonnement</button>` : ''}
      ${c.quota ? `<button class="cta creux" style="margin-top:9px" data-demain="1">À demain</button>` : ''}
      ${offre ? `<button class="lien-mini" style="margin-top:6px" data-proche="mensuelle">${ico('partage',13)} Un proche paie pour moi</button>` : ''}
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
  return `
    <div class="carte" style="text-align:left;margin:0 0 14px">
      ${moy !== null ? `<p class="sous" style="margin:0 0 6px">Ta moyenne sur tes trois compositions : <b>${moy}/50</b>.</p>` : ''}
      ${rest !== null && rest > 0 ? `<p class="sous" style="margin:0 0 6px">Il te reste <b>${rest} sujet${rest > 1 ? 's' : ''}</b> à composer.</p>` : ''}
    </div>
    ${offre ? `<p class="sous" style="margin:0 0 12px"><b>Vous avez atteint vos limites d'essai gratuit.</b> Faites l'abonnement, puis choisissez le Pass qui vous convient.</p>
      <button class="cta" data-go="abonnement">Faire l'abonnement</button>
      <button class="lien-mini" style="margin-top:8px" data-proche="mensuelle">${ico('partage',13)} Un proche paie pour moi</button>` : ''}
    <p class="sous" style="margin:12px 0 0;font-size:12.5px">La composition nationale du samedi reste gratuite.</p>`;
}
function ecranCompoAttente(){
  const etat = S.compoEtat;
  const titres = { chargement:'Préparation du sujet…', connexion:'Un compte est nécessaire',
    abonnement:'Tes 3 compositions offertes sont faites', erreur:'Composition indisponible' };
  const textes = {
    chargement: S.compoLent
      ? 'La connexion est lente, on insiste. Ne quittez pas cette page : le sujet arrive.'
      : 'Le sujet arrive. Le chronomètre ne démarre qu\'une fois la feuille affichée.',
    connexion: 'Crée ton compte gratuit : tes 3 premières compositions sont offertes.',
    abonnement: '',
    erreur: S.compoMessage || 'Le sujet n\'a pas pu être chargé.'
  };
  vue().innerHTML = `
  <div class="pad" style="padding-top:40px;text-align:center">
    ${logoSvg(44)}
    <h1 class="titre" style="font-size:24px;margin-top:16px">${titres[etat] || titres.erreur}</h1>
    <p class="sous" style="margin:10px 0 18px">${E(textes[etat] || textes.erreur)}</p>
    ${etat === 'connexion' ? `<button class="cta" data-modal="inscription">Créer mon compte</button>
      <button class="lien" data-modal="connexion">J'ai déjà un compte</button>` : ''}
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
        <div class="gr-chrono ${couleurChrono(S.chrono, S.dureeCompo || 1500)}" id="chrono">${mmss(S.chrono)}</div>
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
    const total = S.dureeCompo || 1500;
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

function basculerCompoTab(cible){
  if(S.compoTab === cible) return;
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
  if(S.timer){clearInterval(S.timer);S.timer=null;}
  S.corrige = true; S.taches[1] = true; sauverTaches(); S.sessionCounter++;
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
  const utilise = S.dureeUtilisee ?? ((S.dureeCompo || 1500) - S.chrono);
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
        <div class="mat"><div class="nom">Temps utilisé<em>Sur ${Math.round((S.dureeCompo || 1500)/60)} minutes accordées</em></div><div class="val num">${mmss(Math.max(0, utilise))}</div></div>
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
      <p class="sous" style="margin:0 0 10px"><b>Vous avez atteint vos limites d'essai gratuit.</b> Faites l'abonnement pour débloquer la feuille détaillée : ${mats.length ? E(mats.join(' et ')) : 'tes matières faibles'}, question par question, avec l'explication de chaque faute.</p>
      <button class="cta" data-go="abonnement">Faire l'abonnement</button>
      <button class="cta creux" style="margin-top:8px" data-copie-plus-tard="1">Plus tard</button>
    </div>` : (bloquee ? `<p class="sous" style="margin-top:14px;font-size:12.5px">La feuille détaillée fait partie du Pass. <button class="lien-mini" data-go="abonnement">Voir mon Pass</button></p>` : '')}`;
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
  if(repriseIdx !== null){ return ecranReprise(); }
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
    <div class="qtexte">${E(e.q)}</div>
    ${e.opts.map((o,i)=>{
      let c='';
      if(rep!==undefined){ if(i===e.i) c='juste'; else if(i===rep) c='faux'; }
      return `<button class="opt ${c}" ${rep!==undefined?'disabled':''} data-rr="${i}"><span class="lettre">${'ABCD'[i]}</span>${E(o)}</button>`;
    }).join('')}
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
    <div class="profil">
      <div class="av">${initiales}</div>
      <h1>${E(S.util.nom || 'Candidat')}</h1>
      ${S.util.tel?`<span>+226 ${E(S.util.tel)}</span>`:''}
    </div>

    <div class="duo">
      <div class="stat"><div class="v num">${S.stats ? nombreFr(S.stats.questions_resolues) : '—'}</div><div class="l">Questions résolues</div></div>
      <div class="stat"><div class="v num">${S.stats ? S.stats.taux_reussite + ' %' : '—'}</div><div class="l">Taux de réussite</div></div>
    </div>

    ${blocNiveau(true)}
    <button class="grande" style="margin-top:10px" data-go="parcours">
      <span class="ic">${ico('diagnostic',19)}</span>
      <span><b>Mon parcours</b><span>Depuis ton premier jour, matière par matière, et ta carte à partager</span></span>
      <span class="fl">→</span></button>

    <div class="classement">
      <div class="t">${ico('trophee',14)} Position estimée</div>
      ${S.classement ? `
      <div class="rangbig"><span class="num">${nombreFr(S.classement.rang)}ᵉ</span></div>
      <div class="pts">sur <span class="num">${nombreFr(S.classement.population)}</span> candidats inscrits · <span class="num">${nombreFr(S.classement.points)}</span> point${S.classement.points>1?'s':''}</div>
      <div class="up ${S.classement.places_semaine < 0 ? 'baisse' : ''}">${
        S.classement.places_semaine > 0
          ? '▲ Vous avez gagné ' + S.classement.places_semaine + ' place' + (S.classement.places_semaine>1?'s':'') + ' cette semaine'
          : S.classement.places_semaine < 0
            ? '▼ Vous avez perdu ' + Math.abs(S.classement.places_semaine) + ' place' + (Math.abs(S.classement.places_semaine)>1?'s':'') + ' cette semaine'
            : 'Aucun mouvement cette semaine'}</div>
      <div class="jauge-places">
        <div class="piste"></div>
        <div class="admis" style="width:${(S.classement.places / S.classement.population * 100).toFixed(1)}%"></div>
        <div class="curseur" style="left:${Math.min(100, S.classement.rang / S.classement.population * 100).toFixed(1)}%"></div>
      </div>
      <div class="legende-places"><span>${nombreFr(S.classement.places)} places</span><span>${nombreFr(S.classement.population)}ᵉ</span></div>
      <p class="sous" style="margin-top:9px">${
        S.classement.dans_les_admis
          ? 'Vous êtes dans la place, tenez la position. Le seuil monte chaque semaine.'
          : 'Il vous manque <b>' + nombreFr(S.classement.places_manquantes) + ' places</b> pour entrer dans les '
            + nombreFr(S.classement.places) + ' admis, soit <b>' + nombreFr(S.classement.points_manquants) + ' points</b>.'}</p>
      <p class="sous" style="font-size:12px">${S.classement.points_par_place} points font gagner une place.</p>`
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
          ['Dernier admis', S.classement.places],
          ['Votre position', S.classement.rang]
        ].sort((x,y)=>x[1]-y[1]).map(p => {
          const moi = p[0] === 'Votre position';
          const atteint = S.classement.rang <= p[1] && !moi;
          const manque = Math.max(0, (S.classement.rang - p[1]) * S.classement.points_par_place);
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
        <span><b>${S.abo.actif ? nomFormule(S.abo.formule) : 'Formule gratuite'}</b><span>${E(S.abo.echeance)}</span></span>
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
        <li>votre compte : numéro, nom, pseudo, code secret ;</li>
        <li>vos réponses, compositions, notes, erreurs et badges ;</li>
        <li>vos défis, classements, notifications et rappels.</li>
      </ul>
      <p class="sous" style="margin:8px 0 0">Si vous voulez seulement faire une pause, il suffit de vous déconnecter : vos progrès vous attendront.</p>
    </div>
    <div class="champ" style="margin-top:16px">
      <label for="suppr-code">Tapez votre code secret pour confirmer</label>
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
  if(code.length !== 4){ S.supprErreur = 'Le code secret comporte 4 chiffres.'; return rendre(); }
  if(!base){ S.supprErreur = 'Pas de connexion au serveur. Réessayez avec du réseau.'; return rendre(); }
  S.supprEnCours = true; S.supprErreur = ''; rendre();
  try{
    const { data, error } = await base.functions.invoke('supprimer-compte', { body: { code } });
    if(error) throw error;
    if(!data || !data.ok){ S.supprEnCours = false; S.supprErreur = (data && data.message) || 'Suppression impossible.'; return rendre(); }
    pister('ACCOUNT_DELETED');
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
async function chargerEpreuve(){
  if(!base) return;
  try{
    const { data } = await base.rpc('epreuve_du_moment');
    const change = !pareil(data || null, S.epreuve);
    S.epreuve = data || null;
    memoEcrire('epreuve', S.epreuve, true);
    if(change && ['aujourdhui','gagnants'].includes(S.ecran)) rendre();
    setTimeout(proposerNationale, 900);
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

/* ---------- la composition nationale du samedi 17 h ---------- */
const dateLongue = iso => new Date(iso).toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' });
const heureH = iso => { const d = new Date(iso); return d.getHours() + ' h' + (d.getMinutes() ? ' ' + String(d.getMinutes()).padStart(2,'0') : ''); };
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
  const faits = `${ep.nb_questions} questions · ${Math.round(ep.duree/60)} min · <b>${ep.places} places</b>${ep.inscrits ? ` · <span class="num">${ep.inscrits}</span> inscrit${ep.inscrits>1?'s':''}` : ''}`;
  let corps = '', bouton = '';
  if(ep.etat === 'a_venir'){
    corps = `<p class="cn-quand">${E(dateLongue(ep.debut_le))} à ${heureH(ep.debut_le)}</p>
      ${rebours(ep.debut_le)}
      <p class="sous cn-faits">${faits}</p>`;
    bouton = ep.inscrit
      ? `<div class="cn-inscrit">${ico('coche',15)} Inscrit · rappel 20 minutes avant le début</div>`
      : `<button class="cta" style="margin-top:12px" data-inscrire-nat="${E(ep.id)}">M'inscrire à la composition</button>`;
  } else if(ep.etat === 'en_cours'){
    corps = `<p class="cn-quand"><span class="cn-direct"><i></i>En cours</span> fin à ${heureH(ep.fin_le)}</p>
      ${rebours(ep.fin_le)}
      <p class="sous cn-faits">${faits}${ep.composent > 0 ? ` · <span class="num">${ep.composent}</span> en salle` : ''}</p>`;
    bouton = moi && moi.terminee
      ? `<p class="sous" style="margin-top:8px">Copie remise. Les résultats sont publiés à ${heureH(ep.fin_le)}.</p>`
      : `<button class="cta" style="margin-top:12px" data-rejoindre="${E(ep.id)}">Entrer en salle de composition</button>`;
  } else {
    corps = `<p class="cn-quand">Résultats publiés</p>
      <p class="sous cn-faits">${ep.participants} candidat${ep.participants>1?'s':''} · ${ep.places} places${moi && moi.score !== null && moi.score !== undefined ? ` · votre note : <span class="num">${moi.score}/${moi.sur}</span>` : ''}</p>`;
    bouton = `<button class="cta" style="margin-top:12px" data-gagnants="${E(ep.id)}">Voir les résultats et les admis</button>`;
  }
  return `<div class="carte nationale">
    <div class="cn-tete"><span>${ico('groupe',14)} Composition nationale <small class="sim">(simulation)</small></span><span class="cn-samedi">Samedis · 17 h</span></div>
    <h2 class="col-titre">${E(ep.concours || ep.titre.replace(/^Composition nationale( \(simulation\))? · /, ''))}</h2>
    ${corps}
    ${ep.recompense ? `<p class="sous" style="margin-top:6px">Récompense : <b>${E(ep.recompense)}</b></p>` : ''}
    ${bouton}
  </div>`;
}

/* À l'ouverture : « Voulez-vous participer ? » une fois par composition */
function proposerNationale(){
  const ep = S.epreuve;
  if(!ep || ep.etat === 'terminee' || ep.inscrit || ep.moi || S.popNatVu || !S.sessionPrete) return;
  if(S.ecran !== 'aujourdhui' || S.modal || enComposition()) return;
  const v = document.getElementById('voile');
  if(!v || !v.hidden) return;
  if(lireReglages()['nonNat-' + ep.id]) return;
  S.popNatVu = true;
  S.modal = 'nationale';
  v.hidden = false;
  v.innerHTML = `
  <div class="panneau pop-nat" role="dialog" aria-modal="true" aria-labelledby="pn-titre">
    <div class="poignee"></div>
    <div class="eyebrow" style="color:var(--or)">Composition nationale <small class="sim">(simulation)</small></div>
    <h3 id="pn-titre">${E(dateLongue(ep.debut_le).replace(/^./, x => x.toUpperCase()))} à ${heureH(ep.debut_le)}</h3>
    <p class="intro">Concours : <b>${E(ep.concours || ep.titre)}</b>. ${ep.nb_questions} questions en ${Math.round(ep.duree/60)} minutes, le même sujet pour tous les candidats, à la même heure.
      ${ep.places} places : les ${ep.places} premiers sont admis, les ${ep.places} suivants passent sur liste d'attente.</p>
    ${ep.etat === 'a_venir' ? rebours(ep.debut_le) : ''}
    <p class="pn-q">Voulez-vous participer ?</p>
    ${S.util.connecte ? `<label class="pn-nom"><input type="checkbox" id="pn-nom" checked> <span>Afficher mon nom dans la liste des admis (sinon, mon pseudo)</span></label>` : ''}
    <div class="duo">
      <button class="cta creux" data-nat-non="${E(ep.id)}">Non, merci</button>
      <button class="cta" data-nat-oui="${E(ep.id)}">Oui, je participe</button>
    </div>
  </div>`;
}
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
    vue().innerHTML = tete('POUR TOI · TERMINÉ') + `<div class="qzone" style="padding-top:18px">
      <h1 class="titre" style="font-size:26px">${f.liste.length} questions faites</h1>
      <div class="duo" style="margin-top:14px">
        <div class="stat"><div class="v num">${f.justes}</div><div class="l">Bonnes réponses</div></div>
        <div class="stat"><div class="v num">${f.revues}</div><div class="l">Erreurs revues</div></div>
      </div>
      ${(f.fautes || []).length ? `<div class="bloc"><div class="libelle">À revoir avant de partir</div>
        ${f.fautes.slice(0, 3).map(x => `<div class="err" style="margin-bottom:8px"><div class="q" style="font-size:13.5px">${E(x.q)}</div><div class="ligne">Bonne réponse : <b>${E(x.bon)}</b></div></div>`).join('')}</div>` : ''}
      <div class="verdict solide" style="margin-top:12px"><b>Pour ta prochaine visite</b>${E(conseilProchaineVisite(f))}</div>
      <button class="cta" style="margin-top:14px" data-pourtoi="10">Encore 10 questions</button>
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

    ${c && !c.ok ? `<div class="retour mal"><b>Correction indisponible</b>${E(c.message || '')}</div>
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
  if(taux >= 0.8 && !j.compos_semaine) return 'Tu es prêt pour une composition complète en conditions réelles : 50 questions, 25 minutes.';
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
      ${S.util.connecte ? `<button class="cta creux" style="margin-top:9px" data-pourtoi="10">Continuer avec 10 questions pour toi</button>`
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
const STATUTS = { admis:'Admis', attente:'Liste d\'attente', echoue:'Non admis' };
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
      <p class="sn-titre">${m.statut === 'admis' ? (m.rang <= 3 ? 'Félicitations, vous êtes sur le podium !' : 'Félicitations, vous êtes admis !')
        : m.statut === 'attente' ? 'Vous êtes sur la liste d\'attente.' : 'Vous n\'êtes pas admis cette fois.'}</p>
      <p>Votre rang : <b class="num">${r(m.rang)}</b> sur ${c.participants} · note <b class="num">${m.score}/${m.sur}</b></p>
      ${m.statut !== 'admis' && dernierAdmis ? `<p style="margin-top:4px">Le dernier admis avait <b class="num">${dernierAdmis.score}/${dernierAdmis.sur}</b>${manque > 0 ? ` : il vous a manqué ${manque} point${manque>1?'s':''}` : ''}. Rendez-vous samedi prochain à 17 h.</p>` : ''}
    </div>`;
  }
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
    <p class="sous" style="margin-top:6px"><span class="num">${c.participants}</span> candidat${c.participants>1?'s':''} · ${c.places} places · moyenne <span class="num">${c.moyenne ?? '—'}/${c.sur}</span></p>
    <div class="trio" style="margin-top:12px">
      <div><b class="num">${c.admis}</b><span>admis</span></div>
      <div><b class="num">${c.attente}</b><span>liste d'attente</span></div>
      <div><b class="num">${c.echoues}</b><span>non admis</span></div>
    </div>
    ${statut}
    ${m && peutProposer(4) ? `<div class="carte" style="margin-top:12px;text-align:left"><p class="sous" style="margin:0 0 10px">Pour préparer la prochaine nationale, faites l'abonnement.</p>
      <button class="cta" data-go="abonnement">Faire l'abonnement</button></div>` : ''}
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

    <button class="cta" style="margin-top:14px" data-resultats-pdf="1">${ico('telecharger',16)} Télécharger les résultats en PDF</button>
    ${m ? `<button class="cta wa-btn" style="margin-top:9px" data-carte-resultat="nationale">${ico('partage',16)} Partager ma carte de résultat<small>Une image avec votre note, votre rang et le QR code du site</small></button>
    <button class="cta creux" style="margin-top:9px" data-partage-rang="1">${logoReseau('whatsapp')} Envoyer mon résultat sur WhatsApp</button>` : ''}

    ${admis.length ? `<div class="bloc"><div class="libelle">Liste des admis<span class="num">${admis.length}</span></div><div class="carte">${admis.map(ligne).join('')}</div></div>` : ''}
    ${attente.length ? `<div class="bloc"><div class="libelle">Liste d'attente<span class="num">${attente.length}</span></div><div class="carte">${attente.map(ligne).join('')}</div></div>` : ''}
    ${c.echoues ? `<p class="sous" style="margin-top:12px">${c.echoues} candidat${c.echoues>1?'s ne sont pas admis':' n\'est pas admis'} cette semaine. Leurs noms ne sont pas publiés.</p>` : ''}
    <p class="sous" style="margin-top:14px;font-size:12px">Classement par ordre de mérite. À note égale, le candidat le plus rapide passe devant. Un candidat qui a refusé l'affichage de son nom apparaît sous son pseudo.</p>
  </div>`;
}
function resultatsPdf(){
  const c = S.classementEp;
  if(!c || !c.termine){ toast('Les résultats ne sont pas encore publiés.'); return; }
  return sortirDocument('Résultats composition nationale ' + (c.concours || ''), () => {
    const liste = c.classement || [];
    const admis = liste.filter(l => l.statut === 'admis'), attente = liste.filter(l => l.statut === 'attente');
    const podium = liste.filter(l => l.rang <= 3).slice(0, 3);
    const quand = new Date(c.debut_le).toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
    const tableau = l => '<table class="res"><thead><tr><th>Rang</th><th>Nom</th><th>Note</th><th>Temps</th></tr></thead><tbody>' +
      l.map(x => '<tr><td class="c">' + x.rang + (x.rang === 1 ? 'er' : 'e') + '</td><td>' + E(x.nom) + '</td><td class="c">' + x.score + ' / ' + x.sur + '</td><td class="c">' + mmssLong(x.duree) + '</td></tr>').join('') +
      '</tbody></table>';
    const css = '.chiffres{display:flex;gap:8px;margin-top:14px}.chiffres div{flex:1;border:1px solid #bbb;padding:7px;text-align:center}.chiffres b{display:block;font-size:20px}.chiffres span{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#555}' +
      '.felic{border:2px solid #B08A2E;background:#FBF6EA;padding:12px 16px;margin-top:16px;font-size:14px}.felic b.t{display:block;letter-spacing:.16em;text-transform:uppercase;font-size:12px;color:#8A6A1E;margin-bottom:4px}.felic ol{margin:6px 0 0 18px;padding:0}' +
      'table.res{width:100%;border-collapse:collapse;font-size:12.5px}table.res th{font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:.12em;text-transform:uppercase;text-align:left;border-bottom:2px solid #111;padding:4px 8px}' +
      'table.res td{border-bottom:1px solid #ddd;padding:4px 8px}table.res td.c{text-align:center;white-space:nowrap}table.res tr{break-inside:avoid}.note{font-size:12px;color:#444;margin-top:14px}' +
      '.sim{font-size:12px;letter-spacing:.06em;text-transform:none;color:#555}';
    return docComplet('Résultats — ' + (c.concours || c.titre), css,
      docEntete('Scannez pour composer samedi prochain') +
      '<p class="doc-titre">Composition nationale <span class="sim">(simulation)</span></p>' +
      '<p class="doc-st"><b>Résultats · ' + E(c.concours || c.titre) + '</b></p>' +
      '<p class="doc-st">Épreuve du ' + quand + ' à ' + heureH(c.debut_le) + '</p>' +
      '<div class="chiffres"><div><b>' + c.participants + '</b><span>candidats</span></div><div><b>' + c.places + '</b><span>places</span></div>' +
        '<div><b>' + c.admis + '</b><span>admis</span></div><div><b>' + c.attente + '</b><span>liste d\'attente</span></div><div><b>' + (c.moyenne ?? '—') + '</b><span>moyenne / ' + c.sur + '</span></div></div>' +
      (podium.length ? '<div class="felic"><b class="t">Félicitations</b>Mon Concours félicite chaleureusement les trois premiers de cette composition :<ol>' +
        podium.map(l => '<li><b>' + E(l.nom) + '</b>, ' + (l.rang === 1 ? 'major' : l.rang + 'e') + ' avec ' + l.score + ' / ' + l.sur + '</li>').join('') + '</ol>' +
        (c.recompense ? '<p style="margin:6px 0 0">Récompense du major : ' + E(c.recompense) + '.</p>' : '') +
        '<p style="margin:6px 0 0">Bravo à tous les admis. Pour les autres, la prochaine composition a lieu samedi à 17 h.</p></div>' : '') +
      (admis.length ? '<h2>Liste des admis par ordre de mérite</h2>' + tableau(admis) : '') +
      (attente.length ? '<h2>Liste d\'attente</h2>' + tableau(attente) : '') +
      (c.echoues ? '<p class="note">Non admis : ' + c.echoues + ' candidat' + (c.echoues > 1 ? 's' : '') + '. Leurs noms ne sont pas publiés.</p>' : '') +
      '<p class="note">À note égale, le candidat le plus rapide est classé devant. Composition d\'entraînement (simulation) organisée par Mon Concours ; elle ne remplace pas les résultats officiels des concours de la fonction publique.</p>' +
      docPied());
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
    <h3 id="q-titre">Voulez-vous vraiment quitter cette épreuve ?</h3>
    <p class="intro">Votre copie sera remise et corrigée avec les ${nb} réponse${nb>1?'s':''} déjà noircie${nb>1?'s':''}. Les questions sans réponse compteront comme blanches.</p>
    <div class="duo">
      <button class="cta creux" data-quitter-non="1">Non, je continue</button>
      <button class="cta" style="background:var(--erreur)" data-quitter-oui="1">Oui, je quitte</button>
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
  try{ const { data } = await base.rpc('mon_rappel'); S.rappel = data || null; memoEcrire('rappel', S.rappel, true); rafraichirSiVisible(); }catch(e){}
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
  if(!pushPossible()){ toast('Ce téléphone ne permet pas les rappels. Installez l\'application depuis Chrome pour les recevoir.', 6000); return; }
  try{
    const perm = await Notification.requestPermission();
    if(perm !== 'granted'){ toast('Les notifications sont refusées. Autorisez-les dans les réglages du navigateur.', 6000); return; }
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
    signalCandidat('Vous serez rappelé dans ' + delaiRappel(heure, minute) + ', à ' + hm(heure, minute) + ', puis chaque jour à la même heure.');
    pister('REMINDER_ENABLED', { heure, minute });
    rendre();
  }catch(e){ toast('Le rappel n\'a pas pu être activé. Réessayez avec une meilleure connexion.'); }
}
async function retirerRappel(){
  try{
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if(sub){ await base.rpc('retirer_rappel', { p_endpoint: sub.endpoint }); await sub.unsubscribe(); }
  }catch(e){}
  S.rappel = null; toast('Rappels désactivés.'); pister('REMINDER_DISABLED'); rendre();
}
function blocRappels(){
  if(!S.util.connecte) return '';
  const r = S.rappel;
  let h = 19, m = 0;
  if(r){ const d = new Date(); d.setUTCHours(r.heure, r.minute || 0, 0, 0); h = d.getHours(); m = d.getMinutes(); }
  return `<div class="carte rappel-c" style="margin-top:14px">
    <div class="libelle" style="margin-bottom:8px"><span>${ico('cloche',14)} Me rappeler</span>${r ? '<span class="tampon t-ok">Activé</span>' : ''}</div>
    <p class="sous" style="margin:0 0 10px;font-size:12.5px">${r ? 'Chaque jour à <b>' + hm(h, m) + '</b> · prochain rappel dans ' + delaiRappel(h, m) + '.' : 'Choisissez votre heure : le téléphone vous le rappelle chaque jour, même si l\'application est fermée.'}</p>
    <div class="rappel-heure">
      <label class="sr" for="rappel-h">Heure</label>
      <select id="rappel-h">${Array.from({ length:24 }, (_, i) => `<option value="${i}" ${i === h ? 'selected' : ''}>${i} h</option>`).join('')}</select>
      <label class="sr" for="rappel-m">Minutes</label>
      <select id="rappel-m">${Array.from({ length:60 }, (_, i) => `<option value="${i}" ${i === m ? 'selected' : ''}>${String(i).padStart(2, '0')}</option>`).join('')}</select>
      <button class="mini" data-rappel-heure="1">Valider</button>
    </div>
    ${r ? '<button class="lien" style="margin-top:8px;padding:0" data-rappel-retirer="1">Arrêter le rappel</button>' : ''}
  </div>`;
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
      ${j.pseudo ? `<p class="sous" style="margin-top:12px;font-size:12.5px">Votre pseudo dans les classements : <b>${E(j.pseudo)}</b>.</p>` : ''}
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
  const p = new URLSearchParams(location.search);
  const depuis = p.get('depuis');
  if(depuis) pister('ARRIVED_FROM', { depuis: depuis.slice(0, 20) });
  let cible = null;
  if(p.get('q') === 'jour') cible = 'qdj';
  else if(/^[0-9a-f-]{36}$/i.test(p.get('question') || '')){ cible = 'question'; S.lienQuestion = p.get('question'); S.qp = null; }
  else if(/^[0-9a-f-]{36}$/i.test(p.get('epreuve') || '')){ cible = 'gagnants'; S.lienEpreuve = p.get('epreuve'); S.classementEp = null; }
  else if(/^[0-9a-f-]{36}$/i.test(p.get('defi') || '')){ cible = 'defi'; S.lienDefi = p.get('defi'); S.defi = { etat:'chargement', id:p.get('defi') }; }
  else if(/^[0-9a-f-]{36}$/i.test(p.get('copie') || '')){ const id = p.get('copie'); setTimeout(() => feuilleArchive(id), 1500); }
  else if(p.get('reprendre') === 'cours' || p.get('reprendre') === 'qcm') cible = repriseCible(p.get('reprendre'));
  else if(p.get('fautes')){ setTimeout(lancerFautes, 1200); }
  else if(p.has('compte')) cible = 'compte';
  else if(p.has('abonnement')) cible = 'abonnement';
  else if(p.has('parcours')) cible = 'parcours';
  if(p.toString()) try{ history.replaceState({ ecran: cible || S.ecran }, '', location.pathname); }catch(e){}
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
  const t = ev.target.closest('[data-quitter],[data-quitter-oui],[data-quitter-non],[data-son],[data-correction-differee],[data-gagnants],[data-pourtoi],[data-fil-rep],[data-fil-suiv],[data-qdj-rep],[data-qp-rep],[data-signaler],[data-signal-envoi],[data-objectif],[data-rejoindre],[data-rappel-activer],[data-rappel-retirer],[data-reagir],[data-partage-question],[data-partage-qdj],[data-partage-rang],[data-carte-resultat],[data-sortir-reprise],[data-inscrire-nat],[data-nat-oui],[data-nat-non],[data-resultats-pdf],[data-telecharger-mat],[data-rappel-heure]');
  if(!t) return;
  const d = t.dataset;
  try{ const cle = Object.keys(d)[0]; pister('BUTTON_CLICKED', { valeur: String(d[cle]).slice(0,40) }, cle); }catch(e){}

  if(d.quitter) return demanderQuitter();
  if(d.quitterNon){ document.getElementById('voile').hidden = true; S.modal = null; return; }
  if(d.quitterOui){
    document.getElementById('voile').hidden = true; S.modal = null;
    pister('COMPOSITION_QUIT', { traitees: Object.keys(S.reponses).length, restant_s: S.chrono });
    return remettre();
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
  if(d.gagnants){ chargerClassement(d.gagnants); return aller('gagnants'); }
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
  if(d.rejoindre){
    if(!S.util.connecte){ S.modal = 'inscription'; S.erreur = ''; return surcouche(); }
    S.reponses = {}; S.corrige = false; S.grilleNote = null; S.corrigeServeur = null; effacerEpreuve();
    S.compoTab = 'feuille'; S.sujetVu = false; S.apercu = null; S.compositionId = null; S.remiseEtat = null;
    S.grille.length = 0; S.compoEtat = null; S.correctionLe = null;
    S.rejoindre = d.rejoindre;
    pister('NATIONAL_JOINED');
    return aller('grille');
  }
  if(d.rappelActiver) return activerRappel(d.rappelActiver, 0);
  if(d.rappelRetirer) return retirerRappel();
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
    const t3 = `${c.moi.statut === 'admis' ? 'Admis ! ' : ''}J'ai fini ${c.moi.rang}${c.moi.rang === 1 ? 'er' : 'e'} sur ${c.participants} à la composition nationale ${c.concours ? '(' + c.concours + ') ' : ''}de Mon Concours, avec ${c.moi.score}/${c.moi.sur}. La prochaine, c'est samedi à 17 h. Viens composer : ${CONTACT.site}`;
    window.open('https://wa.me/?text=' + encodeURIComponent(t3), '_blank', 'noopener');
    return;
  }
  if(d.sortirReprise){ repriseIdx = null; repriseRep = undefined; return rendre(); }
  if(d.inscrireNat) return inscrireNationale(d.inscrireNat, false);
  if(d.natOui) return inscrireNationale(d.natOui, true);
  if(d.natNon){ ecrireReglage('nonNat-' + d.natNon, true); document.getElementById('voile').hidden = true; S.modal = null; pister('NATIONAL_DECLINED'); return; }
  if(d.resultatsPdf) return resultatsPdf();
  if(d.telechargerMat) return telechargerCoursMatiere(decodeURIComponent(d.telechargerMat));
  if(d.rappelHeure){ const h = document.getElementById('rappel-h'), m = document.getElementById('rappel-m'); return activerRappel(h ? +h.value : 19, m ? +m.value : 0); }
});

/* =====================================================================
   SUITE DES PROPOSITIONS : niveaux, mission du jour, citations, notion
   du jour, questions similaires et pièges, recherche, défis entre amis,
   top 10, propositions de questions, parcours, carte de progression,
   pause de série, concours visé, plein écran, concentration, installation.
   ===================================================================== */
async function chargerDetails(){
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
  ['Oser inventer l\'avenir.', 'Thomas Sankara'],
  ['N\'an lara, an sara : si nous nous couchons, nous sommes morts.', 'Joseph Ki-Zerbo'],
  ['Le savoir est une lumière qui est en l\'homme.', 'Amadou Hampâté Bâ'],
  ['L\'éducation est l\'arme la plus puissante pour changer le monde.', 'Nelson Mandela'],
  ['Cela semble toujours impossible, jusqu\'à ce qu\'on le fasse.', 'Nelson Mandela']
];
const jourAnnee = () => Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
function blocCitation(){
  const [t, a] = CITATIONS[jourAnnee() % CITATIONS.length];
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
    { t:'Composer en conditions réelles : 50 questions, 25 minutes', a:'data-go="grille"' },
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

    ${S.util.connecte ? `<div class="carte mission" style="margin-top:18px">
      <div class="libelle" style="margin-bottom:6px"><span>${ico('cible',14)} Défi du jour</span></div>
      <div style="font-weight:600;font-size:14.5px;margin-bottom:10px">${E(mission.t)}</div>
      <button class="cta creux" ${mission.a}>Relever le défi</button>
    </div>` : ''}

    <h2 class="titre-section">S'entraîner autrement</h2>
    <div class="raccourcis">
      <button data-go="qdj">${ico('question',18)}<b>Question du jour</b><span>La même pour tous</span></button>
      <button data-defi-lancer="1">${ico('duel',18)}<b>Défier un ami</b><span>Un ou plusieurs, par leur numéro</span></button>
      <button data-go="top" style="grid-column:1 / -1">${ico('trophee',18)}<b>Top 10 de la semaine</b><span>Défiez les meilleurs</span></button>
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
  if(S.ecran === 'top') rendre();
}
function ecranTop(){
  const t = S.top;
  const tete = `<button class="retourhaut" data-go="aujourdhui">Retour</button>`;
  if(!t){ chargerTop(); vue().innerHTML = `<div class="pad">${tete}<div class="squelette large" style="margin-top:16px"></div></div>`; return; }
  vue().innerHTML = `<div class="pad">${tete}
    <div class="eyebrow">Depuis lundi</div>
    <h1 class="titre">Top 10 de la semaine</h1>
    <p class="sous" style="margin:6px 0 14px">Classé par points gagnés cette semaine (bonnes réponses, compositions, erreurs refermées). Les candidats apparaissent sous leur pseudo. Touchez « Défier » pour lancer un défi à l'un d'eux. Remise à zéro chaque lundi.</p>
    ${t.erreur ? '<p class="sous">Le classement n\'a pas pu être chargé.</p>' : `<div class="carte">
      ${(t.top || []).length ? t.top.map(l => `<div class="ligne-rang${l.moi ? ' moi' : ''}"><span class="p num">${l.rang}</span><span class="n">${E(l.pseudo)}${l.moi ? ' (vous)' : ''}<em class="num">${nombreFr(l.points)} pts</em></span>${l.moi ? '' : `<button class="mini btn-defier" data-defier-pseudo="${E(l.pseudo)}">${ico('duel',13)} Défier</button>`}</div>`).join('') : '<p class="sous">Personne n\'a encore marqué de points cette semaine. Soyez le premier.</p>'}
    </div>
    ${t.moi && t.moi.rang > 10 ? `<div class="ma-place"><span>Ta place</span><b class="num">${t.moi.rang}<sup>e</sup> sur ${t.participants}</b><span class="num">${nombreFr(t.moi.points)} pts</span></div>` : ''}`}
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
    <p class="chances-phrase">Avec <b class="num">${c.note}/${c.sur}</b> de moyenne sur vos ${nbc}, ${phrase}${c.concours ? ' à la composition nationale « ' + E(c.concours) + ' »' : ''} : ${c.rang}<sup>${c.rang === 1 ? 'er' : 'e'}</sup> sur ${c.participants} candidats, pour ${c.places} places.</p>
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
  if(!packGratuitDispo()){ toast('Vous avez atteint votre limite d\'essai gratuit : faites l\'abonnement.'); return aller('abonnement'); }
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
    <div class="libelle">Les cours · gratuit</div>
    <div class="carte">
      <p class="sous" style="margin:0 0 10px">${mats.length
        ? 'Tous les cours de votre niveau sont gardés sur le téléphone dès que vous êtes en ligne : vous les lisez sans réseau. Vous pouvez aussi en télécharger un en PDF.'
        : (S.ressources ? 'Aucun cours n\'est encore publié pour ce niveau.' : 'Chargement des cours…')}</p>
      ${pret || mats.length ? `<p class="sous" style="margin:0 0 10px;font-size:12.5px"><b>${mats.length ? '✓ Cours disponibles hors ligne' : ''}</b></p>` : ''}
      ${mats.map(nom => {
        const n = liste.filter(r => r.matiere === nom).length;
        return `<div class="mat"><div class="nom">${E(nom)}<em>${n} chapitre${n > 1 ? 's' : ''}</em></div>
          <div class="paire" style="display:flex;gap:6px"><button class="mini" data-matiere="${encodeURIComponent(nom)}">Lire</button>
          <button class="mini" data-telecharger-mat="${encodeURIComponent(nom)}">PDF</button></div></div>`;
      }).join('')}
    </div>
  </div>`;
}
/* Les QCM sans connexion : réservés au Pass */
function blocQcmHL(p, enLigne, termine){
  const libre = packGratuitDispo();
  if(!libre) return `<div class="bloc">
    <div class="libelle">Les QCM sans connexion · abonnement</div>
    <div class="carte">
      <p class="sous" style="margin:0 0 12px">Vous avez atteint votre limite d'essai gratuit : le premier pack de 30 questions est déjà pris. Faites l'abonnement pour garder d'autres questions corrigées sur le téléphone et les faire sans réseau.</p>
      <button class="cta" data-go="abonnement">Faire l'abonnement</button>
    </div></div>`;
  return `<div class="bloc">
    <div class="libelle">Les QCM sans connexion</div>
    <div class="carte">
      <p class="sous" style="margin:0 0 10px">${termine ? 'Votre pack est terminé.' : 'Téléchargez un pack de 30 questions de votre niveau, avec leurs corrections, quand vous avez du réseau. Le premier pack est gratuit. Vos réponses partent toutes seules au retour du réseau.'}</p>
      <button class="cta" data-pack-telecharger="1" ${S.packEtat === 'chargement' || !enLigne ? 'disabled' : ''}>${S.packEtat === 'chargement' ? '<span class="spin"></span> Téléchargement…' : ico('telecharger',16) + (termine ? ' Télécharger un nouveau pack' : ' Télécharger mon pack')}</button>
      ${!enLigne ? '<p class="sous" style="margin-top:10px">Vous êtes hors ligne : le pack se télécharge quand vous avez du réseau.</p>' : ''}
    </div></div>`;
}
/* Le premier pack de 30 questions est offert ; les suivants font partie du Pass. */
const packGratuitDispo = () => S.gratuit || estAbonne() || !lireReglages().pack_gratuit_pris;
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
      date: jourFr(c.debut_le), lien: CONTACT.site, appel: 'Prochaine composition samedi à 17 h' };
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
function basculerPleinEcran(){
  try{
    if(document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen({ navigationUI:'hide' }).catch(() => toast('Le plein écran n\'est pas disponible sur ce téléphone.'));
  }catch(e){ toast('Le plein écran n\'est pas disponible sur ce téléphone.'); }
}
document.addEventListener('fullscreenchange', () => { if(S.ecran === 'grille' && !S.corrige) ecranGrille(); });

/* ---------- tirer vers le bas pour actualiser, comme sur les autres applications ---------- */
const SANS_ACTUALISER = ['grille','qcm','test','testIntro','engagement','reprise','pourtoi','defi','lecteur','resultat','paiement','inscription','connexion','proposer','lecture'];
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
const SANS_TETE = ['test','grille','engagement','testIntro','resultat'];
/* raccourci caché vers l'administration : cinq touchers rapides sur le logo */
let touchesLogo = [];
document.addEventListener('click', ev => {
  if(!ev.target.closest('#apptete svg, #apptete .mot')) return;
  const t = Date.now(); touchesLogo = touchesLogo.filter(x => t - x < 2500); touchesLogo.push(t);
  if(touchesLogo.length >= 5){ touchesLogo = []; location.href = '/admin.html'; }
});
function apptete(){
  const t = document.getElementById('apptete');
  if(SANS_TETE.includes(S.ecran)){ t.style.display='none'; return; }
  t.style.display='flex';
  const jr = joursAvantConcours();
  const droite = {aujourdhui: jr === null ? '' : 'J−' + jr, copie:'copie corrigée', cahier:ouvertes()+' en attente',
    compte:S.gratuit ? '' : S.abo.actif?nomFormule(S.abo.formule).toLowerCase():'formule gratuite',
    revisions:S.niveau.toLowerCase(), qcm:S.matiere||'', abonnement:'', paiement:'sécurisé',
    inscription:'', connexion:'', resultat:'étape 3 sur 3', actualite:'ce matin',
    pourtoi:'pour toi', qdj:'question du jour', gagnants:'classement', notion:'notion du jour', defi:'défi', top:'top 10', parcours:'mon parcours'}[S.ecran] || '';
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
      ? ''
      : `<button class="bouton-tete" data-modal="inscription" aria-label="Se connecter">${ico('compte',17)}<span>Se connecter</span></button>`}`;
}
function annoncer(){
  const n = {aujourdhui:'Actualité', actualite:'Actualité du matin', revisions:'Mes cours',
    qcm:'Question', grille:'Composition', copie:'Copie corrigée', cahier:'Mon cahier', compte:'Mon compte',
    inscription:'Création de compte', connexion:'Connexion', abonnement:'Formules', paiement:'Paiement',
    test:'Test de niveau', resultat:'Résultat', pourtoi:'Fil pour toi', qdj:'Question du jour',
    question:'Question partagée', gagnants:'Résultats de la composition nationale', notion:'Notion du jour', recherche:'Recherche de questions',
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

function surcouche(){
  const v = document.getElementById('voile');
  /* les autres panneaux (partage, notifications, signalement, sortie
     d'épreuve) se gèrent eux-mêmes : un rendu ne doit pas les fermer */
  if(S.modal && !['inscription','connexion','oubli'].includes(S.modal)) return;
  if(!S.modal || (S.util.connecte && S.modal !== 'oubli')){ v.hidden = true; v.innerHTML=''; return; }

  const mode = S.modal;                       // inscription · connexion · oubli
  const titres = { inscription:'Inscription', connexion:'Connexion', oubli:'Code oublié' };
  const intros = {
    inscription:"Crée ton compte pour garder tes erreurs, ton classement et ta progression. C'est gratuit et ça prend trente secondes.",
    connexion:"Entre ton numéro et ton code pour retrouver ta progression.",
    oubli:"Donne ton numéro et la couleur choisie à l'inscription, puis choisis un nouveau code. Trois essais au plus : ensuite, l'administrateur s'en occupe sur WhatsApp."
  };

  v.hidden = false;
  v.innerHTML = `
  <div class="panneau" role="dialog" aria-modal="true" aria-label="${titres[mode]}">
    <div class="poignee"></div>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">${logoSvg(30)}
      <span style="font-family:var(--d);font-weight:800;font-size:15px">MON <i style="font-style:normal;color:var(--laterite-txt)">CONCOURS</i></span></div>

    <div class="titre-panneau">${titres[mode]}</div>
    <p class="intro">${intros[mode]}</p>

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

    <div class="champ"><label for="m-pin">${mode==='oubli'?'Nouveau code à 4 chiffres':'Code secret à 4 chiffres'}</label>
      <div class="avec-oeil">
        <input id="m-pin" type="${S.codeVisible?'text':'password'}" inputmode="numeric" maxlength="4"
          value="${E(S.form.pin)}" placeholder="••••" oninput="maj('pin',this.value)">
        <button class="oeil" data-oeil="1" aria-label="${S.codeVisible?'Masquer le code':'Afficher le code'}">${S.codeVisible?'masquer':'voir'}</button>
      </div></div>

    ${(mode === 'inscription' || mode === 'oubli') ? `
      <div class="champ"><label for="m-pin2">Confirme le code</label>
        <input id="m-pin2" type="${S.codeVisible?'text':'password'}" inputmode="numeric" maxlength="4"
          value="${E(S.form.pin2||'')}" placeholder="••••" oninput="maj('pin2',this.value)"></div>` : ''}

    ${mode === 'inscription' ? `
      <div class="champ"><label for="m-couleur">Ta couleur préférée</label>
        <select id="m-couleur" onchange="maj('couleur',this.value)">
          <option value="">— choisis —</option>
          ${COULEURS.map(c=>`<option value="${c}" ${S.form.couleur===c?'selected':''}>${c}</option>`).join('')}
        </select>
        <div class="aide">Elle servira à retrouver ton code si tu l'oublies. Choisis-en une dont tu te souviendras.</div></div>` : ''}

    <button class="cta" data-${mode === 'inscription' ? 'inscrire' : mode === 'connexion' ? 'connecter' : 'reinitialiser'}="1">
      ${mode === 'inscription' ? 'Créer mon compte' : mode === 'connexion' ? 'Me connecter' : 'Changer mon code'}
      ${mode === 'inscription' ? '<small>Gratuit · aucune carte bancaire</small>' : ''}</button>

    ${mode === 'inscription'
      ? `<button class="lien" data-bascule="connexion">J'ai déjà un compte</button>`
      : mode === 'connexion'
        ? `<button class="lien" data-bascule="inscription">Créer un compte</button>
           <button class="lien" data-bascule="oubli">J'ai oublié mon code</button>`
        : `<button class="lien" data-bascule="connexion">Revenir à la connexion</button>`}
    ${mode === 'oubli' ? `<a class="cta creux" style="display:block;margin-top:10px;text-decoration:none"
        href="https://wa.me/226${CONTACT.adminTel}?text=${encodeURIComponent("Bonjour, j'ai oublié mon code Mon Concours. Mon numéro : " + (S.form.tel || ''))}"
        target="_blank" rel="noopener">${S.bloque ? "Écrire à l'administrateur sur WhatsApp" : "Couleur oubliée ? Écrire à l'administrateur"}<small>Il vérifie votre identité et change votre code</small></a>` : ''}
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
  f.classList.add('parti');
  setTimeout(() => f.remove(), 320);
}

function rendre(){
  appliquerTheme();
  retirerFacade();
  if(typeof pister === 'function' && S.ecran !== O.dernierEcran){
    const passe = Date.now() - O.entreeEcran;
    if(O.dernierEcran) pister('SCREEN_LEFT', { ecran: O.dernierEcran, duree_ms: passe });
    O.dernierEcran = S.ecran; O.entreeEcran = Date.now(); O.nbEcrans++;
    profondeurVue = 0;
    pister('SCREEN_VIEWED');
  }
  const dessiner = ({engagement:ecranEngagement, testIntro:ecranTestIntro, test:ecranTest, resultat:ecranResultat,
    inscription:ecranInscription, connexion:ecranConnexion,
    abonnement:ecranAbonnement, paiement:ecranPaiement,
    apparence:ecranApparence,
    aujourdhui:ecranAujourdhui, actualite:ecranActualite,
    revisions:ecranRevisions, cours:ecranCours, lecture:ecranLecture, qcm:ecranQcm,
    grille:ecranGrille, copie:ecranCopie,
    cahier:ecranCahier, lecteur:ecranLecteur, compte:ecranCompte,
    pourtoi:ecranPourToi, qdj:ecranQdj, question:ecranQuestionPartagee, gagnants:ecranGagnants,
    notion:ecranNotion, recherche:ecranRecherche, defi:ecranDefi, top:ecranTop, proposer:ecranProposer, parcours:ecranParcours, horsligne:ecranHorsLigne, suppression:ecranSuppression}[S.ecran] || ecranAujourdhui);

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
  try{ nav(); apptete(); annoncer(); surcouche(); appliquerConcentration(); }catch(e){ console.error(e); }
  try{ animerApresRendu(); }catch(e){}
}

document.addEventListener('click', ev=>{
  const t = ev.target.closest('[data-matiere],[data-vers],[data-musique],[data-notifs],[data-notifs-tout],[data-notifs-vider],[data-notif-lire],[data-copier],[data-partage-natif],[data-fermer-partage],[data-paieretour],[data-preuve-modifier],[data-preuve-envoyer],[data-plan-faire],[data-plan-effacer],[data-copie-plus-tard],[data-pass],[data-proche],[data-code-ouvrir],[data-code-valider],[data-copier-num],[data-demain],[data-feuille],[data-lire-feuille],[data-lire-cahier],[data-lecteur-dl],[data-nivinfo],[data-archive],[data-toutes-compos],[data-partage],[data-oeil],[data-reinitialiser],[data-lire],[data-telecharger],[data-apercu],[data-saut],[data-compotab],[data-bascule-theme],[data-modal],[data-entrer],[data-bascule],[data-plustard],[data-deconnecter],[data-theme-choix],[data-erreursdusoir],[data-cible],[data-cours],[data-inscrire],[data-connecter],[data-oubli],[data-formule],[data-operateur],[data-payer],[data-paiefin],[data-paieannul],[data-go],[data-toutcahier],[data-actu],[data-actu-repli],[data-niv],[data-mat],[data-qcm],[data-qsuiv],[data-cahierfreq],[data-classement],[data-diagnostic],[data-defi],[data-duel],[data-badges],[data-phase],[data-conc],[data-dep],[data-test],[data-tb],[data-tremettre],[data-seance],[data-rep],[data-suivante],[data-b],[data-remettre],[data-recommencer],[data-reprise],[data-rr],[data-fin-reprise],[data-qcm-relancer],[data-compo-relancer],[data-remise-relancer],[data-recu]');
  if(!t) return;
  const d = t.dataset;

  try{
    const cle = Object.keys(d)[0] || 'inconnu';
    pister('BUTTON_CLICKED', { valeur: String(d[cle]).slice(0,40) }, cle);
  }catch(e){}

  if(d.go){
    /* pendant une épreuve, changer d'onglet demande confirmation */
    if(enComposition() && d.go !== 'grille') return demanderQuitter();
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
    else if(pin.length !== 4) S.erreur = "Le code secret doit comporter 4 chiffres.";
    else if(pin !== pin2) S.erreur = "Les deux codes ne sont pas identiques.";
    else if(!f.couleur) S.erreur = "Choisis ta couleur préférée : elle servira si tu oublies ton code.";
    else {
      S.erreur = 'Création du compte…'; surcouche();
      creerCompte(f.nom.trim(), tel, pin).then(r => {
        if(r.erreur){ S.erreur = r.erreur; return surcouche(); }
        S.erreur = ''; S.util = {nom:f.nom.trim(), tel:tel, pin:'', connecte:true};
        S.niveauProfil = niveauBase();
        ecrireMemoire({ nom:f.nom.trim(), tel:tel, niveauProfil:S.niveauProfil });
        pister('ACCOUNT_CREATED', { niveau: S.niveau });
        S.modal = null; chargerProgression();
        if(S.defi && S.defi.etat === 'connexion') ouvrirDefi(S.defi.id); else aller('aujourdhui');
      });
      return;
    }
    return rendre();
  }
  if(d.connecter){
    const tel = S.form.tel.replace(/\D/g,''), pin = S.form.pin.replace(/\D/g,'');
    if(tel.length !== 8 || pin.length !== 4){
      S.erreur = "Numéro à 8 chiffres et code à 4 chiffres."; return surcouche(); }
    S.erreur = 'Connexion…'; surcouche();
    (async () => {
      /* Un code à quatre chiffres se devine. Au bout de huit essais ratés
         on ferme quinze minutes, et on montre la sortie de secours. */
      if(base){
        try{
          const { data: v } = await base.rpc('controle_connexion', { p_telephone: tel });
          if(v && v.bloque){
            S.bloque = true;
            S.erreur = `Trop d'essais. Réessayez dans ${v.minutes} minute${v.minutes>1?'s':''}, ou utilisez « Code oublié ».`;
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
      if(S.defi && S.defi.etat === 'connexion') ouvrirDefi(S.defi.id); else aller('aujourdhui');
    })();
    return;
  }
  if(d.oubli){ S.modal = 'oubli'; S.erreur = ''; return surcouche(); }
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
    S.paieEtape = 3; S.paievePreuve = null; S.erreur = '';
    return rendre();
  }
  if(d.paieretour){
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
  if(d.entrer){
    pister('APP_ENTERED', { note_diagnostic: S.testNote });
    aller('aujourdhui');
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
    S.notifications = []; memoEcrire('notifications', [], true); rendre();
    if(base) base.rpc('supprimer_notifications').then(() => {}, () => toast('Suppression non enregistrée : vérifiez votre connexion.'));
    return;
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
  if(d.bascule){ S.modal = d.bascule; S.erreur=''; return surcouche(); }
  if(d.oeil){ S.codeVisible = !S.codeVisible; return surcouche(); }
  if(d.reinitialiser){
    const tel = S.form.tel.replace(/\D/g,''), pin = S.form.pin.replace(/\D/g,''), pin2 = (S.form.pin2||'').replace(/\D/g,'');
    if(tel.length !== 8) S.erreur = "Le numéro doit comporter 8 chiffres.";
    else if(!S.form.couleur) S.erreur = "Choisis la couleur donnée à l'inscription.";
    else if(pin.length !== 4) S.erreur = "Le nouveau code doit comporter 4 chiffres.";
    else if(pin !== pin2) S.erreur = "Les deux codes ne sont pas identiques.";
    else {
      S.erreur = 'Vérification…'; surcouche();
      base.rpc('reinitialiser_code', { p_telephone: tel, p_couleur: S.form.couleur, p_nouveau: pin })
        .then(r => {
          const d2 = r.data || {};
          if(!d2.ok){ S.bloque = !!d2.bloque; S.erreur = d2.message || "Impossible de changer le code."; return surcouche(); }
          S.erreur = ''; S.modal = 'connexion'; S.form.pin = ''; S.form.pin2 = '';
          surcouche();
          signalCandidat('Code changé. Connecte-toi avec le nouveau code.');
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
  if(d.telecharger){ telechargerRessource(d.telecharger); return; }
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
    if(base) base.auth.signOut();
    S.util = {nom:'', tel:'', pin:'', connecte:false};
    S.form = {nom:'', tel:'', pin:''};
    S.lus = null; S.lusCharges = false; S.popNatVu = false;
    memoVider(); S.journee = null; S.stats = null; S.details = null; S.classement = null; S.notifications = []; S.cahier = []; S.top = null; S.rappel = null;
    oublierIdentite();
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
  if(d.tremettre) return remettreTest();

  if(d.compotab){
    basculerCompoTab(d.compotab);
    const c = document.getElementById('corps'); if(c) c.scrollTop = 0;
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
    sauverEpreuve();
    pister('COMPOSITION_ANSWER_SELECTED', { question: q + 1, total: S.grille.length });
    ecranGrille();
    const bulle = document.querySelector('[data-b="' + q + '-' + i + '"]');
    if(bulle) bulle.classList.add('encre');
    return;
  }

  if(d.remettre) return remettre();

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
/* Un candidat qui revient est salué : « Bon retour, Prénom ». Une fois par visite. */
function saluerRetour(){
  if(S.retourDit) return;
  const m = lireMemoire() || {};
  if(!m.dejaVenu || !m.nom || /^candidat$/i.test(m.nom.trim())) return;
  S.retourDit = true;
  const prenom = m.nom.trim().split(/\s+/)[0];
  const textes = ['Bon retour, ' + prenom + ' ! Content de vous revoir.', 'Bienvenue à nouveau, ' + prenom + '. On reprend là où vous en étiez.'];
  setTimeout(() => { if(!S.modal && ['aujourdhui','actualite'].includes(S.ecran)) signalCandidat(textes[new Date().getDate() % 2]); }, 1600);
}
saluerRetour();
function bienvenue(){
  if(S.bienvenueDite) return; S.bienvenueDite = true;
  setTimeout(() => { if(!S.modal && ['aujourdhui','actualite'].includes(S.ecran)) signalCandidat('Bienvenue sur Mon Concours. Prenez le temps de regarder.'); }, 1800);
}
const ECRANS_CALMES = ['grille','qcm','test','testIntro','engagement','reprise','pourtoi','defi','resultat','lecture','paiement','lecteur'];
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
  { titre:'Rejoignez la communauté', texte:'Intégrez la communauté WhatsApp de Mon Concours pour rester informé : dates des concours, compositions du samedi, nouveautés.' },
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
  essayer(60000, 'install', () => !estInstallee() && !CONTACT.playStore,
    { icone:'telecharger', titre:'Installer Mon Concours', texte:'Installez l\'application sur votre téléphone : elle s\'ouvre comme une application, même avec peu de réseau.',
      oui:'Installer l\'application', obligatoire:true, sansFait:true, action: () => installerAppli() }, 3600000);
  /* communauté WhatsApp : 2 minutes, 10 minutes, 1 heure ; plus jamais une fois rejointe */
  [120000, 600000, 3600000].forEach((d, i) => essayer(d, 'whatsapp', () => !!CONTACT.canal,
    { icone:'whatsapp', titre:TEXTES_WHATSAPP[i].titre, texte:TEXTES_WHATSAPP[i].texte, oui:'Rejoindre la communauté', rappel:i,
      action: () => { window.open(CONTACT.canal, '_blank', 'noopener'); pister('WHATSAPP_JOINED_CLICK', {}); } }, 120000));
  /* notifications : mêmes moments, décalés d'une minute pour ne pas empiler deux fenêtres ; s'arrête dès qu'elles sont acceptées */
  const TEXTES_NOTIFS = [
    'Autorisez les notifications : Mon Concours vous prévient, même quand vous êtes sur Facebook ou WhatsApp, pour le rappel du soir, vos résultats et les compositions du samedi.',
    'Vous n\'avez pas encore autorisé les notifications. Sans elles, vous ne serez pas prévenu des compositions ni de vos rappels.',
    'Dernier rappel : autorisez les notifications pour recevoir vos rappels et ne pas rater la composition du samedi.'
  ];
  [180000, 660000, 3660000].forEach((d, i) => {
    setTimeout(() => { if(S.util.connecte && !S.rappel) chargerRappel(); }, d - 15000);
    essayer(d, 'notifs', notifsAEncourager,
      { icone:'cloche', titre:i ? 'Notifications toujours coupées' : 'Être prévenu à temps', texte:TEXTES_NOTIFS[i], oui:'Autoriser les notifications', rappel:i, sansFait:true,
        action: () => activerRappel(18, 0) }, 120000);
  });
}
planifierInvitations();

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

ouvrirLienDirect();
rendre();
