/* ============================================================
   MON CONCOURS · administration
   Encapsulé : aucun conflit possible avec un autre script.
   ============================================================ */
(function(){
'use strict';

/* ============================================================
   MON CONCOURS · connexion à la base
   Ces clés sont publiques par nature : la sécurité repose
   sur les règles RLS de la base, pas sur le secret de la clé.
   ============================================================ */

const SUPABASE_URL = 'https://uonhpsumbfuahipbdjnu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvbmhwc3VtYmZ1YWhpcGJkam51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMjg1MTQsImV4cCI6MjEwMTcwNDUxNH0.UR2CSJaK0AyyIRDzDBoALcU7OeE9SdQESHI9ASZMYIk';

/* ------------------------------------------------------------
   La connexion est créée avec précaution : si la bibliothèque
   n'est pas arrivée, on le dit à l'écran au lieu de tout arrêter.
   ------------------------------------------------------------ */
let db = null;
let panne = null;
/* un lien « mot de passe oublié » ramène ici avec ce marqueur dans l'adresse */
const RECUPERATION = /type=recovery/.test(location.hash || '');

try{
  if(typeof supabase === 'undefined' || !supabase.createClient){
    panne = "La bibliothèque Supabase n'a pas pu être téléchargée. "
          + "Vérifiez votre connexion, ou réessayez dans un instant.";
  }else{
    db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
  }
}catch(e){
  panne = "Connexion à la base impossible : " + (e && e.message ? e.message : e);
}

function afficherPanne(){
  const z = document.getElementById('err-connexion');
  if(z && panne){ z.textContent = panne; z.hidden = false; }
  const v = document.getElementById('version');
  if(v && panne) v.textContent = 'bibliothèque absente';
}

/* --- petits utilitaires partagés --- */
/* Tout texte venu de la base (noms de candidats, statistiques de visite,
   contenus importés) passe par E() avant d'entrer dans la page. */
function E(v){
  if(v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

function nombre(n){ return (n ?? 0).toLocaleString('fr-FR'); }

function dateCourte(iso){
  if(!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR',
    { timeZone:'Africa/Ouagadougou', day:'numeric', month:'long', year:'numeric' });
}

function dateHeure(iso){
  if(!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR',
    { timeZone:'Africa/Ouagadougou', day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

function octets(n){
  if(!n) return '—';
  if(n < 1024) return n + ' o';
  if(n < 1048576) return (n/1024).toFixed(0) + ' Ko';
  return (n/1048576).toFixed(1) + ' Mo';
}

/* messages en haut de l'écran */
function signal(texte, type){
  const z = document.getElementById('signal');
  if(!z) return;
  z.textContent = texte;
  z.className = 'signal vu ' + (type || 'info');
  clearTimeout(z._t);
  z._t = setTimeout(() => z.className = 'signal', 4200);
}

/* toute erreur remontée par la base passe par ici */
function erreur(e, contexte){
  console.error(contexte || '', e);
  const m = e?.message || 'erreur inconnue';
  /* un délai dépassé n'est pas une panne : on le dit simplement, avec la marche à suivre */
  if(/statement timeout|timeout|Failed to fetch|NetworkError|Load failed/i.test(m)){
    signal('Le serveur a mis trop de temps à répondre. Touchez « Actualiser » en haut pour réessayer.', 'mal');
    return;
  }
  signal((contexte ? contexte + ' : ' : '') + m, 'mal');
}

/* ============================================================
   MON CONCOURS · administration
   ============================================================ */

const A = {
  session: null,
  profil: null,
  equipe: false,
  vue: 'tableau',
  ref: { matieres: [], concours: [], chapitres: [] },
  aValider: 0
};

/* ============================================================
   CONNEXION
   ============================================================ */
const VERSION = 'v10 · tableau de bord';

async function demarrer(){
  const rep = document.getElementById('version');
  if(rep) rep.textContent = VERSION;

  if(!db){ afficherPanne(); return; }

  const { data } = await db.auth.getSession();
  if(RECUPERATION && data.session){ formulaireNouveauMotDePasse(); }
  else if(data.session){ await entrer(data.session); }
  else { document.getElementById('portail').hidden = false; }

  db.auth.onAuthStateChange((evenement, session) => {
    if(evenement === 'PASSWORD_RECOVERY'){ formulaireNouveauMotDePasse(); return; }
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
  A.admin = (roles || []).some(r => r.role === 'admin');
  A.investisseur = !A.equipe && (roles || []).some(r => r.role === 'investisseur');
  if(!A.equipe && !A.investisseur){
    return refuser("Ce compte n'a pas les droits d'administration. Attribuez-lui le rôle « admin » dans la table roles_utilisateur.");
  }

  const { data: profil } = await db
    .from('profils').select('nom').eq('id', session.user.id).maybeSingle();
  A.profil = profil;

  document.getElementById('portail').hidden = true;
  document.getElementById('admin').hidden = false;
  window.scrollTo(0, 0);
  document.getElementById('qui').textContent =
    (profil?.nom || (A.investisseur ? 'Investisseur' : session.user.email)) + (A.investisseur ? ' · investisseur' : ' · équipe');   // textContent : pas d'interprétation HTML

  if(A.investisseur){
    document.body.classList.add('mode-investisseur');
    /* l'investisseur a tout l'espace d'administration, sauf « Mon accès » */
    $$('#menu [data-vue="acces"]').forEach(b => b.remove());
    const bienvenue = document.getElementById('bienvenue');
    if(bienvenue) bienvenue.hidden = false;
  }
  await chargerReferentiel();
  const h0 = (location.hash || '').replace('#', '');
  if(h0 && document.querySelector('#menu [data-vue="' + h0.replace(/[^a-z_]/g, '') + '"]')) A.vue = h0.replace(/[^a-z_]/g, '');
  rendre();
  majPastilles();
  if(window.ADMIN && window.ADMIN.apresEntree) window.ADMIN.apresEntree();
}
/* les pastilles du menu (à valider, au dépôt), quelle que soit la page ouverte */
async function majPastilles(){
  const [p, dep, av] = await Promise.all([
    db.from('propositions_ia').select('id', { count:'exact', head:true }).eq('statut','a_valider'),
    db.from('depots').select('id', { count:'exact', head:true }).eq('statut','a_ranger'),
    db.from('avis').select('id', { count:'exact', head:true }).eq('statut','nouveau')
  ]);
  const pv = document.getElementById('pastille-validation'), pd = document.getElementById('pastille-depot'), pa = document.getElementById('pastille-avis');
  if(pv){ pv.hidden = !p.count; pv.textContent = p.count || ''; }
  if(pd){ pd.hidden = !dep.count; pd.textContent = dep.count || ''; }
  if(pa){ pa.hidden = !av.count; pa.textContent = av.count || ''; }
}

function refuser(message){
  const z = document.getElementById('err-connexion');
  z.textContent = message; z.hidden = false;
  document.getElementById('portail').hidden = false;
  document.getElementById('admin').hidden = true;
  db.auth.signOut();
}

/* « investisseur Jules » devient l'adresse technique du compte ; une vraie adresse reste telle quelle */
function identifiantVersEmail(v){
  v = String(v || '').trim().toLowerCase();
  if(!v || v.includes('@')) return v;
  return v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '') + '@candidat.monconcours.bf';
}
async function connexion(){
  const bouton = document.getElementById('btn-connexion');
  const email  = identifiantVersEmail(document.getElementById('email').value);
  const mdp    = document.getElementById('motdepasse').value;
  const z      = document.getElementById('err-connexion');
  z.hidden = true;

  if(!email || !mdp){
    z.textContent = 'Saisissez votre identifiant et votre mot de passe.'; z.hidden = false; return;
  }

  bouton.disabled = true; bouton.textContent = 'Connexion…';
  try{
    const { data, error } = await db.auth.signInWithPassword({ email, password: mdp });
    if(error){
      z.textContent = error.message === 'Invalid login credentials'
        ? "Identifiant ou mot de passe incorrect. Attention aux majuscules."
        : error.message;
      z.hidden = false;
      return;
    }
    await entrer(data.session);
  }catch(e){
    z.textContent = "Impossible de joindre le serveur : " + (e?.message || e);
    z.hidden = false;
  }finally{
    bouton.disabled = false; bouton.textContent = 'Me connecter';
  }
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
  .map(m => `<option value="${E(m.id)}" ${sel===m.id?'selected':''}>${E(m.nom)}</option>`).join('');
const optionsConcours = (sel) => A.ref.concours
  .map(c => `<option value="${E(c.id)}" ${sel===c.id?'selected':''}>${E(c.nom)}</option>`).join('');
const nomMatiere = id => A.ref.matieres.find(m => m.id === id)?.nom || '—';

const NIVEAUX = [['troisieme','Troisième'],['terminale','Terminale'],['licence','Licence']];
const optionsNiveaux = (sel) => NIVEAUX
  .map(([v,l]) => `<option value="${v}" ${sel===v?'selected':''}>${l}</option>`).join('');

const statut = s => `<span class="marque-statut s-${E(s)}">${E((s||'').replace(/_/g,' '))}</span>`;

/* ============================================================
   RENDU
   ============================================================ */
function rendre(){
  $$('#menu button').forEach(b => b.classList.toggle('on', b.dataset.vue === A.vue));
  const plus = window.ADMIN && window.ADMIN.vues && window.ADMIN.vues[A.vue];
  if(plus){ try{ history.replaceState(null, '', '#' + A.vue); }catch(e){} $('#vue').scrollTop = 0; plus(); return; }
  try{ history.replaceState(null, '', '#' + A.vue); }catch(e){}
  ({ tableau:vueTableau, bannissement:vueBannissement, acces:vueAcces, apercu:vueApercu, analyse:vueAnalyse, direct:vueDirect, comportement:vueComportement,
     pedagogie:vuePedagogie, candidats:vueCandidats,
     depot:vueDepot, import:vueImport, bibliotheque:vueBibliotheque,
     validation:vueValidation, questions:vueQuestions, sujets:vueSujets, actualites:vueActualites,
     referentiel:vueReferentiel, journal:vueJournal, musique:vueMusique, paiements:vuePaiements,
     collectives:vueCollectives, signalements:vueSignalements, avis:vueAvis, indicateurs:vueIndicateurs, propositions:vuePropositions }[A.vue] || vueTableau)();
  $('#vue').scrollTop = 0;
}

/* ---------- musique de travail ---------- */
async function vueMusique(){
  const { data: pistes } = await db.from('musiques')
    .select('*').order('ordre').limit(50);

  $('#vue').innerHTML = `
  <div class="entete-vue">
    <h2>Musique de travail</h2>
    <p>Les pistes proposées au candidat pendant qu'il révise. Choisissez des morceaux
       calmes et sans paroles : la musique accompagne le travail, elle ne le couvre pas.
       Format MP3 ou M4A, 15 Mo maximum par fichier.</p>
  </div>

  <div class="carte">
    <h3>Ajouter une piste</h3>
    <div class="grille-champs">
      <label>Titre<input id="mus-titre" placeholder="Pluie sur la cour"></label>
      <label>Artiste (facultatif)<input id="mus-artiste" placeholder="Nom de l'artiste"></label>
      <label>Ordre<input id="mus-ordre" type="number" value="${(pistes||[]).length + 1}" min="1"></label>
      <label>Fichier audio<input id="mus-fichier" type="file" accept="audio/*"></label>
    </div>
    <button class="bouton" id="mus-envoyer">Envoyer et publier</button>
    <p class="aide" id="mus-etat"></p>
  </div>

  <div class="carte">
    <h3>Pistes en ligne <span class="compte">${(pistes||[]).length}</span></h3>
    ${!(pistes||[]).length ? '<p class="vide">Aucune piste pour le moment. Le bouton musique reste sans effet cote candidat.</p>' : `
    <table class="tableau">
      <thead><tr><th>Ordre</th><th>Titre</th><th>Artiste</th><th>Etat</th><th></th></tr></thead>
      <tbody>${pistes.map(m => `
        <tr>
          <td>${m.ordre}</td>
          <td><b>${(m.titre||'').replace(/</g,'&lt;')}</b></td>
          <td>${(m.artiste||'—').replace(/</g,'&lt;')}</td>
          <td>${m.statut === 'publie' ? '<span class="etat ok">En ligne</span>' : '<span class="etat">Brouillon</span>'}</td>
          <td>
            <button class="mini" data-mus-bascule="${E(m.id)}" data-statut="${E(m.statut)}">
              ${m.statut === 'publie' ? 'Retirer' : 'Publier'}</button>
            <button class="mini danger" data-mus-suppr="${E(m.id)}" data-chemin="${E(m.fichier_chemin)}">Supprimer</button>
          </td>
        </tr>`).join('')}</tbody>
    </table>`}
  </div>`;

  $('#mus-envoyer').onclick = async () => {
    const titre = $('#mus-titre').value.trim();
    const f = $('#mus-fichier').files[0];
    const etat = $('#mus-etat');
    if(!titre || !f){ etat.textContent = 'Un titre et un fichier sont necessaires.'; return; }
    if(f.size > 15 * 1024 * 1024){ etat.textContent = 'Fichier trop lourd : 15 Mo maximum.'; return; }
    etat.textContent = 'Envoi en cours…';
    const nom = Date.now() + '-' + f.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const { error: e1 } = await db.storage.from('musiques').upload(nom, f, { upsert:false });
    if(e1){ etat.textContent = "Échec de l'envoi : " + e1.message; return; }
    const { error: e2 } = await db.from('musiques').insert({
      titre, artiste: $('#mus-artiste').value.trim() || null,
      fichier_chemin: nom, ordre: parseInt($('#mus-ordre').value, 10) || 1,
      statut: 'publie'
    });
    if(e2){ etat.textContent = 'Enregistrement refuse : ' + e2.message; return; }
    etat.textContent = 'Piste en ligne.';
    vueMusique();
  };

  $$('[data-mus-bascule]').forEach(b => b.onclick = async () => {
    await db.from('musiques')
      .update({ statut: b.dataset.statut === 'publie' ? 'brouillon' : 'publie', maj_le: new Date().toISOString() })
      .eq('id', b.dataset.musBascule);
    vueMusique();
  });

  $$('[data-mus-suppr]').forEach(b => b.onclick = async () => {
    if(!confirm('Supprimer définitivement cette piste ?')) return;
    await db.storage.from('musiques').remove([b.dataset.chemin]);
    await db.from('musiques').delete().eq('id', b.dataset.musSuppr);
    vueMusique();
  });
}

/* ---------- paiements ---------- */
const NOM_PASS = { semaine:'Pass Semaine', mensuelle:'Pass Mois', annuelle:'Pass Année' };
const NOM_OPERATEUR = { orange_money:'Orange Money', moov_money:'Moov Money', wave:'Wave', code:'Code', admin:'Activé par l\'équipe' };
async function vuePaiements(){
  $('#vue').innerHTML = `
  <div class="entete-vue">
    <h2>Paiements</h2>
    <p>Chaque demande doit être vérifiée avant confirmation. Ouvrez la preuve, comparez
       le nom et le montant, puis confirmez ou refusez. La confirmation active
       immédiatement l'abonnement du candidat.</p>
  </div>
  <div id="pai-plus"></div>
  <div class="carte"><h3 style="margin:0 0 8px">Toutes les demandes, une par une</h3><div id="pai-liste">Chargement…</div></div>
  <div class="carte" style="margin-top:14px">
    <h3 style="margin:0 0 6px">Activer un Pass par numéro</h3>
    <p style="margin:0 0 10px;color:var(--craie2);font-size:13px">Quand un proche a payé pour le candidat : indiquez le numéro de son compte Mon Concours et le Pass payé.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <input id="act-tel" type="tel" inputmode="numeric" placeholder="Numéro du compte (8 chiffres)" maxlength="12" style="min-width:200px">
      <select id="act-formule"><option value="semaine">Pass Semaine · 500 F</option><option value="mensuelle" selected>Pass Mois · 1 000 F</option><option value="annuelle">Pass Année · 4 000 F</option></select>
      <input id="act-note" type="text" placeholder="Note (qui a payé ?)" style="min-width:180px">
      <button class="mini" id="act-go">Activer</button>
    </div>
    <p id="act-msg" style="margin:8px 0 0;font-size:13px"></p>
  </div>
  <div class="carte" style="margin-top:14px">
    <h3 style="margin:0 0 6px">Codes d'accès</h3>
    <p style="margin:0 0 10px;color:var(--craie2);font-size:13px">Un code ouvre un Pass une seule fois. Pour les relais et les offres.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <select id="cod-formule"><option value="semaine">Pass Semaine</option><option value="mensuelle" selected>Pass Mois</option><option value="annuelle">Pass Année</option></select>
      <input id="cod-nb" type="number" min="1" max="100" value="5" style="width:80px">
      <input id="cod-note" type="text" placeholder="Note (relais, lot…)" style="min-width:180px">
      <button class="mini" id="cod-go">Créer les codes</button>
    </div>
    <pre id="cod-sortie" style="margin:10px 0 0;white-space:pre-wrap;font-size:13px"></pre>
    <div id="cod-liste" style="margin-top:10px"></div>
  </div>`;

  if(window.ADMIN && window.ADMIN.paiementsPlus) window.ADMIN.paiementsPlus($('#pai-plus'), vuePaiements);
  $('#act-go').onclick = async () => {
    const msg = $('#act-msg'); msg.textContent = '…';
    const { data, error } = await db.rpc('admin_activer_pass', { p_telephone: $('#act-tel').value, p_formule: $('#act-formule').value, p_note: $('#act-note').value });
    msg.textContent = error ? error.message : (data && data.ok ? 'Pass activé pour ' + (data.nom || 'le candidat') + ', valable jusqu\'au ' + new Date(data.fin_le).toLocaleDateString('fr-FR') + '. Le candidat est prévenu.' : (data && data.message) || 'Échec.');
    if(data && data.ok) vuePaiements();
  };
  $('#cod-go').onclick = async () => {
    const { data, error } = await db.rpc('admin_creer_codes', { p_formule: $('#cod-formule').value, p_nombre: +$('#cod-nb').value || 1, p_note: $('#cod-note').value });
    if(error || !data || !data.ok){ $('#cod-sortie').textContent = (data && data.message) || (error && error.message) || 'Échec.'; return; }
    $('#cod-sortie').textContent = data.codes.join('\n');
    chargerCodes();
  };
  async function chargerCodes(){
    const { data } = await db.rpc('admin_liste_codes');
    const l = data || [];
    $('#cod-liste').innerHTML = l.length ? `<table class="tableau"><thead><tr><th>Code</th><th>Pass</th><th>Note</th><th>Créé le</th><th>Utilisé</th></tr></thead><tbody>${l.map(c => `<tr>
      <td><code>${E(c.code)}</code></td><td>${E(NOM_PASS[c.formule] || c.formule)}</td><td>${E(c.note || '')}</td><td>${dateHeure(c.cree_le)}</td>
      <td>${c.utilise_le ? E((c.utilise_par || 'oui') + ' · ' + dateHeure(c.utilise_le)) : '—'}</td></tr>`).join('')}</tbody></table>` : '';
  }
  chargerCodes();

  const { data, error } = await db.rpc('paiements_en_attente');
  const zone = $('#pai-liste');
  if(error){ zone.innerHTML = '<p class="vide">Erreur de chargement : ' + E(error.message) + '</p>'; return; }

  const liste = data || [];
  if(!liste.length){ zone.innerHTML = '<p class="vide">Aucune demande de paiement pour le moment.</p>'; return; }

  const statutLabel = { en_attente:'<span class="etat">En attente</span>',
    confirme:'<span class="etat ok">Confirmé</span>', refuse:'<span class="etat danger">Refusé</span>' };

  zone.innerHTML = `<table class="tableau">
    <thead><tr><th>Candidat</th><th>Numéro</th><th>Pass · moyen</th><th>Montant</th><th>Capture</th><th>Statut</th><th>Reçu le</th><th></th></tr></thead>
    <tbody>${liste.map(p => `
      <tr>
        <td><b${p.user_id ? ` class="cliquable" data-fiche="${E(p.user_id)}"` : ''}>${E(p.nom || '—')}</b><br><span style="color:var(--craie2);font-size:12px">${E(p.nom_compte||'')}</span></td>
        <td>${p.user_id ? `<span class="cliquable" data-fiche="${E(p.user_id)}">${E(p.telephone || '—')}</span>` : E(p.telephone || '—')}</td>
        <td>${E(NOM_PASS[p.formule] || 'Pass')}<br><span style="color:var(--craie2);font-size:12px">${E(NOM_OPERATEUR[p.operateur] || p.operateur || '')}</span></td>
        <td>${nombre(p.montant)} F</td>
        <td>${p.preuve_chemin ? `<button class="mini" data-pai-voir="${E(p.preuve_chemin)}">Voir</button>` : '—'}</td>
        <td>${statutLabel[p.statut] || E(p.statut)}</td>
        <td>${dateHeure(p.cree_le)}</td>
        <td>${p.statut === 'en_attente' ? `
          <button class="mini" data-pai-confirmer="${E(p.id)}">Confirmer</button>
          <button class="mini danger" data-pai-refuser="${E(p.id)}">Refuser</button>` : (p.statut === 'confirme' ? `<button class="mini" data-pai-recu="${E(p.id)}">Reçu</button>` : '')}</td>
      </tr>`).join('')}</tbody>
  </table>`;

  $$('[data-pai-voir]').forEach(b => b.onclick = async () => {
    const { data: url } = await db.storage.from('preuves-paiement')
      .createSignedUrl(b.dataset.paiVoir, 300);
    if(!(url && url.signedUrl)){ alert("Impossible d'ouvrir cette capture."); return; }
    /* la capture s'affiche sur la page, à côté des boutons de décision */
    const v = document.createElement('div');
    v.style.cssText = 'position:fixed;inset:0;z-index:99;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;padding:16px';
    v.innerHTML = '<div style="max-width:560px;width:100%;max-height:92vh;overflow:auto;background:#fff;border-radius:12px;padding:10px"><img src="' + url.signedUrl + '" alt="Capture du paiement" style="width:100%;display:block"><button class="mini" style="margin-top:8px" id="fermer-capture">Fermer</button></div>';
    document.body.appendChild(v);
    v.onclick = e => { if(e.target === v || e.target.id === 'fermer-capture') v.remove(); };
  });

  $$('[data-pai-confirmer]').forEach(b => b.onclick = async () => {
    b.disabled = true;
    const { data, error } = await db.rpc('confirmer_paiement', { p_id: b.dataset.paiConfirmer, p_confirme: true });
    if(error || !data || !data.ok){ alert((data && data.message) || (error && error.message) || 'Échec.'); b.disabled = false; return; }
    vuePaiements();
  });

  $$('[data-pai-refuser]').forEach(b => b.onclick = async () => {
    const motif = prompt('Motif du refus (le candidat le lira) :', 'Le montant ou le nom sur la capture ne correspond pas. Écrivez-nous sur WhatsApp.');
    if(motif === null) return;
    b.disabled = true;
    const { data, error } = await db.rpc('confirmer_paiement', { p_id: b.dataset.paiRefuser, p_confirme: false, p_motif: motif.trim() || null });
    if(error || !data || !data.ok){ alert((data && data.message) || (error && error.message) || 'Échec.'); b.disabled = false; return; }
    vuePaiements();
  });

  $$('[data-pai-recu]').forEach(b => b.onclick = async () => {
    const { data, error } = await db.rpc('mon_recu', { p_id: b.dataset.paiRecu });
    if(error || !data || !data.ok) return alert((data && data.message) || 'Reçu indisponible.');
    const r = data.recu;
    alert('Reçu ' + r.numero + '\n' + r.candidat + ' · ' + r.offre + '\n' +
          (r.montant_fcfa || 0).toLocaleString('fr-FR') + ' FCFA · valable jusqu\'au ' +
          new Date(r.fin_le).toLocaleDateString('fr-FR'));
  });
}

/* ---------- vue d'ensemble ---------- */
async function vueApercu(){
  $('#vue').innerHTML = `
    <h2 class="titre">État du contenu</h2>
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
    db.rpc('candidats_page', { p_offset: 0, p_limite: 1 }).then(r => ({ count: r.data ? r.data.total : 0 })),
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
       ${docs.map(d => `<tr><td>${E(d.nom_fichier)}</td><td>${statut(d.statut)}</td>
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

    ${soucis.length ? `<div class="alerte">${soucis.slice(0,6).map(E).join('<br>')}${soucis.length>6?'<br>…':''}</div>` : ''}
    ${sansJuste ? `<div class="doublon">${sansJuste} question(s) n'ont aucune bonne réponse cochée. C'est possible — mais vérifiez que ce n'est pas un oubli d'étoile.</div>` : ''}

    ${lotPret.slice(0,5).map(q => `
      <div class="proposition">
        <div class="enonce">${E(q.enonce)}</div>
        <div class="options-prop">
          ${(q.options||[]).map((o,i) => `
            <div class="option-prop ${o.est_correcte?'juste':''}">
              <span class="l">${'abcdefgh'[i]}</span><span>${E(o.texte)}</span></div>`).join('')}
        </div>
        ${q.explication ? `<p class="sous" style="margin:0">${E(q.explication)}</p>` : ''}
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
const MODELE_ACTU = `[Titre de l'information, une ligne]
[Source précise : Conseil des ministres du JJ/MM/AAAA, décret n°…, site officiel…]
[Contenu : les faits, les dates, les chiffres]
[Pourquoi c'est au programme, une ligne — facultatif]

[Titre de l'information suivante]
[Source]
[Contenu]`;

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
          <span class="num" style="font-size:11px;color:var(--craie2)">${E(a.source || 'source non précisée')} · ${E(a.categorie)}</span></div>
        <div class="enonce" style="font-size:15px">${E(a.titre)}</div>
        ${a.contenu ? `<p class="sous" style="margin:0 0 8px">${E(a.contenu)}</p>` : ''}
        ${a.pourquoi ? `<div class="meta-prop" style="margin:0">${E(a.pourquoi)}</div>` : ''}
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
    <div class="fichier"><span class="n">${E(f.name)}</span>
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
       ${data.map(d => `<tr><td>${E(d.nom_fichier)}</td><td>${E(d.type_document || '—')}</td>
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

    <div class="bloc" id="bloc-non-publies" hidden>
      <div class="libelle">Rangés mais pas encore publiés<span class="num" id="nb-non-publies">…</span></div>
      <p class="sous" style="margin:0 0 8px">Ces fichiers ont été rangés sans être mis à la disposition des candidats. Complétez la matière et le niveau, puis publiez.</p>
      <div id="liste-non-publies"></div>
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
  listerNonPublies();
}

async function listerNonPublies(){
  const { data, error } = await db.rpc('depots_non_publies');
  const bloc = document.getElementById('bloc-non-publies'); if(!bloc || error) return;
  const l = data || [];
  bloc.hidden = !l.length;
  document.getElementById('nb-non-publies').textContent = l.length;
  const z = document.getElementById('liste-non-publies');
  z.innerHTML = l.map(d => `
    <div class="proposition" data-np="${E(d.id)}">
      <div class="enonce" style="font-size:15px">${E(d.titre || d.nom_fichier || 'Document')}</div>
      <p class="sous" style="margin:0 0 10px;font-size:12.5px">${E(d.nom_fichier || '')} · ${octets(d.taille_octets)} · déposé le ${dateCourte(d.cree_le)}</p>
      <div class="deux" style="margin-bottom:10px">
        <div><label>Type</label><select data-np-type style="margin:0">${TYPES_RESSOURCE.map(t => `<option value="${t}"${(d.nature_retenue || 'cours') === t ? ' selected' : ''}>${{cours:'Cours',exercices:'Exercices',corrige:'Corrigé',fiche:'Fiche de révision',annale:'Ancien sujet'}[t]}</option>`).join('')}</select></div>
        <div><label>Matière</label><select data-np-matiere style="margin:0"><option value="">— aucune —</option>${optionsMatieres(d.matiere_id)}</select></div>
        <div><label>Niveau</label><select data-np-niveau style="margin:0">${optionsNiveaux(d.niveau || 'terminale')}</select></div>
      </div>
      <div class="actions"><button class="b-publier" data-np-pub="${E(d.id)}">Publier dans la bibliothèque</button></div>
    </div>`).join('');
  z.querySelectorAll('[data-np-pub]').forEach(b => b.onclick = () => {
    const c = z.querySelector(`[data-np="${b.dataset.npPub}"]`), d = l.find(x => x.id === b.dataset.npPub);
    publierFichierDepot(d, { nature_retenue: c.querySelector('[data-np-type]').value, matiere_id: c.querySelector('[data-np-matiere]').value || null, niveau: c.querySelector('[data-np-niveau]').value || null }, b);
  });
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
    <div class="fichier"><span class="n">${E(f.name)}</span>
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
    <div class="proposition" data-depot="${E(d.id)}">
      <div class="rangee">
        <span class="marque-statut ${d.nature_devinee === 'inconnu' ? 's-en_attente' : 's-analyse'}">
          ${E(libelleNature(d.nature_retenue || d.nature_devinee))}</span>
        <span class="num" style="font-size:11px;color:var(--craie2)">${dateHeure(d.cree_le)}</span>
        ${d.nom_fichier ? `<span class="num" style="font-size:11px;color:var(--craie2)">${E(d.nom_fichier)} · ${octets(d.taille_octets)}</span>` : ''}
      </div>
      <div class="enonce" style="font-size:15px">${E(d.titre || (d.nom_fichier || 'Texte sans titre'))}</div>
      ${apercu ? `<p class="sous" style="margin:0 0 12px;white-space:pre-wrap">${E(apercu)}${(d.contenu||'').length > 220 ? '…' : ''}</p>` : ''}

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
          <input data-champ="annee" type="number" placeholder="2025" value="${E(d.annee_session || '')}" style="margin:0"></div>
      </div>

      <div class="actions">
        ${d.fichier_chemin ? `<button class="b-publier" data-pub-fichier="${E(d.id)}">Publier dans la bibliothèque</button>` : ''}
        ${d.contenu ? `<button class="b-publier" data-traiter="${E(d.id)}">Ranger et intégrer</button>` : ''}
        <button class="b-valider" data-classer="${E(d.id)}">Enregistrer le classement</button>
        <button class="b-modifier" data-range="${E(d.id)}">Marquer comme rangé</button>
        <button class="b-rejeter" data-ignorer="${E(d.id)}">Ignorer</button>
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

  z.querySelectorAll('[data-pub-fichier]').forEach(b => b.onclick = () => {
    const d = data.find(x => x.id === b.dataset.pubFichier);
    publierFichierDepot(d, champs(d.id), b);
  });

  z.querySelectorAll('[data-traiter]').forEach(b => b.onclick = () =>
    rangerEtIntegrer(b.dataset.traiter, data.find(x => x.id === b.dataset.traiter), champs(b.dataset.traiter)));
}

/* ---------- un fichier déposé devient une ressource de la bibliothèque, visible des candidats ---------- */
const TYPES_RESSOURCE = ['cours', 'exercices', 'corrige', 'fiche', 'annale'];
async function publierFichierDepot(depot, ch, bouton){
  if(!depot || !(depot.fichier_chemin || depot.nom_fichier)) return signal('Ce dépôt ne contient pas de fichier.', 'mal');
  if(!ch.matiere_id && !confirm('Aucune matière choisie : le fichier sera publié sans matière, les candidats le trouveront moins facilement. Publier quand même ?')) return;
  if(bouton) bouton.disabled = true;
  const type = TYPES_RESSOURCE.includes(ch.nature_retenue) ? ch.nature_retenue : 'cours';
  const { data, error } = await db.rpc('admin_publier_depot', { p_depot: depot.id, p_titre: depot.titre || depot.nom_fichier || 'Document', p_matiere: ch.matiere_id, p_niveau: ch.niveau || '', p_type: type });
  if(bouton) bouton.disabled = false;
  if(error || !data || !data.ok) return signal((data && data.message) || (error && error.message) || 'Publication impossible.', 'mal');
  signal('Publié dans la bibliothèque : les candidats peuvent l\'ouvrir.', 'bien');
  vueDepot();
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

    }else if(['cours','exercices','corrige','fiche'].includes(nature) && depot.fichier_chemin){
      return publierFichierDepot(depot, ch, null);

    }else if(['cours','exercices','corrige','fiche'].includes(nature)){
      const { error } = await db.from('ressources').insert({
        titre: depot.titre || 'Sans titre',
        texte,
        type_ressource: nature === 'fiche' ? 'fiche' : nature,
        matiere_id: ch.matiere_id, niveau: ch.niveau,
        fichier_chemin: depot.fichier_chemin, nom_fichier: depot.nom_fichier,
        taille_octets: depot.taille_octets,
        telechargeable: !!depot.fichier_chemin,
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
        <div class="libelle">${E(m)}<span class="num">${parMatiere[m].length}</span></div>
        <table><tbody>
          ${parMatiere[m].map(r => `<tr>
            <td><b>${E(r.titre)}</b><br>
              <span class="num" style="font-size:11px;color:var(--craie2)">
                ${E(r.type_ressource)} · ${E(r.niveau || '—')}${r.theme ? ' · ' + E(r.theme) : ''}
                ${r.nom_fichier ? ' · ' + E(r.nom_fichier) : ''}
                ${r.texte ? ' · texte' : ''}</span></td>
            <td style="text-align:right">${statut(r.statut)}</td>
            <td style="text-align:right">${r.statut !== 'publie'
              ? `<button class="lien" data-pub-r="${E(r.id)}">publier</button>`
              : `<button class="lien" data-ret-r="${E(r.id)}">retirer</button>`}</td>
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
        <span class="l">${'abcd'[i] || (i+1)}</span><span>${E(o.texte || '')}</span></div>`).join('');
    const justes = (c.options || []).filter(o => o.est_correcte).length;
    return `
      <div class="proposition" data-prop="${E(p.id)}">
        <div class="rangee">
          ${statut(p.statut)}
          <span class="num" style="font-size:11px;color:var(--craie2)">confiance ${Math.round((p.confiance ?? 0)*100)} %</span>
        </div>
        <div class="enonce">${E(c.enonce || '(énoncé manquant)')}</div>
        <div class="options-prop">${options || '<div class="option-prop">Aucune proposition</div>'}</div>
        ${justes === 0 ? '<div class="doublon">Aucune bonne réponse cochée — vérifiez avant de publier.</div>' : ''}
        <div class="meta-prop">
          <span>Matière : ${E(nomMatiere(c.matiere_id))}</span>
          <span>Niveau : ${E(c.niveau || '—')}</span>
          <span>Session : ${E(c.annee_session || '—')}</span>
          <span>Bonnes réponses : ${justes}</span>
        </div>
        ${c.explication ? `<p class="sous" style="margin:0 0 12px">${E(c.explication)}</p>` : ''}
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
/* Barre « page X sur Y », reutilisable partout où une liste peut grossir
   au-dela d'une page. Recoit le total exact et l'index courant. */
function barrePagination(page, parPage, total){
  const dernier = Math.max(1, Math.ceil(total / parPage));
  if(dernier <= 1) return '';
  return `<div class="pagination">
    <button class="mini" data-page-vers="${Math.max(0, page-1)}" ${page<=0?'disabled':''}>← Précédent</button>
    <span>Page ${page+1} sur ${dernier} · ${total} au total</span>
    <button class="mini" data-page-vers="${Math.min(dernier-1, page+1)}" ${page>=dernier-1?'disabled':''}>Suivant →</button>
  </div>`;
}

async function vueQuestions(){
  let page = 0; const parPage = 100;
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
    const s = document.getElementById('f-statut').value;
    const m = document.getElementById('f-matiere').value;

    let base_r = db.from('questions').select('id', { count:'exact', head:true });
    if(s) base_r = base_r.eq('statut', s);
    if(m) base_r = base_r.eq('matiere_id', m);
    const { count } = await base_r;

    let r = db.from('questions')
      .select('id, enonce, statut, niveau, matiere_id, annee_session, cree_le')
      .order('cree_le', { ascending:false })
      .range(page * parPage, page * parPage + parPage - 1);
    if(s) r = r.eq('statut', s);
    if(m) r = r.eq('matiere_id', m);

    const { data, error } = await r;
    if(error) return erreur(error, 'Lecture impossible');

    document.getElementById('tableau').innerHTML = (data.length
      ? `<table><thead><tr><th>Énoncé</th><th>Matière</th><th>Niveau</th><th>État</th><th></th></tr></thead><tbody>
         ${data.map(q => `<tr>
            <td>${E(q.enonce)}</td>
            <td>${E(nomMatiere(q.matiere_id))}</td>
            <td>${E(q.niveau || '—')}</td>
            <td>${statut(q.statut)}</td>
            <td>${q.statut !== 'publie'
              ? `<button class="lien" data-publier="${E(q.id)}">publier</button>`
              : `<button class="lien" data-retirer-q="${E(q.id)}">retirer</button>`}</td>
          </tr>`).join('')}
         </tbody></table>`
      : `<div class="vide">Aucune question ne correspond.</div>`)
      + barrePagination(page, parPage, count || 0);

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
    document.querySelectorAll('[data-page-vers]').forEach(b => b.onclick = () => {
      page = parseInt(b.dataset.pageVers, 10); charger();
    });
  };

  document.getElementById('f-statut').onchange = () => { page = 0; charger(); };
  document.getElementById('f-matiere').onchange = () => { page = 0; charger(); };
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
        <input id="a-titre" placeholder="Titre court : le fait, la date, le chiffre">
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
            <td>${E(a.titre)}<br><span class="num" style="font-size:11px;color:var(--craie2)">${E(a.source || '—')} · ${dateCourte(a.cree_le)}${a.verifiee ? '' : ' · <b>non vérifiée</b>'}</span></td>
            <td>${E(a.categorie)}</td><td>${statut(a.statut)}</td>
            <td>${a.statut !== 'publie'
              ? `<button class="lien" data-pub-a="${E(a.id)}">publier</button>`
              : `<button class="lien" data-ret-a="${E(a.id)}">retirer</button>`}</td>
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
          <td><b>${E(c.nom)}</b><br><span class="num" style="font-size:11px;color:var(--craie2)">${E(c.niveau_requis || '—')}${c.date_ecrit ? ' · écrit le ' + dateCourte(c.date_ecrit) : ' · date d\'écrit non renseignée'}${c.seuil_dernier_admis ? ' · seuil ' + E(c.seuil_dernier_admis) : ''}</span></td>
          <td style="text-align:right">${c.actif ? statut('publie') : statut('brouillon')}</td>
        </tr>`).join('')}</tbody></table>
      </div>
    </div>

    <div class="bloc">
      <div class="libelle">Matières<span class="num">${A.ref.matieres.length}</span></div>
      <div class="carte">
        <table><tbody>${A.ref.matieres.map(m => `<tr>
          <td><b>${E(m.nom)}</b></td>
          <td class="num" style="color:var(--craie2)">${E(m.code || '')}</td>
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


/* =====================================================================
   ANALYSE — tout vient des données réellement collectées
   ===================================================================== */
let periode = 30;

function insuffisant(quoi){
  return `<div class="vide">Données insuffisantes.<br>
    <span style="font-size:12.5px">${quoi || 'Rien n\'a encore été observé sur cette période.'}</span></div>`;
}

function barreHorizontale(valeur, max, couleur){
  const l = max > 0 ? Math.round(100 * valeur / max) : 0;
  return `<div style="height:6px;background:var(--trait);border-radius:3px;overflow:hidden;margin-top:6px">
    <div style="height:100%;width:${l}%;background:${couleur || 'var(--cachet)'}"></div></div>`;
}

/* ---- période libre : A.plage = { du, au } (AAAA-MM-JJ) quand on choisit des dates au calendrier ---- */
/* le jour se compte à l'heure du Burkina (UTC), quel que soit le fuseau de l'ordinateur de l'équipe */
const isoJour = d => new Date(d).toLocaleDateString('en-CA', { timeZone:'Africa/Ouagadougou' });
const jourLong = iso => new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { day:'numeric', month:'short', year:'numeric' });
function libellePeriode(j){
  if(A.plage) return A.plage.du === A.plage.au ? 'le ' + jourLong(A.plage.du) : 'du ' + jourLong(A.plage.du) + ' au ' + jourLong(A.plage.au);
  return (j || periode) === 1 ? "aujourd'hui" : (j || periode) + ' jours';
}
async function rpcPeriode(nom, jours){
  /* période libre : les versions « _p » acceptent deux dates ; sans dates, les fonctions d'origine servent comme avant */
  /* un délai dépassé est réessayé une fois tout de suite : le deuxième passage est presque toujours plus rapide */
  const delai = r => r && r.error && /statement timeout|timeout/i.test(r.error.message || '');
  if(!A.plage){
    let r0 = await db.rpc(nom, { p_jours: jours });
    if(delai(r0)) r0 = await db.rpc(nom, { p_jours: jours });
    return r0;
  }
  let r = await db.rpc(nom + '_p', { p_jours: jours, p_du: A.plage.du, p_au: A.plage.au });
  if(delai(r)) r = await db.rpc(nom + '_p', { p_jours: jours, p_du: A.plage.du, p_au: A.plage.au });
  if(r.error && /schema cache|could not find|does not exist|PGRST202/i.test((r.error.message || '') + ' ' + (r.error.code || ''))){
    r = await db.rpc(nom, { p_jours: jours });
    A.plageApprox = true;
    signal("Ces écrans comptent jusqu'à aujourd'hui. Pour une période qui se termine avant, utilisez « Analytique ».", 'info');
  }
  return r;
}
function choixPeriode(liste){
  const presets = liste || [[1,'Aujourd\'hui'],[7,'7 jours'],[30,'30 jours'],[90,'90 jours']];
  const auj = isoJour(new Date());
  return `<div class="rangee barre-periode" style="margin-bottom:16px;align-items:center">
    ${presets.map(p =>
      `<button class="cta creux petit" style="${!A.plage && periode===p[0]?'border-color:var(--craie2);background:var(--ardoise2)':''}"
        data-periode="${p[0]}">${p[1]}</button>`).join('')}
    <span class="plage-libre${A.plage ? ' on' : ''}">
      <label>Du <input type="date" id="plage-du" max="${auj}" value="${A.plage ? A.plage.du : ''}"></label>
      <label>au <input type="date" id="plage-au" max="${auj}" value="${A.plage ? A.plage.au : ''}"></label>
      <button class="cta creux petit" id="plage-go">Afficher ces dates</button>
    </span>
  </div>`;
}

/* ---------- vue générale ---------- */
async function vueAnalyse(){
  $('#vue').innerHTML = `
    <h2 class="titre">Entrée et compositions</h2>
    <p class="sous">Tout ce qui suit provient des actions réellement observées. Aucun chiffre n'est estimé.</p>
    ${choixPeriode()}
    <div id="zone-analyse">Chargement…</div>`;

  brancherPeriode(vueAnalyse);

  const { data: g, error } = await rpcPeriode('stats_generales', periode);
  if(error) return erreur(error, 'Lecture impossible');

  const { data: ent } = await rpcPeriode('entonnoir', periode);
  const { data: ab }  = await db.rpc('abandons_composition');

  const depart = (ent && ent.length) ? ent[0].nombre : 0;

  const zA = document.getElementById('zone-analyse');
  if(!zA) return;
  zA.innerHTML = `
    <div class="compteurs">
      <div class="compteur"><div class="v num">${nombre(g.visiteurs)}</div><div class="l">Visiteurs</div></div>
      <div class="compteur cliquable" data-vers="candidats"><div class="v num">${nombre(g.candidats)}</div><div class="l">Comptes</div></div>
      <div class="compteur cliquable" data-vers="candidats"><div class="v num">${nombre(g.nouveaux)}</div><div class="l">Nouveaux</div></div>
      <div class="compteur cliquable" data-vers="direct"><div class="v num">${nombre(g.dau)}</div><div class="l">Actifs aujourd'hui</div></div>
      <div class="compteur cliquable" data-vers="direct"><div class="v num">${nombre(g.wau)}</div><div class="l">Actifs 7 jours</div></div>
      <div class="compteur"><div class="v num">${nombre(g.sessions)}</div><div class="l">Sessions</div></div>
      <div class="compteur"><div class="v num">${nombre(g.evenements)}</div><div class="l">Actions observées</div></div>
      <div class="compteur"><div class="v num">${nombre(g.questions_repondues)}</div><div class="l">Questions répondues</div></div>
      <div class="compteur"><div class="v num">${g.taux_reussite || 0} %</div><div class="l">Taux de réussite</div></div>
      <div class="compteur"><div class="v num">${nombre(g.compositions_debut)}</div><div class="l">Compositions commencées</div></div>
      <div class="compteur"><div class="v num">${nombre(g.compositions_fin)}</div><div class="l">Compositions terminées</div></div>
      <div class="compteur ${g.erreurs_tech ? 'alerte-c' : ''}">
        <div class="v num">${nombre(g.erreurs_tech)}</div><div class="l">Erreurs techniques</div></div>
    </div>

    <div class="bloc">
      <div class="libelle">Le tunnel d'entrée<span>${periode} jours</span></div>
      <div class="carte">
        ${(!ent || !depart) ? insuffisant('Aucune arrivée observée sur cette période.') :
          ent.map(e => {
            const pc = depart ? Math.round(100 * e.nombre / depart) : 0;
            return `<div style="padding:9px 0;border-bottom:1px solid var(--trait)">
              <div style="display:flex;justify-content:space-between;align-items:baseline">
                <span style="font-size:14px">${E(e.etape)}</span>
                <span class="num" style="font-size:14px">${nombre(e.nombre)} <span style="color:var(--craie2);font-size:12px">${pc} %</span></span>
              </div>${barreHorizontale(e.nombre, depart, pc < 40 ? 'var(--laterite)' : 'var(--cachet)')}
            </div>`;
          }).join('')}
      </div>
    </div>

    <div class="bloc">
      <div class="libelle">Les compositions</div>
      <div class="carte">
        ${(!ab || !ab.commencees) ? insuffisant('Aucune composition commencée.') : `
        <div class="deux">
          <div><div class="compteur"><div class="v num">${ab.commencees}</div><div class="l">Commencées</div></div></div>
          <div><div class="compteur"><div class="v num">${ab.terminees}</div><div class="l">Terminées</div></div></div>
        </div>
        <p class="sous">Taux d'abandon : <b>${Math.round(100 * ab.abandonnees / ab.commencees)} %</b></p>
        ${ab.position_abandon.length ? `
          <div class="libelle" style="margin-top:14px">À quelle question ils s'arrêtent</div>
          ${ab.position_abandon.map(p => `<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:13.5px">
            <span>après ${p.question} question${p.question > 1 ? 's' : ''}</span>
            <span class="num">${p.nombre}</span></div>`).join('')}` : ''}`}
      </div>
    </div>

    <div class="bloc">
      <div class="libelle">Abonnements</div>
      <div class="carte">
        <div class="deux">
          <div class="compteur"><div class="v num">${nombre(g.abonnes)}</div><div class="l">Abonnés payants</div></div>
        </div>
      </div>
    </div>`;
}

/* ---------- comportement : écrans et boutons ---------- */
async function vueComportement(){
  $('#vue').innerHTML = `
    <h2 class="titre">Écrans et boutons</h2>
    <p class="sous">Où ils vont, sur quoi ils appuient, et surtout ce qu'ils ignorent.</p>
    ${choixPeriode()}
    <div id="zone-comportement">Chargement…</div>`;

  brancherPeriode(vueComportement);

  const [{ data: ec }, { data: bt }] = await Promise.all([
    rpcPeriode('ecrans', periode),
    rpcPeriode('clics_boutons', periode)
  ]);

  const maxE = (ec && ec.length) ? Math.max(...ec.map(x => x.vues)) : 0;
  const maxB = (bt && bt.length) ? Math.max(...bt.map(x => x.clics)) : 0;

  const zC = document.getElementById('zone-comportement');
  if(!zC) return;
  zC.innerHTML = `
    <div class="bloc">
      <div class="libelle">Les écrans<span>vues et sorties</span></div>
      <div class="carte">
        ${(!ec || !ec.length) ? insuffisant() : `
        <table><thead><tr><th>Écran</th><th>Vues</th><th>Personnes</th><th>Sorties</th></tr></thead><tbody>
        ${ec.map(e => `<tr class="cliquable" data-zone="${E(e.ecran)}">
          <td>${E(e.ecran)}${barreHorizontale(e.vues, maxE)}</td>
          <td class="num">${nombre(e.vues)}</td>
          <td class="num">${nombre(e.personnes)}</td>
          <td class="num" style="${e.sorties > e.vues * 0.4 ? 'color:var(--rouge-texte)' : ''}">${nombre(e.sorties)}</td>
        </tr>`).join('')}</tbody></table>
        <p class="sous" style="font-size:12.5px">Une sortie signifie que la session s'est terminée sur cet écran. Un chiffre élevé signale un point de fuite.</p>`}
      </div>
    </div>

    <div class="bloc">
      <div class="libelle">Les boutons<span>les plus utilisés d'abord</span></div>
      <div class="carte">
        ${(!bt || !bt.length) ? insuffisant('Aucun clic observé.') : `
        <table><thead><tr><th>Action</th><th>Écran</th><th>Clics</th><th>Personnes</th></tr></thead><tbody>
        ${bt.map(b => `<tr class="cliquable" data-bouton="${E(b.element)}">
          <td>${E(b.element)}${barreHorizontale(b.clics, maxB, 'var(--laterite)')}</td>
          <td style="color:var(--craie2)">${E(b.ecran || '—')}</td>
          <td class="num">${nombre(b.clics)}</td>
          <td class="num">${nombre(b.personnes)}</td>
        </tr>`).join('')}</tbody></table>`}
      </div>
    </div>`;
}

/* ---------- pédagogie : les questions qui bloquent ---------- */
async function vuePedagogie(){
  $('#vue').innerHTML = `
    <h2 class="titre">Questions difficiles</h2>
    <p class="sous">La difficulté réelle, mesurée sur les réponses des candidats — pas celle qu'on avait supposée.</p>
    <div id="zone-pedago">Chargement…</div>`;

  const { data: q, error } = await db.rpc('questions_difficiles', { p_min: 1 });
  if(error) return erreur(error, 'Lecture impossible');

  const zP = document.getElementById('zone-pedago');
  if(!zP) return;
  zP.innerHTML = `
    <div class="bloc">
      <div class="libelle">Questions les plus ratées<span>${q ? q.length : 0} mesurées</span></div>
      <div class="carte">
        ${(!q || !q.length) ? insuffisant("Aucune réponse enregistrée pour l'instant.") : `
        <table><thead><tr><th>Question</th><th>Matière</th><th>Tentatives</th><th>Réussite</th><th>Temps</th></tr></thead><tbody>
        ${q.map(x => `<tr>
          <td>${E(x.enonce)}</td>
          <td style="color:var(--craie2)">${E(x.matiere || '—')}</td>
          <td class="num">${x.tentatives}</td>
          <td class="num" style="color:${x.taux_reussite < 40 ? 'var(--rouge-texte)' : x.taux_reussite > 75 ? 'var(--vert-texte)' : ''}">${x.taux_reussite ?? 0} %</td>
          <td class="num">${x.temps_moyen_s ? x.temps_moyen_s + ' s' : '—'}</td>
        </tr>`).join('')}</tbody></table>
        <p class="sous" style="font-size:12.5px">Une question sous 30 % de réussite est soit mal formulée, soit hors programme. Une question au-dessus de 95 % n'apprend plus rien.</p>`}
      </div>
    </div>`;
}

/* ---------- temps réel ---------- */
async function vueDirect(){
  $('#vue').innerHTML = `
    <h2 class="titre">En direct</h2>
    <p class="sous">Ce qui se passe en ce moment même. La page se rafraîchit toute seule.</p>
    <div id="zone-direct">Chargement…</div>`;

  const rafraichir = async () => {
    if(A.vue !== 'direct') return;
    const { data: t } = await db.rpc('temps_reel');
    const z = document.getElementById('zone-direct');
    if(!z || !t) return;
    z.innerHTML = `
      <div class="compteurs">
        <div class="compteur"><div class="v num">${t.actifs_15min}</div><div class="l">Actifs (15 min)</div></div>
        <div class="compteur"><div class="v num">${t.compositions_en_cours}</div><div class="l">Compositions en cours</div></div>
      </div>
      <div class="bloc">
        <div class="libelle">Les 25 dernières actions</div>
        <div class="carte">
          ${!(t.derniers || []).length ? insuffisant("Personne n'est passé récemment.") :
            (t.derniers || []).map(e => `<div style="display:flex;gap:14px;padding:6px 0;border-bottom:1px solid var(--trait);font-size:13px">
              <span class="num" style="color:var(--craie2);width:70px">${E(e.quand)}</span>
              <span style="flex:1">${E((e.nom || '').replace(/_/g,' ').toLowerCase())}</span>
              <span style="color:var(--craie2)">${E(e.ecran || '')}</span>
            </div>`).join('')}
        </div>
      </div>`;
    setTimeout(rafraichir, 10000);
  };
  rafraichir();
}

/* ---------- rétention et exploration d'un candidat ---------- */
async function vueCandidats(pageC){
  pageC = pageC || 0;
  const parPage = 50;
  $('#vue').innerHTML = `
    <h2 class="titre">Candidats</h2>
    <p class="sous">Qui revient, et le parcours détaillé de chacun.</p>
    <div id="zone-candidats">Chargement…</div>`;

  const [{ data: ret }, { data: pageCand }] = await Promise.all([
    db.rpc('retention'),
    db.rpc('candidats_page', { p_offset: pageC * parPage, p_limite: parPage })
  ]);
  const totalC = pageCand ? pageCand.total : 0, gens = pageCand ? pageCand.liste : [];

  const zK = document.getElementById('zone-candidats');
  if(!zK) return;
  zK.innerHTML = `
    <div class="bloc">
      <div class="libelle">Rétention par cohorte</div>
      <div class="carte">
        ${(!ret || !ret.length) ? insuffisant() : `
        <table><thead><tr><th>Inscrits le</th><th>Nombre</th><th>J+1</th><th>J+3</th><th>J+7</th><th>J+30</th></tr></thead><tbody>
        ${ret.map(c => `<tr><td>${E(c.cohorte)}</td><td class="num">${c.inscrits}</td>
          <td class="num">${c.j1}</td><td class="num">${c.j3}</td>
          <td class="num">${c.j7}</td><td class="num">${c.j30}</td></tr>`).join('')}
        </tbody></table>
        <p class="sous" style="font-size:12.5px">Les colonnes restent à zéro tant que les jours ne sont pas écoulés. C'est normal au début.</p>`}
      </div>
    </div>

    <div class="bloc">
      <div class="libelle">Les candidats<span class="num">${gens ? gens.length : 0}</span></div>
      <div class="carte">
        ${(!gens || !gens.length) ? insuffisant("Aucun compte pour l'instant.") : `
        <table><tbody>
        ${gens.map(p => `<tr>
          <td><b class="cliquable" data-fiche="${E(p.id)}">${E(p.nom)}</b><br><span class="num cliquable" data-fiche="${E(p.id)}" style="font-size:11px;color:var(--craie2)">
            ${p.telephone ? '+226 ' + E(p.telephone) : '—'} · ${E(p.niveau || '—')} · ${dateCourte(p.cree_le)}</span></td>
          <td style="text-align:right"><button class="lien" data-chrono="${E(p.id)}">voir son parcours</button></td>
        </tr>`).join('')}</tbody></table>${barrePagination(pageC, parPage, totalC || 0)}`}
      </div>
    </div>

    <div class="bloc">
      <div class="libelle">Changer le code d'un candidat<span>après vérification sur WhatsApp</span></div>
      <div class="carte">
        <p class="sous" style="font-size:12.5px;margin-top:0">À faire seulement quand le candidat vous a écrit depuis son propre numéro et que vous êtes sûr de son identité. Le numéro est aussi débloqué s'il avait épuisé ses essais.</p>
        <div class="deux">
          <div><label for="k-tel">Numéro (8 chiffres)</label><input id="k-tel" inputmode="numeric" maxlength="8" placeholder="70000000"></div>
          <div><label for="k-code">Nouveau code (4 chiffres)</label><input id="k-code" inputmode="numeric" maxlength="4" placeholder="1234"></div>
        </div>
        <button class="cta petit" id="k-changer">Changer le code</button>
      </div>
    </div>

    <div class="bloc" id="zone-chrono"></div>`;

  document.getElementById('k-changer').onclick = async () => {
    const tel = document.getElementById('k-tel').value.replace(/\D/g,'');
    const code = document.getElementById('k-code').value.replace(/\D/g,'');
    if(tel.length !== 8 || code.length !== 4) return signal('Numéro à 8 chiffres et code à 4 chiffres.', 'mal');
    if(!confirm('Changer le code du +226 ' + tel + ' ?')) return;
    const { data, error } = await db.rpc('admin_changer_code', { p_telephone: tel, p_nouveau: code });
    if(error) return erreur(error, 'Changement impossible');
    if(!data || !data.ok) return signal((data && data.message) || 'Changement impossible.', 'mal');
    signal('Code changé. Communiquez-le au candidat sur WhatsApp.', 'bien');
    document.getElementById('k-code').value = '';
  };

  document.querySelectorAll('[data-page-vers]').forEach(b => b.onclick = () => vueCandidats(parseInt(b.dataset.pageVers, 10)));

  document.querySelectorAll('[data-chrono]').forEach(b => b.onclick = async () => {
    const { data, error } = await db.rpc('chronologie', { p_user: b.dataset.chrono, p_limite: 150 });
    if(error) return erreur(error, 'Consultation impossible');
    const zH = document.getElementById('zone-chrono');
    if(!zH) return;
    zH.innerHTML = `
      <div class="libelle">Parcours détaillé<span>consultation enregistrée au journal</span></div>
      <div class="carte">
        ${(!data || !data.length) ? insuffisant("Ce candidat n'a encore rien fait d'observé.") :
          data.map(e => `<div style="display:flex;gap:14px;padding:6px 0;border-bottom:1px solid var(--trait);font-size:13px">
            <span class="num" style="color:var(--craie2);width:105px">${E(e.quand)}</span>
            <span style="flex:1">${E((e.nom || '').replace(/_/g,' ').toLowerCase())}${e.element ? ' · ' + E(e.element) : ''}</span>
            <span style="color:var(--craie2)">${E(e.ecran || '')}</span>
          </div>`).join('')}
      </div>`;
    zH.scrollIntoView({ behavior:'smooth' });
  });
}

function brancherPeriode(recharger){
  document.querySelectorAll('[data-periode]').forEach(b => b.onclick = () => {
    periode = +b.dataset.periode; A.plage = null; A.plageApprox = false; recharger();
  });
  const go = document.getElementById('plage-go');
  if(go) go.onclick = () => {
    const du = document.getElementById('plage-du').value, au = document.getElementById('plage-au').value || isoJour(new Date());
    if(!du) return signal('Choisissez au moins le premier jour.', 'mal');
    const a = du <= au ? [du, au] : [au, du];
    A.plage = { du: a[0], au: a[1] }; A.plageApprox = false;
    periode = Math.max(1, Math.round((new Date(isoJour(new Date()) + 'T12:00:00') - new Date(a[0] + 'T12:00:00')) / 86400000) + 1);
    recharger();
  };
}


/* =====================================================================
   LES SUJETS — assembler une épreuve
   ===================================================================== */
let sujetOuvert = null;      // le sujet en cours de composition
let listeSujet  = [];        // ses questions, dans l'ordre

async function vueSujets(){
  if(sujetOuvert) return composerSujet();

  $('#vue').innerHTML = `
    <h2 class="titre">Les sujets</h2>
    <p class="sous">Une épreuve, c'est une liste de questions dans un ordre choisi. Tant qu'un sujet est en brouillon, aucun candidat ne le voit.</p>

    <div class="bloc">
      <div class="libelle">Nouveau sujet</div>
      <div class="carte">
        <div class="deux">
          <div><label for="s-ref">Référence</label>
            <input id="s-ref" placeholder="2026-08"></div>
          <div><label for="s-niveau">Niveau</label>
            <select id="s-niveau">${optionsNiveaux('terminale')}</select></div>
          <div><label for="s-concours">Concours</label>
            <select id="s-concours"><option value="">— aucun —</option>${optionsConcours()}</select></div>
          <div><label for="s-duree">Durée en minutes</label>
            <input id="s-duree" type="number" value="25" min="5" max="240"></div>
          <div><label for="s-seuil">Seuil du dernier admis (seulement s'il est connu et sourcé)</label>
            <input id="s-seuil" type="number" min="0" placeholder="laisser vide si inconnu"></div>
        </div>
        <button class="cta vert petit" id="s-creer">Créer le sujet</button>
      </div>
    </div>

    <div class="bloc">
      <div class="libelle">Sujets existants</div>
      <div class="carte" id="liste-sujets">Chargement…</div>
    </div>`;

  document.getElementById('s-creer').onclick = async () => {
    const ref = document.getElementById('s-ref').value.trim();
    if(!ref) return signal('Donnez une référence au sujet.', 'mal');
    const { error } = await db.from('sujets').insert({
      reference: ref,
      niveau: document.getElementById('s-niveau').value,
      concours_id: document.getElementById('s-concours').value || null,
      duree_secondes: (parseInt(document.getElementById('s-duree').value) || 25) * 60,
      seuil_admission: parseInt(document.getElementById('s-seuil').value) || null,
      nb_questions: 0, statut: 'brouillon'
    });
    if(error) return erreur(error, 'Création impossible');
    document.getElementById('s-ref').value = '';
    signal('Sujet créé. Il reste à choisir ses questions.', 'bien');
    chargerSujets();
  };

  chargerSujets();
}

async function chargerSujets(){
  const { data, error } = await db.from('sujets')
    .select('id, reference, niveau, nb_questions, duree_secondes, seuil_admission, statut, cree_le')
    .order('cree_le', { ascending:false });
  if(error) return erreur(error, 'Lecture impossible');

  const z = document.getElementById('liste-sujets');
  if(!z) return;
  if(!data.length){ z.innerHTML = `<div class="vide">Aucun sujet pour l'instant.</div>`; return; }

  z.innerHTML = `<table><thead><tr><th>Référence</th><th>Niveau</th><th>Questions</th><th>Durée</th><th>État</th><th></th></tr></thead><tbody>
    ${data.map(s => `<tr>
      <td><b>${E(s.reference)}</b></td>
      <td>${E(s.niveau || '—')}</td>
      <td class="num" style="${s.nb_questions ? '' : 'color:var(--rouge-texte)'}">${s.nb_questions || 0}</td>
      <td class="num">${Math.round((s.duree_secondes || 0)/60)} min</td>
      <td>${statut(s.statut)}</td>
      <td style="text-align:right;white-space:nowrap">
        <button class="lien" data-composer="${E(s.id)}">composer</button>
        ${s.statut === 'publie'
          ? `<button class="lien" style="margin-left:10px" data-retirer-s="${E(s.id)}">retirer</button>`
          : `<button class="lien" style="margin-left:10px" data-publier-s="${E(s.id)}">publier</button>`}
      </td></tr>`).join('')}
    </tbody></table>`;

  z.querySelectorAll('[data-composer]').forEach(b => b.onclick = () => {
    sujetOuvert = data.find(x => x.id === b.dataset.composer);
    composerSujet();
  });
  z.querySelectorAll('[data-publier-s]').forEach(b => b.onclick = async () => {
    const s = data.find(x => x.id === b.dataset.publierS);
    if(!s.nb_questions) return signal("Ce sujet n'a aucune question : impossible de le publier.", 'mal');
    await db.from('sujets').update({ statut:'publie' }).eq('id', s.id);
    signal('Sujet publié. Les candidats peuvent composer.', 'bien'); chargerSujets();
  });
  z.querySelectorAll('[data-retirer-s]').forEach(b => b.onclick = async () => {
    await db.from('sujets').update({ statut:'brouillon' }).eq('id', b.dataset.retirerS);
    signal('Sujet retiré.', 'info'); chargerSujets();
  });
}

/* ---------- composer : à gauche le sujet, à droite la banque ---------- */
async function composerSujet(){
  const s = sujetOuvert;
  $('#vue').innerHTML = `
    <button class="retourhaut" data-retour-sujets="1">← Tous les sujets</button>
    <h2 class="titre">Sujet ${E(s.reference)}</h2>
    <p class="sous">Ajoutez des questions depuis la banque, ordonnez-les, puis enregistrez. L'ordre est celui que verra le candidat.</p>

    <div class="bloc">
      <div class="libelle">Aide au remplissage</div>
      <div class="carte">
        <div class="rangee">
          <select id="c-niveau" style="width:auto;margin:0">${optionsNiveaux(s.niveau || 'terminale')}</select>
          <input id="c-nombre" type="number" value="50" min="1" max="100" style="width:90px;margin:0">
          <button class="cta creux petit" id="c-tirer">Tirer au sort</button>
          <button class="cta creux petit" id="c-vider">Tout vider</button>
        </div>
        <p class="sous" style="font-size:12.5px">Le tirage propose des questions publiées du niveau choisi. Vous gardez la main : rien n'est enregistré tant que vous n'avez pas validé.</p>
      </div>
    </div>

    <div class="bloc">
      <div class="libelle">Questions du sujet<span class="num" id="c-compte">0</span></div>
      <div class="carte" id="c-liste">Chargement…</div>
      <button class="cta" id="c-enregistrer" style="margin-top:12px">Enregistrer la composition</button>
    </div>

    <div class="bloc">
      <div class="libelle">La banque</div>
      <div class="carte">
        <div class="rangee" style="margin-bottom:12px">
          <input id="c-recherche" placeholder="Chercher un énoncé…" style="flex:1;margin:0">
          <select id="c-matiere" style="width:auto;margin:0"><option value="">Toutes matières</option>${optionsMatieres()}</select>
        </div>
        <div id="c-banque">Chargement…</div>
      </div>
    </div>`;

  document.querySelector('[data-retour-sujets]').onclick = () => { sujetOuvert = null; vueSujets(); };
  document.getElementById('c-tirer').onclick = tirerQuestions;
  document.getElementById('c-vider').onclick = () => { listeSujet = []; afficherListeSujet(); };
  document.getElementById('c-enregistrer').onclick = enregistrerSujet;
  document.getElementById('c-recherche').oninput = chargerBanque;
  document.getElementById('c-matiere').onchange = chargerBanque;

  /* on repart des questions déjà attachées */
  const { data } = await db.from('sujet_questions')
    .select('position, questions(id, enonce, matieres(nom))')
    .eq('sujet_id', s.id).order('position');
  listeSujet = (data || []).filter(l => l.questions).map(l => ({
    id: l.questions.id, enonce: l.questions.enonce,
    matiere: l.questions.matieres ? l.questions.matieres.nom : null
  }));

  afficherListeSujet();
  chargerBanque();
}

function afficherListeSujet(){
  const z = document.getElementById('c-liste');
  const c = document.getElementById('c-compte');
  if(!z) return;
  c.textContent = listeSujet.length;

  if(!listeSujet.length){
    z.innerHTML = `<div class="vide">Aucune question. Tirez au sort ou piochez dans la banque.</div>`;
    return;
  }
  z.innerHTML = listeSujet.map((q, i) => `
    <div style="display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-bottom:1px solid var(--trait)">
      <span class="num" style="color:var(--craie2);width:26px">${i+1}</span>
      <span style="flex:1;font-size:13.5px">${E(q.enonce)}
        <br><span class="num" style="font-size:11px;color:var(--craie2)">${E(q.matiere || 'sans matière')}</span></span>
      <span style="white-space:nowrap">
        <button class="lien" data-monter="${i}" ${i===0?'style="opacity:.3"':''}>▲</button>
        <button class="lien" data-descendre="${i}" ${i===listeSujet.length-1?'style="opacity:.3"':''}>▼</button>
        <button class="lien" data-oter="${i}" style="color:var(--rouge-texte);margin-left:6px">✕</button>
      </span>
    </div>`).join('');

  z.querySelectorAll('[data-monter]').forEach(b => b.onclick = () => {
    const i = +b.dataset.monter; if(i === 0) return;
    [listeSujet[i-1], listeSujet[i]] = [listeSujet[i], listeSujet[i-1]];
    afficherListeSujet();
  });
  z.querySelectorAll('[data-descendre]').forEach(b => b.onclick = () => {
    const i = +b.dataset.descendre; if(i === listeSujet.length-1) return;
    [listeSujet[i+1], listeSujet[i]] = [listeSujet[i], listeSujet[i+1]];
    afficherListeSujet();
  });
  z.querySelectorAll('[data-oter]').forEach(b => b.onclick = () => {
    listeSujet.splice(+b.dataset.oter, 1); afficherListeSujet(); chargerBanque();
  });
}

async function chargerBanque(){
  const z = document.getElementById('c-banque');
  if(!z) return;
  const cherche = (document.getElementById('c-recherche').value || '').trim();
  const mat = document.getElementById('c-matiere').value;

  let r = db.from('questions')
    .select('id, enonce, matieres(nom)').eq('statut','publie')
    .order('cree_le', { ascending:false }).limit(60);
  if(cherche) r = r.ilike('enonce', '%' + cherche + '%');
  if(mat) r = r.eq('matiere_id', mat);

  const { data, error } = await r;
  if(error) return erreur(error, 'Lecture impossible');

  const dedans = new Set(listeSujet.map(q => q.id));
  const libres = data.filter(q => !dedans.has(q.id));

  z.innerHTML = libres.length ? libres.map(q => `
    <div style="display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--trait)">
      <span style="flex:1;font-size:13.5px">${E(q.enonce)}
        <br><span class="num" style="font-size:11px;color:var(--craie2)">${E(q.matieres ? q.matieres.nom : 'sans matière')}</span></span>
      <button class="lien" data-ajouter="${E(q.id)}" data-enonce="${E(q.enonce)}"
        data-mat="${E(q.matieres ? q.matieres.nom : '')}">ajouter</button>
    </div>`).join('')
    : `<div class="vide">Toutes les questions correspondantes sont déjà dans le sujet.</div>`;

  z.querySelectorAll('[data-ajouter]').forEach(b => b.onclick = () => {
    listeSujet.push({ id: b.dataset.ajouter, enonce: b.dataset.enonce, matiere: b.dataset.mat });
    afficherListeSujet(); chargerBanque();
  });
}

async function tirerQuestions(){
  const { data, error } = await db.rpc('proposer_questions', {
    p_niveau: document.getElementById('c-niveau').value,
    p_nombre: parseInt(document.getElementById('c-nombre').value) || 50,
    p_matiere: null
  });
  if(error) return erreur(error, 'Tirage impossible');
  if(!data || !data.length) return signal('Aucune question publiée à ce niveau.', 'mal');

  const dedans = new Set(listeSujet.map(q => q.id));
  data.forEach(q => { if(!dedans.has(q.id)) listeSujet.push(q); });
  afficherListeSujet(); chargerBanque();
  signal(`${data.length} question(s) proposées. Vérifiez avant d'enregistrer.`, 'bien');
}

async function enregistrerSujet(){
  if(!sujetOuvert) return;
  const { data, error } = await db.rpc('definir_sujet', {
    p_sujet: sujetOuvert.id, p_questions: listeSujet.map(q => q.id)
  });
  if(error) return erreur(error, 'Enregistrement impossible');
  signal(`${data} question(s) enregistrées dans le sujet ${sujetOuvert.reference}.`, 'bien');
}

/* ---------- journal ---------- */
async function vueJournal(pageJ){
  pageJ = pageJ || 0; const parPage = 80;
  $('#vue').innerHTML = `
    <h2 class="titre">Journal</h2>
    <p class="sous">Qui a validé quoi, et quand. Le jour où une erreur passe, c'est ici qu'on remonte à sa source.</p>
    <div class="bloc"><div class="carte" id="j">Chargement…</div></div>`;

  const [{ count }, { data, error }] = await Promise.all([
    db.from('journal_activite').select('id', { count:'exact', head:true }),
    db.from('journal_activite').select('*').order('cree_le', { ascending:false })
      .range(pageJ * parPage, pageJ * parPage + parPage - 1)
  ]);
  if(error) return erreur(error, 'Lecture impossible');

  document.getElementById('j').innerHTML = (data.length
    ? `<table><thead><tr><th>Quand</th><th>Action</th><th>Cible</th></tr></thead><tbody>
       ${data.map(l => `<tr><td class="num">${dateHeure(l.cree_le)}</td>
         <td>${E((l.action || '').replace(/_/g,' '))}</td>
         <td class="num" style="color:var(--craie2)">${l.table_cible === 'profils' && /^[0-9a-f-]{36}$/i.test(l.ligne_cible || '') ? `<span class="cliquable" data-fiche="${E(l.ligne_cible)}">voir le candidat</span>` : E(l.table_cible || '—')}</td></tr>`).join('')}
       </tbody></table>`
    : `<div class="vide">Le journal est vide pour l'instant.</div>`)
    + barrePagination(pageJ, parPage, count || 0);

  document.querySelectorAll('[data-page-vers]').forEach(b => b.onclick = () => vueJournal(parseInt(b.dataset.pageVers, 10)));
}

/* ============================================================
   COMPOSITIONS NATIONALES
   Jour et heure au choix (heure de Ouagadougou = UTC), samedi à 18 h 00 par défaut, même sujet
   pour tous. La base programme seule la composition du samedi
   suivant ; ici on peut l'annuler, en ajouter une, voir les admis.
   ============================================================ */
async function vueCollectives(){
  const [{ data: sujets }, { data: compos }, { data: eps }, { data: concours }, { data: inscr }] = await Promise.all([
    db.from('sujets').select('id, reference, niveau, nb_questions, duree_secondes').eq('statut','publie').order('reference'),
    db.from('compositions').select('sujet_id'),
    db.from('epreuves_collectives').select('id, titre, sujet_id, debut_le, fin_le, recompense, message, statut, cree_le, concours_id, places').order('debut_le', { ascending:false }).limit(30),
    db.from('concours').select('id, nom, niveau_requis, nb_places, actif').order('nom'),
    db.from('inscriptions_epreuve').select('epreuve_id')
  ]);
  const usage = {}, nbInscr = {};
  (compos || []).forEach(c => { usage[c.sujet_id] = (usage[c.sujet_id] || 0) + 1; });
  (inscr || []).forEach(i => { nbInscr[i.epreuve_id] = (nbInscr[i.epreuve_id] || 0) + 1; });
  const nomConc = id => ((concours || []).find(c => c.id === id) || {}).nom || '';
  const samedi = new Date(); samedi.setUTCDate(samedi.getUTCDate() + ((6 - samedi.getUTCDay() + 7) % 7 || 7));
  const defaut = samedi.toISOString().slice(0, 10) + 'T18:00';

  $('#vue').innerHTML = `
    <h2 class="titre">Compositions nationales <small style="font-size:.55em;font-weight:500;opacity:.75">(simulation)</small></h2>
    <p class="sous">Vous pouvez lancer une composition nationale quand vous voulez : choisissez le concours, le sujet, la date et l'heure, puis « Programmer ». Tous les candidats reçoivent une notification. En plus, chaque samedi à 18 h 00, une composition est programmée automatiquement : le concours change à tour de rôle et le sujet choisi n'a jamais servi en composition nationale. Les candidats s'inscrivent depuis l'application ; à la fin, ils voient leur statut (admis, liste d'attente, non admis), la liste des admis et peuvent télécharger les résultats en PDF.</p>

    <div class="bloc">
      <div class="libelle">Programmer une composition</div>
      <div class="carte">
        <div class="deux">
          <div><label for="ec-concours">Concours</label><select id="ec-concours">
            ${(concours || []).filter(c => c.actif).map(c => `<option value="${E(c.id)}" data-places="${c.nb_places || 30}">${E(c.nom)} · ${E(c.niveau_requis || '')}</option>`).join('')}
          </select></div>
          <div><label for="ec-places">Nombre de places</label><input id="ec-places" type="number" min="1" max="100000" value="30"></div>
          <div><label for="ec-sujet">Sujet</label><select id="ec-sujet">
            ${(sujets || []).map(s => `<option value="${E(s.id)}">${E(s.reference)} · ${E(s.niveau || 'tous niveaux')} · ${s.nb_questions} q. · ${Math.round((s.duree_secondes||1500)/60)} min · déjà composé ${usage[s.id] || 0} fois</option>`).join('')}
          </select></div>
          <div><label for="ec-debut">Début (heure de Ouagadougou)</label><input id="ec-debut" type="datetime-local" value="${defaut}"></div>
          <div><label for="ec-recompense">Récompense (facultatif)</label><input id="ec-recompense" maxlength="120" placeholder="1 mois d'abonnement offert au major"></div>
        </div>
        <label for="ec-message">Message aux participants (facultatif)</label>
        <textarea id="ec-message" rows="2" maxlength="400" placeholder="Félicitations à tous les admis. La prochaine composition nationale est annoncée dans l'application."></textarea>
        <button class="cta vert petit" id="ec-creer" style="margin-top:10px">Programmer et prévenir les candidats</button>
      </div>
    </div>

    <div class="bloc">
      <div class="libelle">Compositions programmées</div>
      <div class="carte">${!(eps || []).length ? '<div class="vide">Aucune composition nationale pour l\'instant.</div>' : `
        <table><thead><tr><th>Composition</th><th>Début</th><th>Places</th><th>Inscrits</th><th>État</th><th></th></tr></thead><tbody>
        ${eps.map(ep => {
          const maintenant = Date.now(), d = new Date(ep.debut_le).getTime(), f = new Date(ep.fin_le).getTime();
          const etat = ep.statut === 'annulee' ? 'annulée' : (maintenant < d ? 'à venir' : (maintenant < f ? 'en cours' : 'terminée'));
          return `<tr><td><b>${E(nomConc(ep.concours_id) || ep.titre)}</b>${ep.recompense ? '<br><small>' + E(ep.recompense) + '</small>' : ''}</td>
            <td>${E(new Date(ep.debut_le).toLocaleString('fr-FR', { timeZone:'Africa/Ouagadougou', weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }))}</td>
            <td>${ep.places}</td><td class="cliquable" data-epreuve="${E(ep.id)}" data-titre="${E(nomConc(ep.concours_id) || ep.titre)}">${nbInscr[ep.id] || 0}</td><td>${etat}</td>
            <td style="text-align:right;white-space:nowrap">
              ${etat === 'terminée' ? `<button class="lien" data-ec-classement="${E(ep.id)}">résultats</button>` : ''}
              ${etat === 'à venir' ? `<button class="lien" data-ec-places="${E(ep.id)}" data-actuel="${ep.places}">places</button>
                <button class="lien" style="margin-left:10px" data-ec-annuler="${E(ep.id)}">annuler</button>` : ''}
            </td></tr>`;
        }).join('')}</tbody></table>`}
      </div>
      <div id="ec-detail"></div>
    </div>`;

  const selC = document.getElementById('ec-concours');
  const majPlaces = () => { const o = selC.selectedOptions[0]; if(o) document.getElementById('ec-places').value = o.dataset.places; };
  if(selC){ selC.onchange = majPlaces; majPlaces(); }
  document.getElementById('ec-creer').onclick = async () => {
    const debut = document.getElementById('ec-debut').value;
    if(!debut) return signal('Choisissez la date et l\'heure.', 'mal');
    const o = selC && selC.selectedOptions[0];
    const { data, error } = await db.rpc('programmer_nationale', {
      p_titre: 'Composition nationale (simulation) · ' + (o ? o.textContent.split(' · ')[0] : ''),
      p_sujet: document.getElementById('ec-sujet').value,
      p_debut: new Date(debut + ':00Z').toISOString(),
      p_recompense: document.getElementById('ec-recompense').value,
      p_message: document.getElementById('ec-message').value,
      p_concours: selC ? selC.value : null,
      p_places: +document.getElementById('ec-places').value || 30
    });
    if(error) return erreur(error, 'Programmation impossible');
    if(!data || !data.ok) return signal((data && data.message) || 'Programmation impossible.', 'mal');
    signal('Composition programmée. Les candidats sont prévenus.', 'bien');
    vueCollectives();
  };
  $$('[data-ec-annuler]').forEach(b => b.onclick = async () => {
    if(!confirm('Annuler cette composition nationale ?')) return;
    const { error } = await db.from('epreuves_collectives').update({ statut:'annulee' }).eq('id', b.dataset.ecAnnuler);
    if(error) return erreur(error, 'Annulation impossible');
    signal('Composition annulée.', 'info'); vueCollectives();
  });
  $$('[data-ec-places]').forEach(b => b.onclick = async () => {
    const v = prompt('Nombre de places (admis) :', b.dataset.actuel);
    const n = parseInt(v, 10);
    if(!n || n < 1) return;
    const { error } = await db.from('epreuves_collectives').update({ places:n }).eq('id', b.dataset.ecPlaces);
    if(error) return erreur(error, 'Modification impossible');
    signal('Nombre de places enregistré.', 'bien'); vueCollectives();
  });
  $$('[data-ec-classement]').forEach(b => b.onclick = async () => {
    const { data } = await db.rpc('classement_epreuve', { p_epreuve: b.dataset.ecClassement });
    const z = document.getElementById('ec-detail');
    if(!data || !data.ok){ z.innerHTML = '<div class="carte">Résultats indisponibles.</div>'; return; }
    const st = { admis:'Admis', attente:'Liste d\'attente', echoue:'Non admis' };
    z.innerHTML = `<div class="carte" style="margin-top:12px"><b>${E(data.concours || data.titre)}</b> · ${data.participants} candidats · ${data.admis} admis · ${data.attente} en liste d'attente · moyenne ${data.moyenne ?? '—'}/${data.sur}
      <table style="margin-top:8px"><thead><tr><th>Rang</th><th>Nom</th><th>Note</th><th>Durée</th><th>Statut</th></tr></thead><tbody>
      ${(data.classement || []).map(l => `<tr><td>${l.rang}</td><td>${E(l.nom || l.pseudo)}</td><td>${l.score}/${l.sur}</td><td>${Math.round((l.duree||0)/60)} min</td><td>${st[l.statut] || ''}</td></tr>`).join('')}
      </tbody></table></div>`;
  });
}

/* ============================================================
   SIGNALEMENTS DES CANDIDATS
   ============================================================ */
const MOTIFS_SIGNAL = { reponse_fausse:'Bonne réponse fausse', enonce_errone:'Énoncé faux ou incomplet',
  perime:'Information périmée', faute:'Faute de frappe', autre:'Autre' };
async function vueSignalements(){
  const { data, error } = await db.from('signalements')
    .select('id, user_id, motif, commentaire, statut, cree_le, question_id, questions(enonce, explication, question_options(position, texte, est_correcte))')
    .order('cree_le', { ascending:false }).limit(100);
  if(error) return erreur(error, 'Lecture impossible');
  const nouveaux = (data || []).filter(s => s.statut === 'nouveau');
  /* qui a signalé : nom, fiche et message direct */
  const auteurs = {};
  const ids = [...new Set((data || []).map(s => s.user_id).filter(Boolean))];
  if(ids.length){
    const { data: pr } = await db.from('profils').select('id, nom, telephone').in('id', ids);
    (pr || []).forEach(p => { auteurs[p.id] = p; });
  }
  $('#vue').innerHTML = `
    <h2 class="titre">Signalements</h2>
    <p class="sous">Les candidats signalent une question qui leur paraît fausse. Vérifiez, corrigez la question dans « Questions », puis marquez le signalement.</p>
    <div class="bloc"><div class="libelle">${nouveaux.length} à traiter · ${(data || []).length} au total</div>
      ${!(data || []).length ? '<div class="carte"><div class="vide">Aucun signalement.</div></div>' :
      (data || []).map(s => {
        const q = s.questions || {};
        const opts = (q.question_options || []).slice().sort((a, b) => a.position - b.position);
        return `<div class="carte" style="margin-bottom:10px;${s.statut === 'nouveau' ? '' : 'opacity:.6'}">
          <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
            <b>${E(MOTIFS_SIGNAL[s.motif] || s.motif)}</b><small>${E(dateHeure(s.cree_le))} · ${E(s.statut)}</small></div>
          ${s.commentaire ? `<p style="margin:6px 0;font-style:italic">« ${E(s.commentaire)} »</p>` : ''}
          <p style="margin-top:6px">${E(q.enonce || 'Question supprimée')}</p>
          <ol type="A" style="margin:4px 0 0 20px">${opts.map(o => `<li${o.est_correcte ? ' style="font-weight:bold;color:var(--vert-texte, #0E7A54)"' : ''}>${E(o.texte)}${o.est_correcte ? ' ✓' : ''}</li>`).join('')}</ol>
          ${q.explication ? `<p style="margin-top:6px"><small>Explication : ${E(q.explication)}</small></p>` : ''}
          <small style="display:block;margin-top:6px;color:#888">Identifiant de la question : ${E(s.question_id)}</small>
          ${s.user_id ? `<div style="margin-top:8px;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><small>Signalé par <b class="cliquable" data-fiche="${E(s.user_id)}">${E((auteurs[s.user_id] || {}).nom || 'un candidat')}</b></small>
            ${(A.admin || A.investisseur) ? `<button class="mini" data-ecrire="${E(s.user_id)}" data-nom="${E((auteurs[s.user_id] || {}).nom || '')}">Écrire à ce candidat</button>` : ''}</div>` : ''}
          ${s.statut === 'nouveau' ? `<div style="margin-top:8px">
            <button class="lien" data-sig="${s.id}|corrige">marquer corrigé</button>
            <button class="lien" style="margin-left:12px" data-sig="${s.id}|rejete">rejeter</button></div>` : ''}
        </div>`;
      }).join('')}
    </div>`;
  $$('[data-ecrire]').forEach(b => b.onclick = () => {
    if(!window.ADMIN.ecrireA) return signal('La fenêtre de message n\'est pas chargée. Rechargez la page.', 'erreur');
    window.ADMIN.ecrireA(b.dataset.ecrire, b.dataset.nom, { titre: 'Merci pour votre signalement', message: 'Merci d\'avoir signalé cette question. Nous l\'avons examinée : la correction est faite si elle était nécessaire. Continuez à nous dire quand quelque chose vous paraît faux.' });
  });
  $$('[data-sig]').forEach(b => b.onclick = async () => {
    const [id, st] = b.dataset.sig.split('|');
    const { error: e2 } = await db.from('signalements').update({ statut: st }).eq('id', +id);
    if(e2) return erreur(e2, 'Mise à jour impossible');
    signal(st === 'corrige' ? 'Marqué corrigé.' : 'Signalement rejeté.', 'info'); vueSignalements();
  });
}

/* ============================================================
   AVIS DES CANDIDATS (fenêtre « Donnez votre avis »)
   ============================================================ */
async function vueAvis(){
  const { data, error } = await db.rpc('avis_liste', { p_limite: 200 });
  if(error) return erreur(error, 'Lecture impossible');
  const liste = data || [];
  const nouveaux = liste.filter(a => a.statut === 'nouveau').length;
  const sansReponse = liste.filter(a => !a.reponse).length;
  const niveau = v => (NIVEAUX.find(([k]) => k === v) || [])[1] || '';
  const peut = A.equipe;
  $('#vue').innerHTML = `
    <h2 class="titre">Avis des candidats</h2>
    <p class="sous">Après une trentaine de minutes d'utilisation, l'application propose au candidat de donner son avis sur le site ou sur les recommandations. Les avis arrivent ici : vous pouvez les aimer et répondre. La réponse arrive chez le candidat sous le titre « Réponse de l'administration · Mon Concours ».</p>
    <div class="bloc"><div class="libelle">${nouveaux} nouveau${nouveaux > 1 ? 'x' : ''} · ${sansReponse} sans réponse · ${liste.length} au total</div>
      ${!liste.length ? '<div class="carte"><div class="vide">Aucun avis pour le moment.</div></div>' :
      liste.map(a => `<div class="carte avis-carte" data-avis="${a.id}" style="margin-bottom:10px;${a.statut === 'nouveau' || !a.reponse ? '' : 'opacity:.85'}">
          <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
            <b>${a.user_id ? `<span class="cliquable" data-fiche="${E(a.user_id)}">${E(a.nom || 'Candidat')}</span>` : E(a.nom || 'Candidat')}${niveau(a.niveau) ? ' · ' + E(niveau(a.niveau)) : ''}${a.aime ? ' <span class="coeur" title="Vous avez aimé cet avis">♥</span>' : ''}</b><small>${E(dateHeure(a.cree_le))}</small></div>
          <p style="margin:8px 0;white-space:pre-wrap">${E(a.message)}</p>
          ${a.telephone ? `<small style="color:#888">${a.user_id ? `<span class="cliquable" data-fiche="${E(a.user_id)}">${E(a.telephone)}</span>` : E(a.telephone)}</small>` : ''}
          ${a.reponse ? `<div class="reponse-admin"><small>Votre réponse · ${E(dateHeure(a.reponse_le))}</small><p style="margin:4px 0 0;white-space:pre-wrap">${E(a.reponse)}</p></div>` : ''}
          ${peut ? `<div class="avis-actions" style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <button class="mini" data-avis-aime="${a.id}" data-etat="${a.aime ? 1 : 0}">${a.aime ? '♥ Aimé · retirer' : '♡ J\'aime'}</button>
            <button class="mini" data-avis-repondre="${a.id}">${a.reponse ? 'Répondre à nouveau' : 'Répondre'}</button>
            ${a.statut === 'nouveau' ? `<button class="lien" data-avis-lu="${a.id}">marquer comme lu</button>` : ''}
          </div>
          <div class="avis-form" data-forme="${a.id}" hidden>
            <textarea rows="3" maxlength="800" placeholder="Votre réponse au candidat (800 caractères au plus)"></textarea>
            <div class="rangee" style="margin-top:6px;align-items:center">
              <label style="font-size:13px">Affichage chez le candidat
                <select data-mode><option value="les_deux">Cloche et fenêtre plein écran</option><option value="cloche">Cloche seulement</option><option value="plein">Fenêtre plein écran seulement</option></select></label>
              <button class="cta petit" data-avis-envoyer="${a.id}">Envoyer la réponse</button>
              <button class="lien" data-avis-annuler="${a.id}">Annuler</button>
            </div>
          </div>` : (a.statut === 'nouveau' ? `<div style="margin-top:8px"><button class="lien" data-avis-lu="${a.id}">marquer comme lu</button></div>` : '')}
        </div>`).join('')}
    </div>`;
  $$('[data-avis-lu]').forEach(b => b.onclick = async () => {
    const { error: e2 } = await db.from('avis').update({ statut: 'lu' }).eq('id', +b.dataset.avisLu);
    if(e2) return erreur(e2, 'Mise à jour impossible');
    signal('Marqué comme lu.', 'info'); vueAvis(); majPastilles();
  });
  $$('[data-avis-aime]').forEach(b => b.onclick = async () => {
    b.disabled = true;
    const { data: r, error: e2 } = await db.rpc('admin_aimer_avis', { p_id: +b.dataset.avisAime, p_aime: b.dataset.etat !== '1' });
    if(e2 || !r || !r.ok){ b.disabled = false; return erreur(e2 || { message: (r && r.message) || 'Échec' }, 'J\'aime impossible'); }
    signal(b.dataset.etat === '1' ? 'J\'aime retiré.' : 'Avis aimé : le candidat en est informé.', 'bien'); vueAvis(); majPastilles();
  });
  $$('[data-avis-repondre]').forEach(b => b.onclick = () => {
    const f = document.querySelector('[data-forme="' + b.dataset.avisRepondre + '"]'); f.hidden = !f.hidden; if(!f.hidden) f.querySelector('textarea').focus();
  });
  $$('[data-avis-annuler]').forEach(b => b.onclick = () => { document.querySelector('[data-forme="' + b.dataset.avisAnnuler + '"]').hidden = true; });
  $$('[data-avis-envoyer]').forEach(b => b.onclick = async () => {
    const f = document.querySelector('[data-forme="' + b.dataset.avisEnvoyer + '"]');
    const txt = f.querySelector('textarea').value.trim();
    if(txt.length < 2) return signal('Écrivez votre réponse.', 'mal');
    b.disabled = true;
    const { data: r, error: e2 } = await db.rpc('admin_repondre_avis', { p_id: +b.dataset.avisEnvoyer, p_reponse: txt, p_mode: f.querySelector('[data-mode]').value });
    if(e2 || !r || !r.ok){ b.disabled = false; return erreur(e2 || { message: (r && r.message) || 'Échec' }, 'Réponse impossible'); }
    signal('Réponse envoyée au candidat.', 'bien'); vueAvis(); majPastilles();
  });
}

/* ============================================================
   INDICATEURS : est-ce que Mon Concours aide vraiment ?
   ============================================================ */
async function vueIndicateurs(){
  const [{ data: d, error }, { data: sansExpl }] = await Promise.all([
    db.rpc('indicateurs_produit'),
    db.from('questions').select('id, enonce, matieres(nom)').eq('statut','publie').is('explication', null).limit(40)
  ]);
  if(error) return erreur(error, 'Lecture impossible');
  const pc = v => (v === null || v === undefined) ? '—' : v + ' %';
  const a = d.activation || {}, r = d.retention || {}, ap = d.apprentissage || {}, ac = d.acquisition || {};
  $('#vue').innerHTML = `
    <h2 class="titre">Indicateurs</h2>
    <p class="sous">Mesurer l'utilité, pas seulement les visites. Calculé sur les 30 derniers jours sauf mention contraire.</p>
    <div class="bloc"><div class="carte"><table><tbody>
      <tr><td><b>Activation</b><br><small>Nouveaux comptes qui font 10 questions ou une composition dès le premier jour</small></td><td class="num">${a.actives ?? 0} / ${a.inscrits ?? 0} (${pc(a.inscrits ? Math.round(100 * a.actives / a.inscrits) : null)})</td></tr>
      <tr><td><b>Rétention</b><br><small>Comptes revenus travailler 1, 7 et 30 jours après l'inscription</small></td><td class="num">J1 ${pc(r.j1)} · J7 ${pc(r.j7)} · J30 ${pc(r.j30)}</td></tr>
      <tr><td><b>Apprentissage</b><br><small>Erreurs reprises puis réussies dans « Mes erreurs »</small></td><td class="num">${ap.reussies ?? 0} / ${ap.reprises ?? 0} (${pc(ap.taux)})</td></tr>
      <tr><td><b>Acquisition par recommandation</b><br><small>Sessions arrivées par un lien partagé · partages faits</small></td><td class="num">${ac.arrivees_lien ?? 0} · ${ac.partages ?? 0}</td></tr>
      <tr><td><b>À traiter</b></td><td>${d.signalements} signalement(s) · ${d.propositions} proposition(s) · ${d.sans_explication} question(s) sans explication</td></tr>
    </tbody></table></div></div>
    <div class="bloc"><div class="libelle">Préparation à l'examen · compositions par semaine</div><div class="carte">
      ${(d.compositions || []).length ? `<table><thead><tr><th>Semaine du</th><th>Compositions</th><th>Moyenne</th></tr></thead><tbody>
        ${d.compositions.map(c => `<tr><td>${E(c.semaine)}</td><td class="num">${c.n}</td><td class="num">${c.moyenne ?? '—'} %</td></tr>`).join('')}</tbody></table>` : '<div class="vide">Aucune composition sur la période.</div>'}
    </div></div>
    <div class="bloc"><div class="libelle">Questions publiées sans explication (40 premières)</div><div class="carte">
      <p class="sous">Une explication transforme une erreur en apprentissage. Complétez-les dans « Questions ».</p>
      ${(sansExpl || []).map(q => `<div style="padding:6px 0;border-bottom:1px solid var(--trait, #333)"><small>${E(q.matieres ? q.matieres.nom : '')}</small><br>${E(q.enonce)}</div>`).join('') || '<div class="vide">Toutes les questions ont une explication.</div>'}
    </div></div>`;
}

/* ============================================================
   PROPOSITIONS DES CANDIDATS
   ============================================================ */
async function vuePropositions(){
  const { data, error } = await db.from('propositions_candidats')
    .select('id, enonce, options, bonne, explication, source, statut, cree_le, niveau, matieres(nom)')
    .order('cree_le', { ascending:false }).limit(100);
  if(error) return erreur(error, 'Lecture impossible');
  $('#vue').innerHTML = `
    <h2 class="titre">Propositions des candidats</h2>
    <p class="sous">Des candidats proposent des questions. Vérifiez la bonne réponse et la source avant de publier : le candidat est prévenu quand sa question entre dans la banque.</p>
    <div class="bloc">${!(data || []).length ? '<div class="carte"><div class="vide">Aucune proposition.</div></div>' : data.map(p => `
      <div class="carte" style="margin-bottom:10px;${p.statut === 'nouvelle' ? '' : 'opacity:.6'}">
        <small>${E(p.matieres ? p.matieres.nom : '—')} · ${E(p.niveau || 'tous niveaux')} · ${E(dateHeure(p.cree_le))} · ${E(p.statut)}</small>
        <p style="margin-top:6px"><b>${E(p.enonce)}</b></p>
        <ol type="A" style="margin:4px 0 0 20px">${(p.options || []).map((o, i) => `<li${i === p.bonne ? ' style="font-weight:bold;color:#0E7A54"' : ''}>${E(o)}${i === p.bonne ? ' ✓' : ''}</li>`).join('')}</ol>
        ${p.explication ? `<p style="margin-top:6px"><small>Explication : ${E(p.explication)}</small></p>` : ''}
        ${p.source ? `<p><small>Source : ${E(p.source)}</small></p>` : ''}
        ${p.statut === 'nouvelle' ? `<div style="margin-top:8px"><button class="lien" data-prop="${p.id}|1">publier</button><button class="lien" style="margin-left:12px" data-prop="${p.id}|0">rejeter</button></div>` : ''}
      </div>`).join('')}</div>`;
  $$('[data-prop]').forEach(b => b.onclick = async () => {
    const [id, pub] = b.dataset.prop.split('|');
    const { data: r, error: e2 } = await db.rpc('valider_proposition_candidat', { p_id: +id, p_publier: pub === '1' });
    if(e2) return erreur(e2, 'Traitement impossible');
    signal(r && r.ok ? (pub === '1' ? 'Question publiée.' : 'Proposition rejetée.') : ((r && r.message) || 'Impossible.'), r && r.ok ? 'bien' : 'mal');
    vuePropositions();
  });
}

/* =====================================================================
   TABLEAU DE BORD — la croissance, qui est là, où ils passent leur temps
   ===================================================================== */
const NOMS_ECRANS = {
  aujourdhui:'Actualité (accueil)', actualite:'Article d\'actualité', revisions:'Mes cours', cours:'Anciens sujets et recherche',
  lecture:'Lecture d\'un cours', qcm:'QCM de révision', grille:'Composition (feuille)', copie:'Copie corrigée',
  cahier:'Mes erreurs', compte:'Mon compte', parcours:'Mon parcours', defi:'Défis entre amis', top:'Top 10',
  qdj:'Question du jour', pourtoi:'Fil « Pour toi »', gagnants:'Résultats nationale', notion:'Notion du jour',
  recherche:'Recherche', proposer:'Proposer une question', horsligne:'Révision hors ligne', suppression:'Suppression du compte',
  engagement:'Accueil découverte', testIntro:'Test d\'entrée (début)', test:'Test d\'entrée', resultat:'Résultat du test',
  inscription:'Inscription', connexion:'Connexion', apparence:'Apparence', abonnement:'Abonnement', paiement:'Paiement',
  question:'Question partagée', communaute:'Communauté', assiduite:'Assiduité'
};
const NOMS_ACTIONS = {
  COMPOSITION_SUBMITTED:'Copies remises', COMPOSITION_COMPLETED:'Compositions terminées', COMPOSITION_ANSWER_SELECTED:'Cases noircies en composition',
  COMPOSITION_QUIT:'Compositions quittées', COMPOSITION_RESTARTED:'Compositions recommencées',
  QUESTION_ANSWERED:'Questions de révision répondues', DAILY_QUESTION_ANSWERED:'Questions du jour répondues',
  FEED_OPENED:'Fil « Pour toi » ouvert', FEED_ANSWERED:'Questions du fil répondues',
  COURSE_OPENED:'Cours ouverts', COURSE_STARTED:'Cours commencés', COURSE_READ:'Cours lus jusqu\'au bout', COURSE_DOWNLOADED:'Cours téléchargés',
  SHEET_DOWNLOADED:'Feuilles de composition téléchargées', DOCUMENT_DOWNLOADED:'Documents PDF téléchargés',
  ERRORS_OPENED:'« Mes erreurs » ouvert', ERRORS_EXPORTED:'Cahiers d\'erreurs exportés',
  CHALLENGE_CREATED:'Défis créés', CHALLENGE_DONE:'Défis joués', CHALLENGE_SHARED:'Défis envoyés sur WhatsApp',
  CHALLENGE_ACCEPTED:'Défis acceptés', CHALLENGE_DECLINED:'Défis refusés',
  NATIONAL_REGISTERED:'Inscriptions à la nationale', NATIONAL_DECLINED:'Nationale refusée',
  RESULT_CARD_SHARED:'Cartes de résultat partagées', PROGRESS_CARD_SHARED:'Cartes de progression partagées',
  QUESTION_SHARED:'Questions partagées', DAILY_QUESTION_SHARED:'Questions du jour partagées', SHARE:'Partages', SHARE_OPENED:'Menu de partage ouvert',
  BADGE_EARNED:'Badges gagnés', LEVEL_REACHED:'Niveaux atteints', CERTIFICATE_DOWNLOADED:'Attestations téléchargées',
  OFFLINE_PACK_DOWNLOADED:'Packs hors ligne téléchargés', REMINDER_ENABLED:'Rappels activés', REMINDER_PROMPT_SHOWN:'Rappel proposé', REMINDER_PROMPT_ACCEPTED:'Rappel accepté depuis la fenêtre', REMINDER_PROMPT_LATER:'Rappel remis à plus tard', REMINDER_PROMPT_OTHER_HOUR:'Autre heure demandée', REMINDER_PERMISSION_DENIED:'Notifications refusées', REMINDER_UNAVAILABLE:'Rappels impossibles sur le téléphone', REMINDER_BANNER_HIDDEN:'Bandeau de rappel masqué', REMINDER_WHATSAPP_CLICK:'Clics vers la communauté WhatsApp (rappel)', DAILY_GOAL_SET:'Objectifs du jour choisis',
  ACCOUNT_CREATED:'Comptes créés', ACCOUNT_DELETED:'Comptes supprimés', LEVEL_CHANGED:'Changements de niveau',
  DIAGNOSTIC_STARTED:'Tests d\'entrée commencés', DIAGNOSTIC_COMPLETED:'Tests d\'entrée terminés', DIAGNOSTIC_RESULT_VIEWED:'Résultats du test vus',
  DIAGNOSTIC_ANSWER_SELECTED:'Réponses au test d\'entrée', ONBOARDING_STEP_COMPLETED:'Étapes d\'accueil franchies',
  NEWS_LIST_VIEWED:'Liste des actualités vue', QUESTION_REPORTED:'Questions signalées', TARGET_EXAM_SET:'Concours visé choisi',
  ERROR_OCCURRED:'Erreurs techniques', SCREEN_ERROR:'Écrans en panne', ERROR_REATTEMPTED:'Nouvel essai après erreur',
  ARRIVED_FROM:'Arrivées par un lien', PAYMENT_STARTED:'Paiements commencés', PAYMENT_DECLARED:'Paiements déclarés',
  PAYMENT_ABANDONED:'Paiements abandonnés', PAYMENT_PROOF_SENT:'Preuves de paiement', SUBSCRIPTION_PAGE_VIEWED:'Page abonnement vue',
  SUBSCRIPTION_PLAN_SELECTED:'Formule choisie', PAYWALL_VIEWED:'Propositions de Pass vues', PAYWALL_CLICKED:'Propositions de Pass touchées',
  PAYWALL_DISMISSED:'« À demain » touché', PAYMENT_SENT:'Captures envoyées', PROXY_PAY_SHARED:'« Un proche paie » partagé', CODE_REDEEMED:'Codes utilisés',
  INVITATION_SHOWN:'Fenêtres d\'invitation vues', WEEK_PLAN_CREATED:'Plans de semaine créés', LAST_FAULTS_STARTED:'Séances « dernières fautes »',
  ERRORS_READ_INLINE:'Cahier lu dans l\'application'
};
const nomAction = n => NOMS_ACTIONS[n] || String(n || '').replace(/_/g, ' ').toLowerCase();
const nomEcran = e => NOMS_ECRANS[e] || e || '—';
const jourCourt = iso => new Date(iso + 'T12:00:00Z').toLocaleDateString('fr-FR', { day:'numeric', month:'short' });

/* petits graphiques dessinés à la main (aucune bibliothèque à charger) */
function graphiqueCroissance(serie, avant){
  if(!serie.length) return insuffisant();
  const W = 720, H = 200, g = 44, d = 14, h0 = 18, b = 30;
  let cumul = avant || 0;
  const pts = serie.map(s => (cumul += s.inscrits));
  const max = Math.max(1, ...pts), min = Math.min(...pts, avant || 0);
  const lo = Math.max(0, min - Math.ceil((max - min) * .15)), hi = max + Math.ceil((max - lo) * .1) || 1;
  const X = i => g + (serie.length === 1 ? (W - g - d) / 2 : i * (W - g - d) / (serie.length - 1));
  const Y = v => h0 + (H - h0 - b) * (1 - (v - lo) / Math.max(1, hi - lo));
  const ligne = pts.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join(' ');
  const aire = ligne + ` L${X(pts.length - 1).toFixed(1)} ${H - b} L${X(0).toFixed(1)} ${H - b} Z`;
  const pas = Math.max(1, Math.ceil(serie.length / 6));
  const graduations = [lo, Math.round((lo + hi) / 2), hi];
  return `<svg viewBox="0 0 ${W} ${H}" class="graphe" role="img" aria-label="Inscrits au total, jour par jour">
    ${graduations.map(v => `<line x1="${g}" x2="${W - d}" y1="${Y(v)}" y2="${Y(v)}" class="gr-grille"/><text x="${g - 8}" y="${Y(v) + 4}" text-anchor="end" class="gr-axe">${nombre(v)}</text>`).join('')}
    <path d="${aire}" class="gr-aire"/><path d="${ligne}" class="gr-ligne"/>
    ${pts.map((v, i) => `<circle cx="${X(i)}" cy="${Y(v)}" r="${i === pts.length - 1 ? 4.5 : 2.2}" class="gr-point${i === pts.length - 1 ? ' fort' : ''}"><title>${jourCourt(serie[i].jour)} : ${nombre(v)} inscrits (+${serie[i].inscrits})</title></circle>`).join('')}
    ${serie.map((s, i) => i % pas === 0 || i === serie.length - 1 ? `<text x="${X(i)}" y="${H - 9}" text-anchor="middle" class="gr-axe">${jourCourt(s.jour)}</text>` : '').join('')}
  </svg>`;
}
function graphiqueBarres(valeurs, etiquettes, titre, options){
  options = options || {};
  if(!valeurs.length || Math.max(...valeurs) === 0) return insuffisant(options.vide);
  const W = options.largeur || 720, H = options.hauteur || 170, g = 34, d = 8, h0 = 14, b = 26;
  const max = Math.max(1, ...valeurs), n = valeurs.length, larg = (W - g - d) / n;
  const pas = options.pas || Math.max(1, Math.ceil(n / 8));
  const fort = options.fort === undefined ? valeurs.indexOf(max) : options.fort;
  return `<svg viewBox="0 0 ${W} ${H}" class="graphe" role="img" aria-label="${E(titre)}">
    <line x1="${g}" x2="${W - d}" y1="${H - b}" y2="${H - b}" class="gr-grille"/>
    <text x="${g - 6}" y="${h0 + 4}" text-anchor="end" class="gr-axe">${nombre(max)}</text>
    ${valeurs.map((v, i) => {
      const hh = (H - h0 - b) * v / max, x = g + i * larg + larg * .15;
      return `<rect x="${x.toFixed(1)}" y="${(H - b - hh).toFixed(1)}" width="${(larg * .7).toFixed(1)}" height="${Math.max(v ? 1.5 : 0, hh).toFixed(1)}" rx="2" class="gr-barre${i === fort ? ' fort' : ''}"><title>${E(etiquettes[i])} : ${nombre(v)}</title></rect>`;
    }).join('')}
    ${etiquettes.map((t, i) => i % pas === 0 ? `<text x="${(g + i * larg + larg / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle" class="gr-axe">${E(t)}</text>` : '').join('')}
  </svg>`;
}
const tendance = (n, avant) => {
  if(!avant) return n ? '<span class="tend hausse">nouveau</span>' : '';
  const p = Math.round(100 * (n - avant) / avant);
  return `<span class="tend ${p >= 0 ? 'hausse' : 'baisse'}">${p >= 0 ? '+' : ''}${p} % vs 7 j avant</span>`;
};

let minuteurTableau = null;
async function vueTableau(){
  clearTimeout(minuteurTableau);
  const j = A.plage ? periode : ([7, 30, 90].includes(periode) ? periode : 30);
  $('#vue').innerHTML = `
    <h2 class="titre">Tableau de bord</h2>
    <p class="sous">La croissance, qui est là en ce moment, et ce que les candidats font vraiment. Mis à jour toutes les minutes.</p>
    ${choixPeriode([[7,'7 jours'],[30,'30 jours'],[90,'90 jours']])}
    <div id="zone-tableau">Chargement…</div>`;
  brancherPeriode(vueTableau);
  const { data: t, error } = await rpcPeriode('tableau_de_bord', j);
  if(error) return erreur(error, 'Lecture impossible');
  const z = document.getElementById('zone-tableau');
  if(!z || A.vue !== 'tableau') return;

  const croiss = t.croissance || [], heures = t.heures || [], zones = (t.zones || []).filter(x => x.ecran);
  const totalMin = zones.reduce((a, x) => a + Number(x.minutes || 0), 0) || 1;
  const maxZ = Math.max(1, ...zones.map(x => Number(x.minutes || 0)));
  const actions = t.actions || [], maxA = Math.max(1, ...actions.map(a => a.n));
  const nv = t.nouveautes || {};
  const heurePic = heures.length ? heures.reduce((a, x) => x.n > a.n ? x : a, heures[0]) : null;
  const zone1 = zones[0];

  z.innerHTML = `
    <div class="compteurs six">
      <div class="compteur en-ligne cliquable" data-vers="direct"><div class="v num"><i class="pouls"></i>${nombre(t.en_ligne)}</div><div class="l">En ligne maintenant</div>
        <div class="d">${nombre(t.en_ligne_comptes)} connecté${t.en_ligne_comptes > 1 ? 's' : ''} · ${nombre(t.en_composition)} en composition</div></div>
      <div class="compteur cliquable" data-vers="direct"><div class="v num">${nombre(t.actifs_jour)}</div><div class="l">Actifs aujourd'hui</div>
        <div class="d">${nombre(t.visiteurs_jour)} visiteurs en tout</div></div>
      <div class="compteur cliquable" data-vers="candidats"><div class="v num">${nombre(t.inscrits)}</div><div class="l">Inscrits au total</div>
        <div class="d">+${nombre(t.nouveaux_jour)} aujourd'hui</div></div>
      <div class="compteur cliquable" data-vers="candidats"><div class="v num">+${nombre(t.nouveaux_7j)}</div><div class="l">Nouveaux sur 7 jours</div>
        <div class="d">${tendance(t.nouveaux_7j, t.nouveaux_7j_avant)}</div></div>
      <div class="compteur cliquable" data-vers="candidats"><div class="v num">${nombre(t.actifs_7j)}</div><div class="l">Actifs sur 7 jours</div>
        <div class="d">${t.inscrits ? Math.round(100 * t.actifs_7j / t.inscrits) : 0} % des inscrits</div></div>
      <div class="compteur cliquable" data-vers="analytique"><div class="v num">${nombre(t.questions_jour)}</div><div class="l">Questions aujourd'hui</div>
        <div class="d">${nombre(t.compositions_jour)} composition${t.compositions_jour > 1 ? 's' : ''} aujourd'hui</div></div>
      <div class="compteur cliquable" data-vers="assiduite"><div class="v num" id="cpt-jamais">…</div><div class="l">Venus une fois, jamais revenus</div>
        <div class="d" id="cpt-jamais-d">baisse dès qu'ils reviennent</div></div>
    </div>

    <div class="bloc">
      <div class="libelle">La croissance<span>inscrits au total, ${libellePeriode(j)}</span></div>
      <div class="carte">${graphiqueCroissance(croiss, t.avant_periode)}
        <p class="sous" style="font-size:12.5px;margin-top:6px">${nombre(croiss.reduce((a, s) => a + s.inscrits, 0))} inscriptions sur la période. Survolez un point pour le détail du jour.</p></div>
    </div>

    <div class="deux-col">
      <div class="bloc">
        <div class="libelle">Candidats actifs par jour</div>
        <div class="carte">${graphiqueBarres(croiss.map(s => s.actifs), croiss.map(s => jourCourt(s.jour)), 'Candidats actifs par jour', { fort: croiss.length - 1, largeur: 420, hauteur: 190 })}</div>
      </div>
      <div class="bloc">
        <div class="libelle">Les heures où ils viennent<span>7 derniers jours, heure de Ouagadougou</span></div>
        <div class="carte">${graphiqueBarres(heures.map(x => x.n), heures.map(x => x.h + ' h'), 'Visites par heure', { pas: 3, largeur: 420, hauteur: 190 })}
          ${heurePic && heurePic.n ? `<p class="sous" style="font-size:12.5px;margin-top:6px">Le pic est vers <b>${heurePic.h} h</b> : le bon moment pour les rappels et les annonces.</p>` : ''}</div>
      </div>
    </div>

    <div class="bloc">
      <div class="libelle">Où ils passent leur temps<span>${libellePeriode(j)}</span></div>
      <div class="carte">
        ${!zones.length ? insuffisant() : `
        ${zone1 ? `<p class="sous" style="margin-top:0">« ${E(nomEcran(zone1.ecran))} » prend <b>${Math.round(100 * zone1.minutes / totalMin)} %</b> du temps passé sur le site.</p>` : ''}
        <table><thead><tr><th>Zone</th><th>Temps total</th><th>Part</th><th>Visites</th><th>Personnes</th><th>Durée moyenne</th></tr></thead><tbody>
        ${zones.slice(0, 18).map(x => `<tr class="cliquable" data-zone="${E(x.ecran)}">
          <td>${E(nomEcran(x.ecran))}${barreHorizontale(Number(x.minutes), maxZ)}</td>
          <td class="num">${dureeLisible(x.minutes)}</td>
          <td class="num">${Math.round(100 * x.minutes / totalMin)} %</td>
          <td class="num">${nombre(x.visites)}</td>
          <td class="num">${nombre(x.personnes)}</td>
          <td class="num" style="${x.moyenne_s < 15 ? 'color:var(--rouge-texte)' : ''}">${x.moyenne_s} s</td></tr>`).join('')}
        </tbody></table>
        <p class="sous" style="font-size:12.5px">Une durée moyenne très courte (en rouge) veut dire que les candidats passent sans s'arrêter : la zone n'accroche pas ou sert seulement de passage.</p>`}
      </div>
    </div>

    <div class="bloc">
      <div class="libelle">Ce qu'ils font le plus<span>${libellePeriode(j)}</span></div>
      <div class="carte">
        ${!actions.length ? insuffisant('Aucune action observée.') : `
        <table><thead><tr><th>Action</th><th>Fois</th><th>Personnes</th></tr></thead><tbody>
        ${actions.map(a => `<tr class="cliquable" data-action="${E(a.nom)}"><td>${E(nomAction(a.nom))}${barreHorizontale(a.n, maxA, 'var(--or)')}</td>
          <td class="num">${nombre(a.n)}</td><td class="num">${nombre(a.personnes)}</td></tr>`).join('')}
        </tbody></table>`}
      </div>
    </div>

    <div class="bloc">
      <div class="libelle">Les nouveautés : sont-elles utilisées ?<span>${libellePeriode(j)}</span></div>
      <div class="carte"><div class="mini-compteurs">
        ${[['Inscriptions à la nationale', nv.nationale_inscrits], ['Défis créés', nv.defis], ['Invitations à des défis', nv.invitations],
           ['Packs hors ligne', nv.packs], ['Cartes de résultat partagées', nv.cartes], ['Attestations téléchargées', nv.attestations],
           ['Badges gagnés', nv.badges], ['Relances J+3 / J+7 envoyées', nv.relances], ['Revenus après une relance', nv.retours_relance],
           ['Rappels actifs (notifications)', t.push_actifs]]
          .map(([l, v]) => `<div><b class="num">${nombre(v || 0)}</b><span>${l}</span></div>`).join('')}
      </div></div>
    </div>

    <div class="deux-col">
      <div class="bloc">
        <div class="libelle">Leurs téléphones</div>
        <div class="carte">${(t.appareils || []).length ? `<table><tbody>${t.appareils.map(a => `<tr><td>${E(a.systeme)}</td><td class="num">${nombre(a.n)}</td></tr>`).join('')}</tbody></table>` : insuffisant()}</div>
      </div>
      <div class="bloc">
        <div class="libelle">Sécurité</div>
        <div class="carte">
          <div class="mini-compteurs">
            <div><b class="num">${nombre(t.bannis)}</b><span>Comptes bannis</span></div>
            <div><b class="num">${nombre(t.suppressions_30j)}</b><span>Comptes supprimés (30 j)</span></div>
          </div>
          <button class="cta creux petit" style="margin-top:12px" data-aller="bannissement">Voir les comptes à surveiller</button>
        </div>
      </div>
    </div>`;
  $$('[data-aller]').forEach(b => b.onclick = () => { A.vue = b.dataset.aller; rendre(); });
  /* « venus une seule fois, jamais revenus » : chargé à part pour ne jamais ralentir le tableau */
  db.rpc('admin_assiduite_resume').then(({ data: ra, error: er }) => {
    const c = document.getElementById('cpt-jamais'); if(!c) return;
    if(er || !ra){ c.textContent = '—'; const d0 = document.getElementById('cpt-jamais-d'); if(d0) d0.textContent = 'lecture impossible, touchez Actualiser'; return; }
    c.textContent = nombre(ra.jamais_revenus);
    const d = document.getElementById('cpt-jamais-d');
    if(d) d.textContent = nombre(ra.revenus) + ' sont revenus · baisse dès qu\'ils reviennent';
  }).catch(() => {});
  /* le tableau se redessine seul chaque minute ; jamais pendant que la souris est sur un bouton, pour ne pas avaler le clic */
  const reessayer = () => {
    if(A.vue !== 'tableau') return;
    if(document.querySelector('#vue button:hover, #vue .cliquable:hover, #vue a:hover')) minuteurTableau = setTimeout(reessayer, 4000);
    else vueTableau();
  };
  minuteurTableau = setTimeout(reessayer, 60000);
}
function dureeLisible(min){
  min = Number(min) || 0;
  if(min < 1) return Math.round(min * 60) + ' s';
  if(min < 60) return Math.round(min) + ' min';
  return Math.floor(min / 60) + ' h ' + String(Math.round(min % 60)).padStart(2, '0');
}

/* =====================================================================
   BANNISSEMENT — repérer, suspendre, réintégrer
   ===================================================================== */
async function appelerBannir(corps){
  const { data, error } = await db.functions.invoke('admin-bannir', { body: corps });
  if(error){
    let m = '';
    try{ m = (await error.context.json()).message; }catch(e){}
    return { ok:false, message: m || 'Action impossible.' };
  }
  return data || { ok:false };
}
async function vueBannissement(){
  $('#vue').innerHTML = `
    <h2 class="titre">Bannissement</h2>
    <p class="sous">Les comptes au comportement anormal sont repérés automatiquement. Un compte banni ne peut plus se connecter ; ses rappels sont coupés. Tout est inscrit au journal.</p>
    <div class="bloc">
      <div class="libelle">Chercher un candidat</div>
      <div class="carte">
        <div class="rangee"><input id="b-cherche" placeholder="Numéro, nom ou pseudo" style="flex:1;min-width:200px"><button class="cta petit" id="b-go">Chercher</button></div>
        <div id="b-resultats" style="margin-top:10px"></div>
      </div>
    </div>
    <div class="bloc"><div class="libelle">À surveiller<span>repérés automatiquement</span></div><div class="carte" id="b-suspects">Chargement…</div></div>
    <div class="bloc"><div class="libelle">Bannis en ce moment</div><div class="carte" id="b-bannis">Chargement…</div></div>
    <div class="bloc"><div class="libelle">Historique</div><div class="carte" id="b-histo">Chargement…</div></div>`;

  const ligneCompte = (p, extra) => `<tr>
    <td><b class="cliquable" data-fiche="${E(p.id)}">${E(p.nom || '—')}</b>${p.pseudo ? ` <span style="color:var(--craie2)">· ${E(p.pseudo)}</span>` : ''}<br>
      <span class="num" style="font-size:11px;color:var(--craie2)">${p.telephone ? '+226 ' + E(p.telephone) : 'sans numéro'} · inscrit le ${dateCourte(p.cree_le)}</span>${extra || ''}</td>
    <td style="text-align:right;white-space:nowrap">${p.banni
      ? `<button class="lien" data-lever="${E(p.id)}">réintégrer</button>`
      : `<button class="lien danger" data-bannir="${E(p.id)}" data-qui="${E(p.nom || p.telephone || '')}">bannir</button>`}</td></tr>`;

  const [{ data: sus, error: e1 }, { data: bans }] = await Promise.all([
    db.rpc('candidats_suspects'),
    db.from('bannissements').select('id, user_id, nom, motif, jusqu_au, par, cree_le, leve_le, leve_par').order('cree_le', { ascending:false }).limit(200)
  ]);
  if(e1) erreur(e1, 'Détection impossible');
  const actifs = (bans || []).filter(b => !b.leve_le && (!b.jusqu_au || new Date(b.jusqu_au) > new Date()));
  const zs = document.getElementById('b-suspects'); if(!zs) return;
  zs.innerHTML = !(sus || []).length
    ? `<div class="vide">Aucun comportement anormal repéré.<br><span style="font-size:12.5px">Sont surveillés : codes faux en série, « code oublié » raté, invitations en masse, rythme de robot, signalements en rafale, noms qui imitent l'équipe.</span></div>`
    : `<table><tbody>${sus.map(p => ligneCompte(p, `<div class="raisons">${(p.raisons || []).map(r => `<span>${E(r)}</span>`).join('')}</div>`)).join('')}</tbody></table>`;
  document.getElementById('b-bannis').innerHTML = !actifs.length ? '<div class="vide">Personne n\'est banni.</div>'
    : `<table><thead><tr><th>Candidat</th><th>Motif</th><th>Jusqu'au</th><th></th></tr></thead><tbody>${actifs.map(b => `<tr>
        <td><b${b.user_id ? ` class="cliquable" data-fiche="${E(b.user_id)}"` : ''}>${E(b.nom || '—')}</b></td>
        <td>${E(b.motif)}</td><td class="num">${b.jusqu_au ? dateCourte(b.jusqu_au) : 'définitif'}</td>
        <td style="text-align:right"><button class="lien" data-lever="${E(b.user_id)}">réintégrer</button></td></tr>`).join('')}</tbody></table>`;
  document.getElementById('b-histo').innerHTML = !(bans || []).length ? '<div class="vide">Aucun bannissement pour l\'instant.</div>'
    : `<table><thead><tr><th>Date</th><th>Candidat</th><th>Motif</th><th>État</th></tr></thead><tbody>${bans.slice(0, 50).map(b => `<tr>
        <td class="num">${dateCourte(b.cree_le)}</td><td>${b.user_id ? `<span class="cliquable" data-fiche="${E(b.user_id)}">${E(b.nom || '—')}</span>` : E(b.nom || '—')}</td><td>${E(b.motif)}</td>
        <td>${b.leve_le ? 'levé le ' + dateCourte(b.leve_le) : (b.jusqu_au && new Date(b.jusqu_au) <= new Date() ? 'expiré' : 'en cours')}</td></tr>`).join('')}</tbody></table>`;

  const brancher = () => {
    $$('[data-bannir]').forEach(b => b.onclick = () => fenetreBannir(b.dataset.bannir, b.dataset.qui));
    $$('[data-lever]').forEach(b => b.onclick = async () => {
      if(!confirm('Réintégrer ce candidat ? Il pourra de nouveau se connecter.')) return;
      const r = await appelerBannir({ user_id: b.dataset.lever, action:'lever' });
      signal(r.ok ? 'Candidat réintégré.' : r.message, r.ok ? 'bien' : 'mal');
      if(r.ok) vueBannissement();
    });
  };
  brancher();

  const chercher = async () => {
    const q = document.getElementById('b-cherche').value.trim();
    const zr = document.getElementById('b-resultats');
    if(q.length < 2){ zr.innerHTML = ''; return; }
    const chiffres = q.replace(/\D/g, '');
    const motif = '%' + q.replace(/[%_,()]/g, ' ') + '%';
    let req = db.from('profils').select('id, nom, pseudo, telephone, cree_le').limit(20);
    req = chiffres.length >= 4 ? req.ilike('telephone', '%' + chiffres + '%') : req.or(`nom.ilike.${motif},pseudo.ilike.${motif}`);
    const { data, error } = await req;
    if(error) return erreur(error, 'Recherche impossible');
    const bannisIds = new Set(actifs.map(b => b.user_id));
    zr.innerHTML = !(data || []).length ? '<div class="vide">Aucun candidat trouvé.</div>'
      : `<table><tbody>${data.map(p => ligneCompte({ ...p, banni: bannisIds.has(p.id) })).join('')}</tbody></table>`;
    brancher();
  };
  document.getElementById('b-go').onclick = chercher;
  document.getElementById('b-cherche').onkeydown = e => { if(e.key === 'Enter') chercher(); };
}
function fenetreBannir(id, qui){
  const f = document.createElement('div');
  f.className = 'fenetre';
  f.innerHTML = `<div class="fenetre-boite" role="dialog" aria-modal="true" aria-label="Bannir un candidat">
    <h3>Bannir ${E(qui || 'ce candidat')}</h3>
    <p class="sous">Il ne pourra plus se connecter. Vous pourrez le réintégrer à tout moment.</p>
    <label for="bf-motif">Motif (gardé au journal)</label>
    <input id="bf-motif" placeholder="Ex. : se fait passer pour l'équipe, triche, insultes…" maxlength="300">
    <label for="bf-duree" style="margin-top:12px">Durée</label>
    <select id="bf-duree"><option value="1">1 jour</option><option value="7" selected>7 jours</option><option value="30">30 jours</option><option value="0">Définitif</option></select>
    <div class="rangee" style="margin-top:16px;justify-content:flex-end">
      <button class="cta creux petit" data-fermer>Annuler</button>
      <button class="cta petit danger" data-confirmer>Bannir</button>
    </div></div>`;
  document.body.appendChild(f);
  const fermer = () => f.remove();
  f.querySelector('[data-fermer]').onclick = fermer;
  f.onclick = e => { if(e.target === f) fermer(); };
  f.querySelector('#bf-motif').focus();
  f.querySelector('[data-confirmer]').onclick = async () => {
    const motif = f.querySelector('#bf-motif').value.trim();
    if(motif.length < 3) return signal('Indiquez le motif.', 'mal');
    const bouton = f.querySelector('[data-confirmer]'); bouton.disabled = true; bouton.textContent = 'Bannissement…';
    const r = await appelerBannir({ user_id: id, action:'bannir', motif, jours: Number(f.querySelector('#bf-duree').value) });
    fermer();
    signal(r.ok ? 'Candidat banni.' : r.message, r.ok ? 'bien' : 'mal');
    if(r.ok) vueBannissement();
  };
}

/* =====================================================================
   MON ACCÈS — changer son mot de passe, retrouver l'adresse
   ===================================================================== */
function vueAcces(){
  const email = A.session && A.session.user ? A.session.user.email : '';
  $('#vue').innerHTML = `
    <h2 class="titre">Mon accès</h2>
    <p class="sous">Vos identifiants d'administration. Notez-les dans un endroit sûr.</p>
    <div class="bloc"><div class="carte">
      <table><tbody>
        <tr><td>Adresse de l'administration</td><td><b>${E(location.origin)}/admin.html</b></td></tr>
        <tr><td>Raccourci caché dans l'application</td><td>Touchez 5 fois de suite le logo Mon Concours en haut à gauche</td></tr>
        <tr><td>Votre identifiant</td><td><b>${E(email)}</b></td></tr>
      </tbody></table>
    </div></div>
    <div class="bloc"><div class="libelle">Changer mon mot de passe</div><div class="carte">
      <div class="deux">
        <div><label for="m-n1">Nouveau mot de passe</label><input id="m-n1" type="password" autocomplete="new-password" placeholder="10 caractères au moins"></div>
        <div><label for="m-n2">Encore une fois</label><input id="m-n2" type="password" autocomplete="new-password"></div>
      </div>
      <button class="cta petit" id="m-changer" style="margin-top:12px">Enregistrer le nouveau mot de passe</button>
      <p class="sous" style="font-size:12.5px">Si vous l'oubliez, la page de connexion propose « Mot de passe oublié ? » : un lien arrive sur ${E(email || 'votre adresse')}.</p>
    </div></div>`;
  document.getElementById('m-changer').onclick = async () => {
    const a = document.getElementById('m-n1').value, b = document.getElementById('m-n2').value;
    if(a.length < 10) return signal('10 caractères au moins.', 'mal');
    if(a !== b) return signal('Les deux mots de passe ne sont pas identiques.', 'mal');
    const { error } = await db.auth.updateUser({ password: a });
    if(error) return erreur(error, 'Changement impossible');
    document.getElementById('m-n1').value = ''; document.getElementById('m-n2').value = '';
    signal('Mot de passe changé.', 'bien');
  };
}

/* mot de passe oublié : un lien par e-mail, qui revient ici */
async function motDePasseOublie(){
  const z = document.getElementById('err-connexion');
  const email = document.getElementById('email').value.trim().toLowerCase();
  if(!email){ z.textContent = 'Tapez d\'abord votre adresse e-mail, puis touchez « Mot de passe oublié ? ».'; z.hidden = false; return; }
  const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/admin.html' });
  z.textContent = error ? 'Envoi impossible : ' + error.message
    : 'Si cette adresse a un accès, un lien vient de lui être envoyé. Ouvrez-le sur cet appareil pour choisir un nouveau mot de passe.';
  z.hidden = false;
}
function formulaireNouveauMotDePasse(){
  const carte = document.querySelector('.carte-portail');
  if(!carte) return;
  document.getElementById('portail').hidden = false;
  document.getElementById('admin').hidden = true;
  carte.innerHTML = `<h1>Nouveau mot de passe</h1>
    <p class="aide">Choisissez votre nouveau mot de passe d'administration.</p>
    <div class="alerte" id="err-nouveau" hidden></div>
    <label for="nv1">Nouveau mot de passe</label><input id="nv1" type="password" autocomplete="new-password" placeholder="10 caractères au moins">
    <label for="nv2">Encore une fois</label><input id="nv2" type="password" autocomplete="new-password">
    <button class="cta" id="btn-nouveau">Enregistrer et entrer</button>`;
  document.getElementById('btn-nouveau').onclick = async () => {
    const a = document.getElementById('nv1').value, b = document.getElementById('nv2').value;
    const z = document.getElementById('err-nouveau');
    if(a.length < 10 || a !== b){ z.textContent = a.length < 10 ? '10 caractères au moins.' : 'Les deux mots de passe ne sont pas identiques.'; z.hidden = false; return; }
    const { error } = await db.auth.updateUser({ password: a });
    if(error){ z.textContent = error.message; z.hidden = false; return; }
    location.replace('/admin.html');
  };
}

/* ============================================================
   ÉVÉNEMENTS
   ============================================================ */
document.getElementById('btn-connexion').onclick = connexion;
document.getElementById('btn-oubli').onclick = motDePasseOublie;
document.getElementById('motdepasse').addEventListener('keydown',
  e => { if(e.key === 'Enter') connexion(); });

/* « Actualiser » : recharge l'écran en cours sans perdre sa place dans la page */
(function(){
  const b = document.getElementById('btn-actualiser');
  if(!b) return;
  b.onclick = () => {
    const v = document.getElementById('vue'), haut = v ? v.scrollTop : 0;
    b.disabled = true; b.classList.add('tourne');
    try{ rendre(); }catch(e){ erreur(e, 'Actualisation'); }
    setTimeout(() => { if(v) v.scrollTop = haut; b.disabled = false; b.classList.remove('tourne'); }, 900);
  };
})();
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

window.addEventListener('hashchange', () => {
  const h = (location.hash || '').replace('#', '').replace(/[^a-z_]/g, '');
  if(A.session && h && h !== A.vue && document.querySelector('#menu [data-vue="' + h + '"]')){ A.vue = h; rendre(); }
});

/* passerelle vers admin-plus.js : les mêmes outils, sans rien dupliquer */
window.ADMIN = Object.assign(window.ADMIN || {}, {
  get db(){ return db; }, A, E, $, $$, nombre, dateCourte, dateHeure, signal, erreur, rendre, nomEcran, nomAction, jourCourt,
  graphiqueCroissance, graphiqueBarres, barreHorizontale, dureeLisible, insuffisant, statut, majPastilles, choixPeriode, brancherPeriode, libellePeriode,
  isoJour, jourLong, optionsMatieres, optionsConcours, NIVEAUX, NOM_PASS, NOM_OPERATEUR,
  vues: (window.ADMIN && window.ADMIN.vues) || {}
});
Object.defineProperty(window.ADMIN, 'periode', { get: () => periode, set: v => { periode = v; }, configurable: true });
if(window.ADMIN.pret) window.ADMIN.pret();

demarrer();

})();
