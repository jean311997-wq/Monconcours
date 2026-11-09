-- 1. D'où vient chaque inscrit : le lien, le code saisi, ou les deux.
alter table public.partenaire_filleuls add column if not exists source text check (source in ('lien', 'code', 'les_deux'));
alter table public.partenaire_filleuls add column if not exists visiteur text;

-- 2. Une relance WhatsApp faite par un partenaire est une relance comme les autres :
--    la personne est réservée 24 h, pour le partenaire comme pour l'administration.
alter table public.relances_whatsapp add column if not exists par_partenaire uuid references public.partenaires(id) on delete set null;

create or replace function public.rattacher_partenaire_source(p_code text, p_visiteur text default null, p_saisi boolean default false)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_moi uuid := auth.uid(); v_p record; v_pr record; v_lien boolean := false; v_src text;
begin
  if v_moi is null then return jsonb_build_object('ok', false); end if;
  select * into v_p from partenaires where code = upper(trim(coalesce(p_code, ''))) and actif;
  if not found then return jsonb_build_object('ok', false, 'message', 'Code inconnu.'); end if;
  select * into v_pr from profils where id = v_moi;
  if not found then return jsonb_build_object('ok', false); end if;
  if v_pr.cree_le < now() - interval '2 days' then return jsonb_build_object('ok', false, 'message', 'Le code se saisit à l''inscription.'); end if;
  if v_p.telephone is not null and regexp_replace(coalesce(v_pr.telephone, ''), '\D', '', 'g') = regexp_replace(v_p.telephone, '\D', '', 'g') then
    return jsonb_build_object('ok', false, 'message', 'Vous ne pouvez pas utiliser votre propre code.'); end if;
  if p_visiteur is not null and char_length(p_visiteur) between 8 and 80 then
    v_lien := exists (select 1 from partenaire_visites where partenaire_id = v_p.id and visiteur = p_visiteur);
  end if;
  v_src := case when coalesce(p_saisi, false) and v_lien then 'les_deux'
                when coalesce(p_saisi, false) then 'code'
                else 'lien' end;
  insert into partenaire_filleuls (user_id, partenaire_id, source, visiteur)
  values (v_moi, v_p.id, v_src, case when p_visiteur is not null and char_length(p_visiteur) between 8 and 80 then p_visiteur end)
  on conflict (user_id) do nothing;
  return jsonb_build_object('ok', true, 'source', v_src);
end $function$;
revoke all on function public.rattacher_partenaire_source(text, text, boolean) from public, anon;
grant execute on function public.rattacher_partenaire_source(text, text, boolean) to authenticated;

-- L'ancienne fonction (clients déjà ouverts) passe par la nouvelle.
create or replace function public.rattacher_partenaire(p_code text)
 returns jsonb
 language sql
 security definer
 set search_path to 'public'
as $$ select public.rattacher_partenaire_source(p_code, null, false) $$;
revoke all on function public.rattacher_partenaire(text) from public, anon;
grant execute on function public.rattacher_partenaire(text) to authenticated;

