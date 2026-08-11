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
  site:     'https://monconcours.vercel.app'
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
  try{ localStorage.setItem(MEMOIRE, JSON.stringify(Object.assign({dejaVenu:true}, o))); }
  catch(e){}
}
/* À la déconnexion on oublie l'identité, jamais le fait d'être déjà venu. */
function oublierIdentite(){
  const m = lireMemoire() || {};
  ecrireMemoire({ niveau: m.niveau || null });
}

/* =====================================================================
   ÉTAT
   ===================================================================== */
const S = {
  ecran:'engagement', phase:0,
  testRep:{}, testChrono:120, testTimer:null, testCorrige:false, testNote:null,
  taches:[false,false,false], actuOnglet:'national', cahierFiltre:false,
  niveau:'Terminale', matiere:null, qcmIdx:0, qcmRep:undefined, qcmJustes:0, qcmSerie:0,
  voirClassement:false, voirDiagnostic:false, voirDefi:false, voirBadges:false,
  util:{nom:'', tel:'', pin:'', connecte:false},
  form:{nom:'', tel:'', pin:'', pin2:'', couleur:''}, codeVisible:false, erreur:'',
  abo:{actif:true, formule:'Semaine gratuite', echeance:'encore 7 jours'},
  theme:'sombre', sessionCounter:0, cahierDepuisGrille:false,
  modal:null, modalDejaVu:false, matiereOuverte:null, sync:null, bloque:false, qcmPos:{}, rechercheCours:'', compositions:[], dateConcours:null, nomConcours:null, typeEpreuve:'Concours direct · épreuve écrite',
  choixFormule:'annuelle', operateur:'orange', paieTel:'', paieEtape:0,
  semaines:17, depart:null, concours:'ENAREF cycle C',
  score:71, seuilScore:90,
  etapes:[true,false,false],
  matieres:[
    {n:'Culture générale du Burkina', q:412, v:86},
    {n:'Français et littérature', q:536, v:74},
    {n:'Histoire et géographie', q:390, v:71},
    {n:'Institutions et AES', q:287, v:62},
    {n:'Mathématiques', q:241, v:58},
    {n:'Sciences de la vie', q:198, v:41}
  ],
  cahier:[
    {q:'Que signifie la glycogénolyse ?', mien:'la synthèse du glycogène',
     bon:'la dégradation du glycogène en glucose',
     opts:['La synthèse du glycogène','La dégradation du glycogène en glucose','L\'absorption intestinale du glucose','La transformation du glucose en lipides'], i:1,
     rate:4, suite:0, revoirLe:0, note:'« Lyse » = destruction. Le foie casse ses réserves, sous l\'ordre du glucagon.'},
    {q:'Date d\'effet du retrait de la CEDEAO ?', mien:'28 janvier 2024',
     bon:'29 janvier 2025',
     opts:['28 janvier 2024','29 janvier 2025','1ᵉʳ juillet 2024','16 septembre 2023'], i:1,
     rate:3, suite:0, revoirLe:0, note:'Le 28 janvier 2024 est la date de l\'annonce. L\'effet, un an plus tard. Deux dates, deux questions différentes.'},
    {q:'Combien d\'os compte le crâne humain ?', mien:'23',
     bon:'22', opts:['20','22','23','26'], i:1,
     rate:2, suite:0, revoirLe:0, note:'8 os crâniens + 14 os de la face. Deux corrigés qui circulent donnent 23 : c\'est faux.'}
  ],
  seance:[
    {q:'« Le pays des hommes intègres » est quelle figure de style ?',
     opts:['Une comparaison','Une métaphore','Une périphrase','Une personnification'], i:2,
     note:'Une périphrase remplace un nom par une expression qui le décrit. Tombée en 2023 et en 2025.', mat:'Français', freq:'Tombée 2 fois en 4 sessions'},
    {q:'Quel est le seul cours d\'eau pérenne du Burkina Faso ?',
     opts:['Le Nakambé','Le Nazinon','Le Mouhoun','La Comoé'], i:2,
     note:'Le Mouhoun (ex-Volta Noire) coule toute l\'année. Les autres sont intermittents.', mat:'Géographie', freq:'Classique des annales'},
    {q:'Hormone qui commande la mise en réserve du glucose ?',
     opts:['Le glucagon','L\'insuline','L\'adrénaline','Le cortisol'], i:1,
     note:'L\'insuline range, le glucagon dépense. Retenez la paire, jamais l\'une seule.', mat:'Sciences de la vie', freq:'Votre matière faible · 41 %'},
    {q:'Dans quelle ville se trouve l\'usine DAFANI-SA ?',
     opts:['Bobo-Dioulasso','Banfora','Orodara','Ouagadougou'], i:2,
     note:'Orodara, dans le Kénédougou — la zone des vergers de mangues.', mat:'Culture générale', freq:'Relevée ce matin à Ouaga'},
    {q:'L\'AES, créée en 2023, réunit quels trois États ?',
     opts:['Burkina, Mali, Guinée','Burkina, Mali, Niger','Burkina, Niger, Tchad','Mali, Niger, Guinée'], i:1,
     note:'Alliance des États du Sahel : Burkina Faso, Mali, Niger. Charte du Liptako-Gourma, septembre 2023.', mat:'Institutions', freq:'Tombée aux 3 dernières sessions'}
  ],
  seanceIdx:0, seanceJustes:0,
  grille:[
    {q:'Capitale économique du Burkina Faso',o:['Ouagadougou','Bobo-Dioulasso','Koudougou','Banfora'],i:1},
    {q:'Auteur du roman « Le Parachutage »',o:['Norbert Zongo','Jacques Prosper Bazié','Nazi Boni','Monique Ilboudo'],i:0},
    {q:'« Genèse » dans glycogénogenèse signifie',o:['Destruction','Fabrication','Transport','Filtration'],i:1},
    {q:'Le pH sanguin normal se situe entre',o:['6,35 et 6,45','7,35 et 7,45','8,35 et 8,45','5,35 et 5,45'],i:1},
    {q:'Unité de la résistance électrique',o:['Le volt','L\'ampère','L\'ohm','Le watt'],i:2},
    {q:'Fondateurs du mouvement de la Négritude',o:['Senghor, Césaire, Damas','Senghor, Diop, Kane','Césaire, Fanon, Memmi','Damas, Sartre, Césaire'],i:0},
    {q:'La charte du Liptako-Gourma a été signée en',o:['2021','2022','2023','2024'],i:2},
    {q:'Solution de l\'équation 2x + 6 = 0',o:['x = 3','x = −3','x = 12','x = −12'],i:1},
    {q:'Organe qui stocke le glycogène',o:['Le pancréas','Le foie','La rate','Le rein'],i:1},
    {q:'« Il eût fallu » est au',o:['Conditionnel présent','Subjonctif imparfait','Plus-que-parfait du subjonctif','Passé antérieur'],i:2},
    {q:'Le Burkina Faso a pris ce nom en',o:['1960','1983','1984','1987'],i:2},
    {q:'Accord : « les lettres que j\'ai … »',o:['écrit','écrite','écrits','écrites'],i:3},
    {q:'Seul cours d\'eau pérenne du Burkina Faso',o:['Le Nakambé','Le Nazinon','Le Mouhoun','La Comoé'],i:2},
    {q:'« Le pays des hommes intègres » est',o:['Une comparaison','Une métaphore','Une périphrase','Une personnification'],i:2},
    {q:'L\'Alliance des États du Sahel réunit',o:['Burkina, Mali, Guinée','Burkina, Mali, Niger','Burkina, Niger, Tchad','Mali, Niger, Guinée'],i:1},
    {q:'Le retrait de la CEDEAO a pris effet le',o:['28 janvier 2024','29 janvier 2025','1ᵉʳ juillet 2024','16 septembre 2023'],i:1},
    {q:'La glycogénolyse est',o:['La synthèse du glycogène','La dégradation du glycogène','L\'absorption du glucose','La formation de lipides'],i:1},
    {q:'Hormone qui fait baisser la glycémie',o:['Le glucagon','L\'insuline','L\'adrénaline','Le cortisol'],i:1},
    {q:'Ville où se trouve l\'usine DAFANI-SA',o:['Bobo-Dioulasso','Banfora','Orodara','Ouagadougou'],i:2},
    {q:'Le crâne humain compte',o:['20 os','22 os','23 os','26 os'],i:1},
    {q:'La mitochondrie est le siège de',o:['La photosynthèse','La digestion','La respiration cellulaire','La circulation'],i:2},
    {q:'L\'ADN est constitué de',o:['Acides aminés','Nucléotides','Lipides','Glucides'],i:1},
    {q:'25 % de 480 vaut',o:['96','110','120','125'],i:2},
    {q:'L\'aire d\'un cercle de rayon 3 est',o:['6π','9π','3π','12π'],i:1},
    {q:'Le Conseil de sécurité de l\'ONU compte',o:['10 membres','15 membres','20 membres','5 membres'],i:1},
    {q:'Le siège de l\'Union africaine se trouve à',o:['Abuja','Addis-Abeba','Nairobi','Le Caire'],i:1},
    {q:'Le tarif extérieur commun de l\'AES est de',o:['0,5 %','1,5 %','5 %','10 %'],i:0},
    {q:'Le budget de l\'État est voté par',o:['Le gouvernement','L\'organe législatif','La Cour des comptes','Le Conseil constitutionnel'],i:1},
    {q:'L\'inflation désigne',o:['La baisse de la production','La hausse générale des prix','La hausse du chômage','La dévaluation'],i:1},
    {q:'Le PIB mesure',o:['La richesse produite en un an','Le total des salaires','Les recettes de l\'État','La masse monétaire'],i:0},
    {q:'La révolution burkinabè a été proclamée le',o:['4 août 1983','15 octobre 1987','3 janvier 1966','11 décembre 1960'],i:0},
    {q:'Le Burkina Faso est limité au sud-ouest par',o:['Le Niger','Le Mali','La Côte d\'Ivoire','Le Bénin'],i:2},
    {q:'Le contrôle de constitutionnalité relève',o:['De la Cour de cassation','Du Conseil constitutionnel','Du Conseil d\'État','De la Cour des comptes'],i:1},
    {q:'Le siège de la commission de l\'UEMOA est à',o:['Ouagadougou','Dakar','Abidjan','Lomé'],i:0},
    {q:'L\'UEMOA compte',o:['6 États','8 États','10 États','15 États'],i:1},
    {q:'Le climat sahélien se caractérise par',o:['Deux saisons des pluies','Une saison des pluies courte','Des pluies toute l\'année','Aucune pluie'],i:1},
    {q:'La capitale du Niger est',o:['Bamako','Niamey','N\'Djamena','Cotonou'],i:1},
    {q:'Le FESPACO se tient tous les',o:['Ans','Deux ans','Trois ans','Cinq ans'],i:1},
    {q:'Le SIAO est un salon consacré à',o:['L\'agriculture','Le cinéma','L\'artisanat','L\'élevage'],i:2},
    {q:'La monnaie de la zone UEMOA est',o:['Le franc CFA','Le naira','Le cedi','Le dirham'],i:0},
    {q:'« Ils se sont lavé les mains » : le participe',o:['Reste invariable','S\'accorde avec le sujet','S\'accorde avec « mains »','Prend un s'],i:0},
    {q:'L\'antonyme de « prodigue » est',o:['Généreux','Avare','Dépensier','Riche'],i:1},
    {q:'Le pluriel de « un travail » est',o:['Travails','Travaux','Travailles','Travail'],i:1},
    {q:'5 au cube vaut',o:['15','25','125','243'],i:2},
    {q:'Un article à 2 500 F baisse de 20 %. Il coûte',o:['2 300 F','2 000 F','2 250 F','1 800 F'],i:1},
    {q:'Le sang est oxygéné dans',o:['Le cœur','Les poumons','Le foie','Les reins'],i:1},
    {q:'Les objectifs de développement durable datent de',o:['2000','2010','2015','2020'],i:2},
    {q:'Le nombre d\'objectifs de développement durable est',o:['8','12','17','21'],i:2},
    {q:'Le Sahel désigne une zone située',o:['Au sud du Sahara','Au nord du Sahara','En Afrique australe','Sur la côte atlantique'],i:0},
    {q:'L\'Organisation des Nations unies a été créée en',o:['1919','1945','1948','1960'],i:1}
  ],
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
  toast('Réseau perdu. Vous pouvez continuer à lire et à composer : tout sera envoyé au retour.', 6000));
window.addEventListener('online', () => toast('Réseau retrouvé.'));
const mmss = s => String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
const PALIERS = [3, 7, 21];               // jours entre deux reprises
const JOUR = 86400000;
const aujourdhuiZero = () => { const d=new Date(); d.setHours(0,0,0,0); return d.getTime(); };
function joursRestants(e){
  if(e.revoirLe === undefined) return 0;
  return Math.max(0, Math.round((e.revoirLe - aujourdhuiZero())/JOUR));
}
function programmer(e, juste){
  if(juste){
    e.suite++;
    e.revoirLe = aujourdhuiZero() + (PALIERS[Math.min(e.suite-1, PALIERS.length-1)] * JOUR);
  } else {
    e.suite = 0; e.rate++;
    e.revoirLe = aujourdhuiZero();       // à reprendre aujourd'hui même
  }
}
const ouvertes = () => S.cahier.filter(e => e.suite < 3).length;
const dues = () => S.cahier.filter(e => e.suite < 3 && joursRestants(e) === 0).length;
const aReprendre = () => S.cahier.filter(e => e.suite < 3);

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
})();

/* Avant le premier dessin : si ce téléphone connaît déjà le candidat,
   on ouvre l'application sur l'actualité et non sur l'engagement. */
(function accueilDirect(){
  const m = lireMemoire();
  if(!m || !m.dejaVenu) return;
  S.ecran = 'aujourdhui';
  S.modalDejaVu = true;                       // pas de relance d'inscription
  if(m.niveau) S.niveau = m.niveau;
  if(m.nom) S.util = { nom:m.nom, tel:m.tel || '', pin:'', connecte:true };
})();

/* Écrans de première visite : on n'y renvoie plus personne par accident. */
const ECRANS_DECOUVERTE = ['engagement','testIntro','test','resultat'];

function aller(e){
  if(['revisions','qcm','grille','cours'].includes(e)) chargerQuestions();
  if(e === 'compte') chargerCompositions();
  if(e !== 'lecture') S.matiereOuverte = null;
  if(S.timer && e!=='grille'){clearInterval(S.timer);S.timer=null;}
  if(S.testTimer && e!=='test'){clearInterval(S.testTimer);S.testTimer=null;}
  S.ecran = e; rendre(); vue().scrollTop = 0;
  try{ vue().focus({preventScroll:true}); }catch(err){}
}

/* =====================================================================
   NAVIGATION
   ===================================================================== */
