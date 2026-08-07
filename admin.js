/* ============================================================
   MON CONCOURS · administration
   ============================================================ */

const A = {
  session: null,
  profil: null,
  equipe: false,
  vue: 'apercu',
  ref: { matieres: [], concours: [], chapitres: [] },
  aValider: 0
};

/* ============================================================
   CONNEXION
   ============================================================ */
async function demarrer(){
  const { data } = await db.auth.getSession();
  if(data.session){ await entrer(data.session); }
  else { document.getElementById('portail').hidden = false; }

  db.auth.onAuthStateChange((_e, session) => {
    if(!session){
      document.getElementById('admin').hidden = true;
      document.getElementById('portail').hidden = false;
    }
  });
}

async function entrer(session){
  A.session = session;

  const { data: roles, error } = await db
    .from('roles_utilisateur').select('role').eq('user_id', session.user.id);

  if(error){ return refuser("Impossible de lire vos droits : " + error.message); }

  A.equipe = (roles || []).some(r => r.role === 'admin' || r.role === 'correcteur');
  if(!A.equipe){
    return refuser("Ce compte n'a pas les droits d'administration. Attribuez-lui le rôle « admin » dans la table roles_utilisateur.");
  }

  const { data: profil } = await db
    .from('profils').select('nom').eq('id', session.user.id).maybeSingle();
  A.profil = profil;

  document.getElementById('portail').hidden = true;
  document.getElementById('admin').hidden = false;
  document.getElementById('qui').textContent =
    (profil?.nom || session.user.email) + ' · équipe';

  await chargerReferentiel();
  rendre();
}

function refuser(message){
  const z = document.getElementById('err-connexion');
  z.textContent = message; z.hidden = false;
  document.getElementById('portail').hidden = false;
  document.getElementById('admin').hidden = true;
  db.auth.signOut();
}

async function connexion(){
  const email = document.getElementById('email').value.trim();
  const mdp   = document.getElementById('motdepasse').value;
  const z     = document.getElementById('err-connexion');
  z.hidden = true;

  if(!email || !mdp){
    z.textContent = 'Saisissez votre adresse et votre mot de passe.'; z.hidden = false; return;
  }
  const { data, error } = await db.auth.signInWithPassword({ email, password: mdp });
  if(error){ z.textContent = error.message; z.hidden = false; return; }
  await entrer(data.session);
}

/* ============================================================
   RÉFÉRENTIEL
   ============================================================ */
async function chargerReferentiel(){
  const [m, c, ch] = await Promise.all([
    db.from('matieres').select('*').order('ordre'),
    db.from('concours').select('*').order('nom'),
    db.from('chapitres').select('*').order('ordre')
  ]);
  A.ref.matieres  = m.data  || [];
  A.ref.concours  = c.data  || [];
  A.ref.chapitres = ch.data || [];
}

const optionsMatieres = (sel) => A.ref.matieres
  .map(m => `<option value="${m.id}" ${sel===m.id?'selected':''}>${m.nom}</option>`).join('');
const optionsConcours = (sel) => A.ref.concours
  .map(c => `<option value="${c.id}" ${sel===c.id?'selected':''}>${c.nom}</option>`).join('');
const nomMatiere = id => A.ref.matieres.find(m => m.id === id)?.nom || '—';

const NIVEAUX = [['troisieme','Troisième'],['terminale','Terminale'],['licence','Licence']];
const optionsNiveaux = (sel) => NIVEAUX
  .map(([v,l]) => `<option value="${v}" ${sel===v?'selected':''}>${l}</option>`).join('');

const statut = s => `<span class="marque-statut s-${s}">${(s||'').replace(/_/g,' ')}</span>`;

/* ============================================================
   RENDU
   ============================================================ */
function rendre(){
  $$('#menu button').forEach(b => b.classList.toggle('on', b.dataset.vue === A.vue));
  ({ apercu:vueApercu, depot:vueDepot, import:vueImport, bibliotheque:vueBibliotheque,
     validation:vueValidation, questions:vueQuestions, actualites:vueActualites,
     referentiel:vueReferentiel, journal:vueJournal }[A.vue] || vueApercu)();
  $('#vue').scrollTop = 0;
}

/* ---------- vue d'ensemble ---------- */
async function vueApercu(){
  $('#vue').innerHTML = `
    <h2 class="titre">Vue d'ensemble</h2>
    <p class="sous">L'état du contenu à cet instant. Tout ce qui n'est pas publié reste invisible pour les candidats.</p>
    <div class="bloc"><div class="compteurs" id="compteurs">
      <div class="carte">Chargement…</div></div></div>
    <div class="bloc">
      <div class="libelle">Derniers documents importés</div>
      <div class="carte"><div id="derniers">Chargement…</div></div>
    </div>`;

  const [q, qp, c, a, d, p, u, dep] = await Promise.all([
    db.from('questions').select('id', { count:'exact', head:true }),
    db.from('questions').select('id', { count:'exact', head:true }).eq('statut','publie'),
    db.from('ressources').select('id', { count:'exact', head:true }),
    db.from('actualites').select('id', { count:'exact', head:true }).eq('statut','publie'),
    db.from('documents_importes').select('id', { count:'exact', head:true }),
    db.from('propositions_ia').select('id', { count:'exact', head:true }).eq('statut','a_valider'),
    db.from('profils').select('id', { count:'exact', head:true }),
    db.from('depots').select('id', { count:'exact', head:true }).eq('statut','a_ranger')
  ]);

  A.aValider = p.count || 0;
  const past = document.getElementById('pastille-validation');
  past.hidden = !A.aValider; past.textContent = A.aValider;

  document.getElementById('compteurs').innerHTML = `
    <div class="compteur"><div class="v num">${nombre(qp.count)}</div><div class="l">Questions publiées</div></div>
    <div class="compteur"><div class="v num">${nombre(q.count)}</div><div class="l">Questions au total</div></div>
    <div class="compteur"><div class="v num">${nombre(c.count)}</div><div class="l">Ressources</div></div>
    <div class="compteur"><div class="v num">${nombre(a.count)}</div><div class="l">Actualités en ligne</div></div>
    <div class="compteur"><div class="v num">${nombre(d.count)}</div><div class="l">Documents importés</div></div>
    <div class="compteur ${A.aValider ? 'alerte-c' : ''}">
      <div class="v num">${nombre(A.aValider)}</div><div class="l">En attente de validation</div></div>
    <div class="compteur"><div class="v num">${nombre(u.count)}</div><div class="l">Candidats inscrits</div></div>
    <div class="compteur ${dep.count ? 'alerte-c' : ''}">
      <div class="v num">${nombre(dep.count)}</div><div class="l">En attente au dépôt</div></div>`;

  const pd = document.getElementById('pastille-depot');
  pd.hidden = !dep.count; pd.textContent = dep.count;

  const { data: docs } = await db.from('documents_importes')
    .select('nom_fichier, statut, nb_questions_detectees, cree_le')
    .order('cree_le', { ascending:false }).limit(6);

  document.getElementById('derniers').innerHTML = (docs && docs.length)
    ? `<table><thead><tr><th>Fichier</th><th>État</th><th>Questions</th><th>Reçu le</th></tr></thead><tbody>
       ${docs.map(d => `<tr><td>${d.nom_fichier}</td><td>${statut(d.statut)}</td>
         <td class="num">${d.nb_questions_detectees || 0}</td><td class="num">${dateHeure(d.cree_le)}</td></tr>`).join('')}
       </tbody></table>`
    : `<div class="vide">Aucun document pour l'instant.<br>Commencez par le centre d'import.</div>`;
}

