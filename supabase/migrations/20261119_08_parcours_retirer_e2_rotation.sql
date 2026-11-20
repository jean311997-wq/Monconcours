-- 19 nov. 2026 : Élite 2 retiré de la rotation (ancienne version : array['A','B','E1','E2'], % 4). Les comptes déjà en E2 gardent leur parcours.
create or replace function public.attribuer_parcours()
returns text language plpgsql security definer set search_path to 'public' as $function$
declare n bigint; p text;
begin
  n := nextval('public.parcours_seq');
  p := (array['A','B','E1'])[1 + (((n - 1) / 50) % 3)::int];
  begin
    insert into securite.affectations_parcours (n, parcours) values (n, p) on conflict do nothing;
  exception when others then null;
  end;
  return p;
end $function$;
