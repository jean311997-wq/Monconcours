/* ============================================================
   MON CONCOURS · connexion à la base
   Ces clés sont publiques par nature : la sécurité repose
   sur les règles RLS de la base, pas sur le secret de la clé.
   ============================================================ */

const SUPABASE_URL = 'https://uonhpsumbfuahipbdjnu.supabase.co';
// clé publique historique : acceptée par toutes les versions de la bibliothèque
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvbmhwc3VtYmZ1YWhpcGJkam51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMjg1MTQsImV4cCI6MjEwMTcwNDUxNH0.UR2CSJaK0AyyIRDzDBoALcU7OeE9SdQESHI9ASZMYIk';

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true }
});

/* --- petits utilitaires partagés --- */
const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

function nombre(n){ return (n ?? 0).toLocaleString('fr-FR'); }

function dateCourte(iso){
  if(!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR',
    { day:'numeric', month:'long', year:'numeric' });
}

function dateHeure(iso){
  if(!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR',
    { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
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
  signal((contexte ? contexte + ' : ' : '') + (e?.message || 'erreur inconnue'), 'mal');
}