/* ---------- import en masse ---------- */
function vueImport(){
  $('#vue').innerHTML = `
    <h2 class="titre">Import en masse</h2>
    <p class="sous">Votre contenu est déjà vérifié avant d'arriver ici. Vous collez, vous vérifiez l'aperçu, vous intégrez. Rien d'autre.</p>

    <div class="bloc">
      <div class="onglets" id="onglets-import">
        <button data-onglet="questions" class="on">Questions</button>
        <button data-onglet="actualites">Actualités</button>
        <button data-onglet="fichiers">Bibliothèque de fichiers</button>
      </div>
    </div>

    <div id="zone-import"></div>`;

  document.getElementById('onglets-import').addEventListener('click', e => {
    const b = e.target.closest('[data-onglet]');
    if(!b) return;
    $$('#onglets-import button').forEach(x => x.classList.toggle('on', x === b));
    ({ questions: importQuestions, actualites: importActualites, fichiers: importFichiers }[b.dataset.onglet])();
  });

  importQuestions();
}

/* ============================================================
   FORMAT TEXTE — pensé pour être dicté à une IA
   ============================================================ */
const MODELE_QUESTIONS = `Q: Capitale économique du Burkina Faso
a) Ouagadougou
b) *Bobo-Dioulasso
c) Koudougou
d) Banfora
> Bobo-Dioulasso concentre l'essentiel de l'activité industrielle du pays.

Q: L'Alliance des États du Sahel réunit
a) Burkina, Mali, Guinée
b) *Burkina, Mali, Niger
c) Burkina, Niger, Tchad
d) Mali, Niger, Guinée
> Charte du Liptako-Gourma, septembre 2023.`;

function analyserTexteQuestions(texte){
  const blocs = texte.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  const questions = [], soucis = [];

  blocs.forEach((bloc, n) => {
    const lignes = bloc.split('\n').map(l => l.trim()).filter(Boolean);
    let enonce = '', explication = '', options = [];

    lignes.forEach(ligne => {
      const mQ = ligne.match(/^Q\s*[:.\-]\s*(.+)$/i);
      const mO = ligne.match(/^([a-hA-H])\s*[)\.\-]\s*(.+)$/);
      const mE = ligne.match(/^[>»]\s*(.+)$/);

      if(mQ)      enonce = mQ[1].trim();
      else if(mO){
        let t = mO[2].trim();
        const juste = t.startsWith('*');
        if(juste) t = t.slice(1).trim();
        options.push({ texte: t, est_correcte: juste });
      }
      else if(mE) explication = mE[1].trim();
      else if(!enonce) enonce = ligne;
    });

    if(!enonce){ soucis.push(`Bloc ${n+1} : aucun énoncé reconnu.`); return; }
    if(options.length < 2){ soucis.push(`Bloc ${n+1} : moins de deux propositions.`); return; }
    questions.push({ enonce, options, explication });
  });

  return { questions, soucis };
}

function importQuestions(){
  document.getElementById('zone-import').innerHTML = `
    <div class="bloc">
      <div class="libelle">Rattachement du lot</div>
      <div class="carte">
        <div class="deux">
          <div><label for="i-matiere">Matière</label>
            <select id="i-matiere"><option value="">— aucune —</option>${optionsMatieres()}</select></div>
          <div><label for="i-niveau">Niveau</label>
            <select id="i-niveau">${optionsNiveaux('terminale')}</select></div>
          <div><label for="i-concours">Concours</label>
            <select id="i-concours"><option value="">— aucun —</option>${optionsConcours()}</select></div>
          <div><label for="i-annee">Année de session</label>
            <input id="i-annee" type="number" placeholder="2025" min="1990" max="2100"></div>
        </div>
      </div>
    </div>

    <div class="bloc">
      <div class="libelle">Collez vos questions<span>format texte ou JSON</span></div>
      <div class="carte">
        <textarea id="brut" style="min-height:230px;font-family:var(--m);font-size:13px"
          placeholder="${MODELE_QUESTIONS.replace(/"/g,'&quot;')}"></textarea>
        <div class="rangee">
          <button class="cta creux petit" id="btn-modele">Insérer un exemple</button>
          <button class="cta petit" id="btn-lire">Analyser le lot</button>
        </div>
        <p class="sous" style="font-size:12.5px">
          Une question par bloc, séparés par une ligne vide. <b>Q:</b> pour l'énoncé,
          <b>a)</b> à <b>d)</b> pour les propositions, une <b>étoile</b> devant chaque bonne réponse
          — vous pouvez en mettre plusieurs, ou aucune. <b>&gt;</b> pour l'explication.
        </p>
      </div>
    </div>

    <div class="bloc" id="apercu"></div>`;

  document.getElementById('btn-modele').onclick = () => {
    document.getElementById('brut').value = MODELE_QUESTIONS;
  };
  document.getElementById('btn-lire').onclick = lireLotQuestions;
}

let lotPret = [];

