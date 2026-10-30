-- 30 octobre 2026 : l'investisseur a exactement les droits de l'administrateur, et intervient dans la
-- communauté sous le nom « Administrateur 2 » (depuis son compte 73 76 73 97 sur le site, ou depuis l'administration).

create or replace function securite.est_proprietaire() returns boolean language sql stable security definer set search_path to 'public','pg_temp' as $$
  select exists (select 1 from public.roles_utilisateur where user_id = auth.uid() and role in ('admin','investisseur'));
$$;

-- signatures de l'équipe dans la communauté
create table if not exists public.communaute_signatures (user_id uuid primary key references auth.users(id) on delete cascade, nom text not null, cree_le timestamptz not null default now());
alter table public.communaute_signatures enable row level security;
revoke all on public.communaute_signatures from public, anon, authenticated;
insert into public.communaute_signatures (user_id, nom) values
 ('4b465d65-305e-4464-9d07-887315557d1a', 'Administrateur 2'),
 ('db17ce0c-bba3-493e-b045-8750dd12a6dc', 'Administrateur 2'),
 ('6be7b464-7b0a-4aaa-9659-2e180c895a26', 'Administration Mon Concours')
on conflict (user_id) do update set nom = excluded.nom;

-- le compte du site 73 76 73 97 reçoit le rôle investisseur (mêmes droits partout)
insert into public.roles_utilisateur (user_id, role)
select '4b465d65-305e-4464-9d07-887315557d1a', 'investisseur'
where not exists (select 1 from public.roles_utilisateur where user_id = '4b465d65-305e-4464-9d07-887315557d1a' and role = 'investisseur');

create or replace function securite.comm_est_adm(u uuid) returns boolean language sql stable security definer set search_path to 'public' as $$
  select u is null or exists (select 1 from public.communaute_signatures s where s.user_id = u);
$$;

create or replace function securite.comm_nom(u uuid) returns text language sql stable security definer set search_path to 'public' as $$
  select case when u is null then 'Administration Mon Concours'
              else coalesce((select s.nom from public.communaute_signatures s where s.user_id = u), public.nom_public(u)) end;
$$;

create or replace function securite.comm_json(p_id uuid, v_user uuid)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'id', p.id, 'type', p.type, 'texte', p.texte, 'image', p.image_chemin, 'carte', p.carte,
    'epingle', p.epingle, 'cache', p.cache, 'coeurs', p.nb_coeurs, 'comms', p.nb_comm, 'vues', p.nb_vues, 'cree_le', p.cree_le,
    'admin', securite.comm_est_adm(p.auteur),
    'nom', securite.comm_nom(p.auteur),
    'teinte', case when securite.comm_est_adm(p.auteur) then null else securite.comm_teinte(p.auteur) end,
    'concours', case when securite.comm_est_adm(p.auteur) then null else (select coalesce(c.sigle, c.nom) from public.concours c where c.id = p.concours_id) end,
    'moi', (p.auteur is not null and p.auteur = v_user),
    'aime', exists (select 1 from public.communaute_coeurs k where k.publication_id = p.id and k.user_id = v_user))
  from public.communaute_publications p where p.id = p_id;
$$;

create or replace function securite.comm_com_json(p_id uuid, v_user uuid)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'id', c.id, 'texte', c.texte, 'cree_le', c.cree_le, 'parent_id', c.parent_id,
    'parent_nom', (select securite.comm_nom(pc.auteur) from public.communaute_commentaires pc where pc.id = c.parent_id),
    'admin', securite.comm_est_adm(c.auteur),
    'nom', securite.comm_nom(c.auteur),
    'teinte', case when securite.comm_est_adm(c.auteur) then null else securite.comm_teinte(c.auteur) end,
    'moi', (c.auteur is not null and c.auteur = v_user))
  from public.communaute_commentaires c where c.id = p_id;
$$;

