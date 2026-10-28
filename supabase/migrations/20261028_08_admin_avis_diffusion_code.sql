-- Administration · lot 1
--   1. répondre à un avis / l'aimer, le candidat reçoit « Réponse de l'administration · Mon Concours »
--   2. notification envoyée à tout le monde (cloche, plein écran, ou les deux), avec historique
--   3. changement de code demandé par l'administration : le candidat touche la notification,
--      saisit son nouveau code deux fois
--   4. alertes push réservées aux administrateurs (paiement à vérifier, nouvel avis, signalement…)

/* ---------- 1. avis ---------- */
alter table public.avis
  add column if not exists reponse text,
  add column if not exists reponse_le timestamptz,
  add column if not exists reponse_par uuid,
  add column if not exists aime boolean not null default false,
  add column if not exists aime_le timestamptz;

create or replace function public.avis_liste(p_limite integer default 100)
 returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not securite.est_lecteur() then raise exception 'réservé à l''équipe'; end if;
  return coalesce((select jsonb_agg(z.x order by z.quand desc) from (
    select a.cree_le as quand,
           jsonb_build_object('id', a.id, 'user_id', a.user_id, 'message', a.message, 'statut', a.statut, 'cree_le', a.cree_le,
             'reponse', a.reponse, 'reponse_le', a.reponse_le, 'aime', a.aime,
             'nom', p.nom, 'niveau', p.niveau,
             'telephone', case when p.telephone is null then null when securite.est_equipe() then p.telephone
                               else left(p.telephone, 2) || ' •• •• ' || right(p.telephone, 2) end) as x
      from public.avis a left join public.profils p on p.id = a.user_id
     order by a.cree_le desc
     limit least(greatest(coalesce(p_limite, 100), 1), 300)) z), '[]'::jsonb);
end $$;

create or replace function public.admin_repondre_avis(p_id bigint, p_reponse text, p_mode text default 'les_deux')
 returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_a public.avis%rowtype; v_txt text; v_type text;
begin
  if not securite.est_equipe() then return jsonb_build_object('ok', false, 'message', 'Réservé à l''équipe.'); end if;
  select * into v_a from public.avis where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'message', 'Avis introuvable.'); end if;
  v_txt := btrim(coalesce(p_reponse, ''));
  if char_length(v_txt) < 2 then return jsonb_build_object('ok', false, 'message', 'Écrivez votre réponse.'); end if;
  if char_length(v_txt) > 800 then return jsonb_build_object('ok', false, 'message', 'Huit cents caractères au plus.'); end if;
  update public.avis set reponse = v_txt, reponse_le = now(), reponse_par = auth.uid(),
         statut = case when statut = 'nouveau' then 'lu' else statut end
   where id = p_id;
  v_type := case when p_mode = 'cloche' then 'reponse_admin' else 'reponse_admin_plein' end;
  perform public.notifier(v_a.user_id, v_type, 'Réponse de l''administration · Mon Concours', v_txt,
    'avis-rep-' || p_id || '-' || extract(epoch from now())::bigint, 'avis:' || p_id, true);
  insert into public.journal_activite (acteur, action, table_cible) values (auth.uid(), 'reponse_avis', 'avis');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_aimer_avis(p_id bigint, p_aime boolean)
 returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_a public.avis%rowtype;
begin
  if not securite.est_equipe() then return jsonb_build_object('ok', false, 'message', 'Réservé à l''équipe.'); end if;
  select * into v_a from public.avis where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'message', 'Avis introuvable.'); end if;
  update public.avis set aime = coalesce(p_aime, false), aime_le = case when p_aime then now() else null end,
         statut = case when statut = 'nouveau' then 'lu' else statut end where id = p_id;
  if p_aime and not v_a.aime then
    perform public.notifier(v_a.user_id, 'reponse_admin', 'Votre avis a plu à l''équipe',
      'L''équipe de Mon Concours a aimé votre avis. Merci de nous aider à améliorer le site !',
      'avis-aime-' || p_id, 'avis:' || p_id, false);
  end if;
  return jsonb_build_object('ok', true);
