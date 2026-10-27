-- « Pass » et « formule » deviennent « abonnement » dans tous les textes vus par les candidats.
update public.tarifs set libelle = replace(libelle, 'Pass ', 'Abonnement ') where libelle like 'Pass %';

update public.notifications
   set titre = replace(titre, 'Pass', 'Abonnement'), message = replace(message, 'Pass ', 'abonnement ')
 where titre like '%Pass%' or message like '%Pass %';

do $$
declare r record; d text;
begin
  for r in select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public'
              and p.proname in ('confirmer_paiement','notifier_paiement','preparer_relances_abonnement','ouvrir_composition','admin_activer_pass','mon_recu')
  loop
    d := pg_get_functiondef(r.oid);
    d := replace(d, 'Pass inconnu.', 'Abonnement inconnu.');
    d := replace(d, 'Pass activé. Le candidat est prévenu.', 'Abonnement activé. Le candidat est prévenu.');
    d := replace(d, 'coalesce(v_lib, ''Pass'')', 'coalesce(v_lib, ''abonnement'')');
    d := replace(d, '''Paiement confirmé'',', '''Félicitations ! Abonnement activé'',');
    d := replace(d, '''Paiement rejeté'',', '''Abonnement rejeté'',');
    d := replace(d, 'prenez un Pass.', 'prenez un abonnement.');
    d := replace(d, 'Choisissez le Pass qui vous convient.', 'Choisissez l''''abonnement qui vous convient.');
    d := replace(d, 'Pass Mon Concours', 'Abonnement Mon Concours');
    execute d;
  end loop;
end $$;
