-- =====================================================================
-- 15 octobre 2026 — défier des amis par numéro ou depuis le top 10,
-- notifications qui mènent à la bonne page, rappel à l'heure exacte,
-- matières propres à chaque niveau.
-- =====================================================================

-- ---------- matières par niveau : Droit et Économie seulement en licence ----------
alter table public.matieres add column if not exists niveaux public.niveau_scolaire[];
update public.matieres set niveaux = '{licence}' where nom in ('Droit', 'Économie');
update public.matieres set nom = 'Sciences de la vie et de la Terre' where nom = 'Sciences de la vie';

create or replace function public.matiere_du_niveau(p_matiere uuid, p_niveau public.niveau_scolaire)
returns boolean language sql stable set search_path = public as $$
  select p_niveau is null or coalesce((select m.niveaux is null or p_niveau = any(m.niveaux)
                                         from public.matieres m where m.id = p_matiere), true);
$$;

do $do$
declare d text;
begin
  d := pg_get_functiondef('public.fil_pour_toi(text,integer)'::regprocedure);
  if position('matiere_du_niveau' in d) = 0 then
    d := replace(d, 'where q.statut = ''publie'' and (q.niveau = v_niveau or q.niveau is null)',
                    'where q.statut = ''publie'' and (q.niveau = v_niveau or q.niveau is null) and public.matiere_du_niveau(q.matiere_id, v_niveau)');
    execute d;
  end if;
  d := pg_get_functiondef('public.creer_defi(text,text)'::regprocedure);
  if position('matiere_du_niveau' in d) = 0 then
    d := replace(d, '       and (v_niveau is null or q.niveau = v_niveau or q.niveau is null)',
                    '       and (v_niveau is null or q.niveau = v_niveau or q.niveau is null) and public.matiere_du_niveau(q.matiere_id, v_niveau)');
    execute d;
  end if;
  d := pg_get_functiondef('public.notion_du_jour(text)'::regprocedure);
  if position('matiere_du_niveau' in d) = 0 then
    d := replace(d, '     and (v_niveau is null or r.niveau = v_niveau or r.niveau is null)',
                    '     and (v_niveau is null or r.niveau = v_niveau or r.niveau is null) and public.matiere_du_niveau(r.matiere_id, v_niveau)');
    execute d;
  end if;
end $do$;

-- ---------- notifications : chacune sait où elle mène ----------
alter table public.notifications add column if not exists lien text;

create or replace function public.mes_notifications()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', n.id, 'type', n.type, 'titre', n.titre, 'message', n.message, 'lue', n.lue, 'cree_le', n.cree_le,
      'lien', coalesce(n.lien,
        case when n.cle_unicite like 'resultat-%' then 'copie:' || substr(n.cle_unicite, 10)
             when n.cle_unicite like 'epreuve-%' then 'epreuve:' || substr(n.cle_unicite, 9) end)
    ) order by n.cree_le desc)
    from (select * from public.notifications where user_id = v_user order by cree_le desc limit 40) n
  ), '[]'::jsonb);
end $$;

-- une notification envoyée aussi sur le téléphone (rappels activés)
create table if not exists public.push_file (
  id bigserial primary key,
  user_id uuid not null,
  titre text not null, message text not null, lien text,
  cree_le timestamptz not null default now(),
  envoye boolean not null default false
);
alter table public.push_file enable row level security;
create index if not exists push_file_a_envoyer on public.push_file (envoye, cree_le) where not envoye;

create or replace function public.notifier(p_user uuid, p_type text, p_titre text, p_message text, p_cle text, p_lien text, p_push boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, type, titre, message, cle_unicite, lien)
  values (p_user, p_type, p_titre, p_message, p_cle, p_lien)
  on conflict (user_id, cle_unicite) where cle_unicite is not null do nothing;
  if p_push and found then
    insert into public.push_file (user_id, titre, message, lien)
    values (p_user, p_titre, p_message, '/?' || replace(coalesce(p_lien, 'accueil'), ':', '='));
  end if;
end $$;
revoke all on function public.notifier(uuid, text, text, text, text, text, boolean) from public, anon, authenticated;

