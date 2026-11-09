-- Code d'accès à l'espace partenaire (226226 par défaut), anciennes entrées sans code fermées, partenaire Patrick créé.
-- Voir la migration appliquée « partenaires_code_acces_patrick ».
alter table public.partenaires add column if not exists code_acces text not null default '226226';
