-- Les cours de psychotechnique sont lus par l'application dans « ressources » : on les y publie, pour tous les niveaux.
insert into public.ressources (cours_id, chapitre_id, matiere_id, niveau, type_ressource, titre, texte, theme, telechargeable, statut, publie_le)
select c.id, c.chapitre_id, c.matiere_id, null, 'cours', c.titre, c.contenu, ch.nom, false, 'publie', now()
  from public.cours c join public.chapitres ch on ch.id = c.chapitre_id
 where c.matiere_id = (select id from public.matieres where code = 'PT') and c.statut = 'publie'
   and not exists (select 1 from public.ressources r where r.cours_id = c.id);
