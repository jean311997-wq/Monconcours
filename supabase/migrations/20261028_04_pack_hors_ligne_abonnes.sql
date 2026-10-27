-- Les packs hors ligne font partie de l'abonnement (le premier pack n'est plus offert).
create or replace function public.pack_hors_ligne(p_niveau text, p_matieres text[], p_nombre integer default 50)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v_user uuid := auth.uid(); v_niveau public.niveau_scolaire; v_ids uuid[]; v_res jsonb; v_nb int;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'connexion', true); end if;
  if not (securite.est_abonne(v_user) or securite.est_equipe()) then
    return jsonb_build_object('ok', false, 'abonnement', true, 'message', 'Les packs hors connexion font partie de l''abonnement.');
  end if;
  if (select count(*) from public.packs_hors_ligne where user_id = v_user and cree_le > now() - interval '1 day') >= 3 then
    return jsonb_build_object('ok', false, 'message', 'Trois packs par jour au plus. Révisez celui-ci, un nouveau sera possible demain.');
  end if;
  begin v_niveau := nullif(p_niveau, '')::public.niveau_scolaire; exception when others then v_niveau := null; end;
  select array_agg(id) into v_ids from public.matieres
   where coalesce(array_length(p_matieres, 1), 0) > 0 and nom = any(p_matieres);
  v_nb := least(greatest(coalesce(p_nombre, 50), 10), 50);
  select jsonb_agg(x) into v_res from (
    select jsonb_build_object('id', q.id, 'enonce', q.enonce, 'matiere', m.nom, 'explication', q.explication,
             'options', (select jsonb_agg(o.texte order by o.position) from public.question_options o where o.question_id = q.id),
             'bonnes', to_jsonb(public.bonnes_reponses(q.id))) x
      from public.questions q left join public.matieres m on m.id = q.matiere_id
     where q.statut = 'publie'
       and (v_ids is null or q.matiere_id = any(v_ids))
       and (v_niveau is null or q.niveau = v_niveau or q.niveau is null)
       and public.matiere_du_niveau(q.matiere_id, v_niveau)
       and (select count(*) from public.question_options o where o.question_id = q.id) >= 2
       and not public.question_gardee(q.id)
       and not exists (select 1 from public.epreuves_collectives ec join public.sujet_questions sq on sq.sujet_id = ec.sujet_id
                        where sq.question_id = q.id and ec.statut = 'programmee' and ec.fin_le > now())
     order by random() limit v_nb) z;
  if v_res is null or jsonb_array_length(v_res) < 5 then
    return jsonb_build_object('ok', false, 'message', 'Pas assez de questions pour ce choix. Prenez « Toutes les matières ».');
  end if;
  insert into public.packs_hors_ligne (user_id, nombre) values (v_user, jsonb_array_length(v_res));
  return jsonb_build_object('ok', true, 'questions', v_res, 'cree_le', now());
end $function$;
