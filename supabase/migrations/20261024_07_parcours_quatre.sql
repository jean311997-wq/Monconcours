-- Rotation A, B, C, D par blocs de 20 nouveaux visiteurs (25 % chacun).
create or replace function public.attribuer_parcours()
returns text language plpgsql security definer set search_path to 'public' as $$
declare n bigint;
begin
  n := nextval('public.parcours_seq');
  return (array['A','B','C','D'])[1 + (((n - 1) / 20) % 4)::int];
end $$;