function lireLotQuestions(){
  const brut = document.getElementById('brut').value.trim();
  const z = document.getElementById('apercu');
  if(!brut){ z.innerHTML = ''; return signal('Le champ est vide.', 'mal'); }

  let questions = [], soucis = [];

  if(brut.startsWith('[') || brut.startsWith('{')){
    try{
      const j = JSON.parse(brut);
      questions = Array.isArray(j) ? j : [j];
    }catch(e){ return erreur(e, 'JSON invalide'); }
  }else{
    ({ questions, soucis } = analyserTexteQuestions(brut));
  }

  const contexte = {
    matiere_id:    document.getElementById('i-matiere').value || null,
    niveau:        document.getElementById('i-niveau').value || null,
    concours_id:   document.getElementById('i-concours').value || null,
    annee_session: parseInt(document.getElementById('i-annee').value) || null
  };
  lotPret = questions.map(q => ({ ...contexte, ...q }));

  const sansJuste = lotPret.filter(q => !(q.options || []).some(o => o.est_correcte)).length;
  const multi     = lotPret.filter(q => (q.options || []).filter(o => o.est_correcte).length > 1).length;

  z.innerHTML = `
    <div class="libelle">Aperçu du lot<span class="num">${lotPret.length} question${lotPret.length>1?'s':''}</span></div>

    <div class="compteurs" style="margin-bottom:14px">
      <div class="compteur"><div class="v num">${lotPret.length}</div><div class="l">Reconnues</div></div>
      <div class="compteur ${multi?'':''}"><div class="v num">${multi}</div><div class="l">À réponses multiples</div></div>
      <div class="compteur ${sansJuste?'alerte-c':''}"><div class="v num">${sansJuste}</div><div class="l">Sans bonne réponse</div></div>
      <div class="compteur ${soucis.length?'alerte-c':''}"><div class="v num">${soucis.length}</div><div class="l">Blocs écartés</div></div>
    </div>

    ${soucis.length ? `<div class="alerte">${soucis.slice(0,6).join('<br>')}${soucis.length>6?'<br>…':''}</div>` : ''}
    ${sansJuste ? `<div class="doublon">${sansJuste} question(s) n'ont aucune bonne réponse cochée. C'est possible — mais vérifiez que ce n'est pas un oubli d'étoile.</div>` : ''}

    ${lotPret.slice(0,5).map(q => `
      <div class="proposition">
        <div class="enonce">${q.enonce}</div>
        <div class="options-prop">
          ${(q.options||[]).map((o,i) => `
            <div class="option-prop ${o.est_correcte?'juste':''}">
              <span class="l">${'abcdefgh'[i]}</span><span>${o.texte}</span></div>`).join('')}
        </div>
        ${q.explication ? `<p class="sous" style="margin:0">${q.explication}</p>` : ''}
      </div>`).join('')}
    ${lotPret.length > 5 ? `<p class="sous">… et ${lotPret.length-5} autre(s). L'aperçu montre les cinq premières.</p>` : ''}

    <div class="actions" style="margin-top:16px">
      <button class="b-publier" id="btn-integrer-publie">Intégrer et publier</button>
      <button class="b-valider" id="btn-integrer-brouillon">Intégrer en brouillon</button>
    </div>`;

  document.getElementById('btn-integrer-publie').onclick    = () => integrerQuestions(true);
  document.getElementById('btn-integrer-brouillon').onclick = () => integrerQuestions(false);
}

async function integrerQuestions(publier){
  if(!lotPret.length) return signal('Analysez d\'abord le lot.', 'mal');
  const boutons = $$('#apercu .actions button');
  boutons.forEach(b => b.disabled = true);

  const { data, error } = await db.rpc('importer_questions', {
    p_questions: lotPret, p_publier: publier
  });
  boutons.forEach(b => b.disabled = false);
  if(error) return erreur(error, 'Import impossible');

  const r = data || {};
  signal(`${r.inserees || 0} question(s) intégrée(s)`
    + (r.doublons ? ` · ${r.doublons} doublon(s) écarté(s)` : '')
    + (r.ignorees ? ` · ${r.ignorees} ignorée(s)` : '')
    + (publier ? ' · en ligne pour les candidats.' : ' · en brouillon.'), 'bien');

  document.getElementById('brut').value = '';
  document.getElementById('apercu').innerHTML = '';
  lotPret = [];
}

/* ---------- import des actualités ---------- */
const MODELE_ACTU = `Épreuves écrites confirmées du 15 au 22 juillet
Conseil des ministres
Djibo maintenu comme centre secondaire de composition. Tests sportifs les 13 et 14 juin.
Date officielle · tombe presque chaque année

504 postes réservés aux VDP et aux couches spécifiques
Décret
Agents de santé à base communautaire, enseignants communautaires, orphelins et veuves.
Chiffre important · politique sociale de l'État`;

function importActualites(){
  document.getElementById('zone-import').innerHTML = `
    <div class="bloc">
      <div class="libelle">Catégorie du lot</div>
      <div class="carte">
        <select id="a-cat-lot" style="max-width:280px">
          <option value="national">National</option>
          <option value="international">International</option>
        </select>
      </div>
    </div>

    <div class="bloc">
      <div class="libelle">Collez vos informations<span>quatre lignes par information</span></div>
      <div class="carte">
        <textarea id="brut-actu" style="min-height:220px;font-family:var(--m);font-size:13px"
          placeholder="${MODELE_ACTU.replace(/"/g,'&quot;')}"></textarea>
        <div class="rangee">
          <button class="cta creux petit" id="btn-modele-actu">Insérer un exemple</button>
          <button class="cta petit" id="btn-lire-actu">Analyser le lot</button>
        </div>
        <p class="sous" style="font-size:12.5px">
          Une information par bloc, séparés par une ligne vide.
          Ligne 1 : le <b>titre</b>. Ligne 2 : la <b>source</b>. Ligne 3 : le <b>contenu</b>.
          Ligne 4 (facultative) : <b>pourquoi</b> c'est au programme.
        </p>
      </div>
    </div>

    <div class="bloc" id="apercu-actu"></div>`;

  document.getElementById('btn-modele-actu').onclick = () => {
    document.getElementById('brut-actu').value = MODELE_ACTU;
  };
  document.getElementById('btn-lire-actu').onclick = lireLotActu;
}

let lotActu = [];

function lireLotActu(){
  const brut = document.getElementById('brut-actu').value.trim();
  if(!brut) return signal('Le champ est vide.', 'mal');

  const categorie = document.getElementById('a-cat-lot').value;

  if(brut.startsWith('[')){
    try{ lotActu = JSON.parse(brut).map(a => ({ categorie, ...a })); }
    catch(e){ return erreur(e, 'JSON invalide'); }
  }else{
    lotActu = brut.split(/\n\s*\n/).map(b => {
      const l = b.split('\n').map(x => x.trim()).filter(Boolean);
      return { titre: l[0] || '', source: l[1] || '', contenu: l[2] || '',
               pourquoi: l[3] || '', categorie, verifiee: true };
    }).filter(a => a.titre);
  }

  document.getElementById('apercu-actu').innerHTML = `
    <div class="libelle">Aperçu<span class="num">${lotActu.length} information${lotActu.length>1?'s':''}</span></div>
    ${lotActu.map(a => `
      <div class="proposition">
        <div class="rangee"><span class="marque-statut s-publie">✓ vérifiée</span>
          <span class="num" style="font-size:11px;color:var(--craie2)">${a.source || 'source non précisée'} · ${a.categorie}</span></div>
        <div class="enonce" style="font-size:15px">${a.titre}</div>
        ${a.contenu ? `<p class="sous" style="margin:0 0 8px">${a.contenu}</p>` : ''}
        ${a.pourquoi ? `<div class="meta-prop" style="margin:0">${a.pourquoi}</div>` : ''}
      </div>`).join('')}
    <div class="actions" style="margin-top:16px">
      <button class="b-publier" id="btn-actu-publie">Publier maintenant</button>
      <button class="b-valider" id="btn-actu-brouillon">Enregistrer en brouillon</button>
    </div>`;

  document.getElementById('btn-actu-publie').onclick    = () => integrerActu(true);
  document.getElementById('btn-actu-brouillon').onclick = () => integrerActu(false);
}

async function integrerActu(publier){
  if(!lotActu.length) return signal('Analysez d\'abord le lot.', 'mal');
  const { data, error } = await db.rpc('importer_actualites', {
    p_actualites: lotActu, p_publier: publier
  });
  if(error) return erreur(error, 'Import impossible');

  signal(`${(data||{}).inserees || 0} information(s) `
    + (publier ? 'publiée(s) : elles sont dans le bulletin du matin.' : 'enregistrée(s) en brouillon.'), 'bien');
  document.getElementById('brut-actu').value = '';
  document.getElementById('apercu-actu').innerHTML = '';
  lotActu = [];
}

/* ---------- bibliothèque de fichiers ---------- */
function importFichiers(){
  document.getElementById('zone-import').innerHTML = `
    <div class="bloc">
      <div class="libelle">Rattachement</div>
      <div class="carte">
        <div class="deux">
          <div><label for="f-type">Nature</label>
            <select id="f-type">
              <option value="cours">Cours ou fascicule</option>
              <option value="annale">Ancien sujet</option>
              <option value="corrige">Corrigé</option>
              <option value="autre">Autre</option>
            </select></div>
          <div><label for="f-niveau">Niveau</label>
            <select id="f-niveau">${optionsNiveaux('terminale')}</select></div>
          <div><label for="f-matiere">Matière</label>
            <select id="f-matiere"><option value="">— aucune —</option>${optionsMatieres()}</select></div>
          <div><label for="f-annee">Année</label>
            <input id="f-annee" type="number" placeholder="2025" min="1990" max="2100"></div>
        </div>
      </div>
    </div>

    <div class="bloc">
      <div class="libelle">Fichiers à conserver</div>
      <div class="depot" id="depot">
        <div class="g">Déposez vos fichiers ici</div>
        <p>PDF, Word, Excel ou images. Ils sont archivés et mis à disposition des candidats depuis la section Cours.</p>
        <button class="cta creux petit" style="margin-top:14px" id="btn-parcourir">Parcourir</button>
        <input type="file" id="fichiers" multiple hidden
               accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.png,.jpg,.jpeg">
      </div>
      <div class="fichiers" id="liste-fichiers"></div>
      <div class="barre" id="barre" hidden><i></i></div>
      <button class="cta" id="btn-envoyer" style="margin-top:14px" disabled>Envoyer les fichiers</button>
      <p class="sous" style="font-size:12.5px">Les fichiers sont stockés tels quels. Aucune analyse automatique : c'est votre bibliothèque.</p>
    </div>

    <div class="bloc">
      <div class="libelle">Déjà en bibliothèque</div>
      <div class="carte" id="biblio">Chargement…</div>
    </div>`;

  brancherDepot();
  listerBibliotheque();
}

let fichiersChoisis = [];

function brancherDepot(){
  const depot  = document.getElementById('depot');
  const entree = document.getElementById('fichiers');

  document.getElementById('btn-parcourir').onclick = () => entree.click();
  entree.onchange = () => ajouterFichiers([...entree.files]);

  ['dragenter','dragover'].forEach(e => depot.addEventListener(e, ev => {
    ev.preventDefault(); depot.classList.add('survol');
  }));
  ['dragleave','drop'].forEach(e => depot.addEventListener(e, ev => {
    ev.preventDefault(); depot.classList.remove('survol');
  }));
  depot.addEventListener('drop', ev => ajouterFichiers([...ev.dataTransfer.files]));
  document.getElementById('btn-envoyer').onclick = envoyerFichiers;
}

function ajouterFichiers(liste){
  fichiersChoisis = fichiersChoisis.concat(liste);
  const z = document.getElementById('liste-fichiers');
  z.innerHTML = fichiersChoisis.map((f,i) => `
    <div class="fichier"><span class="n">${f.name}</span>
      <span class="t">${octets(f.size)}</span>
      <button class="lien" data-retirer="${i}">retirer</button></div>`).join('');
  z.querySelectorAll('[data-retirer]').forEach(b => b.onclick = () => {
    fichiersChoisis.splice(+b.dataset.retirer, 1); ajouterFichiers([]);
  });
  const bouton = document.getElementById('btn-envoyer');
  bouton.disabled = fichiersChoisis.length === 0;
  bouton.textContent = fichiersChoisis.length
    ? `Envoyer ${fichiersChoisis.length} fichier${fichiersChoisis.length>1?'s':''}`
    : 'Envoyer les fichiers';
}

async function envoyerFichiers(){
  if(!fichiersChoisis.length) return;
  const bouton = document.getElementById('btn-envoyer');
  const barre  = document.getElementById('barre');
  bouton.disabled = true; barre.hidden = false;

  const contexte = {
    type_document: document.getElementById('f-type').value,
    niveau:        document.getElementById('f-niveau').value || null,
    matiere_id:    document.getElementById('f-matiere').value || null,
    annee_session: parseInt(document.getElementById('f-annee').value) || null
  };

  try{
    const { data: lot, error: eLot } = await db.from('lots_import')
      .insert({ libelle: `${contexte.type_document} · ${new Date().toLocaleDateString('fr-FR')}`,
                importe_par: A.session.user.id, nb_fichiers: fichiersChoisis.length })
      .select().single();
    if(eLot) throw eLot;

    for(let i = 0; i < fichiersChoisis.length; i++){
      const f = fichiersChoisis[i];
      const chemin = `${lot.id}/${Date.now()}-${f.name.replace(/[^\w.\-]/g,'_')}`;

      const { error: eUp } = await db.storage.from('documents-importes').upload(chemin, f);
      if(eUp) throw eUp;

      const { error: eDoc } = await db.from('documents_importes').insert({
        lot_id: lot.id, nom_fichier: f.name, chemin_storage: chemin,
        type_mime: f.type, taille_octets: f.size,
        importe_par: A.session.user.id, statut: 'analyse', ...contexte
      });
      if(eDoc) throw eDoc;

      barre.querySelector('i').style.width = ((i+1)/fichiersChoisis.length*100) + '%';
    }

    signal(`${fichiersChoisis.length} fichier(s) archivé(s).`, 'bien');
    fichiersChoisis = []; ajouterFichiers([]);
    listerBibliotheque();
    setTimeout(() => { barre.hidden = true; barre.querySelector('i').style.width = '0'; }, 900);
  }catch(e){
    erreur(e, "Envoi impossible");
    bouton.disabled = false; barre.hidden = true;
  }
}

async function listerBibliotheque(){
  const { data } = await db.from('documents_importes')
    .select('nom_fichier, type_document, taille_octets, cree_le')
    .order('cree_le', { ascending:false }).limit(25);

  document.getElementById('biblio').innerHTML = (data && data.length)
    ? `<table><thead><tr><th>Fichier</th><th>Nature</th><th>Taille</th><th>Reçu le</th></tr></thead><tbody>
       ${data.map(d => `<tr><td>${d.nom_fichier}</td><td>${d.type_document || '—'}</td>
         <td class="num">${octets(d.taille_octets)}</td>
         <td class="num">${dateCourte(d.cree_le)}</td></tr>`).join('')}</tbody></table>`
    : `<div class="vide">La bibliothèque est vide.</div>`;
}

/* ============================================================
   LE DÉPÔT — on envoie tout ici, on range ensuite
   ============================================================ */

const NATURES = [
  ['questions',  'Questions / QCM'],
  ['actualite',  'Actualité'],
  ['cours',      'Cours'],
  ['exercices',  'Exercices'],
  ['corrige',    'Corrigé'],
  ['annale',     'Ancien sujet'],
  ['fiche',      'Fiche de révision'],
  ['note',       'Note pour plus tard'],
  ['inconnu',    'À déterminer']
];
const libelleNature = v => (NATURES.find(n => n[0] === v) || ['','—'])[1];

/* devine ce qu'on vient de coller */
function devinerNature(texte, nomFichier){
  const t = (texte || '').trim();
  const f = (nomFichier || '').toLowerCase();

  if(f){
    if(/corrig/.test(f))                 return 'corrige';
    if(/exercice|td|devoir/.test(f))     return 'exercices';
    if(/annale|sujet|concours|epreuve/.test(f)) return 'annale';
    if(/fiche|resume|résumé/.test(f))    return 'fiche';
    if(/cours|chapitre|lecon|leçon/.test(f)) return 'cours';
  }
  if(!t) return 'inconnu';

  const lignes = t.split('\n').map(l => l.trim()).filter(Boolean);
  const optionsAbcd = lignes.filter(l => /^[a-dA-D]\s*[)\.\-]\s*\S/.test(l)).length;
  const marqueursQ  = lignes.filter(l => /^Q\s*[:.\-]/i.test(l)).length;
  const etoiles     = lignes.filter(l => /^[a-dA-D]\s*[)\.\-]\s*\*/.test(l)).length;

  if(marqueursQ >= 1 || optionsAbcd >= 3 || etoiles >= 1) return 'questions';

  const blocs = t.split(/\n\s*\n/).filter(Boolean);
  const courts = blocs.filter(b => b.split('\n').filter(Boolean).length <= 4).length;
  if(blocs.length >= 2 && courts === blocs.length && t.length < 2500) return 'actualite';

  if(t.length > 900) return 'cours';
  return 'inconnu';
}

