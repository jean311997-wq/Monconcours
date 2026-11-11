/* ============================================================
   MON CONCOURS · administration · carte « État de la base »
   Une lecture légère par minute (public.etat_base) tant que la page est
   visible. Rien n'est écrit en base. La réserve de disque exacte du plan
   gratuit n'est pas accessible d'ici : la carte la déduit de la lenteur
   réelle, des requêtes bloquées et des lectures disque, et le dit.
   ============================================================ */
(function(){
'use strict';

const NIVEAUX = {
  normal:  { nom: 'Normal',                 couleur: '#1f8a4c', texte: 'Tout répond vite.' },
  attention:{ nom: 'Attention',             couleur: '#c77d00', texte: 'La base travaille beaucoup. Évitez les envois en masse et les gros calculs.' },
  extreme: { nom: 'Extrême',                couleur: '#c0392b', texte: 'La base est à bout. Ne lancez rien, laissez-la se calmer.' },
  ralenti: { nom: 'Ralentissement en cours', couleur: '#c0392b', texte: 'Les réponses sont lentes ou échouent. Les candidats le sentent.' }
};

let prec = null, histo = [], minuteur = null, enCours = false;

function carte(){
  let c = document.getElementById('carte-sante');
  if(c) return c;
  const vue = document.getElementById('vue');
  if(!vue || !vue.parentNode) return null;
  c = document.createElement('div');
  c.id = 'carte-sante';
  c.setAttribute('role', 'status');
  c.style.cssText = 'margin:0 0 14px;padding:12px 16px;border-radius:10px;border:1px solid var(--trait,#ddd);background:var(--fond2,#fff);font-size:13.5px;line-height:1.45';
  vue.parentNode.insertBefore(c, vue);
  return c;
}

function niveau(lat, d){
  if(lat == null || lat > 4000) return 'ralenti';
  if(d.lentes >= 3 || lat > 2000) return 'ralenti';
  if(d.taille_mo >= 490 || d.lecturesParS > 900 || lat > 1200 || d.lentes >= 1) return 'extreme';
  if(d.taille_mo >= 470 || d.lecturesParS > 400 || lat > 600 || d.connexions >= 0.7 * d.max_connexions) return 'attention';
  return 'normal';
}

async function mesurer(){
  if(enCours || document.hidden) return;
  const X = window.ADMIN;
  if(!X || !X.db) return;
  const zone = document.getElementById('admin');
  if(zone && zone.hidden) return;
  enCours = true;
  const c = carte();
  const t0 = performance.now();
  let data = null, erreur = null;
  try{
    const r = await X.db.rpc('etat_base');
    data = r.data; erreur = r.error;
  }catch(e){ erreur = e; }
  const lat = Math.round(performance.now() - t0);
  enCours = false;
  if(!c) return;

  if(erreur || !data){
    const n = NIVEAUX.ralenti;
    c.style.borderColor = n.couleur;
    c.innerHTML = `<b style="color:${n.couleur}">${n.nom}</b> · la base n'a pas répondu à la mesure. ${n.texte}`;
    return;
  }

  const maintenant = Date.parse(data.maintenant);
  let lecturesParS = 0, ecritsParS = 0;
  if(prec && maintenant > prec.t){
    const dt = (maintenant - prec.t) / 1000;
    lecturesParS = Math.max(0, Math.round((data.lus_disque - prec.lus) / dt));
    ecritsParS = Math.max(0, Math.round((data.ecrits - prec.ecrits) / dt));
  }
  prec = { t: maintenant, lus: data.lus_disque, ecrits: data.ecrits };
  const d = Object.assign({}, data, { lecturesParS, ecritsParS });
  histo.push(lecturesParS); if(histo.length > 30) histo.shift();

  const cle = niveau(lat, d);
  const n = NIVEAUX[cle];
  const total = data.lus_disque + data.lus_cache;
  const cache = total ? Math.round(100 * data.lus_cache / total) : null;
  const pic = Math.max.apply(null, histo.concat([0]));
  const rempli = Math.min(100, Math.round(100 * data.taille_mo / data.limite_mo));

  c.style.borderColor = n.couleur;
  c.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:6px 18px;align-items:baseline">
      <b style="color:${n.couleur};font-size:15px">État de la base : ${n.nom}</b>
      <span>${n.texte}</span>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:4px 22px;margin-top:6px;color:var(--craie2,#555)">
      <span>Temps de réponse : <b>${lat} ms</b></span>
      <span>Lectures disque : <b>${lecturesParS}/s</b> (pic ${pic}/s sur 30 min)</span>
      <span>Requêtes actives : <b>${data.actives}</b>${data.lentes ? ` dont <b style="color:#c0392b">${data.lentes} bloquée(s) &gt; 5 s</b>` : ''}</span>
      <span>Connexions : <b>${data.connexions}/${data.max_connexions}</b></span>
      <span>Taille : <b>${data.taille_mo} Mo / ${data.limite_mo} Mo</b> (${rempli} %)</span>
      ${cache != null ? `<span>Lu en mémoire : <b>${cache} %</b></span>` : ''}
    </div>
    <div style="margin-top:6px;font-size:12px;color:var(--craie2,#666)">Estimation faite ici : la réserve exacte de disque du plan gratuit n'est visible que dans le tableau de bord Supabase. Mise à jour chaque minute.</div>`;
}

function demarrer(){
  mesurer();
  if(minuteur) clearInterval(minuteur);
  minuteur = setInterval(mesurer, 60000);
  document.addEventListener('visibilitychange', () => { if(!document.hidden) mesurer(); });
}

/* attendre que l'administration soit connectée */
let essais = 0;
const attente = setInterval(() => {
  essais++;
  const X = window.ADMIN, zone = document.getElementById('admin');
  if(X && X.db && zone && !zone.hidden){ clearInterval(attente); demarrer(); }
  else if(essais > 600) clearInterval(attente);
}, 1000);

})();
