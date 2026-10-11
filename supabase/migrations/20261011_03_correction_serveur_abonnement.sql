-- =====================================================================
-- 11 octobre 2026 · Lot 2 — la correction et les points passent par le serveur
-- A06-001 (corrigés publics, aucun verrou payant), A06-002 (points gonflables),
-- cahier d'erreurs enregistré (RM-05), composition tirée selon le niveau.
--
-- Règles d'accès retenues :
--   sans compte      : actualité, diagnostic, lecture des cours, questions visibles
--   compte gratuit   : 20 corrections de révision par jour, cahier d'erreurs
--   essai 7 jours / abonné : révisions illimitées, compositions
-- =====================================================================

-- 0. Les 20 questions numérotées de 1 à 4 passent de 0 à 3 comme les autres
update public.question_options o
   set position = o.position - 1
 where o.question_id in (select question_id from public.question_options
                          group by question_id having min(position) = 1);

-- 1. Les bonnes réponses ne sont plus lisibles depuis l'extérieur
revoke select on public.question_options from anon, authenticated;
grant select (id, question_id, position, texte) on public.question_options to anon, authenticated;

-- 2. Les questions d'un sujet ne se lisent plus en direct : elles arrivent
--    par ouvrir_composition, réservée aux abonnés.
alter policy "composition d'un sujet publié" on public.sujet_questions using (securite.est_equipe());

-- 3. Ce que le téléphone n'écrit plus lui-même : tout passe par les fonctions
revoke insert, update, delete on public.tentatives_question from anon, authenticated;
revoke insert, update, delete on public.erreurs_utilisateur from anon, authenticated;
revoke insert, update, delete on public.composition_reponses from anon, authenticated;
revoke insert, update, delete on public.compositions from anon, authenticated;
revoke insert, update, delete on public.assiduite from anon, authenticated;
revoke insert, update, delete on public.progression_matiere from anon, authenticated;
revoke execute on function public.enregistrer_points(text, uuid) from public, anon, authenticated;
revoke execute on function public.programmer_reprise(uuid, boolean) from public, anon, authenticated;

-- 4. Abonnement actif (essai compris)
create or replace function securite.est_abonne(p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.abonnements
                  where user_id = p_user and fin_le > now() and annule_le is null);
$$;
revoke execute on function securite.est_abonne(uuid) from public, anon, authenticated;

