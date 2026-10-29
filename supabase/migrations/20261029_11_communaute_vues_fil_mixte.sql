-- 29 octobre 2026 : compteur de vues sur les publications + fil mélangé
-- (un seul message de l'équipe en haut, puis l'équipe revient environ un message sur trois).
alter table public.communaute_publications add column if not exists nb_vues integer not null default 0;

create table if not exists public.communaute_vues (
  publication_id uuid not null references public.communaute_publications(id) on delete cascade,
  user_id uuid not null,
  vu_le timestamptz not null default now(),
  primary key (publication_id, user_id));
alter table public.communaute_vues enable row level security;
revoke all on public.communaute_vues from public, anon, authenticated;

create or replace function public.communaute_vu(p_ids uuid[])
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then return jsonb_build_object('ok', false); end if;
  with ins as (
    insert into public.communaute_vues (publication_id, user_id)
    select p.id, v_user from public.communaute_publications p
     where p.id = any (p_ids[1:30]) and not p.cache
    on conflict do nothing returning publication_id)
  update public.communaute_publications q set nb_vues = q.nb_vues + 1 where q.id in (select publication_id from ins);
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.communaute_vu(uuid[]) from public, anon;
grant execute on function public.communaute_vu(uuid[]) to authenticated;

create or replace function securite.comm_json(p_id uuid, v_user uuid)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'id', p.id, 'type', p.type, 'texte', p.texte, 'image', p.image_chemin, 'carte', p.carte,
    'epingle', p.epingle, 'cache', p.cache, 'coeurs', p.nb_coeurs, 'comms', p.nb_comm, 'vues', p.nb_vues, 'cree_le', p.cree_le,
    'admin', p.auteur is null,
    'nom', securite.comm_nom(p.auteur),
    'teinte', case when p.auteur is null then null else securite.comm_teinte(p.auteur) end,
    'concours', (select coalesce(c.sigle, c.nom) from public.concours c where c.id = p.concours_id),
    'moi', (p.auteur is not null and p.auteur = v_user),
    'aime', exists (select 1 from public.communaute_coeurs k where k.publication_id = p.id and k.user_id = v_user))
  from public.communaute_publications p where p.id = p_id;
$$;

create or replace function public.communaute_fil(p_filtre text default 'tout', p_avant timestamptz default null, p_limite integer default 15)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_user uuid := auth.uid(); v_conc uuid; v_lim int := least(greatest(coalesce(p_limite, 15), 1), 30); v_equipe boolean;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'message', 'Connexion requise.'); end if;
  select concours_id into v_conc from public.profils where id = v_user;
  v_equipe := securite.est_lecteur();
  return jsonb_build_object('ok', true,
    'membres', (select count(*) from public.profils),
    'blocage', securite.comm_blocage(v_user),
    'publications', coalesce((
      with base as (
        select p.id, p.cree_le, p.epingle, (p.auteur is null) adm
          from public.communaute_publications p
         where (not p.cache or v_equipe)
           and (p_avant is null or p.cree_le < p_avant)
           and case p_filtre
                 when 'concours' then p.auteur is not null and p.concours_id is not distinct from v_conc
                 when 'admin' then p.auteur is null
                 when 'moi' then p.auteur = v_user
                 else true end
         order by case when p_avant is null and p.epingle then 0 else 1 end, p.cree_le desc
         limit v_lim),
      rk as (select b.*, row_number() over (partition by b.adm order by b.epingle desc, b.cree_le desc) rg from base b),
      haut as (select id from rk where adm and p_avant is null order by epingle desc, cree_le desc limit 1)
      select jsonb_agg(securite.comm_json(z.id, v_user) order by z.ord, z.k)
        from (select r.id,
                     case when r.id in (select id from haut) then 0 else 1 end ord,
                     (r.rg - 1) * case when r.adm then 3.0 else 1.0 end
                       + (abs(hashtext(r.id::text || to_char(now(), 'YYYYMMDDHH24'))) % 100) / 100.0 * 1.6 k
                from rk r) z), '[]'::jsonb));
end $$;
