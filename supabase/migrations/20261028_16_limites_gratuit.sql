-- Compte gratuit (hors phase gratuite et hors abonnement) :
--   5 corrections de révision par jour (au lieu de 10)
--   15 questions différentes par matière et par niveau (un aperçu de chaque matière)
-- Les questions déjà vues restent consultables tant que le plafond du jour n'est pas atteint.
create or replace function public.corriger_question(p_question uuid, p_choix integer[], p_contexte text default 'revision', p_temps_ms integer default null, p_session uuid default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_user uuid := auth.uid();
  v_q record; v_bonnes int[]; v_choix int[]; v_correcte boolean;
  v_abonne boolean; v_faites int; v_restant int; v_err record; v_acquise boolean := false;
  v_intervalle int; v_points int := 0; v_deja boolean; v_mat int := 0; v_mat_nom text; v_mat_restant int;
  c_jour constant int := 5; c_matiere constant int := 15;
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

  if public.question_gardee(p_question) and not securite.est_equipe() then
    return jsonb_build_object('ok', false, 'message', 'Cette question fait partie d''une composition collective en cours. Sa correction sera visible à la fin de l''épreuve.');
  end if;

  v_abonne := securite.est_abonne(v_user) or securite.est_equipe();
  if p_contexte = 'revision' and not v_abonne then
    select count(*) into v_faites from public.tentatives_question
     where user_id = v_user and contexte = 'revision' and cree_le >= date_trunc('day', now());
    if v_faites >= c_jour then
      return jsonb_build_object('ok', false, 'quota', true, 'motif', 'jour',
        'message', 'Vous avez utilisé vos ' || c_jour || ' corrections gratuites du jour. Elles reviennent demain, ou sans limite avec l''abonnement.');
    end if;
    v_restant := c_jour - v_faites - 1;

    if v_q.matiere_id is not null then
      select nom into v_mat_nom from public.matieres where id = v_q.matiere_id;
      v_deja := exists (select 1 from public.tentatives_question t
                         where t.user_id = v_user and t.question_id = p_question and t.contexte = 'revision');
      select count(distinct t.question_id) into v_mat
        from public.tentatives_question t join public.questions q on q.id = t.question_id
       where t.user_id = v_user and t.contexte = 'revision'
         and q.matiere_id = v_q.matiere_id and q.niveau is not distinct from v_q.niveau;
      if not v_deja and v_mat >= c_matiere then
        return jsonb_build_object('ok', false, 'quota', true, 'motif', 'matiere', 'matiere', v_mat_nom,
          'message', 'Vous avez fait vos ' || c_matiere || ' questions gratuites en ' || coalesce(v_mat_nom, 'cette matière') || '. Pour continuer cette matière, faites l''abonnement.');
      end if;
      v_mat_restant := greatest(0, c_matiere - v_mat - case when v_deja then 0 else 1 end);
    end if;
  end if;

  v_bonnes := public.bonnes_reponses(p_question);
  select coalesce(array_agg(distinct c order by c), array[]::int[]) into v_choix
    from unnest(coalesce(p_choix, array[]::int[])) c where c between 0 and 9;
  v_correcte := array_length(v_bonnes, 1) is not null and v_choix = v_bonnes;

  insert into public.tentatives_question
    (user_id, session_id, question_id, contexte, choix, correcte, temps_ms)
  values (v_user, p_session, p_question, p_contexte, v_choix::smallint[], v_correcte,
          least(greatest(coalesce(p_temps_ms, 0), 0), 3600000));

  select * into v_err from public.erreurs_utilisateur where user_id = v_user and question_id = p_question;
  if not v_correcte then
    insert into public.erreurs_utilisateur (user_id, question_id, origine, nb_echecs, revoir_le)
    values (v_user, p_question, p_contexte, 1, current_date)
    on conflict (user_id, question_id) do update
      set nb_echecs = erreurs_utilisateur.nb_echecs + 1, reussites_consecutives = 0, palier = 0,
          revoir_le = current_date, acquise = false, derniere_erreur = now(), maj_le = now();
  elsif v_err.id is not null and not v_err.acquise then
    v_intervalle := case least(v_err.palier + 1, 3) when 1 then 3 when 2 then 7 else 21 end;
    v_acquise := p_contexte = 'erreurs' or v_err.reussites_consecutives + 1 >= 3;
    update public.erreurs_utilisateur
       set reussites_consecutives = case when v_acquise then greatest(reussites_consecutives + 1, 3)
                                         else reussites_consecutives + 1 end,
           palier = least(palier + 1, 3),
           revoir_le = current_date + v_intervalle,
           acquise = v_acquise, maj_le = now()
     where id = v_err.id;
  end if;

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
    'quota_restant', v_restant, 'matiere_restant', v_mat_restant,
    'suite', case when v_acquise then greatest(v_err.reussites_consecutives + 1, 3)
                  when v_correcte and v_err.id is not null and not v_err.acquise
                  then v_err.reussites_consecutives + 1 else 0 end,
    'acquise', v_acquise, 'revoir_dans', v_intervalle);
end $$;
