-- 29 octobre 2026 : confirmation d'inscription à la composition nationale,
-- actualités programmées (invisibles avant leur heure de publication).
create or replace function public.inscrire_epreuve(p_epreuve uuid, p_afficher_nom boolean default true)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_neuf boolean; v_ep record; v_h text;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'connexion', true, 'message', 'Crée ton compte pour t''inscrire.'); end if;
  select e.* into v_ep from public.epreuves_collectives e where e.id = p_epreuve and e.statut = 'programmee' and e.fin_le > now();
  if not found then
    return jsonb_build_object('ok', false, 'message', 'Cette composition est terminée.'); end if;
  insert into public.inscriptions_epreuve (epreuve_id, user_id, afficher_nom)
  values (p_epreuve, auth.uid(), coalesce(p_afficher_nom, true))
  on conflict (epreuve_id, user_id) do update set afficher_nom = excluded.afficher_nom
  returning (xmax = 0) into v_neuf;
  if v_neuf then
    v_h := to_char(v_ep.debut_le at time zone 'Africa/Ouagadougou', 'FMHH24') || ' h ' || to_char(v_ep.debut_le at time zone 'Africa/Ouagadougou', 'MI');
    perform public.notifier(auth.uid(), 'rappel', 'Vous êtes inscrit',
      case when (v_ep.debut_le at time zone 'Africa/Ouagadougou')::date = (now() at time zone 'Africa/Ouagadougou')::date
           then 'La composition nationale commence aujourd''hui à ' || v_h || '. Soyez prêt cinq minutes avant.'
           else 'La composition nationale commence le ' || to_char(v_ep.debut_le at time zone 'Africa/Ouagadougou', 'DD/MM') || ' à ' || v_h || '. Nous vous préviendrons le jour même.' end,
      'insc-' || p_epreuve::text, 'aujourdhui', false);
  end if;
  return jsonb_build_object('ok', true, 'inscrits', (select count(*) from public.inscriptions_epreuve where epreuve_id = p_epreuve));
end $$;

drop policy if exists "actualités publiées visibles" on public.actualites;
create policy "actualités publiées visibles" on public.actualites for select
  using (((statut = 'publie'::statut_publication) and (publie_le is null or publie_le <= now())) or (select securite.est_equipe()));

-- Note : communaute_auto_publier(boolean) a aussi été modifiée en base : sa recherche de
-- l'actualité du jour ajoute la condition « publie_le <= now() ».
-- Les actualités du 29 octobre au 1er novembre et la relecture des questions (526 publiées,
-- 748 rejetées) ont été faites directement en base ; ce sont des données, pas du schéma.
