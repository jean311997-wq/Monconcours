-- Communauté Mon Concours : fil de publications, cœurs, commentaires, meilleurs contributeurs,
-- publications automatiques de « Administration Mon Concours », modération par l'équipe.
-- Tout passe par des fonctions : les tables ne sont lisibles ni écrivables directement.

create table if not exists public.communaute_publications (
  id uuid primary key default gen_random_uuid(),
  auteur uuid references auth.users(id) on delete cascade,          -- vide = Administration Mon Concours
  type text not null default 'texte' check (type in ('texte','photo','progres','annonce','nouveaute','motivation','classement','bilan','epreuve')),
  texte text not null default '' check (char_length(texte) <= 1500),
  image_chemin text,
  carte jsonb,
  concours_id uuid references public.concours(id) on delete set null,
  epingle boolean not null default false,
  cache boolean not null default false,
  nb_coeurs int not null default 0,
  nb_comm int not null default 0,
  cle_auto text unique,
  cree_le timestamptz not null default clock_timestamp(),
  check (char_length(btrim(texte)) > 0 or image_chemin is not null or carte is not null)
);
create index if not exists communaute_pub_date on public.communaute_publications (cree_le desc);
create index if not exists communaute_pub_auteur on public.communaute_publications (auteur, cree_le desc);

create table if not exists public.communaute_commentaires (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.communaute_publications(id) on delete cascade,
  auteur uuid references auth.users(id) on delete cascade,
  parent_id uuid references public.communaute_commentaires(id) on delete cascade,
  texte text not null check (char_length(btrim(texte)) between 1 and 500),
  cache boolean not null default false,
  cree_le timestamptz not null default clock_timestamp()
);
create index if not exists communaute_com_pub on public.communaute_commentaires (publication_id, cree_le);
create index if not exists communaute_com_auteur on public.communaute_commentaires (auteur, cree_le desc);

create table if not exists public.communaute_coeurs (
  publication_id uuid not null references public.communaute_publications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  cree_le timestamptz not null default clock_timestamp(),
  primary key (publication_id, user_id)
);
create index if not exists communaute_coeurs_user on public.communaute_coeurs (user_id, cree_le desc);

create table if not exists public.communaute_muets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  jusqu_au timestamptz,
  motif text,
  par uuid,
  cree_le timestamptz not null default now()
);

alter table public.communaute_publications enable row level security;
alter table public.communaute_commentaires enable row level security;
alter table public.communaute_coeurs enable row level security;
alter table public.communaute_muets enable row level security;
revoke all on table public.communaute_publications, public.communaute_commentaires, public.communaute_coeurs, public.communaute_muets from public, anon, authenticated;

/* ---------- petits outils ---------- */
create or replace function securite.comm_teinte(u uuid) returns int language sql immutable as $$
  select (('x' || substr(md5(u::text), 1, 6))::bit(24)::int % 360);
$$;

create or replace function securite.comm_nom(u uuid) returns text language sql stable security definer set search_path to 'public' as $$
  select case when u is null then 'Administration Mon Concours' else public.nom_public(u) end;
$$;

/* les numéros de téléphone et les liens extérieurs n'apparaissent jamais dans un texte de candidat */
create or replace function securite.comm_nettoyer(t text) returns text language sql immutable as $$
  select btrim(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(coalesce(t, ''),
    '(\+|00)\s?226[\s.\-]?\d([\s.\-]?\d){7}', '•• •• •• ••', 'g'),
    '\y(\d{2}[\s.\-]){3}\d{2}\y', '•• •• •• ••', 'g'),
    '\y\d{8}\y', '•• •• •• ••', 'g'),
    '((https?://)(www\.)?|www\.)(?!monconcoursbf\.com)\S+', '[lien retiré]', 'g'),
    '(wa\.me|chat\.whatsapp\.com)/\S+', '[lien retiré]', 'g'));
$$;

create or replace function securite.comm_num(t text) returns int language sql immutable as $$
  select case when t ~ '^\d{1,7}$' then t::int end;
$$;

/* la carte jointe à une publication : seulement des chiffres et deux ou trois mots, jamais du code */
create or replace function securite.comm_carte(c jsonb) returns jsonb language sql immutable as $$
  select case
    when c is null or jsonb_typeof(c) <> 'object' then null
    when c->>'kind' = 'progres' then jsonb_strip_nulls(jsonb_build_object('kind', 'progres',
      'questions', securite.comm_num(c->>'questions'), 'compositions', securite.comm_num(c->>'compositions'),
      'taux', least(securite.comm_num(c->>'taux'), 100), 'serie', securite.comm_num(c->>'serie'),
      'niveau', nullif(left(regexp_replace(coalesce(c->>'niveau', ''), '[^[:alnum:] éèêëàâîïôöûüçÉÈÀÂÎÔÛÇ''\-]', '', 'g'), 30), '')))
    when c->>'kind' = 'resultat' then jsonb_strip_nulls(jsonb_build_object('kind', 'resultat',
      'note', securite.comm_num(c->>'note'), 'sur', securite.comm_num(c->>'sur'),
      'titre', nullif(left(regexp_replace(coalesce(c->>'titre', ''), '[^[:alnum:] éèêëàâîïôöûüçÉÈÀÂÎÔÛÇ''\-·:]', '', 'g'), 80), '')))
    else null end;
$$;

