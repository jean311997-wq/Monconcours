/* ============================================================
   MON CONCOURS · administration · Partenaires (ambassadeurs)
   La liste, la fiche de chacun (ses inscrits, ses paiements, ses commissions,
   ses versements), la création et le bouton « Versé ».
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
const SITE = 'https://www.monconcoursbf.com';
const jour = d => d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '';

const ETAT = {
  paye: 'A payé', en_verification: 'Paiement en vérification', non_abouti: 'Paiement non abouti',
  a_voulu_payer: 'A voulu payer', inscrit: 'Inscrit seulement'
};

function lienWa(tel, texte){
  const t = String(tel || '').replace(/\D/g, '');
  return 'https://wa.me/' + (t.length === 8 ? '226' + t : t) + (texte ? '?text=' + encodeURIComponent(texte) : '');
}

async function copier(txt){
  try{ await navigator.clipboard.writeText(txt); return true; }
  catch(err){
    const t = document.createElement('textarea'); t.value = txt; document.body.appendChild(t); t.select();
    let ok = false; try{ ok = document.execCommand('copy'); }catch(x){}
    t.remove(); return ok;
  }
}

V.partenaires = function(){
  if(X().A.partenaireId) return fiche(X().A.partenaireId);
  return liste();
};

/* ---------- la liste ---------- */
async function liste(){
  const { db, A } = X();
  const admin = !!A.admin;
  $('#vue').innerHTML = `
    <h2 class="titre">Partenaires</h2>
    <p class="sous">Les ambassadeurs de Mon Concours. Chacun a un code et un lien secret vers son tableau de bord. Rien n'est payé d'avance : une commission n'existe que lorsqu'un de ses inscrits a payé.</p>
    ${admin ? `<div class="carte" id="pa-nouveau">
      <div class="libelle" style="margin-bottom:8px">Ajouter un partenaire</div>
      <div class="deux-col" style="gap:10px">
        <label>Nom et prénom<input id="pa-nom" maxlength="80" placeholder="Bako Pascal"></label>
        <label>Code (3 à 14 lettres ou chiffres)<input id="pa-code" maxlength="14" placeholder="BAKO" style="text-transform:uppercase"></label>
      </div>
      <div class="deux-col" style="gap:10px">
        <label>Son numéro (il ne peut pas s'inscrire avec son propre code)<input id="pa-tel" inputmode="numeric" maxlength="12" placeholder="77 14 99 34"></label>
        <span></span>
      </div>
      <div class="deux-col" style="gap:10px">
        <label>Commission abonnement Mois (F)<input id="pa-mois" type="number" min="0" step="50" value="200"></label>
        <label>Commission abonnement Année (F)<input id="pa-an" type="number" min="0" step="50" value="1000"></label>
      </div>
      <button class="cta" id="pa-creer" style="margin-top:6px">Créer le partenaire</button>
      <p id="pa-etat" class="sous" style="margin-top:8px"></p>
    </div>` : ''}
    <div class="bloc" id="pa-prevenir"></div>
    <div class="bloc"><div class="libelle">Tous les partenaires</div><div class="carte" id="pa-liste">Chargement…</div></div>`;

  /* les partenaires à prévenir : un message prêt dès qu'un de leurs candidats a payé */
  const chargerPrevenir = async () => {
    const b = $('#pa-prevenir'); if(!b) return;
    const { data } = await db.rpc('admin_partenaires_a_prevenir');
    const l = (data && data.ok && data.liste) || [];
    if(!l.length){ b.innerHTML = ''; return; }
    const jourFr = d => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' });
    b.innerHTML = `<div class="libelle">À prévenir (${num(l.length)})</div><div class="carte">
      ${l.map(x => {
        const prenom = String(x.partenaire || '').trim().split(/\s+/)[0];
        const valide = new Date(Date.parse(x.paye_le) + x.delai_jours * 86400000);
        const msg = 'Bonjour ' + prenom + ', bonne nouvelle : ' + x.candidat + ' vient de payer l\'Abonnement ' + (x.formule === 'annuelle' ? 'Année' : 'Mois') + ' grâce à vous. Votre commission : ' + num(x.commission) + ' F, validée le ' + jourFr(valide) + '. Merci pour votre travail. Votre espace : ' + SITE + '/espace#' + x.jeton_court;
        return `<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--trait)">
          <div><b>${e(x.partenaire)}</b> · ${e(x.candidat)} a payé l'Abonnement ${x.formule === 'annuelle' ? 'Année' : 'Mois'} · <b>${F(x.commission)}</b></div>
          ${x.telephone ? `<a class="cta petit" target="_blank" rel="noopener" data-prevenu="${e(x.paiement)}" href="${e(lienWa(x.telephone, msg))}">Prévenir sur WhatsApp</a>` : '<span class="sous">Pas de numéro</span>'}
        </div>`; }).join('')}</div>`;
    $$('[data-prevenu]').forEach(a => a.addEventListener('click', () => {
      db.rpc('admin_partenaire_prevenu', { p_paiement: a.dataset.prevenu }).then(() => setTimeout(chargerPrevenir, 800));
    }));
  };
  chargerPrevenir();

  const charger = async () => {
    const { data, error } = await db.rpc('admin_partenaires');
    const z = $('#pa-liste'); if(!z) return;
    if(error || !data || !data.ok){ z.innerHTML = '<div class="vide">' + e((data && data.message) || (error && error.message) || 'Lecture impossible.') + '</div>'; return; }
    const l = data.liste || [];
    z.innerHTML = l.length ? `<div class="defile"><table><thead><tr><th>Partenaire</th><th>Code</th><th class="num">Visiteurs</th><th class="num">Inscrits</th><th class="num">Voulu payer</th><th class="num">Payés</th><th class="num">En attente</th><th class="num">À verser</th><th class="num">Versé</th><th>État</th></tr></thead><tbody>
      ${l.map(p => `<tr data-pa="${e(p.id)}" style="cursor:pointer">
        <td><b>${e(p.nom)}</b></td><td>${e(p.code)}</td>
        <td class="num">${num(p.resume.visiteurs)}</td><td class="num">${num(p.resume.inscrits)}</td><td class="num">${num(p.resume.a_voulu_payer)}</td><td class="num">${num(p.resume.payes)}</td>
        <td class="num">${F(p.resume.commission_attente)}</td><td class="num"><b>${F(p.resume.solde)}</b></td><td class="num">${F(p.resume.verse)}</td>
        <td>${p.actif ? 'Actif' : '<b>Fermé</b>'}</td></tr>`).join('')}</tbody></table></div>
      <p class="sous" style="margin:8px 0 0">Touchez un partenaire pour voir tout son historique.</p>` : '<div class="vide">Aucun partenaire pour le moment.</div>';
    $$('[data-pa]').forEach(r => r.onclick = () => { A.partenaireId = r.dataset.pa; V.partenaires(); });
  };

  if(admin){
    $('#pa-creer').onclick = async () => {
      const et = $('#pa-etat'); et.textContent = 'Création…';
      const { data, error } = await db.rpc('admin_partenaire_creer', {
        p_nom: $('#pa-nom').value, p_code: $('#pa-code').value, p_telephone: $('#pa-tel').value,
        p_mois: parseInt($('#pa-mois').value, 10), p_an: parseInt($('#pa-an').value, 10)
      });
      if(error || !data || !data.ok){ et.textContent = (data && data.message) || (error && error.message) || 'Échec.'; return; }
      A.partenaireId = data.id; V.partenaires();
    };
  }
  charger();
}