-- l'équipe n'entre pas dans le classement des contributeurs
create or replace function securite.comm_points(p_debut timestamptz, p_fin timestamptz)
returns table(user_id uuid, pts bigint) language sql stable security definer set search_path to 'public' as $$
  select t.u, sum(t.p)::bigint from (
    select auteur u, 3 p from public.communaute_publications where auteur is not null and not cache and cree_le >= p_debut and cree_le < p_fin
    union all select auteur, 1 from public.communaute_commentaires where auteur is not null and not cache and cree_le >= p_debut and cree_le < p_fin
    union all select p.auteur, 1 from public.communaute_coeurs k join public.communaute_publications p on p.id = k.publication_id
      where p.auteur is not null and k.user_id <> p.auteur and k.cree_le >= p_debut and k.cree_le < p_fin
    union all select p.auteur, 1 from public.communaute_commentaires c join public.communaute_publications p on p.id = c.publication_id
      where p.auteur is not null and c.auteur is distinct from p.auteur and c.cree_le >= p_debut and c.cree_le < p_fin
  ) t
  where t.u is not null
    and not securite.comm_est_adm(t.u)
    and not exists (select 1 from public.communaute_muets m where m.user_id = t.u and (m.jusqu_au is null or m.jusqu_au > now()))
  group by t.u having sum(t.p) > 0;
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
        select p.id, p.cree_le, p.epingle, securite.comm_est_adm(p.auteur) adm
          from public.communaute_publications p
         where (not p.cache or v_equipe)
           and (p_avant is null or p.cree_le < p_avant)
           and case p_filtre
                 when 'concours' then not securite.comm_est_adm(p.auteur) and p.concours_id is not distinct from v_conc
                 when 'admin' then securite.comm_est_adm(p.auteur)
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

-- publier depuis le site : l'équipe signée publie sans limite de fréquence et sans concours
create or replace function public.communaute_publier(p_texte text default '', p_image text default null, p_carte jsonb default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_user uuid := auth.uid(); v_txt text; v_bloc text; v_id uuid; v_carte jsonb; v_img text; v_conc uuid; v_type text; v_adm boolean;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'message', 'Connexion requise.'); end if;
  v_adm := securite.comm_est_adm(v_user);
  if not v_adm then
    v_bloc := securite.comm_blocage(v_user);
    if v_bloc is not null then return jsonb_build_object('ok', false, 'message', v_bloc); end if;
    if (select count(*) from public.communaute_publications where auteur = v_user and cree_le > now() - interval '1 hour') >= 6 then
      return jsonb_build_object('ok', false, 'message', 'Vous avez beaucoup publié : réessayez dans un moment.');
    end if;
  end if;
  v_txt := case when v_adm then left(btrim(coalesce(p_texte, '')), 1500) else securite.comm_nettoyer(left(btrim(coalesce(p_texte, '')), 1000)) end;
  v_img := nullif(btrim(coalesce(p_image, '')), '');
  if v_img is not null and v_img !~ ('^' || v_user::text || '/[A-Za-z0-9._-]{1,100}$') then
    return jsonb_build_object('ok', false, 'message', 'Cette photo n''a pas pu être ajoutée.');
  end if;
  v_carte := securite.comm_carte(p_carte);
  if v_txt = '' and v_img is null and v_carte is null then return jsonb_build_object('ok', false, 'message', 'Écrivez quelque chose avant de publier.'); end if;
  if v_txt <> '' and exists (select 1 from public.communaute_publications where auteur = v_user and texte = v_txt and cree_le > now() - interval '15 minutes') then
    return jsonb_build_object('ok', false, 'message', 'Vous avez déjà publié ce message.');
  end if;
  if not v_adm then select concours_id into v_conc from public.profils where id = v_user; end if;
  v_type := case when v_img is not null then 'photo' when v_carte is not null then 'progres' when v_adm then 'annonce' else 'texte' end;
  insert into public.communaute_publications (auteur, type, texte, image_chemin, carte, concours_id)
  values (v_user, v_type, v_txt, v_img, v_carte, v_conc) returning id into v_id;
  return jsonb_build_object('ok', true, 'publication', securite.comm_json(v_id, v_user));
end $$;

