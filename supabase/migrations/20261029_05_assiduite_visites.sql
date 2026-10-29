-- 29 octobre 2026 : le classement d'assiduité et le compteur « venus une seule fois, jamais revenus »
-- se fondent sur tous les jours où le candidat est venu sur le site (visites + jours de travail),
-- et non plus seulement sur les jours où il a composé ou corrigé.
create or replace view public.jours_presence as
  select user_id, jour from public.assiduite
  union
  select user_id, debut_le::date from public.sessions where user_id is not null;
revoke all on public.jours_presence from public, anon, authenticated;

create or replace function public.admin_assiduite(p_tri text default 'serie', p_limite int default 50)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_lim int := least(greatest(coalesce(p_limite, 50), 1), 200); v_res jsonb;
begin
  if not securite.est_lecteur() then raise exception 'Réservé à l''équipe'; end if;
  with j as (
    select user_id, jour, jour - (row_number() over (partition by user_id order by jour))::int g from public.jours_presence),
  s as (select user_id, count(*) n, min(jour) deb, max(jour) fin from j group by user_id, g),
  r as (
    select user_id, sum(n)::int total, max(n)::int meilleure,
           coalesce(max(n) filter (where fin >= current_date - 1), 0)::int serie,
           max(fin) dernier, min(deb) premier
      from s where not exists (select 1 from public.roles_utilisateur ru where ru.user_id = s.user_id and ru.role in ('admin', 'investisseur', 'correcteur'))
      group by user_id)
  select coalesce(jsonb_agg(jsonb_build_object(
      'rang', z.rang, 'user_id', z.user_id, 'nom', coalesce(nullif(trim(p.nom), ''), 'Sans nom'),
      'telephone', public.tel_visible(p.telephone),
      'serie', z.serie, 'meilleure', z.meilleure, 'total', z.total, 'dernier', z.dernier, 'premier', z.premier,
      'inscrit_le', p.cree_le) order by z.rang), '[]'::jsonb)
    into v_res
    from (select r.*, row_number() over (order by
                case when p_tri = 'total' then r.total when p_tri = 'meilleure' then r.meilleure else r.serie end desc,
                r.meilleure desc, r.total desc, r.dernier desc) rang
            from r) z
    join public.profils p on p.id = z.user_id
   where z.rang <= v_lim;
  return jsonb_build_object('ok', true, 'tri', p_tri, 'classement', v_res, 'resume', public.admin_assiduite_resume());
end $$;

create or replace function public.admin_assiduite_resume()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not securite.est_lecteur() then raise exception 'Réservé à l''équipe'; end if;
  return jsonb_build_object(
    'inscrits', (select count(*) from public.profils p where not exists (select 1 from public.roles_utilisateur ru where ru.user_id = p.id and ru.role in ('admin', 'investisseur', 'correcteur'))),
    'jamais_revenus', (select count(*) from (select user_id from public.jours_presence j
                         where not exists (select 1 from public.roles_utilisateur ru where ru.user_id = j.user_id and ru.role in ('admin', 'investisseur', 'correcteur'))
                         group by user_id having count(*) = 1 and max(jour) < current_date) z),
    'revenus', (select count(*) from (select user_id from public.jours_presence j
                         where not exists (select 1 from public.roles_utilisateur ru where ru.user_id = j.user_id and ru.role in ('admin', 'investisseur', 'correcteur'))
                         group by user_id having count(*) >= 2) z),
    'sans_activite', (select count(*) from public.profils p where not exists (select 1 from public.jours_presence a where a.user_id = p.id)
                         and not exists (select 1 from public.roles_utilisateur ru where ru.user_id = p.id and ru.role in ('admin', 'investisseur', 'correcteur'))),
    'serie_3', (select count(*) from (select user_id from public.jours_presence where jour >= current_date - 2 group by user_id having count(*) = 3) z),
    'actifs_aujourdhui', (select count(*) from public.jours_presence where jour = current_date));
end $$;

revoke all on function public.admin_assiduite(text, int), public.admin_assiduite_resume() from public, anon;
grant execute on function public.admin_assiduite(text, int), public.admin_assiduite_resume() to authenticated;
