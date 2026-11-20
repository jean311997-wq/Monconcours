create table if not exists securite.deploiement_fichiers (nom text primary key, contenu text not null, cree_le timestamptz not null default now());
revoke all on securite.deploiement_fichiers from public, anon, authenticated;
create or replace function public.deploiement_fichier(p_nom text) returns text
language sql stable security definer set search_path = public as $$
  select contenu from securite.deploiement_fichiers where nom = p_nom;
$$;
revoke all on function public.deploiement_fichier(text) from public;
grant execute on function public.deploiement_fichier(text) to anon, authenticated;
