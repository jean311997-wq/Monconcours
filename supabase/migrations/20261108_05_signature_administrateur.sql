-- 8 novembre 2026 — Le deuxième compte d'administration signe « Administrateur Mon Concours »
-- (au lieu de « Administrateur 2 »), avec sa propre couleur dans la communauté.
-- Les publications et commentaires déjà écrits prennent le nouveau nom : le nom est lu à l'affichage.

alter table public.communaute_signatures add column if not exists couleur text;
alter table public.communaute_signatures drop constraint if exists communaute_signatures_couleur_ok;
alter table public.communaute_signatures add constraint communaute_signatures_couleur_ok
  check (couleur is null or couleur ~ '^#[0-9A-Fa-f]{6}$');

update public.communaute_signatures
   set nom = 'Administrateur Mon Concours', couleur = '#5AA2FF'
 where nom = 'Administrateur 2';

create or replace function securite.comm_json(p_id uuid, v_user uuid)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select jsonb_build_object(
    'id', p.id, 'type', p.type, 'texte', p.texte, 'image', p.image_chemin, 'carte', p.carte,
    'epingle', p.epingle, 'cache', p.cache, 'coeurs', p.nb_coeurs, 'comms', p.nb_comm, 'vues', p.nb_vues, 'cree_le', p.cree_le,
    'admin', securite.comm_est_adm(p.auteur),
    'nom', securite.comm_nom(p.auteur),
    'couleur', (select s.couleur from public.communaute_signatures s where s.user_id = p.auteur),
    'teinte', case when securite.comm_est_adm(p.auteur) then null else securite.comm_teinte(p.auteur) end,
    'concours', case when securite.comm_est_adm(p.auteur) then null else (select coalesce(c.sigle, c.nom) from public.concours c where c.id = p.concours_id) end,
    'moi', (p.auteur is not null and p.auteur = v_user), 'gerer', securite.est_admin(),
    'aime', exists (select 1 from public.communaute_coeurs k where k.publication_id = p.id and k.user_id = v_user))
  from public.communaute_publications p where p.id = p_id;
$function$;

create or replace function securite.comm_com_json(p_id uuid, v_user uuid)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select jsonb_build_object(
    'id', c.id, 'texte', c.texte, 'cree_le', c.cree_le, 'parent_id', c.parent_id,
    'parent_nom', (select securite.comm_nom(pc.auteur) from public.communaute_commentaires pc where pc.id = c.parent_id),
    'admin', securite.comm_est_adm(c.auteur),
    'nom', securite.comm_nom(c.auteur),
    'couleur', (select s.couleur from public.communaute_signatures s where s.user_id = c.auteur),
    'teinte', case when securite.comm_est_adm(c.auteur) then null else securite.comm_teinte(c.auteur) end,
    'moi', (c.auteur is not null and c.auteur = v_user), 'gerer', securite.est_admin())
  from public.communaute_commentaires c where c.id = p_id;
$function$;