create or replace function public.communaute_commenter(p_pub uuid, p_texte text, p_parent uuid default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_user uuid := auth.uid(); v_txt text; v_bloc text; v_id uuid; v_auteur uuid; v_nom text; v_parent_auteur uuid; v_push boolean; v_adm boolean;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'message', 'Connexion requise.'); end if;
  v_adm := securite.comm_est_adm(v_user);
  if not v_adm then
    v_bloc := securite.comm_blocage(v_user);
    if v_bloc is not null then return jsonb_build_object('ok', false, 'message', v_bloc); end if;
  end if;
  select auteur into v_auteur from public.communaute_publications where id = p_pub and (not cache or v_adm);
  if not found then return jsonb_build_object('ok', false, 'message', 'Cette publication n''existe plus.'); end if;
  v_txt := case when v_adm then left(btrim(coalesce(p_texte, '')), 1000) else securite.comm_nettoyer(left(btrim(coalesce(p_texte, '')), 500)) end;
  if v_txt = '' then return jsonb_build_object('ok', false, 'message', 'Écrivez votre commentaire.'); end if;
  if not v_adm and (select count(*) from public.communaute_commentaires where auteur = v_user and cree_le > now() - interval '1 hour') >= 40 then
    return jsonb_build_object('ok', false, 'message', 'Vous avez beaucoup commenté : réessayez dans un moment.');
  end if;
  if p_parent is not null then
    select auteur into v_parent_auteur from public.communaute_commentaires where id = p_parent and publication_id = p_pub;
    if not found then p_parent := null; end if;
  end if;
  insert into public.communaute_commentaires (publication_id, auteur, parent_id, texte) values (p_pub, v_user, p_parent, v_txt) returning id into v_id;
  v_nom := securite.comm_nom(v_user);
  if v_auteur is not null and v_auteur <> v_user then
    select not exists (select 1 from public.notifications where user_id = v_auteur and type = 'communaute' and lien = 'communaute:' || p_pub and not lue and cree_le > now() - interval '1 hour') into v_push;
    perform public.notifier(v_auteur, 'communaute', v_nom || ' a commenté votre publication', left(v_txt, 140), 'comm-c-' || v_id, 'communaute:' || p_pub, v_push);
  end if;
  if v_parent_auteur is not null and v_parent_auteur <> v_user and v_parent_auteur is distinct from v_auteur then
    perform public.notifier(v_parent_auteur, 'communaute', v_nom || ' a répondu à votre commentaire', left(v_txt, 140), 'comm-r-' || v_id, 'communaute:' || p_pub, true);
  end if;
  return jsonb_build_object('ok', true, 'commentaire', securite.comm_com_json(v_id, v_user),
    'comms', (select nb_comm from public.communaute_publications where id = p_pub));
end $$;

-- les notifications de cœurs et les publications de l'administration prennent la signature de l'équipe
do $do$
declare d text;
begin
  d := pg_get_functiondef('public.communaute_aimer(uuid)'::regprocedure);
  d := replace(d, 'v_nom := public.nom_public(v_user);', 'v_nom := securite.comm_nom(v_user);');
  execute d;
  d := pg_get_functiondef('public.admin_communaute_action(text,uuid,uuid,integer,text,text,text,boolean,boolean,text)'::regprocedure);
  d := replace(d, 'values (null, ''annonce'', v_txt, v_img, coalesce(p_epingle, false))',
                  'values (case when securite.est_investisseur() then v_adm else null end, ''annonce'', v_txt, v_img, coalesce(p_epingle, false))');
  execute d;
end $do$;

-- l'équipe (administrateur et investisseur) peut supprimer n'importe quelle publication ou commentaire depuis le site
create or replace function public.communaute_supprimer(p_type text, p_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_user uuid := auth.uid(); v_equipe boolean := securite.est_admin();
begin
  if v_user is null then return jsonb_build_object('ok', false, 'message', 'Connexion requise.'); end if;
  if p_type = 'commentaire' then delete from public.communaute_commentaires where id = p_id and (auteur = v_user or v_equipe);
  else delete from public.communaute_publications where id = p_id and (auteur = v_user or v_equipe); end if;
  return jsonb_build_object('ok', found);
end $$;

do $do$
declare d text;
begin
  d := pg_get_functiondef('securite.comm_json(uuid,uuid)'::regprocedure);
  if d not like '%gerer%' then
    d := replace(d, '''moi'', (p.auteur is not null and p.auteur = v_user),', '''moi'', (p.auteur is not null and p.auteur = v_user), ''gerer'', securite.est_admin(),');
    execute d;
  end if;
  d := pg_get_functiondef('securite.comm_com_json(uuid,uuid)'::regprocedure);
  if d not like '%gerer%' then
    d := replace(d, '''moi'', (c.auteur is not null and c.auteur = v_user))', '''moi'', (c.auteur is not null and c.auteur = v_user), ''gerer'', securite.est_admin())');
    execute d;
  end if;
end $do$;

-- Données (30/10/2026) : SOMDA Michaël, 4 paiements activés en double (3 × 4 000 F + 1 × 1 000 F) passés en « refusé »
-- avec le motif « Doublon activé par erreur » ; seul le paiement Année 4 000 F du 24/10/2026 reste confirmé.
-- Son abonnement Année finit le 24/10/2027 (et non plus en 2030).
