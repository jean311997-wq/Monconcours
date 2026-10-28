/* ============================================================
   MON CONCOURS · administration · compléments (1/2)
   Outils communs, fiche candidat, recherche, Analytique, Rétention.
   Tout passe par la passerelle window.ADMIN que construit admin.js.
   ============================================================ */
(function(){
'use strict';

window.ADMIN = window.ADMIN || {};
const V = (window.ADMIN.vues = window.ADMIN.vues || {});
const X = () => window.ADMIN;
const e = v => X().E(v);
const num = v => X().nombre(v == null ? 0 : v);
const F = v => num(v) + ' F';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

/* ---------- petits outils ---------- */
const pct = (a, b) => b ? Math.round(100 * a / b) : 0;
const jourIso = d => X().isoJour(d);
function plageActive(){
  const a = X().A;
  if(a.plage) return a.plage;
  const n = Math.max(1, X().periode || 30), fin = new Date(), debut = new Date();
  debut.setDate(debut.getDate() - (n - 1));
  return { du: jourIso(debut), au: jourIso(fin) };
}
const etiqPlage = () => { const p = plageActive(); return p.du === p.au ? 'le ' + X().jourLong(p.du) : 'du ' + X().jourLong(p.du) + ' au ' + X().jourLong(p.au); };
function duree(min){
  min = Math.round(min || 0);
  if(min < 60) return min + ' min';
  const h = Math.floor(min / 60), m = min % 60;
  return h + ' h' + (m ? ' ' + String(m).padStart(2, '0') : '');
}
function depuis(iso){
  if(!iso) return '—';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso)) / 1000));
  if(s < 60) return 'à l\'instant';
  if(s < 3600) return 'il y a ' + Math.round(s / 60) + ' min';
  if(s < 86400) return 'il y a ' + Math.round(s / 3600) + ' h';
  return 'il y a ' + Math.round(s / 86400) + ' j';
}
const heureCourte = iso => iso ? new Date(iso).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '—';
const allerA = vue => { X().A.vue = vue; X().rendre(); };
const tendance = (n, avant) => {
  if(avant == null) return '';
  if(!avant) return n ? '<span class="tend hausse">nouveau</span>' : '';
  const p = Math.round(100 * (n - avant) / avant);
  return `<span class="tend ${p >= 0 ? 'hausse' : 'baisse'}">${p >= 0 ? '+' : ''}${p} % vs période précédente</span>`;
};
const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const jourCourt = iso => X().jourCourt(String(iso).slice(0, 10));

/* ---------- fenêtre (modale) ---------- */
function fenetre(html, large){
  $$('.fenetre-plus').forEach(x => x.remove());
  const f = document.createElement('div');
  f.className = 'fenetre fenetre-plus';
  f.innerHTML = `<div class="fenetre-boite${large ? ' large' : ''}" role="dialog" aria-modal="true">${html}</div>`;
  const fermer = () => { f.remove(); document.removeEventListener('keydown', echap); };
  const echap = ev => { if(ev.key === 'Escape') fermer(); };
  f.addEventListener('click', ev => { if(ev.target === f || ev.target.closest('[data-fermer]')) fermer(); });
  document.addEventListener('keydown', echap);
  document.body.appendChild(f);
  f._fermer = fermer;
  return f;
}
X().fenetre = fenetre;

/* ---------- liste de personnes (tout est cliquable) ---------- */
function tableauPersonnes(lignes, colonnes){
  if(!lignes || !lignes.length) return '<div class="vide">Personne pour le moment.</div>';
  return `<div class="defile"><table><thead><tr><th>Candidat</th>${colonnes.map(c => `<th>${e(c[0])}</th>`).join('')}</tr></thead><tbody>
    ${lignes.map(p => `<tr>
      <td>${p.user_id ? `<b class="cliquable" data-fiche="${e(p.user_id)}">${e(p.nom || 'Candidat')}</b><br><span class="num cliquable" data-fiche="${e(p.user_id)}" style="font-size:11.5px;color:var(--craie2)">${p.telephone || p.tel ? '+226 ' + e(p.telephone || p.tel) : '—'}</span>` : `<b>${e(p.nom || 'Visiteur sans compte')}</b>`}</td>
      ${colonnes.map(c => `<td>${c[1](p)}</td>`).join('')}
    </tr>`).join('')}</tbody></table></div>`;
}
X().tableauPersonnes = tableauPersonnes;

