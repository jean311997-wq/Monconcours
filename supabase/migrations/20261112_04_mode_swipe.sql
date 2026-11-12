-- Mode Swipe (12 novembre 2026)
-- Léger par construction : à l'entrée, une seule lecture (swipe_etat) ; puis un lot de 10 questions
-- à la fois (swipe_lot, qui reprend fil_pour_toi) ; chaque réponse passe par corriger_question,
-- comme le fil « Pour toi » (mêmes quotas, même blocus). Le rang se calcule sur le téléphone
-- à partir d'un histogramme des notes, recalculé toutes les 15 minutes dans une seule ligne.

-- Note estimée : réussite des 30 derniers jours, lissée vers la moyenne (6 sur 12) pour ne pas
-- donner 20/20 après deux réponses ; une question tombée au concours compte double.
create table if not exists securite.swipe_population (
  id int primary key default 1 check (id = 1),
  histo int[] not null default '{}',      -- 201 cases : nombre de candidats par note (0,0 à 20,0 par 0,1)
  total int not null default 0,
  barre numeric not null default 13,       -- note des 20 % les mieux placés
  en_ligne int not null default 0,         -- candidats ayant répondu dans les 15 dernières minutes
  aujourdhui int not null default 0,       -- candidats ayant répondu aujourd'hui
  maj_le timestamptz not null default now()
);
alter table securite.swipe_population enable row level security;
revoke all on securite.swipe_population from public, anon, authenticated;
insert into securite.swipe_population (id) values (1) on conflict do nothing;

create or replace function securite.swipe_recalculer()
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_histo int[]; v_total int; v_barre numeric;
begin
  with t as (
    select t.user_id, sum(case when q.source = 'annale' then 2 else 1 end) n,
           sum(case when t.correcte then (case when q.source = 'annale' then 2 else 1 end) else 0 end) c
      from public.tentatives_question t join public.questions q on q.id = t.question_id
     where t.user_id is not null and t.cree_le > now() - interval '30 days'
     group by t.user_id having count(*) >= 20),
  n as (select round(20 * (c + 6) / (n + 12.0), 1) note from t)
  select array_agg(coalesce(h.k, 0) order by g.i), (select count(*) from n),
         coalesce((select percentile_disc(0.8) within group (order by note) from n), 13)
    into v_histo, v_total, v_barre
    from generate_series(0, 200) g(i)
    left join (select (note * 10)::int i, count(*)::int k from n group by 1) h on h.i = g.i;
  update securite.swipe_population set histo = v_histo, total = v_total, barre = v_barre,
    en_ligne = (select count(distinct user_id) from public.tentatives_question where cree_le > now() - interval '15 minutes'),
    aujourdhui = (select count(distinct user_id) from public.tentatives_question where cree_le >= date_trunc('day', now())),
    maj_le = now() where id = 1;
end $$;
revoke all on function securite.swipe_recalculer() from public, anon, authenticated;

-- À l'entrée du mode : ma note, mes chiffres pour l'estimer sur le téléphone, la population, ma série de jours.
create or replace function public.swipe_etat()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_user uuid := auth.uid(); v_n numeric := 0; v_c numeric := 0; v_n7 numeric := 0; v_c7 numeric := 0;
  v_serie int := 0; v_jour date := current_date; v_aujourdhui boolean; p securite.swipe_population;
begin
  if v_user is null then return jsonb_build_object('ok', false); end if;
  select coalesce(sum(w) filter (where cree_le > now() - interval '30 days'), 0),
         coalesce(sum(w) filter (where correcte and cree_le > now() - interval '30 days'), 0),
         coalesce(sum(w) filter (where cree_le < now() - interval '7 days'), 0),
         coalesce(sum(w) filter (where correcte and cree_le < now() - interval '7 days'), 0)
    into v_n, v_c, v_n7, v_c7
    from (select t.correcte, t.cree_le, case when q.source = 'annale' then 2 else 1 end w
            from public.tentatives_question t join public.questions q on q.id = t.question_id
           where t.user_id = v_user and t.cree_le > now() - interval '37 days') z;
  -- série de jours : jours consécutifs avec une activité, aujourd'hui compris s'il a déjà joué
  v_aujourdhui := exists (select 1 from public.assiduite where user_id = v_user and jour = current_date);
  if not v_aujourdhui then v_jour := current_date - 1; end if;
  while exists (select 1 from public.assiduite where user_id = v_user and jour = v_jour) and v_serie < 400 loop
    v_serie := v_serie + 1; v_jour := v_jour - 1;
  end loop;
  select * into p from securite.swipe_population where id = 1;
  return jsonb_build_object('ok', true, 'n', v_n, 'c', v_c,
    'note', round(20 * (v_c + 6) / (v_n + 12), 1),
    'note_semaine', round(20 * (v_c7 + 6) / (v_n7 + 12), 1),
    'serie_jours', v_serie, 'joue_aujourdhui', v_aujourdhui,
    'histo', to_jsonb(p.histo), 'total', p.total, 'barre', p.barre,
    'en_ligne', p.en_ligne, 'aujourdhui', p.aujourdhui);