create or replace function securite.comm_blocage(u uuid) returns text language sql stable security definer set search_path to 'public' as $$
  select case
    when exists (select 1 from public.communaute_muets m where m.user_id = u and (m.jusqu_au is null or m.jusqu_au > now()))
      then 'L''équipe a suspendu votre droit d''écrire dans la communauté.'
    when exists (select 1 from public.bannissements b where b.user_id = u and b.leve_le is null and (b.jusqu_au is null or b.jusqu_au > now()))
      then 'Votre compte est suspendu.'
    else null end;
$$;

create or replace function securite.comm_json(p_id uuid, v_user uuid) returns jsonb language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'id', p.id, 'type', p.type, 'texte', p.texte, 'image', p.image_chemin, 'carte', p.carte,
    'epingle', p.epingle, 'cache', p.cache, 'coeurs', p.nb_coeurs, 'comms', p.nb_comm, 'cree_le', p.cree_le,
    'admin', p.auteur is null,
    'nom', securite.comm_nom(p.auteur),
    'teinte', case when p.auteur is null then null else securite.comm_teinte(p.auteur) end,
    'concours', (select coalesce(c.sigle, c.nom) from public.concours c where c.id = p.concours_id),
    'moi', (p.auteur is not null and p.auteur = v_user),
    'aime', exists (select 1 from public.communaute_coeurs k where k.publication_id = p.id and k.user_id = v_user))
  from public.communaute_publications p where p.id = p_id;
$$;

create or replace function securite.comm_com_json(p_id uuid, v_user uuid) returns jsonb language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'id', c.id, 'texte', c.texte, 'cree_le', c.cree_le, 'parent_id', c.parent_id,
    'parent_nom', (select securite.comm_nom(pc.auteur) from public.communaute_commentaires pc where pc.id = c.parent_id),
    'admin', c.auteur is null,
    'nom', securite.comm_nom(c.auteur),
    'teinte', case when c.auteur is null then null else securite.comm_teinte(c.auteur) end,
    'moi', (c.auteur is not null and c.auteur = v_user))
  from public.communaute_commentaires c where c.id = p_id;
$$;

create or replace function securite.comm_points(p_debut timestamptz, p_fin timestamptz) returns table(user_id uuid, pts bigint)
language sql stable security definer set search_path to 'public' as $$
  select t.u, sum(t.p)::bigint from (
    select auteur u, 3 p from public.communaute_publications where auteur is not null and not cache and cree_le >= p_debut and cree_le < p_fin
    union all select auteur, 1 from public.communaute_commentaires where auteur is not null and not cache and cree_le >= p_debut and cree_le < p_fin
    union all select p.auteur, 1 from public.communaute_coeurs k join public.communaute_publications p on p.id = k.publication_id
      where p.auteur is not null and k.user_id <> p.auteur and k.cree_le >= p_debut and k.cree_le < p_fin
    union all select p.auteur, 1 from public.communaute_commentaires c join public.communaute_publications p on p.id = c.publication_id
      where p.auteur is not null and c.auteur is distinct from p.auteur and c.cree_le >= p_debut and c.cree_le < p_fin
  ) t
  where t.u is not null and not exists (select 1 from public.communaute_muets m where m.user_id = t.u and (m.jusqu_au is null or m.jusqu_au > now()))
  group by t.u having sum(t.p) > 0;
$$;

create or replace function securite.comm_jour_fr(ts timestamptz) returns text language sql immutable as $$
  select (array['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'])[extract(dow from ts at time zone 'UTC')::int + 1]
    || ' ' || extract(day from ts at time zone 'UTC')::int || ' '
    || (array['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'])[extract(month from ts at time zone 'UTC')::int];
$$;

create or replace function securite.comm_liste_noms(n text[]) returns text language sql immutable as $$
  select case coalesce(array_length(n, 1), 0)
    when 0 then '' when 1 then n[1]
    else array_to_string(n[1:array_length(n, 1) - 1], ', ') || ' et ' || n[array_length(n, 1)] end;
$$;

/* compteurs tenus à jour */
create or replace function securite.comm_coeurs_maj() returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if tg_op = 'INSERT' then update public.communaute_publications set nb_coeurs = nb_coeurs + 1 where id = new.publication_id;
  else update public.communaute_publications set nb_coeurs = greatest(nb_coeurs - 1, 0) where id = old.publication_id; end if;
  return null;
end $$;
drop trigger if exists trg_comm_coeurs on public.communaute_coeurs;
create trigger trg_comm_coeurs after insert or delete on public.communaute_coeurs for each row execute function securite.comm_coeurs_maj();

create or replace function securite.comm_com_maj() returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if tg_op = 'INSERT' then update public.communaute_publications set nb_comm = nb_comm + 1 where id = new.publication_id;
  else update public.communaute_publications set nb_comm = greatest(nb_comm - 1, 0) where id = old.publication_id; end if;
  return null;
end $$;
drop trigger if exists trg_comm_com on public.communaute_commentaires;
create trigger trg_comm_com after insert or delete on public.communaute_commentaires for each row execute function securite.comm_com_maj();

/* ---------- lecture ---------- */
create or replace function public.communaute_info(p_depuis timestamptz default null)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then return jsonb_build_object('ok', false); end if;
  return jsonb_build_object('ok', true,
    'membres', (select count(*) from public.profils),
    'aujourdhui', (select count(*) from public.communaute_publications where not cache and cree_le >= date_trunc('day', now())),
    'nouveaux', case when p_depuis is null then null else
        (select count(*) from public.communaute_publications where not cache and cree_le > p_depuis and auteur is distinct from v_user) end,
    'blocage', securite.comm_blocage(v_user));