-- 5. Créditer des points : interne, plafonné à 600 points gagnés par jour
create or replace function public.crediter_points(p_user uuid, p_motif text, p_points int, p_reference uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v_jour int;
begin
  if p_user is null or p_points is null or p_points = 0 then return 0; end if;
  if p_points > 0 then
    select coalesce(sum(points), 0) into v_jour from public.points_journal
     where user_id = p_user and points > 0 and cree_le >= date_trunc('day', now());
    if v_jour + p_points > 600 then return 0; end if;
  end if;
  begin
    insert into public.points_journal (user_id, motif, points, reference)
    values (p_user, p_motif, p_points, p_reference);
  exception when unique_violation then return 0;
  end;
  return p_points;
end $$;
revoke execute on function public.crediter_points(uuid, text, int, uuid) from public, anon, authenticated;

-- 6. Bonnes réponses d'une question, en rangs 0, 1, 2… dans l'ordre d'affichage
create or replace function public.bonnes_reponses(p_question uuid)
returns int[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(rang order by rang) filter (where est_correcte), array[]::int[])
    from (select est_correcte, (row_number() over (order by position) - 1)::int as rang
            from public.question_options where question_id = p_question) o;
$$;
revoke execute on function public.bonnes_reponses(uuid) from public, anon, authenticated;

-- 7. Corriger une réponse (révision ou reprise du cahier)
create or replace function public.corriger_question(
  p_question uuid, p_choix int[], p_contexte text default 'revision',
  p_temps_ms int default null, p_session uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_q record; v_bonnes int[]; v_choix int[]; v_correcte boolean;
  v_abonne boolean; v_faites int; v_restant int; v_err record; v_acquise boolean := false;
  v_intervalle int; v_points int := 0;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'connexion', true,
      'message', 'Créez votre compte gratuit pour voir la correction.');
  end if;
  if p_contexte not in ('revision', 'erreurs') then
    return jsonb_build_object('ok', false, 'message', 'Contexte inconnu.');
  end if;

  select id, matiere_id, niveau, explication into v_q
    from public.questions where id = p_question and statut = 'publie';
  if not found then
    return jsonb_build_object('ok', false, 'message', 'Question introuvable.');
  end if;

  v_abonne := securite.est_abonne(v_user) or securite.est_equipe();
  if p_contexte = 'revision' and not v_abonne then
    select count(*) into v_faites from public.tentatives_question
     where user_id = v_user and contexte = 'revision' and cree_le >= date_trunc('day', now());
    if v_faites >= 20 then
      return jsonb_build_object('ok', false, 'quota', true,
        'message', 'Vous avez utilisé vos 20 corrections gratuites du jour. Elles reviennent demain, ou sans limite avec l''abonnement.');
    end if;
    v_restant := 20 - v_faites - 1;
  end if;

  v_bonnes := public.bonnes_reponses(p_question);
  select coalesce(array_agg(distinct c order by c), array[]::int[]) into v_choix
    from unnest(coalesce(p_choix, array[]::int[])) c where c between 0 and 9;
  v_correcte := array_length(v_bonnes, 1) is not null and v_choix = v_bonnes;

  insert into public.tentatives_question
    (user_id, session_id, question_id, contexte, choix, correcte, temps_ms)
  values (v_user, p_session, p_question, p_contexte, v_choix::smallint[], v_correcte,
          least(greatest(coalesce(p_temps_ms, 0), 0), 3600000));

  -- le cahier d'erreurs
  select * into v_err from public.erreurs_utilisateur where user_id = v_user and question_id = p_question;
  if not v_correcte then
    insert into public.erreurs_utilisateur (user_id, question_id, origine, nb_echecs, revoir_le)
    values (v_user, p_question, p_contexte, 1, current_date)
    on conflict (user_id, question_id) do update
      set nb_echecs = erreurs_utilisateur.nb_echecs + 1, reussites_consecutives = 0, palier = 0,
          revoir_le = current_date, acquise = false, derniere_erreur = now(), maj_le = now();
  elsif v_err.id is not null and not v_err.acquise then
    v_intervalle := case least(v_err.palier + 1, 3) when 1 then 3 when 2 then 7 else 21 end;
    v_acquise := v_err.reussites_consecutives + 1 >= 3;
    update public.erreurs_utilisateur
       set reussites_consecutives = reussites_consecutives + 1,
           palier = least(palier + 1, 3),
           revoir_le = current_date + v_intervalle,
           acquise = v_acquise, maj_le = now()
     where id = v_err.id;
  end if;

  -- assiduité et points
  insert into public.assiduite (user_id, jour, compose) values (v_user, current_date, true)
  on conflict (user_id, jour) do update set compose = true;
  if v_correcte then
    v_points := public.crediter_points(v_user, 'revision', 5,
                  md5('revision' || p_question::text || current_date::text)::uuid);
    if v_acquise then
      v_points := v_points + public.crediter_points(v_user, 'erreur_refermee', 20, p_question);
    end if;
  else
    v_points := public.crediter_points(v_user, 'mauvaise_reponse', -3,
                  md5('mauvaise' || p_question::text || current_date::text)::uuid);
  end if;

  return jsonb_build_object(
    'ok', true, 'correcte', v_correcte, 'bonnes', to_jsonb(v_bonnes),
    'explication', v_q.explication, 'points', v_points,
    'quota_restant', v_restant,
    'suite', case when v_correcte and v_err.id is not null and not v_err.acquise
                  then v_err.reussites_consecutives + 1 else 0 end,
    'acquise', v_acquise, 'revoir_dans', v_intervalle);
end $$;
revoke execute on function public.corriger_question(uuid, int[], text, int, uuid) from public, anon;
grant execute on function public.corriger_question(uuid, int[], text, int, uuid) to authenticated;

-- 8. Ouvrir (ou reprendre) une composition, réservée aux abonnés et à l'essai
create or replace function public.ouvrir_composition(p_niveau text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_niveau public.niveau_scolaire; v_compo record; v_sujet record; v_concours text;
  v_restant int; v_questions jsonb; v_seuil int;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'connexion', true,
      'message', 'Créez votre compte pour composer.');
  end if;
  if not (securite.est_abonne(v_user) or securite.est_equipe()) then
    return jsonb_build_object('ok', false, 'abonnement', true,
      'message', 'La composition fait partie de l''abonnement.');
  end if;

  begin
    v_niveau := coalesce(nullif(p_niveau, '')::public.niveau_scolaire,
                         (select niveau from public.profils where id = v_user), 'terminale');
  exception when others then v_niveau := 'terminale';
  end;

  -- une composition déjà ouverte et encore dans les temps est reprise
  select c.*, coalesce(s.duree_secondes, 1500) as duree into v_compo
    from public.compositions c left join public.sujets s on s.id = c.sujet_id
   where c.user_id = v_user and not c.terminee
     and c.debut_le > now() - make_interval(secs => coalesce(s.duree_secondes, 1500) + 120)
   order by c.debut_le desc limit 1;

  if found then
    select * into v_sujet from public.sujets where id = v_compo.sujet_id;
  else
    -- sujet du niveau d'abord, puis sans niveau ; le moins composé par ce candidat
    select s.* into v_sujet from public.sujets s
     where s.statut = 'publie' and (s.niveau = v_niveau or s.niveau is null)
       and exists (select 1 from public.sujet_questions sq where sq.sujet_id = s.id)
     order by (s.niveau = v_niveau) desc nulls last,
              (select count(*) from public.compositions c where c.user_id = v_user and c.sujet_id = s.id),
              random()
     limit 1;
    if not found then
      return jsonb_build_object('ok', false, 'message', 'Aucun sujet n''est encore publié pour ce niveau.');
    end if;
    insert into public.compositions (user_id, sujet_id, nb_questions, nb_traitees)
    values (v_user, v_sujet.id, (select count(*) from public.sujet_questions where sujet_id = v_sujet.id), 0)
    returning *, coalesce(v_sujet.duree_secondes, 1500) as duree into v_compo;
  end if;

  -- l'intitulé : le concours du sujet s'il correspond au niveau, sinon un
  -- concours de ce niveau tiré au hasard (il change à chaque composition)
  select c.nom, c.seuil_dernier_admis into v_concours, v_seuil from public.concours c
   where c.id = v_sujet.concours_id and (c.niveau_requis = v_niveau or c.niveau_requis is null);
  if v_concours is null then
    select c.nom, c.seuil_dernier_admis into v_concours, v_seuil from public.concours c
     where c.actif and c.niveau_requis = v_niveau order by random() limit 1;
  end if;

  v_restant := greatest(0, coalesce(v_sujet.duree_secondes, 1500)
                 - floor(extract(epoch from (now() - v_compo.debut_le)))::int);

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', q.id, 'enonce', q.enonce,
           'options', (select jsonb_agg(o.texte order by o.position)
                         from public.question_options o where o.question_id = q.id))
           order by sq.position), '[]'::jsonb)
    into v_questions
    from public.sujet_questions sq join public.questions q on q.id = sq.question_id
   where sq.sujet_id = v_sujet.id;

  return jsonb_build_object('ok', true, 'id', v_compo.id, 'sujet', v_sujet.reference,
    'duree', coalesce(v_sujet.duree_secondes, 1500), 'restant', v_restant,
    'concours', coalesce(v_concours, 'Concours direct'), 'niveau', v_niveau,
    'seuil', v_seuil,
    'questions', v_questions);
