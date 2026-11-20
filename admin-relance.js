/* ============================================================
   MON CONCOURS · administration · « Relance à la main »
   Les candidats actifs qui n'ont pas activé les notifications : le site ne peut
   pas les joindre seul. Ici : leur numéro, un message WhatsApp déjà écrit, et un
   bouton « Relancé » pour savoir qui a été contacté et qui est revenu.
   Rien n'est envoyé automatiquement. Aucune donnée n'est supprimée.
   ============================================================ */
(function(){
'use strict';

const V = window.ADMIN.vues;
const X = () => window.ADMIN;
const e = v => X().E(v);
const $ = s => document.querySelector(s);
const APK = 'https://telecharger.monconcoursbf.com/MonConcoursBF.apk';
const SITE = 'https://monconcoursbf.com';
const NOM_GROUPE = { noyau: 'Noyau', regulier: 'Régulier', occasionnel: 'Occasionnel' };
let donnees = null, filtre = 'a_relancer';

function prenom(c){ return (c.nom || '').trim().split(/\s+/)[0] || ''; }
function message(c){
  const p = prenom(c);
  if(c.groupe === 'occasionnel'){
    return 'Bonjour ' + p + ', c\'est l\'équipe Mon Concours. On ne t\'a pas vu depuis un moment. Ta place t\'attend : 10 questions par jour suffisent pour progresser. Installe l\'application et active les rappels, tu ne rateras plus rien : ' + APK + ' (ou directement sur ' + SITE + '). Dis-moi si quelque chose te bloque, je t\'aide.';
  }
  return 'Bonjour ' + p + ', c\'est l\'équipe Mon Concours. Tu travailles régulièrement, bravo. Pour ne rater ni tes rappels de révision ni les compositions nationales du samedi, installe l\'application et active les notifications : ' + APK + ' (ou ' + SITE + '). Ça prend une minute. Si quelque chose bloque, écris-moi ici.';
}
function lien(c){
  const t = String(c.tel || '').replace(/\D/g, '');
  return 'https://wa.me/' + (t.length === 8 ? '226' + t : t) + '?text=' + encodeURIComponent(message(c));
}
function jourCourt(d){ return d ? new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit' }) : '—'; }

function ligne(c){
  const fait = !!c.relance_le;
  const etat = fait
    ? ' · relancé le ' + jourCourt(c.relance_le) + (c.nb > 1 ? ' (' + c.nb + ' fois)' : '') + ' par ' + e(c.par) + (c.revenu ? ' · <b style="color:#1f8a4c">est revenu</b>' : '')
    : '';
  return '<div class="ligne-rel" data-id="' + e(c.id) + '" style="display:flex;gap:8px;align-items:center;justify-content:space-between;padding:10px 0;border-top:1px solid var(--trait,#2a2a2a)' + (fait && !c.revenu ? ';opacity:.7' : '') + '">' +
    '<div style="min-width:0"><b>' + e(c.nom || 'Candidat') + '</b> <span style="font-size:11px;padding:2px 7px;border-radius:99px;background:rgba(19,128,90,.16)">' + e(NOM_GROUPE[c.groupe] || c.groupe) + '</span><br>' +
    '<span style="font-size:12px;color:var(--craie2)">' + e(c.tel || 'sans numéro') + ' · ' + c.jours + ' jour' + (c.jours > 1 ? 's' : '') + ' sur 14 · ' + c.compos + ' compo' + (c.compos > 1 ? 's' : '') + ' · vu le ' + jourCourt(c.derniere) + (c.abonne ? ' · abonné' : '') + etat + '</span></div>' +
    '<div style="display:flex;gap:6px;flex:none">' +
    (c.tel ? '<a class="mini" data-wa="' + e(c.id) + '" href="' + e(lien(c)) + '" target="_blank" rel="noopener" style="text-decoration:none;background:var(--laterite,#13805A);color:#fff;padding:7px 12px;border-radius:9px;font-size:13px;font-weight:600">WhatsApp</a>' : '') +
    '<button class="mini" data-marque="' + e(c.id) + '" data-fait="' + (fait ? '0' : '1') + '" style="padding:7px 12px;border-radius:9px;font-size:13px;border:1px solid var(--trait,#2a2a2a);background:transparent;color:inherit;cursor:pointer">' + (fait ? 'Annuler' : 'Relancé') + '</button>' +
    '</div></div>';
}

function dessiner(){
  const zone = $('#rel-zone'); if(!zone || !donnees) return;
  const toutes = donnees.liste || [];
  const faits = toutes.filter(c => c.relance_le), reste = toutes.filter(c => !c.relance_le), revenus = faits.filter(c => c.revenu);
  const parG = g => reste.filter(c => c.groupe === g).length;
  const liste = filtre === 'a_relancer' ? reste : (filtre === 'relances' ? faits : toutes);
  const puce = (k, t) => '<button data-filtre="' + k + '" style="padding:7px 13px;border-radius:99px;border:1px solid var(--trait,#2a2a2a);background:' + (filtre === k ? 'var(--laterite,#13805A)' : 'transparent') + ';color:' + (filtre === k ? '#fff' : 'inherit') + ';font-size:13px;cursor:pointer">' + t + '</button>';
  zone.innerHTML =
    '<div class="carte"><div style="display:flex;gap:18px;flex-wrap:wrap">' +
    '<div><b style="font-size:24px">' + reste.length + '</b><br><span class="sous">à relancer</span></div>' +
    '<div><b style="font-size:24px">' + faits.length + '</b><br><span class="sous">déjà relancés</span></div>' +
    '<div><b style="font-size:24px">' + revenus.length + '</b><br><span class="sous">revenus après relance</span></div></div>' +
    '<p class="sous" style="margin:10px 0 0;font-size:13px">À relancer : ' + parG('noyau') + ' noyau · ' + parG('regulier') + ' réguliers · ' + parG('occasionnel') + ' occasionnels.</p></div>' +
    '<div class="carte"><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px">' + puce('a_relancer', 'À relancer (' + reste.length + ')') + puce('relances', 'Déjà relancés (' + faits.length + ')') + puce('tous', 'Tous (' + toutes.length + ')') + '</div>' +
    (liste.length ? liste.map(ligne).join('') : '<p style="margin:10px 0 0">Personne dans cette liste.</p>') + '</div>';
}

async function charger(){
  const { data, error } = await X().db.rpc('admin_relance_manuelle');
  const zone = $('#rel-zone'); if(!zone) return;
  if(error || !data || !data.ok){ zone.innerHTML = '<div class="vide">' + e((error && error.message) || 'Réservé à l\'administration.') + '</div>'; return; }
  donnees = data; dessiner();
}

V.relance_manuelle = function(){
  $('#vue').innerHTML = '<div class="entete-vue"><h2>Relance à la main</h2>' +
    '<p>Les candidats actifs sans notifications : le site ne peut pas les joindre seul. Touchez « WhatsApp » : le message est déjà écrit, il reste à l\'envoyer. Puis touchez « Relancé ». Priorité : noyau, puis réguliers, puis occasionnels.</p></div>' +
    '<div id="rel-zone"><div class="carte">Chargement…</div></div>';
  charger();
};

document.addEventListener('click', async ev => {
  const f = ev.target.closest('[data-filtre]');
  if(f && $('#rel-zone')){ filtre = f.dataset.filtre; dessiner(); return; }
  const wa = ev.target.closest('[data-wa]');
  if(wa && $('#rel-zone')){ marquer(wa.dataset.wa, true, true); return; }
  const m = ev.target.closest('[data-marque]');
  if(m && $('#rel-zone')){ await marquer(m.dataset.marque, m.dataset.fait === '1', false); }
});

async function marquer(id, fait, silencieux){
  const c = (donnees && donnees.liste || []).find(x => x.id === id); if(!c) return;
  const { data, error } = await X().db.rpc('admin_relance_manuelle_marquer', { p_user: id, p_fait: fait });
  if(error || !data || !data.ok){ if(!silencieux) X().signal('L\'enregistrement n\'a pas marché. Réessayez.', 'mal'); return; }
  if(fait){ c.relance_le = new Date().toISOString(); c.nb = (c.nb || 0) + 1; c.par = 'vous'; c.revenu = false; }
  else { c.relance_le = null; c.nb = null; c.revenu = false; }
  /* le lien WhatsApp vient de s'ouvrir : la ligne ne disparaît qu'au redessin suivant */
  if(silencieux) setTimeout(dessiner, 600); else dessiner();
}

/* l'entrée du menu, juste après « Priorités » */
function menu(){
  const m = document.getElementById('menu');
  if(!m || m.querySelector('[data-vue="relance_manuelle"]')) return !!m;
  const b = document.createElement('button');
  b.dataset.vue = 'relance_manuelle'; b.className = 'vert'; b.textContent = 'Relance à la main';
  const apres = m.querySelector('[data-vue="priorites"]');
  if(apres && apres.nextSibling) m.insertBefore(b, apres.nextSibling); else m.appendChild(b);
  return true;
}
if(!menu()) document.addEventListener('DOMContentLoaded', menu);
})();
