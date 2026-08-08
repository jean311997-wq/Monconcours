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
  form:{nom:'', tel:'', pin:''}, erreur:'',
  abo:{actif:true, formule:'Semaine gratuite', echeance:'encore 7 jours'},
  theme:'sombre', sessionCounter:0, cahierDepuisGrille:false,
  modal:null, modalDejaVu:false,
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
  compositionId:null, reponses:{}, sujetVu:false, apercu:null, corrige:false, chrono:1500, timer:null, compoTab:'feuille',
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
function annonceTemps(txt){
  const z = document.getElementById('sonnerie');
  if(!z) return;
  z.textContent = txt; z.classList.add('vu');
  clearTimeout(z._t);
  z._t = setTimeout(()=>z.classList.remove('vu'), 4000);
}
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

function aller(e){
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
    return `<button class="${on}" data-go="${o.id}"${on?' aria-current="page"':''}>${p}<span class="g">${ico(o.g,19)}</span>${o.l}</button>`;
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
          <div class="en"><div class="no">${String(qi+1).padStart(2,'0')}</div><div class="tx">${g.q}</div></div>
          <div class="reponses">
            ${g.o.map((o,i)=>{
              const choisi = r.includes(i);
              let c = choisi?'noirci':'', l='';
              if(S.testCorrige){
                c = choisi ? ((i===g.i)?'ok':'ko') : ((i===g.i)?'vraie':'');
                if(i===g.i) l = 'juste-rep';
              }
              return `<button class="rep ${l}" data-tb="${qi}-${i}" ${choisi&&!S.testCorrige?'disabled':''}
                aria-label="Question ${qi+1}, réponse ${'ABCD'[i]} : ${o}" aria-pressed="${choisi}">
                <span class="bulle ${c}">${'ABCD'[i]}</span><span class="lib">${o}</span></button>`;
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

async function chargerQuestions(){
  if(!base) return;
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

    /* --- la banque de révisions --- */
    const { data: qs } = await base.from('questions')
      .select('enonce, explication, matieres(nom), question_options(position, texte, est_correcte)')
      .eq('statut', 'publie').eq('source', 'cours').limit(500);

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
   LES COMPTES CANDIDATS
   ===================================================================== */
const adresseTechnique = tel => tel + '@candidat.monconcours.bf';
const motDePasse = (tel, pin) => tel + '#' + pin;

async function creerCompte(nom, tel, pin){
  if(!base) return { erreur: "Pas de connexion au serveur pour l'instant." };
  const { data, error } = await base.auth.signUp({
    email: adresseTechnique(tel),
    password: motDePasse(tel, pin),
    options: { data: { nom, telephone: tel, niveau: S.niveau.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'') } }
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
  if(!data || !data.session) return;
  const uid = data.session.user.id;
  const { data: profil } = await base.from('profils')
    .select('nom, telephone, niveau').eq('id', uid).maybeSingle();
  if(profil){
    S.util = { nom: profil.nom, tel: profil.telephone || '', pin: '', connecte: true };
    S.modalDejaVu = true;
    if(S.ecran === 'compte' || S.ecran === 'aujourdhui') rendre();
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
try{
  if(typeof supabase !== 'undefined' && supabase.createClient){
    base = supabase.createClient(BASE_URL, BASE_CLE, { auth: { persistSession: false } });
  }
}catch(e){ base = null; }


/* =====================================================================
   OBSERVATION — collecte des événements
   Rien de personnel n'est enregistré : ni saisie, ni mot de passe,
   ni position. Seulement ce qui est fait, où, et quand.
   ===================================================================== */
const VERSION_APP = 'v8-analytics';

const O = {
  session: null,
  precedent: null,
  dernierTemps: Date.now(),
  entreeEcran: Date.now(),
  file: [],
  actif: true,
  dureeActive: 0,
  nbEcrans: 0,
  nbActions: 0,
  demarree: false
};

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

function identifiant(){
  try{ if(crypto && crypto.randomUUID) return crypto.randomUUID(); }catch(e){}
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random()*16|0, v = c === 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
}

async function ouvrirSessionObservation(){
  if(!base || O.demarree) return;
  O.demarree = true;
  O.session = identifiant();
  try{
    await base.from('sessions').insert({
      id: O.session,
      appareil: appareil(), navigateur: navigateur(), systeme: systeme(),
      version_app: VERSION_APP, langue: navigator.language,
      largeur: window.innerWidth, premiere_visite: !document.referrer,
      source: document.referrer ? 'lien' : 'direct'
    });
  }catch(e){ /* l'application continue sans observation */ }
  pister(document.referrer ? 'USER_RETURNED' : 'USER_FIRST_VISIT');
  pister('SESSION_STARTED');
}

/* dépôt d'un événement — jamais bloquant */
function pister(nom, meta, element){
  if(!base) return;
  const maintenant = Date.now();
  const delta = maintenant - O.dernierTemps;
  O.dernierTemps = maintenant;
  O.nbActions++;

  O.file.push({
    cree_le: new Date(maintenant).toISOString(),
    session_id: O.session, nom: nom, ecran: S.ecran,
    element: element || (meta && meta.element) || null,
    meta: meta || null, precedent: O.precedent, delta_ms: Math.min(delta, 3600000),
    version_app: VERSION_APP
  });
  O.precedent = nom;
  if(O.file.length >= 8) viderFile();
}

async function viderFile(){
  if(!base || !O.file.length) return;
  const lot = O.file.splice(0, O.file.length);
  try{
    const { data } = await base.auth.getSession();
    const uid = data && data.session ? data.session.user.id : null;
    if(uid && !O.rattachee){
      O.rattachee = true;
      base.from('sessions').update({ user_id: uid }).eq('id', O.session);
    }
    await base.from('evenements').insert(lot.map(e => ({ ...e, user_id: uid, session_id: O.session })));
  }catch(e){ /* on abandonne ce lot plutôt que de gêner le candidat */ }
}

/* fermeture propre */
function fermerSession(){
  pister('SESSION_ENDED', { duree_active_s: Math.round(O.dureeActive/1000) });
  if(base && O.session){
    try{
      const charge = JSON.stringify({ evenements: O.file, session: O.session });
      navigator.sendBeacon && navigator.sendBeacon('data:,' + encodeURIComponent(charge));
    }catch(e){}
    base.from('sessions').update({
      fin_le: new Date().toISOString(),
      duree_active_s: Math.round(O.dureeActive/1000),
      nb_ecrans: O.nbEcrans, nb_actions: O.nbActions
    }).eq('id', O.session);
  }
  viderFile();
}

/* activité réelle : un onglet ouvert ne veut pas dire qu'on lit */
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

/* erreurs techniques */
window.addEventListener('error', e => {
  pister('ERROR_OCCURRED', { message: String(e.message).slice(0,200), fichier: 'app' });
});

/* profondeur de défilement */
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

/* une réponse à une question, quel que soit l'endroit */
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
      }, { onConflict: 'user_id,question_id', ignoreDuplicates: false });
    }
    if(uid) await marquerAssiduite();
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

/* composition : ouverture, avancement, remise */
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

async function cloturerComposition(note){
  if(!base || !S.compositionId) return;
  try{
    await base.from('compositions').update({
      fin_le: new Date().toISOString(), terminee: true, score: note,
      nb_traitees: Object.keys(S.reponses).length,
      duree_secondes: 1500 - S.chrono
    }).eq('id', S.compositionId);
    await ajouterPoints('composition', S.compositionId);
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
      <span class="eyebrow">Samedi 25 juillet</span>
      <span class="pastille-j"><b class="num">J−320</b> avant les concours 2027</span>
    </div>
    <h2 class="titre">Actualité du matin</h2>
    <div class="ligne-direct">
      <span class="direct"><i></i>Mis à jour ce matin</span>
      <span class="sous-titre">National et international · 3 min</span>
    </div>

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

  </div>`;
}

function ecranActualite(){
  S.taches[0] = true;
  pister('NEWS_LIST_VIEWED', { onglet: S.actuOnglet });
  const liste = ACTU.filter(a=>a.c===S.actuOnglet);
  vue().innerHTML = `
  <div class="pad">
    <button class="retourhaut" data-go="aujourdhui">← Aujourd'hui</button>
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

function logoSvg(t){
  return `<svg class="logo" width="${t}" height="${t}" viewBox="0 0 34 34" aria-hidden="true">
    <rect x="1" y="1" width="32" height="32" rx="9" fill="var(--laterite)"/>
    <circle cx="11" cy="11" r="4.1" fill="#0F1513"/>
    <circle cx="23" cy="11" r="4.1" fill="none" stroke="#0F1513" stroke-width="1.7"/>
    <circle cx="11" cy="23" r="4.1" fill="none" stroke="#0F1513" stroke-width="1.7"/>
    <circle cx="23" cy="23" r="4.1" fill="#0F1513"/></svg>`;
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
    <button class="retourhaut" data-go="compte">← Mon compte</button>
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
      <div class="cachet-note admis" style="max-width:230px">
        <div class="n" style="font-size:34px">✓</div>
        <div class="l">paiement confirmé</div>
      </div>
      <h2 class="titre" style="font-size:24px">Formule ${f.n}<br>activée</h2>
      <p class="sous" style="margin:12px 0 6px">Tout est débloqué : les huit matières, le cahier complet, le classement et les duels. Prochain prélèvement le 25 août.</p>
      <div class="carte" style="margin-top:16px;text-align:left">
        <div class="mat"><div class="nom">Reçu envoyé par SMS<em>Au +226 ${S.paieTel}</em></div><div class="val">✓</div></div>
        <div class="mat"><div class="nom">Formule<em>${f.n} · ${f.per}</em></div><div class="val num">${f.prix}</div></div>
      </div>
      <button class="cta" style="margin-top:18px" data-go="revisions">Ouvrir mes révisions</button>
      <button class="cta creux" style="margin-top:9px" data-go="compte">Retour à mon compte</button>
    </div>`;
    return;
  }
  vue().innerHTML = `
  <div class="pad">
    <button class="retourhaut" data-go="abonnement">← Formules</button>
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
function ecranCours(){
  vue().innerHTML = `
  <div class="pad">
    <button class="retourhaut" data-go="revisions">← Mes révisions</button>
    <h2 class="titre">Les cours</h2>
    <p class="sous" style="margin:8px 0 16px">Un fascicule par matière, au programme ${S.niveau.toLowerCase()}. À lire en ligne, ou à télécharger une fois pour travailler sans connexion.</p>

    <div class="niveaux" role="group" aria-label="Niveau">
      ${['Troisième','Terminale','Licence'].map(n=>`<button class="${S.niveau===n?'on':''}" data-niv="${n}" aria-pressed="${S.niveau===n}">${n}</button>`).join('')}
    </div>

    ${MATIERES.map((m,k)=>{
      const bloque = false;
      const pages = 28 + k*7 + (S.niveau==='Licence'?22:S.niveau==='Terminale'?11:0);
      return `<div class="fascicule ${bloque?'verrou':''}">
        <div class="ligne1"><span class="ic">${m.e}</span>
          <div class="co"><b>${m.n}</b><span>${pages} pages · ${(pages*0.04).toFixed(1)} Mo · mis à jour en juillet</span></div>
          ${bloque?`<span class="cad">${ico('cadenas',17)}</span>`:''}</div>
        ${bloque?`<button class="mini bloquee" data-go="abonnement">${ico('cadenas',15)} Débloquer avec la formule Candidat</button>`
        :`<div class="paire">
            <button class="mini" data-cours="lire-${k}">${ico('lire',15)} Lire en ligne</button>
            <button class="mini" data-cours="tel-${k}">${ico('telecharger',15)} Télécharger</button>
          </div>`}
      </div>`;
    }).join('')}

    <div class="carte" style="margin-top:12px">
      <p class="sous">Les fascicules téléchargés restent lisibles sans connexion. C'est fait pour composer et réviser loin d'un bon réseau.</p>
    </div>
  </div>`;
}

function ecranQcm(){
  const banque = QCM[S.matiere] || QCM['Culture générale'];
  const q = banque[S.qcmIdx % banque.length];
  const rep = S.qcmRep, juste = rep===q.i;
  const total = 250, numero = 18 + S.qcmIdx;
  const motiv = (rep!==undefined && S.qcmSerie>0 && S.qcmSerie%5===0)
    ? MOTIVATIONS[Math.min(3,Math.floor(S.qcmSerie/5)-1)] : null;
  vue().innerHTML = `
  <div class="qcm-tete">
    <span class="q">${S.matiere.toUpperCase()} · QUESTION ${numero} / ${total}</span>
    <button class="x" data-go="revisions">✕</button>
  </div>
  <div class="qzone" style="padding-top:12px">
    <div class="progression" style="margin-bottom:18px">
      <i class="on" style="flex:${numero}"></i><i style="flex:${total-numero}"></i></div>
    <div class="qtexte">${q.q}</div>
    ${q.o.map((o,i)=>{
      let c='';
      if(rep!==undefined){ if(i===q.i) c='juste'; else if(i===rep) c='faux'; }
      return `<button class="opt ${c}" ${rep!==undefined?'disabled':''} data-qcm="${i}">
        <span class="lettre">${'ABCD'[i]}</span>${o}</button>`;
    }).join('')}
    ${rep!==undefined?`
      <div class="retour ${juste?'bien':'mal'}">
        <b>${juste?'✅ Bonne réponse':'❌ Réponse incorrecte'}</b>
        ${juste?'':`<div style="margin-bottom:6px">La bonne réponse est : <b style="display:inline;color:var(--vert-texte)">${q.o[q.i]}</b></div>`}
        <b style="margin-top:2px">Pourquoi ?</b>${q.x}
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
    <div class="qtexte">${q.q}</div>
    ${q.opts.map((o,i)=>{
      let c='';
      if(rep!==undefined){ if(i===q.i) c='juste'; else if(i===rep) c='faux'; }
      return `<button class="opt ${c}" ${rep!==undefined?'disabled':''} data-rep="${i}">
        <span class="lettre">${'ABCD'[i]}</span>${o}</button>`;
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
        <div class="sq-tx">${g.q}</div>
        <div class="props">
          ${g.o.map((o,i)=>`<div class="prop"><b>${'abcd'[i]}</b><span>${o}</span></div>`).join('')}
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
    <div class="ap-tx">${g.q}</div>
    <div class="ap-props">
      ${g.o.map((o,i)=>`<span class="${r.includes(i)?'pris':''}"><b>${'abcd'[i]})</b> ${o}</span>`).join('')}
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
  S.corrige = true; S.taches[1] = true; S.sessionCounter++;
  pister('COMPOSITION_SUBMITTED', { traitees: Object.keys(S.reponses).length, restant_s: S.chrono });
  let n = 0;
  S.grille.forEach((g,i)=>{
    const r = S.reponses[i] || [];
    if(r.length===1 && r[0]===g.i) n++;
  });
  S.grilleNote = n;
  pister('COMPOSITION_COMPLETED', { note: n, sur: S.grille.length });
  cloturerComposition(n);
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
        S.cahier.push({q:g.q, mien:g.o[S.reponses[i]], bon:g.o[g.i], opts:g.o, i:g.i,
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
    <div class="eyebrow">Copie corrigée · 25 juillet</div>
    <h2 class="titre" style="margin-bottom:16px">La machine a lu<br>votre feuille</h2>

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
    <button class="cta creux" data-recommencer="1" style="margin-top:9px">Recomposer la Grille</button>
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
          <div class="q">${e.q}</div>
          <div class="ligne">Votre réponse : « ${e.mien} »</div>
          <div class="ligne">Bonne réponse : <b>${e.bon}</b></div>
          <div class="ligne" style="margin-top:6px;color:#7E8C86">${e.note}</div>
          <div class="pied">
            <span class="echeance ${j===0?'du':''}">${j===0?'À REPRENDRE AUJOURD\'HUI':'DANS '+j+' JOUR'+(j>1?'S':'')}</span>
            <span class="acquis">${[0,1,2].map(i=>`<i class="${i<e.suite?'on':''}"></i>`).join('')}</span>
            <button class="reprendre" data-reprise="${idx}">${j===0?'Reprendre':'Anticiper'}</button>
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
        <div class="q" style="font-size:13px">${e.q}</div>
        <div class="ligne"><b>${e.bon}</b> · trois bonnes réponses d'affilée</div>
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
    <div class="qtexte">${e.q}</div>
    ${e.opts.map((o,i)=>{
      let c='';
      if(rep!==undefined){ if(i===e.i) c='juste'; else if(i===rep) c='faux'; }
      return `<button class="opt ${c}" ${rep!==undefined?'disabled':''} data-rr="${i}"><span class="lettre">${'ABCD'[i]}</span>${o}</button>`;
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
const PALMARES = [
  {r:1, n:'Boureima Ouédraogo', v:'Ouagadougou', p:'31 420'},
  {r:2, n:'Salamata Kaboré', v:'Bobo-Dioulasso', p:'29 880'},
  {r:3, n:'Issouf Traoré', v:'Saaba', p:'28 145'}
];
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
  const initiales = (S.util.nom||'Candidat').split(' ').filter(Boolean).slice(0,2).map(m=>m[0].toUpperCase()).join('');
  const sem = [1,1,1,0,1,1,1];
  const jours = ['L','M','M','J','V','S','D'];
  const faites = sem.filter(Boolean).length;
  vue().innerHTML = `
  <div class="pad">
    <div class="profil">
      <div class="av">${initiales}</div>
      <h3>${S.util.nom || 'Candidat'}</h3>
      ${S.util.tel?`<span>+226 ${S.util.tel}</span>`:''}
    </div>

    <div class="duo">
      <div class="stat"><div class="v num">1 847</div><div class="l">Questions résolues</div></div>
      <div class="stat"><div class="v num">75 %</div><div class="l">Taux de réussite</div></div>
    </div>

    <div class="classement">
      <div class="t">${ico('trophee',14)} Classement national</div>
      <div class="rangbig">Vous êtes <span class="num">127ᵉ</span></div>
      <div class="pts">sur <span class="num">4 812</span> candidats classés · <span class="num">18 420</span> points</div>
      <div class="up">▲ Vous avez avancé de 12 places cette semaine</div>

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
        ${PALMARES.map(c=>`<div class="rang"><span class="p num">${c.r}</span>
          <span class="av">${c.n[0]}</span>
          <span class="n">${c.n}<em>${c.v}</em></span><span class="s num">${c.p}</span></div>`).join('')}
        <div class="coupure">⋯ 123 candidats ⋯</div>
        <div class="rang"><span class="p num">126</span><span class="av">A</span>
          <span class="n">Adama Sawadogo<em>Koudougou</em></span><span class="s num">18 470</span></div>
        <div class="rang moi"><span class="p num">127</span><span class="av">${initiales[0]||'C'}</span>
          <span class="n">Vous<em>50 points du 126ᵉ</em></span><span class="s num">18 420</span></div>
        <div class="rang"><span class="p num">128</span><span class="av">F</span>
          <span class="n">Fatimata Zerbo<em>Komsilga</em></span><span class="s num">18 390</span></div>
        <div class="coupure">⋯ 4 683 candidats ⋯</div>
        <div class="rang"><span class="p num">4812</span><span class="av">D</span>
          <span class="n">Dernier classé<em>a composé une seule fois</em></span><span class="s num">140</span></div>
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
        <div class="carte" style="margin-top:9px">
          <div class="libelle">Les majors nationaux</div>
          ${PALMARES.map(c=>`<div class="rang"><span class="p num">${c.r}</span>
            <span class="av">${c.n[0]}</span><span class="n">${c.n}<em>${c.v}</em></span>
            <span class="s num">${c.p}</span></div>`).join('')}
        </div>
      </div>`:''}
    </div>

    <div class="bloc">
      <div class="libelle">Assiduité</div>
      <div class="carte">
        <div style="display:flex;justify-content:space-between;align-items:flex-end">
          <div><div style="display:flex;align-items:center;gap:8px;color:var(--laterite)">${ico('flamme',20)}
              <span style="font-family:var(--d);font-weight:800;font-size:26px;letter-spacing:-.03em;color:var(--craie)">18 jours</span></div>
            <div class="eyebrow" style="margin-top:3px">consécutifs</div></div>
          <div style="text-align:right"><div class="num" style="font-size:15px">41</div>
            <div class="eyebrow">record</div></div>
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
      <div class="carte reglages">
        <button>Notifications<span>ACTIVÉES</span></button>
        <button>Paramètres<span>→</span></button>
        <button>Aide et contact<span>→</span></button>
        <button>Conditions d'utilisation<span>→</span></button>
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
const SANS_TETE = ['test','grille','engagement','testIntro'];
function apptete(){
  const t = document.getElementById('apptete');
  if(SANS_TETE.includes(S.ecran)){ t.style.display='none'; return; }
  t.style.display='flex';
  const droite = {aujourdhui:'J−320', copie:'copie corrigée', cahier:ouvertes()+' en attente',
    compte:S.abo.actif?'formule '+S.abo.formule.toLowerCase():'formule gratuite',
    revisions:S.niveau.toLowerCase(), qcm:S.matiere||'', abonnement:'', paiement:'sécurisé',
    inscription:'', connexion:'', resultat:'étape 3 sur 3', actualite:'ce matin'}[S.ecran] || '';
  t.innerHTML = `${logoSvg(24)}<span class="mot">MON <i>CONCOURS</i></span>
    <span class="droite">${droite}</span>
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
  rendre();
  clearTimeout(S.tTheme);
  S.tTheme = setTimeout(()=>document.body.classList.remove('en-transition'), 480);
}

/* --- surcouche d'inscription différée --- */
function surcouche(){
  const v = document.getElementById('voile');
  if(!S.modal){ v.hidden = true; v.innerHTML=''; return; }
  const inscription = S.modal === 'inscription';
  v.hidden = false;
  v.innerHTML = `
  <div class="panneau" role="dialog" aria-modal="true" aria-label="${inscription?'Créer un compte':'Se connecter'}">
    <div class="poignee"></div>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">${logoSvg(30)}
      <span style="font-family:var(--d);font-weight:800;font-size:15px">MON <i style="font-style:normal;color:var(--laterite)">CONCOURS</i></span></div>
    <h3>${inscription?'Garde ton résultat':'Content de te revoir'}</h3>
    <p class="intro">${inscription
      ? 'Crée ton compte pour retrouver tes erreurs, ton classement et ta série sur n\'importe quel téléphone.'
      : 'Ton compte te rend ta progression exactement là où tu l\'avais laissée.'}</p>

    ${S.erreur?`<div class="alerte" role="alert">${S.erreur}</div>`:''}

    ${inscription?`
    <div class="champ"><label for="m-nom">Nom et prénom</label>
      <input id="m-nom" type="text" value="${S.form.nom}" placeholder="Kantagba Jean" oninput="maj('nom',this.value)" autocomplete="name"></div>`:''}
    <div class="champ"><label for="m-tel">Numéro de téléphone</label>
      <div class="prefixe"><span class="ind">+226</span>
        <input id="m-tel" type="tel" inputmode="numeric" maxlength="8" value="${S.form.tel}" placeholder="70 00 00 00" oninput="maj('tel',this.value)" autocomplete="tel"></div></div>
    <div class="champ"><label for="m-pin">Code secret à 4 chiffres</label>
      <input id="m-pin" type="password" inputmode="numeric" maxlength="4" value="${S.form.pin}" placeholder="••••" oninput="maj('pin',this.value)"></div>

    <button class="cta" data-${inscription?'inscrire':'connecter'}="1">${inscription?'Créer mon compte':'Me connecter'}<small>Semaine gratuite · aucune carte bancaire</small></button>
    <button class="lien" data-bascule="${inscription?'connexion':'inscription'}">${inscription?"J'ai déjà un compte":'Créer un compte'}</button>
    <button class="plustard" data-plustard="1">Plus tard</button>
  </div>`;
}
function ecranApparence(){
  vue().innerHTML = `
  <div class="pad">
    <button class="retourhaut" data-go="compte">← Mon compte</button>
    <h2 class="titre">Apparence</h2>
    <p class="sous" style="margin:8px 0 18px">Même application, deux ambiances. Le choix s'applique tout de suite, partout.</p>

    <button class="theme-carte ${S.theme==='sombre'?'on':''}" data-theme-choix="sombre" aria-pressed="${S.theme==='sombre'}">
      ${S.theme==='sombre'?'<span class="coche">ACTIF</span>':''}
      <div class="demo"><i style="background:#18211E"></i><i style="background:#0F1513"></i><i style="background:#C4552E"></i></div>
      <b>Mode sombre</b><span>L'identité actuelle du site, pensée pour le soir</span>
    </button>
    <button class="theme-carte ${S.theme==='clair'?'on':''}" data-theme-choix="clair" aria-pressed="${S.theme==='clair'}">
      ${S.theme==='clair'?'<span class="coche">ACTIF</span>':''}
      <div class="demo"><i style="background:#F7F1E2"></i><i style="background:#FFFFFF"></i><i style="background:#C4552E"></i></div>
      <b>Mode clair</b><span>Fond crème, cartes blanches, texte noir, mêmes couleurs</span>
    </button>
  </div>`;
}
function rendre(){
  appliquerTheme();
  if(typeof pister === 'function' && S.ecran !== O.dernierEcran){
    const passe = Date.now() - O.entreeEcran;
    if(O.dernierEcran) pister('SCREEN_LEFT', { ecran: O.dernierEcran, duree_ms: passe });
    O.dernierEcran = S.ecran; O.entreeEcran = Date.now(); O.nbEcrans++;
    profondeurVue = 0;
    pister('SCREEN_VIEWED');
  }
  ({engagement:ecranEngagement, testIntro:ecranTestIntro, test:ecranTest, resultat:ecranResultat,
    inscription:ecranInscription, connexion:ecranConnexion,
    abonnement:ecranAbonnement, paiement:ecranPaiement,
    apparence:ecranApparence,
    aujourdhui:ecranAujourdhui, actualite:ecranActualite,
    revisions:ecranRevisions, cours:ecranCours, qcm:ecranQcm,
    seance:()=>ecranSeance(undefined), grille:ecranGrille, copie:ecranCopie,
    cahier:ecranCahier, compte:ecranCompte}[S.ecran] || ecranAujourdhui)();
  nav(); apptete(); annoncer(); surcouche();
}

document.addEventListener('click', ev=>{
  const t = ev.target.closest('[data-apercu],[data-saut],[data-compotab],[data-bascule-theme],[data-modal],[data-entrer],[data-bascule],[data-plustard],[data-deconnecter],[data-theme-choix],[data-erreursdusoir],[data-cible],[data-cours],[data-inscrire],[data-connecter],[data-oubli],[data-formule],[data-operateur],[data-payer],[data-paiefin],[data-paieannul],[data-go],[data-toutcahier],[data-actu],[data-niv],[data-mat],[data-qcm],[data-qsuiv],[data-cahierfreq],[data-classement],[data-diagnostic],[data-defi],[data-duel],[data-badges],[data-phase],[data-conc],[data-dep],[data-test],[data-tb],[data-tremettre],[data-retest],[data-seance],[data-rep],[data-suivante],[data-b],[data-remettre],[data-recommencer],[data-reprise],[data-rr],[data-fin-reprise]');
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
    if(f.nom.trim().length < 3) S.erreur = "Écris ton nom et ton prénom.";
    else if(tel.length !== 8) S.erreur = "Le numéro doit comporter 8 chiffres.";
    else if(pin.length !== 4) S.erreur = "Le code secret doit comporter 4 chiffres.";
    else {
      S.erreur = 'Création du compte…'; surcouche();
      creerCompte(f.nom.trim(), tel, pin).then(r => {
        if(r.erreur){ S.erreur = r.erreur; return surcouche(); }
        S.erreur = ''; S.util = {nom:f.nom.trim(), tel:tel, pin:'', connecte:true};
        pister('ACCOUNT_CREATED', { niveau: S.niveau });
        S.modal = null; aller('aujourdhui');
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
    ouvrirSession(tel, pin).then(async r => {
      if(r.erreur){ S.erreur = r.erreur; return surcouche(); }
      S.erreur = ''; S.util = { nom:'Candidat', tel:tel, pin:'', connecte:true };
      S.modal = null;
      await reprendreSession();
      aller('aujourdhui');
    });
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
    pister('PAYMENT_SUCCESS', { formule: S.choixFormule, operateur: S.operateur });
    S.paieEtape = 2;
    S.abo = {actif:true, formule:FORMULES[S.choixFormule].n, echeance:'25 août'};
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
  if(d.bascule){ S.modal = d.bascule; S.erreur=''; return surcouche(); }
  if(d.plustard){ S.modal = null; S.erreur=''; return surcouche(); }
  if(d.toutcahier){ S.cahierFiltre=false; S.cahierDepuisGrille=false; return rendre(); }
  if(d.actu){ S.actuOnglet = d.actu; return rendre(); }
  if(d.niv){ S.niveau = d.niv; return rendre(); }
  if(d.mat){
    S.matiere = d.mat; S.qcmIdx=0; S.qcmRep=undefined; S.qcmSerie=0; S.ecran='qcm';
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
  if(d.qsuiv){ S.qcmIdx++; S.qcmRep=undefined; return ecranQcm(); }
  if(d.cahierfreq){ S.cahierFiltre=true; S.taches[2]=true; return aller('cahier'); }
  if(d.classement){ S.voirClassement = !S.voirClassement; return rendre(); }
  if(d.diagnostic){ S.voirDiagnostic = !S.voirDiagnostic; return rendre(); }
  if(d.defi){ S.voirDefi = !S.voirDefi; return rendre(); }
  if(d.cours){ return; }
  if(d.duel){ alert('Recherche d\'un adversaire de niveau proche…'); return; }
  if(d.badges){ S.voirBadges = !S.voirBadges; return rendre(); }
  if(d.themeChoix){
    if(d.themeChoix===S.theme) return;
    document.body.classList.add('en-transition');
    S.theme = d.themeChoix; rendre();
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
    S.modalDejaVu = false;
    return aller('engagement');
  }
  if(d.cible){ S.matiere = d.cible; S.qcmIdx=0; S.qcmRep=undefined; S.qcmSerie=0; return aller('qcm'); }
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
    if(!S.compositionId) ouvrirComposition();
    pister('COMPOSITION_ANSWER_SELECTED', { question: q + 1, total: S.grille.length });
    majComposition();
    return ecranGrille();
  }

  if(d.remettre) return remettre();

  if(d.recommencer){
    S.reponses={}; S.corrige=false; S.chrono=1500; S.grilleNote=null; S.compoTab='feuille'; S.sujetVu=false; S.apercu=null; return aller('grille');
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
ouvrirSessionObservation();
chargerActualites();
chargerQuestions();
reprendreSession();
