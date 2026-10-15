-- Accès « investisseur » (appliqué le 15 octobre 2026, en deux passes ; ceci décrit l'état final).
-- L'investisseur voit l'administration comme l'équipe, en LECTURE SEULE :
--   * aucune politique d'écriture, aucune fonction d'action (bannir, publier, changer un code, payer) ;
--   * les numéros des candidats lui sont masqués (70 •• •• 12) ; il ne lit pas la table profils directement ;
--   * « Mon accès » et « Musique » ne lui sont pas affichés.

alter type public.role_app add value if not exists 'investisseur';

create or replace function securite.est_investisseur()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.roles_utilisateur where user_id = auth.uid() and role = 'investisseur');
$$;
create or replace function securite.est_lecteur()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select securite.est_equipe() or securite.est_investisseur();
$$;
grant execute on function securite.est_investisseur(), securite.est_lecteur() to authenticated;

-- Lecture des tables affichées dans l'administration (politique « investisseur lit », select seulement)
-- sur : depots, questions, question_options, ressources, sujets, sujet_questions, actualites, propositions_ia,
-- documents_importes, lots_import, epreuves_collectives, inscriptions_epreuve, signalements, journal_activite,
-- concours, chapitres, matieres, propositions_candidats, compositions, bannissements, paiements, abonnements,
-- cours, musiques, sources_officielles, taches_ia ; et storage.objects (cours, documents-importes, preuves-paiement).
-- profils : politique présente mais neutralisée (using false) — les candidats passent par candidats_page.
alter policy "investisseur lit" on public.profils using (false);

-- Fonctions de lecture ouvertes à securite.est_lecteur() : tableau_de_bord, stats_generales, entonnoir,
-- abandons_composition, ecrans, clics_boutons, questions_difficiles, temps_reel, retention, indicateurs_produit,
-- candidats_suspects (numéros masqués hors équipe), candidats_page (numéros masqués hors équipe).
-- Restent réservées à l'administrateur : chronologie, paiements_en_attente, mon_recu et toutes les actions.

-- Compte : identifiant « investisseur Jules » → investisseurjules@candidat.monconcours.bf, rôle investisseur.
