-- Bilan de la semaine : intervalle explicite (« Du lundi 2 au dimanche 8 novembre »)
-- + envoi unique, demain matin, du bilan de la semaine du 2 au 8 novembre (hors heures de pointe).

create or replace function public.libelle_semaine(p_debut date, p_fin date)
returns text language sql immutable set search_path = public, pg_temp as $f$
  select 'Du lundi ' || extract(day from p_debut)::int
      || case when extract(month from p_debut) <> extract(month from p_fin)
              then ' ' || (array['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'])[extract(month from p_debut)::int]
              else '' end
      || ' au dimanche ' || extract(day from p_fin)::int || ' '
      || (array['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'])[extract(month from p_fin)::int]
$f$;

-- Envoi du bilan d'une semaine précise (lundi p_debut → dimanche p_fin inclus), une seule fois par candidat.
create or replace function public.bilan_semaine_pour(p_debut date, p_fin date)
returns integer language plpgsql security definer set search_path = public, pg_temp as $f$
declare v_n int := 0; r record; v_cle text := 'bilan-semaine-' || to_char(p_debut,'YYYY-MM-DD'); v_msg text; v_mv text;
        d0 timestamptz := p_debut::timestamptz; d1 timestamptz := (p_fin + 1)::timestamptz; v_lib text := public.libelle_semaine(p_debut, p_fin);
begin
  for r in
    with pts as (
      select user_id,
             sum(points) filter (where cree_le < d1) tot,
             sum(points) filter (where cree_le < d0) av,
             count(distinct (cree_le at time zone 'UTC')::date) filter (where cree_le >= d0 and cree_le < d1) jours,
             count(*) filter (where motif='erreur_refermee' and cree_le >= d0 and cree_le < d1) refermees,
             count(distinct reference) filter (where motif='composition' and cree_le >= d0 and cree_le < d1) compos,
             count(*) filter (where cree_le >= d0 and cree_le < d1) mouvements
        from public.points_journal where cree_le < d1 group by user_id),
    tous as (select p.id user_id, coalesce(x.tot,0) tot, coalesce(x.av,0) av, coalesce(x.jours,0) jours, coalesce(x.refermees,0) refermees,
                    coalesce(x.compos,0) compos, coalesce(x.mouvements,0) mouvements
               from public.profils p left join pts x on x.user_id = p.id),
    rg as (select *, rank() over (order by tot desc) rang, rank() over (order by av desc) rang_av, count(*) over () pop from tous),
    tq as (select user_id, count(*) n, count(*) filter (where correcte) ok from public.tentatives_question where cree_le >= d0 and cree_le < d1 group by user_id)
    select rg.*, coalesce(tq.n,0) n, coalesce(tq.ok,0) ok from rg left join tq using (user_id)
     where rg.mouvements > 0
       and rg.user_id not in (select user_id from public.roles_utilisateur where role in ('admin','correcteur','investisseur'))
  loop
    v_mv := case when r.rang_av - r.rang > 0 then '▲ ' || (r.rang_av - r.rang) || ' place' || case when r.rang_av - r.rang > 1 then 's' else '' end
                 when r.rang_av - r.rang < 0 then '▼ ' || abs(r.rang_av - r.rang) || ' place' || case when abs(r.rang_av - r.rang) > 1 then 's' else '' end
                 else 'Stable' end;
    v_msg := 'Semaine|' || v_lib || E'\n' ||
             'Jours travaillés|' || r.jours || ' sur 7' || E'\n' ||
             'Questions faites|' || r.n || E'\n' ||
             'Bonnes réponses|' || case when r.n > 0 then round(100.0 * r.ok / r.n)::text || ' %' else '—' end || E'\n' ||
             'Erreurs refermées|' || r.refermees || E'\n' ||
             'Compositions|' || r.compos || E'\n' ||
             'Ta place|' || r.rang || 'ᵉ sur ' || r.pop || ' · ' || v_mv;
    perform public.notifier(r.user_id, 'annonce_plein', 'Ta semaine sur Mon Concours', v_msg, v_cle, 'bilan:semaine', true);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $f$;
revoke all on function public.bilan_semaine_pour(date, date) from public, anon, authenticated;

-- Le dimanche à 18 h : la semaine en cours, lundi → dimanche.
create or replace function public.bilan_semaine_envoyer()
returns integer language sql security definer set search_path = public, pg_temp as $f$
  select public.bilan_semaine_pour(current_date - 6, current_date)
$f$;
revoke all on function public.bilan_semaine_envoyer() from public, anon, authenticated;

-- Envoi unique : mercredi 12 novembre à 8 h 12, puis la tâche se supprime d'elle-même.
create or replace function public.bilan_semaine_unique_12nov()
returns void language plpgsql security definer set search_path = public, pg_temp as $f$
begin
  perform public.bilan_semaine_pour(date '2026-11-02', date '2026-11-08');
  perform cron.unschedule('bilan-semaine-2-8-nov');
end $f$;
revoke all on function public.bilan_semaine_unique_12nov() from public, anon, authenticated;
select cron.schedule('bilan-semaine-2-8-nov', '12 8 12 11 *', 'select public.bilan_semaine_unique_12nov()');
