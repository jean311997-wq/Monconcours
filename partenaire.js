/* Mon Concours · espace partenaire.
   Accès par un lien court : /espace#CODE_SECRET. Le code secret reste après le « # »,
   il n'est donc jamais envoyé aux serveurs dans l'adresse. */
(function(){
'use strict';
const URL_BASE = 'https://uonhpsumbfuahipbdjnu.supabase.co';
const CLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvbmhwc3VtYmZ1YWhpcGJkam51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMjg1MTQsImV4cCI6MjEwMTcwNDUxNH0.UR2CSJaK0AyyIRDzDBoALcU7OeE9SdQESHI9ASZMYIk';
const SITE = 'https://www.monconcoursbf.com';
const ADMIN_TEL = '77959848';            /* WhatsApp de l'administrateur */
const JOURS_VERSEMENT = 3;
const zone = document.getElementById('zone');
const E = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const nb = v => Number(v || 0).toLocaleString('fr-FR').replace(/ | /g, ' ');
const F = v => nb(v) + ' F';
const jour = d => d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '';
const heure = d => d ? new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : '';
const prenomDe = n => String(n || '').trim().split(/\s+/)[0] || '';

let jeton = (location.hash || '').replace(/^#/, '').trim();
let derniereVisite = 0;
try{
  if(jeton) localStorage.setItem('mc_partenaire_jeton', jeton);
  else jeton = localStorage.getItem('mc_partenaire_jeton') || '';
  derniereVisite = Date.parse(localStorage.getItem('mc_partenaire_vu') || '') || 0;
  localStorage.setItem('mc_partenaire_vu', new Date().toISOString());
}catch(e){}

let db = null, donnees = null, filtre = 'tous';
if(window.supabase && window.supabase.createClient){
  db = window.supabase.createClient(URL_BASE, CLE, { auth: { persistSession: false, autoRefreshToken: false } });
}

function erreur(msg){
  zone.innerHTML = `<div class="erreur"><b>${E(msg)}</b><p class="doux" style="margin:8px 0 0">Si le problème continue, écrivez à l'équipe Mon Concours sur WhatsApp.</p></div>`;
}

async function charger(){
  if(!db) return erreur('Le service ne répond pas pour l\'instant. Réessayez dans un moment.');
  if(!jeton) return erreur('Ce lien est incomplet. Utilisez le lien complet que l\'équipe vous a envoyé.');
  let r;
  try{ r = await db.rpc('partenaire_tableau', { p_jeton: jeton }); }catch(e){ r = { error: e }; }
  if(r.error || !r.data) return erreur('Impossible de charger votre espace. Vérifiez votre connexion puis réessayez.');
  if(!r.data.ok) return erreur(r.data.message || 'Lien non valide.');
  donnees = r.data;
  dessiner();
}

const ETATS = {
  paye:            { txt: 'A payé',                   cls: 'paye',  groupe: 'payes' },
  en_verification: { txt: 'Paiement en vérification', cls: 'voulu', groupe: 'voulu' },
  non_abouti:      { txt: 'Paiement non abouti',      cls: 'non',   groupe: 'voulu' },
  a_voulu_payer:   { txt: 'A voulu payer',            cls: 'voulu', groupe: 'voulu' },
  inscrit:         { txt: 'Inscrit',                  cls: '',      groupe: 'inscrits' }
};
const NOM_FORMULE = { annuelle: 'Année', mensuelle: 'Mois' };

/* ---------- les messages prêts à partager ---------- */
function messages(code){
  const lien = SITE + '/?p=' + code;
  return [
    { titre: 'Statut WhatsApp', texte:
`Tu prépares un concours direct ? Fais d'abord le test de niveau gratuit sur Mon Concours et vois où tu en es vraiment.
Mon code : ${code}
${lien}` },
    { titre: 'Groupe ou communauté', texte:
`Bonjour à tous. Pour ceux qui préparent les concours directs de la fonction publique : Mon Concours propose un test de niveau gratuit, des entraînements chaque jour et des compositions nationales en direct, avec correction et classement.
Pour commencer, ouvrez ce lien : ${lien}
Code partenaire : ${code}` },
    { titre: 'Message personnel', texte:
`Salut, je pense à toi pour ton concours. J'ai trouvé Mon Concours : un test de niveau gratuit, puis des entraînements tous les jours et des compositions nationales. Essaie avec mon code ${code} :
${lien}` },
    { titre: 'Publication Facebook', texte:
`Le concours direct se prépare bien avant la date de l'écrit.
Sur Mon Concours : un test de niveau gratuit pour savoir où tu en es, des entraînements par matière, et des compositions nationales en direct, corrigées, avec classement.
Commence ici : ${lien}
Code partenaire : ${code}` }
  ];
}

/* ---------- les visuels, dessinés ici avec le code du partenaire ---------- */
const VISUELS = [
  { id: 'carre', nom: 'Publication carrée', w: 1080, h: 1080,
    titre: 'Tu prépares un concours direct ?', accroche: 'Commence par le test de niveau gratuit.',
    points: ['Entraînement chaque jour', 'Compositions nationales en direct', 'Correction et classement'] },
  { id: 'statut', nom: 'Statut WhatsApp (vertical)', w: 1080, h: 1920,
    titre: 'Ton concours se prépare chaque jour.', accroche: 'Fais le test de niveau gratuit et vois où tu en es.',
    points: ['Entraînement par matière', 'Compositions nationales en direct', 'Correction et classement'] },
  { id: 'nationale', nom: 'Composition nationale', w: 1080, h: 1080,
    titre: 'Compose en direct avec les autres candidats.', accroche: 'Une composition nationale, corrigée et classée.',
    points: ['Chronomètre et conditions réelles', 'Résultats le jour même', 'Test de niveau gratuit'] }
];

function lignes(ctx, txt, maxW){
  const mots = txt.split(' '), out = []; let l = '';
  mots.forEach(m => { const t = l ? l + ' ' + m : m; if(ctx.measureText(t).width > maxW && l){ out.push(l); l = m; } else l = t; });
  if(l) out.push(l); return out;
}
function dessinerVisuel(v, code, logo){
  const c = document.createElement('canvas'); c.width = v.w; c.height = v.h;
  const x = c.getContext('2d'), W = v.w, H = v.h, M = 84, haut = H > 1500;
  const police = '"Bricolage Grotesque","IBM Plex Sans",system-ui,"Segoe UI",Roboto,Arial,sans-serif';
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#0C1512'); g.addColorStop(1, '#14392B');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = 'rgba(227,168,43,.10)'; x.beginPath(); x.arc(W - 40, haut ? 260 : 140, haut ? 340 : 280, 0, Math.PI * 2); x.fill();
  let y = haut ? 150 : 110;
  if(logo){ x.drawImage(logo, M, y - 52, 76, 76); }
  x.fillStyle = '#E3A82B'; x.font = '800 34px ' + police; x.textBaseline = 'alphabetic';
  x.fillText('MON CONCOURS', M + (logo ? 96 : 0), y);
  y += haut ? 190 : 120;
  x.fillStyle = '#F2F5F2'; x.font = '800 ' + (haut ? 112 : 78) + 'px ' + police;
  lignes(x, v.titre, W - 2 * M).forEach(l => { x.fillText(l, M, y); y += haut ? 128 : 90; });
  y += 14; x.fillStyle = '#4FC28F'; x.font = '700 ' + (haut ? 50 : 38) + 'px ' + police;
  lignes(x, v.accroche, W - 2 * M).forEach(l => { x.fillText(l, M, y); y += haut ? 64 : 48; });
  y += haut ? 60 : 30; x.font = '600 ' + (haut ? 46 : 34) + 'px ' + police;
  v.points.forEach(p => {
    x.fillStyle = '#E3A82B'; x.beginPath(); x.arc(M + 14, y - 14, 10, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#E9EEEA'; x.fillText(p, M + 44, y); y += haut ? 84 : 54;
  });
  /* le cadre du code, en bas */
  const bh = haut ? 250 : 180, by = H - bh - (haut ? 150 : 70);
  x.fillStyle = 'rgba(255,255,255,.07)'; x.strokeStyle = '#E3A82B'; x.lineWidth = 3;
  x.beginPath(); if(x.roundRect) x.roundRect(M, by, W - 2 * M, bh, 28); else x.rect(M, by, W - 2 * M, bh); x.fill(); x.stroke();
  x.fillStyle = '#A2B2AA'; x.font = '600 30px ' + police; x.fillText('CODE PARTENAIRE', M + 44, by + 52);
  x.fillStyle = '#E3A82B'; x.font = '800 ' + (haut ? 112 : 92) + 'px ' + police; x.fillText(code, M + 44, by + bh - 40);
  x.fillStyle = '#E9EEEA'; x.font = '700 34px ' + police; x.textAlign = 'right'; x.fillText('monconcoursbf.com', W - M - 44, by + bh - 50); x.textAlign = 'left';
  return c;
}

/* ---------- pièces de la page ---------- */
function lienPartage(texte){ return 'https://wa.me/?text=' + encodeURIComponent(texte); }

function carte(f){
  const e = ETATS[f.etat] || ETATS.inscrit;
  let detail = '';
  if(f.etat === 'paye'){
    const form = 'Abonnement ' + (NOM_FORMULE[f.formule] || '');
    const rep = f.nb_paiements > 1 ? ` · ${nb(f.nb_paiements)} paiements` : '';
    detail = `<p class="ligne">${E(form.trim())} · dernier paiement le ${E(jour(f.paye_le))}${rep}</p>
      <p class="ligne"><b>Commissions : ${F(f.commission)}</b>${f.commission > f.commission_validee ? ' (dont ' + F(f.commission - f.commission_validee) + ' en cours de validation)' : ' · validées'}</p>`;
  }
  const tel = f.telephone ? String(f.telephone).replace(/\D/g, '') : '';
  const contact = tel ? `<div class="contact"><a href="tel:+226${E(tel)}">Appeler ${E(tel)}</a><a href="https://wa.me/226${E(tel)}" target="_blank" rel="noopener">WhatsApp</a></div>` : '';
  return `<div class="carte"><div class="fil"><b>${E(f.nom)}</b><span class="badge ${e.cls}">${e.txt}</span></div>
    <p class="ligne">Inscrit le ${E(jour(f.inscrit_le))} · ${nb(f.jours_actifs)} jour${f.jours_actifs > 1 ? 's' : ''} d'activité${f.derniere_vue ? ' · vu le ' + E(jour(f.derniere_vue)) : ''}</p>
    ${detail}${contact}</div>`;
}

function evenements(d){
  const ev = [];
  (d.filleuls || []).forEach(f => ev.push({ t: Date.parse(f.inscrit_le), txt: `<b>${E(f.nom)}</b> s'est inscrit avec votre code.` }));
  const vus = {};
  [...(d.paiements || [])].sort((a, b) => Date.parse(a.paye_le) - Date.parse(b.paye_le)).forEach(p => {
    const premier = !vus[p.nom]; vus[p.nom] = true;
    ev.push({ t: Date.parse(p.paye_le), txt: `<b>${E(p.nom)}</b> ${premier ? 'a payé' : 'a renouvelé'} un abonnement ${E(NOM_FORMULE[p.formule] || '')}${p.commission ? ' : <b>+' + F(p.commission) + '</b>' : ''}.`, argent: !!p.commission });
  });
  return ev.sort((a, b) => b.t - a.t);
}

function aRelancer(d){
  const maintenant = Date.now(), trois = 3 * 86400000, out = [];
  (d.filleuls || []).forEach(f => {
    if(!f.telephone) return;
    if(f.etat === 'a_voulu_payer' || f.etat === 'non_abouti'){
      out.push({ f, raison: f.etat === 'non_abouti' ? 'Son paiement n\'a pas abouti' : 'A voulu payer sans finaliser', cle: 'paiement',
        msg: `Bonjour ${prenomDe(f.nom)}, c'est ${d.nom} de Mon Concours. Vous aviez commencé votre abonnement : avez-vous besoin d'aide pour finaliser le paiement ? Je reste disponible.` });
    }else if(f.etat === 'inscrit' && (!f.derniere_vue || maintenant - Date.parse(f.derniere_vue) > trois)){
      out.push({ f, raison: 'Inactif depuis 3 jours ou plus', cle: 'inactif',
        msg: `Bonjour ${prenomDe(f.nom)}, c'est ${d.nom} de Mon Concours. Comment avance votre préparation ? Votre prochain entraînement vous attend sur l'application, et des compositions nationales sont organisées chaque semaine.` });
    }
  });
  return out;
}

function sectionSemaines(d){
  const s = d.semaines || [];
  const max = Math.max(1, ...s.map(w => Math.max(w.visiteurs, w.inscrits, w.paiements)));
  const total = s.reduce((a, w) => a + w.visiteurs + w.inscrits + w.paiements, 0);
  if(!total) return '<div class="vide" style="padding:0">Les statistiques apparaîtront dès les premières visites.</div>';
  const meilleure = s.reduce((m, w) => (w.inscrits + w.paiements > m.inscrits + m.paiements ? w : m), s[0]);
  const barre = (v, cls) => `<div class="barre"><i class="${cls}" style="width:${Math.max(v ? 4 : 0, Math.round(100 * v / max))}%"></i><span>${nb(v)}</span></div>`;
  return `<table class="semaines"><thead><tr><th>Semaine du</th><th>Visiteurs</th><th>Inscrits</th><th>Paiements</th></tr></thead><tbody>
    ${s.slice().reverse().map(w => `<tr><td>${E(jour(w.debut))}</td><td>${barre(w.visiteurs, 'v')}</td><td>${barre(w.inscrits, 'i')}</td><td>${barre(w.paiements, 'p')}</td></tr>`).join('')}</tbody></table>
    ${meilleure.inscrits + meilleure.paiements > 0 ? `<p class="petit" style="margin:8px 0 0">Votre meilleure semaine : celle du ${E(jour(meilleure.debut))} (${nb(meilleure.inscrits)} inscrit${meilleure.inscrits > 1 ? 's' : ''}, ${nb(meilleure.paiements)} paiement${meilleure.paiements > 1 ? 's' : ''}).</p>` : ''}`;
}

function sectionPaliers(d){
  const r = d.resume, p = d.paliers || [];
  const suivant = p.find(x => !x.atteint);
  const cl = d.classement || {};
  return `<div class="carte">
    ${cl.sur >= 2 ? `<p style="margin:0 0 10px"><b>Classement :</b> vous êtes n° ${nb(cl.rang)} sur ${nb(cl.sur)} partenaires, selon le nombre de personnes qui ont payé.</p>` : ''}
    ${p.map(x => `<div class="palier ${x.atteint ? 'ok' : ''}"><span class="coche">${x.atteint ? '✓' : ''}</span><div><b>${E(x.titre)}</b><div class="petit">${nb(x.seuil)} personnes ayant payé · bonus de ${F(x.bonus)}</div></div></div>`).join('')}
    ${suivant ? `<div class="progres"><i style="width:${Math.min(100, Math.round(100 * r.payes / suivant.seuil))}%"></i></div>
      <p class="petit" style="margin:6px 0 0">${nb(r.payes)} sur ${nb(suivant.seuil)} : plus que ${nb(suivant.seuil - r.payes)} pour le prochain bonus de ${F(suivant.bonus)}.</p>` : '<p class="petit" style="margin:8px 0 0">Tous les paliers sont atteints. Merci pour votre engagement.</p>'}
  </div>`;
}

function dessiner(){
  const d = donnees, r = d.resume, code = d.code;
  const lien = SITE + '/?p=' + code;
  const liste = (d.filleuls || []).filter(f => filtre === 'tous' ? true : (ETATS[f.etat] || ETATS.inscrit).groupe === filtre);
  const compte = g => (d.filleuls || []).filter(f => g === 'tous' ? true : (ETATS[f.etat] || ETATS.inscrit).groupe === g).length;
  const total = (r.commission_attente || 0) + (r.commission_validee || 0);
  const taux = r.visiteurs > 0 ? Math.min(100, Math.round(100 * r.inscrits / r.visiteurs)) : null;
  const msgAdmin = 'Bonjour, je suis ' + d.nom + ', partenaire Mon Concours (code ' + code + '). ';
  const ev = evenements(d);
  const nouveaux = derniereVisite ? ev.filter(e => e.t > derniereVisite).length : 0;
  const relances = aRelancer(d);
  const msgs = messages(code);
  const exAn = 3 * d.commission_an, exMois = 6 * d.commission_mois;

  zone.innerHTML = `
    <h1>Bienvenue, ${E(d.nom)}</h1>
    <p class="doux" style="margin:0">Partenaire Mon Concours. Cet espace suit en temps réel les personnes venues grâce à votre code et à votre lien, et vos commissions.</p>
    ${nouveaux ? `<div class="nouveau">${nb(nouveaux)} nouveauté${nouveaux > 1 ? 's' : ''} depuis votre dernière visite. <a href="#nouvelles">Voir</a></div>` : ''}
    <nav class="ancres"><a href="#resultats">Résultats</a><a href="#commissions">Commissions</a><a href="#inscrits">Inscrits</a><a href="#partager">Partager</a><a href="#aide">Aide</a></nav>

    <div class="carte">
      <div class="doux">Votre code partenaire</div>
      <div class="code" id="le-code">${E(code)}</div>
      <div class="doux" style="margin-bottom:4px">Votre lien personnel</div>
      <p class="lien" id="le-lien">${E(lien)}</p>
      <div class="rang">
        <button id="cp-code">Copier le code</button>
        <button id="cp-lien" class="creux">Copier le lien</button>
        <a class="bouton creux" href="${E(lienPartage(msgs[0].texte))}" target="_blank" rel="noopener">Partager sur WhatsApp</a>
      </div>
      <p class="petit" id="cp-etat" style="margin:8px 0 0"></p>
      <p class="petit" style="margin:6px 0 0">La personne ouvre votre lien, ou écrit votre code dans la case « Code partenaire » en créant son compte.</p>
    </div>

    <h2>Votre rémunération</h2>
    <div class="carte">
      <table class="bareme"><thead><tr><th>Abonnement payé</th><th class="n">Commission, à chaque paiement</th></tr></thead><tbody>
        <tr><td>Abonnement Mois</td><td class="n"><b>${F(d.commission_mois)}</b></td></tr>
        <tr><td>Abonnement Année</td><td class="n"><b>${F(d.commission_an)}</b></td></tr>
      </tbody></table>
      <p class="petit" style="margin:10px 0 0">Vous êtes rémunéré à chaque paiement des personnes venues avec votre code ou votre lien, sans limite de durée : tant qu'elles se réabonnent, vous gagnez. Chaque commission est validée ${nb(d.delai_jours)} jours après le paiement, et les commissions validées vous sont versées tous les ${JOURS_VERSEMENT} jours.</p>
      <p class="exemple">Exemples : une personne qui prend l'abonnement Année puis le renouvelle 2 fois vous rapporte <b>${F(exAn)}</b>. Une personne qui reste 6 mois en abonnement Mois vous rapporte <b>${F(exMois)}</b>.</p>
    </div>

    <h2 id="resultats">Vos résultats</h2>
    <div class="tuiles">
      <div class="tuile"><b>${nb(r.visiteurs)}</b><span>visiteurs venus par votre lien</span></div>
      <div class="tuile"><b>${nb(r.inscrits)}</b><span>inscrits avec votre code</span></div>
      <div class="tuile"><b>${nb(r.actifs3)}</b><span>actifs depuis 3 jours ou plus</span></div>
      <div class="tuile"><b>${nb(r.a_voulu_payer)}</b><span>ont voulu payer, sans y arriver</span></div>
      <div class="tuile"><b>${nb(r.payes)}</b><span>ont payé un abonnement</span></div>
      <div class="tuile"><b>${nb(r.nb_paiements)}</b><span>paiements reçus, renouvellements compris</span></div>
    </div>
    ${taux !== null ? `<p class="petit" style="margin:0">Sur 100 visiteurs venus par votre lien, ${taux} se sont inscrits.</p>` : ''}

    <h2 id="commissions">Vos commissions</h2>
    <div class="argent">
      <div class="tuile"><b>${F(r.commission_attente)}</b><span>en cours de validation (${nb(d.delai_jours)} jours)</span></div>
      <div class="tuile"><b>${F(r.solde)}</b><span>validées, à vous verser</span></div>
      <div class="tuile"><b>${F(r.verse)}</b><span>déjà versées</span></div>
    </div>
    <p class="petit" style="margin:8px 0 0">Total généré depuis le début : <b>${F(total)}</b>${r.bonus ? ` (dont ${F(r.bonus)} de bonus de paliers)` : ''}.</p>
    ${(d.paiements || []).length ? `<details class="plie"><summary>Historique de vos commissions (${nb((d.paiements || []).length)})</summary>
      <table><thead><tr><th>Date</th><th>Personne</th><th>Abonnement</th><th class="n">Commission</th></tr></thead><tbody>
      ${d.paiements.slice(0, 40).map(p => `<tr><td>${E(jour(p.paye_le))}</td><td>${E(p.nom)}</td><td>${E(NOM_FORMULE[p.formule] || '')}</td><td class="n"><b>${F(p.commission)}</b><br><span class="petit">${p.commission_etat === 'validee' ? 'validée' : 'en validation'}</span></td></tr>`).join('')}</tbody></table></details>` : ''}

    <h2>Vos paliers de bonus</h2>
    ${sectionPaliers(d)}

    <h2>Votre meilleure période</h2>
    <div class="carte">${sectionSemaines(d)}</div>

    <h2>Dernières nouvelles</h2>
    <div class="carte" id="nouvelles">${ev.length ? ev.slice(0, 8).map(e => `<div class="nouvelle${e.t > derniereVisite && derniereVisite ? ' neuve' : ''}"><span class="petit">${E(heure(e.t))}</span><div>${e.txt}</div></div>`).join('') : '<div class="vide" style="padding:0">Rien pour le moment. Les inscriptions et les paiements apparaîtront ici.</div>'}</div>

    <h2>À relancer en priorité</h2>
    ${relances.length ? relances.map(x => `<div class="carte"><div class="fil"><b>${E(x.f.nom)}</b><span class="badge voulu">${E(x.raison)}</span></div>
      <p class="ligne">Inscrit le ${E(jour(x.f.inscrit_le))} · ${nb(x.f.jours_actifs)} jour${x.f.jours_actifs > 1 ? 's' : ''} d'activité${x.f.derniere_vue ? ' · vu le ' + E(jour(x.f.derniere_vue)) : ''}</p>
      <div class="contact"><a href="https://wa.me/226${E(String(x.f.telephone).replace(/\D/g, ''))}?text=${encodeURIComponent(x.msg)}" target="_blank" rel="noopener">Écrire sur WhatsApp</a><a href="tel:+226${E(String(x.f.telephone).replace(/\D/g, ''))}">Appeler ${E(x.f.telephone)}</a></div></div>`).join('')
      : '<div class="carte"><div class="vide" style="padding:0">Personne à relancer pour le moment.</div></div>'}
    <p class="petit">Un seul message, courtois, suffit. Ne relancez pas plusieurs fois la même personne.</p>

    <h2 id="inscrits">Vos inscrits</h2>
    <div class="filtres" id="filtres">
      ${[['tous', 'Tous'], ['payes', 'Ont payé'], ['voulu', 'Ont voulu payer'], ['inscrits', 'Inscrits seulement']].map(([k, t]) => `<button data-f="${k}" class="${filtre === k ? 'on' : ''}">${t} (${compte(k)})</button>`).join('')}
    </div>
    ${liste.length ? liste.map(carte).join('') : '<div class="vide">Personne dans cette liste pour l\'instant.</div>'}
    <p class="petit">Les numéros des personnes qui n'ont pas encore payé sont visibles pour les accompagner.</p>

    <h2>Vos versements</h2>
    <div class="carte">${(d.versements || []).length ? `<table><thead><tr><th>Date</th><th>Note</th><th class="n">Montant</th></tr></thead><tbody>
      ${d.versements.map(v => `<tr><td>${E(jour(v.verse_le))}</td><td>${E(v.note || '')}</td><td class="n"><b>${F(v.montant)}</b></td></tr>`).join('')}</tbody></table>` : '<div class="vide" style="padding:0">Aucun versement pour le moment.</div>'}</div>

    <h2 id="partager">Messages prêts à partager</h2>
    <p class="doux" style="margin:0 0 8px">Copiez, collez, envoyez. Votre code et votre lien sont déjà dans chaque message.</p>
    ${msgs.map((m, i) => `<div class="carte"><b>${E(m.titre)}</b><pre class="msg">${E(m.texte)}</pre>
      <div class="rang"><button data-cp-msg="${i}">Copier</button><a class="bouton creux" href="${E(lienPartage(m.texte))}" target="_blank" rel="noopener">Envoyer sur WhatsApp</a></div></div>`).join('')}

    <h2>Vos visuels</h2>
    <p class="doux" style="margin:0 0 8px">Des images avec votre code, à télécharger et à publier. Ajoutez votre lien dans la légende.</p>
    <div class="visuels" id="visuels">${VISUELS.map(v => `<div class="carte"><b>${E(v.nom)}</b><div class="cadre" id="vis-${v.id}"></div>
      <div class="rang" style="margin-top:8px"><button data-dl="${v.id}">Télécharger l'image</button></div></div>`).join('')}</div>

    <h2 id="aide">Questions fréquentes</h2>
    <div class="carte faq">
      <details><summary>Comment une personne s'inscrit-elle avec mon code ?</summary><p>Elle ouvre votre lien, ou écrit votre code dans la case « Code partenaire » en créant son compte. Le code doit être saisi à l'inscription : on ne peut pas l'ajouter plus tard.</p></details>
      <details><summary>Est-ce gratuit pour la personne ?</summary><p>Le test de niveau est gratuit, ainsi qu'une partie des entraînements. L'abonnement débloque l'ensemble. Présentez toujours cela avec honnêteté.</p></details>
      <details><summary>Comment la personne paie-t-elle son abonnement ?</summary><p>Dans l'application, rubrique Abonnement. Le paiement est vérifié par l'équipe, puis l'abonnement s'active. Si elle est bloquée, invitez-la à écrire sur WhatsApp à l'équipe Mon Concours.</p></details>
      <details><summary>Quand suis-je payé ?</summary><p>Chaque commission est validée ${nb(d.delai_jours)} jours après le paiement. Les commissions validées sont versées tous les ${JOURS_VERSEMENT} jours, et chaque versement apparaît dans « Vos versements ».</p></details>
      <details><summary>Les renouvellements comptent-ils ?</summary><p>Oui. Vous êtes rémunéré à chaque paiement, sans limite de durée, tant que la personne se réabonne.</p></details>
      <details><summary>Une personne a payé mais mes chiffres n'ont pas bougé. Que faire ?</summary><p>Vérifiez qu'elle s'est inscrite avec votre code, puis écrivez à l'administrateur avec son prénom : nous regardons ensemble.</p></details>
      <details><summary>Puis-je utiliser mon propre code ?</summary><p>Non. Les inscriptions faites avec le numéro du partenaire ne sont pas comptées.</p></details>
    </div>

    <h2>Écrire à l'administrateur</h2>
    <div class="carte">
      <p style="margin:0 0 10px">Une question, une difficulté ou un versement à vérifier : écrivez directement à l'administrateur de Mon Concours sur WhatsApp.</p>
      <a class="bouton" href="https://wa.me/226${ADMIN_TEL}?text=${encodeURIComponent(msgAdmin)}" target="_blank" rel="noopener">Écrire sur WhatsApp</a>
      <span class="petit" style="margin-left:8px">77 95 98 48</span>
    </div>

    <h2>Règles du partenariat</h2>
    <ul class="regles">
      <li>Une commission est due pour chaque paiement réel d'une personne venue avec votre code. Un abonnement offert n'en donne pas.</li>
      <li>Présentez Mon Concours avec honnêteté : aucune promesse de réussite au concours.</li>
      <li>Pas de messages en masse non sollicités, et ne vous présentez jamais comme l'équipe Mon Concours.</li>
      <li>L'administration peut fermer un accès en cas d'abus.</li>
    </ul>
    <div class="rang" style="margin-top:16px"><button id="actualiser" class="creux">Actualiser</button></div>
    <p class="petit">Mis à jour à ${E(heure(new Date()))} (heure de Ouagadougou).</p>`;

  const copier = async (txt, msg) => {
    const z = document.getElementById('cp-etat');
    try{ await navigator.clipboard.writeText(txt); z.textContent = msg; }
    catch(e){
      const t = document.createElement('textarea'); t.value = txt; document.body.appendChild(t); t.select();
      try{ document.execCommand('copy'); z.textContent = msg; }catch(x){ z.textContent = 'Copie impossible : recopiez à la main.'; }
      t.remove();
    }
  };
  document.getElementById('cp-code').onclick = () => copier(code, 'Code copié : ' + code);
  document.getElementById('cp-lien').onclick = () => copier(lien, 'Lien copié.');
  document.getElementById('actualiser').onclick = () => charger();
  document.querySelectorAll('#filtres [data-f]').forEach(b => b.onclick = () => { filtre = b.dataset.f; dessiner(); });
  document.querySelectorAll('[data-cp-msg]').forEach(b => b.onclick = async () => {
    const t = msgs[+b.dataset.cpMsg].texte;
    try{ await navigator.clipboard.writeText(t); b.textContent = 'Copié'; }catch(e){ b.textContent = 'Copie impossible'; }
    setTimeout(() => { b.textContent = 'Copier'; }, 1800);
  });

  /* les visuels : dessinés avec le logo, puis proposés en téléchargement */
  const im = new Image();
  const poser = logo => VISUELS.forEach(v => {
    const cadre = document.getElementById('vis-' + v.id); if(!cadre) return;
    const cv = dessinerVisuel(v, code, logo); cadre.innerHTML = ''; cadre.appendChild(cv);
    const bt = document.querySelector('[data-dl="' + v.id + '"]');
    if(bt) bt.onclick = () => cv.toBlob(blob => {
      if(!blob) return; const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = 'mon-concours-' + v.id + '-' + code + '.png'; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }, 'image/png');
  });
  im.onload = () => poser(im); im.onerror = () => poser(null); im.src = '/icone-192.png';
}

charger();
document.addEventListener('visibilitychange', () => { if(!document.hidden && donnees) charger(); });
})();
