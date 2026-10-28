-- Administration · période libre (du … au …) pour les cinq lectures qui ne savaient compter que « les N derniers jours ».
-- Les appels existants (p_jours seul) continuent de fonctionner : p_du et p_au sont facultatifs.


create or replace function public.clics_boutons_p(p_jours integer default 30, p_du date default null, p_au date default null)
 returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare d timestamptz := case when p_du is not null then p_du::timestamptz else now() - (p_jours || ' days')::interval end;
        f timestamptz := case when p_au is not null then (p_au + 1)::timestamptz else 'infinity'::timestamptz end;
begin
  if not securite.est_lecteur() then raise exception 'Réservé à l''équipe'; end if;
  return coalesce((
    select jsonb_agg(x order by (x->>'clics')::int desc)
    from (
      select jsonb_build_object('element', element, 'ecran', ecran, 'clics', count(*),
        'personnes', count(distinct coalesce(user_id::text, session_id::text)), 'temps_moyen_ms', round(avg(delta_ms))) as x
      from public.evenements
      where nom = 'BUTTON_CLICKED' and cree_le >= d and cree_le < f and element is not null
      group by element, ecran
      order by count(*) desc
      limit 60
    ) t
  ), '[]'::jsonb);
end $$;

create or replace function public.ecrans_p(p_jours integer default 30, p_du date default null, p_au date default null)
 returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare d timestamptz := case when p_du is not null then p_du::timestamptz else now() - (p_jours || ' days')::interval end;
        f timestamptz := case when p_au is not null then (p_au + 1)::timestamptz else 'infinity'::timestamptz end;
begin
  if not securite.est_lecteur() then raise exception 'Réservé à l''équipe'; end if;
  return coalesce((
    select jsonb_agg(x order by (x->>'vues')::int desc)
    from (
      select jsonb_build_object('ecran', ecran, 'vues', count(*),
        'personnes', count(distinct coalesce(user_id::text, session_id::text)), 'sorties', count(*) filter (where derniere)) as x
      from (
        select ecran, user_id, session_id,
               row_number() over (partition by session_id order by cree_le desc) = 1 as derniere
        from public.evenements
        where nom = 'SCREEN_VIEWED' and cree_le >= d and cree_le < f and ecran is not null
      ) e
      group by ecran
    ) t
  ), '[]'::jsonb);
end $$;

create or replace function public.entonnoir_p(p_jours integer default 30, p_du date default null, p_au date default null)
 returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare d timestamptz := case when p_du is not null then p_du::timestamptz else now() - (p_jours || ' days')::interval end;
        f timestamptz := case when p_au is not null then (p_au + 1)::timestamptz else 'infinity'::timestamptz end;
begin
  if not securite.est_lecteur() then raise exception 'Réservé à l''équipe'; end if;
  return (
    select jsonb_agg(jsonb_build_object('etape', e.etape, 'ordre', e.ordre, 'nombre', e.nb) order by e.ordre)
    from (
      select 'Arrivée' as etape, 1 as ordre,
             (select count(distinct session_id) from public.evenements where cree_le >= d and cree_le < f) as nb
      union all select 'Engagement accepté', 2,
             (select count(distinct session_id) from public.evenements where nom='ONBOARDING_STEP_COMPLETED' and ecran='engagement' and cree_le >= d and cree_le < f)
      union all select 'Test commencé', 3,
             (select count(distinct session_id) from public.evenements where nom='DIAGNOSTIC_STARTED' and cree_le >= d and cree_le < f)
      union all select 'Test terminé', 4,
             (select count(distinct session_id) from public.evenements where nom='DIAGNOSTIC_COMPLETED' and cree_le >= d and cree_le < f)
      union all select 'Entré dans l''application', 5,
             (select count(distinct session_id) from public.evenements where nom='APP_ENTERED' and cree_le >= d and cree_le < f)
      union all select 'Compte créé', 6,
             (select count(*) from public.profils where cree_le >= d and cree_le < f)
      union all select 'Première composition', 7,
             (select count(distinct user_id) from public.compositions where debut_le >= d and debut_le < f)
      union all select 'Composition terminée', 8,
             (select count(distinct user_id) from public.compositions where debut_le >= d and debut_le < f and terminee)
    ) e
  );
end $$;

create or replace function public.stats_generales_p(p_jours integer default 7, p_du date default null, p_au date default null)
 returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare r jsonb;
        d timestamptz := case when p_du is not null then p_du::timestamptz else now() - (p_jours || ' days')::interval end;
        f timestamptz := case when p_au is not null then (p_au + 1)::timestamptz else 'infinity'::timestamptz end;
