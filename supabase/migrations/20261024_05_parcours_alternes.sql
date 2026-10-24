-- Deux parcours en alternance par blocs de 20 nouveaux visiteurs :
-- 1 à 20 : A (parcours actuel) · 21 à 40 : B (inscription pour voir la note) · 41 à 60 : A · etc.
create sequence if not exists public.parcours_seq;
revoke all on sequence public.parcours_seq from public, anon, authenticated;
create or replace function public.attribuer_parcours()
returns text language plpgsql security definer set search_path to 'public' as $$
declare n bigint;
begin
  n := nextval('public.parcours_seq');
  return case when ((n - 1) / 20) % 2 = 0 then 'A' else 'B' end;
end $$;
revoke execute on function public.attribuer_parcours() from public;
grant execute on function public.attribuer_parcours() to anon, authenticated;