end $$;

/* ---------- 2. diffusion ---------- */
create table if not exists public.diffusions (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  message text not null,
  mode text not null check (mode in ('cloche', 'plein', 'les_deux')),
  cible text not null default 'tous',
  lien text,
  push boolean not null default true,
  destinataires integer not null default 0,
  cree_par uuid,
  cree_le timestamptz not null default now()
);
alter table public.diffusions enable row level security;
drop policy if exists "equipe lit les diffusions" on public.diffusions;
create policy "equipe lit les diffusions" on public.diffusions for select using (securite.est_lecteur());

create or replace function public.cible_diffusion(p_cible text)
 returns setof uuid language sql stable security definer set search_path to 'public' as $$
  select p.id from public.profils p
   where not exists (select 1 from public.bannissements b where b.user_id = p.id and b.leve_le is null and (b.jusqu_au is null or b.jusqu_au > now()))
     and case coalesce(p_cible, 'tous')
       when 'abonnes' then exists (select 1 from public.abonnements a where a.user_id = p.id and a.fin_le > now() and a.annule_le is null and a.formule <> 'essai')
       when 'essai' then exists (select 1 from public.abonnements a where a.user_id = p.id and a.fin_le > now() and a.annule_le is null and a.formule = 'essai')
                     and not exists (select 1 from public.abonnements a where a.user_id = p.id and a.fin_le > now() and a.annule_le is null and a.formule <> 'essai')
       when 'gratuits' then not exists (select 1 from public.abonnements a where a.user_id = p.id and a.fin_le > now() and a.annule_le is null)
       when 'actifs7' then exists (select 1 from public.sessions s where s.user_id = p.id and s.debut_le > now() - interval '7 days')
       when 'inactifs7' then not exists (select 1 from public.sessions s where s.user_id = p.id and s.debut_le > now() - interval '7 days')
       when 'push' then exists (select 1 from public.push_abonnements x where x.user_id = p.id and x.actif)
       else true end;
$$;

create or replace function public.admin_compter_cible(p_cible text)
 returns integer language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not securite.est_admin() then return 0; end if;
  return (select count(*) from public.cible_diffusion(p_cible))::int;
end $$;

create or replace function public.admin_diffuser(p_titre text, p_message text, p_mode text default 'les_deux',
                                                  p_cible text default 'tous', p_lien text default null, p_push boolean default true)
 returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid := gen_random_uuid(); v_type text; v_n int := 0; r record; v_titre text; v_msg text; v_lien text;
begin
  if not securite.est_admin() then return jsonb_build_object('ok', false, 'message', 'Réservé à l''administration.'); end if;
  v_titre := btrim(coalesce(p_titre, '')); v_msg := btrim(coalesce(p_message, ''));
  if char_length(v_titre) < 3 or char_length(v_titre) > 80 then return jsonb_build_object('ok', false, 'message', 'Le titre : de 3 à 80 caractères.'); end if;
  if char_length(v_msg) < 3 or char_length(v_msg) > 600 then return jsonb_build_object('ok', false, 'message', 'Le message : de 3 à 600 caractères.'); end if;
  if p_mode not in ('cloche', 'plein', 'les_deux') then return jsonb_build_object('ok', false, 'message', 'Mode inconnu.'); end if;
  v_type := case p_mode when 'cloche' then 'annonce' when 'plein' then 'annonce_popup' else 'annonce_plein' end;
  v_lien := coalesce(nullif(btrim(coalesce(p_lien, '')), ''), 'annonce:' || v_id);
  for r in select * from public.cible_diffusion(p_cible) as u(id) loop
    perform public.notifier(r.id, v_type, v_titre, v_msg, 'diff-' || v_id, v_lien, coalesce(p_push, true));
    v_n := v_n + 1;
  end loop;
  insert into public.diffusions (id, titre, message, mode, cible, lien, push, destinataires, cree_par)
  values (v_id, v_titre, v_msg, p_mode, coalesce(p_cible, 'tous'), nullif(btrim(coalesce(p_lien, '')), ''), coalesce(p_push, true), v_n, auth.uid());
  insert into public.journal_activite (acteur, action, table_cible) values (auth.uid(), 'diffusion_a_tous', 'diffusions');
  return jsonb_build_object('ok', true, 'destinataires', v_n);
