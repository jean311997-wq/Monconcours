-- 8 novembre 2026 — Les tâches lourdes ne tournent pas pendant une composition.
-- Fenêtre : de 15 minutes avant le début à 45 minutes après la fin d'une composition programmée.
-- Les tâches qui annoncent la composition (composition-annonces, composition-non-inscrits)
-- et les rappels (rappels-push) continuent de tourner : elles sont légères et nécessaires.

create or replace function public.fenetre_composition()
 returns boolean
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1 from public.epreuves_collectives e
     where e.statut = 'programmee'
       and now() between e.debut_le - interval '15 minutes' and e.fin_le + interval '45 minutes'
  );
$function$;
revoke all on function public.fenetre_composition() from public, anon, authenticated;

select cron.alter_job((select jobid from cron.job where jobname = 'bilan-fin-essai'),
  command := 'do $$ begin if not public.fenetre_composition() then perform public.bilan_fin_essai(); end if; end $$;');
select cron.alter_job((select jobid from cron.job where jobname = 'cache-admin'),
  command := 'set statement_timeout=''10min''; do $$ begin if not public.fenetre_composition() then perform securite.rafraichir_cache_admin(); end if; end $$;');
select cron.alter_job((select jobid from cron.job where jobname = 'cache-admin-periodes'),
  command := 'set statement_timeout=''10min''; do $$ begin if not public.fenetre_composition() then perform securite.rafraichir_cache_admin_periodes(); end if; end $$;');
select cron.alter_job((select jobid from cron.job where jobname = 'calendrier-nouveaux'),
  command := 'do $$ begin if not public.fenetre_composition() then perform public.calendrier_nouveaux(); end if; end $$;');
select cron.alter_job((select jobid from cron.job where jobname = 'communaute-auto'),
  command := 'do $$ begin if not public.fenetre_composition() then perform public.communaute_auto_publier(); end if; end $$;');
select cron.alter_job((select jobid from cron.job where jobname = 'rappel-chaine-admin'),
  command := 'do $$ begin if not public.fenetre_composition() then perform public.rappel_chaine_admin(); end if; end $$;');
select cron.alter_job((select jobid from cron.job where jobname = 'relance-paiements'),
  command := 'do $$ begin if not public.fenetre_composition() then perform public.relancer_paiements_inacheves(); end if; end $$;');
select cron.alter_job((select jobid from cron.job where jobname = 'relances-preparer'),
  command := 'do $$ begin if not public.fenetre_composition() then perform public.preparer_relances(); end if; end $$;');