end $$;
revoke all on function public.swipe_etat() from public, anon;
grant execute on function public.swipe_etat() to authenticated;

-- Un lot de questions : celles du fil « Pour toi », avec ce qu'il faut pour le mode Swipe :
-- tombée au concours (et l'année), et la part des candidats qui a choisi chaque réponse.
create or replace function public.swipe_lot(p_niveau text default null, p_nombre int default 10)
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare v_lot jsonb; v_user uuid := auth.uid(); v_niveau public.niveau_scolaire; v_a jsonb;
begin
  if v_user is null then return '[]'::jsonb; end if;
  v_lot := public.fil_pour_toi(p_niveau, least(greatest(coalesce(p_nombre, 10), 1), 12));
  -- au moins une vraie question de concours par lot, quand il y en a une à ce niveau
  if jsonb_array_length(v_lot) >= 5 and not exists (
       select 1 from jsonb_array_elements(v_lot) e join public.questions q on q.id = (e->>'id')::uuid where q.source = 'annale') then
    begin
      v_niveau := coalesce(nullif(p_niveau, '')::public.niveau_scolaire, (select niveau from public.profils where id = v_user), 'terminale');
    exception when others then v_niveau := 'terminale';
    end;
    select jsonb_build_object('id', q.id, 'enonce', q.enonce, 'matiere', m.nom,
             'options', (select jsonb_agg(o.texte order by o.position) from public.question_options o where o.question_id = q.id),
             'contexte', 'revision', 'etiquette', 'Concours', 'raison', 'Une question tombée au concours.')
      into v_a
      from public.questions q join public.matieres m on m.id = q.matiere_id
     where q.source = 'annale' and q.statut = 'publie' and (q.niveau = v_niveau or q.niveau is null)
       and public.matiere_du_niveau(q.matiere_id, v_niveau)
       and (select count(*) from public.question_options o where o.question_id = q.id) >= 2
       and not public.question_gardee(q.id)
       and not exists (select 1 from public.tentatives_question t where t.user_id = v_user and t.question_id = q.id
                         and t.cree_le > now() - interval '14 days')
     order by random() limit 1;
    if v_a is not null then
      v_lot := (select jsonb_agg(x order by k) from jsonb_array_elements(v_lot) with ordinality e(x, k)
                 where k < jsonb_array_length(v_lot)) ;
      v_lot := jsonb_insert(v_lot, '{5}', v_a);
    end if;
  end if;
  return coalesce((
    select jsonb_agg(e.x || jsonb_build_object(
      'annale', q.source = 'annale', 'annee', q.annee_session,
      'repartition', r.rep, 'repondants', coalesce(r.n, 0)) order by e.k)
      from jsonb_array_elements(v_lot) with ordinality e(x, k)
      join public.questions q on q.id = (e.x->>'id')::uuid
      left join lateral (
        select sum(m)::int n, jsonb_agg(m order by pos) rep from (
          select g.pos, count(t.id) m from generate_series(0, 3) g(pos)
            left join public.tentatives_question t on t.question_id = q.id and t.choix[1] = g.pos
           group by g.pos) z) r on true
  ), '[]'::jsonb);
end $$;
revoke all on function public.swipe_lot(text, int) from public, anon;
grant execute on function public.swipe_lot(text, int) to authenticated;

select securite.swipe_recalculer();
select cron.unschedule(jobid) from cron.job where jobname = 'swipe-population';
select cron.schedule('swipe-population', '*/15 * * * *', $$select securite.swipe_recalculer()$$);

-- Ajustement appliqué juste après (migration « mode_swipe_fenetre_150 ») : la note se calcule sur les
-- 150 dernières réponses du mois, pour qu'elle bouge vraiment à chaque question, même pour un candidat
-- qui a déjà répondu à des milliers de questions. Voir les versions de swipe_recalculer et swipe_etat
-- dans la base (row_number ... k <= 150 ; order by cree_le desc limit 150), et note_semaine nulle
-- tant qu'il n'y a pas 20 réponses dans la fenêtre d'il y a 7 jours.