end $$;

create or replace function public.admin_envoyer_a(p_user uuid, p_titre text, p_message text, p_mode text default 'les_deux')
 returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_type text; v_titre text; v_msg text;
begin
  if not securite.est_admin() then return jsonb_build_object('ok', false, 'message', 'Réservé à l''administration.'); end if;
  v_titre := btrim(coalesce(p_titre, '')); v_msg := btrim(coalesce(p_message, ''));
  if char_length(v_titre) < 3 or char_length(v_msg) < 3 then return jsonb_build_object('ok', false, 'message', 'Écrivez un titre et un message.'); end if;
  if not exists (select 1 from public.profils where id = p_user) then return jsonb_build_object('ok', false, 'message', 'Candidat introuvable.'); end if;
  v_type := case p_mode when 'cloche' then 'annonce' when 'plein' then 'annonce_popup' else 'annonce_plein' end;
  perform public.notifier(p_user, v_type, v_titre, v_msg, 'msg-' || gen_random_uuid()::text, null, true);
  insert into public.journal_activite (acteur, action, table_cible, ligne_cible) values (auth.uid(), 'message_a_un_candidat', 'profils', p_user);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.diffusions_liste()
 returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not securite.est_lecteur() then raise exception 'Réservé à l''équipe'; end if;
  return coalesce((select jsonb_agg(to_jsonb(d) - 'cree_par' order by d.cree_le desc)
                     from (select * from public.diffusions order by cree_le desc limit 40) d), '[]'::jsonb);
end $$;

/* ---------- 3. changement de code demandé ---------- */
create table if not exists public.demandes_code (
  user_id uuid primary key references public.profils(id) on delete cascade,
  demande_par uuid,
  cree_le timestamptz not null default now(),
  expire_le timestamptz not null default now() + interval '14 days'
);
alter table public.demandes_code enable row level security;

create or replace function public.admin_demander_changement_code(p_user uuid)
 returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_nom text;
begin
  if not securite.est_admin() then return jsonb_build_object('ok', false, 'message', 'Réservé à l''administration.'); end if;
  select nom into v_nom from public.profils where id = p_user;
  if not found then return jsonb_build_object('ok', false, 'message', 'Candidat introuvable.'); end if;
  insert into public.demandes_code (user_id, demande_par, cree_le, expire_le)
  values (p_user, auth.uid(), now(), now() + interval '14 days')
  on conflict (user_id) do update set demande_par = excluded.demande_par, cree_le = now(), expire_le = now() + interval '14 days';
  perform public.notifier(p_user, 'securite', 'Choisissez un nouveau code',
    'L''administration vous invite à choisir un nouveau code secret. Touchez ici, saisissez-le deux fois, et c''est fait.',
    'code-demande-' || extract(epoch from now())::bigint, 'nouveau-code:1', true);
  insert into public.journal_activite (acteur, action, table_cible, ligne_cible) values (auth.uid(), 'demande_changement_code', 'profils', p_user);
  return jsonb_build_object('ok', true, 'nom', v_nom);
end $$;

create or replace function public.mon_changement_code()
 returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.demandes_code where user_id = auth.uid() and expire_le > now());
$$;

