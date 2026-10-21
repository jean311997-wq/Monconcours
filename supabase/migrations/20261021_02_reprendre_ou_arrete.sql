-- =====================================================================
-- « Reprendre là où l'on s'est arrêté »
--
-- L'application retient où le candidat a quitté (chapitre d'une leçon,
-- question d'un QCM). Si le candidat est parti en plein milieu et n'est pas
-- revenu au bout d'un moment, une notification lui demande s'il veut
-- reprendre ; un toucher le ramène au bon endroit.
--
-- Règles de la notification :
--   · seulement si le candidat a quitté il y a plus de 1 h 30 et moins de 22 h ;
--   · pas s'il a répondu à d'autres questions depuis ;
--   · une seule par jour au plus, jamais la nuit (heure du Burkina = UTC) ;
--   · seulement s'il a activé les rappels (abonnement actif).
-- =====================================================================

-- 1. Où le candidat s'est arrêté : une ligne par candidat (le dernier endroit).
create table if not exists public.reprises (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  type             text not null check (type in ('cours', 'qcm')),
  matiere          text not null,
  position         int  not null default 0,   -- cours : chapitre (à partir de 0) ; qcm : prochaine question (à partir de 0)
  total            int  not null default 0,
  titre            text,
  maj_le           timestamptz not null default now(),
  derniere_relance date,
  terminee         boolean not null default false  -- cours lu en entier, QCM fini : plus rien à reprendre
);
alter table public.reprises enable row level security;
-- aucune règle d'accès : seules les fonctions ci-dessous touchent à cette table
revoke all on public.reprises from anon, authenticated;

-- 2. Le candidat note l'endroit où il en est.
create or replace function public.noter_reprise(p_type text, p_matiere text, p_position int, p_total int, p_titre text default null)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if auth.uid() is null or p_type not in ('cours', 'qcm') then return; end if;
  if coalesce(trim(p_matiere), '') = '' then return; end if;
  insert into public.reprises (user_id, type, matiere, position, total, titre, maj_le, terminee)
  values (auth.uid(), p_type, left(trim(p_matiere), 80),
          least(greatest(coalesce(p_position, 0), 0), 100000),
          least(greatest(coalesce(p_total, 0), 0), 100000),
          left(trim(coalesce(p_titre, '')), 120), now(), false)
  on conflict (user_id) do update
    set type = excluded.type, matiere = excluded.matiere, position = excluded.position,
        total = excluded.total, titre = excluded.titre, maj_le = now(), terminee = false;
end $function$;

-- 3. Le cours est terminé ou le QCM est fini : plus rien à reprendre.
create or replace function public.clore_reprise(p_type text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if auth.uid() is null then return; end if;
  update public.reprises set terminee = true where user_id = auth.uid() and type = p_type;
end $function$;

revoke execute on function public.noter_reprise(text, text, int, int, text) from public, anon;
revoke execute on function public.clore_reprise(text) from public, anon;
grant  execute on function public.noter_reprise(text, text, int, int, text) to authenticated;
grant  execute on function public.clore_reprise(text) to authenticated;

-- 4. Prépare les notifications « Voulez-vous reprendre ? » dans la file d'envoi.
create or replace function public.preparer_relances_reprise()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_h int := extract(hour from now() at time zone 'UTC')::int;
begin
  if v_h < 7 or v_h >= 21 then return; end if;
  with cibles as (
    update public.reprises r set derniere_relance = current_date
     where not r.terminee
       and r.maj_le < now() - interval '90 minutes'
       and r.maj_le > now() - interval '22 hours'
       and r.derniere_relance is distinct from current_date
       and exists (select 1 from public.push_abonnements a where a.user_id = r.user_id and a.actif)
       and not exists (select 1 from public.tentatives_question t where t.user_id = r.user_id and t.cree_le > r.maj_le)
    returning r.user_id, r.type, r.matiere, r.position, r.total
  )
  insert into public.push_file (user_id, titre, message, lien)
  select c.user_id,
         case when c.type = 'cours' then 'Reprenez votre lecture' else 'Reprenez votre QCM' end,
         case when c.type = 'cours'
              then 'Vous en étiez au chapitre ' || (c.position + 1)
                   || case when c.total > 0 then ' sur ' || c.total else '' end
                   || ' de ' || c.matiere || '. Voulez-vous reprendre là où vous vous êtes arrêté ?'
              else c.matiere || ' : vous vous étiez arrêté à la question ' || (c.position + 1)
                   || '. Voulez-vous reprendre là où vous vous êtes arrêté ?' end,
         '/?reprendre=' || c.type
    from cibles c;
end $function$;

revoke execute on function public.preparer_relances_reprise() from public, anon, authenticated;

-- 5. Le service d'envoi existant (appelé toutes les 15 minutes) prépare ces
--    rappels avant de distribuer la file. Seule la première ligne est nouvelle.
CREATE OR REPLACE FUNCTION public.envois_a_faire()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_res jsonb := '[]'::jsonb; v_r2 jsonb := '[]'::jsonb; v_r3 jsonb := '[]'::jsonb;
  v_min int := extract(hour from now() at time zone 'UTC')::int * 60 + extract(minute from now() at time zone 'UTC')::int;
begin
  perform public.preparer_relances_reprise();

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
                     || ' jours de travail cette semaine. Une nouvelle semaine commence demain.',
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

  return v_res || v_r2 || v_r3;
end $function$;
