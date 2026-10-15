// Suppression du compte par le candidat lui-même (exigence du Play Store).
// Le candidat doit être connecté ET retaper son code secret : quelqu'un qui
// tient un téléphone déjà connecté ne peut pas effacer le compte d'un autre.
// Seul le compte de l'appelant peut être effacé, jamais un autre.
import { createClient } from "npm:@supabase/supabase-js@2";

const URL_BASE = Deno.env.get("SUPABASE_URL")!;
const CLE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const admin = createClient(URL_BASE, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
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

  // 1. qui appelle ?
  const jeton = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: qui, error: errQui } = await admin.auth.getUser(jeton);
  if (errQui || !qui?.user) return reponse(req, { ok: false, message: "Connectez-vous d'abord." }, 401);
  const id = qui.user.id;

  // 2. le code secret, vérifié par le service de connexion lui-même
  let code = "";
  try { code = String((await req.json())?.code || "").replace(/\D/g, ""); } catch (_) { /* corps vide */ }
  const { data: profil } = await admin.from("profils").select("telephone").eq("id", id).maybeSingle();
  const tel = profil?.telephone || "";
  if (code.length !== 4 || !tel) return reponse(req, { ok: false, message: "Code secret incorrect." });

  const verif = createClient(URL_BASE, CLE_ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: essai, error: errEssai } = await verif.auth.signInWithPassword({
    email: tel + "@candidat.monconcours.bf", password: tel + "#" + code,
  });
  if (errEssai || essai?.user?.id !== id) {
    await admin.from("tentatives_connexion").insert({ telephone: tel, reussie: false });
    return reponse(req, { ok: false, message: "Code secret incorrect." });
  }
  try { await verif.auth.signOut(); } catch (_) { /* rien */ }

  // 3. ce qui n'est pas relié au compte par une clé (le reste part avec lui)
  const { data: defis } = await admin.from("defis").select("id").eq("auteur", id);
  const mesDefis = (defis || []).map((d: { id: string }) => d.id);
  if (mesDefis.length) {
    await admin.from("defis_invitations").delete().in("defi_id", mesDefis);
    await admin.from("defis_scores").delete().in("defi_id", mesDefis);
  }
  const nettoyages: [string, string, string][] = [
    ["defis_scores", "user_id", id], ["defis_invitations", "invite", id], ["defis", "auteur", id],
    ["inscriptions_epreuve", "user_id", id], ["lectures", "user_id", id], ["push_file", "user_id", id],
    ["push_abonnements", "user_id", id], ["reponses_question_jour", "user_id", id],
    ["reactions_epreuve", "auteur", id], ["signalements", "user_id", id],
    ["tentatives_connexion", "telephone", tel], ["tentatives_reinit", "telephone", tel],
  ];
  for (const [table, colonne, valeur] of nettoyages) {
    await admin.from(table).delete().eq(colonne, valeur);
  }

  // 4. le compte lui-même : profil, compositions, erreurs, points, notifications…
  const { error: errSuppr } = await admin.auth.admin.deleteUser(id);
  if (errSuppr) return reponse(req, { ok: false, message: "La suppression n'a pas pu se faire." }, 500);

  await admin.from("journal_activite").insert({ acteur: null, action: "suppression_compte", table_cible: "profils" });
  return reponse(req, { ok: true });
});