/* ---------- la fiche d'un partenaire ---------- */
async function fiche(id){
  const { db, A } = X();
  const admin = !!A.admin;
  $('#vue').innerHTML = '<p class="sous">Chargement…</p>';
  const { data: d, error } = await db.rpc('admin_partenaire_detail', { p_id: id });
  if(error || !d || !d.ok){
    $('#vue').innerHTML = `<div class="carte"><div class="vide">${e((d && d.message) || (error && error.message) || 'Lecture impossible.')}</div><button class="cta creux" id="pa-retour">Retour</button></div>`;
    $('#pa-retour').onclick = () => { A.partenaireId = null; V.partenaires(); };
    return;
  }
  const r = d.resume;
  const { data: ca } = await db.rpc('admin_partenaire_code_acces', { p_id: id });
  const codeAcces = (ca && ca.ok && ca.code) || '';
  const lienPage = SITE + '/espace#' + (d.jeton_court || d.jeton);
  const lienCode = SITE + '/?p=' + d.code;
  const msgPartenaire = 'Bonjour ' + d.nom + ', voici votre espace partenaire Mon Concours : ' + lienPage + '\nVotre code : ' + d.code + '\nVotre lien à partager : ' + lienCode + '\nGardez le premier lien pour vous : il ouvre votre tableau de bord.';
  const msgPoint = 'Bonjour ' + d.nom + ', voici votre point Mon Concours : ' + num(r.visiteurs) + ' visiteurs par votre lien, ' + num(r.inscrits) + ' inscrits, ' + num(r.payes) + ' personnes ayant payé (' + num(r.nb_paiements) + ' paiements). Commissions validées à vous verser : ' + num(r.solde) + ' F. Votre espace : ' + lienPage;

  $('#vue').innerHTML = `
    <p><button class="mini" id="pa-retour">← Tous les partenaires</button></p>
    <h2 class="titre">${e(d.nom)} <span class="sous" style="font-size:15px">· code ${e(d.code)}${d.actif ? '' : ' · accès fermé'}</span></h2>
    <p class="sous">À chaque paiement : Mois ${F(d.commission_mois)} · Année ${F(d.commission_an)} · validée ${num(d.delai_jours)} jours après chaque paiement${d.telephone ? ' · ' + e(d.telephone) : ''}</p>

    <div class="grille-tuiles" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin:12px 0">
      ${[['Visiteurs via son lien', r.visiteurs], ['Inscrits', r.inscrits], ['Par le lien', r.via_lien], ['Par le code', r.via_code], ['Lien + code', r.via_les_deux], ['Actifs 3 jours et +', r.actifs3], ['Ont voulu payer', r.a_voulu_payer], ['Ont payé', r.payes], ['Paiements reçus', r.nb_paiements],
         ['Commission en attente', F(r.commission_attente)], ['Validée, à verser', F(r.solde)], ['Déjà versé', F(r.verse)]].concat(r.bonus ? [['Dont bonus de paliers', F(r.bonus)]] : [])
        .map(([t, v]) => `<div class="carte" style="margin:0"><div class="sous" style="margin:0 0 4px">${t}</div><b style="font-size:21px">${typeof v === 'number' ? num(v) : v}</b></div>`).join('')}
    </div>

    <div class="carte">
      <div class="libelle" style="margin-bottom:6px">Son accès</div>
      <p class="sous" style="margin:0 0 8px">Le lien secret ouvre son tableau de bord. Envoie-le-lui en privé.</p>
      <p style="word-break:break-all;font-size:13.5px;margin:0 0 10px">${e(lienPage)}</p>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        <button class="cta" id="pa-cp-page">Copier son lien secret</button>
        ${d.telephone ? `<a class="cta creux" target="_blank" rel="noopener" href="${e(lienWa(d.telephone, msgPartenaire))}" style="text-decoration:none">Lui envoyer sur WhatsApp</a>` : ''}
        <button class="cta creux" id="pa-cp-code">Copier son lien à partager</button>
        ${d.telephone ? `<a class="cta creux" target="_blank" rel="noopener" href="${e(lienWa(d.telephone, msgPoint))}" style="text-decoration:none">Lui envoyer son point par WhatsApp</a>` : ''}
      </div>
      <p id="pa-cp-etat" class="sous" style="margin:8px 0 0"></p>
    </div>

    ${admin ? `<div class="carte">
      <div class="libelle" style="margin-bottom:8px">Marquer un versement</div>
      <p class="sous" style="margin:0 0 8px">À verser aujourd'hui : <b>${F(r.solde)}</b>. Faites d'abord le transfert mobile money, puis enregistrez-le ici.</p>
      <div class="deux-col" style="gap:10px">
        <label>Montant versé (F)<input id="pv-montant" type="number" min="1" step="50" value="${r.solde || ''}"></label>
        <label>Note (facultatif)<input id="pv-note" maxlength="120" placeholder="Orange Money, 9 novembre"></label>
      </div>
      <button class="cta" id="pv-go" ${r.solde ? '' : 'disabled'}>Marquer comme versé</button>
      <p id="pv-etat" class="sous" style="margin-top:8px"></p>
    </div>
    <div class="carte">
      <div class="libelle" style="margin-bottom:8px">Réglages</div>
      <div class="deux-col" style="gap:10px">
        <label>Commission Mois (F)<input id="pr-mois" type="number" min="0" step="50" value="${d.commission_mois}"></label>
        <label>Commission Année (F)<input id="pr-an" type="number" min="0" step="50" value="${d.commission_an}"></label>
      </div>
      <label>Note interne<input id="pr-note" maxlength="200" value="${e(d.note || '')}"></label>
      <label>Code d'accès à son espace (chiffres)<input id="pr-acces" inputmode="numeric" maxlength="10" value="${e(codeAcces)}"></label>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">
        <button class="cta" id="pr-save">Enregistrer</button>
        <button class="cta creux" id="pr-actif">${d.actif ? 'Fermer son accès' : 'Rouvrir son accès'}</button>
        <button class="cta creux" id="pr-lien">Changer son lien secret</button>
      </div>
      <p id="pr-etat" class="sous" style="margin-top:8px"></p>
    </div>` : ''}

    <div class="bloc"><div class="libelle">Ses inscrits (${num(r.inscrits)})</div><div class="carte">
      ${(d.filleuls || []).length ? `<div class="defile"><table><thead><tr><th>Inscrit le</th><th>Nom</th><th>Numéro</th><th>Arrivé</th><th>État</th><th>Relance</th><th class="num">Jours actifs</th><th>Dernière visite</th><th>Paiements</th><th class="num">Commission</th></tr></thead><tbody>
        ${d.filleuls.map(f => `<tr>
          <td style="white-space:nowrap">${e(jour(f.inscrit_le))}</td>
          <td><b>${e(f.nom)}</b></td>
          <td>${f.telephone ? `<a target="_blank" rel="noopener" href="${e(lienWa(f.telephone))}">${e(f.telephone)}</a>` : ''}</td>
          <td>${e(({lien:'Lien',code:'Code',les_deux:'Lien + code'})[f.source] || '')}</td>
          <td>${e(ETAT[f.etat] || f.etat)}</td>
          <td style="white-space:nowrap">${f.relance_le ? e(jour(f.relance_le) + (f.relance_par === 'partenaire' ? ' (lui)' : ' (équipe)')) : ''}</td>
          <td class="num">${num(f.jours_actifs)}</td>
          <td style="white-space:nowrap">${e(jour(f.derniere_vue))}</td>
          <td>${f.etat === 'paye' ? e(num(f.nb_paiements) + ' paiement' + (f.nb_paiements > 1 ? 's' : '') + ' · dernier : ' + (f.formule === 'annuelle' ? 'Année' : f.formule === 'mensuelle' ? 'Mois' : 'Autre') + ' ' + F(f.montant) + ' le ' + jour(f.paye_le)) : ''}</td>
          <td class="num">${f.etat === 'paye' ? '<b>' + F(f.commission) + '</b><br><span class="sous" style="font-size:12px">dont validée : ' + F(f.commission_validee) + '</span>' : ''}</td>
        </tr>`).join('')}</tbody></table></div>` : '<div class="vide">Personne ne s\'est inscrit avec son code pour le moment.</div>'}
    </div></div>

    <div class="bloc"><div class="libelle">Ses versements</div><div class="carte">
      ${(d.versements || []).length ? `<div class="defile"><table><thead><tr><th>Date</th><th>Note</th><th class="num">Montant</th>${admin ? '<th></th>' : ''}</tr></thead><tbody>
        ${d.versements.map(v => `<tr><td>${e(jour(v.verse_le))}</td><td>${e(v.note || '')}</td><td class="num"><b>${F(v.montant)}</b></td>${admin ? `<td><button class="mini" data-annuler="${e(v.id)}">Annuler</button></td>` : ''}</tr>`).join('')}</tbody></table></div>` : '<div class="vide">Aucun versement pour le moment.</div>'}
    </div></div>`;

  $('#pa-retour').onclick = () => { A.partenaireId = null; V.partenaires(); };
  const et = $('#pa-cp-etat');
  $('#pa-cp-page').onclick = async () => { et.textContent = (await copier(lienPage)) ? 'Lien secret copié.' : 'Copie impossible.'; };
  $('#pa-cp-code').onclick = async () => { et.textContent = (await copier(lienCode)) ? 'Lien à partager copié.' : 'Copie impossible.'; };

  if(!admin) return;
  $('#pv-go').onclick = async () => {
    const m = parseInt($('#pv-montant').value, 10), z = $('#pv-etat');
    if(!m || m <= 0){ z.textContent = 'Écrivez le montant versé.'; return; }
    if(!confirm('Enregistrer un versement de ' + num(m) + ' F à ' + d.nom + ' ?')) return;
    const { data, error: er } = await db.rpc('admin_partenaire_verser', { p_id: id, p_montant: m, p_note: $('#pv-note').value });
    if(er || !data || !data.ok){ z.textContent = (data && data.message) || (er && er.message) || 'Échec.'; return; }
    fiche(id);
  };
  const maj = async (args, msg) => {
    const z = $('#pr-etat');
    const { data, error: er } = await db.rpc('admin_partenaire_maj', Object.assign({ p_id: id, p_actif: null, p_mois: null, p_an: null, p_note: null, p_nouveau_lien: false }, args));
    if(er || !data || !data.ok){ z.textContent = (data && data.message) || (er && er.message) || 'Échec.'; return; }
    X().signal(msg, 'info'); fiche(id);
  };
  $('#pr-save').onclick = async () => {
    const nouveau = $('#pr-acces').value.replace(/\D/g, '');
    if(nouveau !== codeAcces){
      const { data: r2 } = await db.rpc('admin_partenaire_code_acces', { p_id: id, p_code: nouveau });
      if(!r2 || !r2.ok){ $('#pr-etat').textContent = (r2 && r2.message) || 'Code d\'accès refusé.'; return; }
    }
    maj({ p_mois: parseInt($('#pr-mois').value, 10), p_an: parseInt($('#pr-an').value, 10), p_note: $('#pr-note').value }, 'Réglages enregistrés.');
  };
  $('#pr-actif').onclick = () => {
    if(d.actif && !confirm('Fermer l\'accès de ' + d.nom + ' ? Son lien et son code ne fonctionneront plus.')) return;
    maj({ p_actif: !d.actif }, d.actif ? 'Accès fermé.' : 'Accès rouvert.');
  };
  $('#pr-lien').onclick = () => {
    if(!confirm('Changer son lien secret ? L\'ancien lien ne marchera plus et il faudra lui envoyer le nouveau.')) return;
    maj({ p_nouveau_lien: true }, 'Nouveau lien secret créé.');
  };
  $$('[data-annuler]').forEach(b => b.onclick = async () => {
    if(!confirm('Annuler ce versement ? Le montant revient dans « à verser ».')) return;
    const { data, error: er } = await db.rpc('admin_partenaire_annuler_versement', { p_versement: b.dataset.annuler });
    if(er || !data || !data.ok) return alert((data && data.message) || (er && er.message) || 'Échec.');
    fiche(id);
  });
}

})();