-- la notification du jour (progression) et celle de l'installation : écrites par l'application pour soi
create or replace function public.ma_notification(p_type text, p_titre text, p_message text, p_cle text, p_lien text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return jsonb_build_object('ok', false); end if;
  if p_type not in ('progression', 'installation') or p_cle !~ '^(progression|installation)-[0-9a-z-]{1,20}$'
     or length(p_titre) > 120 or length(p_message) > 500 or coalesce(p_lien, '') !~ '^(compte|installer|parcours)?$' then
    return jsonb_build_object('ok', false);
  end if;
  insert into public.notifications (user_id, type, titre, message, cle_unicite, lien)
  values (auth.uid(), p_type, p_titre, p_message, p_cle, nullif(p_lien, ''))
  on conflict (user_id, cle_unicite) where cle_unicite is not null do nothing;
  return jsonb_build_object('ok', true, 'nouvelle', found);
end $$;

-- ---------- défis entre amis : invitation, acceptation, refus ----------
create table if not exists public.defis_invitations (
  defi_id uuid not null references public.defis(id) on delete cascade,
  invite uuid not null,
  statut text not null default 'en_attente' check (statut in ('en_attente', 'accepte', 'refuse')),
  cree_le timestamptz not null default now(),
  repondu_le timestamptz,
  primary key (defi_id, invite)
);
alter table public.defis_invitations enable row level security;

create or replace function public.nom_public(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(nullif(trim(nom), ''), pseudo) from public.profils where id = p_user;
$$;
revoke all on function public.nom_public(uuid) from public, anon, authenticated;

create or replace function public.inviter_defi(p_defi uuid, p_telephones text[], p_pseudos text[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_d record; v_tel text; v_chiffres text; v_cible uuid; v_nom text; v_mat text;
  v_ok int := 0; v_introuvables text[] := '{}'; v_ps text;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'connexion', true); end if;
  select d.*, m.nom matiere into v_d from public.defis d left join public.matieres m on m.id = d.matiere_id where d.id = p_defi;
  if not found or v_d.auteur <> v_user then return jsonb_build_object('ok', false, 'message', 'Défi introuvable.'); end if;
  if (select count(*) from public.defis_invitations where defi_id = p_defi) + coalesce(array_length(p_telephones, 1), 0)
     + coalesce(array_length(p_pseudos, 1), 0) > 10 then
    return jsonb_build_object('ok', false, 'message', 'Dix invités au plus par défi.'); end if;
  v_nom := public.nom_public(v_user);
  v_mat := coalesce(v_d.matiere, 'toutes matières');

  foreach v_tel in array coalesce(p_telephones, '{}') loop
    v_chiffres := right(regexp_replace(v_tel, '\D', '', 'g'), 8);
    if length(v_chiffres) <> 8 then continue; end if;
    select id into v_cible from public.profils
     where right(regexp_replace(coalesce(telephone, ''), '\D', '', 'g'), 8) = v_chiffres and id <> v_user limit 1;
    if v_cible is null then v_introuvables := v_introuvables || v_chiffres; continue; end if;
    insert into public.defis_invitations (defi_id, invite) values (p_defi, v_cible) on conflict do nothing;
    if found then
      v_ok := v_ok + 1;
      perform public.notifier(v_cible, 'defi', 'Défi de ' || v_nom,
        v_nom || ' vous défie : ' || array_length(v_d.questions, 1) || ' questions (' || v_mat || ') en '
        || round(v_d.duree_secondes / 60.0) || ' minutes. Acceptez-vous le défi ?',
        'defi-' || p_defi, 'defi:' || p_defi, true);
    end if;
    v_cible := null;
  end loop;

  foreach v_ps in array coalesce(p_pseudos, '{}') loop
    select id into v_cible from public.profils where pseudo = v_ps and id <> v_user;
    if v_cible is null then continue; end if;
    insert into public.defis_invitations (defi_id, invite) values (p_defi, v_cible) on conflict do nothing;
    if found then
      v_ok := v_ok + 1;
      perform public.notifier(v_cible, 'defi', 'Défi de ' || coalesce((select pseudo from public.profils where id = v_user), v_nom),
        coalesce((select pseudo from public.profils where id = v_user), v_nom) || ' (top 10 de la semaine) vous défie : '
        || array_length(v_d.questions, 1) || ' questions (' || v_mat || ') en ' || round(v_d.duree_secondes / 60.0)
        || ' minutes. Acceptez-vous le défi ?',
        'defi-' || p_defi, 'defi:' || p_defi, true);
    end if;
    v_cible := null;
  end loop;
  return jsonb_build_object('ok', true, 'invites', v_ok, 'introuvables', to_jsonb(v_introuvables));
end $$;

create or replace function public.repondre_defi(p_defi uuid, p_accepte boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_d record; v_nom text;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'connexion', true); end if;
  update public.defis_invitations set statut = case when p_accepte then 'accepte' else 'refuse' end, repondu_le = now()
   where defi_id = p_defi and invite = v_user and statut = 'en_attente';
  if not found then return jsonb_build_object('ok', true, 'deja', true); end if;
  select * into v_d from public.defis where id = p_defi;
  v_nom := public.nom_public(v_user);
  perform public.notifier(v_d.auteur, 'defi', v_nom || case when p_accepte then ' a accepté votre défi' else ' a refusé votre défi' end,
    case when p_accepte then v_nom || ' compose en ce moment. Le classement s''affiche dès que chacun a remis sa copie.'
         else v_nom || ' ne relève pas ce défi pour le moment.' end,
    'defi-rep-' || p_defi || '-' || v_user, 'defi:' || p_defi, true);
  return jsonb_build_object('ok', true);
end $$;

-- le classement montre aussi qui a été invité et où il en est
create or replace function public.resultat_defi(p_defi uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'participants', (select count(*) from public.defis_scores where defi_id = p_defi and termine),
    'classement', coalesce((select jsonb_agg(jsonb_build_object('rang', rang, 'pseudo', pseudo, 'nom', nom, 'score', score,
        'duree', duree_secondes, 'moi', user_id = auth.uid(), 'auteur', user_id = auteur) order by rang, pseudo)
      from (select s.user_id, s.score, s.duree_secondes, p.pseudo, public.nom_public(s.user_id) nom, d.auteur,
                   rank() over (order by s.score desc, s.duree_secondes) rang
              from public.defis_scores s join public.profils p on p.id = s.user_id join public.defis d on d.id = s.defi_id
             where s.defi_id = p_defi and s.termine order by rang limit 20) z), '[]'::jsonb),
    'invites', coalesce((select jsonb_agg(jsonb_build_object('nom', public.nom_public(i.invite),
        'statut', case when exists (select 1 from public.defis_scores s where s.defi_id = p_defi and s.user_id = i.invite and s.termine)
                       then 'termine' else i.statut end) order by i.cree_le)
      from public.defis_invitations i where i.defi_id = p_defi
        and (auth.uid() = (select auteur from public.defis where id = p_defi)
             or exists (select 1 from public.defis_invitations j where j.defi_id = p_defi and j.invite = auth.uid()))), '[]'::jsonb),
    'sur', (select array_length(questions, 1) from public.defis where id = p_defi));
$$;

-- l'invité voit l'invitation avant de commencer (ouvrir_defi ne lance pas le chrono tant qu'il n'a pas accepté)
do $do$
declare d text;
begin
  d := pg_get_functiondef('public.ouvrir_defi(uuid)'::regprocedure);
  if position('defis_invitations' in d) = 0 then
    d := replace(d, '  select * into v_s from public.defis_scores where defi_id = p_defi and user_id = v_user;
  if found and v_s.termine then',
'  if exists (select 1 from public.defis_invitations where defi_id = p_defi and invite = v_user and statut <> ''accepte'')
     and not exists (select 1 from public.defis_scores where defi_id = p_defi and user_id = v_user) then
    return jsonb_build_object(''ok'', true, ''invitation'', (select statut from public.defis_invitations where defi_id = p_defi and invite = v_user),
      ''id'', v_d.id, ''matiere'', v_d.matiere, ''auteur'', public.nom_public(v_d.auteur), ''duree'', v_d.duree_secondes,
      ''nb'', array_length(v_d.questions, 1));
  end if;
  select * into v_s from public.defis_scores where defi_id = p_defi and user_id = v_user;
  if found and v_s.termine then');
    d := replace(d, '''auteur'', v_d.auteur_pseudo, ''mien''', '''auteur'', public.nom_public(v_d.auteur), ''mien''');
    execute d;
  end if;
end $do$;

-- à la remise : le corrigé complet (énoncés, propositions) pour la feuille téléchargée, et l'auteur prévenu
do $do$
declare d text;
begin
  d := pg_get_functiondef('public.remettre_defi(uuid,jsonb)'::regprocedure);
  if position('notifier' in d) = 0 then
    d := replace(d, '  return jsonb_build_object(''ok'', true, ''score'', v_score,',
'  if v_d.auteur <> v_user then
    perform public.notifier(v_d.auteur, ''defi'', public.nom_public(v_user) || '' a terminé votre défi'',
      public.nom_public(v_user) || '' a obtenu '' || v_score || '' sur '' || array_length(v_d.questions, 1) || ''. Voyez le classement.'',
      ''defi-fin-'' || p_defi || ''-'' || v_user, ''defi:'' || p_defi, true);
  end if;
  return jsonb_build_object(''ok'', true, ''score'', v_score,');
    execute d;
  end if;
end $do$;

-- top 10 : on peut défier chacun (par pseudo)
-- (top_semaine renvoie déjà le pseudo)

-- ---------- minutes du mois (notification de progression) ----------
do $do$
declare d text;
begin
  d := pg_get_functiondef('public.mes_details()'::regprocedure);
  if position('minutes_mois' in d) = 0 then
    d := replace(d, '''qcm_revision'',', '''minutes_mois'', (select coalesce(round(sum(least(coalesce(temps_ms, 0), 300000)) / 60000.0), 0)
          from public.tentatives_question where user_id = v_user and cree_le >= date_trunc(''month'', now()) and contexte <> ''composition'')
        + (select coalesce(round(sum(duree_secondes) / 60.0), 0) from public.compositions
          where user_id = v_user and terminee and debut_le >= date_trunc(''month'', now())),
    ''qcm_revision'',');
    execute d;
  end if;
end $do$;

-- ---------- rappel : une heure et des minutes au choix, chaque jour, sans condition ----------
create or replace function public.enregistrer_rappel_freq(p_endpoint text, p_p256dh text, p_auth text, p_heure int,
  p_minute int, p_frequence text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'connexion', true); end if;
  if p_endpoint !~ '^https://' or length(p_endpoint) > 1000 then return jsonb_build_object('ok', false); end if;
  if p_heure not between 0 and 23 or p_minute not between 0 and 59 then return jsonb_build_object('ok', false); end if;
  insert into public.push_abonnements (endpoint, user_id, p256dh, auth, heure, minute, actif, frequence, dernier_rappel)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth, p_heure, p_minute, true, 'quotidien', null)
  on conflict (endpoint) do update set user_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth,
    heure = excluded.heure, minute = excluded.minute, actif = true, frequence = 'quotidien', dernier_rappel = null;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.envois_a_faire()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_res jsonb := '[]'::jsonb; v_r2 jsonb := '[]'::jsonb; v_r3 jsonb := '[]'::jsonb;
  v_min int := extract(hour from now() at time zone 'UTC')::int * 60 + extract(minute from now() at time zone 'UTC')::int;
begin
  -- le rappel du candidat, à l'heure qu'il a choisie (marge de 5 minutes si un passage saute)
  with dus as (
    select a.endpoint, a.p256dh, a.auth, a.user_id,
           (select count(*) from public.erreurs_utilisateur e where e.user_id = a.user_id and not e.acquise and e.revoir_le <= current_date) erreurs
      from public.push_abonnements a
     where a.actif and (a.dernier_rappel is null or a.dernier_rappel < current_date)
       and v_min - (a.heure * 60 + a.minute) between 0 and 5
  ), marques as (
    update public.push_abonnements a set dernier_rappel = current_date, dernier_envoi = now()
      from dus where a.endpoint = dus.endpoint
    returning dus.*
  )
  select coalesce(jsonb_agg(jsonb_build_object('endpoint', endpoint, 'p256dh', p256dh, 'auth', auth,
      'titre', 'C''est l''heure de réviser',
      'message', case when erreurs > 0 then erreurs || ' erreur' || case when erreurs > 1 then 's' else '' end
                        || ' à revoir aujourd''hui. Dix minutes suffisent pour avancer.'
                      else 'Votre rappel du jour : quelques questions, et la série continue.' end,
      'lien', '/?depuis=rappel')), '[]'::jsonb)
    into v_res from marques;

  -- composition nationale : 20 minutes avant
  with ep as (
    select * from public.epreuves_collectives
     where statut = 'programmee' and debut_le > now() and debut_le <= now() + interval '20 minutes'
  ), cibles as (
    insert into public.envois_push (endpoint, cle)
    select a.endpoint, 'epreuve-' || ep.id from public.push_abonnements a cross join ep where a.actif
    on conflict do nothing
    returning endpoint, cle
  )
  select coalesce(jsonb_agg(jsonb_build_object('endpoint', a.endpoint, 'p256dh', a.p256dh, 'auth', a.auth,
      'titre', 'Composition nationale (simulation) : ' || coalesce((select nom from public.concours where id = ep.concours_id), ep.titre),
      'message', 'Elle commence à ' || to_char(ep.debut_le at time zone 'UTC', 'HH24"h"MI') || '. Même sujet pour tous, résultats à la fin.',
      'lien', '/?epreuve=' || ep.id)), '[]'::jsonb)
    into v_r2
    from cibles c join public.push_abonnements a on a.endpoint = c.endpoint
    join ep on c.cle = 'epreuve-' || ep.id;

  -- le bilan du dimanche soir
  if extract(isodow from now()) = 7 and v_min between 19 * 60 and 19 * 60 + 20 then
    with cibles as (
      insert into public.envois_push (endpoint, cle)
      select a.endpoint, 'hebdo-' || to_char(now(), 'IYYY-IW') from public.push_abonnements a where a.actif
      on conflict do nothing returning endpoint
    )
    select v_r2 || coalesce(jsonb_agg(jsonb_build_object('endpoint', a.endpoint, 'p256dh', a.p256dh, 'auth', a.auth,
        'titre', 'Votre semaine sur Mon Concours',
        'message', (select count(*) from public.tentatives_question t where t.user_id = a.user_id and t.cree_le >= date_trunc('week', now()))
                     || ' questions, ' ||
                     (select count(*) from public.assiduite s where s.user_id = a.user_id and s.compose and s.jour >= date_trunc('week', now())::date)
                     || ' jours de travail cette semaine. Une nouvelle semaine commence demain.',
        'lien', '/?depuis=hebdo')), '[]'::jsonb)
      into v_r2 from cibles c join public.push_abonnements a on a.endpoint = c.endpoint;
  end if;

  -- la file : défis reçus, acceptés, refusés…
  with f as (
    update public.push_file set envoye = true
     where id in (select id from public.push_file where not envoye and cree_le > now() - interval '1 day' order by id limit 500)
    returning *
  )
  select coalesce(jsonb_agg(jsonb_build_object('endpoint', a.endpoint, 'p256dh', a.p256dh, 'auth', a.auth,
      'titre', f.titre, 'message', f.message, 'lien', f.lien)), '[]'::jsonb)
    into v_r3 from f join public.push_abonnements a on a.user_id = f.user_id and a.actif;

  return v_res || v_r2 || v_r3;
end $$;

-- les annonces de composition nationale portent la mention « simulation »
create or replace function public.annoncer_epreuve(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_ep record; v_quand text; v_conc text;
begin
  select * into v_ep from public.epreuves_collectives where id = p_id;
  select nom into v_conc from public.concours where id = v_ep.concours_id;
  v_quand := to_char(v_ep.debut_le at time zone 'UTC', 'DD/MM à HH24"h"MI');
  insert into public.notifications (user_id, type, titre, message, cle_unicite, lien)
  select p.id, 'rappel', 'Composition nationale (simulation)' || coalesce(' · ' || v_conc, ''),
         'Le ' || v_quand || ' : même sujet, même durée pour tous. ' || v_ep.places
         || ' places, résultats et liste des admis à la fin. Inscrivez-vous depuis l''application.',
         'epreuve-' || p_id::text, 'epreuve:' || p_id
    from public.profils p
  on conflict do nothing;
end $$;
revoke all on function public.annoncer_epreuve(uuid) from public, anon, authenticated;

-- ---------- droits ----------
revoke all on function public.inviter_defi(uuid, text[], text[]), public.repondre_defi(uuid, boolean),
  public.ma_notification(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.inviter_defi(uuid, text[], text[]), public.repondre_defi(uuid, boolean),
  public.ma_notification(text, text, text, text, text) to authenticated;

-- ---------- le passage des envois : chaque minute (rappel à l'heure exacte) ----------
select cron.alter_job((select jobid from cron.job where jobname = 'rappels-push'), schedule := '* * * * *');
