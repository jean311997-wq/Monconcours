-- Les compositions d'entraînement durent 30 minutes au lieu de 25.
alter table public.sujets alter column duree_secondes set default 1800;
update public.sujets set duree_secondes = 1800 where duree_secondes = 1500;
