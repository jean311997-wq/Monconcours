-- Les abonnements offerts (montant 0) ne comptent plus comme des achats dans le suivi des promotions.
do $do$
declare d text;
begin
  d := pg_get_functiondef('public.admin_promotions()'::regprocedure);
  d := replace(d, 'p.statut = ''confirme'' and p.cree_le >= x.lance_le', 'p.statut = ''confirme'' and p.montant_fcfa > 0 and p.cree_le >= x.lance_le');
  execute d;
end $do$;
