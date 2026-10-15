-- 15 octobre 2026 (3) — lectures plus rapides : securite.est_equipe() n'est
-- plus recalculé pour chaque ligne (initplan). La banque de questions passe
-- de ~95 ms à ~17 ms côté base. Les règles d'accès ne changent pas.
alter policy "questions gérées par l'équipe" on public.questions using ((select securite.est_equipe())) with check ((select securite.est_equipe()));
alter policy "questions publiées visibles" on public.questions using (statut = 'publie'::statut_publication or (select securite.est_equipe()));
alter policy "options des questions publiées" on public.question_options using (exists (select 1 from public.questions q where q.id = question_options.question_id and q.statut = 'publie'::statut_publication) or (select securite.est_equipe()));
alter policy "options gérées par l'équipe" on public.question_options using ((select securite.est_equipe())) with check ((select securite.est_equipe()));
alter policy "actualités gérées par l'équipe" on public.actualites using ((select securite.est_equipe())) with check ((select securite.est_equipe()));
alter policy "actualités publiées visibles" on public.actualites using (statut = 'publie'::statut_publication or (select securite.est_equipe()));
alter policy "ressources gérées par l'équipe" on public.ressources using ((select securite.est_equipe())) with check ((select securite.est_equipe()));
alter policy "ressources publiées visibles" on public.ressources using (statut = 'publie'::statut_publication or (select securite.est_equipe()));
alter policy "matieres en écriture" on public.matieres using ((select securite.est_equipe())) with check ((select securite.est_equipe()));
alter policy "profil lisible par son propriétaire" on public.profils using (id = (select auth.uid()) or (select securite.est_equipe()));
