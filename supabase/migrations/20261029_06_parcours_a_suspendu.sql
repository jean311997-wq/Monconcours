-- Le parcours A est suspendu (pas supprimé) : les nouveaux visiteurs reçoivent B, C ou D.
-- Pour le remettre : array['A','B','C','D'] et % 4.
create or replace function public.attribuer_parcours()
returns text language plpgsql security definer set search_path to 'public' as $$
declare n bigint;
begin
  n := nextval('public.parcours_seq');
  return (array['B','C','D'])[1 + (((n - 1) / 20) % 3)::int];
end $$;
