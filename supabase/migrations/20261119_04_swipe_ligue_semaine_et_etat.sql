-- Ligue de la semaine du Swipe : bonnes réponses en Swipe depuis lundi, recalculées toutes les 10 min (hors composition)
create table if not exists securite.swipe_ligue (
  user_id uuid primary key,
  pts int not null,
  nom text not null,
  maj_le timestamptz not null default now()
);
revoke all on securite.swipe_ligue from public, anon, authenticated;

create or replace function securite.swipe_ligue_recalculer() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from securite.swipe_ligue;
  insert into securite.swipe_ligue (user_id, pts, nom)
  select t.user_id, count(*) filter (where t.correcte)::int,
         coalesce(nullif(trim(p.pseudo), ''),
                  initcap(split_part(trim(coalesce(p.nom, '')), ' ', 1)) ||
                  case when split_part(trim(coalesce(p.nom, '')), ' ', 2) <> '' then ' ' || upper(left(split_part(trim(p.nom), ' ', 2), 1)) || '.' else '' end,
                  'Candidat')
    from public.tentatives_question t
    join public.profils p on p.id = t.user_id
   where t.origine = 'swipe' and t.cree_le >= date_trunc('week', now())
     and not exists (select 1 from public.roles_utilisateur r where r.user_id = t.user_id)
   group by t.user_id, p.pseudo, p.nom
  having count(*) filter (where t.correcte) > 0;
end $$;

create or replace function public.swipe_ligue() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_liste jsonb; v_moi int; v_total int;
begin
  if v_user is null then return jsonb_build_object('ok', false); end if;
  select count(*) into v_total from securite.swipe_ligue;
  select coalesce(pts, 0) into v_moi from securite.swipe_ligue where user_id = v_user;
  select coalesce(jsonb_agg(jsonb_build_object('nom', l.nom, 'pts', l.pts, 'moi', l.user_id = v_user) order by l.pts desc, l.nom), '[]'::jsonb)
    into v_liste
    from (select * from securite.swipe_ligue order by pts desc limit 300) l;
  return jsonb_build_object('ok', true, 'total', v_total, 'moi', coalesce(v_moi, 0),
    'debut', date_trunc('week', now()), 'liste', v_liste,
    'maj', (select max(maj_le) from securite.swipe_ligue));
end $$;
revoke all on function public.swipe_ligue() from public, anon;
grant execute on function public.swipe_ligue() to authenticated;

select securite.swipe_ligue_recalculer();
select cron.schedule('swipe-ligue', '*/10 * * * *',
  $c$do $$ begin if not public.fenetre_composition() then perform securite.swipe_ligue_recalculer(); end if; end $$;$c$);