begin
  if not securite.est_lecteur() then raise exception 'Réservé à l''équipe'; end if;
  select jsonb_build_object(
    'candidats',      (select count(*) from public.profils),
    'nouveaux',       (select count(*) from public.profils where cree_le >= d and cree_le < f),
    'sessions',       (select count(*) from public.sessions where debut_le >= d and debut_le < f),
    'visiteurs',      (select count(distinct coalesce(user_id::text, id::text)) from public.sessions where debut_le >= d and debut_le < f),
    'dau',            (select count(distinct coalesce(user_id::text, id::text)) from public.sessions where debut_le >= now() - interval '1 day'),
    'wau',            (select count(distinct coalesce(user_id::text, id::text)) from public.sessions where debut_le >= now() - interval '7 days'),
    'mau',            (select count(distinct coalesce(user_id::text, id::text)) from public.sessions where debut_le >= now() - interval '30 days'),
    'evenements',     (select count(*) from public.evenements where cree_le >= d and cree_le < f),
    'compositions_debut', (select count(*) from public.compositions where debut_le >= d and debut_le < f),
    'compositions_fin',   (select count(*) from public.compositions where debut_le >= d and debut_le < f and terminee),
    'questions_repondues',(select count(*) from public.tentatives_question where cree_le >= d and cree_le < f),
    'taux_reussite',  (select coalesce(round(100.0 * count(*) filter (where correcte) / nullif(count(*),0)), 0)
                         from public.tentatives_question where cree_le >= d and cree_le < f),
    'erreurs_ouvertes',(select count(*) from public.erreurs_utilisateur where not acquise),
    'erreurs_acquises',(select count(*) from public.erreurs_utilisateur where acquise),
    'abonnes',        (select count(distinct user_id) from public.abonnements where formule <> 'essai' and fin_le > now()),
    'essais_en_cours',(select count(distinct user_id) from public.abonnements where formule = 'essai' and fin_le > now()),
    'paiements',      (select count(*) from public.paiements where statut = 'reussi'),
    'erreurs_tech',   (select count(*) from public.evenements where nom = 'ERROR_OCCURRED' and cree_le >= d and cree_le < f)
  ) into r;
  return r;
end $$;

create or replace function public.tableau_de_bord_p(p_jours integer default 30, p_du date default null, p_au date default null)
 returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_fin date := least(coalesce(p_au, current_date), current_date);
        v_j int := case when p_du is not null then least(greatest(least(coalesce(p_au, current_date), current_date) - least(p_du, least(coalesce(p_au, current_date), current_date)) + 1, 1), 366)
                        else least(greatest(coalesce(p_jours, 30), 7), 90) end;
        v_debut date;
        v_fin1 date;
