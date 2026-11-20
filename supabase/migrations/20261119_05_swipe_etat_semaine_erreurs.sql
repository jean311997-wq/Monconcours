CREATE OR REPLACE FUNCTION public.swipe_etat()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_user uuid := auth.uid(); v_n numeric := 0; v_c numeric := 0; v_n7 numeric := 0; v_c7 numeric := 0;
  v_serie int := 0; v_jour date := current_date; v_aujourdhui boolean; p securite.swipe_population; v_mj int; v_mh int;
  v_sem jsonb; v_err int;
begin
  if v_user is null then return jsonb_build_object('ok', false); end if;
  if public.swipe_ferme() then return jsonb_build_object('ok', false, 'ferme', true); end if;
  -- la note d'aujourd'hui : les 150 dernières réponses du mois
  select coalesce(sum(w), 0), coalesce(sum(w) filter (where correcte), 0) into v_n, v_c from (
    select t.correcte, case when q.source = 'annale' then 2 else 1 end w
      from public.tentatives_question t join public.questions q on q.id = t.question_id
     where t.user_id = v_user and t.cree_le > now() - interval '30 days'
     order by t.cree_le desc limit 150) z;
  -- la note d'il y a 7 jours, calculée de la même façon
  select coalesce(sum(w), 0), coalesce(sum(w) filter (where correcte), 0) into v_n7, v_c7 from (
    select t.correcte, case when q.source = 'annale' then 2 else 1 end w
      from public.tentatives_question t join public.questions q on q.id = t.question_id
     where t.user_id = v_user and t.cree_le > now() - interval '37 days' and t.cree_le < now() - interval '7 days'
     order by t.cree_le desc limit 150) z;
  v_aujourdhui := exists (select 1 from public.assiduite where user_id = v_user and jour = current_date);
  if not v_aujourdhui then v_jour := current_date - 1; end if;
  while exists (select 1 from public.assiduite where user_id = v_user and jour = v_jour) and v_serie < 400 loop
    v_serie := v_serie + 1; v_jour := v_jour - 1;
  end loop;
  select count(*) filter (where t.cree_le >= date_trunc('day', now())),
         count(*) filter (where t.cree_le < date_trunc('day', now()))
    into v_mj, v_mh
    from public.tentatives_question t
   where t.user_id = v_user and t.cree_le >= date_trunc('day', now()) - interval '1 day';
  -- les jours venus cette semaine (lundi à dimanche) et les erreurs encore à revoir
  select coalesce(jsonb_agg(to_char(jour, 'YYYY-MM-DD') order by jour), '[]'::jsonb) into v_sem
    from public.assiduite where user_id = v_user and jour >= date_trunc('week', current_date)::date;
  select count(*) into v_err from public.erreurs_utilisateur where user_id = v_user and not coalesce(acquise, false);
  select * into p from securite.swipe_population where id = 1;
  return jsonb_build_object('ok', true, 'n', v_n, 'c', v_c,
    'note', round(20 * (v_c + 6) / (v_n + 12), 1),
    'note_semaine', case when v_n7 >= 20 then round(20 * (v_c7 + 6) / (v_n7 + 12), 1) end,
    'serie_jours', v_serie, 'joue_aujourdhui', v_aujourdhui,
    'histo', to_jsonb(p.histo), 'total', p.total, 'barre', p.barre,
    'en_ligne', p.en_ligne, 'aujourdhui', p.aujourdhui, 'mes_jour', v_mj, 'mes_hier', v_mh,
    'semaine', v_sem, 'erreurs', v_err);
end $function$;