async function vueDepot(){
  $('#vue').innerHTML = `
    <h2 class="titre">Le dépôt</h2>
    <p class="sous">Envoyez tout ici, même en vrac : un texte, un lot de questions, une actualité, un PDF, une simple note. Le système devine de quoi il s'agit et le met de côté. Vous rangerez ensuite, tranquillement.</p>

    <div class="bloc">
      <div class="libelle">Déposer maintenant</div>
      <div class="carte">
        <label for="d-titre">Un titre, pour vous y retrouver <span style="text-transform:none;letter-spacing:0">(facultatif)</span></label>
        <input id="d-titre" placeholder="Annales SVT 2024 envoyées par Salif">

        <label for="d-contenu">Collez votre texte</label>
        <textarea id="d-contenu" style="min-height:190px"
          placeholder="Collez n'importe quoi : des questions, une actualité, un cours, une note.&#10;Vous n'avez rien à classer maintenant."></textarea>

        <div class="depot" id="depot-fichiers" style="margin:6px 0 14px">
          <div class="g">…ou déposez des fichiers</div>
          <p>PDF, Word, images. Plusieurs à la fois.</p>
          <button class="cta creux petit" style="margin-top:12px" id="btn-parcourir-d">Parcourir</button>
          <input type="file" id="fichiers-d" multiple hidden>
        </div>
        <div class="fichiers" id="liste-d"></div>

        <div class="rangee" style="margin-top:12px">
          <span class="marque-statut s-en_attente" id="devine">Nature : à déterminer</span>
          <button class="cta petit" id="btn-deposer">Envoyer au dépôt</button>
        </div>
      </div>
    </div>

    <div class="bloc">
      <div class="libelle">À ranger<span class="num" id="nb-ranger">…</span></div>
      <div id="liste-depots">Chargement…</div>
    </div>`;

  const zoneTexte = document.getElementById('d-contenu');
  const badge = document.getElementById('devine');
  const majDevine = () => {
    const n = devinerNature(zoneTexte.value, fichiersDepot[0]?.name);
    badge.textContent = 'Nature : ' + libelleNature(n);
    badge.className = 'marque-statut ' + (n === 'inconnu' ? 's-en_attente' : 's-publie');
  };
  zoneTexte.addEventListener('input', majDevine);

  brancherDepotLibre(majDevine);
  document.getElementById('btn-deposer').onclick = envoyerAuDepot;
  listerDepots();
}