const ONGLETS = [
  {id:'aujourdhui', g:'actualite', l:'Actualité'},
  {id:'revisions',  g:'revisions', l:'Révisions'},
  {id:'grille',     g:'grille',    l:'Composition'},
  {id:'cahier',     g:'erreurs',   l:'Mes erreurs'},
  {id:'compte',     g:'compte',    l:'Mon compte'}
];
function nav(){
  const n = $('#nav'), r = $('#rail');
  const cache = ['engagement','testIntro','test','resultat','seance','inscription','connexion','paiement'].includes(S.ecran);
  n.style.display = cache ? 'none' : 'grid';
  r.style.display = cache ? 'none' : '';
  if(cache) return;
  n.style.gridTemplateColumns = 'repeat(5,1fr)';
  n.innerHTML = ONGLETS.map(o=>{
    const on = (o.id===S.ecran || (o.id==='grille'&&S.ecran==='copie')
      || (o.id==='aujourdhui'&&S.ecran==='actualite')
      || (o.id==='revisions'&&(S.ecran==='qcm'||S.ecran==='cours'))) ? 'on':'';
    const p = (o.id==='cahier' && ouvertes()) ? `<i class="pastille num">${ouvertes()}</i>`:'';
    const centre = o.id === 'grille' ? ' pivot' : '';
    return `<button class="${on}${centre}" data-go="${o.id}"${on?' aria-current="page"':''}>${p}<span class="g">${ico(o.g, o.id==='grille'?26:19)}</span>${o.l}</button>`;
  }).join('');
  r.innerHTML = ONGLETS.map(o=>{
    const on = (o.id===S.ecran || (o.id==='grille'&&S.ecran==='copie')
      || (o.id==='aujourdhui'&&S.ecran==='actualite')
      || (o.id==='revisions'&&(S.ecran==='qcm'||S.ecran==='cours'))) ? 'on':'';
    const p = (o.id==='cahier' && ouvertes()) ? `<span class="pastille num">${ouvertes()}</span>`:'';
    return `<button class="${on}" data-go="${o.id}"${on?' aria-current="page"':''}>
      <span class="g">${ico(o.g,19)}</span>${o.l}${p}</button>`;
  }).join('') + `<div class="bas">${S.abo.actif
      ? 'Formule '+S.abo.formule+' · '+S.abo.echeance
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
   o:['la synthèse du glycogène','la dégradation du glycogène','l\'absorption du glucose','la formation de lipides'],i:1,d:'Sciences de la vie'},
  {q:'Hormone qui fait baisser la glycémie',
   o:['Le glucagon','L\'insuline','L\'adrénaline','Le cortisol'],i:1,d:'Sciences de la vie'},
  {q:'Capitale économique du Burkina Faso',
   o:['Ouagadougou','Bobo-Dioulasso','Koudougou','Banfora'],i:1,d:'Culture générale'},
  {q:'Solution de l\'équation 2x + 6 = 0',
   o:['x = 3','x = −3','x = 12','x = −12'],i:1,d:'Logique et calcul'}
];
const CONCOURS = [
  ['ENAREF — cycle C','Niveau licence · 412 classés en 2025'],
  ['Police nationale','Écrit, puis tests sportifs'],
  ['Douanes','Niveau BEPC et licence'],
  ['Santé — attaché','Cycle A et B']
];
const DEPART = [
  ['Depuis octobre','Je prépare depuis longtemps',38],
  ['Depuis février ou mars','Quelques mois derrière moi',17],
  ['Il y a deux mois','Pas plus',9],
  ['Je commence aujourd\'hui','Là, maintenant',4]
];

/* --- 1 sur 3 : l'engagement --- */
function ecranEngagement(){
  vue().innerHTML = `
  <div class="hero">
    <div class="marquehero">${logoSvg(38)}
      <div><div class="mot">MON <i>CONCOURS</i></div>
        <div class="devise">Réussis ton concours à coup sûr.</div></div></div>
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
        <div class="devise">Réussis ton concours à coup sûr.</div></div></div>
    <div class="progression"><i class="on"></i><i class="on"></i><i></i></div>
    <div class="pastille-etape" style="margin:12px 0 0">Étape 2 sur 3 · le diagnostic</div>
    <div class="reveal" style="padding-top:24px">
      <div class="serment" style="font-size:32px">Prouve-nous<br>que tu en es<br><em>capable</em>.</div>
      <p class="hero-texte">Réponds à ces 10 questions de vrais concours en moins de 2 minutes et découvre où tu te situes.</p>
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
      <div><div class="t">VOTRE FEUILLE DE COMPOSITION</div>
        <div class="eyebrow" style="color:#B5AC96">Test de niveau · 10 questions</div></div>
      <div style="text-align:right">
        <div class="gr-chrono ${S.testChrono<=30?'chaud':''}" id="tchrono">${mmss(S.testChrono)}</div>
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
    S.testTimer = setInterval(()=>{
      S.testChrono--;
      const c = document.getElementById('tchrono');
      if(c){ c.textContent = mmss(S.testChrono); if(S.testChrono<=30) c.classList.add('chaud'); }
      if(S.testChrono===60){ bip(1); annonceTemps('Il reste 1 minute'); }
      if(S.testChrono===30){ bip(3); annonceTemps('Plus que 30 secondes'); }
      if(S.testChrono<=0){ clearInterval(S.testTimer); S.testTimer=null; bip(4); remettreTest(); }
    },1000);
  }
}
function remettreTest(){
  if(S.testTimer){clearInterval(S.testTimer);S.testTimer=null;}
  S.testCorrige = true;
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
  const n = S.testNote, dom = bilanDomaines();
  const forces = Object.keys(dom).filter(d=>dom[d].f===0);
  const faibles = Object.keys(dom).filter(d=>dom[d].f>0).sort((a,b)=>dom[b].f-dom[a].f);
  const seuil = 6.4;               // 32/50 ramené sur 10
  const solide = n >= 6;
  const w = S.semaines;

  const analyse = solide
    ? `Tu as des bases solides${forces.length?` — ${forces.slice(0,2).join(' et ').toLowerCase()} ${forces.length>1?'ne te posent':'ne te pose'} pas de problème`:''}. Mais ${faibles.length?`${faibles.length>1?'certaines lacunes précises':'une lacune précise'} — ${faibles.slice(0,2).join(', ').toLowerCase()} —`:'quelques lacunes'} peuvent te coûter des points le jour du concours.`
    : `Les bases sont là, mais elles ne tiennent pas encore sous chronomètre. ${faibles.length?`Tes pertes se concentrent sur ${faibles.slice(0,2).join(' et ').toLowerCase()}.`:''} Ce n'est pas un problème d'intelligence : c'est un problème d'entraînement, et il se règle.`;

  vue().innerHTML = `
  <div class="pad" style="padding-top:20px">
    <div class="marquehero">${logoSvg(38)}
      <div><div class="mot">MON <i>CONCOURS</i></div>
        <div class="devise">Réussis ton concours à coup sûr.</div></div></div>
    <div class="progression"><i class="on"></i><i class="on"></i><i class="on"></i></div>
    <div class="pastille-etape" style="margin:14px 0 10px">Étape 3 sur 3 · ton résultat</div>

    <div class="bloc-note">
      <div class="marque-note ${solide?'ok':''}">
        <span class="v num">${n}</span><span class="d num">/10</span>
      </div>
      <div class="note-legende">
        <div class="l1">Note obtenue</div>
        <div class="l2">${n} bonne${n>1?'s':''} réponse${n>1?'s':''} sur 10 questions</div>
        <div class="l3 ${solide?'ok':''}">${solide?'Au-dessus du seuil':'Sous le seuil du dernier admis'}</div>
      </div>
    </div>

    <div class="echelle">
      <div class="ec-tete"><span>Ton niveau aujourd'hui</span><span class="num">${n}/10</span></div>
      <div class="barre-seuil">
        <div class="rail"></div>
        <div class="moi" style="width:${Math.min(100,n*10)}%;background:${solide?'var(--cachet)':'var(--laterite)'}"></div>
        <div class="seuil" style="left:${seuil*10}%"></div>
      </div>
      <div class="ec-pied">
        <span class="num">0</span>
        <span class="marqueur" style="left:${seuil*10}%">Seuil du dernier admis · ${String(seuil).replace('.',',')}/10</span>
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
      <h4>Bonne nouvelle</h4>
      <p>Ton parcours personnalisé est déjà prêt.</p>
    </div>

    <button class="cta" style="margin-top:18px" data-entrer="1">Commencer mon parcours<small>Actualité · examen national · cahier</small></button>
    <button class="cta creux" style="margin-top:9px" data-retest="1">Refaire le test</button>
  </div>`;
}

/* =====================================================================
   ÉCRAN 2 — AUJOURD'HUI
   ===================================================================== */


/* =====================================================================
   LES QUESTIONS VIENNENT DE LA BASE
   ===================================================================== */
const CORRESPONDANCE = { 'Sciences de la vie':'SVT', 'Institutions et AES':'Institutions' };
const nomApp = n => CORRESPONDANCE[n] || n;

function melangerComposition(){
  for(let i = S.grille.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [S.grille[i], S.grille[j]] = [S.grille[j], S.grille[i]];
  }
}

let banqueChargee = false;
async function chargerQuestions(){
  if(!base || banqueChargee) return;
  banqueChargee = true;
  try{
    /* --- le sujet de composition --- */
    const { data: sujet } = await base.from('sujets')
      .select('id, duree_secondes, seuil_admission')
      .eq('reference', '2026-07').eq('statut', 'publie').maybeSingle();

    if(sujet){
      const { data: liens } = await base.from('sujet_questions')
        .select('position, questions(enonce, question_options(position, texte, est_correcte))')
        .eq('sujet_id', sujet.id).order('position');

      if(liens && liens.length){
        const neuf = liens.map(l => {
          const q = l.questions; if(!q) return null;
          const o = (q.question_options || []).slice().sort((a,b) => a.position - b.position);
          if(o.length < 2) return null;
          return { q: q.enonce, o: o.map(x => x.texte), i: o.findIndex(x => x.est_correcte) };
        }).filter(Boolean);

        if(neuf.length){
          S.grille.length = 0; neuf.forEach(x => S.grille.push(x));
          if(!S.corrige && !Object.keys(S.reponses).length){
            S.chrono = sujet.duree_secondes || 1500;
          }
        }
      }
    }

    /* --- la banque de révisions, au niveau choisi --- */
    const niv = S.niveau.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    const { data: qs } = await base.from('questions')
      .select('enonce, explication, matieres(nom), question_options(position, texte, est_correcte)')
      .eq('statut', 'publie').eq('source', 'cours').eq('niveau', niv).limit(500);

    if(qs && qs.length){
      const parMatiere = {};
      qs.forEach(q => {
        if(!q.matieres) return;
        const o = (q.question_options || []).slice().sort((a,b) => a.position - b.position);
        if(o.length < 2) return;
        const cle = nomApp(q.matieres.nom);
        (parMatiere[cle] = parMatiere[cle] || []).push({
          q: q.enonce, o: o.map(x => x.texte),
          i: o.findIndex(x => x.est_correcte), x: q.explication || ''
        });
      });
      if(Object.keys(parMatiere).length){
        Object.keys(QCM).forEach(k => delete QCM[k]);
        Object.keys(parMatiere).forEach(k => QCM[k] = parMatiere[k]);
      }
    }

    if(['grille','revisions','qcm'].includes(S.ecran)) rendre();
  }catch(e){ /* le contenu de secours reste en place */ }
}


/* =====================================================================
   RELIRE SA PROGRESSION
   ===================================================================== */
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

async function chargerProgression(){
  if(!base) return;
  const uid = await utilisateurCourant();
  if(!uid) return;

  try{
    const [c, st, er, co] = await Promise.all([
      base.rpc('mon_classement'),
      base.rpc('mes_stats'),
      base.rpc('mes_erreurs'),
      base.rpc('ma_composition_en_cours')
    ]);

    if(c.data) S.classement = c.data;
    if(st.data) S.stats = st.data;

    /* le cahier d'erreurs revient de la base */
    if(er.data && er.data.length){
      S.cahier.length = 0;
      er.data.forEach(e => {
        if(!e.options || e.options.length < 2) return;
        S.cahier.push({
          q: e.enonce,
          opts: e.options,
          i: e.bonne ?? 0,
          bon: e.options[e.bonne ?? 0],
          mien: '—',
          note: e.explication || 'Reprends-la jusqu\'à ce qu\'elle soit acquise.',
          rate: e.rate || 1,
          suite: e.suite || 0,
          revoirLe: new Date(e.revoir_le).setHours(0,0,0,0),
          session: 0
        });
      });
    }

    /* une composition laissée en route */
    if(co.data){
      S.compositionId = co.data.id;
      S.compoReprise = co.data;
    }

    if(['compte','cahier','aujourdhui','parcours'].includes(S.ecran)) rendre();
  }catch(e){}
}

/* =====================================================================
   LES COMPTES CANDIDATS
   ===================================================================== */
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
    if(/already registered|already been/i.test(error.message))
      return { erreur: "Ce numéro a déjà un compte. Choisissez « J'ai déjà un compte »." };
    return { erreur: error.message };
  }
  if(!data.session){
    const r = await base.auth.signInWithPassword({
      email: adresseTechnique(tel), password: motDePasse(tel, pin) });
    if(r.error) return { erreur: r.error.message };
    return { session: r.data.session };
  }
  return { session: data.session };
}

async function ouvrirSession(tel, pin){
  if(!base) return { erreur: "Pas de connexion au serveur pour l'instant." };
  const { data, error } = await base.auth.signInWithPassword({
    email: adresseTechnique(tel), password: motDePasse(tel, pin) });
  if(error){
    if(/Invalid login/i.test(error.message))
      return { erreur: "Numéro ou code secret incorrect." };
    return { erreur: error.message };
  }
  return { session: data.session };
}

async function reprendreSession(){
  if(!base) return;
  const { data } = await base.auth.getSession();
  if(!data || !data.session){
    /* La session du serveur a expiré : on corrige l'affichage optimiste,
       mais le candidat reste sur l'application, pas sur les trois étapes. */
    if(S.util.connecte){ S.util = {nom:'', tel:'', pin:'', connecte:false}; oublierIdentite(); rendre(); }
    return;
  }
  const uid = data.session.user.id;
  const { data: profil } = await base.from('profils')
    .select('nom, telephone, niveau').eq('id', uid).maybeSingle();
  if(profil){
    S.util = { nom: profil.nom, tel: profil.telephone || '', pin: '', connecte: true };
    S.modalDejaVu = true;
    /* le candidat voit d'abord le programme de sa propre classe */
    const classes = { troisieme:'Troisième', terminale:'Terminale', licence:'Licence' };
    if(profil.niveau && classes[profil.niveau] && classes[profil.niveau] !== S.niveau){
      S.niveau = classes[profil.niveau];
      chargerRessources();
    }
    ecrireMemoire({ nom: profil.nom, tel: profil.telephone || '', niveau: S.niveau });
    if(ECRANS_DECOUVERTE.includes(S.ecran)) return aller('aujourdhui'), chargerProgression();
    rendre();
    chargerProgression();
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
  setTimeout(chargerRessources, 1200);
  setTimeout(chargerConcours, 300);
}


/* =====================================================================
   OBSERVATION — collecte des événements
   Rien de personnel : ni saisie, ni mot de passe, ni position.
   ===================================================================== */
const VERSION_APP = 'v10';

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
      base.from('sessions').update({ user_id: uid }).eq('id', O.session);
    }
    await base.from('evenements').insert(lot.map(e => ({ ...e, user_id: uid, session_id: O.session })));
  }catch(e){}
}

