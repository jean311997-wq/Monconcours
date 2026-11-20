create or replace function securite.swipe_ligue_recalculer() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from securite.swipe_ligue;
  insert into securite.swipe_ligue (user_id, pts, nom)
  select t.user_id, count(*) filter (where t.correcte)::int,
         coalesce(nullif(trim(p.pseudo), ''),
                  nullif(initcap(split_part(trim(coalesce(p.nom, '')), ' ', 1)) ||
                  case when split_part(trim(coalesce(p.nom, '')), ' ', 2) <> '' then ' ' || upper(left(split_part(trim(p.nom), ' ', 2), 1)) || '.' else '' end, ''),
                  'Candidat')
    from public.tentatives_question t
    join public.profils p on p.id = t.user_id
   where t.origine = 'swipe' and t.cree_le >= date_trunc('week', now())
     and not exists (select 1 from public.roles_utilisateur r where r.user_id = t.user_id and r.role in ('admin', 'investisseur'))
   group by t.user_id, p.pseudo, p.nom
  having count(*) filter (where t.correcte) > 0;
end $$;
select securite.swipe_ligue_recalculer();
