-- Un commentaire de l'administration peut compter jusqu'à 1000 caractères (la fonction le permet déjà) ;
-- la règle de la table s'arrêtait à 500 et renvoyait une erreur brute. Les candidats restent limités à 500 par la fonction.
alter table public.communaute_commentaires drop constraint if exists communaute_commentaires_texte_check;
alter table public.communaute_commentaires add constraint communaute_commentaires_texte_check
  check (char_length(btrim(texte)) >= 1 and char_length(btrim(texte)) <= 1000);
