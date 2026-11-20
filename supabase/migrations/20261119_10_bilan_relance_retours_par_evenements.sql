create or replace function public.admin_bilan_relance()
 returns jsonb language plpgsql security definer set search_path to 'public'
as $f$
declare v jsonb;
begin
  if not exists (select 1 from roles_utilisateur where user_id = auth.uid() and role::text in ('admin','investisseur')) then
    return jsonb_build_object('ok', false, 'message', 'Réservé à l''administration.');
  end if;
  with x as (
    select s.volet, s.user_id, s.depuis,
      exists(select 1 from relances_whatsapp r where r.user_id = s.user_id and r.envoye_le >= s.depuis) relance,
      exists(select 1 from abonnements a where a.user_id = s.user_id and a.formule <> 'essai' and a.cree_le >= s.depuis) abonne,
      exists(select 1 from paiements p where p.user_id = s.user_id and p.cree_le >= s.depuis and p.statut::text = 'en_attente') attente,
      exists(select 1 from evenements e where e.user_id = s.user_id and e.cree_le >= s.depuis + 1) revenu
    from relance_suivi s
  )
  select coalesce(jsonb_agg(jsonb_build_object('volet', volet, 'depuis', depuis, 'total', total, 'relances', rel, 'abonnes', ab,
      'abonnes_relances', ab_rel, 'en_attente', att, 'revenus', rev, 'revenus_relances', rev_rel, 'disparus', total - rev) order by volet, depuis), '[]'::jsonb) into v
  from (select volet, depuis, count(*) total, count(*) filter (where relance) rel, count(*) filter (where abonne) ab,
          count(*) filter (where abonne and relance) ab_rel, count(*) filter (where attente) att,
          count(*) filter (where revenu) rev, count(*) filter (where revenu and relance) rev_rel
        from x group by volet, depuis) s;
  return jsonb_build_object('ok', true, 'bilan', v, 'le', now());
end $f$;
