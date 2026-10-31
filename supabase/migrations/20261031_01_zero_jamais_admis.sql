-- Composition nationale : un candidat qui a 0 bonne réponse n'est jamais admis ni sur liste d'attente,
-- même s'il reste des places libres. Le rang reste affiché, seul le statut change.
create or replace function public.classement_epreuve(p_epreuve uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_ep record; v_user uuid := auth.uid(); v_res jsonb; v_moi jsonb; v_total int; v_pos int; v_moy numeric; v_conc text;
begin
  select * into v_ep from public.epreuves_collectives where id = p_epreuve and statut = 'programmee';
  if not found then return jsonb_build_object('ok', false, 'message', 'Composition introuvable.'); end if;
  if now() < v_ep.fin_le then
    return jsonb_build_object('ok', true, 'termine', false, 'fin_le', v_ep.fin_le,
      'participants', (select count(*) from public.compositions where epreuve_id = v_ep.id));
  end if;
  select nom into v_conc from public.concours where id = v_ep.concours_id;

  with r as (
    select c.id, c.user_id, c.score, c.nb_questions, c.duree_secondes,
           public.nom_resultat(c.user_id, v_ep.id) nom,
           rank() over (order by c.score desc, c.duree_secondes asc nulls last) rang
      from public.compositions c
     where c.epreuve_id = v_ep.id and c.terminee
  )
  select jsonb_agg(jsonb_build_object('rang', rang, 'nom', nom, 'pseudo', nom, 'score', score, 'sur', nb_questions,
           'duree', duree_secondes, 'composition', id, 'moi', user_id = v_user,
           'statut', case when coalesce(score, 0) <= 0 then 'echoue' when rang <= v_ep.places then 'admis' when rang <= 2 * v_ep.places then 'attente' else 'echoue' end,
           'reactions', (select coalesce(jsonb_object_agg(type, n), '{}'::jsonb) from (
               select re.type, count(*) n from public.reactions_epreuve re where re.composition_id = t.id group by re.type) z),
           'mes_reactions', (select coalesce(jsonb_agg(re.type), '[]'::jsonb) from public.reactions_epreuve re
                              where re.composition_id = t.id and re.auteur = v_user))
         order by rang, nom)
    into v_res from (select * from r where rang <= 2 * v_ep.places order by rang limit 400) t;

  select jsonb_build_object('rang', rang, 'nom', nom, 'score', score, 'sur', nb_questions, 'duree', duree_secondes,
           'statut', case when coalesce(score, 0) <= 0 then 'echoue' when rang <= v_ep.places then 'admis' when rang <= 2 * v_ep.places then 'attente' else 'echoue' end)
    into v_moi from (
      select c.user_id, c.score, c.nb_questions, c.duree_secondes, public.nom_resultat(c.user_id, v_ep.id) nom,
             rank() over (order by c.score desc, c.duree_secondes asc nulls last) rang
        from public.compositions c where c.epreuve_id = v_ep.id and c.terminee) z
   where v_user is not null and z.user_id = v_user;

  select count(*), count(*) filter (where coalesce(score, 0) > 0), round(avg(score)::numeric, 1)
    into v_total, v_pos, v_moy
    from public.compositions where epreuve_id = v_ep.id and terminee;

  return jsonb_build_object('ok', true, 'termine', true, 'titre', v_ep.titre, 'concours', v_conc, 'places', v_ep.places,
    'debut_le', v_ep.debut_le, 'recompense', v_ep.recompense, 'message', v_ep.message,
    'participants', v_total, 'moyenne', v_moy,
    'admis', least(v_pos, v_ep.places), 'attente', greatest(0, least(v_pos, 2 * v_ep.places) - v_ep.places),
    'echoues', v_total - least(v_pos, v_ep.places) - greatest(0, least(v_pos, 2 * v_ep.places) - v_ep.places),
    'sur', (select count(*) from public.sujet_questions where sujet_id = v_ep.sujet_id),
    'classement', coalesce(v_res, '[]'::jsonb), 'moi', v_moi);
end $function$;

-- « Mes chances » : une moyenne de 0 n'est jamais « admis » non plus.
create or replace function public.mon_elan()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_user uuid := auth.uid(); v_n int; v_moy numeric; v_ep record; v_sur int;
  v_part int; v_rang int; v_statut text; v_conc text;
begin
  if v_user is null then return null; end if;

  select count(*), avg(score::numeric / nb_questions) into v_n, v_moy from (
    select score, nb_questions from public.compositions
     where user_id = v_user and terminee and nb_questions >= 10 and score is not null
     order by debut_le desc limit 5) z;

  if v_n > 0 then
    select ec.* into v_ep from public.epreuves_collectives ec
     where ec.statut = 'programmee' and ec.fin_le < now() and coalesce(ec.places, 0) > 0
       and exists (select 1 from public.compositions c where c.epreuve_id = ec.id and c.terminee)
     order by (ec.concours_id is not distinct from (select concours_id from public.profils where id = v_user)) desc,
              ec.fin_le desc
     limit 1;
    if found then
      select max(nb_questions), count(*) into v_sur, v_part
        from public.compositions where epreuve_id = v_ep.id and terminee;
      select 1 + count(*) into v_rang from public.compositions
       where epreuve_id = v_ep.id and terminee and nb_questions > 0
         and score::numeric / nb_questions > v_moy;
      v_statut := case when coalesce(v_moy, 0) <= 0 then 'echoue'
                       when v_rang <= v_ep.places then 'admis'
                       when v_rang <= 2 * v_ep.places then 'attente' else 'echoue' end;
      select nom into v_conc from public.concours where id = v_ep.concours_id;
    end if;
  end if;

  return jsonb_build_object(
    'jours_actifs', (select count(*) from public.assiduite where user_id = v_user),
    'chances', case when v_n > 0 then jsonb_build_object(
        'compositions', v_n,
        'pourcentage', round(100 * v_moy),
        'sur', coalesce(v_sur, 50),
        'note', round(v_moy * coalesce(v_sur, 50)),
        'rang', v_rang, 'participants', v_part, 'places', v_ep.places,
        'statut', v_statut, 'concours', coalesce(v_conc, v_ep.titre),
        'date', v_ep.debut_le) end);
end $function$;
