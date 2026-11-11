-- Les vues des résultats comptent chaque ouverture (un même candidat qui revient s'ajoute), pas une fois par personne.
-- Une seule ligne par composition, incrémentée : pas de table qui grossit à chaque clic.
create table if not exists public.resultats_vues_total(
  epreuve_id uuid primary key, nb bigint not null default 0);
alter table public.resultats_vues_total enable row level security;
revoke all on public.resultats_vues_total from anon, authenticated;

-- point de départ : ce qui était déjà affiché (candidats + visiteurs distincts)
insert into public.resultats_vues_total(epreuve_id, nb)
select e, sum(n) from (
  select epreuve_id e, count(*) n from public.resultats_vues group by 1
  union all select epreuve_id, count(*) from public.resultats_vues_visiteurs group by 1) t
group by e
on conflict (epreuve_id) do nothing;

create or replace function public.compter_vue_resultats(p_epreuve uuid, p_visiteur text default null) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if not exists (select 1 from public.epreuves_collectives e where e.id = p_epreuve and e.statut = 'programmee' and e.fin_le <= now()) then return; end if;
  insert into public.resultats_vues_total(epreuve_id, nb) values (p_epreuve, 1)
  on conflict (epreuve_id) do update set nb = public.resultats_vues_total.nb + 1;
end $$;
revoke all on function public.compter_vue_resultats(uuid, text) from public;
grant execute on function public.compter_vue_resultats(uuid, text) to anon, authenticated;

do $do$
declare d text;
begin
  d := pg_get_functiondef('public.derniere_nationale()'::regprocedure);
  d := replace(d, '''vues'', (select count(*) from public.resultats_vues where epreuve_id = v_ep.id) + (select count(*) from public.resultats_vues_visiteurs where epreuve_id = v_ep.id));',
    '''vues'', coalesce((select nb from public.resultats_vues_total where epreuve_id = v_ep.id), 0));');
  if position('resultats_vues_total' in d) = 0 then raise exception 'derniere_nationale non modifiée'; end if;
  execute d;
end $do$;
