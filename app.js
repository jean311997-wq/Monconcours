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
  abo:{actif:false, formule:null, jours_restants:0, echeance:'formule gratuite'},
  gratuit:true,             // phase de lancement : tout est gratuit (le serveur fait foi)
  theme:'sombre', sessionCounter:0, cahierDepuisGrille:false,
  modal:null, modalDejaVu:false, matiereOuverte:null, sync:null, bloque:false, qcmPos:{}, rechercheCours:'', compositions:[], niveauConnu:false, notifications:[], notifCharge:false, dateConcours:null, nomConcours:null, typeEpreuve:'Concours direct · épreuve écrite',
  choixFormule:'annuelle', operateur:'orange', paieTel:'', paieEtape:0,
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
const DELAI_SORTIE_MS = 5 * 60 * 1000;   // une erreur validée reste visible 5 minutes, comme confirmation

function programmer(e, juste){
  if(juste){
    e.suite++;
    e.revoirLe = aujourdhuiZero() + (PALIERS[Math.min(e.suite-1, PALIERS.length-1)] * JOUR);
    if(e.suite >= 3 && !e.valideLe) e.valideLe = Date.now();   // horodate le moment de la maîtrise
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
  if(S.gratuit && (e === 'abonnement' || e === 'paiement')) e = 'compte';   // pas de formules pendant la phase gratuite
  if(['revisions','qcm'].includes(e)) chargerQuestions();
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
  const app = document.querySelector('.app'); if(app) app.classList.toggle('sans-rail', cache);
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
   o:['la synthèse du glycogène','la dégradation du glycogène','l\'absorption du glucose','la formation de lipides'],i:1,d:'Sciences de la vie'},
  {q:'Hormone qui fait baisser la glycémie',
   o:['Le glucagon','L\'insuline','L\'adrénaline','Le cortisol'],i:1,d:'Sciences de la vie'},
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
      <h2>La suite</h2>
      <p>Tes fautes de ce test sont déjà dans « Mes erreurs ». Commence par elles.</p>
    </div>

    <button class="cta" style="margin-top:18px" data-entrer="1">Entrer dans l'application<small>Actualité · révisions · composition · erreurs</small></button>
    <button class="cta creux" style="margin-top:9px" data-retest="1">Refaire le test</button>
  </div>`;
}

/* =====================================================================
   ÉCRAN 2 — AUJOURD'HUI
   ===================================================================== */


/* =====================================================================
   LES QUESTIONS VIENNENT DE LA BASE
   ===================================================================== */
const niveauBase = () => S.niveau.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');

/* La banque de révision du niveau choisi. Les questions arrivent sans
   leurs corrigés : la correction est donnée par le serveur, question par
   question, après la réponse du candidat. */
let banqueNiveau = null;
async function chargerQuestions(force){
  if(!base) return;
  const niv = niveauBase();
  if(!force && banqueNiveau === niv && S.banque) return;
  banqueNiveau = niv;
  S.banqueEtat = 'chargement';
  try{
    const { data, error } = await base.from('questions')
      .select('id, enonce, niveau, matiere_id, matieres(nom, ordre), question_options(position, texte)')
      .eq('statut', 'publie')
      .or('niveau.eq.' + niv + ',niveau.is.null')
      .order('cree_le')
      .limit(1000);
    if(error) throw error;
    const parMatiere = {};
    (data || []).forEach(q => {
      if(!q.matieres) return;
      const o = (q.question_options || []).slice().sort((a,b) => a.position - b.position);
      if(o.length < 2) return;
      const m = q.matieres.nom;
      (parMatiere[m] = parMatiere[m] || { nom:m, ordre:q.matieres.ordre || 99, questions:[] })
        .questions.push({ id:q.id, q:q.enonce, o:o.map(x => x.texte) });
    });
    S.banque = Object.values(parMatiere).sort((x,y) => x.ordre - y.ordre);
    S.banqueEtat = 'pret';
  }catch(e){
    S.banqueEtat = 'erreur';
  }
  chargerProgressionMatieres();
  if(['revisions','qcm'].includes(S.ecran)) rendre();
}

/* Ce que le candidat a réellement fait, matière par matière. */
async function chargerProgressionMatieres(){
  if(!base) return;
  try{
    const { data } = await base.rpc('ma_progression', { p_niveau: niveauBase() });
    S.progression = {};
    (data || []).forEach(m => { S.progression[m.matiere] = m; });
    if(S.ecran === 'revisions') rendre();
  }catch(e){}
}

const banqueDe = nom => (S.banque || []).find(m => m.nom === nom);

/* =====================================================================
   RELIRE SA PROGRESSION
   ===================================================================== */
async function chargerNotifications(){
  if(!base) return;
  try{
    const uid = await utilisateurCourant();
    if(!uid) return;
    const { data } = await base.rpc('mes_notifications');
    S.notifications = data || [];
    S.notifCharge = true;
    rendre();
  }catch(e){}
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
    if(['compte','abonnement','aujourdhui'].includes(S.ecran)) rendre();
  }catch(e){}
}

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

  S.classementCharge = false;

  base.rpc('mon_classement').then(({data}) => {
    S.classementCharge = true;
    if(data) S.classement = data;
    rafraichirSiVisible();
  }).catch(() => { S.classementCharge = true; });

  base.rpc('mes_stats').then(({data}) => {
    if(data) S.stats = data;
    rafraichirSiVisible();
  }).catch(() => {});

  chargerCahier();

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
        note: e.explication || '', rate: e.rate || 1, suite: e.suite || 0,
        revoirLe: new Date(e.revoir_le + 'T00:00:00').getTime(), session: 0
      };
    });
    S.cahier = serveur.concat(locales.filter(l => !serveur.some(x => x.q === l.q)));
    rafraichirSiVisible();
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
  setTimeout(chargerAbonnement, 600);
  setTimeout(chargerNotifications, 900);
}


/* =====================================================================
   OBSERVATION — collecte des événements
   Rien de personnel : ni saisie, ni mot de passe, ni position.
   ===================================================================== */
const VERSION_APP = 'v14';

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
async function ouvrirComposition(){
  if(ouvertureEnCours) return;
  if(!base){ S.compoEtat = 'erreur'; S.compoMessage = "Pas de connexion au serveur pour l'instant."; return rendre(); }
  ouvertureEnCours = true;
  S.compoEtat = 'chargement'; rendre();
  try{
    const { data, error } = await base.rpc('ouvrir_composition', { p_niveau: niveauBase() });
    if(error) throw error;
    if(!data || !data.ok){
      S.compoEtat = data && data.connexion ? 'connexion' : data && data.abonnement ? 'abonnement' : 'erreur';
      S.compoMessage = (data && data.message) || 'Composition indisponible.';
    } else {
      if(S.compositionId && S.compositionId !== data.id){ S.reponses = {}; effacerEpreuve(); }
      S.compositionId = data.id;
      S.sujetRef = data.sujet || '';
      S.concours = data.concours || 'Concours direct';
      S.seuil = (typeof data.seuil === 'number') ? data.seuil : null;
      S.dureeCompo = data.duree || 1500;
      S.grille.length = 0;
      (data.questions || []).forEach(q => S.grille.push({ id:q.id, q:q.enonce, o:q.options || [], i:null }));
      S.chrono = Math.max(0, data.restant ?? S.dureeCompo);
      S.corrige = false; S.grilleNote = null; S.corrigeServeur = null;
      S.compoEtat = 'pret';
    }
  }catch(e){
    S.compoEtat = 'erreur';
    S.compoMessage = "La composition n'a pas pu être chargée. Vérifiez votre connexion.";
  }
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
      S.corrigeServeur = data.corrige || [];
      S.grille.forEach((g, i) => { const b = S.corrigeServeur[i]; g.bonnes = b || []; g.i = (b && b.length) ? b[0] : null; });
      S.remiseEtat = 'ok';
      S.derniereCompo = S.compositionId;
      S.compositionId = null;
      effacerEpreuve();
      chargerCahier(); chargerProgression(); chargerCompositions();
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
  return `<div class="info ${a.v?'ok':'att'}">
    <div class="info-tete">
      <span class="tampon ${a.v?'t-ok':'t-att'}">${a.v?'✓ Vérifié':'À confirmer'}</span>
      ${neuf?'<span class="tag-neuf">Nouveau</span>':''}
    </div>
    <span class="eyebrow info-source">${E(a.s)}${a.le ? (a.s ? ' · ' : '') + E(dateCourteFr(a.le)) : ''}</span>
    <h2>${E(a.t)}</h2><p>${E(a.x)}</p>
    ${a.p ? `<p class="info-pourquoi"><b>Utile pour</b>${E(a.p)}</p>` : ''}
  </div>`;
}
function blocActuVide(){
  if(S.actuErreur) return `<div class="info att"><p>L'actualité n'a pas pu être chargée. Vérifiez votre connexion, puis revenez sur cette page.</p></div>`;
  if(!S.actuChargee) return `<div class="squelette large"></div><div class="squelette"></div><span class="sr">Chargement de l'actualité</span>`;
  return `<div class="info att"><p>Aucune actualité publiée pour le moment.</p></div>`;
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
    <h1 class="titre">L'actualité utile au concours</h1>
    <div class="ligne-direct">
      ${S.actuDerniere ? `<span class="direct"><i></i>Dernière mise à jour : ${E(dateCourteFr(S.actuDerniere))}</span>` : ''}
      <span class="sous-titre">National et international</span>
    </div>

    <div class="colonnes">
    <div>
    ${enCours?`
    <button class="reprise-compo" data-go="grille">
      <div class="rc-tete">Vous avez une composition en cours</div>
      ${S.sujetRef ? `<div class="rc-sujet">Sujet n° ${E(S.sujetRef)}</div>` : ''}
      <div class="rc-nb"><span class="num">${Object.keys(S.reponses).length}</span> question${Object.keys(S.reponses).length>1?'s':''} noircie${Object.keys(S.reponses).length>1?'s':''}${S.grille.length ? ' sur ' + S.grille.length : ''}</div>
      <div class="rc-cta">▶ Reprendre maintenant</div>
    </button>`:''}

    <div class="bloc">
      <div class="carte">
        ${ACTU.length ? ACTU.slice(0,3).map((a,k)=>carteActu(a,k===0)).join('') : blocActuVide()}
      </div>
      ${ACTU.length > 3 ? `<button class="voirplus" data-go="actualite">VOIR LES ${ACTU.length} INFORMATIONS →</button>` : ''}
    </div>

    </div>
    <div>
    <div class="bloc">
      <div class="libelle">Vos tâches du jour<span class="num">${f}/3</span></div>
      <div class="carte">
        <div class="etape ${S.taches[0]?'fait':'actif'}">
          <div class="puce">${S.taches[0]?'✓':'1'}</div>
          <div><h3>Lire l'actualité</h3>
            <p>Cochée quand tu ouvres la page d'actualité.</p>
            <span class="dur">3 min</span></div>
        </div>
        <div class="etape ${S.taches[1]?'fait':(S.taches[0]?'actif':'')}">
          <div class="puce">${S.taches[1]?'✓':'2'}</div>
          <div><h3>Composer</h3>
            <p>Une épreuve chronométrée sur la feuille de réponses. Cochée à la remise de la copie.</p>
            <span class="dur">25 min</span></div>
        </div>
        <div class="etape ${S.taches[2]?'fait':''}">
          <div class="puce">${S.taches[2]?'✓':'3'}</div>
          <div><h3>Revoir mes erreurs</h3>
            <p>${ouvertes() ? ouvertes() + ' erreur' + (ouvertes()>1?'s':'') + ' ouverte' + (ouvertes()>1?'s':'') + ', les plus ratées en premier.' : 'Aucune erreur ouverte pour l\'instant.'}</p>
            <span class="dur">10 min</span></div>
        </div>
      </div>
      ${!S.taches[0] ? `<button class="cta" data-go="actualite" style="margin-top:12px">Lire l'actualité<small>Tâche 1 sur 3</small></button>`
        : (!S.taches[1] ? `<button class="cta" data-go="grille" style="margin-top:12px">Composer<small>Tâche 2 sur 3</small></button>`
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
    <h1 class="titre">Actualité</h1>
    <p class="sous" style="margin-top:6px">Seules les informations utiles au concours entrent ici : grandes décisions nationales, organisations internationales, dates et chiffres. Un fait divers local n'y a pas sa place.</p>

    <div class="onglets">
      <button class="${S.actuOnglet==='national'?'on':''}" data-actu="national">National</button>
      <button class="${S.actuOnglet==='international'?'on':''}" data-actu="international">International</button>
    </div>

    <div class="bloc" style="margin-top:12px">
      <div class="libelle">${S.actuOnglet==='national'?'Burkina Faso':'Monde et organisations'}<span class="num">${liste.length}</span></div>
      <div class="carte">${liste.length ? liste.map(a => carteActu(a)).join('') : blocActuVide()}</div>
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
    cloche:'<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>'
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
      <input id="f-nom" type="text" value="${E(S.form.nom)}" placeholder="Kantagba Jean" oninput="maj('nom',this.value)" autocomplete="name">
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

    <p class="sous" style="margin-top:18px;font-size:11.5px">En créant ton compte, tu acceptes les conditions d'utilisation. Ton numéro ne sert qu'à ton compte et à ton abonnement.</p>
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
const nomFormule = f => f === 'annuelle' ? 'Formule annuelle' : f === 'essai' ? 'Essai gratuit' : 'Formule mensuelle';
const FORMULES = {
  mensuelle:{n:'Formule 1', prix:'500 FCFA', per:'par mois', reco:false},
  annuelle:{n:'Formule 2', prix:'5 000 FCFA', per:'par an', reco:true}
};
function ecranAbonnement(){
  const abo = S.abo;
  vue().innerHTML = `
  <div class="pad">
    <button class="retourhaut" data-go="compte">Mon compte</button>

    ${abo && abo.actif ? `
    <div class="carte" style="text-align:center;padding:22px 16px">
      <div class="eyebrow">Abonnement actif</div>
      <h1 class="titre" style="font-size:22px;margin:8px 0">${E(nomFormule(abo.formule))}</h1>
      <p class="sous">${abo.jours_restants} jour${abo.jours_restants>1?'s':''} restant${abo.jours_restants>1?'s':''}, jusqu'au ${new Date(abo.fin_le).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})}</p>
    </div>` : `
    <h1 class="titre">Débloquez<br>tout Mon Concours</h1>
    <p class="sous" style="margin:10px 0 18px">Les corrections de révision sans limite (20 par jour en formule gratuite) et les compositions chronométrées, corrigées par le serveur.</p>`}

    ${S.paiementEtat && S.paiementEtat.statut === 'confirme' ? `
    <div class="carte" style="margin:14px 0;text-align:center">
      <div class="eyebrow">Paiement confirmé</div>
      <p class="sous" style="margin:6px 0 10px">${E(S.paiementEtat.message || '')}</p>
      <button class="cta creux" data-recu="${E(S.paiementEtat.id)}">Télécharger mon reçu</button>
    </div>` : ''}
    ${S.paiementEtat && S.paiementEtat.statut === 'refuse' ? `
    <div class="carte" style="margin:14px 0;text-align:center;border-color:var(--rouge-bord);background:var(--rouge-fond)">
      <div class="eyebrow">Paiement non confirmé</div>
      <p class="sous" style="margin:6px 0 0">${E(S.paiementEtat.message || '')}</p>
    </div>` : ''}
    ${S.paieEnAttente ? `
    <div class="carte" style="margin:14px 0;text-align:center">
      <div class="eyebrow">Demande envoyée</div>
      <p class="sous" style="margin:6px 0 0">Votre paiement du ${new Date(S.paieEnAttente.cree_le).toLocaleDateString('fr-FR')} est en cours de vérification : deux heures au plus.</p>
    </div>` : `
    <div class="libelle">Choisissez votre formule</div>
    ${Object.keys(FORMULES).map(k=>{
      const f = FORMULES[k];
      return `<div class="formule ${S.choixFormule===k?'on':''} ${f.reco?'reco':''}">
        ${f.reco?'<span class="ruban">la plus avantageuse</span>':''}
        <div class="haut"><span class="nom">${f.n}</span>
          <span class="prix">${f.prix} <em>${f.per}</em></span></div>
        <button class="mini" style="margin-top:12px" data-formule="${k}">${S.choixFormule===k?'Formule sélectionnée ✓':'Choisir cette formule'}</button>
      </div>`;
    }).join('')}
    <button class="cta" style="margin-top:10px" data-go="paiement">Payer par mobile money<small>${FORMULES[S.choixFormule].prix} · ${FORMULES[S.choixFormule].per}</small></button>`}
  </div>`;
}

function ecranPaiement(){
  const f = FORMULES[S.choixFormule];

  /* Étape 3 : la preuve du paiement, jamais un simple clic. */
  if(S.paieEtape === 3){
    vue().innerHTML = `
    <div class="pad">
      <button class="retourhaut" data-paieretour="1">Retour</button>
      <h1 class="titre">Importez la preuve<br>de votre paiement</h1>
      <p class="sous" style="margin:10px 0 18px">Téléchargez la capture d'écran envoyée par Orange Money confirmant votre transaction de ${f.prix}.</p>

      ${S.erreur ? `<div class="alerte" role="alert">${E(S.erreur)}</div>` : ''}

      ${!S.paievePreuve ? `
      <label class="depot-preuve" for="p-preuve">
        <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></svg>
        <b>Choisir une capture d'écran</b>
        <span>JPEG ou PNG · 5 Mo maximum</span>
      </label>
      <input id="p-preuve" type="file" accept="image/*" style="display:none" onchange="choisirPreuve(this.files[0])">
      ` : `
      <div class="apercu-preuve">
        <img src="${S.paievePreuve.dataUrl}" alt="Aperçu de la preuve de paiement">
      </div>
      <div class="rangee" style="margin-top:12px;gap:9px">
        <button class="cta creux" style="flex:1" data-preuve-modifier="1">Modifier</button>
        <button class="cta" style="flex:1" data-preuve-envoyer="1" ${S.paieEnvoi ? 'disabled' : ''}>${S.paieEnvoi ? 'Envoi…' : 'Envoyer la preuve'}</button>
      </div>
      `}
    </div>`;
    return;
  }

  /* Étape 2 : confirmation, la demande est enregistrée côté serveur. */
  if(S.paieEtape===2){
    vue().innerHTML = `
    <div class="pad" style="padding-top:44px;text-align:center">
      <div class="cachet-note" style="max-width:230px">
        <div class="n" style="font-size:34px">…</div>
        <div class="l">paiement reçu</div>
      </div>
      <h1 class="titre" style="font-size:24px">Votre preuve est en<br>cours de vérification</h1>
      <p class="sous" style="margin:12px 0 6px">La vérification peut prendre jusqu'à deux heures. Votre formule s'ouvrira automatiquement dès la confirmation.</p>
      <div class="carte" style="margin-top:16px;text-align:left">
        <div class="mat"><div class="nom">Numéro déclaré<em>Au +226 ${E(S.paieTel)}</em></div><div class="val">✓</div></div>
        <div class="mat"><div class="nom">Formule demandée<em>${f.n} · ${f.per}</em></div><div class="val num">${f.prix}</div></div>
      </div>
      <button class="cta" style="margin-top:18px" data-go="revisions">Ouvrir mes révisions</button>
      <button class="cta creux" style="margin-top:9px" data-go="compte">Retour à mon compte</button>
    </div>`;
    return;
  }

  /* Étape 1 : le code USSD, le montant est celui de la formule choisie. */
  if(S.paieEtape===1){
    vue().innerHTML = `
    <div class="pad" style="padding-top:60px;text-align:center">
      <div class="attente" role="status" aria-label="Paiement en cours"></div>
      <h1 class="titre" style="font-size:22px">Confirmez sur<br>votre téléphone</h1>
      <p class="sous" style="margin:12px 0 20px">Composez le code ci-dessous pour valider ${f.prix} vers Mon Concours, ou suivez le message Orange Money reçu au +226 ${S.paieTel||'…'}.</p>
      <div class="ussd">
        <div class="eyebrow">code de paiement</div>
        <div class="code">*144*4*6*${f.prix.replace(/\D/g,'')}#</div>
        <p>Une fois la transaction confirmée par Orange Money, importez la preuve à l'étape suivante.</p>
      </div>
      <button class="cta" style="margin-top:18px" data-paiefin="1">J'ai effectué le paiement</button>
      <button class="lien" data-paieannul="1">Annuler</button>
    </div>`;
    return;
  }

  /* Étape 0 : opérateur, numéro, nom du compte. */
  vue().innerHTML = `
  <div class="pad">
    <button class="retourhaut" data-go="abonnement">Formules</button>
    <h1 class="titre">Paiement</h1>
    <p class="sous" style="margin:8px 0 18px">${f.n} · ${f.prix} ${f.per}. Aucun compte bancaire nécessaire.</p>

    ${S.erreur?`<div class="alerte" role="alert">${E(S.erreur)}</div>`:''}

    <div class="libelle">Moyen de paiement</div>
    <button class="operateur on" data-operateur="orange" aria-pressed="true">
      <span class="pastille om">OM</span><span><b>Orange Money</b><span>Disponible · validation par code secret</span></span></button>
    <button class="operateur indispo" disabled aria-disabled="true">
      <span class="pastille mm">MM</span><span><b>Moov Money</b><span>Non disponible pour le moment</span></span></button>
    <button class="operateur indispo" disabled aria-disabled="true">
      <span class="pastille wv">W</span><span><b>Wave</b><span>Non disponible pour le moment</span></span></button>

    <div class="champ" style="margin-top:16px">
      <label for="p-tel">Numéro Orange</label>
      <div class="prefixe"><span class="ind">+226</span>
        <input id="p-tel" type="tel" inputmode="numeric" maxlength="8" value="${E(S.paieTel)}" placeholder="70 00 00 00" oninput="majPaieTel(this.value)">
      </div>
      <div class="aide">Le numéro qui va effectuer la transaction.</div>
    </div>

    <div class="champ" style="margin-top:12px">
      <label for="p-nom">Nom du compte</label>
      <input id="p-nom" type="text" value="${E(S.paieNomCompte)}" placeholder="Nom sur le compte Orange Money" oninput="majPaieNom(this.value)">
      <div class="aide">Le nom associé au numéro qui paie, pour retrouver votre transaction.</div>
    </div>

    <div class="carte" style="margin-top:16px">
      <div class="mat"><div class="nom">${f.n}<em>${f.per}</em></div><div class="val num" style="white-space:nowrap">${f.prix}</div></div>
      <div class="mat"><div class="nom" style="font-weight:600">Total à payer</div><div class="val num" style="color:var(--craie);white-space:nowrap">${f.prix}</div></div>
    </div>

    <button class="cta vert" style="margin-top:16px" data-payer="1">Payer ${f.prix}<small>Sans renouvellement automatique</small></button>
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
const SIGLE = { 'Français':'FR', 'Mathématiques':'MA', 'Sciences de la vie':'SV', 'Sciences physiques':'PC',
  'Histoire':'HI', 'Géographie':'GE', 'Culture générale':'CG', 'Institutions et AES':'IN',
  'Géopolitique':'GP', 'Droit':'DR', 'Économie':'EC' };
const sigle = nom => SIGLE[nom] || (nom || '?').slice(0, 2).toUpperCase();

function ecranRevisions(){
  if(!S.banque && S.banqueEtat !== 'chargement') chargerQuestions();
  const banque = S.banque || [];
  const total = banque.reduce((a, m) => a + m.questions.length, 0);
  const prog = S.progression || {};
  vue().innerHTML = `
  <div class="pad">
    <div class="eyebrow">Mes révisions</div>
    <h1 class="titre">Choisis ton niveau</h1>
    <p class="sous" style="margin:8px 0 16px">Les questions changent selon le niveau du concours visé. Les matières communes (culture générale, institutions, droit, économie) sont proposées à tous les niveaux.</p>

    <div class="niveaux" role="group" aria-label="Niveau">
      ${['Troisième','Terminale','Licence'].map(n=>`<button class="${S.niveau===n?'on':''}" data-niv="${n}" aria-pressed="${S.niveau===n}">${n}</button>`).join('')}
    </div>

    <div class="bandeau-niveau reveal" key="${S.niveau}">
      <div><b>${PROGRAMME[S.niveau]}</b>
        <span>${S.banqueEtat === 'pret' ? `${banque.length} matière${banque.length>1?'s':''} · <span class="num">${total.toLocaleString('fr-FR')}</span> question${total>1?'s':''} à ce niveau` : 'Chargement de la banque…'}</span></div>
      <span class="tampon t-ok">${S.niveau}</span>
    </div>

    ${S.banqueEtat === 'erreur' ? `<div class="carte"><p class="sous">La banque de questions n'a pas pu être chargée. Vérifiez votre connexion et revenez sur cet écran.</p></div>` : ''}
    ${S.banqueEtat === 'pret' && !banque.length ? `<div class="carte"><p class="sous">Aucune question n'est encore publiée pour ce niveau. La banque se remplit au fur et à mesure des validations.</p></div>` : ''}

    <div class="reveal" id="listecours">
    ${banque.map(m=>{
      const p = prog[m.nom], nb = m.questions.length;
      const faites = p ? Math.min(p.faites, nb) : 0;
      const pc = nb ? Math.round(faites / nb * 100) : 0;
      return `<button class="cours" data-mat="${E(m.nom)}">
        <span class="ic">${E(sigle(m.nom))}</span>
        <span class="co"><b>${E(m.nom)}</b>
          <span class="bar"><i style="width:${pc}%"></i></span>
          <span class="pc">${faites} sur ${nb} question${nb>1?'s':''} déjà travaillée${nb>1?'s':''}${p && p.faites ? ' · ' + Math.round(100 * p.reussies / Math.max(1, p.faites)) + ' % de réussite' : ''}</span></span>
        <span class="fl">${faites>0?'CONTINUER':'COMMENCER'} →</span>
      </button>`;
    }).join('')}
    </div>

    ${!S.util.connecte ? `<div class="carte" style="margin-top:12px">
      <p class="sous">${S.gratuit ? "Sans compte, tu peux lire les questions. Pour voir la correction et garder tes erreurs, crée ton compte : c'est gratuit." : "Sans compte, tu peux lire les questions. Pour voir la correction, crée ton compte gratuit : 20 corrections par jour, sans limite avec l'abonnement."}</p>
    </div>` : (!S.abo.actif && !S.gratuit ? `<div class="carte" style="margin-top:12px">
      <p class="sous">Formule gratuite : 20 corrections par jour. L'abonnement les rend illimitées et ouvre les compositions.</p>
    </div>` : '')}

    <button class="cta creux" style="margin-top:12px" data-go="cours">
      Lire ou télécharger les cours<small>Lecture en ligne, ou hors connexion une fois ouverts</small></button>
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
    <h1 class="titre">Les cours</h1>
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

    ${S.erreurCours ? `<div class="carte" style="border-color:var(--rouge-bord);background:var(--rouge-fond)"><p class="sous">${E(S.erreurCours)}</p></div>` : ''}

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
/* Feuille des notifications : la cloche l'ouvre, une par une ou tout
   marquer comme lu. Le badge se vide dès l'ouverture d'une ligne. */
const ICONE_NOTIF = { resultat:'grille', paiement:'carte', nouveau_cours:'revisions', rappel:'cloche', motivation:'cloche', faiblesse:'erreurs', securite:'cadenas' };

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
      ${liste.some(n=>!n.lue) ? `<button class="lien" data-notifs-tout="1">Tout marquer comme lu</button>` : ''}
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
function feuilleComposition(source){
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
'.tete{display:flex;align-items:center;gap:14px;border-bottom:3px double #111;padding-bottom:12px}' +
'.marque .n{font-size:19px;font-weight:bold;letter-spacing:.04em}.marque .d{font-size:11px;color:#555;font-style:italic}' +
'.sceau{width:52px;height:52px;border-radius:13px;background:#EDE4D3;border:1px solid #C9BEA9;display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:7px;flex:0 0 auto}' +
'.sceau i{border-radius:50%;background:#FBFAF7;border:1px solid #C9BEA9}.sceau i:nth-child(2),.sceau i:nth-child(3){background:#1C1C1C;border-color:#1C1C1C}' +
'h1{font-size:15px;letter-spacing:.2em;text-transform:uppercase;margin:16px 0 10px;border-bottom:1px solid #111;padding-bottom:5px;break-after:avoid}' +
'.ident{display:flex;gap:10px;flex-wrap:wrap}.ident div{flex:1 1 120px;border:1px solid #bbb;padding:7px 10px}' +
'.ident b{display:block;font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:#666;font-weight:normal}.ident span{font-size:14px}' +
'.resultat{display:flex;gap:14px;align-items:stretch;margin-top:14px}.note{border:2px solid #111;padding:12px 20px;text-align:center;min-width:150px}' +
'.note .n{font-size:40px;font-weight:bold;line-height:1}.note .l{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#555;margin-top:5px}' +
'.rec{flex:1;border-collapse:collapse;font-size:13px}.rec td{border:1px solid #bbb;padding:5px 9px}.rec td:last-child{text-align:right;font-weight:bold;width:70px}' +
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
'.pied{margin-top:20px;border-top:1px solid #999;padding-top:7px;font-size:10.5px;color:#555;display:flex;justify-content:space-between}' +
'@media print{.noimp{display:none}}.noimp{text-align:center;margin:20px 0}' +
'.noimp button{font:inherit;padding:11px 22px;border:1px solid #111;background:#111;color:#fff;cursor:pointer}' +
'</style></head><body>' +
'<div class="tete"><div class="sceau"><i></i><i></i><i></i><i></i></div>' +
  '<div class="marque"><div class="n">MON CONCOURS</div><div class="d">Préparation aux concours directs du Burkina Faso</div></div></div>' +

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

'<h1>Recommandations</h1><ol class="recos">' + recommandations.map(r => '<li>' + E(r) + '</li>').join('') + '</ol>' +

'<div class="saut-page"></div>' +
'<h1>Le sujet corrigé</h1>' + sujetHtml +

'<h1>Votre feuille de réponses</h1>' +
'<div class="grille">' + grilleHtml + '</div>' +
'<div class="legende">' +
  '<span><i style="background:#0E7A54"></i> Bonne réponse noircie</span>' +
  '<span><i style="border:2px solid #0E7A54"></i> Réponse attendue</span>' +
  '<span><i style="border:2px solid #B4231C"></i> Noirci à tort</span>' +
  '<span><i style="border:1px solid #ccc"></i> Non noirci</span>' +
'</div>' +
'<div class="pied"><span>monconcours.vercel.app · Mon Concours</span><span>Document remis le ' + quand + '</span></div>' +
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
    f.document.body.innerHTML = '<p style="font-family:sans-serif">' + E(e.message || 'Reçu indisponible.') + '</p>';
  }
}

/* Rejoue une composition déjà remise pour en réimprimer la feuille. */
async function feuilleArchive(id){
  if(!base){ toast('Connexion nécessaire pour retrouver cette copie.'); return; }
  toast('Préparation de votre feuille…');
  try{
    const { data, error } = await base.rpc('ma_copie', { p_composition: id });
    if(error || !data || !data.ok) throw new Error('copie');
    const grille = [], reponses = {};
    (data.questions || []).forEach((q, i) => {
      grille.push({ q:q.enonce, o:q.options || [], bonnes:q.bonnes || [] });
      if(q.choisies && q.choisies.length) reponses[i] = q.choisies.map(Number);
    });
    feuilleComposition({ grille, reponses, note:data.note || 0, duree:data.duree || 0,
      date:new Date(data.date), sujet:data.sujet, concours:null, seuil:null });
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
    <div class="eyebrow">${E(r.matiere || '')}${r.theme ? ' · ' + E(r.theme) : ''}</div>
    <h1 class="titre">${E(r.titre)}</h1>
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
    <button class="x" data-go="revisions" aria-label="Fermer">✕</button>
  </div>
  <div class="qzone" style="padding-top:12px">
    <div class="progression" style="margin-bottom:18px">
      <i class="on" style="flex:${idx + 1}"></i><i style="flex:${Math.max(0, total - idx - 1)}"></i></div>
    <div class="qtexte">${E(q.q)}</div>
    ${q.o.map((o,i)=>{
      let cl = '';
      if(c && c.ok){ if((c.bonnes || []).includes(i)) cl = 'juste'; else if(i === rep) cl = 'faux'; }
      else if(i === rep) cl = 'choisi';
      const fige = rep !== undefined;
      return `<button class="opt ${cl}" ${fige?'disabled':''} data-qcm="${i}">
        <span class="lettre">${'ABCD'[i] || '•'}</span>${E(o)}</button>`;
    }).join('')}
    ${rep === undefined ? `<p class="sous" style="margin-top:12px;font-family:var(--m);font-size:10.5px;letter-spacing:.05em">
        ${S.util.connecte ? 'La correction s\'affiche dès que tu réponds.' : 'Crée ton compte gratuit pour voir la correction.'}</p>` : ''}
    ${rep !== undefined && S.qcmAttente ? `<p class="sous" style="margin-top:12px">Correction en cours…</p>` : ''}
    ${c && !c.ok ? `
      <div class="retour mal">
        <b>${c.quota ? 'Corrections du jour épuisées' : c.connexion ? 'Compte nécessaire' : 'Correction indisponible'}</b>${E(c.message || '')}
      </div>
      ${c.quota ? `<button class="cta" style="margin-top:12px" data-go="abonnement">Voir l'abonnement</button>` : ''}
      ${c.connexion ? `<button class="cta" style="margin-top:12px" data-modal="inscription">Créer mon compte gratuit</button>` : ''}
      ${c.reseau ? `<button class="cta" style="margin-top:12px" data-qcm-relancer="1">Réessayer</button>` : ''}
      <button class="cta creux" style="margin-top:9px" data-qsuiv="1">Question suivante →</button>` : ''}
    ${c && c.ok ? `
      <div class="retour ${c.correcte?'bien':'mal'}">
        <b>${c.correcte?'Bonne réponse':'Réponse incorrecte'}</b>
        ${c.correcte?'':`<div style="margin-bottom:6px">La bonne réponse : <strong class="bonne-rep">${E((c.bonnes||[]).map(k => 'ABCD'[k] + '. ' + q.o[k]).join(' + '))}</strong></div>`}
        ${c.explication ? `<b style="margin-top:2px">Pourquoi ?</b>${E(c.explication)}` : ''}
        ${c.correcte ? '' : '<div style="margin-top:6px;font-size:12.5px">Elle entre dans « Mes erreurs ».</div>'}
      </div>
      ${motiv ? `<div class="motiv"><b>${E(motiv)}</b></div>` : ''}
      ${typeof c.quota_restant === 'number' ? `<p class="sous" style="margin-top:8px;font-size:12px">${c.quota_restant} correction${c.quota_restant>1?'s':''} gratuite${c.quota_restant>1?'s':''} restante${c.quota_restant>1?'s':''} aujourd'hui.</p>` : ''}
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
    pister('QUESTION_ANSWERED', { juste: !!r.correcte });
    chargerCahier();
  }
  if(S.ecran === 'qcm') ecranQcm();
}

/* =====================================================================
   ÉCRAN 4 — LA GRILLE
   ===================================================================== */
function ecranCompoAttente(){
  const etat = S.compoEtat;
  const titres = { chargement:'Préparation du sujet…', connexion:'Un compte est nécessaire',
    abonnement:'La composition fait partie de l\'abonnement', erreur:'Composition indisponible' };
  const textes = {
    chargement: 'Le sujet arrive. Le chronomètre ne démarre qu\'une fois la feuille affichée.',
    connexion: 'Crée ton compte gratuit : tu as droit à 7 jours d\'essai avec les compositions comprises.',
    abonnement: 'Chaque composition est un sujet de 50 questions en 25 minutes, sur la feuille à noircir, corrigé par le serveur. Ta période d\'essai est terminée : l\'abonnement l\'ouvre à nouveau.',
    erreur: S.compoMessage || 'Le sujet n\'a pas pu être chargé.'
  };
  vue().innerHTML = `
  <div class="pad" style="padding-top:40px;text-align:center">
    ${logoSvg(44)}
    <h1 class="titre" style="font-size:24px;margin-top:16px">${titres[etat] || titres.erreur}</h1>
    <p class="sous" style="margin:10px 0 18px">${E(textes[etat] || textes.erreur)}</p>
    ${etat === 'connexion' ? `<button class="cta" data-modal="inscription">Créer mon compte</button>
      <button class="lien" data-modal="connexion">J'ai déjà un compte</button>` : ''}
    ${etat === 'abonnement' ? `<button class="cta" data-go="abonnement">Voir les formules</button>` : ''}
    ${etat === 'erreur' ? `<button class="cta" data-compo-relancer="1">Réessayer</button>` : ''}
    ${etat !== 'chargement' ? `<button class="cta creux" style="margin-top:9px" data-go="revisions">Réviser en attendant</button>` : ''}
  </div>`;
}

function ecranGrille(){
  if(S.compoEtat !== 'pret' || !S.grille.length){
    if(S.compoEtat !== 'chargement' && S.compoEtat !== 'abonnement' && S.compoEtat !== 'connexion') ouvrirComposition();
    return ecranCompoAttente();
  }
  const rep = Object.keys(S.reponses).length;
  const nbQ = S.grille.length;
  const feuille = S.compoTab === 'feuille';
  vue().innerHTML = `
  <div class="grille">
    <div class="gr-tete">
      <div><h1 class="t">Votre feuille de composition</h1>
        <div class="eyebrow" style="color:#B5AC96">Entraînement type ${E(S.concours)} · ${nbQ} questions</div></div>
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

    ${(feuille && !S.sujetVu) ? `<div class="appel-note">↑ Les ${nbQ} questions sont dans l'onglet « Le sujet »</div>` : ''}

    <div class="gr-corps ${feuille?'':'avec-scrub pile'}" id="corps">
      ${feuille ? feuilleOptique() : sujetComposition()}
    </div>

    ${feuille ? '' : `<button class="geste-feuille" data-compotab="feuille" aria-label="Aller à la feuille de réponses">
      <span class="fleche" aria-hidden="true">←</span><span>Glisser vers la feuille pour cocher</span></button>`}

    ${feuille ? '' : `<div class="scrub" id="scrub" aria-hidden="true">
      <div class="rail-s"></div>
      <div class="poignee" id="poignee">⇕<span class="bulle-q" id="bulleQ"></span></div>
    </div>`}

    ${(feuille && S.apercu!==null) ? apercuQuestion() : ''}

    <div class="gr-pied">
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
      <button class="cta creux" style="margin-top:9px" data-go="aujourdhui">Revenir à l'accueil</button></div>`;
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

    <div class="bloc">
      <div class="libelle">Ce que dit la copie</div>
      <div class="carte">
        <div class="mat"><div class="nom">Questions noircies<em>Sur ${total} · les blanches ne rapportent rien</em></div><div class="val num">${Object.keys(S.reponses).length}</div></div>
        <div class="mat"><div class="nom">Temps utilisé<em>Sur ${Math.round((S.dureeCompo || 1500)/60)} minutes accordées</em></div><div class="val num">${mmss(Math.max(0, utilise))}</div></div>
        <div class="mat"><div class="nom">Fautes ajoutées à « Mes erreurs »<em>Elles reviennent jusqu'à être acquises</em></div><div class="val num">${fausses.length}</div></div>
        ${blancs.length ? `<div class="mat"><div class="nom">Questions laissées blanches</div><div class="val num">${blancs.length}</div></div>` : ''}
      </div>
    </div>

    ${analyse ? `<div class="bloc">
      <div class="libelle">À retenir de cette copie</div>
      <div class="carte">
        <div style="font-size:13px;font-weight:600;margin-bottom:6px">${E(analyse.titre)}</div>
        <p class="sous">${E(analyse.texte)}</p>
      </div>
    </div>` : ''}

    <button class="cta" data-feuille="1" style="margin-top:16px">Télécharger ma feuille corrigée<small>Analyse, recommandations, puis le sujet complet corrigé</small></button>
    ${fausses.length ? `<button class="cta creux" data-erreursdusoir="1" style="margin-top:9px">Reprendre mes fautes maintenant<small>${fausses.length} question${fausses.length>1?'s':''} dans « Mes erreurs »</small></button>` : ''}
    <button class="cta creux" data-recommencer="neuve" style="margin-top:9px">Nouvelle composition<small>Le sujet que vous avez le moins composé</small></button>
    <button class="cta discret" data-partage="performance" style="margin-top:9px">${ico("partage",15)} Partager<small>WhatsApp, Facebook, ou copier le lien</small></button>
  </div>`;
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
  const closes = S.cahier.filter(e=>e.suite>=3);
  if(repriseIdx !== null){ return ecranReprise(); }
  vue().innerHTML = `
  <div class="pad">
    <div class="eyebrow">Mes erreurs · ce qui reste à corriger</div>
    <h1 class="titre">${ouvertes()} erreur${ouvertes()>1?'s':''}<br>encore ouverte${ouvertes()>1?'s':''}</h1>
    ${S.cahierDepuisGrille && list.some(e=>e.session===S.sessionCounter)?`<div class="carte" style="margin-top:12px;border-color:var(--vert-bord);background:var(--vert-fond)">
      <div style="font-size:12.5px;font-weight:600;margin-bottom:4px">Tes erreurs de cette composition, en premier</div>
      <p class="sous">Elles remontent en tête tant que tu ne les as pas revues.</p></div>`:''}
    ${S.cahierFiltre?`<div class="carte" style="margin-top:12px;border-color:var(--rouge-bord);background:var(--rouge-fond)">
      <div style="font-size:12.5px;font-weight:600;margin-bottom:4px">Erreurs les plus fréquentes d'abord</div>
      <p class="sous">Triées par nombre de rechutes. Ce sont celles qui te coûteront le plus cher le jour du concours.</p>
      <button class="voirplus" style="margin-top:9px" data-toutcahier="1">VOIR TOUT LE CAHIER</button></div>`:''}
    <p class="sous" style="margin-top:8px">Une erreur ne disparaît qu'après trois bonnes réponses d'affilée. Après chaque réussite, elle est reprogrammée : d'abord dans 3 jours, puis dans 7, puis dans 21. ${dues() > 1 ? `<span class="num">${dues()}</span> sont à revoir aujourd'hui.` : dues() === 1 ? `Une est à revoir aujourd'hui.` : `Aucune n'est à revoir aujourd'hui.`}</p>

    ${list.length ? `
    <div class="bloc">
      ${repartitionErreurs(list)}
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
    palier('×7', '7 jours d\'affilée', serie, 7, 'jours'),
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

    <div class="classement">
      <div class="t">${ico('trophee',14)} Position estimée</div>
      ${S.classement ? `
      <div class="rangbig">Estimation : <span class="num">${nombreFr(S.classement.rang)}ᵉ</span></div>
      <div class="pts">sur <span class="num">${nombreFr(S.classement.population)}</span> candidats · <span class="num">${nombreFr(S.classement.points)}</span> point${S.classement.points>1?'s':''}</div>
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
          ? 'Vous êtes dans les places. Tenez la position : le seuil monte chaque année.'
          : 'Il vous manque <b>' + nombreFr(S.classement.places_manquantes) + ' places</b> pour entrer dans les '
            + nombreFr(S.classement.places) + ' admis, soit <b>' + nombreFr(S.classement.points_manquants) + ' points</b>.'}</p>
      <p class="sous" style="font-size:12px">Ce n'est pas un classement entre les candidats de Mon Concours : c'est une estimation de votre place parmi les candidats d'une session, calculée à partir de vos points. ${S.classement.points_par_place} points font gagner une place.</p>`
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

    <button class="grande" data-diagnostic="1" aria-expanded="${S.voirDiagnostic}">
      <span class="ic">${ico('diagnostic',19)}</span>
      <span><b>Mes forces et mes faiblesses</b><span>Calculé sur toutes vos réponses</span></span>
      <span class="fl">${S.voirDiagnostic?'▲':'▼'}</span>
    </button>
    ${S.voirDiagnostic ? (function(){
      const pm = ((S.stats && S.stats.par_matiere) || []).filter(x => x.traitees >= 5)
        .map(x => ({ ...x, taux: Number(x.taux) || 0 })).sort((a,b) => b.taux - a.taux);
      if(!pm.length) return `<div class="carte reveal" style="margin-top:9px"><p class="sous">Il faut au moins 5 réponses dans une matière pour en mesurer le niveau. Révisez quelques questions, puis revenez ici.</p></div>`;
      const forces = pm.filter(x => x.taux >= 60), faibles = pm.filter(x => x.taux < 60).reverse();
      const ligne = (x, cl) => `<div class="mat"><div class="nom">${E(x.matiere)}<em>${x.traitees} réponses</em></div><div class="jauge ${cl}"><i style="width:${x.taux}%"></i></div><div class="val num">${x.taux}</div></div>`;
      return `<div class="carte reveal" style="margin-top:9px">
        ${forces.length ? `<div class="libelle">Mes forces</div>${forces.map(x => ligne(x,'haut')).join('')}` : ''}
        ${faibles.length ? `<div class="libelle" style="margin-top:14px">À renforcer</div>${faibles.map(x => ligne(x,'bas')).join('')}
        <div class="verdict solide" style="margin-top:14px"><b>Prochaine séance</b>Commencez par ${E(faibles[0].matiere.toLowerCase())} : ${faibles[0].taux} % de bonnes réponses sur ${faibles[0].traitees}.</div>
        <button class="cta vert" style="margin-top:12px" data-cible="${E(faibles[0].matiere)}">Réviser ${E(faibles[0].matiere)}</button>` : ''}
        <p class="sous" style="margin-top:9px;font-size:11.5px">Une matière passe dans les forces à partir de 60 % de bonnes réponses.</p>
      </div>`;
    })() : ''}

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

      <div class="carte" style="margin-top:14px;text-align:left">
        <div class="libelle" style="margin-bottom:10px">Aide et contact</div>
        <a class="lien-reseau wa"
           href="https://wa.me/226${CONTACT.adminTel}?text=${encodeURIComponent("Bonjour, j'ai besoin d'aide concernant Mon Concours.")}"
           target="_blank" rel="noopener">
          ${logoReseau('whatsapp')}
          <span><b>Écrivez-nous sur WhatsApp en cas de difficulté</b><i>Réponse dans la journée</i></span></a>
      </div>

      <div class="carte reglages">
        <button data-go="apparence">Apparence<span>→</span></button>
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
const SANS_TETE = ['test','grille','engagement','testIntro','resultat'];
function apptete(){
  const t = document.getElementById('apptete');
  if(SANS_TETE.includes(S.ecran)){ t.style.display='none'; return; }
  t.style.display='flex';
  const jr = joursAvantConcours();
  const droite = {aujourdhui: jr === null ? '' : 'J−' + jr, copie:'copie corrigée', cahier:ouvertes()+' en attente',
    compte:S.gratuit ? '' : S.abo.actif?nomFormule(S.abo.formule).toLowerCase():'formule gratuite',
    revisions:S.niveau.toLowerCase(), qcm:S.matiere||'', abonnement:'', paiement:'sécurisé',
    inscription:'', connexion:'', resultat:'étape 3 sur 3', actualite:'ce matin'}[S.ecran] || '';
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
        <input id="m-nom" type="text" value="${E(S.form.nom)}" placeholder="Kantagba Jean" oninput="maj('nom',this.value)" autocomplete="name"></div>` : ''}

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
    <button class="retourhaut" data-go="compte">Mon compte</button>
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
        <h1 class="titre" style="font-size:22px">Cet écran n'a pas pu s'ouvrir</h1>
        <p class="sous" style="margin:10px 0 18px">Le reste de l'application fonctionne. Revenez à l'actualité, ou rechargez.</p>
        <button class="cta" data-go="aujourdhui">Revenir à l'actualité</button>
        <button class="cta creux" style="margin-top:9px" onclick="location.reload()">Recharger</button>
      </div>`;
  }
  try{ nav(); apptete(); annoncer(); surcouche(); }catch(e){ console.error(e); }
}

document.addEventListener('click', ev=>{
  const t = ev.target.closest('[data-matiere],[data-vers],[data-musique],[data-notifs],[data-notifs-tout],[data-notif-lire],[data-copier],[data-partage-natif],[data-fermer-partage],[data-paieretour],[data-preuve-modifier],[data-preuve-envoyer],[data-feuille],[data-archive],[data-partage],[data-oeil],[data-reinitialiser],[data-lire],[data-telecharger],[data-apercu],[data-saut],[data-compotab],[data-bascule-theme],[data-modal],[data-entrer],[data-bascule],[data-plustard],[data-deconnecter],[data-theme-choix],[data-erreursdusoir],[data-cible],[data-cours],[data-inscrire],[data-connecter],[data-oubli],[data-formule],[data-operateur],[data-payer],[data-paiefin],[data-paieannul],[data-go],[data-toutcahier],[data-actu],[data-niv],[data-mat],[data-qcm],[data-qsuiv],[data-cahierfreq],[data-classement],[data-diagnostic],[data-defi],[data-duel],[data-badges],[data-phase],[data-conc],[data-dep],[data-test],[data-tb],[data-tremettre],[data-retest],[data-seance],[data-rep],[data-suivante],[data-b],[data-remettre],[data-recommencer],[data-reprise],[data-rr],[data-fin-reprise],[data-qcm-relancer],[data-compo-relancer],[data-remise-relancer],[data-recu]');
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
  if(d.oubli){ S.modal = 'oubli'; S.erreur = ''; return surcouche(); }
  if(d.recu){ telechargerRecu(d.recu); return; }
  if(d.qcmRelancer){ const r = S.qcmRep; S.qcmRep = undefined; return repondreQcm(r); }
  if(d.compoRelancer){ S.compoEtat = null; return ouvrirComposition(); }
  if(d.remiseRelancer){ S.remiseEtat = 'envoi'; rendre(); return cloturerComposition(); }
  if(d.formule){ S.choixFormule = d.formule; pister('SUBSCRIPTION_PLAN_SELECTED', { formule: d.formule }); return rendre(); }
  if(d.operateur){ S.operateur = d.operateur; return rendre(); }
  if(d.payer){
    const tel = S.paieTel.replace(/\D/g,'');
    if(tel.length !== 8){ S.erreur = "Saisissez le numéro Orange Money à 8 chiffres."; return rendre(); }
    if(!S.paieNomCompte || S.paieNomCompte.trim().length < 2){ S.erreur = "Indiquez le nom du compte qui effectue le paiement."; return rendre(); }
    S.erreur=''; S.operateur = 'orange'; S.paieEtape = 1; return rendre();
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
          p_formule: S.choixFormule, p_operateur: 'orange', p_telephone: S.paieTel,
          p_nom_compte: S.paieNomCompte, p_preuve_chemin: chemin
        });
        if(error) throw error;
        if(!data || !data.ok){ S.erreur = (data && data.message) || 'Envoi impossible.'; S.paieEnvoi = false; return rendre(); }

        pister('PAYMENT_PROOF_SENT', { formule: S.choixFormule });
        S.paieEnAttente = { cree_le: new Date().toISOString() };
        S.paieEnvoi = false; S.paieEtape = 2;
        rendre();
      }catch(e){
        S.erreur = (e && e.message) || "Envoi impossible. Vérifiez votre connexion.";
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
  if(d.notifs){ ouvrirNotifications(); return; }
  if(d.notifsTout){ marquerNotifsLues(null); return; }
  if(d.notifLire){ marquerNotifsLues(d.notifLire); return; }
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
  if(d.niv){
    S.niveau = d.niv; S.ressources = null; S.banque = null; S.progression = null;
    chargerRessources(); chargerQuestions(true);
    pister('LEVEL_CHANGED', { niveau: d.niv });
    return rendre();
  }
  if(d.lire){ S.ressourceOuverte = d.lire; pister('COURSE_OPENED'); return aller('lecture'); }
  if(d.telecharger){ telechargerRessource(d.telecharger); return; }
  if(d.mat){
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
    oublierIdentite();
    const connu = !!(lireMemoire() || {}).dejaVenu;
    S.modalDejaVu = connu;                    // on ne relance pas l'inscription d'un habitué
    return aller(connu ? 'aujourdhui' : 'engagement');
  }
  if(d.cible){
    /* les cours portent parfois un nom de matière différent de la banque */
    const nom = banqueDe(d.cible) ? d.cible : ((S.banque || []).find(m => m.nom.toLowerCase().startsWith(d.cible.toLowerCase().slice(0,5))) || {}).nom || d.cible;
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
  if(d.retest){
    S.testRep={}; S.testCorrige=false; S.testChrono=120; S.testNote=null;
    S.cahier = S.cahier.filter(e=>!TEST.some(t=>t.q===e.q));
    return aller('test');
  }

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
    return ecranGrille();
  }

  if(d.remettre) return remettre();

  if(d.recommencer){
    S.reponses={}; S.corrige=false; S.grilleNote=null; S.corrigeServeur=null; effacerEpreuve();
    S.compoTab='feuille'; S.sujetVu=false; S.apercu=null; S.compositionId=null; S.remiseEtat=null;
    S.grille.length = 0; S.compoEtat = null;
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

rendre();
