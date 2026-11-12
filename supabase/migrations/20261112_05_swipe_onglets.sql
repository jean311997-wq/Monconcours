-- La table public.actualite_questions et les 77 questions d'actualité (articles des 4 dernières semaines) ont été
-- ajoutées par les migrations « swipe_questions_actualite » et « swipe_questions_actualite_lot2 ».
-- L'onglet Actualité tourne sur les 28 derniers jours et ne s'arrête jamais : non vues d'abord, puis les plus anciennement vues.
-- Mode Swipe : onglets Aléatoire / Mes erreurs / Actualité / Mes cours.
-- Aléatoire reste swipe_lot. Les autres passent par swipe_lot_choix (même forme de réponse,
-- mêmes filtres : questions publiées, au moins 2 options, hors questions gardées).
create or replace function public.swipe_lot_choix(p_mode text, p_niveau text default null, p_matiere text default null, p_nombre int default 10)
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare v_user uuid := auth.uid(); v_niveau public.niveau_scolaire; v_n int := least(greatest(coalesce(p_nombre, 10), 1), 12); v_lot jsonb;
begin
  if v_user is null then return '[]'::jsonb; end if;
  begin
    v_niveau := coalesce(nullif(p_niveau, '')::public.niveau_scolaire, (select niveau from public.profils where id = v_user), 'terminale');
  exception when others then v_niveau := 'terminale';
  end;

  select coalesce(jsonb_agg(x.j order by x.k), '[]'::jsonb) into v_lot from (
    select jsonb_build_object('id', q.id, 'enonce', q.enonce, 'matiere', m.nom,
             'options', (select jsonb_agg(o.texte order by o.position) from public.question_options o where o.question_id = q.id),
             'contexte', case when p_mode = 'erreurs' then 'erreurs' else 'revision' end,
             'etiquette', case when p_mode = 'erreurs' then 'Revanche' when p_mode = 'actu' then 'Actualité' else m.nom end,
             'raison', case when p_mode = 'erreurs' then 'Une question que tu as ratée.' when p_mode = 'actu' then coalesce(ac.titre, '') else '' end) j,
           row_number() over (order by
             case when p_mode = 'erreurs' then e.revoir_le end asc nulls last,
             case when v.derniere is null then 0 else 1 end,
             case when p_mode = 'actu' then v.derniere end asc nulls first,
             case when p_mode = 'actu' then ac.publie_le end desc nulls last, random()) k
      from public.questions q
      join public.matieres m on m.id = q.matiere_id
      left join public.erreurs_utilisateur e on e.user_id = v_user and e.question_id = q.id
      left join public.actualite_questions aq on aq.question_id = q.id
      left join public.actualites ac on ac.id = aq.actualite_id
      left join lateral (select max(t.cree_le) derniere from public.tentatives_question t
                          where t.user_id = v_user and t.question_id = q.id) v on true
     where q.statut = 'publie' and (q.niveau = v_niveau or q.niveau is null)
       and public.matiere_du_niveau(q.matiere_id, v_niveau)
       and (select count(*) from public.question_options o where o.question_id = q.id) >= 2
       and not public.question_gardee(q.id)
       and case p_mode
             when 'erreurs' then e.id is not null and not e.acquise
             when 'actu'    then aq.question_id is not null and ac.statut = 'publie' and ac.publie_le >= now() - interval '28 days'
             when 'cours'   then m.nom = p_matiere
             else false end
       and (p_mode in ('erreurs', 'actu') or v.derniere is null or v.derniere < now() - interval '1 day')
     order by k limit v_n) x;

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
revoke all on function public.swipe_lot_choix(text, text, text, int) from public, anon;
grant execute on function public.swipe_lot_choix(text, text, text, int) to authenticated;
