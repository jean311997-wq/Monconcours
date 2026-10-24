-- 24 octobre 2026
-- 1. Essai gratuit : 10 corrections par jour, 3 compositions offertes.
-- 2. Relances d'abonnement par notification : 30 min, 1 h, 2 h, 5 h, 24 h, puis chaque jour.

do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p
   where p.proname = 'corriger_question' and p.pronamespace = 'public'::regnamespace;
  d := replace(d, 'v_faites >= 20', 'v_faites >= 10');
  d := replace(d, 'vos 20 corrections gratuites', 'vos 10 corrections gratuites');
  d := replace(d, 'v_restant := 20 - v_faites - 1', 'v_restant := 10 - v_faites - 1');
  execute d;

  select pg_get_functiondef(p.oid) into d from pg_proc p
   where p.proname = 'ouvrir_composition' and p.pronamespace = 'public'::regnamespace;
  d := replace(d, 'v_deja >= 2', 'v_deja >= 3');
  d := replace(d, 'Vos 2 compositions offertes', 'Vos 3 compositions offertes');
  execute d;
end $$;

create or replace function public.preparer_relances_abonnement() returns void
language plpgsql security definer set search_path = public, securite as $$
declare
  v_h int := extract(hour from now() at time zone 'UTC')::int;
  r record; v_pas int; v_msg text;
  v_pas_min int[] := array[30, 60, 120, 300, 1440];
begin
  if v_h < 7 or v_h >= 21 then return; end if;
  for r in
    select p.id, floor(extract(epoch from now() - p.cree_le) / 60)::int as minutes
      from public.profils p
     where p.cree_le > now() - interval '60 days'
       and not securite.est_abonne(p.id)
       and not exists (select 1 from public.roles_utilisateur ru where ru.user_id = p.id)
  loop
    -- l'étape la plus récente atteinte : 30 min, 1 h, 2 h, 5 h, 24 h, puis un jour de plus à chaque fois
    select max(x) into v_pas from (
      select unnest(v_pas_min) as x
      union all select 1440 * g from generate_series(2, 60) g) t
     where x <= r.minutes;
    continue when v_pas is null;
    v_msg := case when v_pas < 1440
      then 'Faites votre abonnement pour profiter de tout, sans limite. Choisissez le Pass qui vous convient.'
      else 'Votre préparation vous attend. Faites votre abonnement pour réviser et composer sans limite.' end;
    perform public.notifier(r.id, 'abonnement', 'Profitez de tout, sans limite', v_msg, 'abo-' || v_pas, 'abonnement', true);
  end loop;
end $$;
revoke all on function public.preparer_relances_abonnement() from public, anon, authenticated;

do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p
   where p.proname = 'envois_a_faire' and p.pronamespace = 'public'::regnamespace;
  if position('preparer_relances_abonnement' in d) = 0 then
    d := replace(d, 'perform public.preparer_relances_retour();',
                    E'perform public.preparer_relances_retour();\n  perform public.preparer_relances_abonnement();');
    execute d;
  end if;
end $$;