end $$;
revoke execute on function public.ouvrir_composition(text) from public, anon;
grant execute on function public.ouvrir_composition(text) to authenticated;

-- 9. Remettre la copie : note, corrigé, cahier, points, assiduité — tout côté serveur
create or replace function public.remettre_composition(p_composition uuid, p_reponses jsonb, p_duree integer default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_user uuid := auth.uid();
  v_sujet uuid; v_debut timestamptz; v_alloue int;
  v_score int; v_traitees int; v_total int; v_ecoule int; v_corrige jsonb;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'message', 'Non connecté.');
  end if;

  select c.sujet_id, c.debut_le, coalesce(s.duree_secondes, 1500)
    into v_sujet, v_debut, v_alloue
    from public.compositions c left join public.sujets s on s.id = c.sujet_id
   where c.id = p_composition and c.user_id = v_user and coalesce(c.terminee, false) = false
   for update of c;
  if not found then
    return jsonb_build_object('ok', false, 'message', 'Composition introuvable ou déjà remise.');
  end if;

  v_ecoule := greatest(0, floor(extract(epoch from (now() - v_debut)))::int);

  with liens as (
    select (row_number() over (order by sq.position) - 1)::int as idx, sq.question_id
      from public.sujet_questions sq where sq.sujet_id = v_sujet
  ),
  choix as (
    select (e.key)::int as idx,
           coalesce(array(select distinct (v)::int from jsonb_array_elements_text(e.value) v order by 1),
                    array[]::int[]) as choisies
      from jsonb_each(case when jsonb_typeof(p_reponses) = 'object' then p_reponses else '{}'::jsonb end) e
     where jsonb_typeof(e.value) = 'array' and e.key ~ '^[0-9]{1,3}$'
  )
  insert into public.composition_reponses (composition_id, question_id, options_choisies, correcte, repondu_le)
  select p_composition, l.question_id, c.choisies::smallint[],
         (c.choisies = public.bonnes_reponses(l.question_id)
            and array_length(public.bonnes_reponses(l.question_id), 1) is not null),
         now()
    from liens l join choix c on c.idx = l.idx
   where array_length(c.choisies, 1) is not null
  on conflict (composition_id, question_id) do update
    set options_choisies = excluded.options_choisies, correcte = excluded.correcte,
        repondu_le = excluded.repondu_le;

  select count(*) filter (where correcte), count(*) into v_score, v_traitees
    from public.composition_reponses where composition_id = p_composition;
  select count(*) into v_total from public.sujet_questions where sujet_id = v_sujet;

  perform set_config('app.notation_serveur', '1', true);
  update public.compositions
     set score = v_score, nb_traitees = v_traitees, terminee = true, fin_le = now(),
         duree_secondes = least(v_ecoule, v_alloue),
         nb_questions = coalesce(nullif(v_total, 0), nb_questions)
   where id = p_composition;

  -- les fautes entrent au cahier, les réponses sont tracées
  insert into public.erreurs_utilisateur (user_id, question_id, origine, nb_echecs, revoir_le)
  select v_user, r.question_id, 'composition', 1, current_date
    from public.composition_reponses r where r.composition_id = p_composition and not r.correcte
  on conflict (user_id, question_id) do update
    set nb_echecs = erreurs_utilisateur.nb_echecs + 1, reussites_consecutives = 0, palier = 0,
        revoir_le = current_date, acquise = false, derniere_erreur = now(), maj_le = now();

  insert into public.tentatives_question (user_id, question_id, contexte, choix, correcte, position_dans_epreuve)
  select v_user, r.question_id, 'composition', r.options_choisies, r.correcte, l.position
    from public.composition_reponses r
    join public.sujet_questions l on l.sujet_id = v_sujet and l.question_id = r.question_id
   where r.composition_id = p_composition;

  insert into public.assiduite (user_id, jour, compose) values (v_user, current_date, true)
  on conflict (user_id, jour) do update set compose = true;
  perform public.crediter_points(v_user, 'composition', v_score * 15, p_composition);

  -- le corrigé, dans l'ordre du sujet
  select coalesce(jsonb_agg(to_jsonb(public.bonnes_reponses(sq.question_id)) order by sq.position), '[]'::jsonb)
    into v_corrige from public.sujet_questions sq where sq.sujet_id = v_sujet;

  return jsonb_build_object('ok', true, 'note', v_score,
    'sur', coalesce(nullif(v_total, 0), v_traitees), 'traitees', v_traitees,
    'duree', least(v_ecoule, v_alloue), 'hors_delai', v_ecoule > v_alloue + 120,
    'corrige', v_corrige);