create or replace function public.changer_mon_code(p_nouveau text, p_confirmation text)
 returns jsonb language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare v_user uuid := auth.uid(); v_tel text; v_code text; v_conf text;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'connexion', true, 'message', 'Connectez-vous d''abord.'); end if;
  if not exists (select 1 from public.demandes_code where user_id = v_user and expire_le > now()) then
    return jsonb_build_object('ok', false, 'message', 'Aucun changement de code n''est demandé pour votre compte.');
  end if;
  v_code := regexp_replace(coalesce(p_nouveau, ''), '\D', '', 'g');
  v_conf := regexp_replace(coalesce(p_confirmation, ''), '\D', '', 'g');
  if length(v_code) <> 4 then return jsonb_build_object('ok', false, 'message', 'Le nouveau code doit comporter 4 chiffres.'); end if;
  if v_code <> v_conf then return jsonb_build_object('ok', false, 'message', 'Les deux codes ne sont pas identiques.'); end if;
  select telephone into v_tel from public.profils where id = v_user;
  if v_tel is null then return jsonb_build_object('ok', false, 'message', 'Compte sans numéro : contactez l''administration.'); end if;
  update auth.users set encrypted_password = extensions.crypt(v_tel || '#' || v_code, extensions.gen_salt('bf')), updated_at = now()
   where id = v_user;
  delete from public.demandes_code where user_id = v_user;
  insert into public.journal_activite (acteur, action, table_cible, ligne_cible) values (v_user, 'code_change_par_le_candidat', 'profils', v_user);
  perform public.notifier(v_user, 'securite', 'Votre code a été changé',
    'Votre nouveau code est actif. Utilisez-le à votre prochaine connexion.', 'code-change-' || extract(epoch from now())::bigint, null, false);
  return jsonb_build_object('ok', true, 'message', 'Code changé.');
end $$;

/* ---------- 4. alertes push pour les administrateurs ---------- */
create table if not exists public.push_admin (
  endpoint text primary key,
  user_id uuid not null,
  p256dh text not null,
  auth text not null,
  cree_le timestamptz not null default now()
);
alter table public.push_admin enable row level security;
create table if not exists public.push_admin_file (
  id bigint generated always as identity primary key,
  cle text,
  titre text not null,
  message text not null,
  lien text,
  envoye boolean not null default false,
  cree_le timestamptz not null default now()
);
create unique index if not exists push_admin_file_cle on public.push_admin_file (cle) where cle is not null;
alter table public.push_admin_file enable row level security;