end $$;

create or replace function public.communaute_fil(p_filtre text default 'tout', p_avant timestamptz default null, p_limite int default 15)
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
      select jsonb_agg(securite.comm_json(z.id, v_user) order by z.ord, z.cree_le desc)
        from (select p.id, p.cree_le, case when p_avant is null and p.epingle then 0 else 1 end ord
                from public.communaute_publications p
               where (not p.cache or v_equipe)
                 and (p_avant is null or p.cree_le < p_avant)
                 and case p_filtre
                       when 'concours' then p.auteur is not null and p.concours_id is not distinct from v_conc
                       when 'admin' then p.auteur is null
                       when 'moi' then p.auteur = v_user
                       else true end
               order by case when p_avant is null and p.epingle then 0 else 1 end, p.cree_le desc
               limit v_lim) z), '[]'::jsonb));
end $$;

create or replace function public.communaute_publication(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then return jsonb_build_object('ok', false, 'message', 'Connexion requise.'); end if;
  if not exists (select 1 from public.communaute_publications where id = p_id and (not cache or securite.est_lecteur())) then
    return jsonb_build_object('ok', false, 'message', 'Cette publication n''existe plus.');
  end if;
  return jsonb_build_object('ok', true, 'publication', securite.comm_json(p_id, v_user));
end $$;

create or replace function public.communaute_commentaires(p_pub uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then return jsonb_build_object('ok', false, 'message', 'Connexion requise.'); end if;
  return jsonb_build_object('ok', true, 'commentaires', coalesce((
    select jsonb_agg(securite.comm_com_json(z.id, v_user) order by z.cree_le)
      from (select c.id, c.cree_le from public.communaute_commentaires c where c.publication_id = p_pub and not c.cache order by c.cree_le limit 200) z), '[]'::jsonb));
end $$;

create or replace function public.communaute_top(p_periode text default 'semaine')
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_user uuid := auth.uid(); v_debut timestamptz;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'message', 'Connexion requise.'); end if;
  v_debut := case when p_periode = 'total' then '2020-01-01'::timestamptz else date_trunc('week', now()) end;
  return (with r as (
      select s.user_id, s.pts, rank() over (order by s.pts desc) rang from securite.comm_points(v_debut, now() + interval '1 minute') s)
    select jsonb_build_object('ok', true, 'periode', case when p_periode = 'total' then 'total' else 'semaine' end, 'depuis', v_debut,
      'top', coalesce((select jsonb_agg(jsonb_build_object('rang', z.rang, 'nom', public.nom_public(z.user_id), 'points', z.pts,
                  'teinte', securite.comm_teinte(z.user_id), 'moi', z.user_id = v_user,
                  'concours', (select coalesce(c.sigle, c.nom) from public.profils pr join public.concours c on c.id = pr.concours_id where pr.id = z.user_id)) order by z.rang, z.pts desc)
                 from (select * from r order by rang limit 10) z), '[]'::jsonb),
      'moi', (select jsonb_build_object('rang', rang, 'points', pts) from r where user_id = v_user),
      'participants', (select count(*) from r)));
end $$;

/* ---------- écriture ---------- */
create or replace function public.communaute_publier(p_texte text default '', p_image text default null, p_carte jsonb default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_user uuid := auth.uid(); v_txt text; v_bloc text; v_id uuid; v_carte jsonb; v_img text; v_conc uuid; v_type text;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'message', 'Connexion requise.'); end if;
  v_bloc := securite.comm_blocage(v_user);
  if v_bloc is not null then return jsonb_build_object('ok', false, 'message', v_bloc); end if;
  if (select count(*) from public.communaute_publications where auteur = v_user and cree_le > now() - interval '1 hour') >= 6 then
    return jsonb_build_object('ok', false, 'message', 'Vous avez beaucoup publié : réessayez dans un moment.');
  end if;
  v_txt := securite.comm_nettoyer(left(btrim(coalesce(p_texte, '')), 1000));
  v_img := nullif(btrim(coalesce(p_image, '')), '');
  if v_img is not null and v_img !~ ('^' || v_user::text || '/[A-Za-z0-9._-]{1,100}$') then
    return jsonb_build_object('ok', false, 'message', 'Cette photo n''a pas pu être ajoutée.');
  end if;
  v_carte := securite.comm_carte(p_carte);
  if v_txt = '' and v_img is null and v_carte is null then return jsonb_build_object('ok', false, 'message', 'Écrivez quelque chose avant de publier.'); end if;
  if v_txt <> '' and exists (select 1 from public.communaute_publications where auteur = v_user and texte = v_txt and cree_le > now() - interval '15 minutes') then
    return jsonb_build_object('ok', false, 'message', 'Vous avez déjà publié ce message.');
  end if;
  select concours_id into v_conc from public.profils where id = v_user;
  v_type := case when v_img is not null then 'photo' when v_carte is not null then 'progres' else 'texte' end;
  insert into public.communaute_publications (auteur, type, texte, image_chemin, carte, concours_id)
  values (v_user, v_type, v_txt, v_img, v_carte, v_conc) returning id into v_id;
  return jsonb_build_object('ok', true, 'publication', securite.comm_json(v_id, v_user));
end $$;

create or replace function public.communaute_supprimer(p_type text, p_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then return jsonb_build_object('ok', false, 'message', 'Connexion requise.'); end if;
  if p_type = 'commentaire' then delete from public.communaute_commentaires where id = p_id and auteur = v_user;
  else delete from public.communaute_publications where id = p_id and auteur = v_user; end if;
  return jsonb_build_object('ok', found);
end $$;

create or replace function public.communaute_aimer(p_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_user uuid := auth.uid(); v_auteur uuid; v_aime boolean; v_n int; v_nom text; v_existe boolean; v_msg text;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'message', 'Connexion requise.'); end if;
  select auteur into v_auteur from public.communaute_publications where id = p_id and not cache;
  if not found then return jsonb_build_object('ok', false, 'message', 'Cette publication n''existe plus.'); end if;
  if exists (select 1 from public.communaute_coeurs where publication_id = p_id and user_id = v_user) then
    delete from public.communaute_coeurs where publication_id = p_id and user_id = v_user;
    v_aime := false;
  else
    if (select count(*) from public.communaute_coeurs where user_id = v_user and cree_le > now() - interval '1 hour') >= 200 then
      return jsonb_build_object('ok', false, 'message', 'Doucement : réessayez dans un moment.');
    end if;
    insert into public.communaute_coeurs (publication_id, user_id) values (p_id, v_user);
    v_aime := true;
    if v_auteur is not null and v_auteur <> v_user then
      select count(*) into v_n from public.communaute_coeurs where publication_id = p_id and user_id <> v_auteur;
      v_nom := public.nom_public(v_user);
      v_msg := case when v_n <= 1 then v_nom || ' a aimé votre publication.'
                    else v_nom || ' et ' || (v_n - 1) || case when v_n = 2 then ' autre personne ont aimé' else ' autres personnes ont aimé' end || ' votre publication.' end;
      select exists (select 1 from public.notifications where user_id = v_auteur and cle_unicite = 'comm-coeurs-' || p_id) into v_existe;
      insert into public.notifications (user_id, type, titre, message, cle_unicite, lien)
      values (v_auteur, 'communaute', 'Votre publication plaît', v_msg, 'comm-coeurs-' || p_id, 'communaute:' || p_id)
      on conflict (user_id, cle_unicite) where cle_unicite is not null
      do update set message = excluded.message, lue = false, masquee = false, cree_le = now();
      if not v_existe then
        insert into public.push_file (user_id, titre, message, lien) values (v_auteur, 'Votre publication plaît', v_msg, '/?communaute=' || p_id);
      end if;
    end if;
  end if;
  return jsonb_build_object('ok', true, 'aime', v_aime, 'coeurs', (select nb_coeurs from public.communaute_publications where id = p_id));
end $$;

create or replace function public.communaute_commenter(p_pub uuid, p_texte text, p_parent uuid default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_user uuid := auth.uid(); v_txt text; v_bloc text; v_id uuid; v_auteur uuid; v_nom text; v_parent_auteur uuid; v_push boolean;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'message', 'Connexion requise.'); end if;
  v_bloc := securite.comm_blocage(v_user);
  if v_bloc is not null then return jsonb_build_object('ok', false, 'message', v_bloc); end if;
  select auteur into v_auteur from public.communaute_publications where id = p_pub and not cache;
  if not found then return jsonb_build_object('ok', false, 'message', 'Cette publication n''existe plus.'); end if;
  v_txt := securite.comm_nettoyer(left(btrim(coalesce(p_texte, '')), 500));
  if v_txt = '' then return jsonb_build_object('ok', false, 'message', 'Écrivez votre commentaire.'); end if;
  if (select count(*) from public.communaute_commentaires where auteur = v_user and cree_le > now() - interval '1 hour') >= 40 then
    return jsonb_build_object('ok', false, 'message', 'Vous avez beaucoup commenté : réessayez dans un moment.');
  end if;
  if p_parent is not null then
    select auteur into v_parent_auteur from public.communaute_commentaires where id = p_parent and publication_id = p_pub;
    if not found then p_parent := null; end if;
  end if;
  insert into public.communaute_commentaires (publication_id, auteur, parent_id, texte) values (p_pub, v_user, p_parent, v_txt) returning id into v_id;
  v_nom := public.nom_public(v_user);
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

/* ---------- équipe : lire et modérer ---------- */
create or replace function public.admin_communaute_liste(p_avant timestamptz default null, p_limite int default 30, p_user uuid default null)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_lim int := least(greatest(coalesce(p_limite, 30), 1), 60);
begin
  if not securite.est_lecteur() then raise exception 'Réservé à l''équipe'; end if;
  return jsonb_build_object('ok', true,
    'resume', case when p_avant is not null then null else jsonb_build_object(
      'publications', (select count(*) from public.communaute_publications),
      'aujourdhui', (select count(*) from public.communaute_publications where cree_le >= date_trunc('day', now())),
      'commentaires', (select count(*) from public.communaute_commentaires),
      'coeurs', (select count(*) from public.communaute_coeurs),
      'auteurs_7j', (select count(distinct auteur) from public.communaute_publications where auteur is not null and cree_le >= now() - interval '7 days'),
      'masquees', (select count(*) from public.communaute_publications where cache),
      'muets', (select count(*) from public.communaute_muets where jusqu_au is null or jusqu_au > now())) end,
    'publications', coalesce((
      select jsonb_agg(securite.comm_json(z.id, auth.uid()) || jsonb_build_object('auteur_id', z.auteur, 'nom_compte', z.nom, 'telephone', public.tel_visible(z.tel),
               'muet', exists (select 1 from public.communaute_muets m where m.user_id = z.auteur and (m.jusqu_au is null or m.jusqu_au > now()))) order by z.cree_le desc)
        from (select p.id, p.cree_le, p.auteur, pr.nom, pr.telephone tel from public.communaute_publications p left join public.profils pr on pr.id = p.auteur
               where (p_avant is null or p.cree_le < p_avant) and (p_user is null or p.auteur = p_user)
               order by p.cree_le desc limit v_lim) z), '[]'::jsonb));
end $$;

create or replace function public.admin_communaute_muets()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not securite.est_lecteur() then raise exception 'Réservé à l''équipe'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'nom', pr.nom, 'telephone', public.tel_visible(pr.telephone),
           'jusqu_au', m.jusqu_au, 'motif', m.motif, 'cree_le', m.cree_le) order by m.cree_le desc)
      from public.communaute_muets m left join public.profils pr on pr.id = m.user_id where m.jusqu_au is null or m.jusqu_au > now()), '[]'::jsonb);
