-- 8 novembre 2026 — Les relances d'abonnement n'atteignaient personne.
-- Tous les comptes ont une ligne dans roles_utilisateur (rôle « candidat »).
-- Quatre fonctions écartaient « tout compte ayant un rôle », donc tout le monde :
--  preparer_relances_abonnement, preparer_relances_fin_essai,
--  admin_paiements_abandonnes (liste WhatsApp du dashboard, toujours vide), admin_comparatif_offre.
-- Correction : on n'écarte que l'équipe (admin, correcteur, investisseur).
-- Les relances d'abonnement partent par paquets de 30 par passage (10 min), les plus récents d'abord.

create or replace function public.preparer_relances_abonnement()
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'securite'
as $function$
declare
  v_h int := extract(hour from now() at time zone 'UTC')::int;
  r record; v_msg text;
begin
  perform public.preparer_relances_fin_essai();
  if v_h < 7 or v_h >= 21 then return; end if;
  for r in
    with c as (
      select p.id, floor(extract(epoch from now() - p.cree_le) / 60)::int as minutes
        from public.profils p
       where p.cree_le > now() - interval '60 days'
         and not exists (select 1 from public.roles_utilisateur ru where ru.user_id = p.id and ru.role in ('admin','correcteur','investisseur'))
    ), s as (
      select id, minutes, case when minutes < 30 then null
                      when minutes < 60 then 30
                      when minutes < 120 then 60
                      when minutes < 300 then 120
                      when minutes < 1440 then 300
                      else 1440 * least(floor(minutes / 1440.0)::int, 60) end as pas
        from c
    )
    select s.id, s.pas from s
     where s.pas is not null
       and not exists (select 1 from public.notifications n where n.user_id = s.id and n.cle_unicite = 'abo-' || s.pas)
       and not securite.est_abonne(s.id)
     order by s.minutes
     limit 30
  loop
    v_msg := case when r.pas < 1440
      then 'Faites votre abonnement pour profiter de tout, sans limite. Choisissez l''abonnement qui vous convient.'
      else 'Votre préparation vous attend. Faites votre abonnement pour réviser et composer sans limite.' end;
    perform public.notifier(r.id, 'abonnement', 'Profitez de tout, sans limite', v_msg, 'abo-' || r.pas, 'abonnement', true);
  end loop;
end $function$;

create or replace function public.preparer_relances_fin_essai()
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'securite'
as $function$
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
       and not exists (select 1 from public.roles_utilisateur ru where ru.user_id = a.user_id and ru.role in ('admin','correcteur','investisseur'))
     limit 60
  loop
    v_cle := null;
    if r.fin_le <= now() then
      v_cle := 'essai-fini';
      v_titre := 'Votre essai gratuit est terminé';
      v_msg := 'Vous gardez 5 corrections par jour et 4 compositions. Faites l''abonnement pour retrouver l''accès complet, sans limite.';
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
      v_msg := 'Ensuite, l''abonnement gratuit garde 5 corrections par jour et 4 compositions. Faites l''abonnement pour tout garder, sans limite.';
    end if;
    if v_cle is not null then
      perform public.notifier(r.user_id, 'abonnement', v_titre, v_msg, v_cle, 'abonnement:essai', true);
    end if;
  end loop;
end $function$;

create or replace function public.admin_paiements_abandonnes()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_res jsonb;
begin
  if not exists (select 1 from roles_utilisateur where user_id = auth.uid() and role in ('admin','investisseur')) then
    return jsonb_build_object('ok', false, 'message', 'Réservé à l''administrateur.');
  end if;
  select coalesce(jsonb_agg(x order by x.derniere desc nulls last), '[]'::jsonb) into v_res from (
    select p.id as user_id, p.nom, p.telephone, (select c.nom from concours c where c.id = p.concours_id) as concours,
      (select e.meta->>'formule' from evenements e where e.user_id = p.id and e.nom in ('PAYMENT_STARTED','SUBSCRIPTION_PLAN_SELECTED') and e.meta ? 'formule' order by e.cree_le desc limit 1) as formule,
      (select max(s.debut_le) from sessions s where s.user_id = p.id) as derniere,
      (select r.envoye_le from relances_whatsapp r where r.user_id = p.id) as envoye_le
    from profils p
    where p.telephone is not null
      and p.id not in (select user_id from roles_utilisateur where role in ('admin','correcteur','investisseur'))
      and exists (select 1 from evenements e where e.user_id = p.id and e.nom = 'PAYMENT_STARTED')
      and not exists (select 1 from paiements x where x.user_id = p.id and x.statut in ('confirme','en_attente'))
      and not exists (select 1 from abonnements a where a.user_id = p.id and a.fin_le > now() and a.annule_le is null and a.formule <> 'essai')
  ) x;
  return jsonb_build_object('ok', true, 'liste', v_res);
end $function$;

create or replace function public.admin_comparatif_offre()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not exists (select 1 from roles_utilisateur where user_id = auth.uid() and role in ('admin','investisseur')) then
    return jsonb_build_object('ok', false, 'message', 'Réservé à l''administrateur.');
  end if;
  return jsonb_build_object('ok', true, 'lignes', coalesce((select jsonb_agg(x) from (
    select case p.variante_offre when 'B' then 'Version B test (3 + 1 avec notifications)' else 'Version A (4 offertes)' end as version,
      count(*) as comptes,
      count(*) filter (where exists (select 1 from push_abonnements a where a.user_id = p.id and a.actif)) as avec_notifications,
      count(*) filter (where (select count(*) from compositions c where c.user_id = p.id and c.nb_traitees >= 10) >= 3) as ont_fait_3_compos,
      count(*) filter (where exists (select 1 from paiements q where q.user_id = p.id and q.statut = 'confirme')) as payeurs
    from profils p where p.cree_le >= timestamptz '2026-11-05 20:00+00' and p.id not in (select user_id from roles_utilisateur where role in ('admin','correcteur','investisseur'))
    group by 1) x), '[]'::jsonb));
end $function$;
