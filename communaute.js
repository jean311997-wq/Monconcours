/* =====================================================================
   COMMUNAUTÉ MON CONCOURS
   Chargé à la première visite de l'écran (voir chargerModuleCommunaute
   dans app.js). Tout ce qui est écrit ici passe par la base : le serveur
   masque les numéros et les liens, limite le rythme, fait respecter les
   suspensions. Ce fichier ne fait que montrer et envoyer.
   ===================================================================== */
(function(){
'use strict';

const MAX_POST = 1000, MAX_COM = 500, PAGE = 12;
const FILTRES = [['tout', 'Tout'], ['concours', 'Mon concours'], ['admin', 'Administration'], ['moi', 'Mes publications']];
const UUID = /^[0-9a-f-]{36}$/i;
const CIBLES = ['aujourdhui', 'revisions', 'grille'];

const C = S.comm = S.comm || {
  filtre: 'tout', posts: [], fin: false, chargement: false, charge: false, erreur: '',
  ouvert: {}, enCoeur: {}, jeton: 0,
  compo: { ouvert: false, texte: '', blob: null, apercu: '', carte: null, envoi: false },
  top: {}, topPeriode: 'semaine', info: null, blocage: null, focus: null, curseur: null, nouveaux: 0
};

const racine = () => document.getElementById('cm-racine');
const nb = n => nombreFr(Number(n) || 0);
const texteHtml = t => E(t).replace(/\n{3,}/g, '\n\n').replace(/\n/g, '<br>');
const msg = (e, defaut) => (typeof enFrancais === 'function' ? enFrancais(e, defaut) : defaut);
const initiales = nom => {
  const m = String(nom || '').trim().split(/\s+/).filter(Boolean);
  return (m.length > 1 ? m[0][0] + m[m.length - 1][0] : (m[0] || '?').slice(0, 2)).toUpperCase();
};
async function rpc(nom, args){
  if(!base) throw new Error('Pas de connexion');
  const { data, error } = await base.rpc(nom, args);
  if(error) throw error;
  return data;
}
const trouver = id => C.posts.find(p => p.id === id) || (C.focus && C.focus.post.id === id ? C.focus.post : null);

/* ---------------------------------------------------------------- éléments */
function avatar(nom, teinte, admin, petit){
  if(admin) return `<span class="cm-av adm${petit ? ' p' : ''}" aria-hidden="true">${logoSvg(petit ? 24 : 32)}</span>`;
  return `<span class="cm-av${petit ? ' p' : ''}" style="--t:${Number(teinte) || 150}" aria-hidden="true">${E(initiales(nom))}</span>`;
}
const medaille = r => `<span class="cm-med m${r >= 1 && r <= 3 ? r : 0} num">${Number(r) || ''}</span>`;
const badgeAdmin = () => `<i class="cm-badge">${ico('coche', 11)} Officiel</i>`;
const nomAffiche = o => o.admin ? 'Administration Mon Concours' : (o.nom || 'Candidat');
function urlImage(chemin){
  try{ return base.storage.from('communaute').getPublicUrl(chemin).data.publicUrl; }catch(e){ return ''; }
}

/* ---------------------------------------------------------------- cartes jointes */
function carteHtml(p){
  const c = p.carte;
  if(!c || typeof c !== 'object') return '';
  const tuile = (v, l) => `<div class="cm-tuile"><b class="num">${v}</b><span>${l}</span></div>`;
  if(c.kind === 'progres'){
    const t = [];
    if(c.taux !== undefined) t.push(tuile(nb(c.taux) + ' %', 'de réussite'));
    if(c.questions !== undefined) t.push(tuile(nb(c.questions), 'QCM'));
    if(c.compositions !== undefined) t.push(tuile(nb(c.compositions), Number(c.compositions) === 1 ? 'composition' : 'compositions'));
    if(c.serie) t.push(tuile(nb(c.serie), Number(c.serie) === 1 ? 'jour de suite' : 'jours de suite'));
    return `<div class="cm-carte"><div class="cm-carte-t">${ico('diagnostic', 14)} Ma progression${c.niveau ? ' · ' + E(c.niveau) : ''}</div><div class="cm-tuiles">${t.join('')}</div></div>`;
  }
  if(c.kind === 'resultat'){
    return `<div class="cm-carte"><div class="cm-carte-t">${ico('grille', 14)} ${E(c.titre || 'Mon résultat')}</div>
      <div class="cm-tuiles">${tuile(nb(c.note) + ' / ' + nb(c.sur), 'ma note')}</div></div>`;
  }
  if(c.kind === 'bilan'){
    return `<div class="cm-carte"><div class="cm-carte-t">${ico('diagnostic', 14)} Hier sur Mon Concours</div><div class="cm-tuiles">
      ${tuile(nb(c.candidats), 'candidats')}${tuile(nb(c.questions), 'questions')}${c.compositions ? tuile(nb(c.compositions), Number(c.compositions) === 1 ? 'composition' : 'compositions') : ''}</div></div>`;
  }
  if(c.kind === 'classement'){
    const top = Array.isArray(c.top) ? c.top.slice(0, 5) : [];
    return `<div class="cm-carte"><div class="cm-carte-t">${ico('trophee', 14)} ${E(c.titre || 'Classement')}<span>${nb(c.participants)} candidats</span></div>
      <div class="cm-rangs">${top.map(l => `<div class="cm-rang${Number(l.rang) <= 3 ? ' podium' : ''}">${medaille(l.rang)}<span class="n">${E(l.nom)}</span><span class="s num">${nb(l.score)}<small>/${nb(l.sur)}</small></span></div>`).join('')}</div>
      ${UUID.test(c.epreuve || '') ? `<button class="cm-lien-carte" data-cm-classe="${E(c.epreuve)}">Voir le classement complet <i>→</i></button>` : ''}</div>`;
  }
  if(c.kind === 'top' || c.kind === 'contributeurs'){
    const top = Array.isArray(c.top) ? c.top.slice(0, 3) : [];
    return `<div class="cm-carte"><div class="cm-carte-t">${ico(c.kind === 'top' ? 'trophee' : 'coeur', 14)} ${c.kind === 'top' ? 'En tête des points' : 'Meilleurs contributeurs'}</div>
      <div class="cm-rangs">${top.map(l => `<div class="cm-rang podium">${medaille(l.rang)}<span class="n">${E(l.nom)}</span><span class="s num">${nb(l.points)}<small> pts</small></span></div>`).join('')}</div></div>`;
  }
  if(c.kind === 'epreuve') return `<button class="cm-lien-carte seul" data-cm-aller="aujourdhui">${ico('grille', 15)} Voir la composition <i>→</i></button>`;
  if(c.kind === 'cours') return `<button class="cm-lien-carte seul" data-cm-aller="revisions">${ico('revisions', 15)} Ouvrir Mes cours <i>→</i></button>`;
  if(c.kind === 'actualite') return `<button class="cm-lien-carte seul" data-cm-aller="aujourdhui">${ico('actualite', 15)} Lire l'actualité <i>→</i></button>`;
  return '';
}

/* ---------------------------------------------------------------- une publication */
function postHtml(p, focus){
  const o = C.ouvert[p.id];
  const url = p.image ? urlImage(p.image) : '';
  return `<article class="cm-post${p.admin ? ' adm' : ''}${p.epingle ? ' epingle' : ''}${p.cache ? ' cache' : ''}${focus ? ' focus' : ''}${p.type === 'motivation' ? ' mot' : ''}" id="cm-p-${E(p.id)}">
    <header class="cm-ent">
      ${avatar(p.nom, p.teinte, p.admin)}
      <div class="cm-qui"><span class="cm-nom"><b>${E(nomAffiche(p))}</b>${p.admin ? badgeAdmin() : ''}</span>
        <small>${p.epingle ? `<span class="cm-epingle">${ico('epingle', 11)} Épinglé</span>` : ''}${!p.admin && p.concours ? E(p.concours) + ' · ' : ''}${relatif(p.cree_le)}</small></div>
      ${p.moi ? `<button class="cm-suppr" data-cm-suppr="${E(p.id)}" aria-label="Supprimer ma publication">${ico('corbeille', 16)}</button>` : ''}
    </header>
    ${p.texte ? `<p class="cm-texte">${texteHtml(p.texte)}</p>` : ''}
    ${url ? `<button class="cm-photo" data-cm-photo="${E(url)}" aria-label="Agrandir la photo"><img src="${E(url)}" alt="Photo partagée par ${E(nomAffiche(p))}" loading="lazy" decoding="async"></button>` : ''}
    ${carteHtml(p)}
    <footer class="cm-pied">
      <button class="cm-act cm-coeur${p.aime ? ' on' : ''}" data-cm-coeur="${E(p.id)}" aria-pressed="${!!p.aime}" aria-label="${p.aime ? 'Retirer mon cœur' : 'Aimer cette publication'}">${ico('coeur', 19)}<span class="${p.coeurs ? 'num' : ''}">${p.coeurs ? nb(p.coeurs) : "J'aime"}</span></button>
      <button class="cm-act cm-bulle${o ? ' on' : ''}" data-cm-comm="${E(p.id)}" aria-expanded="${!!o}" aria-label="Commentaires">${ico('bulle', 19)}<span class="${p.comms ? 'num' : ''}">${p.comms ? nb(p.comms) : 'Commenter'}</span></button>
    </footer>
    <div class="cm-comms"${o ? '' : ' hidden'}>${o ? commsHtml(p) : ''}</div>
  </article>`;
}
function majPied(p){
  const art = document.getElementById('cm-p-' + p.id);
  if(!art) return;
  const h = art.querySelector('.cm-coeur'), c = art.querySelector('.cm-bulle');
  if(h){
    h.classList.toggle('on', !!p.aime); h.setAttribute('aria-pressed', String(!!p.aime));
    h.setAttribute('aria-label', p.aime ? 'Retirer mon cœur' : 'Aimer cette publication');
    const t = h.querySelector('span'); t.textContent = p.coeurs ? nb(p.coeurs) : "J'aime"; t.classList.toggle('num', !!p.coeurs);
  }
  if(c){ const t = c.querySelector('span'); t.textContent = p.comms ? nb(p.comms) : 'Commenter'; t.classList.toggle('num', !!p.comms); }
}

/* ---------------------------------------------------------------- commentaires */
function commsHtml(p){
  const o = C.ouvert[p.id];
  if(!o) return '';
  if(o.erreur) return `<p class="cm-vide">Les commentaires n'ont pas pu se charger.</p><button class="cm-lien-carte seul" data-cm-comm-relancer="${E(p.id)}">Réessayer</button>`;
  if(!o.charge) return `<div class="squelette court"></div><div class="squelette court" style="margin-top:8px"></div>`;
  const ids = new Set(o.liste.map(c => c.id)), enfants = {};
  o.liste.forEach(c => { const k = c.parent_id && ids.has(c.parent_id) ? c.parent_id : ''; (enfants[k] = enfants[k] || []).push(c); });
  const sortie = [];
  const marche = (k, prof) => (enfants[k] || []).forEach(c => { sortie.push(comHtml(p, c, prof)); marche(c.id, Math.min(prof + 1, 2)); });
  marche('', 0);
  return `${sortie.join('') || '<p class="cm-vide">Pas encore de commentaire. Soyez le premier.</p>'}${saisieHtml(p, o)}`;
}
function comHtml(p, c, prof){
  return `<div class="cm-com p${prof}" id="cm-c-${E(c.id)}">
    ${avatar(c.nom, c.teinte, c.admin, true)}
    <div class="cm-com-c">
      <div class="cm-com-b"><b>${E(nomAffiche(c))}</b>${c.admin ? badgeAdmin() : ''}${prof > 0 && c.parent_nom ? `<span class="cm-vers">› ${E(c.parent_nom)}</span>` : ''}<p>${texteHtml(c.texte)}</p></div>
      <div class="cm-com-a"><span>${relatif(c.cree_le)}</span><button data-cm-rep="${E(p.id)}|${E(c.id)}">Répondre</button>${c.moi ? `<button data-cm-supprcom="${E(p.id)}|${E(c.id)}">Supprimer</button>` : ''}</div>
    </div>
  </div>`;
}
function saisieHtml(p, o){
  if(C.blocage) return `<p class="cm-blocage">${E(C.blocage)}</p>`;
  return `<div class="cm-saisie">
    ${o.rep ? `<div class="cm-rep-chip">Réponse à <b>${E(o.rep.nom)}</b><button data-cm-rep-annuler="${E(p.id)}" aria-label="Annuler la réponse">×</button></div>` : ''}
    <div class="cm-saisie-l">
      <textarea class="cm-champ cm-champ-c" rows="1" maxlength="${MAX_COM}" placeholder="Écrire un commentaire…" data-cm-champ-com="${E(p.id)}" aria-label="Votre commentaire">${E(o.brouillon || '')}</textarea>
      <button class="cm-envoi" data-cm-envoyer="${E(p.id)}" aria-label="Envoyer le commentaire"${o.envoi ? ' disabled' : ''}>${ico('envoyer', 18)}</button>
    </div>
  </div>`;
}
function majComms(id, focus){
  const art = document.getElementById('cm-p-' + id);
  if(!art) return;
  const p = trouver(id), zone = art.querySelector('.cm-comms'), o = C.ouvert[id];
  if(!zone || !p) return;
  zone.hidden = !o;
  zone.innerHTML = o ? commsHtml(p) : '';
  const b = art.querySelector('.cm-bulle');
  if(b){ b.classList.toggle('on', !!o); b.setAttribute('aria-expanded', String(!!o)); }
  const t = zone.querySelector('.cm-champ-c');
  if(t){ ajuster(t); if(focus){ try{ t.focus({ preventScroll: false }); t.setSelectionRange(t.value.length, t.value.length); }catch(e){} } }
}
async function basculerComms(id){
  if(C.ouvert[id]){ delete C.ouvert[id]; return majComms(id); }
  const o = C.ouvert[id] = { charge: false, erreur: false, liste: [], rep: null, brouillon: '', envoi: false };
  majComms(id);
  await chargerComms(id);
}
async function chargerComms(id){
  const o = C.ouvert[id];
  if(!o) return;
  o.erreur = false; o.charge = false; majComms(id);
  try{
    const r = await rpc('communaute_commentaires', { p_pub: id });
    if(!r || !r.ok) throw new Error((r && r.message) || 'erreur');
    o.liste = r.commentaires || []; o.charge = true;
  }catch(e){ o.erreur = true; }
  if(C.ouvert[id] === o) majComms(id);
}
function repondre(v){
  const [pid, cid] = String(v).split('|'), o = C.ouvert[pid];
  if(!o) return;
  const c = o.liste.find(x => x.id === cid);
  if(!c) return;
  o.rep = { id: cid, nom: nomAffiche(c) };
  majComms(pid, true);
}
async function envoyerCom(id){
  const o = C.ouvert[id], p = trouver(id);
  if(!o || !p || o.envoi) return;
  const txt = (o.brouillon || '').trim();
  if(!txt) return;
  if(navigator.onLine === false) return toast('Pas de réseau pour le moment.');
  o.envoi = true; majComms(id);
  let ok = false;
  try{
    const r = await rpc('communaute_commenter', { p_pub: id, p_texte: txt, p_parent: o.rep ? o.rep.id : null });
    if(!r || !r.ok){ toast((r && r.message) || 'Le commentaire n\'a pas pu être publié.'); }
    else {
      o.liste.push(r.commentaire); p.comms = r.comms !== undefined ? r.comms : (p.comms || 0) + 1;
      o.brouillon = ''; o.rep = null; ok = true;
      pister('COMMUNITY_COMMENT');
    }
  }catch(e){ toast(msg(e, 'Le commentaire n\'a pas pu être publié. Réessayez.')); }
  o.envoi = false;
  if(C.ouvert[id] === o){ majComms(id, ok); majPied(p); }
}
async function supprimerCom(v){
  const [pid, cid] = String(v).split('|'), o = C.ouvert[pid], p = trouver(pid);
  if(!o || !p) return;
  try{
    const r = await rpc('communaute_supprimer', { p_type: 'commentaire', p_id: cid });
    if(!r || !r.ok) return toast('Ce commentaire n\'a pas pu être supprimé.');
    await chargerComms(pid);
    p.comms = o.liste.length; majPied(p);
    toast('Commentaire supprimé.');
  }catch(e){ toast(msg(e, 'Suppression impossible pour le moment.')); }
}

/* ---------------------------------------------------------------- cœurs */
async function coeur(id){
  const p = trouver(id);
  if(!p || C.enCoeur[id]) return;
  if(navigator.onLine === false) return toast('Pas de réseau pour le moment.');
  C.enCoeur[id] = true;
  const avant = { aime: p.aime, coeurs: p.coeurs };
  p.aime = !p.aime; p.coeurs = Math.max(0, (p.coeurs || 0) + (p.aime ? 1 : -1));
  majPied(p);
  if(p.aime) pop(id);
  try{
    const r = await rpc('communaute_aimer', { p_id: id });
    if(!r || !r.ok){ p.aime = avant.aime; p.coeurs = avant.coeurs; toast((r && r.message) || 'Le cœur n\'a pas pu être envoyé.'); }
    else { p.aime = !!r.aime; if(r.coeurs !== undefined) p.coeurs = r.coeurs; if(p.aime) pister('COMMUNITY_LIKE'); }
  }catch(e){ p.aime = avant.aime; p.coeurs = avant.coeurs; toast(msg(e, 'Le cœur n\'a pas pu être envoyé.')); }
  C.enCoeur[id] = false;
  majPied(p);
}
function pop(id){
  const art = document.getElementById('cm-p-' + id), s = art && art.querySelector('.cm-coeur svg');
  if(!s || !animOk()) return;
  s.classList.remove('pop'); void s.getBoundingClientRect(); s.classList.add('pop');
}

/* ---------------------------------------------------------------- le fil */
function filHtml(){
  if(C.erreur && !C.posts.length){
    return `<div class="cm-etat"><p>${E(C.erreur)}</p><button class="cta" data-cm-reessayer="1">Réessayer</button></div>`;
  }
  if(!C.charge && !C.posts.length){
    return `<div class="cm-sq"><div class="squelette large"></div><div class="squelette"></div><div class="squelette court"></div></div>`;
  }
  const liste = C.posts.filter(p => !(C.focus && C.focus.post.id === p.id));
  if(!liste.length){
    const t = C.filtre === 'moi' ? 'Vous n\'avez encore rien publié.'
      : C.filtre === 'concours' ? 'Personne de votre concours n\'a encore écrit ici. Lancez la conversation.'
      : C.filtre === 'admin' ? 'Aucun message de l\'administration pour le moment.' : 'Rien à lire pour le moment.';
    return `<div class="cm-etat"><p>${t}</p>${C.filtre === 'moi' || C.filtre === 'concours' ? `<button class="cta" data-cm-compo-ouvrir="1">Écrire un message</button>` : ''}</div>`;
  }
  return liste.map(p => postHtml(p)).join('') +
    (C.fin ? `<p class="cm-fin">Vous avez tout vu.</p>`
      : `<div class="cm-plus"><div id="cm-sentinelle"></div><button class="cm-btn-plus" data-cm-plus="1"${C.chargement ? ' disabled' : ''}>${C.chargement ? 'Chargement…' : 'Voir plus'}</button></div>`);
}
function dessinerFil(){
  const z = document.getElementById('cm-fil');
  if(!z) return;
  const a = document.activeElement, id = a && a.dataset && a.dataset.cmChampCom, pos = id ? a.selectionStart : 0;
  z.innerHTML = filHtml();
  observer();
  if(id){
    const t = z.querySelector('[data-cm-champ-com="' + id + '"]');
    if(t){ try{ t.focus({ preventScroll: true }); t.setSelectionRange(pos, pos); }catch(e){} }
  }
}
const dernierCurseur = () => {
  const l = C.posts.filter(p => !p.epingle);
  return (l.length ? l[l.length - 1] : C.posts[C.posts.length - 1] || {}).cree_le || null;
};
const plusRecent = () => C.posts.reduce((m, p) => (!m || p.cree_le > m ? p.cree_le : m), null);

async function chargerFil(plus, silencieux){
  if(C.chargement) return;
  if(!base){ C.erreur = 'La communauté a besoin du réseau. Vérifiez votre connexion.'; C.charge = true; return dessinerFil(); }
  C.chargement = true;
  const jeton = ++C.jeton, filtre = C.filtre, bloc0 = C.blocage;
  let change = true;
  if(plus) dessinerFil();
  try{
    const avant = plus ? dernierCurseur() : null;
    const r = await rpc('communaute_fil', { p_filtre: filtre, p_avant: avant, p_limite: PAGE });
    if(jeton !== C.jeton) return;
    if(!r || !r.ok) throw new Error((r && r.message) || 'erreur');
    C.erreur = ''; C.blocage = r.blocage || null;
    if(r.membres !== undefined) C.membres = r.membres;
    const recus = r.publications || [];
    const sig = l => l.map(p => [p.id, p.coeurs, p.comms, p.epingle]);
    if(plus){
      const deja = new Set(C.posts.map(p => p.id));
      recus.forEach(p => { if(!deja.has(p.id)) C.posts.push(p); });
    } else if(silencieux && C.charge && pareil(sig(recus), sig(C.posts.slice(0, recus.length)))){
      change = false;                       // rien de neuf : on ne redessine pas
    } else C.posts = recus;
    C.fin = plus ? recus.length < PAGE : (change ? recus.length < PAGE : C.fin);
    C.charge = true;
    const m = plusRecent(); if(m && (!C.curseur || m > C.curseur)) C.curseur = m;
  }catch(e){
    if(jeton !== C.jeton) return;
    if(!C.posts.length) C.erreur = navigator.onLine === false ? 'Pas de réseau. Reconnectez-vous pour lire la communauté.' : 'La communauté n\'a pas pu se charger. Réessayez dans un instant.';
    else if(plus) toast('Impossible de charger la suite pour le moment.');
    C.charge = true;
  }
  C.chargement = false;
  if(S.ecran === 'communaute'){
    if(change || C.erreur) dessinerFil();
    majHero();
    if(C.blocage !== bloc0) majCompo();
  }
}
async function chargerInfo(){
  try{
    const r = await rpc('communaute_info', { p_depuis: C.curseur || null });
    if(r && r.ok){ C.info = r; C.membres = r.membres; if(r.blocage !== undefined) C.blocage = r.blocage; }
    return r;
  }catch(e){ return null; }
}
async function chargerTop(periode){
  try{
    const r = await rpc('communaute_top', { p_periode: periode });
    if(r && r.ok) C.top[periode] = r;
  }catch(e){}
}
function filtrer(f){
  if(f === C.filtre || !FILTRES.some(x => x[0] === f)) return;
  C.filtre = f; C.posts = []; C.fin = false; C.charge = false; C.erreur = '';
  document.querySelectorAll('.cm-pill').forEach(b => { const on = b.dataset.cmFiltre === f; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  dessinerFil();
  chargerFil(false);
}
let obs = null;
function observer(){
  if(obs){ obs.disconnect(); obs = null; }
  const s = document.getElementById('cm-sentinelle');
  if(!s || !('IntersectionObserver' in window)) return;
  obs = new IntersectionObserver(es => { if(es.some(e => e.isIntersecting) && !C.chargement && !C.fin) chargerFil(true); }, { root: vue(), rootMargin: '0px 0px 500px 0px' });
  obs.observe(s);
}

/* ---------------------------------------------------------------- en-tête */
function heroTop(){
  const sem = C.top.semaine, tot = C.top.total;
  const t = sem && sem.top && sem.top.length ? sem : (tot && tot.top && tot.top.length ? tot : null);
  if(!t) return `<button class="cm-hero-top" data-cm-top="1"><span class="cm-troph">${ico('trophee', 18)}</span>
    <span class="tx"><b>Meilleurs contributeurs</b><small>Publiez, commentez, recevez des cœurs</small></span><i aria-hidden="true">→</i></button>`;
  const trois = t.top.slice(0, 3);
  return `<button class="cm-hero-top" data-cm-top="1"><span class="cm-pile">${trois.map(l => avatar(l.nom, l.teinte, false, true)).join('')}</span>
    <span class="tx"><b>Meilleurs contributeurs</b><small>${E(trois[0].nom)} en tête ${t === tot ? 'depuis le début' : 'cette semaine'}, ${nb(trois[0].points)} pts</small></span><i aria-hidden="true">→</i></button>`;
}
function libelleCandidats(){
  const n = C.membres !== undefined ? C.membres : (S.commInfo && S.commInfo.membres);
  if(n === undefined || n === null) return 'Plus de 600 candidats';
  return n >= 100 ? 'Plus de ' + nombreFr(Math.floor(n / 100) * 100) + ' candidats' : 'Les premiers candidats sont là';
}
function heroHtml(){
  const aj = C.info && C.info.aujourdhui;
  return `<section class="cm-hero" id="cm-hero">
    <div class="cm-hero-t">
      <span class="cm-hero-ic">${ico('groupe', 24)}</span>
      <div><h1>Communauté</h1><p>${libelleCandidats()}${aj ? ` · ${nb(aj)} publication${aj > 1 ? 's' : ''} aujourd'hui` : ''}</p></div>
    </div>
    ${S.util.connecte ? heroTop() : ''}
  </section>`;
}
function majHero(){
  const h = document.getElementById('cm-hero');
  if(h) h.outerHTML = heroHtml();
}

/* ---------------------------------------------------------------- écrire */
function reglesHtml(){
  if(lireReglages().commRegles) return '';
  return `<div class="cm-regles" id="cm-regles"><p><b>Ici, on s'entraide et on se respecte.</b> Pas d'insultes ni de moqueries.<br>Les numéros de téléphone et les liens sont masqués automatiquement.</p>
    <button data-cm-regles="1">Compris</button></div>`;
}
function compoHtml(){
  const c = C.compo;
  if(C.blocage) return `<div class="cm-blocage">${E(C.blocage)}</div>`;
  if(!c.ouvert){
    return `<button class="cm-compo-f" data-cm-compo-ouvrir="1">${avatar(S.util.nom, 150, false)}<span>${c.texte.trim() || c.blob || c.carte ? 'Reprendre mon message…' : 'Écrire à la communauté…'}</span><span class="cm-compo-ic" aria-hidden="true">${ico('photo', 20)}</span></button>`;
  }
  const n = c.texte.length, vide = !c.texte.trim() && !c.blob && !c.carte;
  return `<div class="cm-compo-o">
    <div class="cm-compo-h">${avatar(S.util.nom, 150, false, true)}<b>${E(S.util.nom || 'Vous')}</b>
      <button class="cm-x" data-cm-compo-fermer="1" aria-label="Fermer">×</button></div>
    <textarea id="cm-texte" class="cm-champ" rows="3" maxlength="${MAX_POST}" placeholder="Un conseil, une question, vos progrès…" aria-label="Votre message">${E(c.texte)}</textarea>
    ${c.apercu ? `<div class="cm-apercu"><img src="${E(c.apercu)}" alt="Aperçu de la photo"><button data-cm-photo-retirer="1" aria-label="Retirer la photo">×</button></div>` : ''}
    ${c.carte ? `<div class="cm-apercu avec-carte">${carteHtml({ carte: c.carte })}<button data-cm-progres-retirer="1" aria-label="Retirer mes progrès">×</button></div>` : ''}
    <div class="cm-compo-b">
      <button class="cm-outil" data-cm-photo-choisir="1">${ico('photo', 17)}<span>Photo</span></button>
      <button class="cm-outil${c.carte ? ' on' : ''}" data-cm-progres="1">${ico('diagnostic', 17)}<span>Mes progrès</span></button>
      <span class="cm-cpt${n > MAX_POST - 100 ? ' proche' : ''}" id="cm-cpt">${n}/${MAX_POST}</span>
      <button class="cm-pub" data-cm-publier="1"${vide || c.envoi ? ' disabled' : ''}>${c.envoi ? 'Envoi…' : 'Publier'}</button>
    </div>
    <input type="file" id="cm-fichier" accept="image/*" hidden>
  </div>`;
}
function majCompo(focus){
  const z = document.getElementById('cm-compo');
  if(!z) return;
  z.className = 'cm-compo' + (C.compo.ouvert && !C.blocage ? ' ouverte' : '');
  z.innerHTML = compoHtml();
  const t = document.getElementById('cm-texte');
  if(t){ ajuster(t); if(focus){ try{ t.focus(); t.setSelectionRange(t.value.length, t.value.length); }catch(e){} } }
}
function ajuster(t){ t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight + 2, 220) + 'px'; }
function majPublier(){
  const b = document.querySelector('.cm-pub'), c = C.compo;
  if(b) b.disabled = c.envoi || (!c.texte.trim() && !c.blob && !c.carte);
  const k = document.getElementById('cm-cpt');
  if(k){ k.textContent = c.texte.length + '/' + MAX_POST; k.classList.toggle('proche', c.texte.length > MAX_POST - 100); }
}
function carteProgres(){
  const st = S.stats;
  if(!st) return null;
  let niveau = '';
  try{ niveau = niveauCandidat().nom; }catch(e){}
  return { kind: 'progres', questions: Math.max(0, Math.round(st.questions_resolues || 0)), compositions: Math.max(0, Math.round(st.compositions || 0)),
    taux: Math.max(0, Math.min(100, Math.round(st.taux_reussite || 0))), serie: Math.max(0, Math.round(st.serie || 0)), niveau };
}
async function reduire(fichier){
  if(!/^image\//.test(fichier.type)) throw new Error('Choisissez une photo.');
  let source, w, h;
  if(window.createImageBitmap){ try{ source = await createImageBitmap(fichier); w = source.width; h = source.height; }catch(e){ source = null; } }
  if(!source){
    source = await new Promise((ok, ko) => {
      const i = new Image(), u = URL.createObjectURL(fichier);
      i.onload = () => { URL.revokeObjectURL(u); ok(i); };
      i.onerror = () => { URL.revokeObjectURL(u); ko(new Error('Cette photo n\'a pas pu être lue.')); };
      i.src = u;
    });
    w = source.naturalWidth; h = source.naturalHeight;
  }
  const k = Math.min(1, 1280 / Math.max(w, h)), c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
  const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
  x.drawImage(source, 0, 0, c.width, c.height);
  if(source.close) source.close();
  let blob = null, q = 0.82;
  for(let i = 0; i < 3; i++){
    blob = await new Promise(r => c.toBlob(r, 'image/jpeg', q));
    if(blob && blob.size <= 2.5 * 1024 * 1024) break;
    q -= 0.2;
  }
  if(!blob || blob.size > 2.9 * 1024 * 1024) throw new Error('Cette photo est trop lourde.');
  return blob;
}
async function choisirPhoto(fichier){
  if(!fichier) return;
  try{
    const blob = await reduire(fichier);
    if(C.compo.apercu) URL.revokeObjectURL(C.compo.apercu);
    C.compo.blob = blob; C.compo.apercu = URL.createObjectURL(blob);
    majCompo();
  }catch(e){ toast(e && e.message && /photo/i.test(e.message) ? e.message : 'Cette photo n\'a pas pu être ajoutée.'); }
}
function retirerPhoto(){
  if(C.compo.apercu) URL.revokeObjectURL(C.compo.apercu);
  C.compo.blob = null; C.compo.apercu = '';
  majCompo();
}
function viderCompo(){
  if(C.compo.apercu) URL.revokeObjectURL(C.compo.apercu);
  C.compo = { ouvert: false, texte: '', blob: null, apercu: '', carte: null, envoi: false };
}
async function publier(){
  const c = C.compo;
  if(c.envoi) return;
  const texte = c.texte.trim();
  if(!texte && !c.blob && !c.carte) return;
  if(navigator.onLine === false) return toast('Pas de réseau pour le moment.');
  c.envoi = true; majCompo();
  let chemin = null;
  try{
    if(c.blob){
      const uid = await utilisateurCourant();
      if(!uid) throw new Error('Connexion requise.');
      chemin = uid + '/' + Date.now() + '.jpg';
      const { error } = await base.storage.from('communaute').upload(chemin, c.blob, { contentType: 'image/jpeg', upsert: false });
      if(error) throw error;
    }
    const r = await rpc('communaute_publier', { p_texte: texte, p_image: chemin, p_carte: c.carte });
    if(!r || !r.ok){
      if(chemin) base.storage.from('communaute').remove([chemin]).catch(() => {});
      c.envoi = false; majCompo();
      return toast((r && r.message) || 'La publication n\'a pas pu partir.');
    }
    const p = r.publication;
    let i = 0; while(i < C.posts.length && C.posts[i].epingle) i++;
    if(C.filtre === 'tout' || C.filtre === 'moi' || C.filtre === 'concours') C.posts.splice(i, 0, p);
    if(!C.curseur || p.cree_le > C.curseur) C.curseur = p.cree_le;
    viderCompo();
    pister('COMMUNITY_POST', { photo: !!chemin, progres: !!p.carte });
    majCompo(); dessinerFil();
    toast('Publié. Merci d\'avoir fait vivre la communauté.');
    const art = document.getElementById('cm-p-' + p.id);
    if(art) art.scrollIntoView({ block: 'center', behavior: animOk() ? 'smooth' : 'auto' });
  }catch(e){
    if(chemin) base.storage.from('communaute').remove([chemin]).catch(() => {});
    c.envoi = false; majCompo();
    toast(msg(e, 'La publication n\'a pas pu partir. Réessayez.'));
  }
}

/* ---------------------------------------------------------------- suppression d'une publication */
function demanderSuppression(id){
  const v = document.getElementById('voile');
  S.modal = 'communaute-suppr'; v.hidden = false;
  v.innerHTML = `<div class="panneau cm-panneau" role="dialog" aria-modal="true" aria-label="Supprimer la publication">
    <div class="poignee"></div>
    <h3>Supprimer cette publication ?</h3>
    <p class="sous" style="margin:8px 0 16px">Les cœurs et les commentaires partent avec elle. C'est définitif.</p>
    <button class="cta danger" data-cm-suppr-oui="${E(id)}">Supprimer</button>
    <button class="cta creux" style="margin-top:9px" data-fermer-partage="1">Annuler</button>
  </div>`;
}
async function supprimer(id){
  const v = document.getElementById('voile');
  if(v){ v.hidden = true; v.innerHTML = ''; } S.modal = null;
  try{
    const r = await rpc('communaute_supprimer', { p_type: 'publication', p_id: id });
    if(!r || !r.ok) return toast('Cette publication n\'a pas pu être supprimée.');
    C.posts = C.posts.filter(p => p.id !== id); delete C.ouvert[id];
    if(C.focus && C.focus.post.id === id) C.focus = null;
    const art = document.getElementById('cm-p-' + id);
    if(art && animOk()){ art.classList.add('part'); setTimeout(() => { dessinerFil(); majFocus(); }, 260); } else { dessinerFil(); majFocus(); }
    toast('Publication supprimée.');
  }catch(e){ toast(msg(e, 'Suppression impossible pour le moment.')); }
}

/* ---------------------------------------------------------------- classement des contributeurs */
function ouvrirTop(){
  const v = document.getElementById('voile');
  S.modal = 'communaute-top'; v.hidden = false;
  pister('COMMUNITY_TOP_OPENED');
  dessinerTop();
  const p = C.topPeriode;
  chargerTop(p).then(() => { if(S.modal === 'communaute-top') dessinerTop(); });
  if(!C.top[p === 'semaine' ? 'total' : 'semaine']) chargerTop(p === 'semaine' ? 'total' : 'semaine').then(() => { if(S.modal === 'communaute-top') dessinerTop(); majHero(); });
}
function dessinerTop(){
  const v = document.getElementById('voile');
  if(!v || S.modal !== 'communaute-top') return;
  const p = C.topPeriode, t = C.top[p];
  let liste;
  if(!t) liste = '<div class="squelette large"></div><div class="squelette" style="margin-top:8px"></div><div class="squelette court" style="margin-top:8px"></div>';
  else if(!t.top.length) liste = `<p class="cm-vide">Personne n'a encore marqué de points ${p === 'semaine' ? 'cette semaine' : ''}. Publiez, commentez : la première place est libre.</p>`;
  else liste = t.top.map(l => `<div class="cm-ligne-top${l.moi ? ' moi' : ''}">${medaille(l.rang)}${avatar(l.nom, l.teinte, false, true)}
      <span class="n">${E(l.nom)}${l.moi ? ' (vous)' : ''}${l.concours ? `<small>${E(l.concours)}</small>` : ''}</span><span class="s num">${nb(l.points)}<small> pts</small></span></div>`).join('');
  const moi = t && t.moi && !t.top.some(l => l.moi)
    ? `<div class="cm-ma-place">Votre place : <b class="num">${nb(t.moi.rang)}ᵉ</b> sur ${nb(t.participants)} · <b class="num">${nb(t.moi.points)}</b> point${t.moi.points > 1 ? 's' : ''}</div>` : '';
  v.innerHTML = `<div class="panneau cm-panneau" role="dialog" aria-modal="true" aria-label="Meilleurs contributeurs">
    <div class="poignee"></div>
    <h3>Meilleurs contributeurs</h3>
    <p class="sous" style="margin:6px 0 12px">Ceux qui font vivre la communauté en s'entraidant.</p>
    <div class="cm-seg" role="tablist">
      <button role="tab" aria-selected="${p === 'semaine'}" class="${p === 'semaine' ? 'on' : ''}" data-cm-top-p="semaine">Cette semaine</button>
      <button role="tab" aria-selected="${p === 'total'}" class="${p === 'total' ? 'on' : ''}" data-cm-top-p="total">Depuis le début</button>
    </div>
    <div class="cm-liste-top">${liste}</div>
    ${moi}
    <p class="cm-bareme">Publier <b>+3</b> · Commenter <b>+1</b> · Cœur reçu <b>+1</b> · Commentaire reçu <b>+1</b></p>
    <button class="cta creux" style="margin-top:12px" data-fermer-partage="1">Fermer</button>
  </div>`;
}

/* ---------------------------------------------------------------- photo en grand */
function ouvrirPhoto(url){
  document.querySelectorAll('.cm-visio').forEach(x => x.remove());
  const d = document.createElement('div');
  d.className = 'cm-visio'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-label', 'Photo');
  d.innerHTML = `<img src="${E(url)}" alt="Photo agrandie"><button aria-label="Fermer la photo">×</button>`;
  const fermer = () => { d.classList.remove('vu'); setTimeout(() => d.remove(), 200); document.removeEventListener('keydown', echap); };
  const echap = e => { if(e.key === 'Escape') fermer(); };
  d.addEventListener('click', fermer);
  document.addEventListener('keydown', echap);
  document.body.appendChild(d);
  setTimeout(() => { d.classList.add('vu'); const b = d.querySelector('button'); if(b) b.focus(); }, 20);
}

/* ---------------------------------------------------------------- publication ouverte depuis une notification */
function focusHtml(){
  if(!C.focus) return '';
  return `<section class="cm-focus" id="cm-focus"><div class="cm-focus-t"><span>${ico('cloche', 13)} Publication ouverte</span><button data-cm-focus-fermer="1" aria-label="Fermer">×</button></div>${postHtml(C.focus.post, true)}</section>`;
}
function majFocus(){
  const z = document.getElementById('cm-focus');
  const h = focusHtml();
  if(z && h) z.outerHTML = h;
  else if(z && !h) z.remove();
}
async function ouvrirFocus(id){
  try{
    const r = await rpc('communaute_publication', { p_id: id });
    if(!r || !r.ok || S.ecran !== 'communaute') return;
    C.focus = { post: r.publication };
    C.ouvert[id] = { charge: false, erreur: false, liste: [], rep: null, brouillon: '', envoi: false };
    const z = document.getElementById('cm-focus-place');
    if(z) z.innerHTML = focusHtml();
    dessinerFil();
    chargerComms(id);
  }catch(e){}
}

/* ---------------------------------------------------------------- l'écran */
function barriere(){
  return `<div class="cm-etat barriere"><p><b>Rejoignez les candidats.</b><br>Créez votre compte gratuit pour lire, écrire et recevoir des cœurs.</p>
    <button class="cta" data-modal="inscription">Créer mon compte</button>
    <button class="cta creux" style="margin-top:9px" data-modal="connexion">J'ai déjà un compte</button></div>`;
}
function page(){
  return `<div class="pad cm" id="cm-racine">
    <button class="retourhaut" data-go="compte">Retour</button>
    ${heroHtml()}
    ${S.util.connecte ? `
      <div id="cm-focus-place">${focusHtml()}</div>
      ${reglesHtml()}
      <section class="cm-compo${C.compo.ouvert && !C.blocage ? ' ouverte' : ''}" id="cm-compo">${compoHtml()}</section>
      <nav class="cm-filtres" aria-label="Filtrer la communauté">${FILTRES.map(([k, l]) => `<button class="cm-pill${k === C.filtre ? ' on' : ''}" data-cm-filtre="${k}" aria-pressed="${k === C.filtre}">${l}</button>`).join('')}</nav>
      <div id="cm-nouv">${pastilleNouv()}</div>
      <section id="cm-fil" aria-live="polite">${filHtml()}</section>` : barriere()}
  </div>`;
}
function ecran(){
  const deja = racine(), a = document.activeElement;
  /* quelqu'un est en train d'écrire : un rafraîchissement venu d'ailleurs ne doit pas lui voler la saisie */
  if(deja && a && deja.contains(a) && /^(TEXTAREA|INPUT)$/.test(a.tagName)) return;
  if(!deja && C.filtre !== 'tout'){ C.filtre = 'tout'; C.posts = []; C.charge = false; C.fin = false; }
  if(!deja) C.nouveaux = 0;
  const y = deja ? vue().scrollTop : 0;
  vue().innerHTML = page();
  if(deja){ vue().scrollTop = y; observer(); return; }
  entrer();
}
async function entrer(){
  pister('COMMUNITY_OPENED');
  if(!S.util.connecte) return;
  const brouillon = S.commBrouillon, focusId = S.commFocus;
  S.commBrouillon = null; S.commFocus = null; C.focus = null;
  if(brouillon){
    C.compo.ouvert = true;
    if(brouillon.texte) C.compo.texte = brouillon.texte;
    if(brouillon.quoi === 'performance'){ const k = carteProgres(); if(k) C.compo.carte = k; }
    majCompo(true);
  }
  C.charge = C.posts.length > 0; C.fin = false; C.erreur = '';
  Promise.all([chargerFil(false, true), chargerInfo(), chargerTop('semaine'), chargerTop('total')]).then(() => {
    if(S.ecran !== 'communaute') return;
    majHero(); majCompo();
    /* le curseur des nouveautés avance : la tuile de Mon compte se remet à zéro */
    if(C.curseur){ ecrireReglage('commVu', C.curseur); if(S.commInfo) S.commInfo = Object.assign({}, S.commInfo, { nouveaux: 0 }); }
  });
  if(focusId) ouvrirFocus(focusId);
  if(S.stats === null || S.stats === undefined){ try{ chargerProgression(); }catch(e){} }
}

/* ---------------------------------------------------------------- nouvelles publications pendant la lecture */
function pastilleNouv(){
  const n = C.nouveaux || 0;
  return n > 0 ? `<button class="cm-nouv" data-cm-actualiser="1">↑ ${nb(n)} nouvelle${n > 1 ? 's' : ''} publication${n > 1 ? 's' : ''}</button>` : '';
}
async function veille(){
  if(S.ecran !== 'communaute' || !racine() || document.visibilityState !== 'visible' || !S.util.connecte || !C.curseur || C.filtre === 'moi') return;
  const r = await chargerInfo();
  if(!r || !r.ok || S.ecran !== 'communaute') return;
  C.nouveaux = r.nouveaux || 0;
  const z = document.getElementById('cm-nouv');
  if(z) z.innerHTML = pastilleNouv();
}
setInterval(veille, 45000);
async function actualiser(){
  C.nouveaux = 0;
  const z = document.getElementById('cm-nouv'); if(z) z.innerHTML = '';
  C.posts = []; C.fin = false; C.charge = false;
  dessinerFil();
  vue().scrollTo({ top: 0, behavior: animOk() ? 'smooth' : 'auto' });
  await chargerFil(false);
  majHero();
  if(C.curseur){ ecrireReglage('commVu', C.curseur); }
}

/* ---------------------------------------------------------------- les gestes */
const ACTIONS = {
  cmCoeur: coeur,
  cmComm: basculerComms,
  cmCommRelancer: id => chargerComms(id),
  cmRep: repondre,
  cmRepAnnuler: id => { const o = C.ouvert[id]; if(o){ o.rep = null; majComms(id, true); } },
  cmSupprcom: supprimerCom,
  cmSuppr: demanderSuppression,
  cmSupprOui: supprimer,
  cmEnvoyer: envoyerCom,
  cmFiltre: filtrer,
  cmPlus: () => chargerFil(true),
  cmReessayer: () => { C.erreur = ''; C.charge = false; dessinerFil(); chargerFil(false); },
  cmCompoOuvrir: () => { C.compo.ouvert = true; majCompo(true); },
  cmCompoFermer: () => { C.compo.ouvert = false; majCompo(); },       // le brouillon reste là
  cmPhotoChoisir: () => { const f = document.getElementById('cm-fichier'); if(f) f.click(); },
  cmPhotoRetirer: retirerPhoto,
  cmProgres: () => {
    if(C.compo.carte){ C.compo.carte = null; return majCompo(); }
    const k = carteProgres();
    if(!k) return toast('Vos chiffres ne sont pas encore chargés. Réessayez dans un instant.');
    C.compo.carte = k; majCompo();
  },
  cmProgresRetirer: () => { C.compo.carte = null; majCompo(); },
  cmPublier: publier,
  cmRegles: () => { ecrireReglage('commRegles', true); const z = document.getElementById('cm-regles'); if(z) z.remove(); },
  cmTop: ouvrirTop,
  cmTopP: p => { C.topPeriode = p === 'total' ? 'total' : 'semaine'; dessinerTop(); if(!C.top[C.topPeriode]) chargerTop(C.topPeriode).then(dessinerTop); },
  cmActualiser: actualiser,
  cmClasse: id => { if(UUID.test(id || '')){ chargerClassement(id); aller('gagnants'); } },
  cmAller: e => { if(CIBLES.includes(e)) aller(e); },
  cmPhoto: ouvrirPhoto,
  cmFocusFermer: () => { C.focus = null; const z = document.getElementById('cm-focus-place'); if(z) z.innerHTML = ''; dessinerFil(); }
};
document.addEventListener('click', ev => {
  if(S.ecran !== 'communaute' && !(S.modal || '').startsWith('communaute')) return;
  let n = ev.target;
  while(n && n !== document){
    if(n.dataset){
      for(const k in n.dataset){
        if(ACTIONS[k]){
          ev.preventDefault();
          try{ pister('BUTTON_CLICKED', { valeur: String(n.dataset[k]).slice(0, 40) }, k); }catch(e){}
          ACTIONS[k](n.dataset[k], n);
          return;
        }
      }
    }
    n = n.parentNode;
  }
});
document.addEventListener('input', ev => {
  const t = ev.target;
  if(!t || !t.matches) return;
  if(t.id === 'cm-texte'){ C.compo.texte = t.value; ajuster(t); majPublier(); }
  else if(t.matches('[data-cm-champ-com]')){ const o = C.ouvert[t.dataset.cmChampCom]; if(o) o.brouillon = t.value; ajuster(t); }
});
document.addEventListener('change', ev => {
  const t = ev.target;
  if(t && t.id === 'cm-fichier'){ const f = t.files && t.files[0]; t.value = ''; choisirPhoto(f); }
});

window.MC_COMM = { ecran };
})();