/* ---------- graphiques dessinés à la main ---------- */
const COUL = ['#4FB58A', '#E3A82B', '#8FB4E8', '#E5736A'];
function courbes(o){
  const series = o.series, labels = o.labels, n = labels.length;
  if(!n || !series.some(s => s.valeurs.some(v => v > 0))) return X().insuffisant(o.vide);
  const W = o.largeur || 720, H = o.hauteur || 210, g = o.marge || 42, d = 14, h0 = 16, b = 30;
  const max = Math.max(1, ...series.flatMap(s => s.valeurs)), hi = o.plafond || (max + Math.ceil(max * .08));
  const Xp = i => g + (n === 1 ? (W - g - d) / 2 : i * (W - g - d) / (n - 1));
  const Y = v => h0 + (H - h0 - b) * (1 - v / Math.max(1, hi));
  const pas = Math.max(1, Math.ceil(n / 7));
  const fmt = o.format || (v => num(Math.round(v)));
  const grad = [0, hi / 2, hi];
  return `<div class="legende">${series.map((s, k) => `<span><i style="background:${s.couleur || COUL[k]}"></i>${e(s.nom)}</span>`).join('')}</div>
  <svg viewBox="0 0 ${W} ${H}" class="graphe" role="img" aria-label="${e(o.titre || '')}">
    ${grad.map(v => `<line x1="${g}" x2="${W - d}" y1="${Y(v)}" y2="${Y(v)}" class="gr-grille"/><text x="${g - 7}" y="${Y(v) + 4}" text-anchor="end" class="gr-axe">${fmt(v)}</text>`).join('')}
    ${series.map((s, k) => {
      const c = s.couleur || COUL[k];
      const l = s.valeurs.map((v, i) => (i ? 'L' : 'M') + Xp(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join(' ');
      return `<path d="${l}" fill="none" stroke="${c}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>
        ${s.valeurs.map((v, i) => `<circle cx="${Xp(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="${n > 40 ? 1.6 : 3}" fill="${c}"${o.jours ? ` data-jour="${e(o.jours[i])}" class="cliquable"` : ''}><title>${e(labels[i])} · ${e(s.nom)} : ${fmt(v)}</title></circle>`).join('')}`;
    }).join('')}
    ${labels.map((t, i) => i % pas === 0 || i === n - 1 ? `<text x="${Xp(i).toFixed(1)}" y="${H - 9}" text-anchor="middle" class="gr-axe">${e(t)}</text>` : '').join('')}
  </svg>`;
}
function barres(o){
  const v = o.valeurs, n = v.length;
  if(!n || Math.max(...v) === 0) return X().insuffisant(o.vide);
  const W = o.largeur || 720, H = o.hauteur || 180, g = o.marge || 42, d = 8, h0 = 14, b = 28;
  const max = Math.max(1, ...v), larg = (W - g - d) / n, pas = o.pas || Math.max(1, Math.ceil(n / 8));
  const fmt = o.format || (x => num(Math.round(x)));
  const fort = v.indexOf(max), c = o.couleur || '#4FB58A';
  return `<svg viewBox="0 0 ${W} ${H}" class="graphe" role="img" aria-label="${e(o.titre || '')}">
    ${[0, max / 2, max].map(t => { const y = h0 + (H - h0 - b) * (1 - t / max); return `<line x1="${g}" x2="${W - d}" y1="${y}" y2="${y}" class="gr-grille"/><text x="${g - 7}" y="${y + 4}" text-anchor="end" class="gr-axe">${fmt(t)}</text>`; }).join('')}
    ${v.map((x, i) => {
      const hh = (H - h0 - b) * x / max, xx = g + i * larg + larg * .14;
      return `<rect x="${xx.toFixed(1)}" y="${(H - b - hh).toFixed(1)}" width="${(larg * .72).toFixed(1)}" height="${Math.max(x ? 1.5 : 0, hh).toFixed(1)}" rx="2" fill="${i === fort ? '#E3A82B' : c}"${o.jours ? ` data-jour="${e(o.jours[i])}" class="cliquable"` : ''}><title>${e(o.labels[i])} : ${fmt(x)}</title></rect>`;
    }).join('')}
    ${o.labels.map((t, i) => i % pas === 0 ? `<text x="${(g + i * larg + larg / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle" class="gr-axe">${e(t)}</text>` : '').join('')}
  </svg>`;
}
X().courbes = courbes; X().barres = barres;

/* ---------- ce qui se passe quand on touche un élément cliquable ---------- */
const TITRES_LISTE = { inscrits:'Les inscrits', actifs:'Les candidats actifs', payants:'Ceux qui ont payé', compositions:'Ceux qui ont composé', questions:'Ceux qui ont répondu à des questions', partages:'Ceux qui ont partagé' };
async function listePeriode(type){
  const { du, au } = plageActive();
  const f = fenetre(`<h3>${e(TITRES_LISTE[type] || 'Les personnes')}</h3><p class="sous" style="margin:0 0 10px">${e(etiqPlage())}</p><div id="lp">Chargement…</div><button class="cta creux petit" data-fermer style="margin-top:14px">Fermer</button>`, true);
  const { data, error } = await X().db.rpc('liste_periode', { p_type: type, p_du: du, p_au: au });
  const z = f.querySelector('#lp'); if(!z) return;
  if(error) return z.innerHTML = '<div class="vide">' + e(error.message) + '</div>';
  z.innerHTML = tableauPersonnes(data, [['Détail', p => e(p.valeur || '')], ['Dernière fois', p => e(heureCourte(p.quand))]]);
}
async function detailZone(ecran, action, bouton){
  const { du, au } = plageActive();
  const titre = bouton ? ecran : (action ? X().nomAction(ecran) : X().nomEcran(ecran));
  const f = fenetre(`<h3>${e(titre)}</h3><p class="sous" style="margin:0 0 10px">${action ? 'Qui l\'a fait' : 'Qui y passe du temps'} · ${e(etiqPlage())}</p><div id="lp">Chargement…</div><button class="cta creux petit" data-fermer style="margin-top:14px">Fermer</button>`, true);
  const { data, error } = await X().db.rpc('detail_evenement', { p_type: bouton ? 'bouton' : (action ? 'action' : 'zone'), p_valeur: ecran, p_du: du, p_au: au });
  const z = f.querySelector('#lp'); if(!z) return;
  if(error) return z.innerHTML = '<div class="vide">' + e(error.message) + '</div>';
  z.innerHTML = tableauPersonnes(data, [action ? ['Fois', p => num(p.visites)] : ['Temps passé', p => duree(p.minutes)], ['Visites', p => action ? '' : num(p.visites)], ['Dernière fois', p => e(heureCourte(p.derniere))]]);
}
async function participantsEpreuve(id, titre){
  const f = fenetre(`<h3>${e(titre || 'Épreuve nationale')}</h3><p class="sous" style="margin:0 0 10px">Inscrits et participants</p><div id="lp">Chargement…</div><button class="cta creux petit" data-fermer style="margin-top:14px">Fermer</button>`, true);
  const { data, error } = await X().db.rpc('epreuve_participants', { p_epreuve: id });
  const z = f.querySelector('#lp'); if(!z) return;
  if(error) return z.innerHTML = '<div class="vide">' + e(error.message) + '</div>';
  z.innerHTML = tableauPersonnes(data, [
    ['Inscrit le', p => e(heureCourte(p.inscrit_le))],
    ['A composé', p => p.a_compose ? (p.terminee ? '<span class="etat ok">terminée</span>' : '<span class="etat">en cours / quittée</span>') : '<span class="etat danger">pas encore</span>'],
    ['Note', p => p.score != null ? e(p.score + ' / ' + p.nb) : '—']]);
}
X().detailEpreuve = participantsEpreuve;

