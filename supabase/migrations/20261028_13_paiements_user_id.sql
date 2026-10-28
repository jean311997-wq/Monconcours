-- Ajoute user_id à paiements_en_attente pour rendre les lignes cliquables (fiche candidat)
create or replace function public.paiements_en_attente()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not securite.est_admin() then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'user_id', p.user_id, 'nom', pr.nom, 'telephone', p.telephone, 'nom_compte', p.nom_compte,
      'operateur', p.operateur, 'formule', coalesce(p.formule, p.reference_externe),
      'montant', p.montant_fcfa, 'preuve_chemin', p.preuve_chemin, 'statut', p.statut,
      'motif_refus', p.motif_refus, 'cree_le', p.cree_le, 'regle_le', p.regle_le
    ) order by (p.statut = 'en_attente') desc, p.cree_le desc)
    from public.paiements p
    left join public.profils pr on pr.id = p.user_id
  ), '[]'::jsonb);
end $function$;
