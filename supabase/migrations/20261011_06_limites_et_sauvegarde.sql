-- =====================================================================
-- 11 octobre 2026 · Limite des ajouts anonymes et sauvegarde hebdomadaire
-- =====================================================================

-- 1. Compteurs par adresse et par minute, plus un plafond par jour
create table if not exists securite.compteurs (
  cle text not null,
  minute timestamptz not null,
  n int not null default 0,
  primary key (cle, minute)
);
alter table securite.compteurs enable row level security;
revoke all on securite.compteurs from public, anon, authenticated;

create or replace function securite.limiter_ajouts()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_entetes jsonb; v_ip text; v_max int; v_n int; v_jour int;
begin
  begin v_entetes := current_setting('request.headers', true)::jsonb; exception when others then v_entetes := null; end;
  if v_entetes is null then return new; end if;     -- appels internes : pas de limite
  v_ip := coalesce(v_entetes->>'cf-connecting-ip', nullif(split_part(coalesce(v_entetes->>'x-forwarded-for',''), ',', 1), ''), v_entetes->>'x-real-ip', 'inconnu');
  v_max := coalesce(tg_argv[0]::int, 60);
  insert into securite.compteurs (cle, minute, n)
  values (tg_table_name || ':' || v_ip, date_trunc('minute', now()), 1)
  on conflict (cle, minute) do update set n = securite.compteurs.n + 1
  returning n into v_n;
  if v_n > v_max then
    raise exception 'Trop de requêtes, réessayez dans une minute.' using errcode = 'P0429';
  end if;
  insert into securite.compteurs (cle, minute, n)
  values (tg_table_name || ':jour', date_trunc('day', now()), 1)
  on conflict (cle, minute) do update set n = securite.compteurs.n + 1
  returning n into v_jour;
  if v_jour > coalesce(tg_argv[1]::int, 50000) then
    raise exception 'Limite du jour atteinte.' using errcode = 'P0429';
  end if;
  if random() < 0.01 then delete from securite.compteurs where minute < now() - interval '2 days'; end if;
  return new;
end $$;
revoke execute on function securite.limiter_ajouts() from public, anon, authenticated;

-- par adresse et par minute / plafond du jour
create or replace trigger trg_limite_evenements before insert on public.evenements
  for each row execute function securite.limiter_ajouts('600', '60000');
create or replace trigger trg_limite_sessions before insert on public.sessions
  for each row execute function securite.limiter_ajouts('60', '5000');
create or replace trigger trg_limite_retours before insert on public.retours_candidats
  for each row execute function securite.limiter_ajouts('20', '1000');
create or replace trigger trg_limite_affectations before insert on public.affectations_experience
  for each row execute function securite.limiter_ajouts('30', '10000');

-- 2. Sauvegarde hebdomadaire dans un schéma non exposé, cinq semaines tournantes
create extension if not exists pg_cron;
create schema if not exists sauvegarde;
revoke all on schema sauvegarde from public, anon, authenticated;

create table if not exists sauvegarde.copies (
  emplacement int not null,
  table_nom text not null,
  pris_le timestamptz not null,
  nb_lignes int not null,
  lignes jsonb not null,
  primary key (emplacement, table_nom)
);
revoke all on sauvegarde.copies from public, anon, authenticated;

create or replace function sauvegarde.prendre()
returns int language plpgsql security definer set search_path = public as $$
declare
  t text; v_lignes jsonb; v_n int; v_total int := 0;
  v_place int := (extract(week from now())::int % 5);
  tables text[] := array['profils','roles_utilisateur','abonnements','paiements','compositions','composition_reponses',
    'erreurs_utilisateur','assiduite','points_journal','notifications','questions','question_options','sujets',
    'sujet_questions','actualites','concours','concours_matieres','matieres','chapitres','cours','ressources',
    'propositions_ia','retours_candidats','tarifs','parametres_classement','musiques'];
begin
  foreach t in array tables loop
    execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb), count(*) from public.%I x', t)
      into v_lignes, v_n;
    insert into sauvegarde.copies (emplacement, table_nom, pris_le, nb_lignes, lignes)
    values (v_place, t, now(), v_n, v_lignes)
    on conflict (emplacement, table_nom) do update
      set pris_le = excluded.pris_le, nb_lignes = excluded.nb_lignes, lignes = excluded.lignes;
    v_total := v_total + v_n;
  end loop;
  return v_total;
end $$;
revoke execute on function sauvegarde.prendre() from public, anon, authenticated;

-- chaque dimanche à 2 h (heure du serveur, UTC)
select cron.schedule('sauvegarde-hebdo', '0 2 * * 0', 'select sauvegarde.prendre()');
