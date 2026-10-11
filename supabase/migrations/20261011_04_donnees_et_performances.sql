-- =====================================================================
-- 11 octobre 2026 · Lot 3 — données remises d'aplomb, performances
-- =====================================================================

-- Les sujets 2026-08 et 2026-09 sont faits de Maths, SVT et Physique de 3e :
-- ils ne sont plus rattachés à ENAREF cycle C (niveau licence).
update public.sujets set niveau = 'troisieme', concours_id = null
 where reference in ('2026-08', '2026-09');

-- Index sur les clés étrangères réellement utilisées par les lectures
create index if not exists idx_compo_reponses_question on public.composition_reponses (question_id);
create index if not exists idx_compositions_sujet on public.compositions (sujet_id);
create index if not exists idx_compositions_user on public.compositions (user_id, debut_le desc);
create index if not exists idx_erreurs_question on public.erreurs_utilisateur (question_id);
create index if not exists idx_questions_matiere on public.questions (matiere_id) where statut = 'publie';
create index if not exists idx_sujet_questions_question on public.sujet_questions (question_id);
create index if not exists idx_tq_session on public.tentatives_question (session_id);
create index if not exists idx_tq_user_question on public.tentatives_question (user_id, question_id);
create index if not exists idx_ressources_matiere on public.ressources (matiere_id);
create index if not exists idx_paiements_abonnement on public.paiements (abonnement_id);
create index if not exists idx_sujets_concours on public.sujets (concours_id);
create index if not exists idx_progression_matiere on public.progression_matiere (matiere_id);

-- auth.uid() évalué une fois par requête, pas une fois par ligne
alter policy "profil lisible par son propriétaire" on public.profils using ((id = (select auth.uid())) or securite.est_equipe());
alter policy "profil modifiable par son propriétaire" on public.profils using (id = (select auth.uid())) with check (id = (select auth.uid()));
alter policy "profil créé par son propriétaire" on public.profils with check (id = (select auth.uid()));
alter policy "rôles visibles par l'intéressé" on public.roles_utilisateur using ((user_id = (select auth.uid())) or securite.est_admin());
alter policy "mes compositions" on public.compositions using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy "mes réponses" on public.composition_reponses
  using (exists (select 1 from public.compositions c where c.id = composition_reponses.composition_id and c.user_id = (select auth.uid())))
  with check (exists (select 1 from public.compositions c where c.id = composition_reponses.composition_id and c.user_id = (select auth.uid())));
alter policy "mes erreurs" on public.erreurs_utilisateur using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy "mon assiduité" on public.assiduite using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy "ma progression" on public.progression_matiere using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy "mon abonnement" on public.abonnements using ((user_id = (select auth.uid())) or securite.est_admin());
alter policy "mes paiements" on public.paiements using ((user_id = (select auth.uid())) or securite.est_admin());
alter policy "mes notifications" on public.notifications using (user_id = (select auth.uid()));
alter policy "je marque mes notifications" on public.notifications using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
