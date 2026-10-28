/* ============================================================
   MON CONCOURS · administration · compléments (2/2)
   Paiements (reçus / en cours / non confirmés + entonnoir), En direct et historique,
   Compositions en direct, Diffuser, Conseil des dix, application et alertes.
   ============================================================ */
(function(){
'use strict';

const V = window.ADMIN.vues;
const X = () => window.ADMIN;
const e = v => X().E(v);
const num = v => X().nombre(v == null ? 0 : v);
const F = v => num(v) + ' F';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const pct = (a, b) => b ? Math.round(100 * a / b) : 0;
const allerA = vue => { X().A.vue = vue; X().rendre(); };
const nomPass = f => f === 'essai' ? 'Essai' : (X().NOM_PASS[f] || f || 'Pass');
const jourIso = d => X().isoJour(d);

/* ============================================================
   PAIEMENTS : reçus, en cours, non confirmés, et où ils s'arrêtent
   ============================================================ */
const ETAPE_NOM = { 1:'A vu la page abonnement', 2:'A choisi une formule', 3:'A commencé le paiement', 4:'A déclaré avoir payé', 5:'A envoyé la preuve', 6:'Demande reçue par l\'équipe', 7:'Paiement confirmé' };

X().paiementsPlus = async function(zone, recharger){
  const { db, A } = X();
  zone.innerHTML = `<div class="carte"><h3 style="margin:0 0 4px">Argent reçu, en cours, non confirmé</h3>
    <p class="sous" style="margin:0 0 12px;font-size:13px">Choisissez la période : raccourci ou deux dates au calendrier. Touchez un bloc pour voir les personnes, un nom pour ouvrir sa fiche.</p>
    ${X().choixPeriode()}<div id="pp">Chargement…</div></div>`;
  X().brancherPeriode(() => recharger());
  const { du, au } = X().plageActive();
  const [r1, r2] = await Promise.all([db.rpc('paiements_vue', { p_du: du, p_au: au }), db.rpc('entonnoir_paiement', { p_du: du, p_au: au })]);
  const pp = $('#pp'); if(!pp) return;
  if(r1.error){ pp.innerHTML = '<div class="vide">' + e(r1.error.message) + '</div>'; return; }
  const d = r1.data, ent = r2.data;
  const total = (d.recus || []).reduce((a, p) => a + (p.montant || 0), 0);
  const montantAttente = (d.attente || []).reduce((a, p) => a + (p.montant || 0), 0);
  const nCours = (d.attente || []).length + (d.en_cours || []).length, nNon = (d.refuses || []).length + (d.abandons || []).length;
  let onglet = A.ppOnglet || 'recus';

  const ligneNom = p => p.user_id ? `<b class="cliquable" data-fiche="${e(p.user_id)}">${e(p.nom || 'Candidat')}</b><br><span class="num cliquable" data-fiche="${e(p.user_id)}" style="font-size:11.5px;color:var(--craie2)">${p.tel ? '+226 ' + e(p.tel) : '—'}</span>` : `<b>${e(p.nom || 'Candidat')}</b>`;
  const corps = {
    recus: () => (d.recus || []).length ? `<div class="defile"><table><thead><tr><th>Candidat</th><th>Pass</th><th>Moyen</th><th>Montant</th><th>Reçu le</th></tr></thead><tbody>${d.recus.map(p => `<tr>
      <td>${ligneNom(p)}</td><td>${e(nomPass(p.formule))}</td><td>${e(X().NOM_OPERATEUR[p.operateur] || p.operateur || '')}</td><td class="num">${F(p.montant)}</td><td>${e(X().heureCourte(p.regle_le || p.cree_le))}</td></tr>`).join('')}</tbody></table></div>` : '<div class="vide">Aucun paiement reçu sur cette période.</div>',
    cours: () => `${(d.attente || []).length ? `<div class="libelle" style="margin-bottom:6px">Demandes envoyées, à vérifier par l'équipe</div><div class="defile"><table><thead><tr><th>Candidat</th><th>Pass · moyen</th><th>Montant</th><th>Depuis</th><th></th></tr></thead><tbody>${d.attente.map(p => `<tr>
      <td>${ligneNom(p)}</td><td>${e(nomPass(p.formule))}<br><span style="color:var(--craie2);font-size:12px">${e(X().NOM_OPERATEUR[p.operateur] || p.operateur || '')}</span></td><td class="num">${F(p.montant)}</td><td>${e(X().depuis(p.cree_le))}</td>
      <td>${p.preuve ? `<button class="mini" data-pp-voir="${e(p.preuve)}">Voir la capture</button> ` : ''}${d.admin ? `<button class="mini" data-pp-ok="${e(p.id)}">Confirmer</button> <button class="mini danger" data-pp-non="${e(p.id)}">Refuser</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<div class="vide" style="margin-bottom:8px">Aucune demande en attente de vérification.</div>'}
      <div class="libelle" style="margin:14px 0 6px">En train de payer (dernières 24 h), pas encore de demande</div>
      ${(d.en_cours || []).length ? `<div class="defile"><table><thead><tr><th>Candidat</th><th>Où il en est</th><th>Pass</th><th>Dernière action</th></tr></thead><tbody>${d.en_cours.map(p => `<tr>
        <td>${ligneNom(p)}</td><td>${e(ETAPE_NOM[p.etape] || 'Paiement commencé')}</td><td>${e(p.formule ? nomPass(p.formule) : '—')}</td><td>${e(X().depuis(p.derniere))}</td></tr>`).join('')}</tbody></table></div>` : '<div class="vide">Personne n\'est en train de payer en ce moment.</div>'}`,
    non: () => `${(d.refuses || []).length ? `<div class="libelle" style="margin-bottom:6px">Refusés par l'équipe</div><div class="defile"><table><thead><tr><th>Candidat</th><th>Pass · moyen</th><th>Montant</th><th>Motif</th><th>Le</th></tr></thead><tbody>${d.refuses.map(p => `<tr>
      <td>${ligneNom(p)}</td><td>${e(nomPass(p.formule))}<br><span style="color:var(--craie2);font-size:12px">${e(X().NOM_OPERATEUR[p.operateur] || p.operateur || '')}</span></td><td class="num">${F(p.montant)}</td><td>${e(p.motif || '—')}</td><td>${e(X().heureCourte(p.cree_le))}</td></tr>`).join('')}</tbody></table></div>` : '<div class="vide" style="margin-bottom:8px">Aucun paiement refusé sur cette période.</div>'}
      <div class="libelle" style="margin:14px 0 6px">Paiements commencés puis abandonnés</div>
      ${(d.abandons || []).length ? `<div class="defile"><table><thead><tr><th>Candidat</th><th>S'est arrêté à</th><th>Pass</th><th>Dernière action</th></tr></thead><tbody>${d.abandons.map(p => `<tr>
        <td>${ligneNom(p)}</td><td>${e(p.abandon ? 'A abandonné' + (p.etape ? ' · ' + (ETAPE_NOM[p.etape] || '').toLowerCase() : '') : (ETAPE_NOM[p.etape] || 'Paiement commencé') + ', puis plus rien')}</td><td>${e(p.formule ? nomPass(p.formule) : '—')}</td><td>${e(X().depuis(p.derniere))}</td></tr>`).join('')}</tbody></table></div>
        <p class="sous" style="font-size:12.5px;margin-top:6px">Ces personnes ont une raison de ne pas avoir fini : à elles de vous la donner. Ouvrez leur fiche pour leur écrire.</p>` : '<div class="vide">Aucun abandon sur cette période.</div>'}`
  };
  const tuileP = (cle, lib, val, det) => `<div class="compteur cliquable${onglet === cle ? ' choisi' : ''}" data-pp-onglet="${cle}"><div class="v num">${val}</div><div class="l">${lib}</div><div class="d">${det}</div></div>`;
  pp.innerHTML = '<div id="pp-haut"></div><div id="pp-bas"></div>';
  const haut = pp.querySelector('#pp-haut');
  const dessiner = () => {
    haut.innerHTML = `
      <div class="compteurs" style="margin-bottom:12px">
        ${tuileP('recus', 'Reçu', F(total), (d.recus || []).length + ' paiement' + ((d.recus || []).length > 1 ? 's' : '') + (d.codes ? ' · ' + d.codes + ' code' + (d.codes > 1 ? 's' : '') + ' gratuit' + (d.codes > 1 ? 's' : '') : ''))}
        ${tuileP('cours', 'En cours', nCours, (d.attente || []).length + ' à vérifier (' + F(montantAttente) + ') · ' + (d.en_cours || []).length + ' en train de payer')}
        ${tuileP('non', 'Non confirmé', nNon, (d.refuses || []).length + ' refusé' + ((d.refuses || []).length > 1 ? 's' : '') + ' · ' + (d.abandons || []).length + ' abandonné' + ((d.abandons || []).length > 1 ? 's' : ''))}
      </div>
      <div id="pp-corps">${corps[onglet]()}</div>`;
    haut.querySelectorAll('[data-pp-onglet]').forEach(b => b.onclick = () => { onglet = A.ppOnglet = b.dataset.ppOnglet; dessiner(); });
    haut.querySelectorAll('[data-pp-voir]').forEach(b => b.onclick = async () => {
      const { data: url } = await db.storage.from('preuves-paiement').createSignedUrl(b.dataset.ppVoir, 300);
      if(!(url && url.signedUrl)) return X().signal('Impossible d\'ouvrir cette capture.', 'mal');
      X().fenetre(`<h3>Capture du paiement</h3><img src="${e(url.signedUrl)}" alt="Capture du paiement" style="width:100%;border-radius:10px;margin-top:8px"><button class="cta creux petit" data-fermer style="margin-top:12px">Fermer</button>`);
    });
    haut.querySelectorAll('[data-pp-ok]').forEach(b => b.onclick = async () => {
      b.disabled = true;
      const { data, error } = await db.rpc('confirmer_paiement', { p_id: b.dataset.ppOk, p_confirme: true });
      if(error || !data || !data.ok){ b.disabled = false; return X().signal((data && data.message) || (error && error.message) || 'Échec.', 'mal'); }
      X().signal('Paiement confirmé : l\'abonnement est actif.', 'bien'); recharger();
    });
    haut.querySelectorAll('[data-pp-non]').forEach(b => b.onclick = async () => {
      const motif = prompt('Motif du refus (le candidat le lira) :', 'Le montant ou le nom sur la capture ne correspond pas. Écrivez-nous sur WhatsApp.');
      if(motif === null) return;
      b.disabled = true;
      const { data, error } = await db.rpc('confirmer_paiement', { p_id: b.dataset.ppNon, p_confirme: false, p_motif: motif.trim() || null });
      if(error || !data || !data.ok){ b.disabled = false; return X().signal((data && data.message) || (error && error.message) || 'Échec.', 'mal'); }
      X().signal('Paiement refusé.', 'info'); recharger();
    });
  };
  dessiner();

  /* l'entonnoir : à quelle étape ils s'arrêtent */
  const etapes = (ent && ent.etapes) || [];
  const maxE = Math.max(1, ...etapes.map(x => x.atteint));
  const serie = d.serie || [];
  const ent_html = `
    <div class="deux-col" style="margin-top:14px">
      <div><div class="libelle">L'argent par jour</div>
        ${X().barres({ titre:'Argent reçu par jour', labels: serie.map(s => X().jourCourt(String(s.jour).slice(0, 10))), jours: serie.map(s => String(s.jour).slice(0, 10)), valeurs: serie.map(s => s.montant), format: v => F(v), marge: 70, couleur:'#E3A82B', vide:'Aucun paiement reçu sur cette période.', largeur: 520 })}</div>
      <div><div class="libelle">Par moyen et par Pass</div>
        ${(d.par_operateur || []).length ? `<table><tbody>${d.par_operateur.map(x => `<tr><td>${e(X().NOM_OPERATEUR[x.nom] || x.nom)}</td><td class="num">${x.n}</td><td class="num">${F(x.montant)}</td></tr>`).join('')}${d.par_formule.map(x => `<tr><td style="color:var(--craie2)">${e(nomPass(x.nom))}</td><td class="num">${x.n}</td><td class="num">${F(x.montant)}</td></tr>`).join('')}</tbody></table>` : '<div class="vide">Rien à répartir.</div>'}</div>
    </div>
    <div class="libelle" style="margin:18px 0 6px">Où ils s'arrêtent : de la page abonnement jusqu'au paiement confirmé<span>${e(X().etiqPlage())}</span></div>
    ${etapes.length ? `<div class="entonnoir">${etapes.map((x, i) => `<div class="ent-ligne cliquable" data-ent="${x.etape}">
        <div class="ent-nom">${e(x.libelle)}</div>
        <div class="ent-barre"><i style="width:${Math.max(2, Math.round(100 * x.atteint / maxE))}%"></i></div>
        <div class="ent-n num"><b>${num(x.atteint)}</b><small>${i ? pct(x.atteint, etapes[i - 1].atteint) + ' % de l\'étape d\'avant' : 'point de départ'}</small></div>
        <div class="ent-arret num">${x.arret ? `<b>${num(x.arret)}</b> s'arrêtent ici` : '—'}</div></div>`).join('')}</div>
      <p class="sous" style="font-size:12.5px;margin-top:8px">${num(ent.abandons)} abandon${ent.abandons > 1 ? 's' : ''} déclaré${ent.abandons > 1 ? 's' : ''} par l'application · ${num(ent.sans_etape)} sans étape précise. Touchez une étape pour voir qui s'y est arrêté. Les visiteurs sans compte sont comptés mais n'ont pas de fiche.</p>` : '<div class="vide">Pas de données sur cette période.</div>'}`;
  const bas = pp.querySelector('#pp-bas'); bas.innerHTML = ent_html;
  bas.querySelectorAll('[data-ent]').forEach(b => b.onclick = () => {
    const n = +b.dataset.ent, liste = ((ent && ent.personnes) || []).filter(p => p.etape === n);
    const f = X().fenetre(`<h3>S'arrêtent à : ${e(ETAPE_NOM[n] || '')}</h3><p class="sous" style="margin:0 0 10px">${e(X().etiqPlage())}</p><div id="lp"></div><button class="cta creux petit" data-fermer style="margin-top:14px">Fermer</button>`, true);
    f.querySelector('#lp').innerHTML = X().tableauPersonnes(liste, [['Pass', p => e(p.formule ? nomPass(p.formule) : '—')], ['Dernière action', p => e(X().heureCourte(p.derniere))], ['Remarque', p => p.abandon ? '<span class="etat danger">a abandonné</span>' : (p.statut === 'refuse' ? '<span class="etat danger">refusé</span>' : '')]]);
  });
};

/* ============================================================
   EN DIRECT ET HISTORIQUE : rien ne disparaît au bout de 24 h
   ============================================================ */
let minuteurDirect = null;
const FILTRES = [['important', 'Important'], ['paiement', 'Paiements'], ['compte', 'Comptes'], ['composition', 'Compositions'], ['tout', 'Tout']];
V.direct = async function(){
  clearTimeout(minuteurDirect);
  const { db, A } = X();
  const auj = jourIso(new Date());
  if(!A.hist) A.hist = { du: auj, au: auj, filtre: 'important' };
  if(A.histPlage){ A.hist.du = A.histPlage.du; A.hist.au = A.histPlage.au; A.histPlage = null; }
  const H = A.hist;
  let page = 0, cumul = [], total = 0;
  const hier = new Date(); hier.setDate(hier.getDate() - 1);
  const il = n => { const d = new Date(); d.setDate(d.getDate() - n); return jourIso(d); };
  $('#vue').innerHTML = `
    <h2 class="titre">En direct et historique</h2>
    <p class="sous">Ce qui se passe maintenant, et tout ce qui s'est passé avant : chaque action reste consultable, au jour près. Touchez un nom pour ouvrir sa fiche.</p>
    <div id="direct-tuiles" class="compteurs" style="margin-top:12px"></div>
    <div class="carte" style="margin-top:14px">
      <div class="rangee barre-periode" style="align-items:center;margin-bottom:8px">
        ${[['Aujourd\'hui', auj, auj], ['Hier', jourIso(hier), jourIso(hier)], ['7 jours', il(6), auj], ['30 jours', il(29), auj]].map(p => `<button class="cta creux petit${H.du === p[1] && H.au === p[2] ? ' choisi' : ''}" data-h-du="${p[1]}" data-h-au="${p[2]}">${p[0]}</button>`).join('')}
        <span class="plage-libre${[auj, jourIso(hier), il(6), il(29)].includes(H.du) && (H.au === auj || H.du === H.au) ? '' : ' on'}">
          <label>Du <input type="date" id="h-du" max="${auj}" value="${H.du}"></label><label>au <input type="date" id="h-au" max="${auj}" value="${H.au}"></label>
          <button class="cta creux petit" id="h-go">Afficher</button></span>
      </div>
      <div class="rangee" style="gap:6px;margin-bottom:8px">${FILTRES.map(f => `<button class="puce-filtre${H.filtre === f[0] ? ' choisi' : ''}" data-h-f="${f[0]}">${f[1]}</button>`).join('')}</div>
      ${A.histUser ? `<div class="filtre-actif">Seulement les actions de <b>${e(A.histUser.nom || 'ce candidat')}</b> <button class="lien" id="h-sans-user">tout afficher</button></div>` : ''}
      <div id="direct-liste">Chargement…</div>
      <div style="text-align:center;margin-top:10px"><button class="cta creux petit" id="h-plus" hidden>Voir 60 actions de plus</button></div>
    </div>`;
  $$('[data-h-du]').forEach(b => b.onclick = () => { H.du = b.dataset.hDu; H.au = b.dataset.hAu; V.direct(); });
  $$('[data-h-f]').forEach(b => b.onclick = () => { H.filtre = b.dataset.hF; V.direct(); });
  $('#h-go').onclick = () => { const du = $('#h-du').value, au = $('#h-au').value || auj; if(!du) return X().signal('Choisissez au moins le premier jour.', 'mal'); H.du = du <= au ? du : au; H.au = du <= au ? au : du; V.direct(); };
  const su = $('#h-sans-user'); if(su) su.onclick = () => { A.histUser = null; V.direct(); };

  const borne = () => ({ p_du: new Date(H.du + 'T00:00:00').toISOString(), p_au: new Date(new Date(H.au + 'T00:00:00').getTime() + 86400000).toISOString() });
  const dessiner = () => {
    const z = $('#direct-liste'); if(!z) return;
    z.innerHTML = `<p class="sous" style="margin:0 0 8px;font-size:13px">${num(total)} action${total > 1 ? 's' : ''} · ${H.du === H.au ? e(X().jourLong(H.du)) : 'du ' + e(X().jourLong(H.du)) + ' au ' + e(X().jourLong(H.au))}</p>` +
      (cumul.length ? `<div class="defile"><table><thead><tr><th>Quand</th><th>Qui</th><th>Action</th><th>Où</th></tr></thead><tbody>${cumul.map(a => `<tr>
        <td class="num" style="white-space:nowrap;color:var(--craie2)">${e(X().heureCourte(a.quand))}</td>
        <td>${a.user_id ? `<b class="cliquable" data-fiche="${e(a.user_id)}">${e(a.personne || 'Candidat')}</b>` : '<span style="color:var(--craie2)">Visiteur</span>'}${a.telephone ? ` <span class="num cliquable" data-fiche="${e(a.user_id)}" style="font-size:11.5px;color:var(--craie2)">${e(a.telephone)}</span>` : ''}</td>
        <td class="cliquable" data-action="${e(a.nom)}">${e(X().nomAction(a.nom))}${a.element ? ' · ' + e(a.element) : ''}</td>
        <td style="color:var(--craie2)">${e(a.ecran ? X().nomEcran(a.ecran) : '')}</td></tr>`).join('')}</tbody></table></div>` : X().insuffisant('Aucune action sur cette période avec ce filtre.'));
    $('#h-plus').hidden = cumul.length >= total;
  };
  const charger = async () => {
    const { data, error } = await db.rpc('historique_actions', Object.assign(borne(), { p_user: A.histUser ? A.histUser.id : null, p_filtre: H.filtre, p_limite: 60, p_offset: page * 60 }));
    if(A.vue !== 'direct') return;
    if(error){ $('#direct-liste').innerHTML = '<div class="vide">' + e(error.message) + '</div>'; return; }
    total = data.total; cumul = page ? cumul.concat(data.liste) : data.liste; dessiner();
  };
  $('#h-plus').onclick = () => { page++; charger(); };
  charger();

  const tuiles = async () => {
    if(A.vue !== 'direct') return;
    const { data: t } = await db.rpc('temps_reel');
    const z = $('#direct-tuiles'); if(!z || !t) return;
    z.innerHTML = `<div class="compteur en-ligne"><div class="v num"><i class="pouls"></i>${t.actifs_15min}</div><div class="l">Actifs (15 min)</div></div>
      <div class="compteur cliquable" data-vers="compositions"><div class="v num">${t.compositions_en_cours}</div><div class="l">Compositions en cours</div><div class="d">voir le détail</div></div>`;
    /* la première page se rafraîchit seule quand la période inclut aujourd'hui */
    if(H.au === jourIso(new Date()) && page === 0 && !A.histUser) await charger();
    minuteurDirect = setTimeout(tuiles, 10000);
  };
  tuiles();
};

/* ============================================================
   COMPOSITIONS EN DIRECT : qui compose, qui décroche, quoi faire
   ============================================================ */
V.compositions = async function(){
  const { db, A } = X();
  $('#vue').innerHTML = '<h2 class="titre">Compositions en direct</h2><p class="sous">Qui compose en ce moment, qui s\'est arrêté en route, ce qui se passe sur les épreuves nationales, et ce qu\'il vous reste à faire.</p><div id="zone-cmp">Chargement…</div>';
  const { data: r, error } = await db.rpc('compositions_suivi');
  const z = $('#zone-cmp'); if(!z || A.vue !== 'compositions') return;
  if(error){ z.innerHTML = '<div class="vide">' + e(error.message) + '</div>'; return; }
  const au = r.aujourdhui || {}, cours = r.en_cours || [], rec = r.recentes || [], ep = r.epreuves || [];
  const lente = c => (Date.now() - new Date(c.debut_le)) / 60000 > 45;
  const bloquees = cours.filter(lente);
  const actions = [];
  if(bloquees.length) actions.push({ t: `${bloquees.length} composition${bloquees.length > 1 ? 's' : ''} commencée${bloquees.length > 1 ? 's' : ''} depuis plus de 45 minutes sans fin`, d: 'Probablement quittée : leur envoyer un rappel pour qu\'ils reprennent, leur progression est gardée.', b: 'Écrire à ceux qui ont décroché', cible: 'actifs7', modele: 'reprise' });
  if(r.inscrits_sans_retour > 0) actions.push({ t: `${r.inscrits_sans_retour} inscrit${r.inscrits_sans_retour > 1 ? 's' : ''} à une épreuve nationale ne sont pas revenus`, d: 'Ils se sont inscrits mais n\'ont pas composé et ne sont pas revenus sur le site depuis.', b: 'Leur écrire', cible: 'inactifs7', modele: 'nationale' });
  const enAttente = ep.filter(x => new Date(x.debut_le) > new Date());
  if(enAttente.length) actions.push({ t: `Épreuve à venir : « ${enAttente[0].titre} » (${num(enAttente[0].inscrits)} inscrits)`, d: 'Pensez à rappeler la date à tous la veille.', b: 'Préparer un rappel à tous', cible: 'tous', modele: 'rappel' });
  z.innerHTML = `
    <div class="compteurs">
      <div class="compteur"><div class="v num">${num(au.commencees)}</div><div class="l">Commencées aujourd'hui</div></div>
      <div class="compteur"><div class="v num">${num(au.terminees)}</div><div class="l">Terminées aujourd'hui</div><div class="d">${au.commencees ? pct(au.terminees, au.commencees) + ' % des commencées' : ''}</div></div>
      <div class="compteur"><div class="v num">${au.moyenne != null ? au.moyenne + ' %' : '—'}</div><div class="l">Note moyenne</div></div>
      <div class="compteur en-ligne"><div class="v num"><i class="pouls"></i>${num(cours.length)}</div><div class="l">En cours (2 dernières heures)</div></div>
    </div>

    <div class="bloc"><div class="libelle">Ce qu'il vous reste à faire</div>
      ${actions.length ? actions.map((a, i) => `<div class="carte action-a-faire"><div><b>${e(a.t)}</b><p class="sous" style="margin:4px 0 0;font-size:13px">${e(a.d)}</p></div><button class="cta petit" data-cmp-act="${i}">${e(a.b)}</button></div>`).join('') : '<div class="carte"><div class="vide">Rien d\'urgent : aucune composition bloquée, aucun inscrit à relancer.</div></div>'}</div>

    <div class="bloc"><div class="libelle">En cours maintenant<span>${cours.length}</span></div><div class="carte">
      ${cours.length ? X().tableauPersonnes(cours, [['Sujet', c => e(c.epreuve || (c.sujet ? 'Sujet ' + c.sujet : 'Composition libre'))], ['Avancement', c => e((c.traitees || 0) + ' / ' + c.nb)], ['Commencée', c => e(X().depuis(c.debut_le)) + (lente(c) ? ' <span class="etat danger">longue</span>' : '')]]) : X().insuffisant('Personne ne compose en ce moment.')}</div></div>

    <div class="bloc"><div class="libelle">Épreuves nationales<span>touchez une ligne pour voir inscrits et participants</span></div><div class="carte">
      ${ep.length ? `<div class="defile"><table><thead><tr><th>Épreuve</th><th>Début</th><th>Inscrits</th><th>Ont composé</th><th>Terminées</th><th>Moyenne</th></tr></thead><tbody>${ep.map(x => `<tr class="cliquable" data-epreuve="${e(x.id)}" data-titre="${e(x.titre)}">
        <td><b>${e(x.titre)}</b><br><span style="color:var(--craie2);font-size:12px">${e(x.statut || '')}</span></td><td>${e(X().heureCourte(x.debut_le))}</td><td class="num">${num(x.inscrits)}</td><td class="num">${num(x.participants)}${x.inscrits ? ' <small>(' + pct(x.participants, x.inscrits) + ' %)</small>' : ''}</td><td class="num">${num(x.terminees)}</td><td class="num">${x.moyenne != null ? x.moyenne + ' %' : '—'}</td></tr>`).join('')}</tbody></table></div>` : X().insuffisant('Aucune épreuve nationale.')}</div></div>

    <div class="bloc"><div class="libelle">Les 60 dernières compositions</div><div class="carte">
      ${rec.length ? X().tableauPersonnes(rec, [['Sujet', c => e(c.nationale ? 'Nationale' : (c.sujet ? 'Sujet ' + c.sujet : 'Libre'))], ['Résultat', c => c.terminee ? '<span class="etat ok">' + e(c.score + ' / ' + c.nb) + '</span>' : '<span class="etat">' + e((c.traitees || 0) + ' / ' + c.nb + ' traitées') + '</span>'], ['Durée', c => c.duree ? e(Math.round(c.duree / 60) + ' min') : '—'], ['Le', c => e(X().heureCourte(c.debut_le))]]) : X().insuffisant()}</div></div>`;
  $$('[data-cmp-act]').forEach(b => b.onclick = () => { const a = actions[+b.dataset.cmpAct]; A.diffCible = a.cible; A.diffModele = a.modele; allerA('diffuser'); });
};

/* ============================================================
   DIFFUSER : un message à tous, ou à un groupe
   ============================================================ */
const CIBLES = [['tous', 'Tous les candidats'], ['abonnes', 'Abonnés (Pass payant)'], ['essai', 'En essai, sans Pass payant'], ['gratuits', 'Abonnement gratuit'], ['actifs7', 'Venus ces 7 derniers jours'], ['inactifs7', 'Pas venus depuis 7 jours'], ['push', 'Ceux qui ont activé les rappels']];
const MODELES = {
  reprise:   ['Reprenez votre composition', 'Votre composition est restée en pause. Reprenez-la quand vous voulez : votre progression est gardée.'],
  nationale: ['La composition nationale vous attend', 'Vous vous êtes inscrit à la composition nationale. Revenez composer : chaque épreuve compte pour votre classement.'],
  rappel:    ['Rappel : composition nationale', 'N\'oubliez pas la composition nationale. Soyez prêt à l\'heure, avec un bon réseau.'],
  absence:   ['Votre séance du jour vous attend', 'Quelques minutes aujourd\'hui font la différence. Ouvrez Mon Concours et faites votre séance.']
};
V.diffuser = async function(){
  const { db, A } = X();
  const admin = !!A.admin;
  const cible0 = A.diffCible || 'tous', modele = MODELES[A.diffModele] || ['', ''];
  A.diffCible = null; A.diffModele = null;
  $('#vue').innerHTML = `
    <h2 class="titre">Diffuser un message</h2>
    <p class="sous">Un message à tous les candidats, ou à un groupe. Vous choisissez comment il apparaît : dans la cloche, en grande fenêtre au milieu de l'écran, ou les deux. Une alerte sur le téléphone part aussi à ceux qui ont activé les rappels (dans la minute).</p>
    ${admin ? `<div class="deux-col" style="align-items:start">
      <div class="carte">
        <label>Titre<input id="d-titre" maxlength="80" placeholder="Nouvelle composition nationale samedi" value="${e(modele[0])}"></label>
        <label>Message<textarea id="d-msg" rows="4" maxlength="600" placeholder="Le message que les candidats liront">${e(modele[1])}</textarea></label>
        <div class="d-compte"><span id="d-nb-car">0</span> / 600</div>
        <label>Comment l'afficher
          <select id="d-mode"><option value="les_deux">Cloche et fenêtre plein écran</option><option value="plein">Fenêtre plein écran seulement</option><option value="cloche">Cloche seulement</option></select></label>
        <label>À qui
          <select id="d-cible">${CIBLES.map(c => `<option value="${c[0]}"${c[0] === cible0 ? ' selected' : ''}>${c[1]}</option>`).join('')}</select></label>
        <div id="d-nb" class="sous" style="margin:4px 0 0">…</div>
        <label>Ce que fait le bouton (facultatif)
          <select id="d-lien"><option value="">Rien : le message se ferme</option><option value="abonnement">Ouvre « Mon abonnement »</option><option value="parcours">Ouvre le parcours</option><option value="compte">Ouvre « Mon compte »</option></select></label>
        <label class="coche"><input type="checkbox" id="d-push" checked> Envoyer aussi une alerte sur le téléphone</label>
        <button class="cta" id="d-go" style="margin-top:12px">Envoyer</button>
        <p id="d-etat" class="sous" style="margin-top:8px"></p>
      </div>
      <div class="carte"><div class="libelle" style="margin-bottom:8px">Aperçu : fenêtre plein écran</div>
        <div class="apercu-fe"><div class="ap-badge">📣</div><div class="ap-marque">Mon Concours · Message de l'équipe</div><div class="ap-titre" id="ap-titre">Titre</div><div class="ap-texte" id="ap-texte">Message</div><div class="ap-bouton">J'ai compris</div></div>
        <div class="libelle" style="margin:14px 0 6px">Aperçu : cloche</div>
        <div class="apercu-cloche"><b id="ap-c-titre">Titre</b><span id="ap-c-texte">Message</span></div></div>
    </div>` : '<div class="carte"><div class="vide">Seule l\'administration peut envoyer un message. Vous pouvez consulter l\'historique ci-dessous.</div></div>'}
    <div class="bloc"><div class="libelle">Messages déjà envoyés</div><div class="carte" id="d-histo">Chargement…</div></div>`;

  const histo = async () => {
    const { data, error } = await db.rpc('diffusions_liste');
    const z = $('#d-histo'); if(!z) return;
    if(error) return z.innerHTML = '<div class="vide">' + e(error.message) + '</div>';
    z.innerHTML = (data || []).length ? `<div class="defile"><table><thead><tr><th>Envoyé</th><th>Message</th><th>Affichage</th><th>À qui</th><th>Reçu par</th></tr></thead><tbody>${data.map(x => `<tr>
      <td style="white-space:nowrap">${e(X().heureCourte(x.cree_le))}</td><td><b>${e(x.titre)}</b><br><span style="color:var(--craie2);font-size:12.5px">${e(x.message)}</span></td>
      <td>${e({ cloche:'Cloche', plein:'Plein écran', les_deux:'Cloche + plein écran' }[x.mode] || x.mode)}${x.push ? '<br><span style="color:var(--craie2);font-size:12px">+ alerte téléphone</span>' : ''}</td>
      <td>${e((CIBLES.find(c => c[0] === x.cible) || [0, x.cible])[1])}</td><td class="num">${num(x.destinataires)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="vide">Aucun message envoyé pour le moment.</div>';
  };
  histo();
  if(!admin) return;
  const maj = () => {
    $('#ap-titre').textContent = $('#d-titre').value || 'Titre'; $('#ap-texte').textContent = $('#d-msg').value || 'Message';
    $('#ap-c-titre').textContent = $('#d-titre').value || 'Titre'; $('#ap-c-texte').textContent = $('#d-msg').value || 'Message';
    $('#d-nb-car').textContent = $('#d-msg').value.length;
  };
  const compter = async () => {
    const { data } = await db.rpc('admin_compter_cible', { p_cible: $('#d-cible').value });
    const z = $('#d-nb'); if(z) z.innerHTML = '<b>' + num(data || 0) + '</b> personne' + (data > 1 ? 's' : '') + ' recevront ce message.';
  };
  ['d-titre', 'd-msg'].forEach(i => $('#' + i).addEventListener('input', maj));
  $('#d-cible').addEventListener('change', compter);
  maj(); compter();
  $('#d-go').onclick = async () => {
    const titre = $('#d-titre').value.trim(), msg = $('#d-msg').value.trim();
    if(titre.length < 3 || msg.length < 3) return ($('#d-etat').textContent = 'Écrivez un titre et un message.');
    const { data: nb } = await db.rpc('admin_compter_cible', { p_cible: $('#d-cible').value });
    if(!confirm('Envoyer ce message à ' + (nb || 0) + ' personne(s) ?\n\n« ' + titre + ' »\n\nCet envoi ne peut pas être annulé.')) return;
    const b = $('#d-go'); b.disabled = true; $('#d-etat').textContent = 'Envoi en cours…';
    const { data, error } = await db.rpc('admin_diffuser', { p_titre: titre, p_message: msg, p_mode: $('#d-mode').value, p_cible: $('#d-cible').value, p_lien: $('#d-lien').value || null, p_push: $('#d-push').checked });
    b.disabled = false;
    if(error || !data || !data.ok) return ($('#d-etat').textContent = (data && data.message) || (error && error.message) || 'Échec.');
    $('#d-etat').textContent = 'Envoyé à ' + num(data.destinataires) + ' personne(s).';
    $('#d-titre').value = ''; $('#d-msg').value = ''; maj(); histo();
  };
};

/* ============================================================
   PROMOTION : un prix réduit, lancé et arrêté à la main
   ============================================================ */
const CIBLES_PROMO = CIBLES.concat([['numeros', 'Des numéros précis']]);
V.promotion = async function(){
  const { db, A } = X();
  const admin = !!A.admin;
  $('#vue').innerHTML = `
    <h2 class="titre">Promotion</h2>
    <p class="sous">Baissez le prix des abonnements pour tout le monde, un groupe ou quelques numéros. Dès le lancement, chaque personne concernée voit une fenêtre au milieu de l'écran et la cloche. Le prix réduit est appliqué au paiement. Une seule promotion à la fois : en lancer une arrête la précédente.</p>
    <div id="pr-actuelle"></div>
    ${admin ? `<div class="carte" id="pr-form">
      <div class="libelle" style="margin-bottom:8px">Lancer une promotion</div>
      <label>Nom (vu par les candidats)<input id="pr-nom" maxlength="60" placeholder="Promotion de la semaine"></label>
      <div class="deux-col" style="gap:10px">
        <label>Abonnement Mois : nouveau prix (FCFA)<input id="pr-m" type="number" min="100" step="50" inputmode="numeric" placeholder="500"></label>
        <label>Abonnement Année : nouveau prix (FCFA)<input id="pr-a" type="number" min="100" step="50" inputmode="numeric" placeholder="2000"></label>
      </div>
      <div id="pr-normal" class="sous" style="margin:-2px 0 8px"></div>
      <label>Pour qui
        <select id="pr-cible">${CIBLES_PROMO.map(c => `<option value="${c[0]}">${c[1]}</option>`).join('')}</select></label>
      <div id="pr-nb" class="sous" style="margin:0 0 8px"></div>
      <label id="pr-tel-zone" hidden>Numéros (un par ligne ou séparés par des virgules)
        <textarea id="pr-tel" rows="3" placeholder="70 12 34 56&#10;76 00 11 22"></textarea></label>
      <label>Fin de la promotion (facultatif, heure du Burkina)<input id="pr-fin" type="datetime-local"></label>
      <p class="sous" style="margin:-2px 0 8px;font-size:12.5px">Sans date, elle dure jusqu'à ce que vous l'arrêtiez.</p>
      <label>Message (facultatif)<textarea id="pr-msg" rows="3" maxlength="400" placeholder="Laissez vide : le message est écrit avec les prix."></textarea></label>
      <button class="cta" id="pr-go" style="margin-top:6px">Lancer la promotion</button>
      <p id="pr-etat" class="sous" style="margin-top:8px"></p>
    </div>` : '<div class="carte"><div class="vide">Seule l\'administration peut lancer une promotion.</div></div>'}
    <div class="bloc"><div class="libelle">Historique</div><div class="carte" id="pr-histo">Chargement…</div></div>`;

  let normal = {};
  const charger = async () => {
    const { data, error } = await db.rpc('admin_promotions');
    const h = $('#pr-histo'); if(!h) return;
    if(error){ h.innerHTML = '<div class="vide">' + e(error.message) + '</div>'; return; }
    normal = data.normal || {};
    const nz = $('#pr-normal'); if(nz) nz.textContent = 'Prix normal : Mois ' + num(normal.mensuelle) + ' F · Année ' + num(normal.annuelle) + ' F.';
    const liste = data.liste || [];
    const prixTxt = p => [p.prix.mensuelle ? 'Mois ' + num(p.prix.mensuelle) + ' F' : '', p.prix.annuelle ? 'Année ' + num(p.prix.annuelle) + ' F' : ''].filter(Boolean).join(' · ');
    const qui = p => p.cible === 'numeros' ? num(p.nb_numeros) + ' numéro' + (p.nb_numeros > 1 ? 's' : '') : ((CIBLES_PROMO.find(c => c[0] === p.cible) || [0, p.cible])[1]);
    const act = liste.find(p => p.actif);
    $('#pr-actuelle').innerHTML = act ? `<div class="carte" style="border-color:var(--cachet)">
        <div class="libelle" style="margin-bottom:6px">Promotion en cours</div>
        <b>${e(act.nom)}</b> <b style="color:var(--cachet)">Active</b>
        <p class="sous" style="margin:6px 0">${e(prixTxt(act))} · ${e(qui(act))} · ${act.fin_le ? 'jusqu\'au ' + e(X().heureCourte(act.fin_le)) : 'sans date de fin'}</p>
        <p class="sous" style="margin:0 0 10px">${num(act.destinataires)} personne${act.destinataires > 1 ? 's' : ''} prévenue${act.destinataires > 1 ? 's' : ''} · ${num(act.achats)} achat${act.achats > 1 ? 's' : ''} confirmé${act.achats > 1 ? 's' : ''} à ce prix.</p>
        ${admin ? `<button class="cta creux" data-pr-stop="${e(act.id)}">Arrêter la promotion</button>` : ''}
      </div>` : `<div class="carte"><div class="vide" style="margin:0">Aucune promotion en cours : tous les candidats paient le prix normal.</div></div>`;
    h.innerHTML = liste.length ? `<div class="defile"><table><thead><tr><th>Lancée</th><th>Nom</th><th>Prix</th><th>Pour qui</th><th>Prévenus</th><th>Achats</th><th>État</th><th></th></tr></thead><tbody>${liste.map(p => `<tr>
      <td style="white-space:nowrap">${e(X().heureCourte(p.lance_le))}</td><td><b>${e(p.nom)}</b></td><td>${e(prixTxt(p))}</td><td>${e(qui(p))}</td>
      <td class="num">${num(p.destinataires)}</td><td class="num">${num(p.achats)}</td>
      <td>${p.actif ? '<b style="color:var(--cachet)">Active</b>' : p.terminee ? 'Terminée' : 'Arrêtée'}</td>
      <td>${admin && p.actif ? `<button class="mini" data-pr-stop="${e(p.id)}">Arrêter</button>` : (admin && !p.terminee ? `<button class="mini" data-pr-reprise="${e(p.id)}">Reprendre</button>` : '')}</td></tr>`).join('')}</tbody></table></div>` : '<div class="vide">Aucune promotion lancée pour le moment.</div>';
    $$('[data-pr-stop]').forEach(b => b.onclick = async () => {
      if(!confirm('Arrêter la promotion ? Les candidats repayent le prix normal.')) return;
      const { data: r, error: er } = await db.rpc('admin_promotion_arreter', { p_id: b.dataset.prStop });
      if(er || !r || !r.ok) return alert((r && r.message) || (er && er.message) || 'Échec.');
      charger();
    });
    $$('[data-pr-reprise]').forEach(b => b.onclick = async () => {
      if(!confirm('Reprendre cette promotion ? Elle remplace celle en cours, sans nouvelle notification.')) return;
      const { data: r, error: er } = await db.rpc('admin_promotion_reprendre', { p_id: b.dataset.prReprise });
      if(er || !r || !r.ok) return alert((r && r.message) || (er && er.message) || 'Échec.');
      charger();
    });
  };
  charger();
  if(!admin) return;
  const compter = async () => {
    const c = $('#pr-cible').value;
    $('#pr-tel-zone').hidden = c !== 'numeros';
    const z = $('#pr-nb');
    if(c === 'numeros'){ z.textContent = ''; return; }
    const { data } = await db.rpc('admin_compter_cible', { p_cible: c });
    z.innerHTML = '<b>' + num(data || 0) + '</b> personne' + (data > 1 ? 's' : '') + ' seront prévenues.';
  };
  $('#pr-cible').addEventListener('change', compter); compter();
  $('#pr-go').onclick = async () => {
    const nom = $('#pr-nom').value.trim(), m = parseInt($('#pr-m').value, 10) || null, a = parseInt($('#pr-a').value, 10) || null;
    const etat = $('#pr-etat');
    if(nom.length < 3) return (etat.textContent = 'Donnez un nom à la promotion.');
    if(!m && !a) return (etat.textContent = 'Indiquez au moins un prix.');
    if(m && normal.mensuelle && m >= normal.mensuelle) return (etat.textContent = 'Le prix du Mois doit être plus bas que ' + normal.mensuelle + ' F.');
    if(a && normal.annuelle && a >= normal.annuelle) return (etat.textContent = 'Le prix de l\'Année doit être plus bas que ' + normal.annuelle + ' F.');
    const cible = $('#pr-cible').value, tel = $('#pr-tel').value;
    if(cible === 'numeros' && !tel.trim()) return (etat.textContent = 'Indiquez au moins un numéro.');
    const fin = $('#pr-fin').value ? $('#pr-fin').value + ':00Z' : null;
    const quoi = [m ? 'Mois à ' + m + ' F' : '', a ? 'Année à ' + a + ' F' : ''].filter(Boolean).join(' et ');
    if(!confirm('Lancer « ' + nom + ' » ?\n\n' + quoi + '\nPour : ' + (CIBLES_PROMO.find(c => c[0] === cible) || [0, cible])[1] + '\n\nLa promotion en cours sera arrêtée. Chaque personne concernée verra la fenêtre tout de suite.')) return;
    const b = $('#pr-go'); b.disabled = true; etat.textContent = 'Lancement…';
    const { data, error } = await db.rpc('admin_promotion_lancer', { p_nom: nom, p_cible: cible, p_telephones: tel, p_mensuelle: m, p_annuelle: a, p_message: $('#pr-msg').value.trim() || null, p_fin_le: fin });
    b.disabled = false;
    if(error || !data || !data.ok) return (etat.textContent = (data && data.message) || (error && error.message) || 'Échec.');
    etat.textContent = 'Promotion lancée : ' + num(data.destinataires) + ' personne(s) prévenue(s).' + ((data.inconnus || []).length ? ' Numéros sans compte : ' + data.inconnus.join(', ') + '.' : '');
    $('#pr-nom').value = ''; $('#pr-m').value = ''; $('#pr-a').value = ''; $('#pr-msg').value = ''; $('#pr-tel').value = ''; $('#pr-fin').value = '';
    charger();
  };
};

/* ============================================================
   LE CONSEIL DES DIX : dix lectures de vos chiffres réels, puis un bilan et des actions
   ============================================================ */
function lectures(m){
  const zones = m.zones || [], z1 = zones[0];
  const peu = (m.inscrits || 0) < 5 && (m.actifs || 0) < 5;
  const L = [];
  const add = (nom, principe, etat, constat, action) => L.push({ nom, principe, etat: peu && etat !== 'alerte' ? 'nodata' : etat, constat, action });
  const j1 = m.j1;
  add('Warren Buffett', 'Bâtir quelque chose de durable : un client qui reste vaut plus que dix qui passent.',
    j1 == null ? 'nodata' : j1 >= 30 ? 'ok' : j1 >= 15 ? 'attention' : 'alerte',
    j1 == null ? 'Pas encore assez d\'inscrits pour mesurer le retour du lendemain.' : `${j1} % des inscrits reviennent le lendemain (repère sain : 30 % ou plus). ${num(m.sans_retour_j7)} inscrits de la période ne sont jamais revenus.`,
    { t: 'Relancer ceux qui ne reviennent pas', vers: 'diffuser', cible: 'inactifs7', modele: 'absence' });
  const pc = pct(m.paiement_commence, m.paywall_vus);
  add('Jeff Bezos', 'Partir du client et retirer chaque friction entre son envie et son achat.',
    m.paywall_vus ? (pc >= 15 ? 'ok' : pc >= 5 ? 'attention' : 'alerte') : 'nodata',
    m.paywall_vus ? `${num(m.paywall_vus)} personnes ont vu la page abonnement, ${num(m.paiement_commence)} ont commencé à payer (${pc} %), ${num(m.paie_demandes)} ont envoyé une demande, ${num(m.paie_confirmes)} paiements reçus (${F(m.paie_montant)}).` : 'Personne n\'a encore vu la page abonnement sur cette période.',
    { t: 'Voir à quelle étape ils s\'arrêtent', vers: 'paiements' });
  add('Elon Musk', 'Aller vite et simplifier : si le premier pas est long, la plupart n\'iront pas plus loin.',
    m.activation == null ? 'nodata' : m.activation >= 50 ? 'ok' : m.activation >= 30 ? 'attention' : 'alerte',
    m.activation == null ? 'Pas d\'inscrit sur cette période.' : `${m.activation} % des nouveaux inscrits répondent à au moins 10 questions (repère : 50 %).${z1 ? ` La zone où l'on reste le plus : « ${X().nomEcran(z1.ecran)} ».` : ''}`,
    { t: 'Repérer ce qui bloque dans les écrans', vers: 'comportement' });
  const couv = m.publiees ? 100 - pct(m.sans_explication, m.publiees) : null;
  add('Bill Gates', 'Mesurer l\'impact : un candidat apprend vraiment quand il comprend, pas seulement quand il répond.',
    couv == null ? 'nodata' : couv >= 90 ? 'ok' : couv >= 50 ? 'attention' : 'alerte',
    couv == null ? 'Aucune question publiée.' : `${num(m.sans_explication)} questions publiées sur ${num(m.publiees)} n'ont pas d'explication (${couv} % expliquées). Taux de bonnes réponses : ${pct(m.bonnes, m.questions)} % sur ${num(m.questions)} réponses.`,
    { t: 'Rédiger les explications manquantes', vers: 'indicateurs' });
  const cp = m.profils ? pct(m.push_actifs, m.profils) : 0;
  add('Aliko Dangote', 'La distribution gagne : être joignable partout où se trouvent vos clients.',
    !m.profils ? 'nodata' : cp >= 40 ? 'ok' : cp >= 15 ? 'attention' : 'alerte',
    `${num(m.push_actifs)} candidats sur ${num(m.profils)} peuvent être joints par une alerte sur leur téléphone (${cp} %).`,
    { t: 'Inviter à activer les rappels', vers: 'diffuser', cible: 'tous', modele: 'absence' });
  add('Mukesh Ambani', 'Gagner un marché par le volume et un prix très bas, puis transformer les essais en habitude.',
    m.essais_fin_3j == null ? 'nodata' : m.essais_fin_3j === 0 ? 'ok' : m.essais_fin_3j <= 20 ? 'attention' : 'alerte',
    `${num(m.essais_fin_3j)} essais se terminent d'ici 3 jours, ${num(m.essais_actifs)} essais en cours, ${num(m.payants_actifs)} abonnés payants.`,
    { t: 'Écrire à ceux dont l\'essai finit', vers: 'diffuser', cible: 'essai' });
  const kv = m.actifs ? (m.partages || 0) / m.actifs : 0;
  add('Mark Zuckerberg', 'Les boucles : chaque utilisateur satisfait doit en amener d\'autres.',
    !m.actifs ? 'nodata' : kv >= 0.5 ? 'ok' : kv >= 0.15 ? 'attention' : 'alerte',
    `${num(m.partages)} partages et ${num(m.defis)} défis créés pour ${num(m.actifs)} candidats actifs ; ${num(m.arrivees_lien)} arrivées par un lien partagé.`,
    { t: 'Inviter à partager', vers: 'diffuser', cible: 'actifs7' });
  const retard = (m.paie_attente || 0), backlog = retard + (m.signalements || 0) + (m.avis_nouveaux || 0) + (m.depots || 0);
  add('Charlie Munger', 'Inverser : éviter d\'abord les erreurs bêtes, un paiement oublié, un avis sans réponse.',
    retard > 0 ? 'alerte' : backlog === 0 ? 'ok' : backlog <= 5 ? 'attention' : 'alerte',
    `${num(m.paie_attente)} paiement(s) à vérifier, ${num(m.avis_nouveaux)} avis non lus, ${num(m.signalements)} signalement(s) de question, ${num(m.depots)} dépôt(s) à ranger.`,
    { t: retard > 0 ? 'Vérifier les paiements en attente' : 'Traiter les avis en attente', vers: retard > 0 ? 'paiements' : 'avis' });
  add('Ray Dalio', 'Décider avec les faits : écrire ce que montrent les données, puis agir en conséquence.',
    m.heure_pic == null ? 'nodata' : 'ok',
    m.heure_pic == null ? 'Pas encore d\'heure de pointe mesurable.' : `Vos candidats arrivent surtout vers ${m.heure_pic} h. Vos messages et rappels seront vus plus vite à cette heure.`,
    { t: 'Écrire un message pour cette heure', vers: 'diffuser', cible: 'actifs7' });
  add('Jack Ma', 'Les premiers clients sont tout : les soigner, les écouter, en faire des ambassadeurs.',
    m.payants_actifs >= 10 ? 'ok' : m.payants_actifs >= 3 ? 'attention' : 'alerte',
    `${num(m.payants_actifs)} abonnés payants actifs, ${num(m.paie_confirmes)} paiement(s) reçu(s) sur la période (${F(m.paie_montant)}).`,
    { t: 'Créer des codes pour des relais', vers: 'paiements' });
  return L;
}
const ETAT = { ok: ['Bon signe', 'ok'], attention: ['À surveiller', 'att'], alerte: ['À corriger', 'al'], nodata: ['Trop tôt', 'nd'] };
V.conseil = async function(){
  const { db, A } = X();
  $('#vue').innerHTML = `
    <h2 class="titre">Le conseil des dix</h2>
    <p class="sous">Dix lectures de vos chiffres réels, chacune inspirée du principe pour lequel un grand bâtisseur est connu. Ce ne sont pas des citations : ce sont des règles de lecture appliquées à ce que font vos candidats sur la période choisie. Puis un bilan général, puis les actions à mener, dans l'ordre.</p>
    ${X().choixPeriode([[1, 'Aujourd\'hui'], [7, '7 jours'], [30, '30 jours'], [90, '90 jours']])}
    <div id="zone-conseil">Chargement…</div>`;
  X().brancherPeriode(V.conseil);
  const { du, au } = X().plageActive();
  const { data: m, error } = await db.rpc('bilan_metriques', { p_du: du, p_au: au });
  const z = $('#zone-conseil'); if(!z || A.vue !== 'conseil') return;
  if(error || !m){ z.innerHTML = '<div class="vide">' + e(error ? error.message : 'Pas de données') + '</div>'; return; }
  const L = lectures(m);
  const n = k => L.filter(x => x.etat === k);
  const forces = n('ok'), faibles = n('alerte'), surv = n('attention');
  const ordre = { alerte: 0, attention: 1 };
  const actions = L.filter(x => x.etat === 'alerte' || x.etat === 'attention').sort((a, b) => ordre[a.etat] - ordre[b.etat]);
  z.innerHTML = `
    <p class="sous" style="margin:0 0 10px">${e(X().etiqPlage())} · ${m.jours} jour${m.jours > 1 ? 's' : ''}</p>
    <div class="conseil-grille">${L.map(x => `<div class="carte lecture ${ETAT[x.etat][1]}">
      <div class="lec-tete"><b>${e(x.nom)}</b><span class="lec-etat ${ETAT[x.etat][1]}">${ETAT[x.etat][0]}</span></div>
      <p class="lec-principe">${e(x.principe)}</p>
      <p class="lec-constat">${e(x.constat)}</p>
      ${x.etat !== 'ok' && x.etat !== 'nodata' ? `<button class="lien" data-lec="${L.indexOf(x)}">${e(x.action.t)} →</button>` : ''}</div>`).join('')}</div>

    <div class="bloc"><div class="libelle">Le bilan général</div>
      <div class="carte bilan">
        <p>Sur ${e(X().etiqPlage())} : <b>${num(m.inscrits)}</b> nouveaux inscrits (${num(m.profils)} au total), <b>${num(m.actifs)}</b> candidats actifs, <b>${num(m.questions)}</b> questions répondues, <b>${num(m.compo_commencees)}</b> compositions commencées (${num(m.compo_terminees)} terminées), <b>${F(m.paie_montant)}</b> reçus.</p>
        <div class="deux-col" style="margin-top:10px">
          <div><div class="libelle" style="color:var(--vert-texte)">Ce qui va bien (${forces.length})</div>${forces.length ? '<ul>' + forces.map(x => `<li>${e(x.constat)}</li>`).join('') + '</ul>' : '<p class="sous">Rien de net pour l\'instant : c\'est normal tant que les chiffres sont petits.</p>'}</div>
          <div><div class="libelle" style="color:var(--rouge-texte)">Ce qui doit changer (${faibles.length})</div>${faibles.length ? '<ul>' + faibles.map(x => `<li>${e(x.constat)}</li>`).join('') + '</ul>' : '<p class="sous">Aucun point rouge.</p>'}${surv.length ? `<p class="sous" style="margin-top:8px">${surv.length} point${surv.length > 1 ? 's' : ''} à surveiller.</p>` : ''}</div>
        </div>
      </div></div>

    <div class="bloc"><div class="libelle">Les actions à mener, dans l'ordre</div>
      ${actions.length ? actions.map((x, i) => `<div class="carte action-a-faire"><div><span class="num rang">${i + 1}</span><b>${e(x.action.t)}</b><p class="sous" style="margin:4px 0 0;font-size:13px">${e(x.nom.split(' ').slice(-1)[0])} : ${e(x.constat)}</p></div>
        <button class="cta petit" data-lec="${L.indexOf(x)}">Y aller</button></div>`).join('') : '<div class="carte"><div class="vide">Rien d\'urgent : tous les voyants sont au vert ou trop tôt pour juger.</div></div>'}</div>`;
  $$('[data-lec]').forEach(b => b.onclick = () => {
    const a = L[+b.dataset.lec].action;
    if(a.cible){ A.diffCible = a.cible; A.diffModele = a.modele || null; }
    allerA(a.vers);
  });
};

/* ============================================================
   APPLICATION ET ALERTES : installer l'admin, recevoir les urgences
   ============================================================ */
const VAPID = 'BKKwtq-pIHYWr7Ypi81KhbOYicKmCnOt27bmN_YLN8dhYzoxUHiofDHWBM7VFuOru8nTPAeV8vyWiSW2tfcOqT0';
const urlB64 = s => { const p = '='.repeat((4 - s.length % 4) % 4); const b = (s + p).replace(/-/g, '+').replace(/_/g, '/'); const r = atob(b); return Uint8Array.from([...r].map(c => c.charCodeAt(0))); };
let invite = null;
const installee = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
const ios = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
window.addEventListener('beforeinstallprompt', ev => { ev.preventDefault(); invite = ev; majBandeau(); if(X().A.vue === 'app_admin') V.app_admin(); });
window.addEventListener('appinstalled', () => { invite = null; majBandeau(); if(X().A.vue === 'app_admin') V.app_admin(); });
async function registre(){
  if(!('serviceWorker' in navigator)) return null;
  try{ return (await navigator.serviceWorker.getRegistration()) || await navigator.serviceWorker.register('/sw.js'); }catch(err){ return null; }
}
async function etatPush(){
  if(!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'indisponible';
  if(Notification.permission === 'denied') return 'refuse';
  const reg = await registre(); const sub = reg && await reg.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'actif' : 'inactif';
}
async function activerPush(){
  const perm = await Notification.requestPermission();
  if(perm !== 'granted') throw new Error('Les notifications n\'ont pas été autorisées.');
  const reg = await registre(); if(!reg) throw new Error('Le service de notifications n\'a pas démarré.');
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if(!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64(VAPID) });
  const j = sub.toJSON();
  const { error } = await X().db.rpc('enregistrer_push_admin', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth });
  if(error) throw error;
}
V.app_admin = async function(){
  const { A, db } = X();
  const push = await etatPush();
  const lecteur = !A.admin;
  $('#vue').innerHTML = `
    <h2 class="titre">Application et alertes</h2>
    <p class="sous">Installez l'administration sur votre téléphone comme une application, et recevez une alerte dès qu'il se passe quelque chose d'urgent.</p>
    <div class="deux-col" style="align-items:start">
      <div class="carte"><h3 style="margin:0 0 6px">1. Installer l'application</h3>
        ${installee() ? '<p><span class="etat ok">Déjà installée sur cet appareil</span></p>' : invite ? '<p class="sous" style="margin:0 0 10px">Un bouton, et l\'icône apparaît sur votre écran d\'accueil.</p><button class="cta petit" id="ap-installer">Installer l\'application admin</button>' :
          ios() ? '<p class="sous">Sur iPhone : touchez le bouton Partager (le carré avec une flèche), puis « Sur l\'écran d\'accueil ». Les alertes ne fonctionnent qu\'après cette installation.</p>' :
          '<p class="sous">Dans Chrome : menu ⋮ en haut à droite, puis « Installer l\'application » (ou « Ajouter à l\'écran d\'accueil »).</p>'}
      </div>
      <div class="carte"><h3 style="margin:0 0 6px">2. Recevoir les alertes</h3>
        <p class="sous" style="margin:0 0 8px">Alerte sur ce téléphone pour : un paiement en cours ou à vérifier, un nouvel avis, une question signalée.</p>
        ${lecteur ? '<p class="sous">Les alertes sont réservées à l\'administration.</p>' :
          push === 'actif' ? '<p><span class="etat ok">Alertes activées sur cet appareil</span></p><button class="cta creux petit" id="ap-test">Envoyer une alerte de test</button> <button class="lien" id="ap-off">Désactiver ici</button>' :
          push === 'refuse' ? '<p class="sous" style="color:var(--rouge-texte)">Les notifications sont bloquées pour ce site. Autorisez-les dans les réglages du navigateur (cadenas près de l\'adresse), puis revenez ici.</p>' :
          push === 'indisponible' ? '<p class="sous">Ce navigateur ne permet pas les alertes. Essayez Chrome sur Android, ou installez l\'application d\'abord (iPhone).</p>' :
          '<button class="cta petit" id="ap-activer">Activer les alertes</button>'}
        <p id="ap-etat" class="sous" style="margin-top:8px"></p>
        <p class="sous" style="font-size:12.5px;margin-top:8px">Une alerte arrive en moins d'une minute après l'événement.</p>
      </div>
    </div>`;
  const etat = t => { const z = $('#ap-etat'); if(z) z.textContent = t; };
  const i = $('#ap-installer'); if(i) i.onclick = async () => { invite.prompt(); await invite.userChoice; invite = null; V.app_admin(); };
  const a = $('#ap-activer'); if(a) a.onclick = async () => { try{ await activerPush(); X().signal('Alertes activées sur cet appareil.', 'bien'); V.app_admin(); }catch(err){ etat(err.message || 'Impossible d\'activer les alertes.'); } };
  const t = $('#ap-test'); if(t) t.onclick = async () => { const { data } = await db.rpc('admin_test_alerte'); etat(data && data.ok ? 'Alerte de test envoyée : elle arrive dans la minute.' : ((data && data.message) || 'Échec.')); };
  const o = $('#ap-off'); if(o) o.onclick = async () => {
    const reg = await registre(); const sub = reg && await reg.pushManager.getSubscription();
    if(sub){ await db.rpc('retirer_push_admin', { p_endpoint: sub.endpoint }); await sub.unsubscribe(); }
    V.app_admin();
  };
};

/* le petit bandeau sous l'en-tête : installer, activer les alertes */
function majBandeau(){
  let b = $('#bandeau-app');
  const A = X().A;
  if(!A.session) return;
  let off = false; try{ off = Date.now() - (+localStorage.getItem('adm_bandeau') || 0) < 7 * 86400000; }catch(err){}
  const veutInstaller = !installee() && (invite || ios());
  const veutAlertes = A.admin && 'Notification' in window && Notification.permission === 'default';
  if(off || (!veutInstaller && !veutAlertes)){ if(b) b.remove(); return; }
  if(!b){ b = document.createElement('div'); b.id = 'bandeau-app'; b.className = 'bandeau-app'; const c = $('.corps'); c.parentNode.insertBefore(b, c); }
  b.innerHTML = `<span>${veutInstaller ? 'Installez l\'administration sur votre téléphone' : 'Recevez les alertes urgentes sur ce téléphone'}</span>
    <span><button class="cta petit" id="ba-go">${veutInstaller ? 'Installer' : 'Activer'}</button><button class="lien" id="ba-non">Plus tard</button></span>`;
  $('#ba-go').onclick = async () => {
    if(veutInstaller && invite){ invite.prompt(); await invite.userChoice; invite = null; majBandeau(); }
    else allerA('app_admin');
  };
  $('#ba-non').onclick = () => { try{ localStorage.setItem('adm_bandeau', String(Date.now())); }catch(err){} b.remove(); };
}

/* ---------- au moment d'entrer : recherche rapide, service, bandeau ---------- */
X().apresEntree = function(){
  registre();
  const d = $('.tete .droite');
  if(d && !$('#rech-rapide')){
    const w = document.createElement('div'); w.className = 'rech-rapide';
    w.innerHTML = '<input id="rech-rapide" type="search" placeholder="Chercher un candidat : nom ou numéro" autocomplete="off" aria-label="Chercher un candidat"><div id="rech-rapide-res" class="resultats" hidden></div>';
    d.parentNode.insertBefore(w, d);
    X().brancherRecherche($('#rech-rapide'), $('#rech-rapide-res'), () => { $('#rech-rapide-res').hidden = true; $('#rech-rapide').value = ''; });
    document.addEventListener('click', ev => { if(!ev.target.closest('.rech-rapide')) $('#rech-rapide-res').hidden = true; });
  }
  setTimeout(majBandeau, 1500);
};

})();
