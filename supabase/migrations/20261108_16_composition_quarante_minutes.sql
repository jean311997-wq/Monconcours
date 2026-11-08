-- Toute composition dure désormais 40 minutes (sujets, compositions nationales à venir, planification automatique).
update public.sujets set duree_secondes = 2400 where duree_secondes is distinct from 2400;
alter table public.sujets alter column duree_secondes set default 2400;
update public.epreuves_collectives set fin_le = debut_le + interval '40 minutes' where statut = 'programmee' and debut_le > now();
do $do$
declare d text;
begin
  d := pg_get_functiondef('public.planifier_composition_nationale()'::regprocedure);
  d := replace(d, 'coalesce(v_s.duree_secondes,1800)', 'coalesce(v_s.duree_secondes,2400)');
  execute d;
end $do$;
