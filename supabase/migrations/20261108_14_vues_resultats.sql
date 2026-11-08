-- Nombre de candidats qui ont ouvert les résultats d'une composition (une fois par personne).
create table if not exists public.resultats_vues(
  epreuve_id uuid not null, user_id uuid not null, vu_le timestamptz not null default now(),
  primary key(epreuve_id, user_id));
alter table public.resultats_vues enable row level security;
revoke all on public.resultats_vues from anon, authenticated;

create or replace function public.compter_vue_resultats(p_epreuve uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null then return; end if;
  if not exists (select 1 from public.epreuves_collectives e where e.id = p_epreuve and e.statut = 'programmee' and e.fin_le <= now()) then return; end if;
  insert into public.resultats_vues(epreuve_id, user_id) values (p_epreuve, auth.uid()) on conflict do nothing;
end $$;
revoke all on function public.compter_vue_resultats(uuid) from public, anon;
grant execute on function public.compter_vue_resultats(uuid) to authenticated;

do $do$
declare d text;
begin
  d := pg_get_functiondef('public.derniere_nationale()'::regprocedure);
  d := replace(d, '''participants'', (select count(*) from public.compositions where epreuve_id = v_ep.id and terminee));',
    '''participants'', (select count(*) from public.compositions where epreuve_id = v_ep.id and terminee),' || E'\n' ||
    '    ''vues'', (select count(*) from public.resultats_vues where epreuve_id = v_ep.id));');
  execute d;
end $do$;