let fichiersDepot = [];

function brancherDepotLibre(majDevine){
  const zone   = document.getElementById('depot-fichiers');
  const entree = document.getElementById('fichiers-d');

  document.getElementById('btn-parcourir-d').onclick = () => entree.click();
  entree.onchange = () => ajouterD([...entree.files], majDevine);

  ['dragenter','dragover'].forEach(e => zone.addEventListener(e, ev => {
    ev.preventDefault(); zone.classList.add('survol');
  }));
  ['dragleave','drop'].forEach(e => zone.addEventListener(e, ev => {
    ev.preventDefault(); zone.classList.remove('survol');
  }));
  zone.addEventListener('drop', ev => ajouterD([...ev.dataTransfer.files], majDevine));
}

function ajouterD(liste, majDevine){
  fichiersDepot = fichiersDepot.concat(liste);
  const z = document.getElementById('liste-d');
  z.innerHTML = fichiersDepot.map((f,i) => `
    <div class="fichier"><span class="n">${f.name}</span>
      <span class="t">${octets(f.size)}</span>
      <button class="lien" data-ret-d="${i}">retirer</button></div>`).join('');
  z.querySelectorAll('[data-ret-d]').forEach(b => b.onclick = () => {
    fichiersDepot.splice(+b.dataset.retD, 1); ajouterD([], majDevine);
  });
  if(majDevine) majDevine();
}

async function envoyerAuDepot(){
  const titre   = document.getElementById('d-titre').value.trim();
  const contenu = document.getElementById('d-contenu').value.trim();
  if(!contenu && !fichiersDepot.length){
    return signal('Collez un texte ou déposez un fichier.', 'mal');
  }
  const bouton = document.getElementById('btn-deposer');
  bouton.disabled = true;

  try{
    // le texte collé fait un dépôt à lui seul
    if(contenu){
      const nature = devinerNature(contenu, null);
      const { error } = await db.from('depots').insert({
        titre: titre || null, contenu,
        nature_devinee: nature, depose_par: A.session.user.id,
        nb_elements: contenu.split(/\n\s*\n/).filter(Boolean).length
      });
      if(error) throw error;
    }

    // chaque fichier fait son propre dépôt
    for(const f of fichiersDepot){
      const chemin = `depot/${Date.now()}-${f.name.replace(/[^\w.\-]/g,'_')}`;
      const { error: eUp } = await db.storage.from('documents-importes').upload(chemin, f);
      if(eUp) throw eUp;

      const { error } = await db.from('depots').insert({
        titre: titre || f.name, nom_fichier: f.name, fichier_chemin: chemin,
        type_mime: f.type, taille_octets: f.size,
        nature_devinee: devinerNature(null, f.name),
        depose_par: A.session.user.id
      });
      if(error) throw error;
    }

    signal('Déposé. Vous pourrez le ranger quand vous voudrez.', 'bien');
    document.getElementById('d-titre').value = '';
    document.getElementById('d-contenu').value = '';
    fichiersDepot = []; ajouterD([]);
    listerDepots();
  }catch(e){ erreur(e, 'Dépôt impossible'); }
  bouton.disabled = false;
}

async function listerDepots(){
  const { data, error } = await db.from('depots')
    .select('*').eq('statut','a_ranger').order('cree_le', { ascending:false }).limit(40);
  if(error) return erreur(error, 'Lecture impossible');

  document.getElementById('nb-ranger').textContent = data.length;
  const z = document.getElementById('liste-depots');

  if(!data.length){
    z.innerHTML = `<div class="carte"><div class="vide">Le dépôt est vide.<br>Tout ce que vous aviez envoyé a été rangé.</div></div>`;
    return;
  }

  z.innerHTML = data.map(d => {
    const apercu = (d.contenu || '').slice(0, 220);
    return `
    <div class="proposition" data-depot="${d.id}">
      <div class="rangee">
        <span class="marque-statut ${d.nature_devinee === 'inconnu' ? 's-en_attente' : 's-analyse'}">
          ${libelleNature(d.nature_retenue || d.nature_devinee)}</span>
        <span class="num" style="font-size:11px;color:var(--craie2)">${dateHeure(d.cree_le)}</span>
        ${d.nom_fichier ? `<span class="num" style="font-size:11px;color:var(--craie2)">${d.nom_fichier} · ${octets(d.taille_octets)}</span>` : ''}
      </div>
      <div class="enonce" style="font-size:15px">${d.titre || (d.nom_fichier || 'Texte sans titre')}</div>
      ${apercu ? `<p class="sous" style="margin:0 0 12px;white-space:pre-wrap">${apercu}${(d.contenu||'').length > 220 ? '…' : ''}</p>` : ''}

      <div class="deux" style="margin-bottom:12px">
        <div><label>Nature</label>
          <select data-champ="nature" style="margin:0">
            ${NATURES.map(n => `<option value="${n[0]}" ${(d.nature_retenue||d.nature_devinee)===n[0]?'selected':''}>${n[1]}</option>`).join('')}
          </select></div>
        <div><label>Matière</label>
          <select data-champ="matiere" style="margin:0">
            <option value="">— aucune —</option>${optionsMatieres(d.matiere_id)}</select></div>
        <div><label>Niveau</label>
          <select data-champ="niveau" style="margin:0">${optionsNiveaux(d.niveau || 'terminale')}</select></div>
        <div><label>Année</label>
          <input data-champ="annee" type="number" placeholder="2025" value="${d.annee_session || ''}" style="margin:0"></div>
      </div>

      <div class="actions">
        ${d.contenu ? `<button class="b-publier" data-traiter="${d.id}">Ranger et intégrer</button>` : ''}
        <button class="b-valider" data-classer="${d.id}">Enregistrer le classement</button>
        <button class="b-modifier" data-range="${d.id}">Marquer comme rangé</button>
        <button class="b-rejeter" data-ignorer="${d.id}">Ignorer</button>
      </div>
    </div>`;
  }).join('');

  const champs = id => {
    const c = z.querySelector(`[data-depot="${id}"]`);
    return {
      nature_retenue: c.querySelector('[data-champ="nature"]').value,
      matiere_id:     c.querySelector('[data-champ="matiere"]').value || null,
      niveau:         c.querySelector('[data-champ="niveau"]').value || null,
      annee_session:  parseInt(c.querySelector('[data-champ="annee"]').value) || null
    };
  };

  z.querySelectorAll('[data-classer]').forEach(b => b.onclick = async () => {
    const { error } = await db.from('depots').update(champs(b.dataset.classer)).eq('id', b.dataset.classer);
    if(error) return erreur(error, 'Enregistrement impossible');
    signal('Classement enregistré.', 'bien'); listerDepots();
  });

  z.querySelectorAll('[data-range]').forEach(b => b.onclick = async () => {
    const { error } = await db.from('depots').update({
      ...champs(b.dataset.range), statut:'range',
      range_par: A.session.user.id, range_le: new Date().toISOString()
    }).eq('id', b.dataset.range);
    if(error) return erreur(error, 'Enregistrement impossible');
    signal('Rangé.', 'bien'); listerDepots();
  });

  z.querySelectorAll('[data-ignorer]').forEach(b => b.onclick = async () => {
    await db.from('depots').update({ statut:'ignore' }).eq('id', b.dataset.ignorer);
    signal('Mis de côté.', 'info'); listerDepots();
  });

  z.querySelectorAll('[data-traiter]').forEach(b => b.onclick = () =>
    rangerEtIntegrer(b.dataset.traiter, data.find(x => x.id === b.dataset.traiter), champs(b.dataset.traiter)));
}

