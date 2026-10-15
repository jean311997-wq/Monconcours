// Bannir ou réintégrer un candidat. Réservé aux administrateurs.
// Le bannissement bloque la connexion (service d'authentification) et
// est inscrit dans la table « bannissements » avec son motif.
import { createClient } from "npm:@supabase/supabase-js@2";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ORIGINES = ["https://monconcours.vercel.app"];
function entetes(req: Request) {
  const o = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ORIGINES.includes(o) || o.startsWith("http://localhost") ? o : ORIGINES[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Vary": "Origin",
  };
}
const reponse = (req: Request, corps: unknown, statut = 200) =>
  new Response(JSON.stringify(corps), { status: statut, headers: entetes(req) });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: entetes(req) });
  if (req.method !== "POST") return reponse(req, { ok: false }, 405);

  // 1. l'appelant doit être administrateur
  const jeton = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: qui } = await admin.auth.getUser(jeton);
  const moi = qui?.user?.id;
  if (!moi) return reponse(req, { ok: false, message: "Connectez-vous d'abord." }, 401);
  const { data: roles } = await admin.from("roles_utilisateur").select("role").eq("user_id", moi);
  if (!(roles || []).some((r: { role: string }) => r.role === "admin")) {
    return reponse(req, { ok: false, message: "Réservé aux administrateurs." }, 403);
  }

  let corps: { user_id?: string; action?: string; motif?: string; jours?: number } = {};
  try { corps = await req.json(); } catch (_) { /* vide */ }
  const cible = String(corps.user_id || "");
  if (!/^[0-9a-f-]{36}$/i.test(cible)) return reponse(req, { ok: false, message: "Candidat introuvable." });
  if (cible === moi) return reponse(req, { ok: false, message: "Vous ne pouvez pas vous bannir vous-même." });
  const { data: rolesCible } = await admin.from("roles_utilisateur").select("role").eq("user_id", cible);
  if ((rolesCible || []).some((r: { role: string }) => r.role === "admin" || r.role === "correcteur")) {
    return reponse(req, { ok: false, message: "Un membre de l'équipe ne peut pas être banni ici." });
  }

  if (corps.action === "lever") {
    const { error } = await admin.auth.admin.updateUserById(cible, { ban_duration: "none" });
    if (error) return reponse(req, { ok: false, message: "Réintégration impossible." }, 500);
    await admin.from("bannissements").update({ leve_le: new Date().toISOString(), leve_par: moi })
      .eq("user_id", cible).is("leve_le", null);
    await admin.from("journal_activite").insert({ acteur: moi, action: "levee_bannissement", table_cible: "profils", ligne_cible: cible });
    return reponse(req, { ok: true });
  }

  const motif = String(corps.motif || "").trim().slice(0, 300);
  if (motif.length < 3) return reponse(req, { ok: false, message: "Indiquez le motif." });
  const jours = Math.max(0, Math.min(3650, Math.floor(Number(corps.jours) || 0)));   // 0 = définitif
  const { error } = await admin.auth.admin.updateUserById(cible, { ban_duration: jours ? jours * 24 + "h" : "876000h" });
  if (error) return reponse(req, { ok: false, message: "Bannissement impossible." }, 500);

  const { data: profil } = await admin.from("profils").select("nom, telephone").eq("id", cible).maybeSingle();
  await admin.from("bannissements").update({ leve_le: new Date().toISOString(), leve_par: moi })
    .eq("user_id", cible).is("leve_le", null);
  await admin.from("bannissements").insert({
    user_id: cible, telephone: profil?.telephone || null, nom: profil?.nom || null, motif,
    jusqu_au: jours ? new Date(Date.now() + jours * 86400000).toISOString() : null, par: moi,
  });
  await admin.from("push_abonnements").update({ actif: false }).eq("user_id", cible);
  await admin.from("journal_activite").insert({ acteur: moi, action: "bannissement", table_cible: "profils", ligne_cible: cible, details: { motif, jours } });
  return reponse(req, { ok: true });
});
