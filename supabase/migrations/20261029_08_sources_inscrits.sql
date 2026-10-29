-- Source de chaque inscription : l'origine de la première visite liée au compte.
create or replace function public.sources_inscrits(p_du date, p_au date) returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not securite.est_lecteur() then raise exception 'Réservé à l''équipe'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('nom', z.src, 'inscrits', z.n, 'revenus', z.rv) order by z.n desc) from (
    select coalesce(f.source, 'inconnue') src, count(*) n,
           count(*) filter (where exists (select 1 from public.jours_presence j where j.user_id = p.id and j.jour > p.cree_le::date)) rv
      from public.profils p
      left join lateral (select s.source from public.sessions s where s.user_id = p.id order by s.debut_le limit 1) f on true
     where p.cree_le::date between p_du and p_au
       and not exists (select 1 from public.roles_utilisateur r where r.user_id = p.id and r.role in ('admin','correcteur','investisseur'))
     group by 1) z), '[]'::jsonb);
end $$;
revoke all on function public.sources_inscrits(date, date) from public, anon;
grant execute on function public.sources_inscrits(date, date) to authenticated;
