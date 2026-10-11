-- =====================================================================
-- 11 octobre 2026 · Lot 1 — fermer les accès (audit OWASP)
-- A01-001, A01-002, A01-003, A01-004, A05-001, A05-002, A06-002, A07-001
-- =====================================================================

-- 1. Fonctions internes : plus aucune exécution depuis l'extérieur
revoke execute on function public.creer_notification(uuid,text,text,text,text) from public, anon, authenticated;
revoke execute on function public.purger_tentatives() from public, anon, authenticated;
revoke execute on function public.notifier_paiement() from public, anon, authenticated;
revoke execute on function public.notifier_resultat_composition() from public, anon, authenticated;
revoke execute on function public.compositions_verrou_note() from public, anon, authenticated;
revoke execute on function public.confirmer_candidat() from public, anon, authenticated;
revoke execute on function public.nouvel_utilisateur() from public, anon, authenticated;

-- 2. Statistiques de visite : formats stricts (rien d'interprétable comme du HTML)
alter table public.evenements
  add constraint evenements_nom_format check (nom ~ '^[A-Z0-9_]{1,60}$'),
  add constraint evenements_ecran_format check (ecran is null or ecran ~ '^[A-Za-z_]{1,30}$'),
  add constraint evenements_element_format check (element is null or element ~ '^[A-Za-z0-9_ .:-]{1,60}$'),
  add constraint evenements_precedent_format check (precedent is null or precedent ~ '^[A-Z0-9_]{1,60}$'),
  add constraint evenements_version_format check (version_app is null or version_app ~ '^[A-Za-z0-9._-]{1,20}$'),
  add constraint evenements_meta_taille check (meta is null or length(meta::text) <= 2000);

alter table public.sessions
  add constraint sessions_textes_format check (
    coalesce(appareil,'') ~ '^[A-Za-z_-]{0,20}$' and coalesce(navigateur,'') ~ '^[A-Za-z_-]{0,20}$'
    and coalesce(systeme,'') ~ '^[A-Za-z_-]{0,20}$' and coalesce(version_app,'') ~ '^[A-Za-z0-9._-]{0,20}$'
    and coalesce(langue,'') ~ '^[A-Za-z@_-]{0,24}$' and coalesce(source,'') ~ '^[a-z_]{0,20}$');

-- 3. Profils : nom lisible, téléphone à 8 chiffres
alter table public.profils
  add constraint profils_nom_format check (length(nom) between 1 and 80 and nom !~ '[<>"`\\{}]'),
  add constraint profils_telephone_format check (telephone is null or telephone ~ '^[0-9]{8}$');

-- 4. Sessions : plus de modification libre, deux fonctions précises à la place
-- (la règle « session modifiable par la sienne » est neutralisée plutôt que supprimée)
alter policy "session modifiable par la sienne" on public.sessions using (false) with check (false);

create or replace function public.fermer_session(p_id uuid, p_duree int, p_ecrans int, p_actions int)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.sessions
     set fin_le = now(),
         duree_active_s = least(greatest(coalesce(p_duree,0),0), 86400),
         nb_ecrans = least(greatest(coalesce(p_ecrans,0),0), 10000),
         nb_actions = least(greatest(coalesce(p_actions,0),0), 100000)
   where id = p_id and debut_le > now() - interval '2 days';
end $$;

create or replace function public.rattacher_session(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  update public.sessions set user_id = auth.uid()
   where id = p_id and user_id is null and debut_le > now() - interval '2 days';
end $$;
revoke execute on function public.fermer_session(uuid,int,int,int) from public;
revoke execute on function public.rattacher_session(uuid) from public, anon;
grant execute on function public.fermer_session(uuid,int,int,int) to anon, authenticated;
grant execute on function public.rattacher_session(uuid) to authenticated;

-- 5. Points : chacun ne voit que les siens
alter policy "points visibles" on public.points_journal
  using (user_id = (select auth.uid()) or securite.est_admin());

-- 6. Compositions : une copie naît vide, quoi qu'envoie le téléphone
create or replace function public.compositions_naissance()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if securite.est_equipe() then return new; end if;
  new.score := null; new.terminee := false; new.fin_le := null;
  new.duree_secondes := null; new.debut_le := now(); new.nb_traitees := 0;
  return new;
end $$;
revoke execute on function public.compositions_naissance() from public, anon, authenticated;
create trigger trg_compositions_naissance before insert on public.compositions
  for each row execute function public.compositions_naissance();

-- 7 et 8. Code oublié, déblocage par l'admin, contrôle de connexion :
--    voir 20261011_02_code_oublie.sql (version appliquée).
