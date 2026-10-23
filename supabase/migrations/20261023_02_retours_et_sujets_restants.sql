-- Rappels de retour (une seule notification par jour et par candidat, jamais la nuit)
-- et nombre de sujets de composition qu'il reste à faire.

create or replace function public.mes_sujets_restants() returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare v_user uuid := auth.uid(); v_niveau public.niveau_scolaire; v_total int; v_faits int; v_moy numeric;
begin
  if v_user is null then return jsonb_build_object('ok', false); end if;
  select niveau into v_niveau from public.profils where id = v_user;
  select count(*) into v_total from public.sujets s
   where s.statut = 'publie' and (s.niveau = v_niveau or s.niveau is null)
     and exists (select 1 from public.sujet_questions sq where sq.sujet_id = s.id);
  select count(distinct c.sujet_id) into v_faits from public.compositions c where c.user_id = v_user and c.sujet_id is not null;
  return jsonb_build_object('ok', true, 'total', v_total, 'faits', v_faits, 'restants', greatest(0, v_total - v_faits));
end $$;
revoke all on function public.mes_sujets_restants() from public, anon;
grant execute on function public.mes_sujets_restants() to authenticated;

create or replace function public.preparer_relances_retour() returns void
language plpgsql security definer set search_path to 'public' as $$
declare v_h int := extract(hour from now() at time zone 'UTC')::int; u record; v_serie int;
begin
  if v_h < 15 or v_h >= 19 then return; end if;
  for u in
    select p.id,
           (select count(*) from public.erreurs_utilisateur e where e.user_id = p.id and not e.acquise) erreurs,
           (select max(t.cree_le) from public.tentatives_question t where t.user_id = p.id) derniere
      from public.profils p
     where exists (select 1 from public.tentatives_question t where t.user_id = p.id and t.cree_le > now() - interval '14 days')
       and not exists (select 1 from public.tentatives_question t where t.user_id = p.id and t.cree_le >= date_trunc('day', now()))
       and not exists (select 1 from public.notifications n where n.user_id = p.id and n.cle_unicite = 'retour-' || current_date::text)
  loop
    select count(*) into v_serie from (
      select jour, row_number() over (order by jour desc) rn from public.assiduite
       where user_id = u.id and compose and jour < current_date) s where s.jour = current_date - s.rn::int;
    if u.erreurs >= 5 then
      perform public.notifier(u.id, 'rappel', 'Vos dernières fautes vous attendent',
        'Dix minutes pour vous entraîner sur vos 10 dernières fautes, et elles ne reviendront plus.',
        'retour-' || current_date::text, 'fautes:10', true);
    elsif v_serie >= 2 then
      perform public.notifier(u.id, 'rappel', 'Votre série de ' || v_serie || ' jours est en danger',
        'Une seule question suffit pour la garder aujourd''hui.',
        'retour-' || current_date::text, 'reprendre:qcm', true);
    elsif u.derniere < now() - interval '2 days' then
      perform public.notifier(u.id, 'rappel', 'On ne vous voit plus',
        'Le concours approche. Dix questions aujourd''hui, et vous reprenez le rythme.',
        'retour-' || current_date::text, 'reprendre:qcm', true);
    end if;
  end loop;
end $$;
revoke all on function public.preparer_relances_retour() from public, anon, authenticated;
