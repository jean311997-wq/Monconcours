-- Cohérence de l'administration (29/10/2026)
-- 1. Les moyennes de composition ne comptent plus les copies vides
-- 2. Le statut d'une épreuve passée s'affiche « terminée » (la valeur stockée ne change pas : d'autres fonctions s'en servent)
-- 3. « Inscrits au total » n'inclut plus l'équipe
-- 4. Une épreuve annulée retire son annonce des cloches et prévient les inscrits

create or replace function pg_temp.patch(p_fn regprocedure, p_ancien text, p_nouveau text) returns void language plpgsql as $$
declare d text;
begin
  d := pg_get_functiondef(p_fn);
  if position(p_ancien in d) = 0 then raise exception 'motif introuvable dans % : %', p_fn, p_ancien; end if;
  execute replace(d, p_ancien, p_nouveau);
end $$;

select pg_temp.patch('public.indicateurs_produit()'::regprocedure,
  'from public.compositions where terminee and debut_le > now()',
  'from public.compositions where terminee and nb_traitees > 0 and debut_le > now()');

select pg_temp.patch('public.compositions_suivi()'::regprocedure,
  'filter (where terminee)))', 'filter (where terminee and nb_traitees > 0)))');
select pg_temp.patch('public.compositions_suivi()'::regprocedure,
  'and c.terminee)) order by e.debut_le desc)', 'and c.terminee and c.nb_traitees > 0)) order by e.debut_le desc)');
select pg_temp.patch('public.compositions_suivi()'::regprocedure,
  '''statut'', e.statut,',
  '''statut'', case when e.statut = ''annulee'' then ''annulee'' when e.fin_le < now() then ''terminee'' when e.debut_le <= now() then ''en_cours'' else ''programmee'' end,');

select pg_temp.patch('public.fiche_candidat(uuid)'::regprocedure,
  'filter (where terminee))) from public.compositions where user_id = p_user',
  'filter (where terminee and nb_traitees > 0))) from public.compositions where user_id = p_user');

select pg_temp.patch('public.tableau_de_bord(integer)'::regprocedure,
  '''inscrits'', (select count(*) from profils),',
  '''inscrits'', (select count(*) from profils p0 where not exists (select 1 from roles_utilisateur r where r.user_id = p0.id and r.role in (''admin'',''correcteur'',''investisseur''))),');
select pg_temp.patch('public.tableau_de_bord_p(integer,date,date)'::regprocedure,
  '''inscrits'', (select count(*) from profils),',
  '''inscrits'', (select count(*) from profils p0 where not exists (select 1 from roles_utilisateur r where r.user_id = p0.id and r.role in (''admin'',''correcteur'',''investisseur''))),');
select pg_temp.patch('public.bilan_metriques(date,date)'::regprocedure,
  '''profils'', (select count(*) from public.profils),',
  '''profils'', (select count(*) from public.profils p0 where not exists (select 1 from public.roles_utilisateur r where r.user_id = p0.id and r.role in (''admin'',''correcteur'',''investisseur''))),');

-- Épreuve annulée : l'annonce disparaît des cloches, les inscrits sont prévenus
create or replace function public.epreuve_annulee_nettoyer() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if new.statut = 'annulee' and old.statut is distinct from 'annulee' then
    update public.notifications set masquee = true, lue = true where cle_unicite = 'epreuve-' || new.id::text;
    if new.debut_le > now() then
      insert into public.notifications (user_id, type, titre, message, cle_unicite)
      select i.user_id, 'rappel', 'Composition annulée',
             'La composition « ' || new.titre || ' » n''aura pas lieu. La prochaine sera annoncée dans l''application.',
             'annul-' || new.id::text
        from public.inscriptions_epreuve i where i.epreuve_id = new.id
      on conflict do nothing;
    end if;
  end if;
  return null;
end $$;
drop trigger if exists trg_epreuve_annulee on public.epreuves_collectives;
create trigger trg_epreuve_annulee after update of statut on public.epreuves_collectives
  for each row execute function public.epreuve_annulee_nettoyer();

-- Les épreuves déjà annulées : on retire leurs annonces des cloches
update public.notifications n set masquee = true, lue = true
  from public.epreuves_collectives e
 where e.statut = 'annulee' and n.cle_unicite = 'epreuve-' || e.id::text and not n.masquee;
