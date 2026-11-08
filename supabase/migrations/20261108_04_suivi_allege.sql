-- 8 novembre 2026 — Le suivi des événements ne grossit plus.
-- 621 000 lignes, 7 index, 4 déclencheurs à chaque ajout : c'était le plus gros poids de la base.
-- Les 11 types d'événements très bavards (clics, défilement, écrans, réponses) ne sont gardés
-- que 30 minutes. Avant d'être effacés, leurs totaux sont gardés par heure.
-- Tous les autres événements (paiement, abonnement, inscription, parcours, sessions…) restent.
-- Nettoyage par lots de 10 000 toutes les 5 minutes, jamais pendant une composition.

create table if not exists public.evenements_horaires (
  heure timestamptz not null,
  nom   text not null,
  ecran text not null default '',
  n     bigint not null default 0,
  primary key (heure, nom, ecran)
);
alter table public.evenements_horaires enable row level security;
revoke all on public.evenements_horaires from anon, authenticated;

create or replace function public.purger_evenements(p_lot int default 10000)
 returns int
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_n int := 0;
begin
  if not pg_try_advisory_xact_lock(hashtext('purger_evenements')) then return 0; end if;
  with v as (
    select id, nom, coalesce(ecran, '') as ecran, date_trunc('hour', cree_le) as h
      from public.evenements
     where cree_le < now() - interval '30 minutes'
       and nom = any (array['BUTTON_CLICKED','SCROLL_DEPTH_REACHED','SCREEN_VIEWED','SCREEN_LEFT',
                            'COMPOSITION_ANSWER_SELECTED','APP_BACKGROUND','APP_FOREGROUND',
                            'QUESTION_ANSWERED','DIAGNOSTIC_ANSWER_SELECTED','ERROR_REATTEMPTED','ERROR_FIXED'])
     order by cree_le
     limit greatest(100, least(coalesce(p_lot, 10000), 50000))
  ), agg as (
    select h, nom, ecran, count(*) as n from v group by 1, 2, 3
  ), ins as (
    insert into public.evenements_horaires (heure, nom, ecran, n)
    select h, nom, ecran, n from agg
    on conflict (heure, nom, ecran) do update set n = public.evenements_horaires.n + excluded.n
    returning 1
  ), del as (
    delete from public.evenements e using v where e.id = v.id returning 1
  )
  select count(*) into v_n from del;
  return v_n;
end $function$;
revoke all on function public.purger_evenements(int) from public, anon, authenticated;

select cron.schedule('purger-evenements', '*/5 * * * *',
  'set statement_timeout=''60s''; do $$ begin if not public.fenetre_composition() then perform public.purger_evenements(); end if; end $$;');
