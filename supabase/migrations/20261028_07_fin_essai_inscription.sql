-- Plus d'essai de 7 jours à l'inscription : un nouveau compte démarre avec l'abonnement gratuit
-- (10 corrections par jour, 3 compositions). Les essais déjà en cours vont jusqu'à leur fin.
create or replace function public.nouvel_utilisateur()
returns trigger language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
begin
  insert into public.profils (id, nom, telephone, niveau, couleur)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'nom',''), 'Candidat'),
    nullif(new.raw_user_meta_data->>'telephone',''),
    nullif(new.raw_user_meta_data->>'niveau','')::niveau_scolaire,
    lower(nullif(new.raw_user_meta_data->>'couleur',''))
  )
  on conflict (id) do nothing;

  insert into public.roles_utilisateur (user_id, role)
  values (new.id, 'candidat') on conflict do nothing;

  return new;
end $function$;