function fermerSession(){
  pister('SESSION_ENDED', { duree_active_s: Math.round(O.dureeActive/1000) });
  if(base && O.session){
    try{
      base.from('sessions').update({
        fin_le: new Date().toISOString(),
        duree_active_s: Math.round(O.dureeActive/1000),
        nb_ecrans: O.nbEcrans, nb_actions: O.nbActions
      }).eq('id', O.session);
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

async function noterTentative(contexte, enonce, choix, correcte, tempsMs, position){
  if(!base) return;
  try{
    const uid = await utilisateurCourant();
    const { data: q } = await base.from('questions').select('id').eq('enonce', enonce).limit(1).maybeSingle();
    if(!q) return;
    await base.from('tentatives_question').insert({
      user_id: uid, session_id: O.session, question_id: q.id, contexte: contexte,
      choix: choix, correcte: correcte, temps_ms: tempsMs || null,
      position_dans_epreuve: position || null
    });
    if(uid && !correcte){
      await base.from('erreurs_utilisateur').upsert({
        user_id: uid, question_id: q.id, origine: contexte,
        revoir_le: new Date().toISOString().slice(0,10),
        derniere_erreur: new Date().toISOString()
      }, { onConflict: 'user_id,question_id' });
    }
    if(uid) marquerAssiduite();
  }catch(e){}
}

async function marquerAssiduite(){
  const uid = await utilisateurCourant();
  if(!uid || !base) return;
  try{
    await base.from('assiduite').upsert(
      { user_id: uid, jour: new Date().toISOString().slice(0,10), compose: true },
      { onConflict: 'user_id,jour' });
  }catch(e){}
}

async function ajouterPoints(motif, reference){
  if(!base) return;
  try{ await base.rpc('enregistrer_points', { p_motif: motif, p_reference: reference || null }); }
  catch(e){}
}

let ouvertureEnCours = false;
async function ouvrirComposition(){
  if(ouvertureEnCours || S.compositionId) return;
  ouvertureEnCours = true;
  const uid = await utilisateurCourant();
  if(!uid || !base){ ouvertureEnCours = false; return; }
  try{
    const { data: sujet } = await base.from('sujets').select('id').eq('reference','2026-07').maybeSingle();
    const { data } = await base.from('compositions').insert({
      user_id: uid, sujet_id: sujet ? sujet.id : null,
      nb_questions: S.grille.length, nb_traitees: 0
    }).select('id').single();
    if(data) S.compositionId = data.id;
  }catch(e){}
  ouvertureEnCours = false;
}

async function majComposition(){
  if(!base || !S.compositionId) return;
  try{
    await base.from('compositions').update({ nb_traitees: Object.keys(S.reponses).length })
      .eq('id', S.compositionId);
  }catch(e){}
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

async function cloturerComposition(){
  if(S.sync){ clearInterval(S.sync); S.sync = null; }
  effacerEpreuve();
  if(!base || !S.compositionId) return;
  const id = S.compositionId;
  try{
    /* Le téléphone envoie ses réponses. C'est le serveur qui compte les
       points : une note fabriquée dans le navigateur n'a plus d'effet. */
    const { data } = await base.rpc('remettre_composition', {
      p_composition: id, p_reponses: S.reponses, p_duree: 1500 - S.chrono
    });
    if(data && data.ok && typeof data.note === 'number' && data.note !== S.grilleNote){
      S.grilleNote = data.note;      // le serveur fait foi
      if(S.ecran === 'copie') rendre();
    }
    await ajouterPoints('composition', id);
    await marquerAssiduite();
  }catch(e){}
  S.compositionId = null;
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

    if(error || !data || !data.length) return;

    const fraiches = data.map(a => ({
      c: a.categorie === 'international' ? 'international' : 'national',
      s: a.source || 'Source officielle',
      v: a.verifiee ? 1 : 0,
      t: a.titre,
      x: a.contenu || '',
      p: a.pourquoi || ''
    }));

    ACTU.length = 0;
    fraiches.forEach(a => ACTU.push(a));

    if(['aujourdhui','actualite'].includes(S.ecran)) rendre();
  }catch(e){ /* le bulletin de secours reste affiché */ }
}

const ACTU = [
  {c:'national', s:'Conseil des ministres · hier', v:1,
   t:'Épreuves écrites des concours directs confirmées du 15 au 22 juillet',
   x:"Djibo maintenu comme centre secondaire de composition. Tests sportifs les 13 et 14 juin.",
   p:'Date officielle · tombe presque chaque année en question de calendrier'},
  {c:'national', s:'Décret · il y a 3 jours', v:1,
   t:'504 postes réservés aux VDP et aux couches spécifiques',
   x:"Agents de santé à base communautaire, enseignants communautaires, orphelins et veuves des personnels des forces de défense et de sécurité.",
   p:'Chiffre important · politique sociale de l\'État'},
  {c:'international', s:'AES · communiqué conjoint', v:1,
   t:'Le tarif extérieur commun de l\'AES entre en application',
   x:"Un prélèvement unique de 0,5 % sur les importations hors Alliance, destiné au financement des institutions communes des trois États.",
   p:'Organisation internationale · chiffre à retenir'},
  {c:'national', s:'Ministère de l\'Économie', v:1,
   t:'Budget de l\'État arrêté en hausse pour l\'exercice en cours',
   x:"Priorité affichée à la défense, à l'éducation et aux investissements agricoles. Part des ressources propres en progression.",
   p:'Grande décision nationale · souvent demandée en culture générale'},
  {c:'international', s:'Union africaine', v:0,
   t:'Thème retenu pour le prochain sommet de l\'Union africaine',
   x:"Trois formulations circulent dans la presse. Rien n'entre dans la base tant que le communiqué officiel n'est pas publié.",
   p:'En attente de vérification'},
  {c:'international', s:'Nations unies', v:1,
   t:'Renouvellement de la présidence tournante du Conseil de sécurité',
   x:"Rappel utile : cinq membres permanents, dix membres élus pour deux ans, présidence mensuelle par ordre alphabétique.",
   p:'Institution internationale · question classique'},
  {c:'national', s:'Présidence du Faso', v:1,
   t:'Nouveau découpage : les régions et leurs chefs-lieux',
   x:"La réforme territoriale modifie le nombre de régions et redéfinit plusieurs chefs-lieux. À apprendre par cœur, carte à l'appui.",
   p:'Réforme institutionnelle · tombe systématiquement'},
  {c:'international', s:'CEDEAO', v:1,
   t:'Sommet extraordinaire des chefs d\'État de la CEDEAO',
   x:"Question des relations commerciales avec les États de l'Alliance du Sahel après le retrait, effectif depuis janvier 2025.",
   p:'Organisation régionale · date d\'effet à connaître'},
  {c:'national', s:'Ministère de l\'Éducation', v:1,
   t:'Calendrier des examens scolaires et taux de réussite de la session',
   x:"Les taux de réussite au CEP, au BEPC et au baccalauréat sont publiés, avec le détail par région.",
   p:'Chiffres nationaux · fréquemment demandés'},
  {c:'national', s:'Assemblée législative', v:1,
   t:'Adoption d\'une loi sur la promotion du contenu local',
   x:"Le texte impose une part minimale de fournitures et de main-d'œuvre nationales dans les marchés publics.",
   p:'Grande décision nationale · texte de loi'},
  {c:'national', s:'Conseil des ministres', v:1,
   t:'Nomination du nouveau Premier ministre et composition du gouvernement',
   x:"Le décret fixe la liste des ministères et de leurs titulaires. À apprendre : les portefeuilles régaliens.",
   p:'Institution · question quasi certaine'},
  {c:'international', s:'FMI', v:1,
   t:'Rapport annuel sur les perspectives économiques en Afrique de l\'Ouest',
   x:"Croissance attendue, inflation et niveau d'endettement des pays de la sous-région, avec le détail par pays.",
   p:'Institution financière · chiffres à retenir'},
  {c:'international', s:'UEMOA', v:1,
   t:'Réunion du conseil des ministres de l\'UEMOA à Dakar',
   x:"Rappel : huit États membres, une monnaie commune, une commission basée à Ouagadougou.",
   p:'Organisation régionale · siège à connaître'},
  {c:'international', s:'ONU', v:1,
   t:'Objectifs de développement durable : état d\'avancement à mi-parcours',
   x:"Dix-sept objectifs adoptés en 2015 pour l'horizon 2030. Les retards se concentrent sur la faim et l'éducation.",
   p:'Dates et chiffres · classique de culture générale'}
];

function carteActu(a, neuf){
  return `<div class="info ${a.v?'ok':'att'}">
    <span class="tampon ${a.v?'t-ok':'t-att'}">${a.v?'✓ Vérifié':'⏸ Non publié'}</span>
    ${neuf?'<span class="tag-neuf">Nouveau</span>':''}
    <span class="eyebrow">${a.s}</span>
    <h4>${a.t}</h4><p>${a.x}</p>
  </div>`;
}

function ecranAujourdhui(){
  const f = S.taches.filter(Boolean).length;
  const enCours = !S.corrige && Object.keys(S.reponses).length > 0;
  vue().innerHTML = `
  <div class="pad">
    <div class="tete-jour">
      <span class="eyebrow">${dateDuJour()}</span>
      ${(() => {
        const j = joursAvantConcours();
        return j === null
          ? `<span class="pastille-j"><b class="num">${new Date().getFullYear()}</b> session en préparation</span>`
          : `<span class="pastille-j"><b class="num">J−${j}</b> avant ${E(S.nomConcours || 'les concours')}</span>`;
      })()}
    </div>
    <h2 class="titre">Actualité du matin</h2>
    <div class="ligne-direct">
      <span class="direct"><i></i>Mis à jour ce matin</span>
      <span class="sous-titre">National et international · 3 min</span>
    </div>

    <div class="colonnes">
    <div>
    ${enCours?`
    <button class="reprise-compo" data-go="grille">
      <div class="rc-tete">Vous avez une composition en cours</div>
      <div class="rc-sujet">Sujet n° 2026-07</div>
      <div class="rc-nb"><span class="num">${Object.keys(S.reponses).length}</span> questions répondues sur 50 · il reste <span class="num">${mmss(S.chrono)}</span></div>
      <div class="rc-cta">▶ Reprendre maintenant</div>
    </button>`:''}

    <div class="bloc">
      <div class="bandeau-actu"><span>${ACTU.filter(a=>a.v).length} informations vérifiées · conseil des ministres · décret · AES · CEDEAO · budget de l'État · union africaine · ${ACTU.filter(a=>a.v).length} informations vérifiées</span></div>
      <div class="carte">
        ${ACTU.slice(0,3).map((a,k)=>carteActu(a,k===0)).join('')}
      </div>
      <button class="voirplus" data-go="actualite">VOIR PLUS →</button>
    </div>

    </div>
    <div>
    <div class="bloc">
      <div class="libelle">Vos tâches du jour<span class="num">${f}/3</span></div>
      <div class="carte">
        <div class="etape ${S.taches[0]?'fait':'actif'}">
          <div class="puce">${S.taches[0]?'✓':'1'}</div>
          <div><h5>Lire l'actualité du matin</h5>
            <p>Validée dès que tu ouvres la page d'actualité et que tu la parcours jusqu'au bout.</p>
            <span class="dur">3 min</span></div>
        </div>
        <div class="etape ${S.taches[1]?'fait':(S.taches[0]?'actif':'')}">
          <div class="puce">${S.taches[1]?'✓':'2'}</div>
          <div><h5>Passer l'examen national</h5>
            <p>La composition du jour, en conditions réelles. Validée automatiquement à la remise de la copie.</p>
            <span class="dur">20 min</span></div>
        </div>
        <div class="etape ${S.taches[2]?'fait':''}">
          <div class="puce">${S.taches[2]?'✓':'3'}</div>
          <div><h5>Revoir mes erreurs les plus fréquentes</h5>
            <p>${ouvertes()} erreurs ouvertes, triées par nombre de rechutes.</p>
            <span class="dur">10 min</span></div>
        </div>
      </div>
      ${!S.taches[0] ? `<button class="cta" data-go="actualite" style="margin-top:12px">Lire l'actualité<small>Tâche 1 sur 3</small></button>`
        : (!S.taches[1] ? `<button class="cta" data-go="grille" style="margin-top:12px">Passer l'examen national<small>Tâche 2 sur 3 · la composition</small></button>`
        : `<button class="cta" data-cahierfreq="1" style="margin-top:12px">Revoir mes erreurs fréquentes<small>Tâche 3 sur 3</small></button>`)}
    </div>
    </div>
    </div>
  </div>`;
}

function ecranActualite(){
  S.taches[0] = true; sauverTaches();
  pister('NEWS_LIST_VIEWED', { onglet: S.actuOnglet });
  const liste = ACTU.filter(a=>a.c===S.actuOnglet);
  vue().innerHTML = `
  <div class="pad">
    <button class="retourhaut" data-go="aujourdhui">Aujourd'hui</button>
    <h2 class="titre">Actualité<br>du matin</h2>
    <p class="sous" style="margin-top:6px">Seules les informations utiles au concours entrent ici : grandes décisions nationales, organisations internationales, dates et chiffres. Un fait divers local n'y a pas sa place.</p>

    <div class="onglets">
      <button class="${S.actuOnglet==='national'?'on':''}" data-actu="national">National</button>
      <button class="${S.actuOnglet==='international'?'on':''}" data-actu="international">International</button>
    </div>

    <div class="bloc" style="margin-top:12px">
      <div class="libelle">${S.actuOnglet==='national'?'Burkina Faso':'Monde et organisations'}<span class="num">${liste.length}</span></div>
      <div class="carte">${liste.map(carteActu).join('')}</div>
    </div>

    <button class="cta" style="margin-top:16px" data-go="aujourdhui">J'ai lu · valider ma tâche</button>
  </div>`;
}

/* =====================================================================
   COMPTE — inscription, connexion
   ===================================================================== */

/* ---------- ICONOGRAPHIE ---------- */
function ico(n, t){
  t = t || 20;
  const o = `width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"`;
  const p = {
    actualite:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h6M7 13h10M7 17h7"/>',
    musique:'<path d="M9 18V5l10-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
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
    sortie:'<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 16l-4-4 4-4M6 12h9"/>'
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
function majPaie(val){ S.paieTel = val; }

function ecranInscription(){
  vue().innerHTML = `
  <div class="pad" style="padding-top:22px">
    ${logoSvg(44)}
    <h2 class="titre" style="margin-top:16px">Garde ton<br>résultat</h2>
    <p class="sous" style="margin:8px 0 18px">Tu viens de composer ${S.testNote!==null?`et d'obtenir ${S.testNote}/10`:''}. Crée ton compte pour retrouver ton cahier d'erreurs, ton classement et ta série sur n'importe quel téléphone.</p>

    ${S.erreur?`<div class="alerte" role="alert">${S.erreur}</div>`:''}

    <div class="champ">
      <label for="f-nom">Nom et prénom</label>
      <input id="f-nom" type="text" value="${S.form.nom}" placeholder="Kantagba Jean" oninput="maj('nom',this.value)" autocomplete="name">
    </div>
    <div class="champ">
      <label for="f-tel">Numéro de téléphone</label>
      <div class="prefixe"><span class="ind">+226</span>
        <input id="f-tel" type="tel" inputmode="numeric" maxlength="8" value="${S.form.tel}" placeholder="70 00 00 00" oninput="maj('tel',this.value)" autocomplete="tel">
      </div>
      <div class="aide">C'est ce numéro qui servira aussi pour l'abonnement. Pas d'adresse e-mail à retenir.</div>
    </div>
    <div class="champ">
      <label for="f-pin">Code secret à 4 chiffres</label>
      <input id="f-pin" type="password" inputmode="numeric" maxlength="4" value="${S.form.pin}" placeholder="••••" oninput="maj('pin',this.value)">
    </div>

    <button class="cta" style="margin-top:6px" data-inscrire="1">Créer mon compte<small>Gratuit · aucune carte bancaire</small></button>
    <button class="lien" data-go="connexion">J'ai déjà un compte</button>

    <p class="sous" style="margin-top:18px;font-size:11.5px">En créant ton compte, tu acceptes les conditions d'utilisation. Ton numéro ne sert qu'à ton compte et à ton abonnement.</p>
  </div>`;
}

function ecranConnexion(){
  vue().innerHTML = `
  <div class="pad" style="padding-top:22px">
    ${logoSvg(44)}
    <h2 class="titre" style="margin-top:16px">Content de<br>te revoir</h2>
    <p class="sous" style="margin:8px 0 18px">Ton cahier d'erreurs et ta série d'assiduité t'attendent.</p>

    ${S.erreur?`<div class="alerte" role="alert">${S.erreur}</div>`:''}

    <div class="champ">
      <label for="c-tel">Numéro de téléphone</label>
      <div class="prefixe"><span class="ind">+226</span>
        <input id="c-tel" type="tel" inputmode="numeric" maxlength="8" value="${S.form.tel}" placeholder="70 00 00 00" oninput="maj('tel',this.value)" autocomplete="tel">
      </div>
    </div>
    <div class="champ">
      <label for="c-pin">Code secret</label>
      <input id="c-pin" type="password" inputmode="numeric" maxlength="4" value="${S.form.pin}" placeholder="••••" oninput="maj('pin',this.value)">
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
         href="https://wa.me/226${CONTACT.adminTel}?text=${encodeURIComponent("Bonjour, je n'arrive pas à me connecter à Mon Concours.")}"
         target="_blank" rel="noopener">Écrire à l'administrateur<small>WhatsApp ${CONTACT.adminTel}</small></a>
    </div>` : ''}
  </div>`;
}

/* =====================================================================
   ABONNEMENT ET PAIEMENT
   ===================================================================== */
const FORMULES = {
  mensuelle:{n:'Formule 1', prix:'500 FCFA', per:'par mois', reco:false},
  annuelle:{n:'Formule 2', prix:'5 000 FCFA', per:'par an', reco:true}
};
function ecranAbonnement(){
  vue().innerHTML = `
  <div class="pad">
    <button class="retourhaut" data-go="compte">Mon compte</button>
    <h2 class="titre">Profitez d'une<br>semaine gratuite</h2>
    <p class="sous" style="margin:10px 0 18px">Tout est ouvert pendant sept jours. Choisissez ensuite la formule qui vous convient.</p>

    <div class="libelle">Choisissez votre formule</div>
    ${Object.keys(FORMULES).map(k=>{
      const f = FORMULES[k];
      return `<div class="formule ${S.choixFormule===k?'on':''} ${f.reco?'reco':''}">
        ${f.reco?'<span class="ruban">le plus utilisé ★★★★</span>':''}
        <div class="haut"><span class="nom">${f.n}</span>
          <span class="prix">${f.prix} <em>${f.per}</em></span></div>
        <button class="mini" style="margin-top:12px" data-formule="${k}">${S.choixFormule===k?'Formule sélectionnée ✓':'Choisir cette formule'}</button>
      </div>`;
    }).join('')}

    <button class="cta" style="margin-top:10px" data-go="paiement">Payer par mobile money<small>${FORMULES[S.choixFormule].prix} · ${FORMULES[S.choixFormule].per}</small></button>
  </div>`;
}

function ecranPaiement(){
  const f = FORMULES[S.choixFormule];
  const op = {orange:'Orange Money',moov:'Moov Money',wave:'Wave'}[S.operateur];
  if(S.paieEtape===1){
    vue().innerHTML = `
    <div class="pad" style="padding-top:60px;text-align:center">
      <div class="attente" role="status" aria-label="Paiement en cours"></div>
      <h2 class="titre" style="font-size:22px">Confirme sur<br>ton téléphone</h2>
      <p class="sous" style="margin:12px 0 20px">Un message ${op} vient d'être envoyé au +226 ${S.paieTel||'…'}. Saisis ton code secret ${op} pour valider ${f.prix}.</p>
      <div class="ussd">
        <div class="eyebrow">ou compose</div>
        <div class="code">*144*4*6*${f.prix.replace(/\D/g,'')}#</div>
        <p>Si tu n'as rien reçu au bout d'une minute, compose ce code directement.</p>
      </div>
      <button class="cta" style="margin-top:18px" data-paiefin="1">J'ai validé le paiement</button>
      <button class="lien" data-paieannul="1">Annuler</button>
    </div>`;
    return;
  }
  if(S.paieEtape===2){
    vue().innerHTML = `
    <div class="pad" style="padding-top:44px;text-align:center">
      <div class="cachet-note" style="max-width:230px">
        <div class="n" style="font-size:34px">…</div>
        <div class="l">paiement en vérification</div>
      </div>
      <h2 class="titre" style="font-size:24px">Nous vérifions<br>votre paiement</h2>
      <p class="sous" style="margin:12px 0 6px">La confirmation de l'opérateur peut prendre quelques minutes. Votre formule s'ouvrira dès qu'elle sera reçue. Vous gardez l'accès à tout ce qui est déjà ouvert.</p>
      <div class="carte" style="margin-top:16px;text-align:left">
        <div class="mat"><div class="nom">Numéro déclaré<em>Au +226 ${S.paieTel}</em></div><div class="val">✓</div></div>
        <div class="mat"><div class="nom">Formule demandée<em>${f.n} · ${f.per}</em></div><div class="val num">${f.prix}</div></div>
      </div>
      <button class="cta" style="margin-top:18px" data-go="revisions">Ouvrir mes révisions</button>
      <button class="cta creux" style="margin-top:9px" data-go="compte">Retour à mon compte</button>
    </div>`;
    return;
  }
  vue().innerHTML = `
  <div class="pad">
    <button class="retourhaut" data-go="abonnement">Formules</button>
    <h2 class="titre">Paiement</h2>
    <p class="sous" style="margin:8px 0 18px">Formule ${f.n} · ${f.prix} ${f.per}. Aucun compte bancaire nécessaire.</p>

    ${S.erreur?`<div class="alerte" role="alert">${S.erreur}</div>`:''}

    <div class="libelle">Opérateur</div>
    <button class="operateur ${S.operateur==='orange'?'on':''}" data-operateur="orange" aria-pressed="${S.operateur==='orange'}">
      <span class="pastille om">OM</span><span><b>Orange Money</b><span>Validation par code secret sur ton téléphone</span></span></button>
    <button class="operateur ${S.operateur==='moov'?'on':''}" data-operateur="moov" aria-pressed="${S.operateur==='moov'}">
      <span class="pastille mm">MM</span><span><b>Moov Money</b><span>Validation par code secret sur ton téléphone</span></span></button>
    <button class="operateur ${S.operateur==='wave'?'on':''}" data-operateur="wave" aria-pressed="${S.operateur==='wave'}">
      <span class="pastille wv">W</span><span><b>Wave</b><span>Validation par code secret sur ton téléphone</span></span></button>

    <div class="champ" style="margin-top:16px">
      <label for="p-tel">Numéro ${S.operateur==='orange'?'Orange':'Moov'}</label>
      <div class="prefixe"><span class="ind">+226</span>
        <input id="p-tel" type="tel" inputmode="numeric" maxlength="8" value="${S.paieTel}" placeholder="70 00 00 00" oninput="majPaie(this.value)">
      </div>
      <div class="aide">Tu recevras une demande de confirmation immédiatement.</div>
    </div>

    <div class="carte">
      <div class="mat"><div class="nom">Formule ${f.n}<em>${f.per}</em></div><div class="val num">${f.prix}</div></div>
      <div class="mat"><div class="nom">Frais de transaction<em>Pris en charge</em></div><div class="val num">0 F</div></div>
      <div class="mat"><div class="nom" style="font-weight:600">Total à payer</div><div class="val num" style="color:var(--craie)">${f.prix}</div></div>
    </div>

    <button class="cta vert" style="margin-top:16px" data-payer="1">Payer ${f.prix}<small>Sans engagement · résiliable à tout moment</small></button>
  </div>`;
}

/* =====================================================================
   MES RÉVISIONS — QCM par matière
   ===================================================================== */
const MATIERES = [
  {n:'Culture générale', e:'CG', p:{'Troisième':72,'Terminale':82,'Licence':64}, q:{'Troisième':180,'Terminale':250,'Licence':320}},
  {n:'SVT', e:'SV', p:{'Troisième':41,'Terminale':46,'Licence':38}, q:{'Troisième':150,'Terminale':240,'Licence':210}},
  {n:'Français', e:'FR', p:{'Troisième':80,'Terminale':74,'Licence':69}, q:{'Troisième':200,'Terminale':260,'Licence':300}},
  {n:'Histoire-Géographie', e:'HG', p:{'Troisième':66,'Terminale':71,'Licence':58}, q:{'Troisième':170,'Terminale':230,'Licence':280}},
  {n:'Mathématiques', e:'MA', p:{'Troisième':54,'Terminale':49,'Licence':44}, q:{'Troisième':160,'Terminale':220,'Licence':240}},
  {n:'Institutions', e:'IN', p:{'Troisième':30,'Terminale':52,'Licence':61}, q:{'Troisième':90,'Terminale':180,'Licence':290}},
  {n:'Géopolitique', e:'GP', p:{'Troisième':12,'Terminale':24,'Licence':33}, q:{'Troisième':70,'Terminale':140,'Licence':260}},
  {n:'Droit et économie', e:'DE', p:{'Troisième':8,'Terminale':18,'Licence':29}, q:{'Troisième':60,'Terminale':120,'Licence':250}}
];
const PROGRAMME = {
  'Troisième':'Programme du BEPC · concours de niveau troisième',
  'Terminale':'Programme du baccalauréat · concours de niveau terminale',
  'Licence':'Programme supérieur · concours de niveau licence'
};
const QCM = {
  'SVT':[
    {q:'La mitochondrie est :',o:['Le siège de la photosynthèse','Une réserve d\'eau','Le siège de la respiration cellulaire','Une hormone'],i:2,
     x:"La mitochondrie est l'organite responsable de la respiration cellulaire et de la production d'énergie sous forme d'ATP."},
    {q:'La glycogénolyse désigne :',o:['La synthèse du glycogène','La dégradation du glycogène en glucose','L\'absorption intestinale du glucose','La transformation du glucose en lipides'],i:1,
     x:"« Lyse » signifie destruction. Le foie casse ses réserves de glycogène pour libérer du glucose, sous l'action du glucagon."},
    {q:'Quelle hormone fait baisser la glycémie ?',o:['Le glucagon','L\'insuline','L\'adrénaline','Le cortisol'],i:1,
     x:"L'insuline range le sucre, le glucagon le libère. Retenez toujours la paire, jamais l'une sans l'autre."},
    {q:'Le crâne humain compte :',o:['20 os','22 os','23 os','26 os'],i:1,
     x:"8 os crâniens et 14 os de la face, soit 22. Plusieurs corrigés en circulation annoncent 23 : c'est faux."},
    {q:'L\'ADN est constitué de :',o:['Acides aminés','Nucléotides','Lipides','Glucides'],i:1,
     x:"L'ADN est une chaîne de nucléotides, chacun formé d'un sucre, d'un phosphate et d'une base azotée."}
  ],
  'Culture générale':[
    {q:'Capitale économique du Burkina Faso :',o:['Ouagadougou','Bobo-Dioulasso','Koudougou','Banfora'],i:1,
     x:"Bobo-Dioulasso concentre l'essentiel de l'activité industrielle et commerciale du pays."},
    {q:'Dans quelle ville se trouve l\'usine DAFANI-SA ?',o:['Bobo-Dioulasso','Banfora','Orodara','Ouagadougou'],i:2,
     x:"Orodara, dans la province du Kénédougou, au cœur de la zone des vergers de mangues."},
    {q:'Le pays a pris le nom de Burkina Faso en :',o:['1960','1983','1984','1987'],i:2,
     x:"Le 4 août 1984, un an après la révolution du 4 août 1983. Attention à ne pas confondre les deux dates."},
    {q:'Le seul cours d\'eau pérenne du pays est :',o:['Le Nakambé','Le Nazinon','Le Mouhoun','La Comoé'],i:2,
     x:"Le Mouhoun, ancienne Volta Noire, coule toute l'année. Les autres sont intermittents."}
  ],
  'Français':[
    {q:'« Le pays des hommes intègres » est :',o:['Une comparaison','Une métaphore','Une périphrase','Une personnification'],i:2,
     x:"La périphrase remplace un nom par une expression qui le décrit. Tombée en 2023 et en 2025."},
    {q:'« Les lettres que j\'ai … »',o:['écrit','écrite','écrits','écrites'],i:3,
     x:"Le participe passé employé avec « avoir » s'accorde avec le COD placé avant : « les lettres », féminin pluriel."},
    {q:'« Il eût fallu » est au :',o:['Conditionnel présent','Subjonctif imparfait','Plus-que-parfait du subjonctif','Passé antérieur'],i:2,
     x:"Auxiliaire au subjonctif imparfait + participe passé = plus-que-parfait du subjonctif, souvent employé comme conditionnel passé."},
    {q:'Les fondateurs de la Négritude sont :',o:['Senghor, Césaire, Damas','Senghor, Diop, Kane','Césaire, Fanon, Memmi','Damas, Sartre, Césaire'],i:0,
     x:"Léopold Sédar Senghor, Aimé Césaire et Léon-Gontran Damas, dans les années 1930 à Paris."}
  ],
  'Histoire-Géographie':[
    {q:'Le Burkina Faso est limité au sud-ouest par :',o:['Le Niger','Le Mali','La Côte d\'Ivoire','Le Bénin'],i:2,
     x:"Six pays frontaliers : Mali, Niger, Bénin, Togo, Ghana et Côte d'Ivoire au sud-ouest."},
    {q:'La révolution burkinabè a été proclamée le :',o:['4 août 1983','15 octobre 1987','3 janvier 1966','11 décembre 1960'],i:0,
     x:"Le 4 août 1983. Le 15 octobre 1987 marque au contraire sa fin."},
    {q:'Le climat sahélien du nord se caractérise par :',o:['Deux saisons des pluies','Une saison des pluies courte','Des pluies toute l\'année','Une absence totale de pluie'],i:1,
     x:"Le domaine sahélien connaît une saison des pluies courte, de trois à quatre mois, et de faibles cumuls."}
  ],
  'Mathématiques':[
    {q:'Solution de l\'équation 2x + 6 = 0 :',o:['x = 3','x = −3','x = 12','x = −12'],i:1,
     x:"2x = −6, donc x = −3. Vérifiez toujours en remplaçant : 2×(−3) + 6 = 0."},
    {q:'25 % de 480 vaut :',o:['96','110','120','125'],i:2,
     x:"25 % correspond au quart. 480 ÷ 4 = 120."},
    {q:'L\'aire d\'un cercle de rayon 3 est :',o:['6π','9π','3π','12π'],i:1,
     x:"Aire = πr². Avec r = 3, on obtient 9π. Ne pas confondre avec le périmètre, 2πr = 6π."}
  ],
  'Institutions':[
    {q:'L\'Alliance des États du Sahel réunit :',o:['Burkina, Mali, Guinée','Burkina, Mali, Niger','Burkina, Niger, Tchad','Mali, Niger, Guinée'],i:1,
     x:"Burkina Faso, Mali et Niger, par la charte du Liptako-Gourma signée en septembre 2023."},
    {q:'Le retrait de la CEDEAO a pris effet le :',o:['28 janvier 2024','29 janvier 2025','1ᵉʳ juillet 2024','16 septembre 2023'],i:1,
     x:"Le 28 janvier 2024 est la date de l'annonce. L'effet est intervenu un an plus tard, le 29 janvier 2025."},
    {q:'Le contrôle de la constitutionnalité des lois relève :',o:['De la Cour de cassation','Du Conseil constitutionnel','Du Conseil d\'État','De la Cour des comptes'],i:1,
     x:"Le Conseil constitutionnel juge la conformité des lois à la Constitution. La Cour des comptes contrôle les finances publiques."}
  ],
  'Géopolitique':[
    {q:'Le Conseil de sécurité de l\'ONU compte :',o:['10 membres','15 membres','20 membres','5 membres'],i:1,
     x:"Cinq membres permanents disposant du droit de veto et dix membres élus pour deux ans, soit quinze au total."},
    {q:'Le siège de l\'Union africaine se trouve à :',o:['Abuja','Addis-Abeba','Nairobi','Le Caire'],i:1,
     x:"Addis-Abeba, en Éthiopie, depuis la création de l'Organisation de l'unité africaine en 1963."},
    {q:'Le tarif extérieur commun de l\'AES est fixé à :',o:['0,5 %','1,5 %','5 %','10 %'],i:0,
     x:"Un prélèvement de 0,5 % sur les importations hors Alliance, destiné à financer les institutions communes."}
  ],
  'Droit et économie':[
    {q:'Le budget de l\'État est voté par :',o:['Le gouvernement','L\'Assemblée législative','La Cour des comptes','Le Conseil constitutionnel'],i:1,
     x:"Le gouvernement prépare le projet de loi de finances, l'organe législatif le vote, la Cour des comptes en contrôle l'exécution."},
    {q:'L\'inflation désigne :',o:['La baisse de la production','La hausse générale des prix','La hausse du chômage','La dévaluation de la monnaie'],i:1,
     x:"L'inflation est la hausse durable et générale du niveau des prix, qui réduit le pouvoir d'achat."},
    {q:'Le PIB mesure :',o:['La richesse produite en un an','Le total des salaires','Les recettes de l\'État','La masse monétaire'],i:0,
     x:"Le produit intérieur brut mesure la valeur des richesses produites sur le territoire pendant une année."}
  ]
};
const MOTIVATIONS = [
  ['Tu progresses.','Cinq questions d\'affilée. Ton taux dans cette matière vient de bouger.'],
  ['Excellent.','Dix questions traitées sans t\'arrêter. C\'est exactement ce rythme qui creuse l\'écart.'],
  ['Continue comme ça.','Encore quelques questions avant de terminer ce module.'],
  ['Bravo.','Tu maîtrises maintenant la majorité des questions de ce chapitre.']
];

function ecranRevisions(){
  const total = MATIERES.reduce((a,m)=>a+m.q[S.niveau],0);
  vue().innerHTML = `
  <div class="pad">
    <div class="eyebrow">Mes révisions</div>
    <h2 class="titre">Choisis ton niveau</h2>
    <p class="sous" style="margin:8px 0 16px">Les questions, leur difficulté et le programme changent entièrement selon le niveau du concours visé.</p>

    <div class="niveaux" role="group" aria-label="Niveau">
      ${['Troisième','Terminale','Licence'].map(n=>`<button class="${S.niveau===n?'on':''}" data-niv="${n}" aria-pressed="${S.niveau===n}">${n}</button>`).join('')}
    </div>

    <div class="bandeau-niveau reveal" key="${S.niveau}">
      <div><b>${PROGRAMME[S.niveau]}</b>
        <span>8 matières · <span class="num">${total.toLocaleString('fr-FR')}</span> questions à ce niveau</span></div>
      <span class="tampon t-ok">${S.niveau}</span>
    </div>

    <div class="reveal" id="listecours">
    ${MATIERES.map((m,k)=>{
      const pc = m.p[S.niveau], nb = m.q[S.niveau];
      const bloque = false;
      if(bloque) return `<button class="cours verrou" data-go="abonnement">
        <span class="ic">${m.e}</span>
        <span class="co"><b>${m.n}</b>
          <span class="pc">${nb} questions · réservé à la formule Candidat</span></span>
        <span class="cad">${ico('cadenas',17)}</span></button>`;
      return `<button class="cours" data-mat="${m.n}">
        <span class="ic">${m.e}</span>
        <span class="co"><b>${m.n}</b>
          <span class="bar"><i style="width:${pc}%"></i></span>
          <span class="pc">${pc} % terminé · ${Math.round(pc*nb/100)} sur ${nb} questions</span></span>
        <span class="fl">${pc>0?'CONTINUER':'COMMENCER'} →</span>
      </button>`;
    }).join('')}
    </div>

    <div class="carte" style="margin-top:12px">
      <p class="sous">Ici, pas de leçons à lire : uniquement des questions. Tu réponds, tu vois immédiatement pourquoi c'est juste ou faux, tu passes à la suivante.</p>
    </div>

    <button class="cta creux" style="margin-top:12px" data-go="cours">
      Lire ou télécharger les différents cours<small>Huit fascicules · lecture en ligne ou hors connexion</small></button>
  </div>`;
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

function ecranCours(){
  const q = (S.rechercheCours || '').trim().toLowerCase();
  const dispo = !q ? S.ressources : (S.ressources || []).filter(r =>
    ((r.titre || '') + ' ' + (r.matiere || '') + ' ' + (r.theme || '') + ' ' + (r.texte || ''))
      .toLowerCase().includes(q));
  const parMatiere = {};
  const ordreMatieres = [];                 /* on garde l'ordre du programme */
  (dispo || []).forEach(r => {
    const m = r.matiere || 'Autres documents';
    if(!parMatiere[m]){ parMatiere[m] = []; ordreMatieres.push(m); }
    parMatiere[m].push(r);
  });
  const TYPES = { cours:'Cours', exercices:'Exercices', corrige:'Corrigé',
                  fiche:'Fiche de révision', annale:'Ancien sujet', autre:'Document' };

  vue().innerHTML = `
  <div class="pad">
    <button class="retourhaut" data-go="revisions">Mes révisions</button>
    <h2 class="titre">Les cours</h2>
    <p class="sous" style="margin:8px 0 16px">Les documents au programme ${S.niveau.toLowerCase()}. À lire ici, ou à télécharger une fois pour travailler sans connexion.</p>

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

    ${S.erreurCours ? `<div class="carte" style="border-color:var(--rouge-bord);background:var(--rouge-fond)"><p class="sous">${S.erreurCours}</p></div>` : ''}

    ${dispo === null
      ? `<div class="carte"><p class="sous">Chargement de la bibliothèque…</p></div>`
      : !dispo.length
        ? `<div class="carte"><p class="sous">Aucun document n'est encore disponible pour ce niveau. Reviens bientôt : la bibliothèque se remplit au fur et à mesure.</p></div>`
        : ordreMatieres.map(m => `
          <div class="bloc" style="margin-top:14px">
            <div class="libelle">${m}<span class="num">${parMatiere[m].length}</span></div>
            <button class="cta" style="margin:10px 0 8px" data-matiere="${encodeURIComponent(m)}">
              📖 Lire le cours complet<small>Tout ${E(m)} en une seule lecture · ${parMatiere[m].length} partie${parMatiere[m].length>1?'s':''}</small></button>
            <button class="cta creux" style="margin:0 0 6px" data-cible="${E(m)}">
              📝 Faire les QCM du cours<small>Les questions qui portent sur ce cours</small></button>
            <p class="sous" style="margin:2px 0 0;font-size:12.5px">Au programme : ${
              parMatiere[m].slice(0,4).map(r => E(r.titre)).join(' · ')
            }${parMatiere[m].length > 4 ? ' · et ' + (parMatiere[m].length - 4) + ' autre' + (parMatiere[m].length-4>1?'s':'') : ''}</p>
            ${parMatiere[m].filter(r => r.fichier_chemin && !r.texte).map(r => `
              <div class="fascicule">
                <div class="ligne1"><span class="ic">PDF</span>
                  <div class="co"><b>${E(r.titre)}</b><span>Document à télécharger</span></div></div>
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
function ouvrirPartage(quoi){
  const t = texteDePartage(quoi), lien = CONTACT.site;
  const complet = encodeURIComponent(t + ' ' + lien);
  S.modal = 'partage';
  document.getElementById('voile').hidden = false;
  document.getElementById('voile').innerHTML = `
  <div class="feuille" role="dialog" aria-label="Partager">
    <div class="poignee"></div>
    <h3 class="titre" style="font-size:20px;margin:0 0 4px">Partager</h3>
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
function feuilleComposition(source){
  /* source : { grille:[{i}], reponses:{}, note, duree, date }
     Sans source, on imprime la composition qui vient d'être remise. */
  const S0 = source || { grille:S.grille, reponses:S.reponses, note:S.grilleNote,
                         duree:1500 - S.chrono, date:new Date() };
  const total = S0.grille.length, note = S0.note;
  const justes = [], rates = [], blancs = [];
  S0.grille.forEach((g, i) => {
    const r = S0.reponses[i] || [];
    if(!r.length) blancs.push(i);
    else if(r.length === 1 && r[0] === g.i) justes.push(i);
    else rates.push(i);
  });
  const d = S0.date || new Date();
  const quand = d.toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' });
  const pct = total ? Math.round(note / total * 100) : 0;
  const seuil = Math.round(total * 0.64);
  const admis = note >= seuil;
  const mots = (S.util.nom || 'Candidat').trim().split(/\s+/).filter(Boolean);
  const initiales = (mots.length > 1 ? mots[0][0] + mots[mots.length-1][0] : (mots[0]||'C').slice(0,2)).toUpperCase();

  const encouragement = admis
    ? "Vous êtes au-dessus du seuil. Tenez la position : le seuil monte presque chaque année."
    : pct >= 45
      ? "Les bases sont là. Ce qui manque se rattrape par l'entraînement, pas par le talent."
      : "Ce résultat n'est pas un verdict. Chaque erreur refermée vous rapproche d'une place.";

  const recommandations = [];
  if(blancs.length > total * 0.15)
    recommandations.push("Vous avez laissé " + blancs.length + " question" + (blancs.length>1?'s':'') + " blanche" + (blancs.length>1?'s':'') + ". Une case noircie au hasard vaut mieux qu'une case vide : ne rendez jamais une copie incomplète.");
  if(rates.length > justes.length)
    recommandations.push("Vous avez plus de réponses fausses que de bonnes. Ralentissez : lisez l'énoncé en entier avant de noircir.");
  if(S0.duree < 900 && blancs.length)
    recommandations.push("Vous avez rendu en avance avec des questions blanches. Utilisez tout le temps accordé.");
  if(justes.length >= total * 0.7)
    recommandations.push("Votre niveau est solide. Travaillez maintenant la régularité : composez chaque jour à la même heure.");
  recommandations.push("Reprenez vos " + rates.length + " erreur" + (rates.length>1?'s':'') + " dans « Mes erreurs ». Elles reviendront jusqu'à disparaître.");

  /* La grille telle qu'elle a été noircie, puis corrigée :
     vert = la bonne case, rouge barré = ce qui a été noirci à tort. */
  const grilleHtml = S0.grille.map((g, i) => {
    const r = S0.reponses[i] || [];
    return '<div class="ligne"><span class="no">' + (i+1) + '</span>' +
      [0,1,2,3].map(k => {
        const choisi = r.includes(k), bon = (k === g.i);
        let cl = 'b';
        if(bon && choisi) cl += ' juste';
        else if(bon)      cl += ' attendue';
        else if(choisi)   cl += ' faute';
        return '<span class="' + cl + '">' + 'ABCD'[k] + '</span>';
      }).join('') + '</div>';
  }).join('');

  const html = '<!doctype html><html lang="fr"><head><meta charset="utf-8">' +
'<title>Feuille de composition — ' + E(S.util.nom || 'Candidat') + '</title>' +
'<style>' +
'@page{size:A4;margin:14mm}' +
'*{box-sizing:border-box}' +
'body{font-family:Georgia,"Times New Roman",serif;color:#111;margin:0;line-height:1.5}' +
'.tete{display:flex;align-items:center;gap:14px;border-bottom:3px double #111;padding-bottom:12px}' +
'.marque .n{font-size:19px;font-weight:bold;letter-spacing:.04em}' +
'.marque .d{font-size:11px;color:#555;font-style:italic}' +
'.sceau{width:52px;height:52px;border-radius:13px;background:#EDE4D3;border:1px solid #C9BEA9;' +
'  display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:7px;flex:0 0 auto}' +
'.sceau i{border-radius:50%;background:#FBFAF7;border:1px solid #C9BEA9}' +
'.sceau i:nth-child(2),.sceau i:nth-child(3){background:#1C1C1C;border-color:#1C1C1C}' +
'h1{font-size:15px;letter-spacing:.2em;text-transform:uppercase;margin:16px 0 10px;' +
'  border-bottom:1px solid #111;padding-bottom:5px}' +
'.ident{display:flex;gap:10px;flex-wrap:wrap}' +
'.ident div{flex:1 1 120px;border:1px solid #bbb;padding:7px 10px}' +
'.ident b{display:block;font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:#666;font-weight:normal}' +
'.ident span{font-size:14px}' +
'.resultat{display:flex;gap:14px;align-items:stretch;margin-top:14px}' +
'.note{border:2px solid #111;padding:12px 20px;text-align:center;min-width:150px}' +
'.note .n{font-size:40px;font-weight:bold;line-height:1}' +
'.note .l{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#555;margin-top:5px}' +
'.note .v{margin-top:7px;font-size:12px;padding:3px 8px;display:inline-block;border:1px solid #111}' +
'.rec{flex:1;border-collapse:collapse;font-size:13px}' +
'.rec td{border:1px solid #bbb;padding:5px 9px}' +
'.rec td:last-child{text-align:right;font-weight:bold;width:64px}' +
'.grille{display:grid;grid-template-columns:repeat(5,1fr);gap:3px 12px;font-family:Helvetica,Arial,sans-serif}' +
'.ligne{display:flex;align-items:center;gap:3px;font-size:11px;break-inside:avoid}' +
'.no{width:20px;text-align:right;color:#666;font-size:10px}' +
'.b{width:17px;height:17px;line-height:16px;text-align:center;border:1px solid #ccc;' +
'  border-radius:50%;font-size:10px;color:#bbb}' +
'.b.juste{background:#0E7A54;border-color:#0E7A54;color:#fff;font-weight:bold}' +
'.b.attendue{border:2px solid #0E7A54;color:#0E7A54;font-weight:bold}' +
'.b.faute{background:#fff;border:2px solid #B4231C;color:#B4231C;font-weight:bold;' +
'  text-decoration:line-through;text-decoration-thickness:2px}' +
'.legende{display:flex;gap:16px;font-size:11px;margin:8px 0 0;font-family:Helvetica,Arial,sans-serif;color:#444}' +
'.legende span{display:flex;align-items:center;gap:5px}' +
'.legende i{width:14px;height:14px;border-radius:50%;display:inline-block}' +
'ol{margin:6px 0 0 18px;font-size:13px}li{margin-bottom:5px}' +
'.mot{border-left:3px solid #111;padding:8px 12px;margin-top:14px;font-style:italic;font-size:13.5px;background:#f7f5f0}' +
'.pied{margin-top:20px;border-top:1px solid #999;padding-top:7px;font-size:10.5px;color:#555;' +
'  display:flex;justify-content:space-between}' +
'@media print{.noimp{display:none}}' +
'.noimp{text-align:center;margin:20px 0}' +
'.noimp button{font:inherit;padding:11px 22px;border:1px solid #111;background:#111;color:#fff;cursor:pointer}' +
'</style></head><body>' +

'<div class="tete">' +
  '<div class="sceau"><i></i><i></i><i></i><i></i></div>' +
  '<div class="marque"><div class="n">MON CONCOURS</div>' +
  '<div class="d">Progresser vers l\'obtention de votre concours</div></div>' +
'</div>' +

'<h1>Feuille de composition</h1>' +
'<div class="ident">' +
  '<div><b>Candidat</b><span>' + E(S.util.nom || 'Candidat') + '</span></div>' +
  '<div><b>Initiales</b><span>' + initiales + '</span></div>' +
  '<div><b>Niveau</b><span>' + E(S.niveau) + '</span></div>' +
  '<div><b>Épreuve</b><span>' + E(S.typeEpreuve || 'Concours direct · épreuve écrite') + '</span></div>' +
  '<div><b>Date</b><span>' + quand + '</span></div>' +
'</div>' +

'<div class="resultat">' +
  '<div class="note"><div class="n">' + note + ' / ' + total + '</div>' +
  '<div class="l">Note obtenue</div>' +
  '<div class="v">' + (admis ? 'Au-dessus du seuil' : 'Sous le seuil') + '</div></div>' +
  '<table class="rec">' +
    '<tr><td>Réussite</td><td>' + pct + ' %</td></tr>' +
    '<tr><td>Bonnes réponses</td><td>' + justes.length + '</td></tr>' +
    '<tr><td>Réponses fausses</td><td>' + rates.length + '</td></tr>' +
    '<tr><td>Questions blanches</td><td>' + blancs.length + '</td></tr>' +
    '<tr><td>Temps utilisé</td><td>' + Math.floor((1500 - S.chrono)/60) + ' min</td></tr>' +
    '<tr><td>Classement national</td><td>' + (S.classement ? nombreFr(S.classement.rang) + 'e' : '—') + '</td></tr>' +
  '</table>' +
'</div>' +

'<h1>Votre feuille corrigée</h1>' +
'<div class="grille">' + grilleHtml + '</div>' +
'<div class="legende">' +
  '<span><i style="background:#0E7A54"></i> Bonne réponse noircie</span>' +
  '<span><i style="border:2px solid #0E7A54"></i> Réponse attendue</span>' +
  '<span><i style="border:2px solid #B4231C"></i> Noirci à tort</span>' +
  '<span><i style="border:1px solid #ccc"></i> Non noirci</span>' +
'</div>' +

'<h1>Recommandations</h1><ol>' + recommandations.map(r => '<li>' + r + '</li>').join('') + '</ol>' +
'<div class="mot">' + encouragement + '</div>' +

'<div class="pied"><span>monconcours.vercel.app · Mon Concours</span>' +
'<span>Document remis le ' + quand + '</span></div>' +

'<div class="noimp"><button onclick="window.print()">Enregistrer en PDF ou imprimer</button></div>' +
'<scr' + 'ipt>setTimeout(function(){window.print();},600);<\/scr' + 'ipt>' +
'</body></html>';

  const f = window.open('', '_blank');
  if(!f){ toast("Autorisez les fenêtres pour télécharger votre feuille."); return; }
  f.document.write(html); f.document.close();
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

/* Rejoue une composition déjà remise pour en réimprimer la feuille. */
async function feuilleArchive(id){
  if(!base){ toast('Connexion nécessaire pour retrouver cette copie.'); return; }
  toast('Préparation de votre feuille…');
  try{
    const { data: reps } = await base.from('composition_reponses')
      .select('question_id, options_choisies, repondu_le')
      .eq('composition_id', id).order('repondu_le');
    const { data: compo } = await base.from('compositions')
      .select('debut_le, score, duree_secondes, sujet_id').eq('id', id).maybeSingle();
    if(!reps || !compo){ toast('Copie introuvable.'); return; }

    const { data: liens } = await base.from('sujet_questions')
      .select('position, question_id').eq('sujet_id', compo.sujet_id).order('position');
    const ids = (liens || []).map(l => l.question_id);
    const { data: opts } = await base.from('question_options')
      .select('question_id, position, est_correcte').in('question_id', ids).order('position');

    const bonnes = {};
    (opts || []).forEach(o => {
      if(!bonnes[o.question_id]) bonnes[o.question_id] = { rang:0, i:0 };
      const e = bonnes[o.question_id];
      if(o.est_correcte) e.i = e.rang;
      e.rang++;
    });
    const parQuestion = {};
    (reps || []).forEach(r => { parQuestion[r.question_id] = (r.options_choisies || []).map(Number); });

    const grille = [], reponses = {};
    (liens || []).forEach((l, i) => {
      grille.push({ i: bonnes[l.question_id] ? bonnes[l.question_id].i : 0 });
      if(parQuestion[l.question_id]) reponses[i] = parQuestion[l.question_id];
    });

    feuilleComposition({
      grille, reponses, note: compo.score || 0,
      duree: compo.duree_secondes || 0, date: new Date(compo.debut_le)
    });
  }catch(e){ toast("Impossible de retrouver cette copie."); }
}

/* Barre de progression : elle avance avec le défilement du cours. */
function suivreLecture(){
  const zone = vue(), barre = document.getElementById('jauge-lecture-barre');
  if(!zone || !barre) return;
  const maj = () => {
    const h = zone.scrollHeight - zone.clientHeight;
    barre.style.width = (h <= 0 ? 100 : Math.min(100, Math.max(0, zone.scrollTop / h * 100))) + '%';
  };
  zone.removeEventListener('scroll', zone._suivi || (()=>{}));
  zone._suivi = maj;
  zone.addEventListener('scroll', maj, { passive:true });
  maj();
}

function ecranLecture(){
  /* U3 — on lit une matière entière d'un seul tenant. Le candidat déroule,
     il ne revient pas en arrière entre chaque chapitre. */
  if(S.matiereOuverte){
    const lot = (S.ressources || []).filter(x => x.matiere === S.matiereOuverte && x.texte);
    if(!lot.length){ S.matiereOuverte = null; return ecranCours(); }
    const commun = lot.every(x => x.commun);
    vue().innerHTML = `
    <div class="pad">
      <div class="jauge-lecture" aria-hidden="true"><i id="jauge-lecture-barre"></i></div>
      <button class="retourhaut" data-go="cours">La bibliothèque</button>
      <div class="eyebrow">${commun ? 'Toutes classes' : S.niveau}</div>
      <h2 class="titre">${E(S.matiereOuverte)}</h2>
      <p class="sous" style="margin:8px 0 0">${lot.length} chapitre${lot.length>1?'s':''} · lecture continue</p>

      <div class="carte" style="margin-top:16px">
        <div class="libelle" style="margin-bottom:8px">Sommaire</div>
        ${lot.map((r,i)=>`<button class="lien" style="display:block;text-align:left;padding:7px 0"
           data-vers="chap-${i}"><span class="num">${i+1}.</span> ${E(r.titre)}</button>`).join('')}
      </div>

      ${lot.map((r,i)=>`
        <div id="chap-${i}" class="chapitre" style="margin-top:26px;scroll-margin-top:14px">
          <div class="eyebrow">Chapitre ${i+1} sur ${lot.length}${r.theme ? ' · ' + E(r.theme) : ''}</div>
          <h3 class="titre" style="font-size:21px;margin:6px 0 0">${E(r.titre)}</h3>
          <div class="carte lecon" style="margin-top:12px">${miseEnPage(r.texte)}</div>
        </div>`).join('')}

      <div class="carte" style="margin-top:26px;text-align:center">
        <div class="libelle" style="margin-bottom:8px">Cours terminé</div>
        <p class="sous" style="margin:0 0 12px">Vous avez lu les ${lot.length} chapitres de ${E(S.matiereOuverte)}. Mettez-les à l'épreuve.</p>
        <button class="cta" data-cible="${E(S.matiereOuverte)}">📝 Faire les QCM de ce cours</button>
        <button class="cta creux" style="margin-top:8px" data-partage="cours">Partager ce cours</button>
      </div>
      <button class="cta creux" style="margin-top:12px" data-go="cours">Retour à la bibliothèque</button>
    </div>`;
    suivreLecture();
    return;
  }

  const r = (S.ressources || []).find(x => x.id === S.ressourceOuverte);
  if(!r) return ecranCours();
  vue().innerHTML = `
  <div class="pad">
    <button class="retourhaut" data-go="cours">La bibliothèque</button>
    <div class="eyebrow">${r.matiere || ''}${r.theme ? ' · ' + r.theme : ''}</div>
    <h2 class="titre">${E(r.titre)}</h2>
    ${r.commun ? `<p class="sous" style="margin:6px 0 0">Ce cours est le même pour la troisième, la terminale et la licence.</p>` : ''}
    <div class="carte lecon" style="margin-top:16px">${miseEnPage(r.texte)}</div>
    ${r.fichier_chemin ? `<button class="cta creux" style="margin-top:14px" data-telecharger="${r.id}">Télécharger le fichier</button>` : ''}
  </div>`;
}

async function chargerRessources(){
  if(!base) return;
  try{
    const niveau = S.niveau.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    /* Un cours sans niveau est commun aux trois classes : il doit apparaitre partout. */
    const { data, error } = await base.from('ressources')
      .select('id, titre, texte, type_ressource, theme, niveau, fichier_chemin, nom_fichier, taille_octets, matieres(nom, ordre, tous_niveaux)')
      .eq('statut','publie')
      .or('niveau.eq.' + niveau + ',niveau.is.null')
      .limit(200);
    if(error) throw error;
    S.ressources = (data || [])
      .map(r => ({ ...r,
        matiere: r.matieres ? r.matieres.nom : 'Autres documents',
        rang:    r.matieres ? (r.matieres.ordre || 99) : 99,
        commun:  !r.niveau }))
      /* ordre stable : matiere du programme, puis theme, puis titre. Jamais la date. */
      .sort((x, y) =>
        x.rang - y.rang
        || (x.theme || '').localeCompare(y.theme || '', 'fr')
        || x.titre.localeCompare(y.titre, 'fr'));
  }catch(e){ S.ressources = []; }
  if(['cours','lecture'].includes(S.ecran)) rendre();
}

async function telechargerRessource(id){
  const r = (S.ressources || []).find(x => x.id === id);
  if(!r || !r.fichier_chemin || !base) return;
  S.erreurCours = '';
  try{
    const { data, error } = await base.storage.from('cours').createSignedUrl(r.fichier_chemin, 3600);
    if(error || !data) throw error || new Error('lien indisponible');
    pister('COURSE_DOWNLOADED', { titre: r.titre });
    window.open(data.signedUrl, '_blank');
  }catch(e){
    S.erreurCours = "Le fichier n'a pas pu être ouvert. Réessaie avec une meilleure connexion.";
    if(S.ecran === 'cours') rendre();
  }
}

function ecranQcm(){
  const banque = QCM[S.matiere] || QCM['Culture générale'];
  const q = banque[S.qcmIdx % banque.length];
  const rep = S.qcmRep, juste = rep===q.i;
  const matiereLue = (S.matiere || 'Révision');
  const total = 250, numero = 18 + S.qcmIdx;
  const motiv = (rep!==undefined && S.qcmSerie>0 && S.qcmSerie%5===0)
    ? MOTIVATIONS[Math.min(3,Math.floor(S.qcmSerie/5)-1)] : null;
  vue().innerHTML = `
  <div class="qcm-tete">
    <span class="q">${E(matiereLue.toUpperCase())} · QUESTION ${numero} / ${total}</span>
    <button class="x" data-go="revisions">✕</button>
  </div>
  <div class="qzone" style="padding-top:12px">
    <div class="progression" style="margin-bottom:18px">
      <i class="on" style="flex:${numero}"></i><i style="flex:${total-numero}"></i></div>
    <div class="qtexte">${E(q.q)}</div>
    ${q.o.map((o,i)=>{
      let c='';
      if(rep!==undefined){ if(i===q.i) c='juste'; else if(i===rep) c='faux'; }
      return `<button class="opt ${c}" ${rep!==undefined?'disabled':''} data-qcm="${i}">
        <span class="lettre">${'ABCD'[i]}</span>${E(o)}</button>`;
    }).join('')}
    ${rep!==undefined?`
      <div class="retour ${juste?'bien':'mal'}">
        <b>${juste?'✅ Bonne réponse':'❌ Réponse incorrecte'}</b>
        ${juste?'':`<div style="margin-bottom:6px">La bonne réponse est : <b style="display:inline;color:var(--vert-texte)">${E(q.o[q.i])}</b></div>`}
        <b style="margin-top:2px">Pourquoi ?</b>${E(q.x)}
      </div>
      ${motiv?`<div class="motiv"><b>${motiv[0]}</b><p>${motiv[1]}</p></div>`:''}
      <button class="cta" style="margin-top:12px" data-qsuiv="1">Question suivante →</button>
    `:`<p class="sous" style="margin-top:12px;font-family:var(--m);font-size:10.5px;letter-spacing:.05em">
        Tu vois la correction dès que tu réponds.</p>`}
  </div>`;
}

/* =====================================================================
   ÉCRAN 3 — SÉANCE (entraînement : correction immédiate)
   ===================================================================== */
function ecranSeance(rep){
  const q = S.seance[S.seanceIdx];
  if(!q){ return ecranSeanceFin(); }
  const juste = rep === q.i;
  vue().innerHTML = `
  <div class="qzone">
    <div class="qmeta">
      <span>SÉANCE DIRIGÉE · ${q.mat.toUpperCase()}</span>
      <span class="num">${S.seanceIdx+1} / ${S.seance.length}</span>
    </div>
    <div class="progression" style="margin-bottom:18px">${S.seance.map((_,i)=>`<i class="${i<=S.seanceIdx?'on':''}"></i>`).join('')}</div>
    <div class="qtexte">${E(q.q)}</div>
    ${q.opts.map((o,i)=>{
      let c='';
      if(rep!==undefined){ if(i===q.i) c='juste'; else if(i===rep) c='faux'; }
      return `<button class="opt ${c}" ${rep!==undefined?'disabled':''} data-rep="${i}">
        <span class="lettre">${'ABCD'[i]}</span>${E(o)}</button>`;
    }).join('')}
    ${rep!==undefined ? `
      <div class="retour ${juste?'bien':'mal'}">
        <b>${juste?'Juste':'Faux — versé au cahier'}</b>${q.note}
      </div>
      <div class="qmeta" style="margin:12px 0 14px"><span>${q.freq}</span><span>${juste?'':'reprise dans 3 jours'}</span></div>
      <button class="cta" data-suivante="1">${S.seanceIdx+1 < S.seance.length ? 'Question suivante' : 'Terminer la séance'}</button>`
    : `<p class="sous" style="margin-top:14px;font-family:var(--m);font-size:10.5px;letter-spacing:.05em">En séance, la correction est immédiate. En Grille, jamais.</p>`}
  </div>`;
}
function ecranSeanceFin(){
  const n = S.seance.length, j = S.seanceJustes;
  vue().innerHTML = `
  <div class="qzone" style="padding-top:34px">
    <div class="eyebrow">Séance terminée</div>
    <h2 class="titre" style="font-size:34px">${j} sur ${n}</h2>
    <p class="sous" style="margin:10px 0 20px">${n-j===0
      ? 'Rien à verser au cahier aujourd\'hui. C\'est rare.'
      : `${n-j} erreur${n-j>1?'s sont entrées':' est entrée'} dans votre cahier avec la bonne réponse. ${n-j>1?'Elles reviendront':'Elle reviendra'} dans trois jours, puis dans une semaine, puis dans trois semaines.`}</p>
    <div class="carte">
      <div class="mat"><div class="nom">Assiduité<em>Jours de composition d'affilée</em></div><div class="val num">24</div></div>
      <div class="mat"><div class="nom">Erreurs ouvertes<em>Se referment après 3 réussites d'affilée</em></div><div class="val num">${ouvertes()}</div></div>
      <div class="mat"><div class="nom">Indice de préparation<em>Seuil recommandé : 90</em></div><div class="val num">${S.score}</div></div>
    </div>
    <button class="cta" data-go="cahier" style="margin-top:16px">Reprendre le cahier<small>Étape 3 · 10 minutes</small></button>
    <button class="cta creux" data-go="aujourdhui" style="margin-top:9px">Revenir à la journée</button>
  </div>`;
}

/* =====================================================================
   ÉCRAN 4 — LA GRILLE
   ===================================================================== */
function ecranGrille(){
  const rep = Object.keys(S.reponses).length;
  const seuil = 32;
  const feuille = S.compoTab === 'feuille';
  vue().innerHTML = `
  <div class="grille">
    <div class="gr-tete">
      <div><div class="t">VOTRE FEUILLE DE COMPOSITION</div>
        <div class="eyebrow" style="color:#B5AC96">${S.concours} · 50 questions</div></div>
      <div style="text-align:right">
        <div class="gr-chrono ${S.chrono<=300?'chaud':''}" id="chrono">${mmss(S.chrono)}</div>
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

    ${(feuille && !S.sujetVu) ? '<div class="appel-note">↑ Les 50 questions sont dans l\'onglet « Le sujet »</div>' : ''}

    <div class="gr-corps ${feuille?'':'avec-scrub'}" id="corps">
      ${feuille ? feuilleOptique() : sujetComposition()}
    </div>

    ${feuille ? '' : `<div class="scrub" id="scrub" aria-hidden="true">
      <div class="rail-s"></div>
      <div class="poignee" id="poignee">⇕<span class="bulle-q" id="bulleQ"></span></div>
    </div>`}

    ${(feuille && S.apercu!==null) ? apercuQuestion() : ''}

    <div class="gr-pied">
      <div class="compteur-copie">
        <span class="cc-v num">${rep}</span><span class="cc-s num">/ 50</span>
        <span class="cc-l">question${rep>1?'s':''} traitée${rep>1?'s':''}</span>
      </div>
      <button class="remettre" data-remettre="1">Remettre la copie</button>
    </div>
  </div>`;
  brancherScrub();
  if(!S.timer && !S.corrige){
    /* Le téléphone affiche, le serveur décide. On se resynchronise à
       l'ouverture puis toutes les minutes : figer l'horloge locale ne
       donne plus une seconde de plus. */
    synchroniserChrono();
    if(S.sync) clearInterval(S.sync);
    S.sync = setInterval(synchroniserChrono, 60000);
    S.timer = setInterval(()=>{
      S.chrono--;
      const c = document.getElementById('chrono');
      if(c){
        c.textContent = mmss(S.chrono);
        if(S.chrono<=300) c.classList.add('chaud');
      }
      if(S.chrono>0 && S.chrono%600===0){
        bip(2); annonceTemps('Il reste ' + (S.chrono/60) + ' minutes');
      }
      if(S.chrono===300){ bip(3); annonceTemps('Plus que 5 minutes'); }
      if(S.chrono<=0){ clearInterval(S.timer); S.timer=null; bip(4); remettre(); }
    },1000);
  }
}

/* --- curseur de navigation rapide --- */
function brancherScrub(){
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
      <span class="num">${qi+1} / 50</span>
      <button data-apercu="${Math.min(49,qi+1)}">suivante →</button>
    </div>
  </div>`;
}

/* --- la feuille optique : 1 à 50, choix multiples --- */
function feuilleOptique(){
  return `
    <div class="feuille">
      <div class="feuille-tete"><span>N° CANDIDAT 04471</span><span>SUJET N° 2026-07</span></div>
      <p class="feuille-consigne">Vous devez obligatoirement répondre sur cette feuille. Noircissez le ou les cercles correspondant aux bonnes réponses. <b>Un cercle noirci ne peut plus être effacé.</b></p>
      <div class="opt-grille">
        ${S.grille.map((g,qi)=>{
          const r = S.reponses[qi] || [];
          return `<div class="ligne-op ${r.length?'faite':''}">
            <button class="n ${S.apercu===qi?'ouvert':''}" data-apercu="${qi}" aria-label="Lire la question ${qi+1}">${qi+1}</button>
            ${g.o.map((o,i)=>{
              const choisi = r.includes(i);
              let c = choisi?'noirci':'';
              if(S.corrige){ c = choisi ? ((i===g.i)?'ok':'ko') : ((i===g.i)?'vraie':''); }
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
  if(S.timer){clearInterval(S.timer);S.timer=null;}
  S.corrige = true; S.taches[1] = true; sauverTaches(); S.sessionCounter++;
  pister('COMPOSITION_SUBMITTED', { traitees: Object.keys(S.reponses).length, restant_s: S.chrono });
  let n = 0;
  S.grille.forEach((g,i)=>{
    const r = S.reponses[i] || [];
    if(r.length===1 && r[0]===g.i) n++;
  });
  S.grilleNote = n;
  pister('COMPOSITION_COMPLETED', { note: n, sur: S.grille.length });
  cloturerComposition();
  S.grille.forEach((g, i) => {
    const r = S.reponses[i];
    if(r === undefined) return;
    noterTentative('composition', g.q, r, r.length === 1 && r[0] === g.i, null, i + 1);
  });
  // les erreurs de la Grille tombent dans le cahier
  S.grille.forEach((g,i)=>{
    const rep = S.reponses[i] || [];
    if(rep.length && !(rep.length===1 && rep[0]===g.i)){
      if(!S.cahier.some(e=>e.q===g.q))
        S.cahier.push({q:g.q, mien:rep.map(k=>g.o[k]).filter(Boolean).join(', ') || 'aucune réponse',
          bon:g.o[g.i], opts:g.o, i:g.i,
          rate:1, suite:0, note:'Ratée en Grille, dans les conditions du concours. C\'est le pire endroit pour se tromper — donc le meilleur pour apprendre.'});
    }
  });
  rendre();
  const corps = document.getElementById('corps');
  if(corps){
    const s = document.createElement('div'); s.className='scan'; corps.appendChild(s);
    setTimeout(()=>{ s.remove(); aller('copie'); }, 1600);
  }
}
function ecranCopie(){
  const n = S.grilleNote, seuil = 32, admis = n >= seuil;
  const pos = Math.min(100, n/50*100);
  vue().innerHTML = `
  <div class="copie">
    <div class="eyebrow">Copie corrigée · ${new Date().toLocaleDateString('fr-FR',{day:'numeric',month:'long'})}</div>
    <h2 class="titre" style="margin-bottom:10px">La machine a lu<br>votre feuille</h2>

    <div class="carte-identite">
      <div class="av">${(function(){
        const m = (S.util.nom||'Candidat').trim().split(/\s+/).filter(Boolean);
        return (m.length>1 ? m[0][0]+m[m.length-1][0] : (m[0]||'C').slice(0,2)).toUpperCase();
      })()}</div>
      <div class="qui">
        <b>${E(S.util.nom || 'Candidat')}</b>
        <span>${E(S.niveau)} · ${S.classement ? nombreFr(S.classement.rang) + 'ᵉ au classement' : 'classement en cours'}</span>
      </div>
      <div class="note-mini"><b class="num">${n}</b><i>/ ${S.grille.length}</i></div>
    </div>

    <div class="cachet-note ${admis?'admis':''}">
      <div class="n num">${n} / 50</div>
      <div class="l">${admis?'au-dessus du seuil':'sous le seuil'}</div>
    </div>

    <div class="barre-seuil">
      <div class="rail"></div>
      <div class="moi" style="width:${pos}%"></div>
      <div class="seuil" style="left:${32/50*100}%"></div>
      <div class="etq" style="left:${32/50*100}%">Seuil du dernier admis</div>
    </div>
    <p class="sous">${admis
      ? `Vous êtes au-dessus du seuil du dernier admis, mais sans marge. Le seuil monte presque chaque année : viser le seuil, c'est viser la place la plus fragile.`
      : `Il vous manque ${seuil-n} bonne${seuil-n>1?'s':''} réponse${seuil-n>1?'s':''} pour atteindre le seuil du dernier admis. C'est un écart de travail, pas un verdict.`}</p>

    <div class="bloc">
      <div class="libelle">Ce que la copie apprend</div>
      <div class="carte">
        <div class="mat"><div class="nom">Questions noircies<em>Sur 50 · les blanches comptent comme fausses</em></div><div class="val num">${Object.keys(S.reponses).length}</div></div>
        <div class="mat"><div class="nom">Temps utilisé<em>Sur 25 minutes accordées</em></div><div class="val num">${mmss(1500-S.chrono)}</div></div>
        <div class="mat"><div class="nom">Erreurs ajoutées à « Mes erreurs »<em>Elles reviendront jusqu'à disparaître</em></div><div class="val num">${Object.keys(S.reponses).length-n}</div></div>
      </div>
    </div>

    <div class="bloc">
      <div class="libelle">Analyse automatique</div>
      <div class="carte">
        <div style="font-size:13px;font-weight:600;margin-bottom:6px">Votre réussite chute après la question 8</div>
        <p class="sous">Sur vos trois dernières Grilles, le taux passe de 82 % au début à 70 % à la fin. Ce n'est pas un problème de connaissance, c'est un problème d'endurance. Les Grilles complètes du dimanche existent pour ça.</p>
      </div>
    </div>

    <button class="cta" data-erreursdusoir="1" style="margin-top:16px">Voir mes erreurs<small>${ouvertes()} en attente, celles d'aujourd'hui d'abord</small></button>
    <button class="cta creux" data-recommencer="meme" style="margin-top:9px">Refaire la composition<small>Le même sujet, pour corriger tes erreurs</small></button>
    <button class="cta creux" data-recommencer="neuve" style="margin-top:9px">Refaire une nouvelle composition<small>Un autre tirage de questions</small></button>
    <button class="cta creux" data-feuille="1" style="margin-top:9px">Télécharger ma feuille corrigée<small>Votre nom, votre note, votre grille en couleur et vos recommandations</small></button>
    <button class="cta discret" data-partage="performance" style="margin-top:9px">Partager mon résultat<small>WhatsApp, Facebook, ou copier le lien</small></button>
  </div>`;
}

/* =====================================================================
   ÉCRAN 5 — MON CAHIER
   ===================================================================== */
let repriseIdx = null, repriseRep = undefined;
function ecranCahier(){
  let list = aReprendre();
  const scoreSession = e => (S.cahierDepuisGrille && e.session===S.sessionCounter) ? 1 : 0;
  list = [...list].sort((a,b)=> (scoreSession(b)-scoreSession(a)) || (joursRestants(a)-joursRestants(b)));
  if(S.cahierFiltre) list = [...list].sort((a,b)=>b.rate-a.rate);
  const closes = S.cahier.filter(e=>e.suite>=3);
  if(repriseIdx !== null){ return ecranReprise(); }
  vue().innerHTML = `
  <div class="pad">
    <div class="eyebrow">Mes erreurs · ce qui reste à corriger</div>
    <h2 class="titre">${ouvertes()} erreur${ouvertes()>1?'s':''}<br>encore ouverte${ouvertes()>1?'s':''}</h2>
    ${S.cahierDepuisGrille && list.some(e=>e.session===S.sessionCounter)?`<div class="carte" style="margin-top:12px;border-color:var(--vert-bord);background:var(--vert-fond)">
      <div style="font-size:12.5px;font-weight:600;margin-bottom:4px">Tes erreurs de cette composition, en premier</div>
      <p class="sous">Elles remontent en tête tant que tu ne les as pas revues.</p></div>`:''}
    ${S.cahierFiltre?`<div class="carte" style="margin-top:12px;border-color:var(--rouge-bord);background:var(--rouge-fond)">
      <div style="font-size:12.5px;font-weight:600;margin-bottom:4px">Erreurs les plus fréquentes d'abord</div>
      <p class="sous">Triées par nombre de rechutes. Ce sont celles qui te coûteront le plus cher le jour du concours.</p>
      <button class="voirplus" style="margin-top:9px" data-toutcahier="1">VOIR TOUT LE CAHIER</button></div>`:''}
    <p class="sous" style="margin-top:8px">Une erreur ne disparaît qu'après trois bonnes réponses d'affilée. Après chaque réussite, elle est reprogrammée : d'abord dans 3 jours, puis dans 7, puis dans 21. <span class="num">${dues()}</span> sont dues aujourd'hui.</p>

    ${list.length ? `
    <div class="bloc">
      <div class="libelle">Toutes mes erreurs<span class="num">${dues()} dues sur ${list.length}</span></div>
      ${list.map(e=>{
        const idx = S.cahier.indexOf(e);
        const j = joursRestants(e);
        return `<div class="err">
          <div class="q">${E(e.q)}</div>
          <div class="ligne">Votre réponse : « ${E(e.mien)} »</div>
          <div class="ligne">Bonne réponse : <b>${E(e.bon)}</b></div>
          <div class="ligne" style="margin-top:6px;color:#7E8C86">${e.note}</div>
          <div class="pied">
            <span class="echeance ${j===0?'du':''}">${j===0?'À REPRENDRE AUJOURD\'HUI':'DANS '+j+' JOUR'+(j>1?'S':'')}</span>
            <span class="acquis">${[0,1,2].map(i=>`<i class="${i<e.suite?'on':''}"></i>`).join('')}</span>
            <button class="reprendre ${j===0?'':'valider'}" data-reprise="${idx}">${j===0?'Reprendre':'Valider'}</button>
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

    <div class="bloc">
      <div class="libelle">Où se concentrent mes erreurs</div>
      <div class="carte">
        <div class="mat"><div class="nom">Dates officielles<em>Une fiche chronologique a été ajoutée</em></div><div class="val num">11</div></div>
        <div class="mat"><div class="nom">Physiologie<em>Chapitre à reprendre entièrement</em></div><div class="val num">8</div></div>
        <div class="mat"><div class="nom">Accords grammaticaux<em>Participe passé avec « avoir »</em></div><div class="val num">6</div></div>
      </div>
    </div>
  </div>`;
}
function ecranReprise(){
  const e = S.cahier[repriseIdx];
  const rep = repriseRep;
  const juste = rep === e.i;
  vue().innerHTML = `
  <div class="qzone">
    <div class="qmeta"><span>REPRISE · CAHIER</span><span>RATÉE ${e.rate} FOIS</span></div>
    <div class="qtexte">${E(e.q)}</div>
    ${e.opts.map((o,i)=>{
      let c='';
      if(rep!==undefined){ if(i===e.i) c='juste'; else if(i===rep) c='faux'; }
      return `<button class="opt ${c}" ${rep!==undefined?'disabled':''} data-rr="${i}"><span class="lettre">${'ABCD'[i]}</span>${E(o)}</button>`;
    }).join('')}
    ${rep!==undefined?`
      <div class="retour ${juste?'bien':'mal'}">
        <b>${juste?(e.suite>=3?'Acquise — elle disparaît de la liste':`Juste · ${e.suite} sur 3 · revient dans ${PALIERS[Math.min(e.suite-1,2)]} jours`):'Encore ratée — le compteur repart à zéro, reprise aujourd\'hui'}</b>${e.note}
      </div>
      <div style="margin:14px 0 12px;display:flex;align-items:center;gap:10px">
        <span class="acquis">${[0,1,2].map(i=>`<i class="${i<e.suite?'on':''}"></i>`).join('')}</span>
        <span class="eyebrow">${e.suite>=3?'refermée':'trois bonnes réponses d\'affilée pour la refermer'}</span>
      </div>
      <button class="cta" data-fin-reprise="1">Continuer</button>`:''}
  </div>`;
}

/* =====================================================================
   ÉCRAN 6 — PARCOURS
   ===================================================================== */
const PALMARES = [];   // se remplira avec les vrais premiers du classement

const RECOMPENSES = [
  {c:'50',   t:'50 questions', d:'Obtenu le 2 juin', on:true},
  {c:'100',  t:'100 questions', d:'Obtenu le 14 juin', on:true},
  {c:'150',  t:'150 questions', d:'Obtenu le 28 juin', on:true},
  {c:'200',  t:'200 questions', d:'Obtenu le 9 juillet', on:true},
  {c:'250',  t:'250 questions', d:'218 sur 250 · encore 32', on:false},
  {c:'×7',   t:'7 jours d\'affilée', d:'Obtenu le 12 juillet', on:true},
  {c:'×30',  t:'30 jours d\'affilée', d:'18 jours · encore 12', on:false},
  {c:'×20',  t:'20 bonnes réponses de suite', d:'Meilleure série : 14', on:false},
  {c:'T300', t:'Top 300 national', d:'Obtenu le 3 juillet', on:true},
  {c:'T200', t:'Top 200 national', d:'Obtenu le 19 juillet', on:true},
  {c:'T100', t:'Top 100 national', d:'127ᵉ · encore 27 places', on:false},
  {c:'T50',  t:'Top 50 national', d:'Atteindre la 50ᵉ place', on:false},
  {c:'T10',  t:'Top 10 · élite', d:'Atteindre la 10ᵉ place', on:false},
  {c:'MAJ',  t:'Major national', d:'Terminer 1ᵉʳ du classement', on:false}
];

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
      <h3>${E(S.util.nom || 'Candidat')}</h3>
      ${S.util.tel?`<span>+226 ${S.util.tel}</span>`:''}
    </div>

    <div class="duo">
      <div class="stat"><div class="v num">${S.stats ? nombreFr(S.stats.questions_resolues) : '—'}</div><div class="l">Questions résolues</div></div>
      <div class="stat"><div class="v num">${S.stats ? S.stats.taux_reussite + ' %' : '—'}</div><div class="l">Taux de réussite</div></div>
    </div>

    <div class="classement">
      <div class="t">${ico('trophee',14)} Classement national</div>
      ${S.classement ? `
      <div class="rangbig">Vous êtes <span class="num">${nombreFr(S.classement.rang)}ᵉ</span></div>
      <div class="pts">sur <span class="num">${nombreFr(S.classement.population)}</span> candidats · <span class="num">${nombreFr(S.classement.points)}</span> point${S.classement.points>1?'s':''}</div>
      <div class="up ${S.classement.places_semaine < 0 ? 'baisse' : ''}">${
        S.classement.places_semaine > 0
          ? '▲ Vous avez gagné ' + S.classement.places_semaine + ' place' + (S.classement.places_semaine>1?'s':'') + ' cette semaine'
          : S.classement.places_semaine < 0
            ? '▼ Vous avez perdu ' + Math.abs(S.classement.places_semaine) + ' place' + (Math.abs(S.classement.places_semaine)>1?'s':'') + ' cette semaine'
            : 'Aucun mouvement cette semaine'}</div>
      <div class="jauge-places">
        <div class="rail"></div>
        <div class="admis" style="width:${(S.classement.places / S.classement.population * 100).toFixed(1)}%"></div>
        <div class="curseur" style="left:${Math.min(100, S.classement.rang / S.classement.population * 100).toFixed(1)}%"></div>
      </div>
      <div class="legende-places"><span>${nombreFr(S.classement.places)} places</span><span>${nombreFr(S.classement.population)}ᵉ</span></div>
      <p class="sous" style="margin-top:9px">${
        S.classement.dans_les_admis
          ? 'Vous êtes dans les places. Tenez la position : le seuil monte chaque année.'
          : 'Il vous manque <b>' + nombreFr(S.classement.places_manquantes) + ' places</b> pour entrer dans les '
            + nombreFr(S.classement.places) + ' admis, soit <b>' + nombreFr(S.classement.points_manquants) + ' points</b>.'}</p>
      <p class="sous" style="font-size:12px">Position estimée parmi les candidats de la dernière session. ${S.classement.points_par_place} points font monter d'une place.</p>`
      : `<div class="squelette large" style="margin-top:6px"></div>
         <div class="squelette"></div>
         <div class="squelette court"></div>
         <span class="sr">Chargement de votre position</span>`}

      <div class="calcul">
        <div class="l">Comment les points se calculent</div>
        <div class="r"><span>Bonne réponse en révision</span><b class="num">+ 5</b></div>
        <div class="r"><span>Bonne réponse en Grille</span><b class="num">+ 15</b></div>
        <div class="r"><span>Erreur refermée dans « Mes erreurs »</span><b class="num">+ 20</b></div>
        <div class="r"><span>Mauvaise réponse</span><b class="num neg">− 3</b></div>
        <div class="r"><span>Journée sans composer</span><b class="num neg">− 10</b></div>
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

    <button class="grande" data-diagnostic="1" aria-expanded="${S.voirDiagnostic}">
      <span class="ic">${ico('diagnostic',19)}</span>
      <span><b>Mes forces et mes faiblesses</b><span>Diagnostic personnel · mis à jour ce matin</span></span>
      <span class="fl">${S.voirDiagnostic?'▲':'▼'}</span>
    </button>
    ${S.voirDiagnostic?`
    <div class="carte reveal" style="margin-top:9px">
      <div class="libelle">Mes forces</div>
      <div class="mat"><div class="nom">Culture générale</div><div class="jauge haut"><i style="width:89%"></i></div><div class="val num">89</div></div>
      <div class="mat"><div class="nom">Institutions</div><div class="jauge haut"><i style="width:81%"></i></div><div class="val num">81</div></div>
      <div class="libelle" style="margin-top:14px">Mes points à renforcer</div>
      <div class="mat"><div class="nom">Géopolitique</div><div class="jauge bas"><i style="width:24%"></i></div><div class="val num">24</div></div>
      <div class="mat"><div class="nom">Droit et économie</div><div class="jauge bas"><i style="width:18%"></i></div><div class="val num">18</div></div>
      <div class="verdict solide" style="margin-top:14px">
        <b>Notre recommandation</b>
        Cette semaine, concentre-toi sur la géopolitique. Dix points de progression dans cette seule matière peuvent te faire gagner plusieurs dizaines de places au classement national.
      </div>
      <button class="cta vert" style="margin-top:12px" data-cible="Géopolitique">
        Générer des QCM sur mes points faibles<small>Questions tirées uniquement de ce que je rate</small></button>
      <p class="sous" style="margin-top:9px;font-size:11.5px">Une matière quitte cette liste dès qu'elle repasse au-dessus de 60 % : elle ne te sera plus reproposée en priorité.</p>
    </div>`:''}

    <div class="bloc">
      <div class="libelle">Défis</div>
      <button class="grande" style="margin-top:0" data-defi="1" aria-expanded="${S.voirDefi}">
        <span class="ic">${ico('examen',19)}</span>
        <span><b>Participer à l'examen</b><span>Le concours national du jour, ou un duel</span></span>
        <span class="fl">${S.voirDefi?'▲':'▼'}</span>
      </button>
      ${S.voirDefi?`
        <div class="reveal">
        <button class="grande" data-go="grille"><span class="ic">${ico('grille',19)}</span>
          <span><b>Concours national</b><span>Tous les candidats composent la même Grille aujourd'hui</span></span>
          <span class="fl">→</span></button>
        <button class="grande" data-duel="1"><span class="ic">${ico('duel',19)}</span>
          <span><b>Lancer un duel</b><span>Adversaire de niveau proche, connecté maintenant</span></span>
          <span class="fl">→</span></button></div>`:''}

      <button class="grande" data-badges="1" aria-expanded="${S.voirBadges}">
        <span class="ic">${ico('trophee',19)}</span>
        <span><b>Mes récompenses</b><span>${RECOMPENSES.filter(r=>r.on).length} obtenues sur ${RECOMPENSES.length}</span></span>
        <span class="fl">${S.voirBadges?'▲':'▼'}</span></button>
      ${S.voirBadges?`
      <div class="reveal">
        <div class="carte" style="margin-top:9px">
          <div class="libelle">Ma collection<span class="num">${RECOMPENSES.filter(r=>r.on).length}/${RECOMPENSES.length}</span></div>
          <div class="collection">
            ${RECOMPENSES.map(r=>`<div class="badge-carte ${r.on?'':'off'}">
              <div class="jeton ${r.on?'gagne':''}">${r.c}</div>
              <div class="bt">${r.t}</div>
              <div class="bd">${r.d}</div>
              ${r.on?'':`<div class="cadena">${ico('cadenas',13)}</div>`}
            </div>`).join('')}
          </div>
        </div>
        ${PALMARES.length ? `<div class="carte" style="margin-top:9px">
          <div class="libelle">Les majors nationaux</div>
          ${PALMARES.map(c=>`<div class="rang"><span class="p num">${c.r}</span>
            <span class="av">${c.n[0]}</span><span class="n">${c.n}<em>${c.v}</em></span>
            <span class="s num">${c.p}</span></div>`).join('')}
        </div>` : ''}
      </div>`:''}
    </div>

    <div class="bloc">
      <div class="libelle">Assiduité</div>
      <div class="carte">
        <div style="display:flex;justify-content:space-between;align-items:flex-end">
          <div><div style="display:flex;align-items:center;gap:8px;color:var(--laterite)">${ico('flamme',20)}
              <span style="font-family:var(--d);font-weight:800;font-size:26px;letter-spacing:-.03em;color:var(--craie)">${S.stats ? S.stats.serie : 0} jour${(S.stats&&S.stats.serie>1)?'s':''}</span></div>
            <div class="eyebrow" style="margin-top:3px">consécutifs</div></div>
          <div style="text-align:right"><div class="num" style="font-size:15px">${S.stats ? S.stats.record : 0}</div>
            <div class="eyebrow">jours au total</div></div>
        </div>
        <div class="libelle" style="margin-top:16px">Série en cours<span class="num">${faites}/7 jours</span></div>
        <div class="semaine">
          ${jours.map((j,k)=>`<div><div class="j">${j}</div>
            <div class="c ${sem[k]?'vert':'rouge'}" title="${sem[k]?'composé':'absent'}">${sem[k]?'✓':'✕'}</div></div>`).join('')}
        </div>
        <p class="sous" style="margin-top:12px;border-left:2px solid var(--or);padding-left:11px">
          À ce rythme, tu es en bonne voie pour dépasser le seuil d'admission.</p>
      </div>
    </div>

    <div class="bloc">
      <div class="libelle">Mon abonnement</div>
      <button class="grande" style="margin-top:0" data-go="abonnement">
        <span class="ic">${ico('carte',19)}</span>
        <span><b>Formule ${S.abo.formule}</b><span>${S.abo.echeance}</span></span>
        <span class="fl">${S.abo.actif?'GÉRER →':'CHANGER →'}</span>
      </button>
      ${S.compositions && S.compositions.length ? `
      <div class="carte" style="margin-top:14px;text-align:left">
        <div class="libelle" style="margin-bottom:8px">Mes compositions</div>
        ${S.compositions.slice(0,8).map(c => `
          <div class="mat"><div class="nom">${new Date(c.debut_le).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'})}
            <em>${c.terminee ? (c.nb_traitees||0) + ' questions traitées' : 'non terminée'}</em></div>
            <div class="val num">${c.terminee && c.score !== null ? c.score + '/' + (c.nb_questions || 50) : '—'}</div>
            ${c.terminee ? `<button class="mini" data-archive="${c.id}">Télécharger</button>` : ''}</div>`).join('')}
        <p class="sous" style="margin-top:10px;font-size:12px">${S.compositions.length} composition${S.compositions.length>1?'s':''} au total.</p>
      </div>` : ''}

      <div class="carte" style="margin-top:14px;text-align:left">
        <div class="libelle" style="margin-bottom:8px">Rester informé</div>
        <p class="sous" style="margin:0 0 12px">Les dates de concours, les nouveaux cours et les annonces passent d'abord par nos canaux.</p>
        <a class="cta creux" style="display:block;text-decoration:none" href="${CONTACT.canal}" target="_blank" rel="noopener">
          Rejoindre la chaîne WhatsApp<small>Annonces et dates de concours</small></a>
        <a class="cta creux" style="display:block;margin-top:8px;text-decoration:none" href="${CONTACT.facebook}" target="_blank" rel="noopener">
          Suivre la page Facebook<small>Le coin du digital</small></a>
        <button class="cta creux" style="margin-top:8px" data-partage="site">
          Partager Mon Concours<small>À un camarade qui prépare aussi</small></button>
      </div>

      <div class="carte" style="margin-top:14px;text-align:left">
        <div class="libelle" style="margin-bottom:8px">Aide et contact</div>
        <p class="sous" style="margin:0 0 12px">Un problème de compte, un paiement qui ne passe pas, une erreur dans un cours : écrivez directement à l'administrateur.</p>
        <a class="cta creux" style="display:block;text-decoration:none"
           href="https://wa.me/226${CONTACT.adminTel}?text=${encodeURIComponent('Bonjour, je vous écris depuis Mon Concours.')}"
           target="_blank" rel="noopener">
          Écrire sur WhatsApp<small>+226 ${CONTACT.adminTel} · urgences et problèmes de compte</small></a>
      </div>

      <div class="carte reglages">
        <button>Notifications<span>ACTIVÉES</span></button>
        <button data-go="apparence">Apparence<span>→</span></button>
        <a href="${CONTACT.canal}" target="_blank" rel="noopener">Chaîne WhatsApp<span>→</span></a>
        <a href="https://wa.me/226${CONTACT.adminTel}" target="_blank" rel="noopener">Aide et contact<span>→</span></a>
        ${S.util.connecte
          ? `<button class="sortie" data-deconnecter="1">Se déconnecter<span>→</span></button>`
          : `<button data-go="connexion">Se connecter<span>→</span></button>`}
      </div>
    </div>
  </div>`;
}

/* =====================================================================
   RENDU + ÉVÉNEMENTS
   ===================================================================== */
const SANS_TETE = ['test','grille','engagement','testIntro'];
function apptete(){
  const t = document.getElementById('apptete');
  if(SANS_TETE.includes(S.ecran)){ t.style.display='none'; return; }
  t.style.display='flex';
  const jr = joursAvantConcours();
  const droite = {aujourdhui: jr === null ? '' : 'J−' + jr, copie:'copie corrigée', cahier:ouvertes()+' en attente',
    compte:S.abo.actif?'formule '+S.abo.formule.toLowerCase():'formule gratuite',
    revisions:S.niveau.toLowerCase(), qcm:S.matiere||'', abonnement:'', paiement:'sécurisé',
    inscription:'', connexion:'', resultat:'étape 3 sur 3', actualite:'ce matin'}[S.ecran] || '';
  t.innerHTML = `${logoSvg(24)}<span class="mot">MON <i>CONCOURS</i></span>
    <span class="droite">${droite}</span>
    <button class="bouton-tete ${MUSIQUE.actif?'actif':''}" data-musique="1"
      aria-pressed="${MUSIQUE.actif}"
      aria-label="${MUSIQUE.actif?'Arrêter la musique':'Mettre une musique douce'}">
      ${ico('musique',17)}<span>${MUSIQUE.actif?'Musique en cours':'Musique'}</span></button>
    <button class="bouton-tete" data-bascule-theme="1" aria-label="${S.theme==='sombre'?'Passer en mode clair':'Passer en mode sombre'}">
      ${S.theme==='sombre'?ico('soleil',17):ico('lune',17)}<span>${S.theme==='sombre'?'Mode clair':'Mode sombre'}</span></button>
    ${S.util.connecte
      ? `<button class="bouton-tete" data-deconnecter="1" aria-label="Se déconnecter">${ico('sortie',17)}<span>Se déconnecter</span></button>`
      : `<button class="bouton-tete" data-modal="inscription" aria-label="Se connecter">${ico('compte',17)}<span>Se connecter</span></button>`}`;
}
function annoncer(){
  const n = {aujourdhui:"Aujourd'hui", actualite:'Actualité du matin', revisions:'Mes révisions',
    qcm:'Question', grille:'Composition', copie:'Copie corrigée', cahier:'Mon cahier', compte:'Mon compte',
    inscription:'Création de compte', connexion:'Connexion', abonnement:'Formules', paiement:'Paiement',
    test:'Test de niveau', resultat:'Résultat'}[S.ecran] || '';
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
  if(!S.modal || (S.util.connecte && S.modal !== 'oubli')){ v.hidden = true; v.innerHTML=''; return; }

  const mode = S.modal;                       // inscription · connexion · oubli
  const titres = { inscription:'Inscription', connexion:'Connexion', oubli:'Code oublié' };
  const intros = {
    inscription:"Crée ton compte pour garder tes erreurs, ton classement et ta progression. C'est gratuit et ça prend trente secondes.",
    connexion:"Entre ton numéro et ton code pour retrouver ta progression.",
    oubli:"Donne ton numéro et la couleur choisie à l'inscription, puis choisis un nouveau code."
  };

  v.hidden = false;
  v.innerHTML = `
  <div class="panneau" role="dialog" aria-modal="true" aria-label="${titres[mode]}">
    <div class="poignee"></div>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">${logoSvg(30)}
      <span style="font-family:var(--d);font-weight:800;font-size:15px">MON <i style="font-style:normal;color:var(--laterite)">CONCOURS</i></span></div>

    <div class="titre-panneau">${titres[mode]}</div>
    <p class="intro">${intros[mode]}</p>

    ${S.erreur?`<div class="alerte" role="alert">${S.erreur}</div>`:''}

    ${mode === 'inscription' ? `
      <div class="champ"><label for="m-nom">Nom et prénom</label>
        <input id="m-nom" type="text" value="${S.form.nom}" placeholder="Kantagba Jean" oninput="maj('nom',this.value)" autocomplete="name"></div>` : ''}

    <div class="champ"><label for="m-tel">Numéro de téléphone</label>
      <div class="prefixe"><span class="ind">+226</span>
        <input id="m-tel" type="tel" inputmode="numeric" maxlength="8" value="${S.form.tel}" placeholder="70 00 00 00" oninput="maj('tel',this.value)" autocomplete="tel"></div></div>

    ${mode === 'oubli' ? `
      <div class="champ"><label for="m-couleur">Ta couleur préférée</label>
        <select id="m-couleur" onchange="maj('couleur',this.value)">
          <option value="">— choisis —</option>
          ${COULEURS.map(c=>`<option value="${c}" ${S.form.couleur===c?'selected':''}>${c}</option>`).join('')}
        </select></div>` : ''}

    <div class="champ"><label for="m-pin">${mode==='oubli'?'Nouveau code à 4 chiffres':'Code secret à 4 chiffres'}</label>
      <div class="avec-oeil">
        <input id="m-pin" type="${S.codeVisible?'text':'password'}" inputmode="numeric" maxlength="4"
          value="${S.form.pin}" placeholder="••••" oninput="maj('pin',this.value)">
        <button class="oeil" data-oeil="1" aria-label="${S.codeVisible?'Masquer le code':'Afficher le code'}">${S.codeVisible?'masquer':'voir'}</button>
      </div></div>

    ${(mode === 'inscription' || mode === 'oubli') ? `
      <div class="champ"><label for="m-pin2">Confirme le code</label>
        <input id="m-pin2" type="${S.codeVisible?'text':'password'}" inputmode="numeric" maxlength="4"
          value="${S.form.pin2||''}" placeholder="••••" oninput="maj('pin2',this.value)"></div>` : ''}

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
  </div>`;
}


function ecranApparence(){
  vue().innerHTML = `
  <div class="pad">
    <button class="retourhaut" data-go="compte">Mon compte</button>
    <h2 class="titre">Apparence</h2>
    <p class="sous" style="margin:8px 0 18px">Même application, deux ambiances. Le choix s'applique tout de suite, partout.</p>

    <button class="theme-carte ${S.theme==='sombre'?'on':''}" data-theme-choix="sombre" aria-pressed="${S.theme==='sombre'}">
      ${S.theme==='sombre'?'<span class="coche">ACTIF</span>':''}
      <div class="demo"><i style="background:#18211E"></i><i style="background:#0F1513"></i><i style="background:#C4552E"></i></div>
      <b>Mode sombre</b><span>L'identité actuelle du site, pensée pour le soir</span>
    </button>
    <button class="theme-carte ${S.theme==='clair'?'on':''}" data-theme-choix="clair" aria-pressed="${S.theme==='clair'}">
      ${S.theme==='clair'?'<span class="coche">ACTIF</span>':''}
      <div class="demo"><i style="background:#F3F0E8"></i><i style="background:#FFFDFA"></i><i style="background:#A8401E"></i></div>
      <b>Mode clair</b><span>Fond crème, cartes claires, texte noir, mêmes couleurs</span>
    </button>
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
    seance:()=>ecranSeance(undefined), grille:ecranGrille, copie:ecranCopie,
    cahier:ecranCahier, compte:ecranCompte}[S.ecran] || ecranAujourdhui);

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
        <h2 class="titre" style="font-size:22px">Cet écran n'a pas pu s'ouvrir</h2>
        <p class="sous" style="margin:10px 0 18px">Le reste de l'application fonctionne. Revenez à l'actualité, ou rechargez.</p>
        <button class="cta" data-go="aujourdhui">Revenir à l'actualité</button>
        <button class="cta creux" style="margin-top:9px" onclick="location.reload()">Recharger</button>
      </div>`;
  }
  try{ nav(); apptete(); annoncer(); surcouche(); }catch(e){ console.error(e); }
}

document.addEventListener('click', ev=>{
  const t = ev.target.closest('[data-matiere],[data-vers],[data-musique],[data-copier],[data-partage-natif],[data-fermer-partage],[data-feuille],[data-archive],[data-partage],[data-oeil],[data-reinitialiser],[data-lire],[data-telecharger],[data-apercu],[data-saut],[data-compotab],[data-bascule-theme],[data-modal],[data-entrer],[data-bascule],[data-plustard],[data-deconnecter],[data-theme-choix],[data-erreursdusoir],[data-cible],[data-cours],[data-inscrire],[data-connecter],[data-oubli],[data-formule],[data-operateur],[data-payer],[data-paiefin],[data-paieannul],[data-go],[data-toutcahier],[data-actu],[data-niv],[data-mat],[data-qcm],[data-qsuiv],[data-cahierfreq],[data-classement],[data-diagnostic],[data-defi],[data-duel],[data-badges],[data-phase],[data-conc],[data-dep],[data-test],[data-tb],[data-tremettre],[data-retest],[data-seance],[data-rep],[data-suivante],[data-b],[data-remettre],[data-recommencer],[data-reprise],[data-rr],[data-fin-reprise]');
  if(!t) return;
  const d = t.dataset;

  try{
    const cle = Object.keys(d)[0] || 'inconnu';
    pister('BUTTON_CLICKED', { valeur: String(d[cle]).slice(0,40) }, cle);
  }catch(e){}

  if(d.go){
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
        ecrireMemoire({ nom:f.nom.trim(), tel:tel, niveau:S.niveau });
        pister('ACCOUNT_CREATED', { niveau: S.niveau });
        S.modal = null; chargerProgression(); aller('aujourdhui');
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
      aller('aujourdhui');
    })();
    return;
  }
  if(d.oubli){ S.erreur = "Un code provisoire a été envoyé par SMS au numéro saisi."; return rendre(); }
  if(d.formule){ S.choixFormule = d.formule; pister('SUBSCRIPTION_PLAN_SELECTED', { formule: d.formule }); return rendre(); }
  if(d.operateur){ S.operateur = d.operateur; return rendre(); }
  if(d.payer){
    const tel = S.paieTel.replace(/\D/g,'');
    if(tel.length !== 8){ S.erreur = "Saisis le numéro mobile money à 8 chiffres."; return rendre(); }
    S.erreur=''; S.paieEtape = 1; return rendre();
  }
  if(d.paiefin){
    /* C5 — un clic du candidat ne vaut pas un paiement. L'abonnement ne
       s'ouvrira que lorsqu'un serveur aura confirmé la transaction. */
    pister('PAYMENT_DECLARED', { formule: S.choixFormule, operateur: S.operateur });
    S.paieEtape = 2;
    return rendre();
  }
  if(d.paieannul){ pister('PAYMENT_ABANDONED', { formule: S.choixFormule }); S.paieEtape = 0; return aller('abonnement'); }
  if(d.erreursdusoir){ pister('ERRORS_OPENED', { depuis: 'composition' });
    S.cahierDepuisGrille = true; S.cahierFiltre=false; return aller('cahier'); }
  if(d.entrer){
    pister('APP_ENTERED', { note_diagnostic: S.testNote });
    aller('aujourdhui');
    if(!S.modalDejaVu && !S.util.connecte){
      clearTimeout(S.minuteur);
      S.minuteur = setTimeout(()=>{ if(!S.util.connecte){ S.modal='inscription'; S.modalDejaVu=true; surcouche(); } }, 6000);
    }
    return;
  }
  if(d.matiere){
    S.matiereOuverte = decodeURIComponent(d.matiere);
    S.ressourceOuverte = null;
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
  if(d.archive){ feuilleArchive(d.archive); return; }
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
          if(!d2.ok){ S.erreur = d2.message || "Impossible de changer le code."; return surcouche(); }
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
  if(d.niv){
    S.niveau = d.niv; S.ressources = null;
    banqueChargee = false; chargerRessources(); chargerQuestions();
    pister('LEVEL_CHANGED', { niveau: d.niv });
    return rendre();
  }
  if(d.lire){ S.ressourceOuverte = d.lire; pister('COURSE_OPENED'); return aller('lecture'); }
  if(d.telecharger){ telechargerRessource(d.telecharger); return; }
  if(d.mat){
    S.matiere = d.mat; S.qcmIdx = (S.qcmPos && S.qcmPos[d.mat]) || 0; S.qcmRep=undefined; S.qcmSerie=0; S.ecran='qcm';
    pister('COURSE_STARTED', { matiere: d.mat, niveau: S.niveau });
    return rendre();
  }
  if(d.qcm !== undefined){
    const b = QCM[S.matiere] || QCM['Culture générale'];
    const q = b[S.qcmIdx % b.length];
    S.qcmRep = +d.qcm; S.qcmSerie++;
    noterTentative('revision', q.q, [+d.qcm], +d.qcm === q.i);
    if(+d.qcm === q.i) ajouterPoints('revision');
    else ajouterPoints('mauvaise_reponse');
    if(+d.qcm===q.i){ S.qcmJustes++; S.score = Math.min(100, S.score); sonJuste(); }
    else {
      sonFaux();
      if(!S.cahier.some(e=>e.q===q.q))
        S.cahier.push({q:q.q, mien:q.o[+d.qcm], bon:q.o[q.i], opts:q.o, i:q.i, rate:1, suite:0, revoirLe:0, session:0, note:q.x});
    }
    return ecranQcm();
  }
  if(d.qsuiv){
    S.qcmIdx++; S.qcmRep=undefined;
    S.qcmPos = Object.assign({}, S.qcmPos, { [S.matiere]: S.qcmIdx });
    ecrireReglage('qcmPos', S.qcmPos);
    return ecranQcm();
  }
  if(d.cahierfreq){ S.cahierFiltre=true; S.taches[2]=true; sauverTaches(); return aller('cahier'); }
  if(d.classement){ S.voirClassement = !S.voirClassement; return rendre(); }
  if(d.diagnostic){ S.voirDiagnostic = !S.voirDiagnostic; return rendre(); }
  if(d.defi){ S.voirDefi = !S.voirDefi; return rendre(); }
  if(d.cours){ return; }
  if(d.duel){ alert('Recherche d\'un adversaire de niveau proche…'); return; }
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
    oublierIdentite();
    const connu = !!(lireMemoire() || {}).dejaVenu;
    S.modalDejaVu = connu;                    // on ne relance pas l'inscription d'un habitué
    return aller(connu ? 'aujourdhui' : 'engagement');
  }
  if(d.cible){ S.matiere = d.cible; S.qcmIdx = (S.qcmPos && S.qcmPos[d.cible]) || 0; S.qcmRep=undefined; S.qcmSerie=0; return aller('qcm'); }
  if(d.phase){ S.phase = +d.phase; return rendre(); }
  if(d.conc !== undefined){ S.concours = CONCOURS[+d.conc][0]; S.phase = 2; return rendre(); }
  if(d.dep !== undefined){ S.semaines = DEPART[+d.dep][2]; S.ecran='testIntro'; return rendre(); }
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
  if(d.retest){
    S.testRep={}; S.testCorrige=false; S.testChrono=120; S.testNote=null;
    S.cahier = S.cahier.filter(e=>!TEST.some(t=>t.q===e.q));
    return aller('test');
  }

  if(d.seance){ S.ecran='seance'; S.seanceIdx=0; S.seanceJustes=0; return rendre(); }

  if(d.rep !== undefined){
    const i = +d.rep, q = S.seance[S.seanceIdx];
    if(i===q.i){ S.seanceJustes++; sonJuste(); } else sonFaux();
    if(i!==q.i && !S.cahier.some(e=>e.q===q.q))
      S.cahier.push({q:q.q, mien:q.opts[i], bon:q.opts[q.i], opts:q.opts, i:q.i, rate:1, suite:0, revoirLe:0, session:0, note:q.note});
    return ecranSeance(i), nav();
  }

  if(d.suivante){
    S.seanceIdx++;
    if(S.seanceIdx >= S.seance.length){ S.etapes[1]=true; return ecranSeanceFin(), nav(); }
    return ecranSeance(undefined);
  }

  if(d.compotab){
    S.compoTab = d.compotab;
    if(d.compotab==='sujet') S.sujetVu = true;
    ecranGrille();
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
    if(!S.compositionId) ouvrirComposition();
    pister('COMPOSITION_ANSWER_SELECTED', { question: q + 1, total: S.grille.length });
    majComposition();
    return ecranGrille();
  }

  if(d.remettre) return remettre();

  if(d.recommencer){
    S.reponses={}; S.corrige=false; S.chrono=1500; S.grilleNote=null; effacerEpreuve();
    S.compoTab='feuille'; S.sujetVu=false; S.apercu=null; S.compositionId=null;
    pister('COMPOSITION_RESTARTED', { type: d.recommencer });
    if(d.recommencer === 'neuve'){
      melangerComposition();
      signalCandidat('Nouveau tirage de questions.');
    }
    return aller('grille');
  }

  if(d.reprise !== undefined){ repriseIdx=+d.reprise; repriseRep=undefined; return rendre(); }

  if(d.rr !== undefined){
    const i = +d.rr, e = S.cahier[repriseIdx];
    repriseRep = i;
    if(i===e.i) sonJuste(); else sonFaux();
    pister('ERROR_REATTEMPTED', { juste: i === e.i });
    noterTentative('erreurs', e.q, [i], i === e.i);
    if(i === e.i && e.suite >= 2) { pister('ERROR_FIXED'); ajouterPoints('erreur_refermee'); }
    programmer(e, i===e.i);
    if(i===e.i && e.suite>=3) S.score = Math.min(100,S.score+1);
    return ecranReprise(), nav();
  }

  if(d.fin_reprise || d.finReprise){
    repriseIdx=null; repriseRep=undefined;
    if(!aReprendre().length) S.etapes[2]=true;
    return rendre();
  }
});

rendre();
