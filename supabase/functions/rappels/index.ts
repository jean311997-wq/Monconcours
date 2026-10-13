// Envoie les rappels du jour et l'annonce des compositions collectives.
// Appelée toutes les 15 minutes par pg_cron, avec un secret partagé
// rangé dans le coffre de la base (vault). Rien d'autre ne la déclenche.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const base = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

Deno.serve(async (req: Request) => {
  const { data: cles, error } = await base.rpc("cles_push");
  if (error || !cles?.prive || !cles?.cron) {
    return new Response("configuration absente", { status: 500 });
  }
  if (req.headers.get("x-cron") !== cles.cron) {
    return new Response("interdit", { status: 403 });
  }

  webpush.setVapidDetails("https://monconcours.vercel.app", cles.public, cles.prive);

  const { data: envois } = await base.rpc("envois_a_faire");
  let ok = 0, expires = 0, echecs = 0;
  for (const e of (envois ?? []) as Array<Record<string, string>>) {
    try {
      await webpush.sendNotification(
        { endpoint: e.endpoint, keys: { p256dh: e.p256dh, auth: e.auth } },
        JSON.stringify({ titre: e.titre, message: e.message, lien: e.lien }),
        { TTL: 3600 },
      );
      ok++;
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) {
        await base.rpc("rappel_expire", { p_endpoint: e.endpoint });
        expires++;
      } else echecs++;
    }
  }
  return new Response(JSON.stringify({ ok, expires, echecs }), {
    headers: { "Content-Type": "application/json" },
  });
});
