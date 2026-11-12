-- Blocus secondaire (décision du 12 novembre 2026)
-- Un candidat sans abonnement qui a déjà 6 jours actifs (au moins une réponse ce jour-là)
-- et qui a déjà rencontré une limite gratuite devient « habitué » au calcul de la nuit :
-- dès son 7e jour actif, il n'a plus qu'une séance de 5 questions corrigées par jour
-- (révision, erreurs, Pour toi, séance du jour confondus) ; compositions et nationales
-- passent par l'abonnement. S'il paie, tout s'ouvre ; si l'abonnement expire, la règle revient.

create table if not exists securite.habitues_gratuits (
  user_id uuid primary key,
  depuis timestamptz not null default now(),
  jours int not null default 0,
  reponses int not null default 0,
  maj_le timestamptz not null default now()
);
alter table securite.habitues_gratuits enable row level security;
revoke all on securite.habitues_gratuits from public, anon, authenticated;

create or replace function securite.est_habitue(p_user uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from securite.habitues_gratuits where user_id = p_user);
$$;

-- Ce que le candidat a fait : sert au message du mur, selon ce qu'il fait le plus
create or replace function securite.bilan_habitue(p_user uuid)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'jours', coalesce(h.jours, 0),
    'reponses', coalesce(h.reponses, 0),
    'erreurs', (select count(*) from public.erreurs_utilisateur e where e.user_id = p_user and not e.acquise),
    'compositions', (select count(*) from public.compositions c where c.user_id = p_user and c.nb_traitees >= 10),
    'faites_jour', (select count(*) from public.tentatives_question t where t.user_id = p_user
                     and t.contexte in ('revision', 'erreurs') and t.cree_le >= date_trunc('day', now())))
  from (select 1) x left join securite.habitues_gratuits h on h.user_id = p_user;
$$;

-- Calcul de la nuit (03 h 10). p_simulation = true : compte sans rien écrire.
create or replace function securite.calculer_habitues(p_simulation boolean default false)
returns int language plpgsql security definer set search_path to 'public' as $$
declare v_n int;
begin
  drop table if exists _hab;
  create temp table _hab on commit drop as
  select j.user_id, j.jours, j.reponses
    from (select user_id, count(distinct (cree_le at time zone 'UTC')::date)::int jours, count(*)::int reponses
            from public.tentatives_question where user_id is not null
           group by user_id having count(distinct (cree_le at time zone 'UTC')::date) >= 6) j
   where not securite.est_abonne(j.user_id)
     and not exists (select 1 from public.roles_utilisateur r where r.user_id = j.user_id and r.role <> 'candidat')
     and (exists (select 1 from public.evenements e where e.user_id = j.user_id and e.nom = 'PAYWALL_VIEWED')
          or (select count(*) from public.compositions c where c.user_id = j.user_id and c.nb_traitees >= 10) >= 3);
  select count(*) into v_n from _hab h where not exists (select 1 from securite.habitues_gratuits g where g.user_id = h.user_id);
  if not p_simulation then
    insert into securite.habitues_gratuits (user_id, jours, reponses)
    select user_id, jours, reponses from _hab
    on conflict (user_id) do update set jours = excluded.jours, reponses = excluded.reponses, maj_le = now();
  end if;
  return v_n;
end $$;

revoke all on function securite.est_habitue(uuid), securite.bilan_habitue(uuid), securite.calculer_habitues(boolean) from public, anon, authenticated;

-- Pour le site : savoir si le candidat est concerné, avec ses chiffres
create or replace function public.mon_statut_gratuit()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null or securite.est_abonne(v_user) or securite.est_equipe() or not securite.est_habitue(v_user) then
    return jsonb_build_object('habitue', false);
  end if;
  return securite.bilan_habitue(v_user) || jsonb_build_object('habitue', true, 'seance', 5);
end $$;
revoke all on function public.mon_statut_gratuit() from public, anon;
grant execute on function public.mon_statut_gratuit() to authenticated;

-- Les trois portes du serveur
do $$
declare d text; a text; n text;
begin
  -- 1. corrections : 5 par jour au total pour un habitué
  d := pg_get_functiondef('public.corriger_question'::regproc);
  a := E'  v_abonne := securite.est_abonne(v_user) or securite.est_equipe();\n';
  n := a || E'  if not v_abonne and securite.est_habitue(v_user) then\n'
           || E'    select count(*) into v_faites from public.tentatives_question\n'
           || E'     where user_id = v_user and contexte in (''revision'', ''erreurs'') and cree_le >= date_trunc(''day'', now());\n'
           || E'    if v_faites >= c_jour then\n'
           || E'      return jsonb_build_object(''ok'', false, ''quota'', true, ''motif'', ''habitue'', ''habitue'', securite.bilan_habitue(v_user),\n'
           || E'        ''message'', ''Ta séance gratuite du jour est faite. Elle revient demain, ou sans limite avec l''''abonnement.'');\n'
           || E'    end if;\n'
           || E'    if p_contexte = ''erreurs'' then v_restant := c_jour - v_faites - 1; end if;\n'
           || E'  end if;\n';
  if position(a in d) = 0 then raise exception 'ancre corriger_question introuvable'; end if;
  if position('est_habitue' in d) = 0 then execute replace(d, a, n); end if;

  -- 2. compositions d'entraînement
  d := pg_get_functiondef('public.ouvrir_composition'::regproc);
  a := E'    if not v_libre then\n      select count(*) into v_deja';
  n := E'    if not v_libre and securite.est_habitue(v_user) then\n'
    || E'      return jsonb_build_object(''ok'', false, ''abonnement'', true, ''offre'', ''composition'', ''habitue'', securite.bilan_habitue(v_user),\n'
    || E'        ''message'', ''Les compositions chronométrées font partie de l''''abonnement.'');\n'
    || E'    end if;\n' || a;
  if position(a in d) = 0 then raise exception 'ancre ouvrir_composition introuvable'; end if;
  if position('est_habitue' in d) = 0 then execute replace(d, a, n); end if;

  -- 3. compositions nationales (une copie déjà commencée reste accessible)
  d := pg_get_functiondef('public.rejoindre_epreuve'::regproc);
  a := E'  select * into v_ep from public.epreuves_collectives where id = p_epreuve and statut = ''programmee'';\n';
  n := E'  if not (securite.est_abonne(v_user) or securite.est_equipe()) and securite.est_habitue(v_user)\n'
    || E'     and not exists (select 1 from public.compositions c1 where c1.user_id = v_user and c1.epreuve_id = p_epreuve) then\n'
    || E'    return jsonb_build_object(''ok'', false, ''abonnement'', true, ''nationale'', true, ''habitue'', securite.bilan_habitue(v_user),\n'
    || E'      ''message'', ''Les compositions nationales font partie de l''''abonnement.'');\n'
    || E'  end if;\n' || a;
  if position(a in d) = 0 then raise exception 'ancre rejoindre_epreuve introuvable'; end if;
  if position('est_habitue' in d) = 0 then execute replace(d, a, n); end if;
end $$;

-- Chaque nuit à 03 h 10 (heure du Burkina), dans la fenêtre des travaux lourds
select cron.unschedule(jobid) from cron.job where jobname = 'blocus-habitues';
select cron.schedule('blocus-habitues', '10 3 * * *', $$select securite.calculer_habitues(false)$$);