end $$;

-- 10. Relire une copie remise (feuille PDF, historique)
create or replace function public.ma_copie(p_composition uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_c record; v_questions jsonb;
begin
  select c.*, s.reference into v_c from public.compositions c left join public.sujets s on s.id = c.sujet_id
   where c.id = p_composition and c.user_id = v_user and c.terminee;
  if not found then return jsonb_build_object('ok', false, 'message', 'Copie introuvable.'); end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'enonce', q.enonce,
           'options', (select jsonb_agg(o.texte order by o.position) from public.question_options o where o.question_id = q.id),
           'bonnes', to_jsonb(public.bonnes_reponses(q.id)),
           'choisies', coalesce((select to_jsonb(r.options_choisies) from public.composition_reponses r
                                  where r.composition_id = v_c.id and r.question_id = q.id), '[]'::jsonb))
           order by sq.position), '[]'::jsonb)
    into v_questions
    from public.sujet_questions sq join public.questions q on q.id = sq.question_id
   where sq.sujet_id = v_c.sujet_id;

  return jsonb_build_object('ok', true, 'date', v_c.debut_le, 'note', v_c.score,
    'duree', v_c.duree_secondes, 'sujet', v_c.reference, 'questions', v_questions);
end $$;
revoke execute on function public.ma_copie(uuid) from public, anon;
grant execute on function public.ma_copie(uuid) to authenticated;

