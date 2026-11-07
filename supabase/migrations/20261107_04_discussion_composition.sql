-- Discussion ouverte de chaque composition nationale (après la fin de l'épreuve).
create table if not exists public.discussion_messages(
  id uuid primary key default gen_random_uuid(),
  epreuve_id uuid not null references public.epreuves_collectives(id) on delete cascade,
  auteur uuid not null,
  texte text not null check (char_length(texte) between 1 and 500),
  cree_le timestamptz not null default now());
create index if not exists discussion_messages_ep on public.discussion_messages(epreuve_id, cree_le desc);
create index if not exists discussion_messages_aut on public.discussion_messages(auteur, cree_le desc);
create table if not exists public.discussion_coeurs(
  message_id uuid not null references public.discussion_messages(id) on delete cascade,
  user_id uuid not null, cree_le timestamptz not null default now(),
  primary key(message_id, user_id));
create table if not exists public.discussion_presence(
  epreuve_id uuid not null, user_id uuid not null, ecrit_le timestamptz not null default now(),
  primary key(epreuve_id, user_id));
create table if not exists public.discussion_stats(
  epreuve_id uuid primary key, donnees jsonb not null, calcule_le timestamptz not null default now());
alter table public.discussion_messages enable row level security;
alter table public.discussion_coeurs enable row level security;
alter table public.discussion_presence enable row level security;
alter table public.discussion_stats enable row level security;
revoke all on public.discussion_messages, public.discussion_coeurs, public.discussion_presence, public.discussion_stats from anon, authenticated;

create or replace function securite.discussion_acces(p_epreuve uuid, p_user uuid) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select p_user is not null and exists (select 1 from public.epreuves_collectives e where e.id = p_epreuve and e.statut = 'programmee' and now() >= e.fin_le)
    and (securite.comm_est_adm(p_user)
      or exists (select 1 from public.inscriptions_epreuve i where i.epreuve_id = p_epreuve and i.user_id = p_user)
      or exists (select 1 from public.compositions c where c.epreuve_id = p_epreuve and c.user_id = p_user));
$$;

create or replace function public.discussion_charger(p_epreuve uuid) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_user uuid := auth.uid(); v_msgs jsonb; v_n int; v_ecr jsonb;
begin
  if v_user is null or not securite.discussion_acces(p_epreuve, v_user) then
    return jsonb_build_object('ok', false, 'message', 'La discussion est réservée aux candidats inscrits, après la fin de la composition.');
  end if;
  select coalesce(jsonb_agg(j order by (j->>'cree_le')), '[]'::jsonb) into v_msgs from (
    select jsonb_build_object('id', m.id, 'texte', m.texte, 'cree_le', m.cree_le,
      'nom', coalesce((select s.nom from public.communaute_signatures s where s.user_id = m.auteur), public.nom_resultat(m.auteur, p_epreuve)),
      'equipe', exists (select 1 from public.communaute_signatures s where s.user_id = m.auteur),
      'coeurs', (select count(*) from public.discussion_coeurs c where c.message_id = m.id),
      'aime', exists (select 1 from public.discussion_coeurs c where c.message_id = m.id and c.user_id = v_user),
      'moi', m.auteur = v_user) j
    from public.discussion_messages m where m.epreuve_id = p_epreuve order by m.cree_le desc limit 60) z;
  select count(*) into v_n from public.discussion_messages where epreuve_id = p_epreuve;
  select coalesce(jsonb_agg(nom), '[]'::jsonb) into v_ecr from (
    select coalesce((select s.nom from public.communaute_signatures s where s.user_id = d.user_id), public.nom_resultat(d.user_id, p_epreuve)) nom
      from public.discussion_presence d where d.epreuve_id = p_epreuve and d.user_id <> v_user and d.ecrit_le > now() - interval '8 seconds'
     order by d.ecrit_le desc limit 12) q;
  return jsonb_build_object('ok', true, 'messages', v_msgs, 'total', v_n, 'ecrivent', v_ecr, 'equipe', securite.comm_est_adm(v_user));
end $$;

create or replace function public.discussion_envoyer(p_epreuve uuid, p_texte text) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_user uuid := auth.uid(); v_txt text; v_adm boolean; v_bloc text;
begin
  if v_user is null or not securite.discussion_acces(p_epreuve, v_user) then return jsonb_build_object('ok', false, 'message', 'Discussion indisponible.'); end if;
  v_adm := securite.comm_est_adm(v_user);
  if not v_adm then
    v_bloc := securite.comm_blocage(v_user);
    if v_bloc is not null then return jsonb_build_object('ok', false, 'message', v_bloc); end if;
    if (select count(*) from public.discussion_messages where auteur = v_user and cree_le > now() - interval '10 minutes') >= 20 then
      return jsonb_build_object('ok', false, 'message', 'Vous écrivez beaucoup : réessayez dans un moment.'); end if;
  end if;
  v_txt := case when v_adm then left(btrim(coalesce(p_texte, '')), 500) else securite.comm_nettoyer(left(btrim(coalesce(p_texte, '')), 500)) end;
  if v_txt = '' then return jsonb_build_object('ok', false, 'message', 'Écrivez votre message.'); end if;
  insert into public.discussion_messages(epreuve_id, auteur, texte) values (p_epreuve, v_user, v_txt);
  delete from public.discussion_presence where epreuve_id = p_epreuve and user_id = v_user;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.discussion_aimer(p_message uuid) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_user uuid := auth.uid(); v_ep uuid; v_aime boolean;
begin
  select epreuve_id into v_ep from public.discussion_messages where id = p_message;
  if v_user is null or v_ep is null or not securite.discussion_acces(v_ep, v_user) then return jsonb_build_object('ok', false); end if;
  if exists (select 1 from public.discussion_coeurs where message_id = p_message and user_id = v_user) then
    delete from public.discussion_coeurs where message_id = p_message and user_id = v_user; v_aime := false;
  else insert into public.discussion_coeurs(message_id, user_id) values (p_message, v_user) on conflict do nothing; v_aime := true; end if;
  return jsonb_build_object('ok', true, 'aime', v_aime, 'coeurs', (select count(*) from public.discussion_coeurs where message_id = p_message));
end $$;

create or replace function public.discussion_ecrit(p_epreuve uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null or not securite.discussion_acces(p_epreuve, v_user) then return; end if;
  insert into public.discussion_presence(epreuve_id, user_id, ecrit_le) values (p_epreuve, v_user, now())
  on conflict (epreuve_id, user_id) do update set ecrit_le = now();
end $$;

create or replace function public.discussion_supprimer(p_message uuid) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then return jsonb_build_object('ok', false); end if;
  delete from public.discussion_messages where id = p_message and (auteur = v_user or securite.est_admin());
  return jsonb_build_object('ok', found);
end $$;

create or replace function public.stats_groupe_epreuve(p_epreuve uuid) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_user uuid := auth.uid(); v_ep record; v_r jsonb; v_n int; v_q int; v_just bigint; v_rep bigint; v_moy numeric; v_tps numeric;
begin
  if v_user is null or not securite.discussion_acces(p_epreuve, v_user) then return jsonb_build_object('ok', false); end if;
  select donnees into v_r from public.discussion_stats where epreuve_id = p_epreuve;
  if v_r is not null then return v_r; end if;
  select * into v_ep from public.epreuves_collectives where id = p_epreuve;
  select count(*), round(avg(score)::numeric, 1), round(avg(duree_secondes)::numeric / 60, 0) into v_n, v_moy, v_tps
    from public.compositions where epreuve_id = p_epreuve and terminee;
  select count(*) into v_q from public.sujet_questions where sujet_id = v_ep.sujet_id;
  select count(*) filter (where r.correcte), count(*) filter (where coalesce(array_length(r.options_choisies, 1), 0) > 0)
    into v_just, v_rep
    from public.composition_reponses r join public.compositions c on c.id = r.composition_id
   where c.epreuve_id = p_epreuve and c.terminee;
  if v_n = 0 or v_q = 0 then return jsonb_build_object('ok', true, 'vide', true); end if;
  v_r := jsonb_build_object('ok', true, 'vide', false, 'participants', v_n, 'moyenne', v_moy, 'sur', v_q, 'minutes', v_tps,
    'justes', round(100.0 * v_just / (v_n * v_q)), 'erreurs', round(100.0 * greatest(v_rep - v_just, 0) / (v_n * v_q)),
    'sans_reponse', round(100.0 * greatest(v_n * v_q - v_rep, 0) / (v_n * v_q)));
  insert into public.discussion_stats(epreuve_id, donnees) values (p_epreuve, v_r) on conflict do nothing;
  return v_r;
end $$;

revoke all on function public.discussion_charger(uuid), public.discussion_envoyer(uuid, text), public.discussion_aimer(uuid), public.discussion_ecrit(uuid), public.discussion_supprimer(uuid), public.stats_groupe_epreuve(uuid) from public, anon;
grant execute on function public.discussion_charger(uuid), public.discussion_envoyer(uuid, text), public.discussion_aimer(uuid), public.discussion_ecrit(uuid), public.discussion_supprimer(uuid), public.stats_groupe_epreuve(uuid) to authenticated;
