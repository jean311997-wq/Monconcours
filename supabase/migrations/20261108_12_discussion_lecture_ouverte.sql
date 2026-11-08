-- La discussion d'une composition terminée se lit sans être inscrit. Écrire reste réservé aux inscrits.
do $do$
declare d text;
begin
  d := pg_get_functiondef('public.discussion_charger(uuid)'::regprocedure);
  d := replace(d, 'if v_user is null or not securite.discussion_acces(p_epreuve, v_user) then',
    'if v_user is null or not exists (select 1 from public.epreuves_collectives e where e.id = p_epreuve and e.statut = ''programmee'' and now() >= e.fin_le) then');
  d := replace(d, '''equipe'', securite.comm_est_adm(v_user));',
    '''equipe'', securite.comm_est_adm(v_user), ''peut_ecrire'', securite.discussion_acces(p_epreuve, v_user));');
  d := replace(d, 'La discussion est réservée aux candidats inscrits, après la fin de la composition.', 'Discussion ouverte à la fin de la composition.');
  execute d;
end $do$;
