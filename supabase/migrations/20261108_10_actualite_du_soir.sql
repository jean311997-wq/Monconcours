-- Envoi unique, le 8 novembre 2026 à 20 h 05 (heure de Ouagadougou = UTC) : notification « L'actualité du jour est en ligne ».
-- La tâche programmée se supprime elle-même après l'envoi. Voir la fonction envoyer_actualite_du_soir_20261108.
select cron.schedule('actualite-soir-20261108', '5 20 8 11 *', $$select public.envoyer_actualite_du_soir_20261108()$$);
