/* Mon Concours · espace partenaire.
   L'accès se fait par un lien secret : partenaire.html#JETON. Le jeton reste après le « # »,
   il n'est donc jamais envoyé aux serveurs dans l'adresse. */
(function(){
'use strict';
const URL_BASE = 'https://uonhpsumbfuahipbdjnu.supabase.co';
const CLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvbmhwc3VtYmZ1YWhpcGJkam51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMjg1MTQsImV4cCI6MjEwMTcwNDUxNH0.UR2CSJaK0AyyIRDzDBoALcU7OeE9SdQESHI9ASZMYIk';
const SITE = 'https://www.monconcoursbf.com';
const zone = document.getElementById('zone');
const E = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const nb = v => Number(v || 0).toLocaleString('fr-FR').replace(/ | /g, ' ');
const F = v => nb(v) + ' F';
const jour = d => d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '';
const heure = d => d ? new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : '';

let jeton = (location.hash || '').replace(/^#/, '').trim();
try{
  if(jeton) localStorage.setItem('mc_partenaire_jeton', jeton);
  else jeton = localStorage.getItem('mc_partenaire_jeton') || '';
}catch(e){}

let db = null, donnees = null, filtre = 'tous';
if(window.supabase && window.supabase.createClient){
  db = window.supabase.createClient(URL_BASE, CLE, { auth: { persistSession: false, autoRefreshToken: false } });
}

function erreur(msg){
  zone.innerHTML = `<div class="erreur"><b>${E(msg)}</b><p class="doux" style="margin:8px 0 0">Si le problème continue, écris à l'équipe Mon Concours sur WhatsApp.</p></div>`;
}

async function charger(){
  if(!db) return erreur('Le service ne répond pas pour l\'instant. Réessaie dans un moment.');
  if(!jeton) return erreur('Ce lien est incomplet. Utilise le lien complet que l\'équipe t\'a envoyé.');
  let r;
  try{ r = await db.rpc('partenaire_tableau', { p_jeton: jeton }); }catch(e){ r = { error: e }; }
  if(r.error || !r.data) return erreur('Impossible de charger ton espace. Vérifie ta connexion puis réessaie.');
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

function lienPartage(code){
  const lien = SITE + '/?p=' + code;
  const texte = 'Prépare ton concours direct avec Mon Concours : fais le test de niveau gratuit et entraîne-toi chaque jour. Mon code partenaire : ' + code + '\n' + lien;
  return 'https://wa.me/?text=' + encodeURIComponent(texte);
}

function carte(f){
  const e = ETATS[f.etat] || ETATS.inscrit;
  let detail = '';
  if(f.etat === 'paye'){
    const form = f.formule === 'annuelle' ? 'Abonnement Année' : f.formule === 'mensuelle' ? 'Abonnement Mois' : 'Abonnement';
    const com = f.commission > 0
      ? (f.commission_etat === 'validee' ? `Commission ${F(f.commission)} · validée` : `Commission ${F(f.commission)} · sera validée le ${jour(f.valide_le)}`)
      : 'Pas de commission sur cette formule';
    detail = `<p class="ligne">${E(form)} · payé le ${E(jour(f.paye_le))}</p><p class="ligne"><b>${E(com)}</b></p>`;
  }
  const tel = f.telephone ? String(f.telephone).replace(/\D/g, '') : '';
  const contact = tel ? `<div class="contact"><a href="tel:+226${E(tel)}">Appeler ${E(tel)}</a><a href="https://wa.me/226${E(tel)}" target="_blank" rel="noopener">WhatsApp</a></div>` : '';
  return `<div class="carte"><div class="fil"><b>${E(f.nom)}</b><span class="badge ${e.cls}">${e.txt}</span></div>
    <p class="ligne">Inscrit le ${E(jour(f.inscrit_le))} · ${nb(f.jours_actifs)} jour${f.jours_actifs > 1 ? 's' : ''} d'activité${f.derniere_vue ? ' · vu le ' + E(jour(f.derniere_vue)) : ''}</p>
    ${detail}${contact}</div>`;
}

function dessiner(){
  const d = donnees, r = d.resume, code = d.code;
  const lien = SITE + '/?p=' + code;
  const prenom = d.nom || '';
  const liste = (d.filleuls || []).filter(f => filtre === 'tous' ? true : (ETATS[f.etat] || ETATS.inscrit).groupe === filtre);
  const compte = g => (d.filleuls || []).filter(f => g === 'tous' ? true : (ETATS[f.etat] || ETATS.inscrit).groupe === g).length;
  zone.innerHTML = `
    <h1>Bonjour ${E(prenom)}</h1>
    <p class="doux" style="margin:0">Voici ton espace partenaire. Tu gagnes ${F(d.commission_mois)} pour chaque abonnement Mois et ${F(d.commission_an)} pour chaque abonnement Année payé par une personne venue avec ton code.</p>

    <div class="carte">
      <div class="doux">Ton code</div>
      <div class="code" id="le-code">${E(code)}</div>
      <div class="doux" style="margin-bottom:4px">Ton lien personnel</div>
      <p class="lien" id="le-lien">${E(lien)}</p>
      <div class="rang">
        <button id="cp-code">Copier le code</button>
        <button id="cp-lien" class="creux">Copier le lien</button>
        <a class="bouton creux" href="${E(lienPartage(code))}" target="_blank" rel="noopener">Envoyer sur WhatsApp</a>
      </div>
      <p class="petit" id="cp-etat" style="margin:8px 0 0"></p>
      <p class="petit" style="margin:6px 0 0">La personne ouvre ton lien ou écrit ton code dans la case « Code partenaire » en créant son compte.</p>
    </div>

    <div class="tuiles">
      <div class="tuile"><b>${nb(r.inscrits)}</b><span>inscrits avec ton code</span></div>
      <div class="tuile"><b>${nb(r.actifs3)}</b><span>actifs depuis 3 jours ou plus</span></div>
      <div class="tuile"><b>${nb(r.a_voulu_payer)}</b><span>ont voulu payer, sans y arriver</span></div>
      <div class="tuile"><b>${nb(r.payes)}</b><span>ont payé</span></div>
    </div>

    <h2>Tes commissions</h2>
    <div class="argent">
      <div class="tuile"><b>${F(r.commission_attente)}</b><span>en attente de validation (${nb(d.delai_jours)} jours)</span></div>
      <div class="tuile"><b>${F(r.solde)}</b><span>validées, à te verser</span></div>
      <div class="tuile"><b>${F(r.verse)}</b><span>déjà versées</span></div>
    </div>

    <h2>Tes inscrits</h2>
    <div class="filtres" id="filtres">
      ${[['tous', 'Tous'], ['payes', 'Ont payé'], ['voulu', 'Ont voulu payer'], ['inscrits', 'Inscrits seulement']].map(([k, t]) => `<button data-f="${k}" class="${filtre === k ? 'on' : ''}">${t} (${compte(k)})</button>`).join('')}
    </div>
    ${liste.length ? liste.map(carte).join('') : '<div class="vide">Personne dans cette liste pour l\'instant.</div>'}
    <p class="petit">Tu vois les numéros des personnes qui n'ont pas encore payé, pour les encourager. Appelle avec respect, une fois, sans insister.</p>

    <h2>Tes versements</h2>
    <div class="carte">${(d.versements || []).length ? `<table><thead><tr><th>Date</th><th>Note</th><th class="n">Montant</th></tr></thead><tbody>
      ${d.versements.map(v => `<tr><td>${E(jour(v.verse_le))}</td><td>${E(v.note || '')}</td><td class="n"><b>${F(v.montant)}</b></td></tr>`).join('')}</tbody></table>` : '<div class="vide" style="padding:0">Aucun versement pour le moment.</div>'}</div>

    <h2>Comment ça marche</h2>
    <ul class="regles">
      <li>Une commission naît quand une personne venue avec ton code paie un abonnement. Seul son premier paiement compte.</li>
      <li>Elle est validée ${nb(d.delai_jours)} jours après le paiement, puis versée avec le prochain versement.</li>
      <li>Un abonnement offert ne donne pas de commission.</li>
      <li>Pas de spam, pas de promesse de réussite au concours, et ne te fais jamais passer pour l'équipe Mon Concours.</li>
    </ul>
    <div class="rang" style="margin-top:16px"><button id="actualiser" class="creux">Actualiser</button></div>
    <p class="petit">Mis à jour à ${E(heure(new Date()))} (heure de Ouagadougou).</p>`;

  const copier = async (txt, msg) => {
    const z = document.getElementById('cp-etat');
    try{ await navigator.clipboard.writeText(txt); z.textContent = msg; }
    catch(e){
      const t = document.createElement('textarea'); t.value = txt; document.body.appendChild(t); t.select();
      try{ document.execCommand('copy'); z.textContent = msg; }catch(x){ z.textContent = 'Copie impossible : recopie à la main.'; }
      t.remove();
    }
  };
  document.getElementById('cp-code').onclick = () => copier(code, 'Code copié : ' + code);
  document.getElementById('cp-lien').onclick = () => copier(lien, 'Lien copié.');
  document.getElementById('actualiser').onclick = () => charger();
  document.querySelectorAll('#filtres [data-f]').forEach(b => b.onclick = () => { filtre = b.dataset.f; dessiner(); });
}

charger();
document.addEventListener('visibilitychange', () => { if(!document.hidden && donnees) charger(); });
})();
