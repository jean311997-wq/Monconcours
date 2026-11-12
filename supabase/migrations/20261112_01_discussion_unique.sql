-- Une seule discussion qui continue d'une composition à l'autre : on lit les messages de toutes les compositions.
-- On écrit toujours au nom de la composition ouverte ; les droits d'écriture ne changent pas.
do $do$
declare d text;
begin
  d := pg_get_functiondef('public.discussion_charger(uuid)'::regprocedure);
  d := replace(d, 'public.nom_resultat(m.auteur, p_epreuve)', 'public.nom_resultat(m.auteur, m.epreuve_id)');
  d := replace(d, 'from public.discussion_messages m where m.epreuve_id = p_epreuve order by m.cree_le desc limit 60', 'from public.discussion_messages m order by m.cree_le desc limit 60');
  d := replace(d, 'select count(*) into v_n from public.discussion_messages where epreuve_id = p_epreuve;', 'select count(*) into v_n from public.discussion_messages;');
  if position('where m.epreuve_id = p_epreuve' in d) > 0 or position('messages where epreuve_id = p_epreuve' in d) > 0 then raise exception 'discussion_charger non modifiée'; end if;
  execute d;

  d := pg_get_functiondef('public.discussion_aimer(uuid)'::regprocedure);
  d := replace(d, 'not securite.discussion_acces(v_ep, v_user)', 'not (securite.discussion_acces(v_ep, v_user) or exists (select 1 from public.epreuves_collectives e where e.statut = ''programmee'' and now() >= e.fin_le and securite.discussion_acces(e.id, v_user)))');
  if position('programmee' in d) = 0 then raise exception 'discussion_aimer non modifiée'; end if;
  execute d;
end $do$;

-- Chaque lundi : on efface les messages de plus de trois semaines, en gardant toujours les 30 derniers.
create or replace function public.discussion_nettoyer() returns integer
language plpgsql security definer set search_path to 'public' as $$
declare n integer;
begin
  with garde as (select id from public.discussion_messages order by cree_le desc limit 30),
  del as (delete from public.discussion_messages m
           where m.cree_le < now() - interval '21 days' and m.id not in (select id from garde) returning 1)
  select count(*) into n from del;
  return n;
end $$;
revoke all on function public.discussion_nettoyer() from public, anon, authenticated;
select cron.unschedule('discussion-nettoyage') where exists (select 1 from cron.job where jobname = 'discussion-nettoyage');
select cron.schedule('discussion-nettoyage', '30 3 * * 1', $$select public.discussion_nettoyer()$$);
