-- 30 octobre 2026 : plus de mathématiques et de psychotechnique, niveau relevé.
-- Données (faites directement en base) :
--   * 268 nouvelles questions rédigées et vérifiées par calcul (maths 3e, terminale, licence, problèmes de concours
--     tous niveaux, psychotechnique), difficulté 3 à 4, chacune avec son explication ;
--   * 101 questions trop évidentes archivées (leurres absurdes du type « le sommeil », « dormir », « la peur », ou maths
--     et psychotechnique de difficulté 1) ;
--   * 18 nouveaux sujets « 2026-m-<niveau>-01 à 06 » : 12 questions de maths, 8 de psychotechnique, 30 d'autres matières ;
--   * la composition nationale du 31/10/2026 à 18 h passe sur le sujet 2026-m-troisieme-01.

create or replace function securite.sujet_riche(p_sujet uuid) returns boolean language sql stable security definer set search_path to 'public' as $$
  select (select count(*) from public.sujet_questions sq join public.questions q on q.id = sq.question_id
           where sq.sujet_id = p_sujet and q.matiere_id in ('738abc20-57d1-42ee-b73a-dfcc888ca981', '29cb39b7-8ee0-4e22-be6b-cda4aae5b133')) >= 15;
$$;

-- les compositions et la nationale choisissent d'abord les sujets riches en maths et psychotechnique
do $do$ declare d text; begin
  d := pg_get_functiondef('public.ouvrir_composition(text)'::regprocedure);
  if d not like '%sujet_riche%' then
    d := replace(d, 'order by (s.niveau = v_niveau) desc nulls last,', 'order by (s.niveau = v_niveau) desc nulls last, securite.sujet_riche(s.id) desc,');
    execute d;
  end if;
  d := pg_get_functiondef('public.planifier_composition_nationale()'::regprocedure);
  if d not like '%sujet_riche%' then
    d := replace(d, 'order by (s.niveau = v_c.niveau_requis) desc nulls last,', 'order by (s.niveau = v_c.niveau_requis) desc nulls last, securite.sujet_riche(s.id) desc,');
    execute d;
  end if;
  -- « Pour toi » favorise les questions difficiles et les maths / psychotechnique
  d := pg_get_functiondef('public.fil_pour_toi(text,integer)'::regprocedure);
  if d not like '%then 8 else 0%' then
    d := replace(d, '+ random() * 12 as score', '+ case when coalesce(q.difficulte, 2) >= 3 then 12 else 0 end
             + case when q.matiere_id in (''738abc20-57d1-42ee-b73a-dfcc888ca981'', ''29cb39b7-8ee0-4e22-be6b-cda4aae5b133'') then 8 else 0 end
             + random() * 12 as score');
    execute d;
  end if;
end $do$;
