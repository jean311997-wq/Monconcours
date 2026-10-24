-- Rotation A, B, C par blocs de 20 nouveaux visiteurs.
create or replace function public.attribuer_parcours()
returns text language plpgsql security definer set search_path to 'public' as $$
declare n bigint;
begin
  n := nextval('public.parcours_seq');
  return (array['A','B','C'])[1 + (((n - 1) / 20) % 3)::int];
end $$;