/* ---------- ranger : le contenu part au bon endroit ---------- */
async function rangerEtIntegrer(id, depot, ch){
  const nature = ch.nature_retenue;
  const texte  = depot.contenu || '';

  try{
    let bilan = '';

    if(nature === 'questions' || nature === 'annale'){
      const { questions, soucis } = analyserTexteQuestions(texte);
      if(!questions.length) return signal("Aucune question reconnue dans ce texte.", 'mal');
      const lot = questions.map(q => ({
        matiere_id: ch.matiere_id, niveau: ch.niveau,
        annee_session: ch.annee_session, source: nature === 'annale' ? 'annale' : 'redigee', ...q
      }));
      const { data, error } = await db.rpc('importer_questions', { p_questions: lot, p_publier: true });
      if(error) throw error;
      bilan = `${data.inserees} question(s) publiée(s)`
            + (data.doublons ? ` · ${data.doublons} doublon(s)` : '')
            + (soucis.length ? ` · ${soucis.length} bloc(s) écarté(s)` : '');

    }else if(nature === 'actualite'){
      const lot = texte.split(/\n\s*\n/).map(b => {
        const l = b.split('\n').map(x => x.trim()).filter(Boolean);
        return { titre:l[0]||'', source:l[1]||'', contenu:l[2]||'', pourquoi:l[3]||'',
                 categorie:'national', verifiee:true };
      }).filter(a => a.titre);
      if(!lot.length) return signal("Aucune information reconnue.", 'mal');
      const { data, error } = await db.rpc('importer_actualites', { p_actualites: lot, p_publier: true });
      if(error) throw error;
      bilan = `${data.inserees} information(s) publiée(s)`;

    }else if(['cours','exercices','corrige','fiche'].includes(nature)){
      const { error } = await db.from('ressources').insert({
        titre: depot.titre || 'Sans titre',
        texte,
        type_ressource: nature === 'fiche' ? 'fiche' : nature,
        matiere_id: ch.matiere_id, niveau: ch.niveau,
        fichier_chemin: depot.fichier_chemin, nom_fichier: depot.nom_fichier,
        taille_octets: depot.taille_octets,
        statut: 'publie', publie_le: new Date().toISOString(),
        depose_par: A.session.user.id
      });
      if(error) throw error;
      bilan = 'Ajouté à la bibliothèque';

    }else{
      return signal("Choisissez d'abord une nature avant d'intégrer.", 'mal');
    }

    await db.from('depots').update({
      ...ch, statut:'range', range_vers: nature,
      range_par: A.session.user.id, range_le: new Date().toISOString()
    }).eq('id', id);

    signal(bilan + ' · dépôt rangé.', 'bien');
    listerDepots();
  }catch(e){ erreur(e, 'Rangement impossible'); }
}

/* ============================================================
   LA BIBLIOTHÈQUE
   ============================================================ */
async function vueBibliotheque(){
  $('#vue').innerHTML = `
    <h2 class="titre">Bibliothèque</h2>
    <p class="sous">Vos cours vous appartiennent : le texte pour la recherche et les fiches, le PDF pour le téléchargement. Chaque chapitre porte son cours, ses exercices et son corrigé.</p>

    <div class="bloc">
      <div class="libelle">Ajouter une ressource</div>
      <div class="carte">
        <label for="r-titre">Titre</label>
        <input id="r-titre" placeholder="La cellule — cours complet">
        <div class="deux">
          <div><label for="r-type">Type</label>
            <select id="r-type">
              <option value="cours">Cours</option>
              <option value="exercices">Exercices</option>
              <option value="corrige">Corrigé</option>
              <option value="fiche">Fiche de révision</option>
              <option value="annale">Ancien sujet</option>
            </select></div>
          <div><label for="r-matiere">Matière</label>
            <select id="r-matiere">${optionsMatieres()}</select></div>
          <div><label for="r-niveau">Niveau</label>
            <select id="r-niveau">${optionsNiveaux('terminale')}</select></div>
          <div><label for="r-theme">Thème</label>
            <input id="r-theme" placeholder="Biologie cellulaire"></div>
        </div>
        <label for="r-texte">Contenu texte</label>
        <textarea id="r-texte" placeholder="Le texte sert à la recherche, aux fiches et à la génération de questions."></textarea>
        <label for="r-mots">Mots-clés séparés par des virgules</label>
        <input id="r-mots" placeholder="cellule, mitochondrie, noyau">
        <label for="r-fichier">Fichier à télécharger</label>
        <input id="r-fichier" type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg">
        <div class="actions" style="margin-top:6px">
          <button class="b-publier" id="r-publier">Ajouter et publier</button>
          <button class="b-valider" id="r-brouillon">Ajouter en brouillon</button>
        </div>
      </div>
    </div>

    <div class="bloc">
      <div class="libelle">Les rayons</div>
      <div class="carte" id="rayons">Chargement…</div>
    </div>`;

  const enregistrer = async (publier) => {
    const titre = document.getElementById('r-titre').value.trim();
    if(!titre) return signal('Donnez un titre à la ressource.', 'mal');

    let chemin = null, nomFichier = null, taille = null;
    const f = document.getElementById('r-fichier').files[0];
    if(f){
      chemin = `cours/${Date.now()}-${f.name.replace(/[^\w.\-]/g,'_')}`;
      const { error } = await db.storage.from('cours').upload(chemin, f);
      if(error) return erreur(error, 'Envoi du fichier impossible');
      nomFichier = f.name; taille = f.size;
    }

    const mots = document.getElementById('r-mots').value
      .split(',').map(m => m.trim()).filter(Boolean);

    const { error } = await db.from('ressources').insert({
      titre,
      type_ressource: document.getElementById('r-type').value,
      matiere_id: document.getElementById('r-matiere').value,
      niveau:     document.getElementById('r-niveau').value,
      theme:      document.getElementById('r-theme').value.trim() || null,
      texte:      document.getElementById('r-texte').value.trim() || null,
      mots_cles:  mots.length ? mots : null,
      fichier_chemin: chemin, nom_fichier: nomFichier, taille_octets: taille,
      statut: publier ? 'publie' : 'brouillon',
      publie_le: publier ? new Date().toISOString() : null,
      depose_par: A.session.user.id
    });
    if(error) return erreur(error, 'Ajout impossible');

    ['r-titre','r-theme','r-texte','r-mots'].forEach(i => document.getElementById(i).value = '');
    document.getElementById('r-fichier').value = '';
    signal(publier ? 'Ressource publiée.' : 'Brouillon enregistré.', 'bien');
    charger();
  };

  const charger = async () => {
    const { data, error } = await db.from('ressources')
      .select('*').order('cree_le', { ascending:false }).limit(80);
    if(error) return erreur(error, 'Lecture impossible');

    if(!data.length){
      document.getElementById('rayons').innerHTML =
        `<div class="vide">La bibliothèque est vide.<br>Ajoutez votre premier cours ci-dessus.</div>`;
      return;
    }

    const parMatiere = {};
    data.forEach(r => {
      const m = nomMatiere(r.matiere_id);
      (parMatiere[m] = parMatiere[m] || []).push(r);
    });

    document.getElementById('rayons').innerHTML = Object.keys(parMatiere).map(m => `
      <div class="bloc" style="margin-top:0">
        <div class="libelle">${m}<span class="num">${parMatiere[m].length}</span></div>
        <table><tbody>
          ${parMatiere[m].map(r => `<tr>
            <td><b>${r.titre}</b><br>
              <span class="num" style="font-size:11px;color:var(--craie2)">
                ${r.type_ressource} · ${r.niveau || '—'}${r.theme ? ' · ' + r.theme : ''}
                ${r.nom_fichier ? ' · ' + r.nom_fichier : ''}
                ${r.texte ? ' · texte' : ''}</span></td>
            <td style="text-align:right">${statut(r.statut)}</td>
            <td style="text-align:right">${r.statut !== 'publie'
              ? `<button class="lien" data-pub-r="${r.id}">publier</button>`
              : `<button class="lien" data-ret-r="${r.id}">retirer</button>`}</td>
          </tr>`).join('')}
        </tbody></table>
      </div>`).join('');

    document.querySelectorAll('[data-pub-r]').forEach(b => b.onclick = async () => {
      await db.from('ressources').update({ statut:'publie', publie_le:new Date().toISOString() })
        .eq('id', b.dataset.pubR);
      signal('Ressource publiée.', 'bien'); charger();
    });
    document.querySelectorAll('[data-ret-r]').forEach(b => b.onclick = async () => {
      await db.from('ressources').update({ statut:'brouillon' }).eq('id', b.dataset.retR);
      signal('Ressource retirée.', 'info'); charger();
    });
  };

  document.getElementById('r-publier').onclick   = () => enregistrer(true);
  document.getElementById('r-brouillon').onclick = () => enregistrer(false);
  charger();
}


