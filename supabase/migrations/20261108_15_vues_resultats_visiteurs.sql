-- Les visiteurs sans compte comptent aussi parmi ceux qui ont vu les résultats (un identifiant anonyme par appareil).
create table if not exists public.resultats_vues_visiteurs(
  epreuve_id uuid not null, visiteur text not null, vu_le timestamptz not null default now(),
  primary key(epreuve_id, visiteur));
alter table public.resultats_vues_visiteurs enable row level security;
revoke all on public.resultats_vues_visiteurs from anon, authenticated;

drop function if exists public.compter_vue_resultats(uuid);
create or replace function public.compter_vue_resultats(p_epreuve uuid, p_visiteur text default null) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if not exists (select 1 from public.epreuves_collectives e where e.id = p_epreuve and e.statut = 'programmee' and e.fin_le <= now()) then return; end if;
  if auth.uid() is not null then
    insert into public.resultats_vues(epreuve_id, user_id) values (p_epreuve, auth.uid()) on conflict do nothing;
  elsif p_visiteur is not null and p_visiteur ~ '^[A-Za-z0-9-]{16,64}$' then
    insert into public.resultats_vues_visiteurs(epreuve_id, visiteur) values (p_epreuve, p_visiteur) on conflict do nothing;
  end if;
end $$;
revoke all on function public.compter_vue_resultats(uuid, text) from public;
grant execute on function public.compter_vue_resultats(uuid, text) to anon, authenticated;

do $do$
declare d text;
begin
  d := pg_get_functiondef('public.derniere_nationale()'::regprocedure);
  d := replace(d, '''vues'', (select count(*) from public.resultats_vues where epreuve_id = v_ep.id));',
    '''vues'', (select count(*) from public.resultats_vues where epreuve_id = v_ep.id) + (select count(*) from public.resultats_vues_visiteurs where epreuve_id = v_ep.id));');
  execute d;
end $do$;
