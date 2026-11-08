-- 8 novembre 2026 — Cause des pannes du 5, du 6 et du 7 novembre.
-- La tâche « rappels-push » tourne chaque minute. Elle appelait envois_a_faire(),
-- qui recalculait à chaque passage quatre séries de relances en parcourant
-- les inscrits un par un (1 198 comptes pour les relances d'abonnement,
-- 268 inscrits pour les absents de la composition…). Un passage prenait
-- 18 s en moyenne, jusqu'à 81 s : les passages se chevauchaient, la base
-- saturait et l'API renvoyait des erreurs. Plus il y a d'inscrits, plus c'est lourd.
--
-- Correction :
--  1. envois_a_faire() ne fait plus qu'envoyer ce qui est prêt, et jamais deux fois en même temps.
--  2. Les relances sont préparées par une tâche à part, toutes les 10 minutes, jamais deux fois en même temps.
--  3. Les relances d'abonnement ne parcourent plus que les comptes dont la relance du moment n'est pas encore partie.
--  4. « Terminée sans vous » : seulement aux inscrits qui ne sont pas entrés en salle, et une seule fois.

-- 1. Envoi seul, un passage à la fois -------------------------------------------
create or replace function public.envois_a_faire()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_res jsonb := '[]'::jsonb; v_r2 jsonb := '[]'::jsonb; v_r3 jsonb := '[]'::jsonb; v_r4 jsonb := '[]'::jsonb;
  v_min int := extract(hour from now() at time zone 'UTC')::int * 60 + extract(minute from now() at time zone 'UTC')::int;
begin
  /* un passage encore en cours : celui-ci ne fait rien, le suivant reprendra */
  if not pg_try_advisory_xact_lock(hashtext('envois_a_faire')) then return '[]'::jsonb; end if;

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
end $function$;

-- 2. Préparation des relances : tâche à part, toutes les 10 minutes -----------------
create or replace function public.preparer_relances()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not pg_try_advisory_xact_lock(hashtext('preparer_relances')) then return; end if;
  perform public.preparer_relances_reprise();
  perform public.preparer_relances_retour();
  perform public.preparer_relances_abonnement();
  perform public.notifier_absents_epreuves();
end $function$;
revoke all on function public.preparer_relances() from public, anon, authenticated;

-- 3. Relances d'abonnement : seulement les comptes dont la relance du moment n'est pas partie
create or replace function public.preparer_relances_abonnement()
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'securite'
as $function$
declare
  v_h int := extract(hour from now() at time zone 'UTC')::int;
  r record; v_msg text;
begin
  perform public.preparer_relances_fin_essai();
  if v_h < 7 or v_h >= 21 then return; end if;
  for r in
    with c as (
      select p.id, floor(extract(epoch from now() - p.cree_le) / 60)::int as minutes
        from public.profils p
       where p.cree_le > now() - interval '60 days'
         and not exists (select 1 from public.roles_utilisateur ru where ru.user_id = p.id)
    ), s as (
      /* même palier qu'avant : 30, 60, 120, 300 min, puis chaque jour */
      select id, case when minutes < 30 then null
                      when minutes < 60 then 30
                      when minutes < 120 then 60
                      when minutes < 300 then 120
                      when minutes < 1440 then 300
                      else 1440 * least(floor(minutes / 1440.0)::int, 60) end as pas
        from c
    )
    select s.id, s.pas from s
     where s.pas is not null
       and not exists (select 1 from public.notifications n where n.user_id = s.id and n.cle_unicite = 'abo-' || s.pas)
  loop
    continue when securite.est_abonne(r.id);
    v_msg := case when r.pas < 1440
      then 'Faites votre abonnement pour profiter de tout, sans limite. Choisissez l''abonnement qui vous convient.'
      else 'Votre préparation vous attend. Faites votre abonnement pour réviser et composer sans limite.' end;
    perform public.notifier(r.id, 'abonnement', 'Profitez de tout, sans limite', v_msg, 'abo-' || r.pas, 'abonnement', true);
  end loop;
end $function$;

-- 4. « Terminée sans vous » : seulement ceux qui ne sont pas entrés en salle, une seule fois
create or replace function public.notifier_absents_epreuves()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare r record;
begin
  for r in
    select i.user_id, e.id epreuve, e.places,
           (select count(*) from public.compositions c where c.epreuve_id = e.id and c.terminee) participants
      from public.epreuves_collectives e
      join public.inscriptions_epreuve i on i.epreuve_id = e.id
     where e.statut = 'programmee' and e.fin_le <= now() and e.fin_le > now() - interval '7 days'
       and not exists (select 1 from public.compositions c where c.epreuve_id = e.id and c.user_id = i.user_id)
       and not exists (select 1 from public.notifications n where n.user_id = i.user_id and n.cle_unicite = 'absent-' || e.id)
  loop
    perform public.notifier(r.user_id, 'resultat',
      'La composition est terminée sans vous',
      'Vous étiez inscrit, mais vous n''avez pas composé. Le classement est publié : ' || r.participants
        || ' candidat' || case when r.participants > 1 then 's' else '' end || ', ' || r.places
        || ' postes à pourvoir. Touchez pour le consulter.',
      'absent-' || r.epreuve, 'epreuve:' || r.epreuve, true);
  end loop;
end $function$;

-- index pour compter les participants d'une épreuve sans parcourir toutes les compositions
create index if not exists idx_compositions_epreuve on public.compositions (epreuve_id) where epreuve_id is not null;

-- la nouvelle tâche des relances
select cron.schedule('relances-preparer', '*/10 * * * *', 'select public.preparer_relances();');
