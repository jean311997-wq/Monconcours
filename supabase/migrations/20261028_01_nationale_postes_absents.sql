-- Composition nationale : « postes à pourvoir » (et non « places »), et une notification
-- pour les inscrits qui n'ont pas composé : la composition s'est terminée sans eux, le classement est publié.

do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname = 'annoncer_epreuve';
  d := replace(d, $q$' places, résultats et liste des admis à la fin.$q$, $q$' postes à pourvoir, résultats et liste des admis à la fin.$q$);
  execute d;
end $$;

create or replace function public.notifier_absents_epreuves()
returns void language plpgsql security definer set search_path to 'public' as $$
declare r record;
begin
  for r in
    select i.user_id, e.id epreuve, e.places,
           (select count(*) from public.compositions c where c.epreuve_id = e.id and c.terminee) participants
      from public.epreuves_collectives e
      join public.inscriptions_epreuve i on i.epreuve_id = e.id
     where e.statut = 'programmee' and e.fin_le <= now() and e.fin_le > now() - interval '7 days'
       and not exists (select 1 from public.compositions c where c.epreuve_id = e.id and c.user_id = i.user_id and c.terminee)
  loop
    perform public.notifier(r.user_id, 'resultat',
      'La composition est terminée sans vous',
      'Vous étiez inscrit, mais vous n''avez pas composé. Le classement est publié : ' || r.participants
        || ' candidat' || case when r.participants > 1 then 's' else '' end || ', ' || r.places
        || ' postes à pourvoir. Touchez pour le consulter.',
      'absent-' || r.epreuve, 'epreuve:' || r.epreuve, true);
  end loop;
end $$;
revoke execute on function public.notifier_absents_epreuves() from public, anon, authenticated;

do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname = 'envois_a_faire';
  if position('notifier_absents_epreuves' in d) = 0 then
    d := replace(d, 'perform public.preparer_relances_abonnement();',
                    'perform public.preparer_relances_abonnement();' || chr(10) || '  perform public.notifier_absents_epreuves();');
    execute d;
  end if;
end $$;