begin
  if not securite.est_lecteur() then raise exception 'réservé à l''équipe'; end if;
  v_debut := v_fin - (v_j - 1); v_fin1 := v_fin + 1;
  return jsonb_build_object(
    'maintenant', now(),
    'inscrits', (select count(*) from profils),
    'nouveaux_jour', (select count(*) from profils where cree_le >= current_date),
    'nouveaux_7j', (select count(*) from profils where cree_le >= current_date - 6),
    'nouveaux_7j_avant', (select count(*) from profils where cree_le >= current_date - 13 and cree_le < current_date - 6),
    'actifs_jour', (select count(distinct u) from (
        select user_id u from evenements where cree_le >= current_date and user_id is not null
        union select user_id from assiduite where jour = current_date) z),
    'actifs_7j', (select count(distinct u) from (
        select user_id u from evenements where cree_le >= current_date - 6 and user_id is not null
        union select user_id from assiduite where jour >= current_date - 6) z),
    'visiteurs_jour', (select count(distinct coalesce(user_id::text, session_id::text)) from evenements where cree_le >= current_date),
    'en_ligne', (select count(distinct coalesce(user_id::text, session_id::text)) from evenements where cree_le > now() - interval '5 minutes'),
    'en_ligne_comptes', (select count(distinct user_id) from evenements where cree_le > now() - interval '5 minutes' and user_id is not null),
    'en_composition', (select count(*) from compositions where not terminee and debut_le > now() - interval '40 minutes'),
    'questions_jour', (select count(*) from tentatives_question where cree_le >= current_date),
    'compositions_jour', (select count(*) from compositions where debut_le >= current_date),
    'defis_7j', (select count(*) from defis where cree_le >= current_date - 6),
    'push_actifs', (select count(*) from push_abonnements where actif),
    'packs_7j', (select count(*) from packs_hors_ligne where cree_le >= current_date - 6),
    'bannis', (select count(*) from bannissements where leve_le is null and (jusqu_au is null or jusqu_au > now())),
    'suppressions_30j', (select count(*) from journal_activite where action = 'suppression_compte' and cree_le > now() - interval '30 days'),
    'jours', v_j, 'du', v_debut, 'au', v_fin,
    'avant_periode', (select count(*) from profils where cree_le < v_debut),
    'croissance', (select coalesce(jsonb_agg(jsonb_build_object('jour', d, 'inscrits', i, 'actifs', a) order by d), '[]'::jsonb) from (
        select g.d::date d,
               (select count(*) from profils p where p.cree_le::date = g.d::date) i,
               (select count(distinct u) from (
                  select e.user_id u from evenements e where e.cree_le::date = g.d::date and e.user_id is not null
                  union select s.user_id from assiduite s where s.jour = g.d::date) z) a
          from generate_series(v_debut, v_fin, interval '1 day') g(d)) x),
    'heures', (select coalesce(jsonb_agg(jsonb_build_object('h', h, 'n', n) order by h), '[]'::jsonb) from (
        select g.h, (select count(distinct coalesce(e.user_id::text, e.session_id::text) || e.cree_le::date)
                       from evenements e where e.cree_le >= greatest(v_debut, v_fin - 6) and e.cree_le < v_fin1 and extract(hour from e.cree_le) = g.h) n
          from generate_series(0, 23) g(h)) x),
    'zones', (select coalesce(jsonb_agg(z order by (z->>'minutes')::numeric desc), '[]'::jsonb) from (
        select jsonb_build_object('ecran', e.meta->>'ecran',
                 'minutes', round(sum(least(coalesce((e.meta->>'duree_ms')::numeric, 0), 1800000)) / 60000.0, 1),
                 'visites', count(*),
                 'personnes', count(distinct coalesce(e.user_id::text, e.session_id::text)),
                 'moyenne_s', round(avg(least(coalesce((e.meta->>'duree_ms')::numeric, 0), 1800000)) / 1000.0)) z
          from evenements e
         where e.nom = 'SCREEN_LEFT' and e.cree_le >= v_debut and e.cree_le < v_fin1 and e.meta ? 'ecran'
         group by e.meta->>'ecran') x),
    'actions', (select coalesce(jsonb_agg(jsonb_build_object('nom', nom, 'n', n, 'personnes', p) order by n desc), '[]'::jsonb) from (
        select nom, count(*) n, count(distinct coalesce(user_id::text, session_id::text)) p
          from evenements
         where cree_le >= v_debut and cree_le < v_fin1
           and nom not in ('SCREEN_VIEWED','SCREEN_LEFT','BUTTON_CLICKED','SCROLL_DEPTH_REACHED','APP_BACKGROUND',
                           'APP_FOREGROUND','SESSION_STARTED','SESSION_ENDED','USER_RETURNED','USER_FIRST_VISIT','APP_ENTERED')
         group by nom order by count(*) desc limit 25) x),
    'appareils', (select coalesce(jsonb_agg(jsonb_build_object('systeme', s, 'n', n) order by n desc), '[]'::jsonb) from (
        select coalesce(nullif(systeme, ''), 'Inconnu') s, count(distinct coalesce(user_id::text, id::text)) n
          from sessions where debut_le >= v_debut and debut_le < v_fin1 group by 1 order by 2 desc limit 6) x),
    'nouveautes', jsonb_build_object(
        'nationale_inscrits', (select count(*) from inscriptions_epreuve where cree_le >= v_debut and cree_le < v_fin1),
        'defis', (select count(*) from defis where cree_le >= v_debut and cree_le < v_fin1),
        'invitations', (select count(*) from defis_invitations where cree_le >= v_debut and cree_le < v_fin1),
        'packs', (select count(*) from packs_hors_ligne where cree_le >= v_debut and cree_le < v_fin1),
        'cartes', (select count(*) from evenements where nom = 'RESULT_CARD_SHARED' and cree_le >= v_debut and cree_le < v_fin1),
        'attestations', (select count(*) from evenements where nom = 'CERTIFICATE_DOWNLOADED' and cree_le >= v_debut and cree_le < v_fin1),
        'badges', (select count(*) from evenements where nom = 'BADGE_EARNED' and cree_le >= v_debut and cree_le < v_fin1),
        'relances', (select count(*) from notifications where cle_unicite like 'absence%' and cree_le >= v_debut and cree_le < v_fin1),
        'retours_relance', (select count(distinct n.user_id) from notifications n
            where n.cle_unicite like 'absence%' and n.cree_le >= v_debut and n.cree_le < v_fin1
              and exists (select 1 from assiduite a where a.user_id = n.user_id and a.jour between n.cree_le::date and n.cree_le::date + 2))));
end $$;

revoke all on function public.clics_boutons_p(integer, date, date), public.ecrans_p(integer, date, date), public.entonnoir_p(integer, date, date),
  public.stats_generales_p(integer, date, date), public.tableau_de_bord_p(integer, date, date) from public, anon;
grant execute on function public.clics_boutons_p(integer, date, date), public.ecrans_p(integer, date, date), public.entonnoir_p(integer, date, date),
  public.stats_generales_p(integer, date, date), public.tableau_de_bord_p(integer, date, date) to authenticated;
