/* ============================================================
   MON CONCOURS · maintenance technique
   Quand la base ne répond plus alors que le site, lui, s'affiche,
   le candidat peut continuer à s'entraîner : QCM illimités, avec
   correction, tirés d'une banque servie par le site (pas par la base).
   Rien n'est écrit en base pendant la panne. Les réponses sont gardées
   sur le téléphone puis envoyées en un seul lot au retour de la base.
   Aucun effet tant que la base répond : ce fichier ne fait rien d'autre
   qu'écouter les échecs signalés par app.js (window.mcPanne).
   ============================================================ */
(function(){
'use strict';

const FICHIERS = ['banque-maint-3e.json', 'banque-maint-tle.json', 'banque-maint-lic.json'];
const NIVEAUX = [
  { cle: 'tout', nom: 'Tout mélangé' },
  { cle: 'troisieme', nom: '3ᵉ' },
  { cle: 'terminale', nom: 'Terminale' },
  { cle: 'licence', nom: 'Licence' }
];
const CLE_STOCK = 'monconcours.maint';
const MAX_STOCK = 300;

let echecs = [], actif = false, verif = false, sonde = null, bonnesSondes = 0;
let banque = null, chargement = null, file = [], courant = null, choix = 'tout';
let stats = { ok: 0, n: 0 }, tQuestion = 0;

const $ = (t, a, h) => { const e = document.createElement(t); if(a) for(const k in a) e.setAttribute(k, a[k]); if(h != null) e.innerHTML = h; return e; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const norm = s => String(s).replace(/’/g, "'").replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 60);

/* ---------- réponses gardées sur le téléphone ---------- */
function lireStock(){ try{ const v = JSON.parse(localStorage.getItem(CLE_STOCK) || '[]'); return Array.isArray(v) ? v : []; }catch(e){ return []; } }
function ecrireStock(l){ try{ localStorage.setItem(CLE_STOCK, JSON.stringify(l.slice(-MAX_STOCK))); }catch(e){} }

/* ---------- styles ---------- */
function styles(){
  if(document.getElementById('mt-css')) return;
  const s = $('style', { id: 'mt-css' }, `
  #mt-banniere{position:fixed;left:12px;right:12px;bottom:calc(76px + env(safe-area-inset-bottom,0px));z-index:9000;max-width:520px;margin:0 auto;
    background:#16130A;border:1px solid #3A3520;border-radius:14px;padding:14px 16px;color:#E9EEEA;box-shadow:0 10px 30px rgba(0,0,0,.45);font-size:14px;line-height:1.5}
  #mt-banniere b{display:block;font-size:15px;color:#E3A82B;margin-bottom:3px}
  #mt-banniere .mt-ligne{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
  .mt-btn{border:1px solid #3A3520;background:#241F10;color:#E9EEEA;border-radius:10px;padding:10px 14px;font:inherit;font-weight:600;cursor:pointer;min-height:44px}
  .mt-btn.or{background:#E3A82B;border-color:#E3A82B;color:#1A1405}
  .mt-btn:focus-visible{outline:2px solid #E3A82B;outline-offset:2px}
  #mt-couche{position:fixed;inset:0;z-index:9500;background:#080B0A;color:#E9EEEA;overflow:auto;-webkit-overflow-scrolling:touch}
  #mt-couche .mt-bloc{max-width:640px;margin:0 auto;padding:18px 16px calc(28px + env(safe-area-inset-bottom,0px))}
  #mt-couche h2{font-size:19px;margin:0 0 4px}
  #mt-couche .mt-sous{color:#A2B2AA;font-size:13.5px;line-height:1.5;margin:0 0 14px}
  #mt-couche .mt-puces{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 16px}
  #mt-couche .mt-puce{border:1px solid #2A332F;background:transparent;color:#A2B2AA;border-radius:999px;padding:8px 13px;font:inherit;font-size:13px;cursor:pointer;min-height:40px}
  #mt-couche .mt-puce[aria-pressed=true]{background:#241F10;border-color:#E3A82B;color:#E9EEEA;font-weight:600}
  #mt-couche .mt-mat{font-size:12.5px;color:#A2B2AA;margin-bottom:6px}
  #mt-couche .mt-q{font-size:17px;line-height:1.5;margin:0 0 14px;font-weight:600}
  #mt-couche .mt-rep{display:block;width:100%;text-align:left;border:1px solid #2A332F;background:#10161400;color:#E9EEEA;border-radius:12px;padding:13px 14px;margin:0 0 8px;font:inherit;font-size:15px;line-height:1.4;cursor:pointer;min-height:48px}
  #mt-couche .mt-rep:hover:not([disabled]){border-color:#4a5a52}
  #mt-couche .mt-rep.bon{border-color:#1f8a4c;background:#0E2318}
  #mt-couche .mt-rep.faux{border-color:#c0392b;background:#2A1210}
  #mt-couche .mt-rep[disabled]{cursor:default}
  #mt-couche .mt-corr{margin:12px 0;padding:12px 14px;border-radius:12px;background:#10161A;border:1px solid #2A332F;font-size:14px;line-height:1.55}
  #mt-couche .mt-corr b{display:block;margin-bottom:3px}
  #mt-couche .mt-pied{display:flex;gap:8px;justify-content:space-between;align-items:center;margin-top:14px;flex-wrap:wrap}
  #mt-couche .mt-score{color:#A2B2AA;font-size:13px}
  @media (prefers-reduced-motion:no-preference){#mt-banniere{animation:mtmonte .25s ease-out}@keyframes mtmonte{from{transform:translateY(12px);opacity:0}to{transform:none;opacity:1}}}
  `);
  document.head.appendChild(s);
}

/* ---------- la banque ---------- */
function charger(){
  if(banque) return Promise.resolve(banque);
  if(chargement) return chargement;
  chargement = Promise.all(FICHIERS.map(f => fetch(f).then(r => { if(!r.ok) throw 0; return r.json(); }).catch(() => null)))
    .then(parts => {
      const b = { troisieme: [], terminale: [], licence: [] };
      parts.forEach(p => { if(p && p.n && Array.isArray(p.q)) b[p.n] = p.q.map(q => ({ m: q[0], q: q[1], o: q[2], b: q[3], e: q[4], n: p.n })); });
      banque = b;
      return b;
    });
  return chargement;
}

function melanger(t){ for(let i = t.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); const x = t[i]; t[i] = t[j]; t[j] = x; } return t; }

function remplirFile(){
  const b = banque || {};
  const pool = choix === 'tout' ? [].concat(b.troisieme || [], b.terminale || [], b.licence || []) : (b[choix] || []).slice();
  file = melanger(pool.slice());
}

/* ---------- l'écran d'entraînement ---------- */
function couche(){
  let c = document.getElementById('mt-couche');
  if(!c){
    c = $('div', { id: 'mt-couche', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'QCM pendant la maintenance' });
    document.body.appendChild(c);
  }
  return c;
}

function entete(){
  return `<h2>QCM en attendant</h2>
  <p class="mt-sous">La maintenance technique est en cours. Les cours et les compositions reviennent dès qu'elle est terminée. D'ici là, entraîne-toi : la correction s'affiche tout de suite, sans limite de questions. Tes réponses seront enregistrées à ton compte au retour de la base si tu es connecté.</p>
  <div class="mt-puces" role="group" aria-label="Niveau">${NIVEAUX.map(n => `<button class="mt-puce" data-niv="${n.cle}" aria-pressed="${n.cle === choix}">${n.nom}</button>`).join('')}</div>`;
}

function ouvrir(){
  styles();
  const c = couche();
  c.hidden = false;
  c.innerHTML = `<div class="mt-bloc">${entete()}<div id="mt-corps"><p class="mt-sous">Chargement des questions…</p></div></div>`;
  brancherPuces();
  charger().then(() => {
    const total = Object.keys(banque).reduce((s, k) => s + banque[k].length, 0);
    if(!total){
      document.getElementById('mt-corps').innerHTML = `<p class="mt-sous">Les questions ne sont pas disponibles sur cet appareil pour le moment. Réessaie dans quelques minutes.</p><button class="mt-btn" id="mt-quit">Fermer</button>`;
      document.getElementById('mt-quit').onclick = fermer;
      return;
    }
    stats = { ok: 0, n: 0 };
    remplirFile();
    suivante();
  });
}

function brancherPuces(){
  document.querySelectorAll('#mt-couche .mt-puce').forEach(b => {
    b.onclick = () => {
      choix = b.getAttribute('data-niv');
      document.querySelectorAll('#mt-couche .mt-puce').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      if(banque){ remplirFile(); suivante(); }
    };
  });
}

function fermer(){
  const c = document.getElementById('mt-couche');
  if(c) c.hidden = true;
}

function suivante(){
  if(!file.length) remplirFile();
  courant = file.pop();
  const corps = document.getElementById('mt-corps');
  if(!courant || !corps) return;
  /* on mélange l'ordre des réponses, sauf quand il fait partie du sens */
  const ordre = courant.o.map((_, i) => i);
  if(!/toutes les|aucune|les deux|ci-dessus/i.test(courant.o.join(' '))) melanger(ordre);
  courant.ordre = ordre;
  tQuestion = Date.now();
  corps.innerHTML = `
    <div class="mt-mat">${esc(courant.m)}</div>
    <p class="mt-q">${esc(courant.q)}</p>
    <div id="mt-reps">${ordre.map((i, pos) => `<button class="mt-rep" data-i="${i}">${esc(courant.o[i])}</button>`).join('')}</div>
    <div id="mt-corr" aria-live="polite"></div>
    <div class="mt-pied"><span class="mt-score">${stats.n ? `${stats.ok} bonne${stats.ok > 1 ? 's' : ''} réponse${stats.ok > 1 ? 's' : ''} sur ${stats.n}` : ''}</span><span><button class="mt-btn" id="mt-quit">Quitter</button></span></div>`;
  corps.querySelectorAll('.mt-rep').forEach(b => b.onclick = () => repondre(parseInt(b.getAttribute('data-i'), 10)));
  document.getElementById('mt-quit').onclick = fermer;
  const c = document.getElementById('mt-couche'); if(c) c.scrollTop = 0;
}

function repondre(i){
  if(!courant || courant.fait) return;
  courant.fait = true;
  const bon = i === courant.b;
  stats.n++; if(bon) stats.ok++;
  const l = lireStock();
  l.push({ k: norm(courant.q), choix: [i], t: Math.min(Date.now() - tQuestion, 300000) });
  ecrireStock(l);
  document.querySelectorAll('#mt-reps .mt-rep').forEach(b => {
    const k = parseInt(b.getAttribute('data-i'), 10);
    b.disabled = true;
    if(k === courant.b) b.classList.add('bon');
    else if(k === i) b.classList.add('faux');
  });
  document.getElementById('mt-corr').innerHTML = `<div class="mt-corr"><b>${bon ? 'Bonne réponse.' : 'Pas tout à fait.'}</b>${bon ? '' : `La bonne réponse est « ${esc(courant.o[courant.b])} ». `}${esc(courant.e || '')}</div>
    <button class="mt-btn or" id="mt-suiv">Question suivante</button>`;
  const s = document.getElementById('mt-suiv');
  s.onclick = suivante; s.focus();
  const sc = document.querySelector('#mt-couche .mt-score');
  if(sc) sc.textContent = `${stats.ok} bonne${stats.ok > 1 ? 's' : ''} réponse${stats.ok > 1 ? 's' : ''} sur ${stats.n}`;
}

/* ---------- la bannière ---------- */
function montrerBanniere(){
  styles();
  if(document.getElementById('mt-banniere')) return;
  const b = $('div', { id: 'mt-banniere', role: 'status' },
    `<b>Maintenance technique en cours</b>Nos serveurs sont en cours de remise en état. Ta progression est gardée. En attendant, tu peux t'entraîner sur des QCM avec correction immédiate.
     <div class="mt-ligne"><button class="mt-btn or" id="mt-go">S'entraîner en QCM</button><button class="mt-btn" id="mt-masquer">Plus tard</button></div>`);
  document.body.appendChild(b);
  document.getElementById('mt-go').onclick = () => { b.hidden = true; ouvrir(); };
  document.getElementById('mt-masquer').onclick = () => { b.hidden = true; };
  /* on prépare les questions pendant que le candidat lit */
  charger();
}

function retirerBanniere(){
  const b = document.getElementById('mt-banniere'); if(b) b.remove();
}

/* ---------- détecter la vraie panne ---------- */
function sondeBase(){
  if(typeof BASE_URL === 'undefined' || typeof BASE_CLE === 'undefined') return Promise.resolve(true);
  const ctl = ('AbortController' in window) ? new AbortController() : null;
  const t = setTimeout(() => { try{ ctl && ctl.abort(); }catch(e){} }, 10000);
  return fetch(BASE_URL + '/rest/v1/matieres?select=id&limit=1', { headers: { apikey: BASE_CLE }, cache: 'no-store', signal: ctl ? ctl.signal : undefined })
    .then(r => { clearTimeout(t); return r.status < 500; }).catch(() => { clearTimeout(t); return false; });
}
/* le site, lui, répond-il ? (sinon c'est le téléphone qui est hors ligne) */
function sondeSite(){
  return fetch('favicon.png?mc=' + Date.now(), { cache: 'no-store' }).then(r => r.ok).catch(() => false);
}

function verifier(){
  if(verif || actif) return;
  verif = true;
  Promise.all([sondeBase(), sondeSite()]).then(([base, site]) => {
    verif = false;
    if(base || !site) { echecs = []; return; }
    declencher();
  });
}

function declencher(){
  if(actif) return;
  actif = true; bonnesSondes = 0;
  montrerBanniere();
  clearInterval(sonde);
  sonde = setInterval(() => {
    sondeBase().then(ok => {
      bonnesSondes = ok ? bonnesSondes + 1 : 0;
      if(bonnesSondes >= 2) retablir();
    });
  }, 20000);
}

function retablir(){
  clearInterval(sonde); sonde = null; actif = false; echecs = []; bonnesSondes = 0;
  retirerBanniere();
  const c = document.getElementById('mt-couche');
  const enCours = c && !c.hidden;
  if(enCours){
    const corps = document.getElementById('mt-corps');
    if(corps) corps.insertAdjacentHTML('afterbegin', `<div class="mt-corr"><b>C'est rétabli.</b>La maintenance est terminée. Tu peux retourner à l'application.</div><button class="mt-btn or" id="mt-retour" style="margin-bottom:14px">Retourner à l'application</button>`);
    const r = document.getElementById('mt-retour'); if(r) r.onclick = () => { fermer(); };
  } else if(typeof toast === 'function') toast('La maintenance est terminée.');
  synchroniser();
}

/* appelé par app.js à chaque réponse de la base : ok = vrai si elle a répondu */
window.mcPanne = function(ok){
  if(ok){ if(!actif) echecs = []; return; }
  if(actif) return;
  const t = Date.now();
  echecs = echecs.filter(x => t - x < 45000); echecs.push(t);
  if(echecs.length >= 3) verifier();
};

/* ---------- envoi des réponses gardées ---------- */
let envoi = false;
function synchroniser(){
  if(envoi) return;
  const l = lireStock();
  if(!l.length || typeof base === 'undefined' || !base) return;
  envoi = true;
  const lot = l.slice(0, 150);
  base.rpc('remettre_maintenance', { p_reponses: lot }).then(({ data, error }) => {
    envoi = false;
    if(error || !data) return;
    if(data.connexion) return; /* pas connecté : on garde pour plus tard */
    if(data.ok){
      ecrireStock(lireStock().slice(lot.length));
      if(lireStock().length) setTimeout(synchroniser, 3000);
    }
  }, () => { envoi = false; });
}

/* ---------- démarrage ---------- */
function demarrer(){
  /* on prépare la banque quand le téléphone est tranquille, sans gêner l'ouverture */
  const conn = navigator.connection;
  if(!(conn && conn.saveData)){
    const go = () => charger();
    if('requestIdleCallback' in window) setTimeout(() => requestIdleCallback(go, { timeout: 8000 }), 15000);
    else setTimeout(go, 20000);
  }
  /* des réponses restées sur le téléphone après une panne : on les envoie dès que la base est là */
  setTimeout(synchroniser, 12000);
  /* essai manuel : ?maintenance=1 (n'écrit rien en base) */
  if(/[?&]maintenance=1\b/.test(location.search)) declencher();
}
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();

window.mcMaintenance = { ouvrir: ouvrir };
})();
