-- Fin de l'offre flash : le Pass Année repasse à son prix normal pour tout le monde.
-- mon_offre_flash ne crée plus rien et répond toujours « inactive » ;
-- les offres déjà créées sont supprimées, donc soumettre_paiement applique le tarif normal.

create or replace function public.mon_offre_flash(p_creer boolean default false)
returns jsonb language sql security definer set search_path to 'public' as $$
  select jsonb_build_object('actif', false);
$$;
revoke execute on function public.mon_offre_flash(boolean) from public, anon;
grant execute on function public.mon_offre_flash(boolean) to authenticated;

delete from public.offres_flash;
delete from public.notifications where cle_unicite = 'offre-flash';
