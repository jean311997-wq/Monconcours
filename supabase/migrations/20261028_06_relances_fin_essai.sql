-- Fin de l'essai gratuit : une alerte à J-2, J-1, le jour même, dans les dernières heures, puis après l'expiration.
-- Une seule fois chacune (clé d'unicité), entre 7 h et 21 h (heure du Burkina = UTC), jamais pour l'équipe.
create or replace function public.preparer_relances_fin_essai()
returns void language plpgsql security definer set search_path to 'public', 'securite' as $f$
declare
  v_h int := extract(hour from now() at time zone 'UTC')::int;
  r record; v_cle text; v_titre text; v_msg text;
begin
  if v_h < 7 or v_h >= 21 then return; end if;
  if securite.mode_gratuit() then return; end if;
  for r in
    select a.user_id, a.fin_le,
           (a.fin_le at time zone 'UTC')::date - (now() at time zone 'UTC')::date as delta
      from public.abonnements a
     where a.formule = 'essai' and a.annule_le is null
       and a.fin_le > now() - interval '1 day' and a.fin_le <= now() + interval '3 days'
       and a.fin_le = (select max(b.fin_le) from public.abonnements b where b.user_id = a.user_id and b.annule_le is null)
       and not exists (select 1 from public.roles_utilisateur ru where ru.user_id = a.user_id)
  loop
    v_cle := null;
    if r.fin_le <= now() then
      v_cle := 'essai-fini';
      v_titre := 'Votre essai gratuit est terminé';
      v_msg := 'Vous gardez 10 corrections par jour et 3 compositions. Faites l''abonnement pour retrouver l''accès complet, sans limite.';
    elsif r.fin_le <= now() + interval '3 hours' then
      v_cle := 'essai-h3';
      v_titre := 'Plus que quelques heures d''essai';
      v_msg := 'Votre accès complet se termine très bientôt. Faites l''abonnement pour garder corrections et compositions illimitées.';
    elsif r.delta = 0 then
      v_cle := 'essai-j0';
      v_titre := 'Votre essai gratuit expire aujourd''hui';
      v_msg := 'Ce soir, votre accès complet s''arrête. Faites l''abonnement maintenant pour continuer sans limite.';
    elsif r.delta = 1 then
      v_cle := 'essai-j1';
      v_titre := 'Votre essai gratuit expire demain';
      v_msg := 'Demain, corrections et compositions repassent en mode limité. Gardez tout avec un abonnement dès 1 000 FCFA.';
    elsif r.delta = 2 then
      v_cle := 'essai-j2';
      v_titre := 'Votre essai gratuit se termine dans 2 jours';
      v_msg := 'Ensuite, l''abonnement gratuit garde 10 corrections par jour et 3 compositions. Faites l''abonnement pour tout garder, sans limite.';
    end if;
    if v_cle is not null then
      perform public.notifier(r.user_id, 'abonnement', v_titre, v_msg, v_cle, 'abonnement:essai', true);
    end if;
  end loop;
end $f$;

-- branché sur le passage du cron (chaque minute), avant les relances d'abonnement existantes
create or replace function public.preparer_relances_abonnement()
 returns void language plpgsql security definer set search_path to 'public', 'securite' as $function$
declare
  v_h int := extract(hour from now() at time zone 'UTC')::int;
  r record; v_pas int; v_msg text;
  v_pas_min int[] := array[30, 60, 120, 300, 1440];
begin
  perform public.preparer_relances_fin_essai();
  if v_h < 7 or v_h >= 21 then return; end if;
  for r in
    select p.id, floor(extract(epoch from now() - p.cree_le) / 60)::int as minutes
      from public.profils p
     where p.cree_le > now() - interval '60 days'
       and not securite.est_abonne(p.id)
       and not exists (select 1 from public.roles_utilisateur ru where ru.user_id = p.id)
  loop
    select max(x) into v_pas from (
      select unnest(v_pas_min) as x
      union all select 1440 * g from generate_series(2, 60) g) t
     where x <= r.minutes;
    continue when v_pas is null;
    v_msg := case when v_pas < 1440
      then 'Faites votre abonnement pour profiter de tout, sans limite. Choisissez l''abonnement qui vous convient.'
      else 'Votre préparation vous attend. Faites votre abonnement pour réviser et composer sans limite.' end;
    perform public.notifier(r.id, 'abonnement', 'Profitez de tout, sans limite', v_msg, 'abo-' || v_pas, 'abonnement', true);
  end loop;
end $function$;
