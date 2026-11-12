-- Mode Swipe : la bonne réponse et l'explication arrivent avec la série,
-- pour afficher la correction sans attendre le réseau (validé le 12 novembre 2026).
-- La correction serveur (points, erreurs, limites gratuites) reste faite en arrière-plan.
do $do$
declare f text; d text;
begin
  foreach f in array array['swipe_lot','swipe_lot_choix'] loop
    select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = f;
    d := replace(d, '''repartition'', r.rep, ''repondants'', coalesce(r.n, 0))',
      '''repartition'', r.rep, ''repondants'', coalesce(r.n, 0), ''bonnes'', to_jsonb(public.bonnes_reponses(q.id)), ''explication'', q.explication)');
    execute d;
  end loop;
end $do$;