-- Le partenaire relance une personne : réservé 24 h pour lui seul, sinon on le dit et rien ne s'ouvre.
create or replace function public.partenaire_relancer(p_jeton text, p_ref text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_p record; v_user uuid; v_r record;
begin
  if p_jeton is null or char_length(p_jeton) < 12 or p_ref is null then return jsonb_build_object('ok', false); end if;
  select * into v_p from partenaires where (jeton_court = p_jeton or jeton = p_jeton) and actif;
  if not found then return jsonb_build_object('ok', false); end if;
  select pf.user_id into v_user from partenaire_filleuls pf
   where pf.partenaire_id = v_p.id and left(md5(pf.user_id::text || v_p.id::text), 12) = p_ref;
  if v_user is null then return jsonb_build_object('ok', false); end if;
  if exists (select 1 from public.partenaire_paiements(v_p.id) q where q.user_id = v_user) then
    return jsonb_build_object('ok', false); end if;
  insert into relances_whatsapp (user_id, par, par_partenaire) values (v_user, null, v_p.id) on conflict (user_id) do nothing;
  if found then return jsonb_build_object('ok', true, 'deja', false); end if;
  select * into v_r from relances_whatsapp where user_id = v_user for update;
  if v_r.envoye_le > now() - interval '24 hours' then
    return jsonb_build_object('ok', true, 'deja', true, 'le', v_r.envoye_le,
                              'par', case when v_r.par_partenaire = v_p.id then 'vous' else 'equipe' end);
  end if;
  update relances_whatsapp set envoye_le = now(), par = null, par_partenaire = v_p.id where user_id = v_user;
  return jsonb_build_object('ok', true, 'deja', false);
end $function$;
revoke all on function public.partenaire_relancer(text, text) from public;
grant execute on function public.partenaire_relancer(text, text) to anon, authenticated;

-- L'administration voit aussi les relances faites par les partenaires.
create or replace function public.admin_reserver_relance(p_user uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_moi uuid := auth.uid(); v_r record; v_nom text;
begin
  if not exists (select 1 from roles_utilisateur where user_id = v_moi and role in ('admin','investisseur')) then
    return jsonb_build_object('ok', false, 'message', 'Réservé à l''administration.');
  end if;
  insert into relances_whatsapp(user_id, par) values (p_user, v_moi) on conflict (user_id) do nothing;
  if found then return jsonb_build_object('ok', true, 'deja', false); end if;
  select * into v_r from relances_whatsapp where user_id = p_user for update;
  if v_r.envoye_le > now() - interval '24 hours' and v_r.par is distinct from v_moi then
    if v_r.par_partenaire is not null then
      select 'le partenaire ' || p.nom into v_nom from partenaires p where p.id = v_r.par_partenaire;
    else
      select coalesce((select s.nom from communaute_signatures s where s.user_id = v_r.par), (select p.nom from profils p where p.id = v_r.par), 'un autre administrateur') into v_nom;
    end if;
    return jsonb_build_object('ok', true, 'deja', true, 'par', coalesce(v_nom, 'un autre administrateur'), 'le', v_r.envoye_le);
  end if;
  update relances_whatsapp set envoye_le = now(), par = v_moi, par_partenaire = null where user_id = p_user;
  return jsonb_build_object('ok', true, 'deja', false);
end $function$;
revoke all on function public.admin_reserver_relance(uuid) from public, anon;
grant execute on function public.admin_reserver_relance(uuid) to authenticated;

-- Le calcul du partenaire : source de chaque inscrit, référence de relance, dernière relance.
create or replace function public.partenaire_donnees_base(p_id uuid, p_admin boolean)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare
  v_p record; v_fil jsonb; v_pay jsonb; v_ver jsonb; v_res jsonb;
  v_attente int; v_validee int; v_verse int; v_nbpay int;
begin
  select * into v_p from partenaires where id = p_id;
  if not found then return null; end if;

  with pm as (select * from public.partenaire_paiements(p_id)),
  agg as (
    select pm.user_id, count(*) as n, sum(pm.commission) as com,
           sum(pm.commission) filter (where pm.paye_le + make_interval(days => v_p.delai_jours) <= now()) as com_val,
           max(pm.paye_le) as dernier,
           (array_agg(pm.formule order by pm.paye_le desc))[1] as derniere_formule,
           (array_agg(pm.montant order by pm.paye_le desc))[1] as dernier_montant
      from pm group by pm.user_id
  ), f as (
    select pf.user_id, coalesce(pf.source, 'code') as source, pr.nom, pr.telephone, pr.cree_le as inscrit_le,
           coalesce(a.n, 0) as n, coalesce(a.com, 0) as com, coalesce(a.com_val, 0) as com_val,
           a.dernier, a.derniere_formule, a.dernier_montant, (a.n is not null) as paye,
           rw.envoye_le as relance_le,
           case when rw.par_partenaire = p_id then 'partenaire' when rw.envoye_le is not null then 'equipe' end as relance_par,
           exists (select 1 from paiements q where q.user_id = pf.user_id and q.statut = 'refuse') as refuse,
           exists (select 1 from paiements q where q.user_id = pf.user_id and q.statut not in ('confirme', 'refuse')) as en_verif,
           exists (select 1 from evenements e where e.user_id = pf.user_id
                    and e.nom in ('SUBSCRIPTION_PLAN_SELECTED', 'PAYMENT_STARTED', 'PAYMENT_DECLARED', 'PAYMENT_SENT', 'PAYMENT_PROOF_SENT')) as voulu,
           (select count(distinct (e.cree_le at time zone 'UTC')::date) from evenements e where e.user_id = pf.user_id) as jours_actifs,
           (select max(e.cree_le) from evenements e where e.user_id = pf.user_id) as derniere_vue
      from partenaire_filleuls pf
      join profils pr on pr.id = pf.user_id
      left join agg a on a.user_id = pf.user_id
      left join relances_whatsapp rw on rw.user_id = pf.user_id
     where pf.partenaire_id = p_id
  ), g as (
    select f.*,
           case when f.paye then 'paye'
                when f.en_verif then 'en_verification'
                when f.refuse then 'non_abouti'
                when f.voulu then 'a_voulu_payer'
                else 'inscrit' end as etat
      from f
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', case when p_admin then g.user_id end,
           'ref', left(md5(g.user_id::text || p_id::text), 12),
           'source', g.source,
           'nom', case when p_admin then g.nom else public.partenaire_nom_court(g.nom) end,
           'telephone', case when p_admin or not g.paye then g.telephone end,
           'inscrit_le', g.inscrit_le,
           'etat', g.etat,
           'nb_paiements', g.n,
           'formule', g.derniere_formule,
           'montant', g.dernier_montant,
           'paye_le', g.dernier,
           'commission', case when g.paye then g.com end,
           'commission_validee', case when g.paye then g.com_val end,
           'relance_le', g.relance_le,
           'relance_par', g.relance_par,
           'jours_actifs', g.jours_actifs,
           'derniere_vue', g.derniere_vue
         ) order by g.inscrit_le desc), '[]'::jsonb),
         jsonb_build_object(
           'inscrits', count(*),
           'actifs3', count(*) filter (where g.jours_actifs >= 3),
           'a_voulu_payer', count(*) filter (where g.etat in ('a_voulu_payer', 'en_verification', 'non_abouti')),
           'payes', count(*) filter (where g.paye),
           'inscrits_seuls', count(*) filter (where g.etat = 'inscrit'),
           'via_lien', count(*) filter (where g.source = 'lien'),
           'via_code', count(*) filter (where g.source = 'code'),
           'via_les_deux', count(*) filter (where g.source = 'les_deux'),
           'payes_lien', count(*) filter (where g.source = 'lien' and g.paye),
           'payes_code', count(*) filter (where g.source = 'code' and g.paye),
           'payes_les_deux', count(*) filter (where g.source = 'les_deux' and g.paye))
    into v_fil, v_res
    from g;

  select coalesce(sum(q.commission) filter (where q.paye_le + make_interval(days => v_p.delai_jours) > now()), 0),
         coalesce(sum(q.commission) filter (where q.paye_le + make_interval(days => v_p.delai_jours) <= now()), 0),
         count(*)
    into v_attente, v_validee, v_nbpay
    from public.partenaire_paiements(p_id) q;

  select coalesce(jsonb_agg(x.j order by x.d desc), '[]'::jsonb) into v_pay from (
    select q.paye_le as d, jsonb_build_object(
             'nom', case when p_admin then pr.nom else public.partenaire_nom_court(pr.nom) end,
             'formule', q.formule, 'montant', q.montant, 'paye_le', q.paye_le, 'commission', q.commission,
             'commission_etat', case when q.commission = 0 then null
                                     when q.paye_le + make_interval(days => v_p.delai_jours) <= now() then 'validee'
                                     else 'attente' end) as j
      from public.partenaire_paiements(p_id) q join profils pr on pr.id = q.user_id
     order by q.paye_le desc limit 100) x;

  select coalesce(jsonb_agg(jsonb_build_object('id', v.id, 'montant', v.montant, 'verse_le', v.verse_le, 'note', v.note)
                            order by v.verse_le desc), '[]'::jsonb),
         coalesce(sum(v.montant), 0)
    into v_ver, v_verse
    from partenaire_versements v where v.partenaire_id = p_id;

  return jsonb_build_object(
    'id', v_p.id, 'nom', v_p.nom, 'code', v_p.code, 'telephone', v_p.telephone, 'actif', v_p.actif, 'note', v_p.note,
    'commission_mois', v_p.commission_mois, 'commission_an', v_p.commission_an, 'delai_jours', v_p.delai_jours,
    'cree_le', v_p.cree_le,
    'resume', v_res || jsonb_build_object(
      'nb_paiements', v_nbpay,
      'renouvellements', greatest(v_nbpay - (v_res->>'payes')::int, 0),
      'commission_attente', v_attente, 'commission_validee', v_validee, 'verse', v_verse,
      'solde', greatest(v_validee - v_verse, 0)),
    'filleuls', v_fil, 'paiements', v_pay, 'versements', v_ver);
end $function$;
revoke all on function public.partenaire_donnees_base(uuid, boolean) from public, anon, authenticated;