-- 11. Progression réelle par matière, pour l'écran des révisions
create or replace function public.ma_progression(p_niveau text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_niveau public.niveau_scolaire;
begin
  begin v_niveau := nullif(p_niveau, '')::public.niveau_scolaire;
  exception when others then v_niveau := null; end;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'matiere_id', m.id, 'matiere', m.nom, 'ordre', m.ordre,
             'total', z.total, 'faites', z.faites, 'reussies', z.reussies)
           order by m.ordre)
      from public.matieres m
      join lateral (
        select count(*) as total,
               count(*) filter (where exists (select 1 from public.tentatives_question t
                                 where t.user_id = v_user and t.question_id = q.id)) as faites,
               count(*) filter (where exists (select 1 from public.tentatives_question t
                                 where t.user_id = v_user and t.question_id = q.id and t.correcte)) as reussies
          from public.questions q
         where q.matiere_id = m.id and q.statut = 'publie'
           and (v_niveau is null or q.niveau = v_niveau or q.niveau is null)
      ) z on z.total > 0
  ), '[]'::jsonb);
end $$;
grant execute on function public.ma_progression(text) to anon, authenticated;

-- 12. Cahier d'erreurs : la bonne réponse est un rang (0, 1, 2…), pas une position brute
create or replace function public.mes_erreurs()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'question_id', q.id, 'enonce', q.enonce, 'explication', q.explication,
      'matiere', m.nom, 'theme', c.nom,
      'options', (select jsonb_agg(o.texte order by o.position) from public.question_options o where o.question_id = q.id),
      'bonne', (public.bonnes_reponses(q.id))[1],
      'derniere', (select to_jsonb(t.choix) from public.tentatives_question t
                    where t.user_id = v_user and t.question_id = q.id and not t.correcte
                    order by t.cree_le desc limit 1),
      'rate', e.nb_echecs, 'suite', e.reussites_consecutives,
      'revoir_le', e.revoir_le, 'jours', greatest(0, e.revoir_le - current_date)
    ) order by e.revoir_le, e.nb_echecs desc)
    from public.erreurs_utilisateur e
    join public.questions q on q.id = e.question_id
    left join public.matieres m on m.id = q.matiere_id
    left join public.chapitres c on c.id = q.chapitre_id
    where e.user_id = v_user and not e.acquise
  ), '[]'::jsonb);
end $$;
