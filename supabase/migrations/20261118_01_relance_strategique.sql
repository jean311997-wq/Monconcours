-- 18 novembre 2026 — Relance stratégique, abandons de paiement, notification de limite, bilan de relance.
-- Tout se calcule à l'ouverture de la page d'administration : aucune écriture au passage des candidats,
-- sauf une seule notification par personne et par jour (signaler_limite).

/* ---------- 1. Les deux listes, calculées en direct (interne) ---------- */
create or replace function public._relance_listes()
 returns table(volet text, user_id uuid, nom text, telephone text, concours text, derniere date, n1 int, n2 int, envoye_le timestamptz)
 language sql stable security definer set search_path to 'public'
as $f$
  with equipe as (select ru.user_id from roles_utilisateur ru where ru.role::text in ('admin','correcteur','investisseur')),
  abo as (select distinct a.user_id from abonnements a where a.fin_le > now() and a.annule_le is null and a.formule <> 'essai'),
  av as (select a.user_id, count(*)::int n from avis a where a.user_id is not null group by 1),
  act as (select u.user_id, max(u.jour) der, count(distinct u.jour)::int jours
            from usage_jour u where u.jour >= current_date - 30 and u.user_id in (select user_id from av) group by 1),
  mur as (select t.user_id, (t.cree_le at time zone 'UTC')::date d
            from tentatives_question t
           where t.contexte in ('revision','erreurs') and t.cree_le >= now() - interval '7 days'
           group by 1, 2 having count(*) >= 5),
  lim as (select m.user_id, count(*)::int jours, max(m.d) der from mur m group by 1 having count(*) >= 3),
  tout as (
    select 'avis'::text v, av.user_id, act.der, av.n n1, act.jours n2
      from av join act using (user_id) where act.der >= current_date - 6 and act.jours >= 2
    union all
    select 'limite'::text, lim.user_id, lim.der, lim.jours, null::int from lim
  )
  select t.v, p.id, p.nom, p.telephone, (select c.nom from concours c where c.id = p.concours_id), t.der, t.n1, t.n2, r.envoye_le
    from tout t
    join profils p on p.id = t.user_id
    left join relances_whatsapp r on r.user_id = p.id
   where p.telephone is not null
     and t.user_id not in (select user_id from equipe)
     and t.user_id not in (select user_id from abo)
$f$;
revoke all on function public._relance_listes() from public, anon, authenticated;

create or replace function public.admin_relance_strategique()
 returns jsonb language plpgsql security definer set search_path to 'public'
as $f$
declare v_avis jsonb; v_lim jsonb;
begin
  if not exists (select 1 from roles_utilisateur where user_id = auth.uid() and role::text in ('admin','investisseur')) then
    return jsonb_build_object('ok', false, 'message', 'Réservé à l''administration.');
  end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.derniere desc, x.nom), '[]'::jsonb) into v_avis
    from (select user_id, nom, telephone, concours, derniere, n1 as nb_avis, n2 as jours_actifs, envoye_le from public._relance_listes() where volet = 'avis' limit 300) x;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.derniere desc, x.nom), '[]'::jsonb) into v_lim
    from (select user_id, nom, telephone, concours, derniere, n1 as jours_limite, envoye_le from public._relance_listes() where volet = 'limite' limit 300) x;
  return jsonb_build_object('ok', true, 'avis', v_avis, 'limite', v_lim);
end $f$;
revoke all on function public.admin_relance_strategique() from public, anon;
grant execute on function public.admin_relance_strategique() to authenticated;

