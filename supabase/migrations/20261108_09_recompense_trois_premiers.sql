-- Récompense automatique : une année d'abonnement offerte aux 3 premiers d'une composition nationale.
-- Se déclenche pour toute composition dont la récompense contient « 3 premiers », 5 minutes après la fin.
create or replace function public.attribuer_recompenses_epreuves()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare e record; g record; v_n int := 0; v_resume text; v_cle text;
begin
  for e in select * from public.epreuves_collectives
            where recompense ilike '%3 premiers%'
              and fin_le + interval '5 minutes' <= now()
              and fin_le > now() - interval '2 days'
  loop
    v_cle := 'cadeau-' || e.id::text;
    v_resume := '';
    for g in
      select t.user_id, t.score, t.duree_secondes, t.rang, p.nom, p.telephone
        from (
          select c.user_id, c.score, c.duree_secondes,
                 row_number() over (order by c.score desc, c.duree_secondes asc nulls last, c.debut_le asc, c.id) rang
            from public.compositions c
            join public.roles_utilisateur r on r.user_id = c.user_id and r.role = 'candidat'
           where c.epreuve_id = e.id and c.terminee and coalesce(c.score, 0) > 0
        ) t
        join public.profils p on p.id = t.user_id
       where t.rang <= 3
       order by t.rang
    loop
      continue when exists (select 1 from public.notifications n where n.user_id = g.user_id and n.cle_unicite = v_cle);
      perform securite.activer_pass(g.user_id, 'annuelle');
      insert into public.paiements (user_id, operateur, montant_fcfa, statut, formule, mode, regle_le, nom_compte)
      values (g.user_id, 'code', 0, 'confirme', 'annuelle', 'code', now(), 'Offert · ' || left(e.titre, 60));
      perform public.notifier(g.user_id, 'paiement',
        case g.rang when 1 then 'Bravo, vous êtes premier !' else 'Bravo, vous êtes sur le podium !' end,
        'Vous terminez ' || g.rang || case when g.rang = 1 then 'er' else 'e' end || ' de la composition nationale. Une année d''abonnement vous est offerte : elle est déjà active sur votre compte.',
        v_cle, 'abonnement', true);
      v_resume := v_resume || g.rang || '. ' || g.nom || ' (' || g.telephone || ') · ' || g.score || E'\n';
      v_n := v_n + 1;
    end loop;
    if v_resume <> '' then
      for g in select user_id from public.roles_utilisateur where role = 'admin' loop
        perform public.notifier(g.user_id, 'annonce', 'Année offerte attribuée', left(e.titre, 80) || E'\n' || v_resume, v_cle || '-resume', null, false);
      end loop;
    end if;
  end loop;
  return v_n;
end $function$;

revoke all on function public.attribuer_recompenses_epreuves() from public, anon, authenticated;

select cron.schedule('recompenses-epreuves', '*/5 * * * *', $$select public.attribuer_recompenses_epreuves()$$);