/* ---------- file de validation ---------- */
async function vueValidation(){
  $('#vue').innerHTML = `
    <h2 class="titre">File de validation</h2>
    <p class="sous">Le filet de sécurité : tout ce qui a été déposé sans être publié directement atterrit ici. En temps normal, cette file reste vide.</p>
    <div class="bloc" id="file">Chargement…</div>`;

  const { data, error } = await db.from('propositions_ia')
    .select('*').eq('statut','a_valider').order('cree_le').limit(50);
  if(error) return erreur(error, 'Lecture impossible');

  const z = document.getElementById('file');
  if(!data.length){
    z.innerHTML = `<div class="vide">La file est vide.<br>C'est l'état normal : vos imports partent directement en ligne.</div>`;
    return;
  }

  z.innerHTML = data.map(p => {
    const c = p.contenu || {};
    const options = (c.options || []).map((o,i) => `
      <div class="option-prop ${o.est_correcte ? 'juste' : ''}">
        <span class="l">${'abcd'[i] || (i+1)}</span><span>${o.texte || ''}</span></div>`).join('');
    const justes = (c.options || []).filter(o => o.est_correcte).length;
    return `
      <div class="proposition" data-prop="${p.id}">
        <div class="rangee">
          ${statut(p.statut)}
          <span class="num" style="font-size:11px;color:var(--craie2)">confiance ${Math.round((p.confiance ?? 0)*100)} %</span>
        </div>
        <div class="enonce">${c.enonce || '(énoncé manquant)'}</div>
        <div class="options-prop">${options || '<div class="option-prop">Aucune proposition</div>'}</div>
        ${justes === 0 ? '<div class="doublon">Aucune bonne réponse cochée — vérifiez avant de publier.</div>' : ''}
        <div class="meta-prop">
          <span>Matière : ${nomMatiere(c.matiere_id)}</span>
          <span>Niveau : ${c.niveau || '—'}</span>
          <span>Session : ${c.annee_session || '—'}</span>
          <span>Bonnes réponses : ${justes}</span>
        </div>
        ${c.explication ? `<p class="sous" style="margin:0 0 12px">${c.explication}</p>` : ''}
        <div class="actions">
          <button class="b-publier" data-action="publier">Valider et publier</button>
          <button class="b-valider" data-action="valider">Valider sans publier</button>
          <button class="b-rejeter" data-action="rejeter">Rejeter</button>
        </div>
      </div>`;
  }).join('');

  z.querySelectorAll('[data-action]').forEach(b => {
    b.onclick = () => traiterProposition(
      b.closest('[data-prop]').dataset.prop, b.dataset.action);
  });
}

async function traiterProposition(id, action){
  try{
    if(action === 'rejeter'){
      const { error } = await db.from('propositions_ia')
        .update({ statut:'rejetee', valide_par:A.session.user.id, valide_le:new Date().toISOString() })
        .eq('id', id);
      if(error) throw error;
      signal('Proposition rejetée.', 'info');
    }else{
      const { error } = await db.rpc('valider_proposition_question', {
        p_proposition: id, p_publier: action === 'publier'
      });
      if(error) throw error;
      signal(action === 'publier'
        ? 'Question publiée : elle est désormais visible par les candidats.'
        : 'Question enregistrée en attente de publication.', 'bien');
    }
    vueValidation();
  }catch(e){ erreur(e, 'Traitement impossible'); }
}

/* ---------- questions ---------- */
async function vueQuestions(){
  $('#vue').innerHTML = `
    <h2 class="titre">Questions</h2>
    <p class="sous">La banque complète. Seules les questions publiées sont proposées aux candidats.</p>
    <div class="bloc">
      <div class="libelle">Filtrer</div>
      <div class="rangee">
        <select id="f-statut" style="width:auto;margin:0">
          <option value="">Tous les états</option>
          <option value="publie">Publiées</option>
          <option value="en_validation">En validation</option>
          <option value="brouillon">Brouillons</option>
        </select>
        <select id="f-matiere" style="width:auto;margin:0">
          <option value="">Toutes les matières</option>${optionsMatieres()}</select>
      </div>
    </div>
    <div class="bloc"><div class="carte" id="tableau">Chargement…</div></div>`;

  const charger = async () => {
    let r = db.from('questions')
      .select('id, enonce, statut, niveau, matiere_id, annee_session, cree_le')
      .order('cree_le', { ascending:false }).limit(100);
    const s = document.getElementById('f-statut').value;
    const m = document.getElementById('f-matiere').value;
    if(s) r = r.eq('statut', s);
    if(m) r = r.eq('matiere_id', m);

    const { data, error } = await r;
    if(error) return erreur(error, 'Lecture impossible');

    document.getElementById('tableau').innerHTML = data.length
      ? `<table><thead><tr><th>Énoncé</th><th>Matière</th><th>Niveau</th><th>État</th><th></th></tr></thead><tbody>
         ${data.map(q => `<tr>
            <td>${q.enonce}</td>
            <td>${nomMatiere(q.matiere_id)}</td>
            <td>${q.niveau || '—'}</td>
            <td>${statut(q.statut)}</td>
            <td>${q.statut !== 'publie'
              ? `<button class="lien" data-publier="${q.id}">publier</button>`
              : `<button class="lien" data-retirer-q="${q.id}">retirer</button>`}</td>
          </tr>`).join('')}
         </tbody></table>`
      : `<div class="vide">Aucune question ne correspond.</div>`;

    document.querySelectorAll('[data-publier]').forEach(b => b.onclick = async () => {
      const { error } = await db.from('questions')
        .update({ statut:'publie', publie_le:new Date().toISOString() }).eq('id', b.dataset.publier);
      if(error) return erreur(error, 'Publication impossible');
      signal('Question publiée.', 'bien'); charger();
    });
    document.querySelectorAll('[data-retirer-q]').forEach(b => b.onclick = async () => {
      const { error } = await db.from('questions')
        .update({ statut:'en_validation' }).eq('id', b.dataset.retirerQ);
      if(error) return erreur(error, 'Retrait impossible');
      signal('Question retirée de la publication.', 'info'); charger();
    });
  };

  document.getElementById('f-statut').onchange = charger;
  document.getElementById('f-matiere').onchange = charger;
  charger();
}

