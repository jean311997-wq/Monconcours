-- Parcours au 12 novembre : on garde le normal (A) et B, on ajoute Élite 1 (E1) et Élite 2 (E2).
-- X, C et D ne reçoivent plus personne (masqués, pas supprimés). Rotation par blocs de 50 nouveaux visiteurs.
create or replace function public.attribuer_parcours() returns text
language plpgsql security definer set search_path to 'public' as $$
declare n bigint; p text;
begin
  n := nextval('public.parcours_seq');
  p := (array['A','B','E1','E2'])[1 + (((n - 1) / 50) % 4)::int];
  begin
    insert into securite.affectations_parcours (n, parcours) values (n, p) on conflict do nothing;
  exception when others then null;
  end;
  return p;
end $$;

create or replace function public.noter_parcours(p_parcours text) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null or p_parcours not in ('A','B','C','D','X','E1','E2','X-apercu','B-apercu','A-apercu','E1-apercu','E2-apercu') then return; end if;
  update public.profils set parcours = p_parcours where id = auth.uid() and parcours is null;
end $$;