/* ---------- 2. Abandons de paiement : où chacun s'est arrêté, et pourquoi (déduit des étapes) ---------- */
create or replace function public.admin_abandons_paiement(p_jours int default 45)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $f$
declare v_liste jsonb; v_resume jsonb; v_j int := least(greatest(coalesce(p_jours, 45), 1), 120);
begin
  if not exists (select 1 from roles_utilisateur where user_id = auth.uid() and role::text in ('admin','investisseur')) then
    return jsonb_build_object('ok', false, 'message', 'Réservé à l''administration.');
  end if;
  with equipe as (select ru.user_id from roles_utilisateur ru where ru.role::text in ('admin','correcteur','investisseur')),
  ev as (
    select e.user_id,
      bool_or(e.nom = 'PAYWALL_CLICKED') clic,
      bool_or(e.nom = 'SUBSCRIPTION_PLAN_SELECTED') plan,
      bool_or(e.nom = 'PAYMENT_STARTED') demarre,
      bool_or(e.nom = 'PAYMENT_DECLARED') declare,
      bool_or(e.nom in ('PAYMENT_PROOF_SENT','PAYMENT_SENT')) preuve,
      bool_or(e.nom = 'PROXY_PAY_SHARED') proche,
      bool_or(e.nom = 'PAY_ADVISOR_WHATSAPP') conseiller,
      bool_or(e.nom = 'PAYMENT_ABANDONED') annule,
      count(*) filter (where e.nom = 'PAYMENT_ERREUR') n_err,
      (array_agg(e.meta->>'message' order by e.cree_le desc) filter (where e.nom = 'PAYMENT_ERREUR'))[1] err_msg,
      (array_agg(e.meta->>'formule' order by e.cree_le desc) filter (where e.meta ? 'formule'))[1] formule,
      max(e.cree_le) derniere
    from evenements e
    where e.cree_le >= now() - make_interval(days => v_j)
      and e.user_id is not null
      and e.nom in ('PAYWALL_CLICKED','SUBSCRIPTION_PLAN_SELECTED','PAYMENT_STARTED','PAYMENT_DECLARED','PAYMENT_PROOF_SENT','PAYMENT_SENT',
                    'PROXY_PAY_SHARED','PAY_ADVISOR_WHATSAPP','PAYMENT_ABANDONED','PAYMENT_ERREUR')
    group by e.user_id
  ),
  ab as (
  select ev.*, p.nom, p.telephone, (select c.nom from concours c where c.id = p.concours_id) concours,
    (select max(u.jour) from usage_jour u where u.user_id = ev.user_id and u.jour >= current_date - 14) der_activite,
    r.envoye_le,
    exists(select 1 from paiements x where x.user_id = ev.user_id and x.statut::text = 'refuse') refuse,
    case
      when ev.n_err > 0 and not ev.preuve then 'erreur'
      when ev.annule then 'annule'
      when ev.declare and not ev.preuve then 'sans_capture'
      when ev.proche then 'proche'
      when ev.conseiller then 'conseiller'
      when ev.demarre then 'ecran_paiement'
      else 'avant_paiement'
    end cause
  from ev
  join profils p on p.id = ev.user_id
  left join relances_whatsapp r on r.user_id = ev.user_id
  where ev.user_id not in (select user_id from equipe)
    and (ev.clic or ev.plan or ev.demarre)
    and not exists (select 1 from abonnements a where a.user_id = ev.user_id and a.fin_le > now() and a.annule_le is null and a.formule <> 'essai')
    and not exists (select 1 from paiements x where x.user_id = ev.user_id and x.statut::text = 'en_attente')
  ),
  r1 as (select cause, count(*) n, count(*) filter (where der_activite >= current_date - 6) a7 from ab group by 1),
  l1 as (select user_id, nom, telephone, concours, formule, derniere, der_activite, envoye_le, cause, n_err, err_msg, refuse from ab where telephone is not null order by derniere desc limit 300)
  select (select coalesce(jsonb_agg(jsonb_build_object('cause', cause, 'n', n, 'actifs_7j', a7) order by n desc), '[]'::jsonb) from r1),
         (select coalesce(jsonb_agg(to_jsonb(l1) order by l1.derniere desc), '[]'::jsonb) from l1)
    into v_resume, v_liste;
  return jsonb_build_object('ok', true, 'resume', v_resume, 'liste', v_liste, 'jours', v_j);
end $f$;
revoke all on function public.admin_abandons_paiement(int) from public, anon;
grant execute on function public.admin_abandons_paiement(int) to authenticated;

/* ---------- 3. Notification quand la limite du jour est atteinte : une seule par personne et par jour ---------- */
create or replace function public.signaler_limite()
 returns void language plpgsql security definer set search_path to 'public', 'securite'
as $f$
declare v uuid := auth.uid();
begin
  if v is null then return; end if;
  if securite.est_abonne(v) or securite.est_equipe() then return; end if;
  perform public.notifier(v, 'abonnement', 'Tes corrections du jour sont faites',
    'Elles reviennent demain. Pour continuer tout de suite : Semaine 500 F, Mois 1 000 F ou Année 4 000 F, par Orange Money, Moov Money ou Wave.',
    'limite-' || current_date::text, 'abonnement', false);
end $f$;
revoke all on function public.signaler_limite() from public, anon;
grant execute on function public.signaler_limite() to authenticated;

/* ---------- 4. Suivi des listes et bilan ---------- */
create table if not exists public.relance_suivi(
  user_id uuid not null, volet text not null, depuis date not null default current_date,
  primary key (user_id, volet));
alter table public.relance_suivi enable row level security;
revoke all on public.relance_suivi from anon, authenticated;

create or replace function public.maj_relance_suivi()
 returns void language plpgsql security definer set search_path to 'public'
as $f$
begin
  insert into public.relance_suivi(user_id, volet) select user_id, volet from public._relance_listes() on conflict do nothing;
end $f$;
revoke all on function public.maj_relance_suivi() from public, anon, authenticated;

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
      (select count(distinct u.jour) from usage_jour u where u.user_id = s.user_id and u.jour > s.depuis)::int jours_apres
    from relance_suivi s
  )
  select coalesce(jsonb_agg(jsonb_build_object('volet', volet, 'depuis', depuis, 'total', total, 'relances', rel, 'abonnes', ab,
      'abonnes_relances', ab_rel, 'en_attente', att, 'revenus', rev, 'revenus_relances', rev_rel, 'disparus', total - rev) order by volet, depuis), '[]'::jsonb) into v
  from (select volet, depuis, count(*) total, count(*) filter (where relance) rel, count(*) filter (where abonne) ab,
          count(*) filter (where abonne and relance) ab_rel, count(*) filter (where attente) att,
          count(*) filter (where jours_apres > 0) rev, count(*) filter (where jours_apres > 0 and relance) rev_rel
        from x group by volet, depuis) s;
  return jsonb_build_object('ok', true, 'bilan', v, 'le', now());
end $f$;
revoke all on function public.admin_bilan_relance() from public, anon;
grant execute on function public.admin_bilan_relance() to authenticated;

/* ---------- 5. Le suivi se remplit seul chaque soir (très léger) ---------- */
select public.maj_relance_suivi();
select cron.schedule('relance-suivi', '0 21 * * *', 'select public.maj_relance_suivi()');