create or replace function public.enregistrer_push_admin(p_endpoint text, p_p256dh text, p_auth text)
 returns jsonb language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null or not securite.est_lecteur() then return jsonb_build_object('ok', false, 'message', 'Réservé à l''équipe.'); end if;
  if coalesce(p_endpoint, '') = '' or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    return jsonb_build_object('ok', false, 'message', 'Abonnement incomplet.');
  end if;
  insert into public.push_admin (endpoint, user_id, p256dh, auth) values (p_endpoint, auth.uid(), p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.retirer_push_admin(p_endpoint text)
 returns void language sql security definer set search_path to 'public' as $$
  delete from public.push_admin where endpoint = p_endpoint and user_id = auth.uid();
$$;

create or replace function public.alerter_admins(p_titre text, p_message text, p_lien text, p_cle text default null)
 returns void language plpgsql security definer set search_path to 'public' as $$
begin
  insert into public.push_admin_file (cle, titre, message, lien) values (p_cle, p_titre, p_message, p_lien)
  on conflict (cle) where cle is not null do nothing;
end $$;

create or replace function public.alerte_paiement() returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_nom text;
begin
  if new.statut = 'en_attente' then
    select nom into v_nom from public.profils where id = new.user_id;
    perform public.alerter_admins('Paiement à vérifier',
      coalesce(v_nom, 'Un candidat') || ' · ' || coalesce(new.montant_fcfa, 0) || ' F · ' || coalesce(new.formule, 'Pass') || ' · ' || coalesce(new.operateur, ''),
      '/admin.html#paiements', 'pai-' || new.id);
  end if;
  return new;
end $$;
drop trigger if exists alerte_paiement on public.paiements;
create trigger alerte_paiement after insert on public.paiements for each row execute function public.alerte_paiement();

create or replace function public.alerte_avis() returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_nom text;
begin
  select nom into v_nom from public.profils where id = new.user_id;
  perform public.alerter_admins('Nouvel avis', coalesce(v_nom, 'Un candidat') || ' : ' || left(new.message, 110), '/admin.html#avis', 'avis-' || new.id);
  return new;
end $$;
drop trigger if exists alerte_avis on public.avis;
create trigger alerte_avis after insert on public.avis for each row execute function public.alerte_avis();

create or replace function public.alerte_signalement() returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  perform public.alerter_admins('Question signalée', coalesce(new.motif, 'signalement') || coalesce(' : ' || left(new.commentaire, 100), ''), '/admin.html#signalements', 'sig-' || new.id);
  return new;
end $$;
drop trigger if exists alerte_signalement on public.signalements;
create trigger alerte_signalement after insert on public.signalements for each row execute function public.alerte_signalement();

create or replace function public.alerte_paiement_commence() returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_nom text;
begin
  if new.user_id is null then return new; end if;
  select nom into v_nom from public.profils where id = new.user_id;
  perform public.alerter_admins('Paiement en cours',
    coalesce(v_nom, 'Un candidat') || ' a commencé un paiement' || coalesce(' (' || (new.meta ->> 'formule') || ')', '') || '. Une capture peut arriver.',
    '/admin.html#paiements', 'start-' || new.user_id || '-' || floor(extract(epoch from now()) / 1200)::bigint);
  return new;
end $$;
drop trigger if exists alerte_paiement_commence on public.evenements;
create trigger alerte_paiement_commence after insert on public.evenements
  for each row when (new.nom = 'PAYMENT_STARTED') execute function public.alerte_paiement_commence();

create or replace function public.rappel_expire(p_endpoint text) returns void language sql security definer set search_path to 'public' as $$
  delete from public.push_abonnements where endpoint = p_endpoint;
  delete from public.push_admin where endpoint = p_endpoint;
$$;

/* la file d'envoi gagne une quatrième source : les alertes des administrateurs */
create or replace function public.envois_a_faire()
 returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_res jsonb := '[]'::jsonb; v_r2 jsonb := '[]'::jsonb; v_r3 jsonb := '[]'::jsonb; v_r4 jsonb := '[]'::jsonb;
  v_min int := extract(hour from now() at time zone 'UTC')::int * 60 + extract(minute from now() at time zone 'UTC')::int;
begin
  perform public.preparer_relances_reprise();
  perform public.preparer_relances_retour();
  perform public.preparer_relances_abonnement();
  perform public.notifier_absents_epreuves();

  with dus as (
    select a.endpoint, a.p256dh, a.auth, a.user_id,
           (select count(*) from public.erreurs_utilisateur e where e.user_id = a.user_id and not e.acquise and e.revoir_le <= current_date) erreurs,
           (select m.nom from public.erreurs_utilisateur e join public.questions q on q.id = e.question_id join public.matieres m on m.id = q.matiere_id
             where e.user_id = a.user_id and not e.acquise and e.revoir_le <= current_date
             group by m.nom order by count(*) desc limit 1) matiere_faible
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
      'message', case when erreurs > 0 and matiere_faible is not null then 'Vous avez '|| erreurs || ' erreur' || case when erreurs > 1 then 's' else '' end || ' à revoir, surtout en ' || matiere_faible || '. Dix minutes suffisent pour avancer.'
                      when erreurs > 0 then erreurs || ' erreur' || case when erreurs > 1 then 's' else '' end
                        || ' à revoir aujourd''hui. Dix minutes suffisent pour avancer.'
                      else 'Votre rappel du jour : quelques questions, et la série continue.' end,
      'lien', '/?depuis=rappel')), '[]'::jsonb)
    into v_res from marques;

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
                     || ' jours de travail cette semaine.'
                     || coalesce((select ' Vous progressez en ' || x.nom || ' : ' || x.t1 || ' % de réussite cette semaine.'
                        from (select m.nom,
                                     round(100.0 * avg(t.correcte::int) filter (where t.cree_le >= date_trunc('week', now())))::int t1,
                                     round(100.0 * avg(t.correcte::int) filter (where t.cree_le < date_trunc('week', now())))::int t0,
                                     count(*) filter (where t.cree_le >= date_trunc('week', now())) n
                                from public.tentatives_question t
                                join public.questions q on q.id = t.question_id
                                join public.matieres m on m.id = q.matiere_id
                               where t.user_id = a.user_id and t.cree_le >= date_trunc('week', now()) - interval '7 days'
                               group by m.nom) x
                       where x.n >= 5 and x.t0 is not null and x.t1 > x.t0
                       order by x.t1 - x.t0 desc limit 1), '')
                     || ' Une nouvelle semaine commence demain.',
        'lien', '/?depuis=hebdo')), '[]'::jsonb)
      into v_r2 from cibles c join public.push_abonnements a on a.endpoint = c.endpoint;
  end if;

  with f as (
    update public.push_file set envoye = true
     where id in (select id from public.push_file where not envoye and cree_le > now() - interval '1 day' order by id limit 500)
    returning *
  )
  select coalesce(jsonb_agg(jsonb_build_object('endpoint', a.endpoint, 'p256dh', a.p256dh, 'auth', a.auth,
      'titre', f.titre, 'message', f.message, 'lien', f.lien)), '[]'::jsonb)
    into v_r3 from f join public.push_abonnements a on a.user_id = f.user_id and a.actif;

  with fa as (
    update public.push_admin_file set envoye = true
     where id in (select id from public.push_admin_file where not envoye and cree_le > now() - interval '1 day' order by id limit 100)
    returning *
  )
  select coalesce(jsonb_agg(jsonb_build_object('endpoint', a.endpoint, 'p256dh', a.p256dh, 'auth', a.auth,
      'titre', fa.titre, 'message', fa.message, 'lien', fa.lien)), '[]'::jsonb)
    into v_r4 from fa cross join public.push_admin a;

  return v_res || v_r2 || v_r3 || v_r4;