document.addEventListener('click', ev => {
  const t = ev.target.closest('[data-fiche],[data-zone],[data-action],[data-bouton],[data-vers],[data-liste],[data-jour],[data-cohorte],[data-epreuve]');
  if(!t) return;
  const d = t.dataset;
  if(d.fiche){ ev.stopPropagation(); return ouvrirFiche(d.fiche); }
  if(d.zone) return detailZone(d.zone, false);
  if(d.action) return detailZone(d.action, true);
  if(d.bouton) return detailZone(d.bouton, true, true);
  if(d.vers){ const f = document.querySelector('.fenetre-plus'); if(f && f._fermer) f._fermer(); return allerA(d.vers); }
  if(d.liste) return listePeriode(d.liste);
  if(d.jour){ X().A.histPlage = { du: d.jour, au: d.jour }; X().A.histUser = null; return allerA('direct'); }
  if(d.cohorte){ const [j, k] = d.cohorte.split('|'); return detailCohorte(j, +k); }
  if(d.epreuve) return participantsEpreuve(d.epreuve, d.titre);
});

/* ============================================================
   FICHE CANDIDAT : tout ce qu'on sait d'une personne, et ce qu'on peut faire
   ============================================================ */
const nomPass = f => f === 'essai' ? 'Essai' : (X().NOM_PASS[f] || f);
const NIVEAU_NOM = { troisieme:'Troisième', terminale:'Terminale', licence:'Licence' };
async function ouvrirFiche(id){
  const f = fenetre('<div class="vide">Chargement de la fiche…</div>', true);
  const { data: r, error } = await X().db.rpc('fiche_candidat', { p_user: id });
  if(error || !r || !r.profil){ f.querySelector('.fenetre-boite').innerHTML = '<div class="vide">' + e(error ? error.message : 'Fiche introuvable.') + '</div><button class="cta creux petit" data-fermer>Fermer</button>'; return; }
  const p = r.profil, s = r.sessions || {}, q = r.questions || {}, c = r.compositions || {};
  const A = X().A, admin = !!A.admin;
  const abo = (r.abonnements || []).find(a => a.actif);
  const maxZ = Math.max(1, ...(r.zones || []).map(z => Number(z.minutes || 0)));
  const telPlein = p.telephone && !/•/.test(p.telephone) ? p.telephone.replace(/\D/g, '') : '';
  f.querySelector('.fenetre-boite').innerHTML = `
    <div class="fiche-tete">
      <div>
        <h3 style="margin:0">${e(p.nom || 'Candidat')}${p.pseudo ? ` <small style="color:var(--craie2);font-weight:400">« ${e(p.pseudo)} »</small>` : ''}</h3>
        <div class="num" style="color:var(--craie2);margin-top:4px">${p.telephone ? '+226 ' + e(p.telephone) : '—'}${p.niveau ? ' · ' + e(NIVEAU_NOM[p.niveau] || p.niveau) : ''}${p.ville ? ' · ' + e(p.ville) : ''}</div>
        <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">
          ${abo ? `<span class="etat ok">${e(nomPass(abo.formule))} jusqu'au ${e(X().dateCourte(abo.fin_le))}</span>` : '<span class="etat">Abonnement gratuit</span>'}
          ${r.banni ? '<span class="etat danger">Banni</span>' : ''}
          ${r.code_demande ? '<span class="etat">Nouveau code demandé</span>' : ''}
          ${r.push && r.push.actif ? '<span class="etat ok">Rappels activés</span>' : '<span class="etat">Pas de rappels</span>'}
        </div>
      </div>
      <button class="lien" data-fermer aria-label="Fermer">Fermer ✕</button>
    </div>

    <div class="mini-compteurs" style="margin-top:14px">
      <div><b class="num">${e(X().dateCourte(p.cree_le))}</b><span>Inscrit le</span></div>
      <div><b class="num">${num(s.n)}</b><span>Visites · dernière ${e(depuis(s.derniere))}</span></div>
      <div><b class="num">${duree(s.minutes)}</b><span>Temps total passé</span></div>
      <div><b class="num">${num(r.jours_actifs)}</b><span>Jours actifs</span></div>
      <div><b class="num">${num(q.n)}</b><span>Questions · ${pct(q.bonnes, q.n)} % justes</span></div>
      <div><b class="num">${num(c.n)}</b><span>Compositions · ${num(c.terminees)} terminées${c.moyenne != null ? ' · moy. ' + c.moyenne + ' %' : ''}</span></div>
      <div><b class="num">${num(r.erreurs_ouvertes)}</b><span>Erreurs à retravailler</span></div>
      <div><b class="num">${e((s.systeme || '—'))}</b><span>${e(s.appareil || 'Appareil inconnu')}</span></div>
    </div>

    <div class="fiche-grille">
      <div>
        <div class="libelle">Où il passe son temps</div>
        ${(r.zones || []).length ? `<table><tbody>${r.zones.map(z => `<tr class="cliquable" data-zone="${e(z.ecran)}"><td>${e(X().nomEcran(z.ecran))}${X().barreHorizontale(Number(z.minutes), maxZ)}</td><td class="num" style="text-align:right">${duree(z.minutes)}<br><span style="color:var(--craie2);font-size:11.5px">${num(z.visites)} visite${z.visites > 1 ? 's' : ''}</span></td></tr>`).join('')}</tbody></table>` : '<div class="vide">Rien d\'observé.</div>'}
      </div>
      <div>
        <div class="libelle">Ce qu'il fait le plus</div>
        ${(r.actions || []).length ? `<table><tbody>${r.actions.map(a => `<tr class="cliquable" data-action="${e(a.nom)}"><td>${e(X().nomAction(a.nom))}</td><td class="num" style="text-align:right">${num(a.n)}</td></tr>`).join('')}</tbody></table>` : '<div class="vide">Rien d\'observé.</div>'}
      </div>
    </div>

    ${(r.matieres || []).length ? `<div class="libelle" style="margin-top:16px">Ses matières</div>
      <table><tbody>${r.matieres.map(m => `<tr><td>${e(m.nom)}</td><td class="num">${num(m.n)} réponses</td><td class="num" style="color:${m.taux < 50 ? 'var(--rouge-texte)' : 'var(--vert-texte)'}">${m.taux} % justes</td></tr>`).join('')}</tbody></table>` : ''}

    ${(r.dernieres_compositions || []).length ? `<div class="libelle" style="margin-top:16px">Ses dernières compositions</div>
      <table><tbody>${r.dernieres_compositions.map(k => `<tr><td>${e(heureCourte(k.debut_le))}${k.epreuve ? ' · nationale' : ''}</td><td>${k.terminee ? '<span class="etat ok">terminée</span>' : '<span class="etat">non terminée</span>'}</td><td class="num">${k.terminee ? e(k.score + ' / ' + k.nb) : e((k.traitees || 0) + ' / ' + k.nb + ' traitées')}</td></tr>`).join('')}</tbody></table>` : ''}

    <div class="libelle" style="margin-top:16px">Abonnements et paiements</div>
    ${(r.paiements || []).length || (r.abonnements || []).length ? `<table><tbody>
      ${(r.abonnements || []).map(a => `<tr><td>Abonnement ${e(nomPass(a.formule))}</td><td>${e(X().dateCourte(a.debut_le))} → ${e(X().dateCourte(a.fin_le))}</td><td>${a.actif ? '<span class="etat ok">actif</span>' : '<span class="etat">terminé</span>'}</td></tr>`).join('')}
      ${(r.paiements || []).map(k => `<tr><td>Paiement ${e(X().NOM_OPERATEUR[k.operateur] || k.operateur || '')}</td><td>${F(k.montant)} · ${e(heureCourte(k.cree_le))}</td><td>${k.statut === 'confirme' ? '<span class="etat ok">confirmé</span>' : k.statut === 'refuse' ? '<span class="etat danger">refusé</span>' : '<span class="etat">en attente</span>'}</td></tr>`).join('')}
    </tbody></table>` : '<div class="vide">Aucun paiement ni abonnement.</div>'}

    ${(r.avis || []).length ? `<div class="libelle" style="margin-top:16px">Ses avis</div>${r.avis.map(a => `<div class="carte" style="margin-top:6px"><small>${e(heureCourte(a.cree_le))}</small><p style="margin:4px 0;white-space:pre-wrap">${e(a.message)}</p>${a.reponse ? `<div class="reponse-admin"><small>Réponse</small><p style="margin:2px 0 0">${e(a.reponse)}</p></div>` : ''}</div>`).join('')}` : ''}

    <div class="libelle" style="margin-top:16px">Ses dernières actions <button class="lien" data-histo="${e(p.id)}" style="margin-left:8px;text-transform:none;letter-spacing:0">voir tout l'historique</button></div>
    ${(r.dernieres || []).length ? `<div class="defile" style="max-height:220px"><table><tbody>${r.dernieres.map(a => `<tr><td class="num" style="color:var(--craie2);white-space:nowrap">${e(heureCourte(a.quand))}</td><td>${e(X().nomAction(a.nom))}${a.element ? ' · ' + e(a.element) : ''}</td><td style="color:var(--craie2)">${e(a.ecran ? X().nomEcran(a.ecran) : '')}</td></tr>`).join('')}</tbody></table></div>` : '<div class="vide">Rien d\'observé.</div>'}

    ${admin ? `<div class="libelle" style="margin-top:18px">Agir sur ce compte</div>
    <div class="fiche-actions">
      <div class="carte">
        <b>Lui écrire</b>
        <input id="fm-titre" placeholder="Titre (3 à 80 caractères)" maxlength="80" style="margin-top:8px">
        <textarea id="fm-msg" rows="3" maxlength="600" placeholder="Message pour ce candidat seulement"></textarea>
        <div class="rangee" style="align-items:center;margin-top:6px">
          <select id="fm-mode"><option value="les_deux">Cloche et plein écran</option><option value="cloche">Cloche seulement</option><option value="plein">Plein écran seulement</option></select>
          <button class="cta petit" id="fm-go">Envoyer</button>
        </div>
      </div>
      <div class="carte">
        <b>Changer son code secret</b>
        <p class="sous" style="margin:6px 0 10px;font-size:12.5px">Il reçoit une notification. En la touchant, il écrit son nouveau code (4 chiffres) deux fois. Vous ne voyez jamais le code.</p>
        <button class="cta creux petit" id="fm-code">${r.code_demande ? 'Renvoyer la demande' : 'Lui demander un nouveau code'}</button>
      </div>
      ${telPlein ? `<div class="carte">
        <b>Activer un Pass</b>
        <div class="rangee" style="align-items:center;margin-top:8px">
          <select id="fm-formule"><option value="semaine">Pass Semaine</option><option value="mensuelle" selected>Pass Mois</option><option value="annuelle">Pass Année</option></select>
          <button class="cta creux petit" id="fm-pass">Activer</button>
        </div>
        <a class="lien" style="display:inline-block;margin-top:10px" target="_blank" rel="noopener" href="https://wa.me/226${e(telPlein.slice(-8))}">Ouvrir WhatsApp avec lui</a>
      </div>` : ''}
    </div>
    <p id="fm-etat" class="sous" style="margin-top:8px"></p>` : ''}
    <button class="cta creux petit" data-fermer style="margin-top:16px">Fermer</button>`;

  const etat = t => { const z = f.querySelector('#fm-etat'); if(z) z.textContent = t; };
  f.querySelector('[data-histo]').onclick = () => { X().A.histUser = { id: p.id, nom: p.nom }; X().A.histPlage = null; f._fermer(); allerA('direct'); };
  if(admin){
    f.querySelector('#fm-go').onclick = async () => {
      const b = f.querySelector('#fm-go'); b.disabled = true; etat('Envoi…');
      const { data, error: er } = await X().db.rpc('admin_envoyer_a', { p_user: p.id, p_titre: f.querySelector('#fm-titre').value, p_message: f.querySelector('#fm-msg').value, p_mode: f.querySelector('#fm-mode').value });
      b.disabled = false;
      if(er || !data || !data.ok) return etat((data && data.message) || (er && er.message) || 'Échec.');
      etat('Message envoyé.'); f.querySelector('#fm-titre').value = ''; f.querySelector('#fm-msg').value = '';
    };
    f.querySelector('#fm-code').onclick = async () => {
      if(!confirm('Demander à ' + (p.nom || 'ce candidat') + ' de choisir un nouveau code secret ?')) return;
      const { data, error: er } = await X().db.rpc('admin_demander_changement_code', { p_user: p.id });
      etat(er || !data || !data.ok ? ((data && data.message) || (er && er.message) || 'Échec.') : 'Demande envoyée : il la verra à sa prochaine ouverture (et par notification s\'il a activé les rappels).');
    };
    const bp = f.querySelector('#fm-pass');
    if(bp) bp.onclick = async () => {
      if(!confirm('Activer ce Pass pour ' + (p.nom || 'ce candidat') + ' ?')) return;
      const { data, error: er } = await X().db.rpc('admin_activer_pass', { p_telephone: telPlein.slice(-8), p_formule: f.querySelector('#fm-formule').value, p_note: 'Depuis la fiche' });
      etat(er || !data || !data.ok ? ((data && data.message) || (er && er.message) || 'Échec.') : 'Pass activé jusqu\'au ' + new Date(data.fin_le).toLocaleDateString('fr-FR') + '.');
    };
  }
}
X().ouvrirFiche = ouvrirFiche;

/* ============================================================
   RECHERCHE : par nom ou par numéro
   ============================================================ */
function brancherRecherche(champ, sortie, apres){
  let t = null, dernier = '';
  champ.addEventListener('input', () => {
    clearTimeout(t);
    const q = champ.value.trim();
    if(q.length < 2){ sortie.innerHTML = ''; sortie.hidden = true; return; }
    t = setTimeout(async () => {
      dernier = q;
      const { data, error } = await X().db.rpc('chercher_candidats', { p_q: q });
      if(q !== dernier) return;
      sortie.hidden = false;
      if(error){ sortie.innerHTML = '<div class="vide">' + e(error.message) + '</div>'; return; }
      sortie.innerHTML = (data || []).length ? data.map(p => `<button class="resultat" data-id="${e(p.id)}"><b>${e(p.nom)}</b>
        <span class="num">${p.telephone ? '+226 ' + e(p.telephone) : '—'}</span>
        <small>${p.formule ? e(X().NOM_PASS[p.formule] || p.formule) : 'gratuit'} · ${p.derniere ? 'vu ' + e(depuis(p.derniere)) : 'jamais venu'}</small></button>`).join('')
        : '<div class="vide" style="padding:10px">Aucun candidat trouvé.</div>';
      sortie.querySelectorAll('.resultat').forEach(b => b.onclick = () => { ouvrirFiche(b.dataset.id); if(apres) apres(); });
    }, 250);
  });
}
V.recherche = function(){
  $('#vue').innerHTML = `
    <h2 class="titre">Chercher un candidat</h2>
    <p class="sous">Tapez un nom, un pseudo ou quelques chiffres du numéro. Touchez un résultat : vous voyez sa fiche complète et vous pouvez agir.</p>
    <div class="carte" style="margin-top:14px"><input id="rech-page" type="search" placeholder="Nom ou numéro de téléphone" autocomplete="off" style="font-size:16px">
      <div id="rech-page-res" class="resultats" hidden></div></div>`;
  brancherRecherche($('#rech-page'), $('#rech-page-res'));
  $('#rech-page').focus();
};

/* ============================================================
   ANALYTIQUE : des chiffres, des courbes, rien d'estimé
   ============================================================ */
function tuile(lib, val, prec, o){
  o = o || {};
  const att = o.liste ? ` class="compteur cliquable" data-liste="${o.liste}"` : o.vers ? ` class="compteur cliquable" data-vers="${o.vers}"` : ' class="compteur"';
  return `<div${att}><div class="v num">${o.fmt ? o.fmt(val) : num(val)}</div><div class="l">${e(lib)}</div><div class="d">${o.detail ? e(o.detail) + '<br>' : ''}${tendance(val, prec)}</div></div>`;
}
V.analytique = async function(){
  const { db, A } = X();
  $('#vue').innerHTML = `
    <h2 class="titre">Analytique</h2>
    <p class="sous">Les chiffres réels du site, sur la période de votre choix : choisissez un raccourci ou deux dates au calendrier. Touchez un chiffre pour voir les personnes derrière, une barre pour voir ce qui s'est passé ce jour-là.</p>
    ${X().choixPeriode()}
    <div id="zone-ana">Chargement…</div>`;
  X().brancherPeriode(V.analytique);
  const { du, au } = plageActive();
  const { data: a, error } = await db.rpc('analytique', { p_du: du, p_au: au });
  const z = $('#zone-ana');
  if(!z || A.vue !== 'analytique') return;
  if(error || !a){ z.innerHTML = '<div class="vide">' + e(error ? error.message : 'Pas de données') + '</div>'; return; }
  const t = a.tot, pr = a.prec, serie = a.serie || [];
  const jours = serie.map(s => String(s.jour).slice(0, 10)), lab = jours.map(jourCourt);
  const taux = serie.map(s => s.questions ? Math.round(100 * s.bonnes / s.questions) : 0);
  const maxSrc = Math.max(1, ...(a.sources || []).map(x => x.n)), maxSys = Math.max(1, ...(a.systemes || []).map(x => x.n));
  const maxNiv = Math.max(1, ...(a.niveaux || []).map(x => x.n));
  const heures = (a.heures || []).map(h => h.n), pic = heures.length ? heures.indexOf(Math.max(...heures)) : -1;
  const sem = (a.semaine || []).map(h => h.n);
  z.innerHTML = `
    <p class="sous" style="margin:0 0 12px">${e(etiqPlage())} · ${a.jours} jour${a.jours > 1 ? 's' : ''}. Les flèches comparent aux ${a.jours} jours d'avant.</p>
    <div class="compteurs">
      ${tuile('Nouveaux inscrits', t.inscrits, pr.inscrits, { liste:'inscrits' })}
      ${tuile('Candidats actifs', t.actifs, pr.actifs, { liste:'actifs' })}
      ${tuile('Visites', t.sessions, pr.sessions, { vers:'direct' })}
      ${tuile('Temps passé', t.minutes, pr.minutes, { fmt: duree, liste:'actifs' })}
      ${tuile('Questions répondues', t.questions, pr.questions, { liste:'questions', detail: pct(t.bonnes, t.questions) + ' % de bonnes réponses' })}
      ${tuile('Compositions commencées', t.compositions, pr.compositions, { liste:'compositions', detail: num(t.terminees) + ' terminées' })}
      ${tuile('Paiements reçus', t.paiements, pr.paiements, { liste:'payants', detail: F(t.montant) })}
      ${tuile('Demandes de paiement', t.demandes, pr.demandes, { vers:'paiements' })}
      ${tuile('Nouveaux abonnés', t.nouveaux_abonnes, pr.nouveaux_abonnes, { vers:'paiements' })}
      ${tuile('Partages', t.partages, pr.partages, { liste:'partages' })}
    </div>

    <div class="bloc"><div class="libelle">Les inscriptions<span>inscrits au total, jour par jour</span></div>
      <div class="carte">${X().graphiqueCroissance(serie.map(s => ({ jour: String(s.jour).slice(0, 10), inscrits: s.inscrits })), a.avant)}</div></div>

    <div class="deux-col">
      <div class="bloc"><div class="libelle">Qui vient<span>actifs et visites par jour</span></div>
        <div class="carte">${courbes({ titre:'Actifs et visites par jour', labels: lab, jours, series:[{ nom:'Candidats actifs', valeurs: serie.map(s => s.actifs) }, { nom:'Visites', valeurs: serie.map(s => s.visites), couleur:'#E3A82B' }] })}</div></div>
      <div class="bloc"><div class="libelle">Le temps passé<span>minutes par jour</span></div>
        <div class="carte">${barres({ titre:'Minutes par jour', labels: lab, jours, valeurs: serie.map(s => s.minutes), format: v => duree(v), marge: 56 })}</div></div>
    </div>

    <div class="deux-col">
      <div class="bloc"><div class="libelle">Le travail<span>questions répondues par jour</span></div>
        <div class="carte">${barres({ titre:'Questions par jour', labels: lab, jours, valeurs: serie.map(s => s.questions) })}</div></div>
      <div class="bloc"><div class="libelle">La réussite<span>% de bonnes réponses par jour</span></div>
        <div class="carte">${courbes({ titre:'Taux de réussite', labels: lab, jours, plafond: 100, format: v => Math.round(v) + ' %', series:[{ nom:'Bonnes réponses', valeurs: taux, couleur:'#8FB4E8' }] })}</div></div>
    </div>

    <div class="deux-col">
      <div class="bloc"><div class="libelle">Les compositions<span>commencées et terminées</span></div>
        <div class="carte">${courbes({ titre:'Compositions', labels: lab, jours, series:[{ nom:'Commencées', valeurs: serie.map(s => s.compositions) }, { nom:'Terminées', valeurs: serie.map(s => s.terminees), couleur:'#E3A82B' }] })}</div></div>
      <div class="bloc"><div class="libelle">L'argent reçu<span>FCFA par jour</span></div>
        <div class="carte">${barres({ titre:'Revenus par jour', labels: lab, jours, valeurs: serie.map(s => s.montant), format: v => F(v), marge: 70, couleur:'#E3A82B', vide:'Aucun paiement reçu sur cette période.' })}</div></div>
    </div>

    <div class="deux-col">
      <div class="bloc"><div class="libelle">Les heures<span>quand ils arrivent${pic >= 0 && heures[pic] ? ' · pic vers ' + pic + ' h' : ''}</span></div>
        <div class="carte">${barres({ titre:'Visites par heure', labels: heures.map((_, i) => i + ' h'), valeurs: heures, pas: 3, largeur: 520 })}</div></div>
      <div class="bloc"><div class="libelle">Les jours de la semaine</div>
        <div class="carte">${barres({ titre:'Visites par jour de la semaine', labels: JOURS, valeurs: sem, pas: 1, largeur: 520 })}</div></div>
    </div>

    <div class="deux-col">
      <div class="bloc"><div class="libelle">D'où ils viennent</div><div class="carte">
        ${(a.sources || []).length ? `<table><tbody>${a.sources.map(x => `<tr><td>${e(x.nom)}${X().barreHorizontale(x.n, maxSrc)}</td><td class="num" style="text-align:right">${num(x.n)}</td></tr>`).join('')}</tbody></table>` : X().insuffisant()}</div></div>
      <div class="bloc"><div class="libelle">Leurs téléphones</div><div class="carte">
        ${(a.systemes || []).length ? `<table><tbody>${a.systemes.map(x => `<tr><td>${e(x.nom)}${X().barreHorizontale(x.n, maxSys)}</td><td class="num" style="text-align:right">${num(x.n)}</td></tr>`).join('')}</tbody></table>` : X().insuffisant()}</div></div>
    </div>

    <div class="deux-col">
      <div class="bloc"><div class="libelle">Les niveaux des nouveaux inscrits</div><div class="carte">
        ${(a.niveaux || []).length ? `<table><tbody>${a.niveaux.map(x => `<tr><td>${e(NIVEAU_NOM[x.nom] || x.nom)}${X().barreHorizontale(x.n, maxNiv, 'var(--or)')}</td><td class="num" style="text-align:right">${num(x.n)}</td></tr>`).join('')}</tbody></table>` : X().insuffisant('Aucune inscription sur cette période.')}</div></div>
      <div class="bloc"><div class="libelle">Les matières travaillées</div><div class="carte">
        ${(a.matieres || []).length ? `<table><thead><tr><th>Matière</th><th>Réponses</th><th>Réussite</th></tr></thead><tbody>${a.matieres.map(x => `<tr><td>${e(x.nom)}</td><td class="num">${num(x.reponses)}</td><td class="num" style="color:${x.taux < 50 ? 'var(--rouge-texte)' : 'var(--vert-texte)'}">${x.taux} %</td></tr>`).join('')}</tbody></table>` : X().insuffisant()}</div></div>
    </div>`;
};

/* ============================================================
   RÉTENTION : qui revient, jour après jour, au calendrier
   ============================================================ */
const COLS = [1, 2, 3, 4, 5, 6, 7, 14, 21, 30];
V.retention = async function(){
  const { db, A } = X();
  $('#vue').innerHTML = `
    <h2 class="titre">Rétention</h2>
    <p class="sous">Pour chaque jour d'inscription, la part des inscrits qui sont revenus 1 jour, 2 jours… 30 jours plus tard. Plus la case est verte, plus ils sont revenus. Touchez une case : vous voyez qui est revenu et qui ne l'est pas, pour le relancer.</p>
    ${X().choixPeriode([[7, '7 jours'], [30, '30 jours'], [90, '90 jours']])}
    <div id="zone-ret">Chargement…</div>`;
  X().brancherPeriode(V.retention);
  const { du, au } = plageActive();
  const { data, error } = await db.rpc('retention_cohortes', { p_du: du, p_au: au });
  const z = $('#zone-ret');
  if(!z || A.vue !== 'retention') return;
  if(error){ z.innerHTML = '<div class="vide">' + e(error.message) + '</div>'; return; }
  const l = data || [];
  if(!l.length){ z.innerHTML = '<div class="carte">' + X().insuffisant('Personne ne s\'est inscrit sur cette période.') + '</div>'; return; }
  const tot = {}, base = {};
  COLS.forEach(k => { tot[k] = 0; base[k] = 0; l.forEach(c => { const r = c.j && c.j[k]; if(r != null){ tot[k] += r; base[k] += c.n; } }); });
  const moy = k => base[k] ? Math.round(100 * tot[k] / base[k]) : null;
  const total = l.reduce((a, c) => a + c.n, 0);
  const cellule = (c, k) => {
    const r = c.j ? c.j[k] : null;
    if(r == null) return '<td class="ret-vide">·</td>';
    const p = pct(r, c.n);
    return `<td class="ret-cell cliquable" data-cohorte="${e(String(c.jour).slice(0, 10))}|${k}" style="background:rgba(79,181,138,${(0.08 + 0.7 * p / 100).toFixed(2)})" title="${r} sur ${c.n} sont revenus"><b>${p}%</b><small>${r}/${c.n}</small></td>`;
  };
  z.innerHTML = `
    <div class="compteurs">
      ${[1, 2, 7, 30].map(k => `<div class="compteur"><div class="v num">${moy(k) == null ? '—' : moy(k) + ' %'}</div><div class="l">Reviennent à J+${k}</div><div class="d">${base[k] ? num(base[k]) + ' inscrits mesurables' : 'trop tôt pour mesurer'}</div></div>`).join('')}
      <div class="compteur"><div class="v num">${num(total)}</div><div class="l">Inscrits sur la période</div></div>
    </div>
    <div class="bloc"><div class="libelle">Le calendrier de retour<span>une ligne par jour d'inscription</span></div>
      <div class="carte"><div class="defile"><table class="ret-table"><thead><tr><th>Inscrits le</th><th>Nb</th>${COLS.map(k => `<th>J+${k}</th>`).join('')}</tr></thead><tbody>
        ${l.map(c => `<tr><td>${e(X().jourLong(String(c.jour).slice(0, 10)))}</td><td class="num">${c.n}</td>${COLS.map(k => cellule(c, k)).join('')}</tr>`).join('')}
        <tr class="ret-moy"><td>Moyenne</td><td class="num">${num(total)}</td>${COLS.map(k => `<td class="num"><b>${moy(k) == null ? '·' : moy(k) + '%'}</b></td>`).join('')}</tr>
      </tbody></table></div>
      <p class="sous" style="font-size:12.5px;margin-top:8px">Un point · veut dire que le jour n'est pas encore arrivé. « Revenu » signifie : a ouvert l'application ce jour-là précisément.</p></div></div>`;
};
async function detailCohorte(jour, k){
  const f = fenetre(`<h3>Inscrits le ${e(X().jourLong(jour))}</h3><p class="sous" style="margin:0 0 10px">Sont-ils revenus ${k} jour${k > 1 ? 's' : ''} plus tard ?</p><div id="lp">Chargement…</div><button class="cta creux petit" data-fermer style="margin-top:14px">Fermer</button>`, true);
  const { data, error } = await X().db.rpc('retention_detail', { p_jour: jour, p_k: k });
  const z = f.querySelector('#lp'); if(!z) return;
  if(error) return z.innerHTML = '<div class="vide">' + e(error.message) + '</div>';
  const l = data || [];
  z.innerHTML = `<p class="sous" style="margin:0 0 8px"><b>${l.filter(p => p.revenu).length}</b> revenus · <b>${l.filter(p => !p.revenu).length}</b> pas revenus ce jour-là</p>` +
    tableauPersonnes(l, [['À J+' + k, p => p.revenu ? '<span class="etat ok">revenu</span>' : '<span class="etat danger">pas revenu</span>'], ['Dernière visite', p => e(p.derniere ? depuis(p.derniere) : 'jamais')]]);
}

/* ---------- passerelle : les petits outils servent à la seconde partie ---------- */
Object.assign(window.ADMIN, { plageActive, etiqPlage, duree, depuis, heureCourte, pct, F, tuile, tendance, allerA, listePeriode, detailZone, ouvrirFiche, brancherRecherche, COUL, JOURS, NIVEAU_NOM });

})();