end $$;

create or replace function public.admin_communaute_action(
  p_action text, p_id uuid default null, p_user uuid default null, p_jours int default null,
  p_texte text default null, p_titre text default null, p_image text default null,
  p_epingle boolean default false, p_notifier boolean default false, p_motif text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_adm uuid := auth.uid(); v_id uuid; v_n int := 0; r record; v_txt text; v_titre text; v_img text;
begin
  if not securite.est_admin() then return jsonb_build_object('ok', false, 'message', 'Réservé à l''administration.'); end if;
  if p_action = 'epingler' then update public.communaute_publications set epingle = true where id = p_id;
  elsif p_action = 'desepingler' then update public.communaute_publications set epingle = false where id = p_id;
  elsif p_action = 'cacher' then update public.communaute_publications set cache = true where id = p_id;
  elsif p_action = 'montrer' then update public.communaute_publications set cache = false where id = p_id;
  elsif p_action = 'supprimer' then delete from public.communaute_publications where id = p_id;
  elsif p_action = 'supprimer_commentaire' then delete from public.communaute_commentaires where id = p_id;
  elsif p_action = 'muet' then
    if p_user is null then return jsonb_build_object('ok', false, 'message', 'Personne choisie.'); end if;
    insert into public.communaute_muets (user_id, jusqu_au, motif, par)
    values (p_user, case when p_jours is null or p_jours <= 0 then null else now() + make_interval(days => p_jours) end, left(p_motif, 200), v_adm)
    on conflict (user_id) do update set jusqu_au = excluded.jusqu_au, motif = excluded.motif, par = excluded.par, cree_le = now();
  elsif p_action = 'parole' then delete from public.communaute_muets where user_id = p_user;
  elsif p_action = 'publier' then
    v_txt := btrim(coalesce(p_texte, ''));
    v_img := nullif(btrim(coalesce(p_image, '')), '');
    if v_img is not null and v_img !~ ('^' || v_adm::text || '/[A-Za-z0-9._-]{1,100}$') then return jsonb_build_object('ok', false, 'message', 'Photo refusée.'); end if;
    if v_txt = '' and v_img is null then return jsonb_build_object('ok', false, 'message', 'Écrivez le message.'); end if;
    if char_length(v_txt) > 1500 then return jsonb_build_object('ok', false, 'message', 'Message trop long (1 500 caractères au plus).'); end if;
    v_titre := btrim(coalesce(p_titre, ''));
    if p_notifier and (char_length(v_titre) < 3 or char_length(v_titre) > 80) then return jsonb_build_object('ok', false, 'message', 'Pour prévenir tout le monde, ajoutez un titre de 3 à 80 caractères.'); end if;
    insert into public.communaute_publications (auteur, type, texte, image_chemin, epingle) values (null, 'annonce', v_txt, v_img, coalesce(p_epingle, false)) returning id into v_id;
    if p_notifier then
      for r in select * from public.cible_diffusion('tous') as u(id) loop
        perform public.notifier(r.id, 'annonce_plein', v_titre, left(coalesce(nullif(v_txt, ''), v_titre), 600), 'comm-annonce-' || v_id, 'communaute:' || v_id, true);
        v_n := v_n + 1;
      end loop;
      insert into public.diffusions (titre, message, mode, cible, lien, push, destinataires, cree_par)
      values (v_titre, left(coalesce(nullif(v_txt, ''), v_titre), 600), 'les_deux', 'tous', 'communaute:' || v_id, true, v_n, v_adm);
    end if;
  else return jsonb_build_object('ok', false, 'message', 'Action inconnue.');
  end if;
  insert into public.journal_activite (acteur, action, table_cible, ligne_cible, details)
  values (v_adm, 'communaute_' || p_action, 'communaute_publications', coalesce(v_id, p_id), jsonb_build_object('user', p_user, 'jours', p_jours));
  return jsonb_build_object('ok', true, 'id', coalesce(v_id, p_id), 'destinataires', v_n);
end $$;

/* ---------- publications automatiques de « Administration Mon Concours » ---------- */
create or replace function public.communaute_auto_publier(p_forcer boolean default false)
returns int language plpgsql security definer set search_path to 'public' as $$
declare
  v_h int := extract(hour from now() at time zone 'UTC')::int; v_n int := 0; v_id uuid; r record; v_txt text; v_noms text[]; v_top jsonb;
  v_nb int; v_moy numeric; v_q int; v_cand int; v_comp int; v_sem timestamptz; v_ids uuid[]; v_titres text[];
  v_msgs text[] := array[
    'Un concours se gagne rarement la veille. Il se gagne sur les petites séances de chaque jour. Dix questions aujourd''hui, c''est déjà une avance.',
    'Une mauvaise note à l''entraînement ne coûte rien. Elle montre où travailler avant le vrai jour. Ouvrez « Mes erreurs » : c''est votre meilleur cours.',
    'Ceux qui réussissent ne sont pas toujours les plus doués. Ce sont souvent ceux qui reviennent le plus régulièrement. Revenez demain.',
    'Pas envie aujourd''hui ? Faites juste cinq questions. Cinq, pas plus. Très souvent, on continue.',
    'Écrivez ici votre objectif de la semaine. Le dire à d''autres aide à le tenir.',
    'Une erreur comprise aujourd''hui est un point gagné le jour du concours.',
    'Expliquez une leçon à voix haute, à un camarade ou même à un mur. On voit tout de suite ce qu''on n''a pas compris.',
    'La veille d''un concours, dormir vaut mieux qu''une heure de révision en plus. Couchez-vous à une heure normale.',
    'Ici, personne ne se moque d''une question. Si vous ne comprenez pas, quelqu''un d''autre se pose la même question.',
    'Commencez par la matière que vous aimez le moins, pendant que vous avez encore de l''énergie.',
    'Le calcul rapide s''apprend comme le football : un peu chaque jour, sans pression.',
    'L''actualité du matin prend cinq minutes à lire. Beaucoup de questions de culture générale en viennent.',
    'Peur de la composition ? C''est normal. Faites-la quand même : la première fois, tout le monde tremble.',
    'Choisissez un camarade et lancez-lui un défi ce soir. On retient mieux quand on a envie de gagner.',
    'Vos erreurs d''hier sont dans « Mes erreurs ». Dix minutes dessus valent plus qu''une nouvelle leçon.',
    'Pas de réseau ? Les cours téléchargés se lisent sans connexion. Préparez vos séances avant de sortir.',
    'Partagez ici ce que vous avez compris aujourd''hui. Expliquer une notion, c''est la retenir.',
    'Lisez toute la question avant de répondre. Beaucoup de points se perdent sur un mot qu''on n''a pas vu.',
    'Chaque soir, trois minutes pour noter ce que vous avez appris. Le lendemain, relisez ces notes avant de commencer.',
    'Une question vous bloque plus d''une minute ? Passez à la suivante et revenez-y à la fin.',
    'Un entraînement régulier vaut mieux qu''un gros effort une fois par mois.',
    'Fêtez les petites victoires : un chapitre fini, une série tenue, une erreur corrigée.',
    'Votre but n''est pas d''être parfait. C''est d''être meilleur que la semaine dernière.',
    'Alternez les matières : sciences, droit, culture générale. On retient mieux quand on change de sujet.',
    'Posez ici la question qui vous bloque. Quelqu''un a peut-être la réponse, et vous aiderez ceux qui n''osaient pas la poser.',
    'La veille d''un concours, on ne cherche plus à tout apprendre. On relit l''essentiel et on se repose.',
    'Pensez à ceux qui vous soutiennent. Faites-leur honneur par une séance aujourd''hui.',
    'Une série de plusieurs jours d''affilée se construit une séance à la fois. Gardez la vôtre.',
    'Racontez ici votre dernière séance : la matière, le score, ce qui vous a surpris.',
    'Bonne journée à tous les candidats. Une séance, même courte, et la journée est gagnée.'];
begin
  /* 1. mot de bienvenue, épinglé, une seule fois */
  begin
    insert into public.communaute_publications (auteur, type, texte, epingle, cle_auto) values (null, 'annonce',
      E'Bienvenue dans la communauté Mon Concours. Plus de 600 candidats s''y retrouvent pour s''entraider : posez vos questions, partagez vos progrès, encouragez les autres.\n\nNos deux règles : du respect pour chacun, et ni numéro de téléphone ni publicité. Les numéros sont masqués automatiquement.',
      true, 'bienvenue') on conflict (cle_auto) do nothing;
    if found then v_n := v_n + 1; end if;
  exception when others then null; end;

  /* 2. motivation du jour */
  begin
    if p_forcer or v_h >= 6 then
      insert into public.communaute_publications (auteur, type, texte, cle_auto)
      values (null, 'motivation', v_msgs[1 + (extract(doy from now())::int % array_length(v_msgs, 1))], 'motiv-' || to_char(now() at time zone 'UTC', 'YYYY-MM-DD'))
      on conflict (cle_auto) do nothing;
      if found then v_n := v_n + 1; end if;
    end if;
  exception when others then null; end;

  /* 3. bilan d'hier, avec les vrais chiffres */
  begin
    if p_forcer or v_h >= 8 then
      select count(distinct user_id), count(*) into v_cand, v_q from public.tentatives_question
       where user_id is not null and cree_le >= date_trunc('day', now()) - interval '1 day' and cree_le < date_trunc('day', now());
      select count(*) into v_comp from public.compositions where terminee and debut_le >= date_trunc('day', now()) - interval '1 day' and debut_le < date_trunc('day', now());
      if v_cand >= 5 then
        insert into public.communaute_publications (auteur, type, texte, carte, cle_auto) values (null, 'bilan',
          'Hier, ' || v_cand || ' candidats ont répondu à ' || replace(to_char(v_q, 'FM999,999,999'), ',', chr(160)) || ' questions' ||
            case when v_comp > 0 then ' et terminé ' || v_comp || case when v_comp = 1 then ' composition' else ' compositions' end else '' end ||
            '. Bravo à tous. On recommence aujourd''hui.',
          jsonb_build_object('kind', 'bilan', 'candidats', v_cand, 'questions', v_q, 'compositions', v_comp),
          'bilan-' || to_char(now() at time zone 'UTC' - interval '1 day', 'YYYY-MM-DD')) on conflict (cle_auto) do nothing;
        if found then v_n := v_n + 1; end if;
      end if;
    end if;
  exception when others then null; end;

  /* 4. nouveaux cours des dernières 24 heures */
  begin
    if p_forcer or v_h >= 9 then
      select array_agg(titre order by publie_le desc), count(*) into v_titres, v_nb from (
        select titre, publie_le from public.ressources where statut = 'publie' and type_ressource = 'cours' and publie_le >= now() - interval '24 hours' order by publie_le desc limit 40) t;
      if coalesce(v_nb, 0) > 0 then
        insert into public.communaute_publications (auteur, type, texte, carte, cle_auto) values (null, 'nouveaute',
          case when v_nb = 1 then 'Un nouveau cours vient d''être ajouté : ' else v_nb || ' nouveaux cours viennent d''être ajoutés, dont ' end ||
            securite.comm_liste_noms(v_titres[1:least(3, v_nb)]) || '. Ouvrez « Mes cours » pour les lire.',
          jsonb_build_object('kind', 'cours', 'n', v_nb), 'cours-' || to_char(now() at time zone 'UTC', 'YYYY-MM-DD')) on conflict (cle_auto) do nothing;
        if found then v_n := v_n + 1; end if;
      end if;
    end if;
  exception when others then null; end;

  /* 5. actualité du jour */
  begin
    if p_forcer or v_h >= 9 then
      select id, titre into r from public.actualites where statut = 'publie' and publie_le >= date_trunc('day', now()) order by publie_le desc limit 1;
      if found then
        insert into public.communaute_publications (auteur, type, texte, carte, cle_auto) values (null, 'nouveaute',
          'À la une aujourd''hui : ' || r.titre || '. Lisez l''actualité du matin, elle tombe souvent aux concours.',
          jsonb_build_object('kind', 'actualite'), 'actu-' || to_char(now() at time zone 'UTC', 'YYYY-MM-DD')) on conflict (cle_auto) do nothing;
        if found then v_n := v_n + 1; end if;
      end if;
    end if;
  exception when others then null; end;

  /* 6. la semaine dernière : meilleurs en points, meilleurs contributeurs (le lundi) */
  begin
    if (extract(dow from now() at time zone 'UTC') = 1 and v_h >= 8) then
      v_sem := date_trunc('week', now()) - interval '7 days';
      select jsonb_agg(jsonb_build_object('rang', rang, 'nom', nom, 'points', pts) order by rang, nom), array_agg(nom order by rang, nom)
        into v_top, v_noms from (
          select rank() over (order by s.pts desc) rang, public.nom_public(s.user_id) nom, s.pts
            from (select user_id, sum(points) pts from public.points_journal where cree_le >= v_sem and cree_le < v_sem + interval '7 days' group by user_id having sum(points) > 0) s
           order by 1 limit 3) t;
      if coalesce(jsonb_array_length(v_top), 0) >= 3 then
        insert into public.communaute_publications (auteur, type, texte, carte, cle_auto) values (null, 'classement',
          'La semaine dernière, ' || securite.comm_liste_noms(v_noms) || ' ont pris la tête du classement des points. Félicitations ! Cette semaine, la place est à prendre.',
          jsonb_build_object('kind', 'top', 'top', v_top), 'semaine-' || to_char(v_sem, 'YYYY-MM-DD')) on conflict (cle_auto) do nothing;
        if found then v_n := v_n + 1; end if;
      end if;
      select jsonb_agg(jsonb_build_object('rang', rang, 'nom', nom, 'points', pts) order by rang, nom), array_agg(nom order by rang, nom)
        into v_top, v_noms from (
          select rank() over (order by s.pts desc) rang, public.nom_public(s.user_id) nom, s.pts
            from securite.comm_points(v_sem, v_sem + interval '7 days') s order by 1 limit 3) t;
      if coalesce(jsonb_array_length(v_top), 0) >= 1 then
        insert into public.communaute_publications (auteur, type, texte, carte, cle_auto) values (null, 'classement',
          'Meilleurs contributeurs de la semaine : ' || securite.comm_liste_noms(v_noms) || '. Merci d''avoir fait vivre la communauté.',
          jsonb_build_object('kind', 'contributeurs', 'top', v_top), 'contrib-' || to_char(v_sem, 'YYYY-MM-DD')) on conflict (cle_auto) do nothing;
        if found then v_n := v_n + 1; end if;
      end if;
    end if;
  exception when others then null; end;

  /* 7. une composition nationale approche */
  begin
    for r in select e.* from public.epreuves_collectives e
              where e.statut = 'programmee' and e.debut_le > now() and e.debut_le <= now() + interval '26 hours'
                and not exists (select 1 from public.communaute_publications where cle_auto = 'avant-' || e.id) order by e.debut_le loop
      insert into public.communaute_publications (auteur, type, texte, carte, cle_auto) values (null, 'epreuve',
        case when (r.debut_le at time zone 'UTC')::date = (now() at time zone 'UTC')::date then 'Aujourd''hui'
             when (r.debut_le at time zone 'UTC')::date = (now() at time zone 'UTC')::date + 1 then 'Demain'
             else 'Le ' || securite.comm_jour_fr(r.debut_le) end
          || ' à ' || to_char(r.debut_le at time zone 'UTC', 'HH24') || ' h ' || to_char(r.debut_le at time zone 'UTC', 'MI') || ' (heure du Burkina) : « ' || r.titre || ' ». '
          || coalesce(r.places::text, '') || ' postes à pourvoir. Inscrivez-vous depuis l''onglet Actualité, puis venez dire ici que vous y serez.',
        jsonb_build_object('kind', 'epreuve', 'epreuve', r.id, 'debut', r.debut_le), 'avant-' || r.id) on conflict (cle_auto) do nothing;
      if found then v_n := v_n + 1; end if;
    end loop;
  exception when others then null; end;

  /* 8. résultats d'une composition nationale terminée */
  begin
    for r in select e.* from public.epreuves_collectives e
              where e.statut = 'programmee' and e.fin_le <= now() - interval '35 minutes' and e.fin_le > now() - interval '2 days'
                and not exists (select 1 from public.communaute_publications where cle_auto = 'resultats-' || e.id)
                and not exists (select 1 from public.compositions c where c.epreuve_id = e.id and not c.terminee and c.debut_le > now() - interval '45 minutes')
                and exists (select 1 from public.compositions c where c.epreuve_id = e.id and c.terminee) order by e.fin_le loop
      select count(*), round(avg(100.0 * score / nullif(nb_questions, 0)), 0) into v_nb, v_moy from public.compositions where epreuve_id = r.id and terminee;
      select jsonb_agg(jsonb_build_object('rang', rang, 'nom', nom, 'score', score, 'sur', nb_questions) order by rang, nom), array_agg(nom order by rang, nom) filter (where rang <= 3)
        into v_top, v_noms from (
          select public.nom_resultat(c.user_id, r.id) nom, c.score, c.nb_questions,
                 rank() over (order by c.score desc, c.duree_secondes asc nulls last) rang
            from public.compositions c where c.epreuve_id = r.id and c.terminee order by 4 limit 5) t;
      insert into public.communaute_publications (auteur, type, texte, carte, cle_auto, epingle) values (null, 'classement',
        'Les résultats de « ' || r.titre || ' » sont tombés. Félicitations à ' || securite.comm_liste_noms(v_noms) || case when array_length(v_noms, 1) = 1 then ' pour sa place en tête, et bravo aux ' else ' pour leur place sur le podium, et bravo aux ' end
          || v_nb || ' candidats qui sont allés au bout. Moyenne générale : ' || coalesce(v_moy::text, '0') || ' %. Le classement complet est ouvert à tous.',
        jsonb_build_object('kind', 'classement', 'epreuve', r.id, 'titre', r.titre, 'participants', v_nb, 'top', v_top),
        'resultats-' || r.id, true) on conflict (cle_auto) do nothing;
      if found then v_n := v_n + 1; end if;
    end loop;
  exception when others then null; end;

  return v_n;
end $$;

/* les résultats épinglés laissent la place au suivant au bout de trois jours */
create or replace function public.communaute_desepingler_anciens() returns void language sql security definer set search_path to 'public' as $$
  update public.communaute_publications set epingle = false
   where epingle and auteur is null and cle_auto like 'resultats-%' and cree_le < now() - interval '3 days';
$$;

/* ---------- droits ---------- */
revoke all on function public.communaute_info(timestamptz), public.communaute_fil(text, timestamptz, int), public.communaute_publication(uuid),
  public.communaute_commentaires(uuid), public.communaute_top(text), public.communaute_publier(text, text, jsonb),
  public.communaute_supprimer(text, uuid), public.communaute_aimer(uuid), public.communaute_commenter(uuid, text, uuid),
  public.admin_communaute_liste(timestamptz, int, uuid), public.admin_communaute_muets(),
  public.admin_communaute_action(text, uuid, uuid, int, text, text, text, boolean, boolean, text),
  public.communaute_auto_publier(boolean), public.communaute_desepingler_anciens() from public, anon, authenticated;
grant execute on function public.communaute_info(timestamptz), public.communaute_fil(text, timestamptz, int), public.communaute_publication(uuid),
  public.communaute_commentaires(uuid), public.communaute_top(text), public.communaute_publier(text, text, jsonb),
  public.communaute_supprimer(text, uuid), public.communaute_aimer(uuid), public.communaute_commenter(uuid, text, uuid),
  public.admin_communaute_liste(timestamptz, int, uuid), public.admin_communaute_muets(),
  public.admin_communaute_action(text, uuid, uuid, int, text, text, text, boolean, boolean, text) to authenticated;

/* ---------- photos : dossier public, un sous-dossier par candidat ---------- */
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('communaute', 'communaute', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
drop policy if exists "communaute depot candidat" on storage.objects;
create policy "communaute depot candidat" on storage.objects for insert to authenticated
  with check (bucket_id = 'communaute' and (storage.foldername(name))[1] = (auth.uid())::text);
drop policy if exists "communaute suppression" on storage.objects;
create policy "communaute suppression" on storage.objects for delete to authenticated
  using (bucket_id = 'communaute' and ((storage.foldername(name))[1] = (auth.uid())::text or securite.est_equipe()));

/* ---------- tâches planifiées ---------- */
select cron.schedule('communaute-auto', '*/10 * * * *', 'select public.communaute_auto_publier();')
 where not exists (select 1 from cron.job where jobname = 'communaute-auto');
select cron.schedule('communaute-epingles', '15 3 * * *', 'select public.communaute_desepingler_anciens();')
 where not exists (select 1 from cron.job where jobname = 'communaute-epingles');