end $$;

/* ---------- droits : réservé aux connectés, jamais aux visiteurs anonymes ---------- */
revoke all on function public.admin_repondre_avis(bigint, text, text) from public, anon;
revoke all on function public.admin_aimer_avis(bigint, boolean) from public, anon;
revoke all on function public.cible_diffusion(text) from public, anon, authenticated;
revoke all on function public.admin_compter_cible(text) from public, anon;
revoke all on function public.admin_diffuser(text, text, text, text, text, boolean) from public, anon;
revoke all on function public.admin_envoyer_a(uuid, text, text, text) from public, anon;
revoke all on function public.diffusions_liste() from public, anon;
revoke all on function public.admin_demander_changement_code(uuid) from public, anon;
revoke all on function public.mon_changement_code() from public, anon;
revoke all on function public.changer_mon_code(text, text) from public, anon;
revoke all on function public.enregistrer_push_admin(text, text, text) from public, anon;
revoke all on function public.retirer_push_admin(text) from public, anon;
revoke all on function public.alerter_admins(text, text, text, text) from public, anon, authenticated;
revoke all on function public.avis_liste(integer) from public, anon;
grant execute on function public.admin_repondre_avis(bigint, text, text) to authenticated;
grant execute on function public.admin_aimer_avis(bigint, boolean) to authenticated;
grant execute on function public.admin_compter_cible(text) to authenticated;
grant execute on function public.admin_diffuser(text, text, text, text, text, boolean) to authenticated;
grant execute on function public.admin_envoyer_a(uuid, text, text, text) to authenticated;
grant execute on function public.diffusions_liste() to authenticated;
grant execute on function public.admin_demander_changement_code(uuid) to authenticated;
grant execute on function public.mon_changement_code() to authenticated;
grant execute on function public.changer_mon_code(text, text) to authenticated;
grant execute on function public.enregistrer_push_admin(text, text, text) to authenticated;
grant execute on function public.retirer_push_admin(text) to authenticated;
grant execute on function public.avis_liste(integer) to authenticated;