/* ---------- actualités ---------- */
async function vueActualites(){
  $('#vue').innerHTML = `
    <h2 class="titre">Actualités</h2>
    <p class="sous">Le bulletin du matin. Seules les informations utiles au concours doivent entrer : grandes décisions, organisations, dates, chiffres.</p>

    <div class="bloc">
      <div class="libelle">Nouvelle information</div>
      <div class="carte">
        <label for="a-titre">Titre</label>
        <input id="a-titre" placeholder="Épreuves écrites confirmées du 15 au 22 juillet">
        <div class="deux">
          <div><label for="a-cat">Catégorie</label>
            <select id="a-cat"><option value="national">National</option>
              <option value="international">International</option></select></div>
          <div><label for="a-source">Source</label>
            <input id="a-source" placeholder="Conseil des ministres"></div>
        </div>
        <label for="a-contenu">Contenu</label>
        <textarea id="a-contenu" placeholder="Deux ou trois phrases, pas plus."></textarea>
        <label for="a-pourquoi">Pourquoi c'est au programme</label>
        <input id="a-pourquoi" placeholder="Date officielle · tombe presque chaque année">
        <div class="rangee">
          <label style="display:flex;align-items:center;gap:9px;text-transform:none;
            font-family:var(--b);font-size:14px;letter-spacing:0;color:var(--craie);margin:0">
            <input type="checkbox" id="a-verifiee" style="width:auto;margin:0"> Information vérifiée
          </label>
        </div>
        <div class="actions" style="margin-top:14px">
          <button class="b-publier" id="a-publier">Publier maintenant</button>
          <button class="b-valider" id="a-brouillon">Enregistrer en brouillon</button>
        </div>
      </div>
    </div>

    <div class="bloc">
      <div class="libelle">Publiées et en attente</div>
      <div class="carte" id="liste-actu">Chargement…</div>
    </div>`;

  const enregistrer = async (publier) => {
    const titre = document.getElementById('a-titre').value.trim();
    if(!titre) return signal('Le titre est obligatoire.', 'mal');

    const { error } = await db.from('actualites').insert({
      titre,
      contenu:   document.getElementById('a-contenu').value.trim(),
      categorie: document.getElementById('a-cat').value,
      source:    document.getElementById('a-source').value.trim(),
      pourquoi:  document.getElementById('a-pourquoi').value.trim(),
      verifiee:  document.getElementById('a-verifiee').checked,
      statut:    publier ? 'publie' : 'brouillon',
      publie_le: publier ? new Date().toISOString() : null,
      auteur:    A.session.user.id
    });
    if(error) return erreur(error, 'Enregistrement impossible');

    ['a-titre','a-contenu','a-source','a-pourquoi'].forEach(i => document.getElementById(i).value = '');
    document.getElementById('a-verifiee').checked = false;
    signal(publier ? 'Actualité publiée.' : 'Brouillon enregistré.', 'bien');
    charger();
  };

  const charger = async () => {
    const { data, error } = await db.from('actualites')
      .select('*').order('cree_le', { ascending:false }).limit(40);
    if(error) return erreur(error, 'Lecture impossible');

    document.getElementById('liste-actu').innerHTML = data.length
      ? `<table><thead><tr><th>Titre</th><th>Catégorie</th><th>État</th><th></th></tr></thead><tbody>
         ${data.map(a => `<tr>
            <td>${a.titre}<br><span class="num" style="font-size:11px;color:var(--craie2)">${a.source || '—'} · ${dateCourte(a.cree_le)}</span></td>
            <td>${a.categorie}</td><td>${statut(a.statut)}</td>
            <td>${a.statut !== 'publie'
              ? `<button class="lien" data-pub-a="${a.id}">publier</button>`
              : `<button class="lien" data-ret-a="${a.id}">retirer</button>`}</td>
          </tr>`).join('')}</tbody></table>`
      : `<div class="vide">Aucune actualité pour l'instant.</div>`;

    document.querySelectorAll('[data-pub-a]').forEach(b => b.onclick = async () => {
      await db.from('actualites').update({ statut:'publie', publie_le:new Date().toISOString() })
        .eq('id', b.dataset.pubA);
      signal('Actualité publiée.', 'bien'); charger();
    });
    document.querySelectorAll('[data-ret-a]').forEach(b => b.onclick = async () => {
      await db.from('actualites').update({ statut:'brouillon' }).eq('id', b.dataset.retA);
      signal('Actualité retirée.', 'info'); charger();
    });
  };

  document.getElementById('a-publier').onclick   = () => enregistrer(true);
  document.getElementById('a-brouillon').onclick = () => enregistrer(false);
  charger();
}

/* ---------- référentiel ---------- */
async function vueReferentiel(){
  await chargerReferentiel();
  $('#vue').innerHTML = `
    <h2 class="titre">Référentiel</h2>
    <p class="sous">Les concours, les matières et les chapitres. Tout le contenu s'y rattache : mieux vaut le poser proprement une fois pour toutes.</p>

    <div class="bloc">
      <div class="libelle">Concours<span class="num">${A.ref.concours.length}</span></div>
      <div class="carte">
        <table><tbody>${A.ref.concours.map(c => `<tr>
          <td><b>${c.nom}</b><br><span class="num" style="font-size:11px;color:var(--craie2)">${c.niveau_requis || '—'}</span></td>
          <td style="text-align:right">${c.actif ? statut('publie') : statut('brouillon')}</td>
        </tr>`).join('')}</tbody></table>
      </div>
    </div>

    <div class="bloc">
      <div class="libelle">Matières<span class="num">${A.ref.matieres.length}</span></div>
      <div class="carte">
        <table><tbody>${A.ref.matieres.map(m => `<tr>
          <td><b>${m.nom}</b></td>
          <td class="num" style="color:var(--craie2)">${m.code || ''}</td>
          <td style="text-align:right" class="num">${A.ref.chapitres.filter(c => c.matiere_id === m.id).length} chapitres</td>
        </tr>`).join('')}</tbody></table>
      </div>
    </div>

    <div class="bloc">
      <div class="libelle">Ajouter un chapitre</div>
      <div class="carte">
        <div class="deux">
          <div><label for="c-matiere">Matière</label><select id="c-matiere">${optionsMatieres()}</select></div>
          <div><label for="c-niveau">Niveau</label><select id="c-niveau">${optionsNiveaux('terminale')}</select></div>
        </div>
        <label for="c-nom">Nom du chapitre</label>
        <input id="c-nom" placeholder="Les institutions de la Ve République">
        <button class="cta vert petit" id="c-ajouter">Ajouter</button>
      </div>
    </div>`;

  document.getElementById('c-ajouter').onclick = async () => {
    const nom = document.getElementById('c-nom').value.trim();
    if(!nom) return signal('Donnez un nom au chapitre.', 'mal');
    const { error } = await db.from('chapitres').insert({
      matiere_id: document.getElementById('c-matiere').value,
      niveau:     document.getElementById('c-niveau').value,
      nom
    });
    if(error) return erreur(error, 'Ajout impossible');
    signal('Chapitre ajouté.', 'bien');
    vueReferentiel();
  };
}

/* ---------- journal ---------- */
async function vueJournal(){
  $('#vue').innerHTML = `
    <h2 class="titre">Journal</h2>
    <p class="sous">Qui a validé quoi, et quand. Le jour où une erreur passe, c'est ici qu'on remonte à sa source.</p>
    <div class="bloc"><div class="carte" id="j">Chargement…</div></div>`;

  const { data, error } = await db.from('journal_activite')
    .select('*').order('cree_le', { ascending:false }).limit(80);
  if(error) return erreur(error, 'Lecture impossible');

  document.getElementById('j').innerHTML = data.length
    ? `<table><thead><tr><th>Quand</th><th>Action</th><th>Cible</th></tr></thead><tbody>
       ${data.map(l => `<tr><td class="num">${dateHeure(l.cree_le)}</td>
         <td>${(l.action || '').replace(/_/g,' ')}</td>
         <td class="num" style="color:var(--craie2)">${l.table_cible || '—'}</td></tr>`).join('')}
       </tbody></table>`
    : `<div class="vide">Le journal est vide pour l'instant.</div>`;
}

/* ============================================================
   ÉVÉNEMENTS
   ============================================================ */
document.getElementById('btn-connexion').onclick = connexion;
document.getElementById('motdepasse').addEventListener('keydown',
  e => { if(e.key === 'Enter') connexion(); });

document.getElementById('btn-deconnexion').onclick = async () => {
  await db.auth.signOut();
  location.reload();
};

document.getElementById('menu').addEventListener('click', e => {
  const b = e.target.closest('[data-vue]');
  if(!b) return;
  A.vue = b.dataset.vue;
  rendre();
});

demarrer();
