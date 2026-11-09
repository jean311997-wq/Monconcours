-- Partenaires : la commission court à CHAQUE paiement réel du filleul (renouvellements compris),
-- validée 3 jours après chaque paiement. Lien court d'accès, paliers de bonus, statistiques par semaine, classement.

alter table public.partenaires add column if not exists jeton_court text;
update public.partenaires set jeton_court = substr(replace(gen_random_uuid()::text, '-', ''), 1, 12) where jeton_court is null;
alter table public.partenaires alter column jeton_court set not null;
alter table public.partenaires alter column jeton_court set default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
create unique index if not exists partenaires_jeton_court_uq on public.partenaires (jeton_court);
alter table public.partenaires alter column delai_jours set default 3;
update public.partenaires set delai_jours = 3;

create table if not exists public.partenaire_paliers (
  seuil integer primary key check (seuil > 0),
  bonus integer not null check (bonus >= 0),
  titre text not null
);
alter table public.partenaire_paliers enable row level security;
revoke all on public.partenaire_paliers from anon, authenticated;
insert into public.partenaire_paliers (seuil, bonus, titre) values
  (10, 2000, 'Partenaire confirmé'),
  (25, 5000, 'Partenaire expert'),
  (50, 10000, 'Ambassadeur d''or')
on conflict (seuil) do nothing;

create or replace function public.partenaire_nom_court(p_nom text)
 returns text language sql immutable set search_path to 'public'
as $$
  select initcap(split_part(trim(coalesce(p_nom, '')), ' ', 1))
         || coalesce(' ' || upper(left(nullif(split_part(trim(coalesce(p_nom, '')), ' ', 2), ''), 1)) || '.', '')
$$;
revoke all on function public.partenaire_nom_court(text) from public, anon, authenticated;

-- Tous les paiements réels confirmés des filleuls d'un partenaire, avec la commission de chacun.
create or replace function public.partenaire_paiements(p_id uuid)
 returns table (user_id uuid, paye_le timestamptz, formule text, montant integer, commission integer)
 language sql stable security definer set search_path to 'public'
as $$
  select pf.user_id, coalesce(p.regle_le, p.cree_le), p.formule, p.montant_fcfa,
         case when p.formule = 'mensuelle' then pa.commission_mois
              when p.formule = 'annuelle' then pa.commission_an else 0 end
    from partenaires pa
    join partenaire_filleuls pf on pf.partenaire_id = pa.id
    join paiements p on p.user_id = pf.user_id and p.statut = 'confirme' and p.montant_fcfa > 0
   where pa.id = p_id
$$;
revoke all on function public.partenaire_paiements(uuid) from public, anon, authenticated;

create or replace function public.partenaire_nb_payeurs(p_id uuid)
 returns integer language sql stable security definer set search_path to 'public'
as $$ select count(distinct q.user_id)::int from public.partenaire_paiements(p_id) q $$;
revoke all on function public.partenaire_nb_payeurs(uuid) from public, anon, authenticated;

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
    select pf.user_id, pr.nom, pr.telephone, pr.cree_le as inscrit_le,
           coalesce(a.n, 0) as n, coalesce(a.com, 0) as com, coalesce(a.com_val, 0) as com_val,
           a.dernier, a.derniere_formule, a.dernier_montant, (a.n is not null) as paye,
           exists (select 1 from paiements q where q.user_id = pf.user_id and q.statut = 'refuse') as refuse,
           exists (select 1 from paiements q where q.user_id = pf.user_id and q.statut not in ('confirme', 'refuse')) as en_verif,
           exists (select 1 from evenements e where e.user_id = pf.user_id
                    and e.nom in ('SUBSCRIPTION_PLAN_SELECTED', 'PAYMENT_STARTED', 'PAYMENT_DECLARED', 'PAYMENT_SENT', 'PAYMENT_PROOF_SENT')) as voulu,
           (select count(distinct (e.cree_le at time zone 'UTC')::date) from evenements e where e.user_id = pf.user_id) as jours_actifs,
           (select max(e.cree_le) from evenements e where e.user_id = pf.user_id) as derniere_vue
      from partenaire_filleuls pf
      join profils pr on pr.id = pf.user_id
      left join agg a on a.user_id = pf.user_id
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
           'jours_actifs', g.jours_actifs,
           'derniere_vue', g.derniere_vue
         ) order by g.inscrit_le desc), '[]'::jsonb),
         jsonb_build_object(
           'inscrits', count(*),
           'actifs3', count(*) filter (where g.jours_actifs >= 3),
           'a_voulu_payer', count(*) filter (where g.etat in ('a_voulu_payer', 'en_verification', 'non_abouti')),
           'payes', count(*) filter (where g.paye),
           'inscrits_seuls', count(*) filter (where g.etat = 'inscrit'))
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

-- Le résumé complet : visiteurs, paliers (bonus), semaines, classement.
create or replace function public.partenaire_donnees(p_id uuid, p_admin boolean)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare
  b jsonb; v_vis int; v_bonus int := 0; v_payes int; v_pal jsonb; v_sem jsonb;
  v_rang int; v_sur int; v_res jsonb; v_valide int; v_verse int;
begin
  b := public.partenaire_donnees_base(p_id, p_admin);
  if b is null then return null; end if;
  select count(*) into v_vis from partenaire_visites where partenaire_id = p_id;
  v_payes := (b->'resume'->>'payes')::int;

  select coalesce(sum(bonus) filter (where seuil <= v_payes), 0)::int,
         coalesce(jsonb_agg(jsonb_build_object('seuil', seuil, 'bonus', bonus, 'titre', titre, 'atteint', seuil <= v_payes) order by seuil), '[]'::jsonb)
    into v_bonus, v_pal from partenaire_paliers;

  v_valide := (b->'resume'->>'commission_validee')::int + v_bonus;
  v_verse := (b->'resume'->>'verse')::int;
  v_res := (b->'resume') || jsonb_build_object(
    'visiteurs', v_vis, 'bonus', v_bonus,
    'commission_validee', v_valide, 'solde', greatest(v_valide - v_verse, 0));

  select coalesce(jsonb_agg(jsonb_build_object(
           'debut', s.d::date,
           'visiteurs', (select count(*) from partenaire_visites v where v.partenaire_id = p_id and v.premiere_le >= s.d and v.premiere_le < s.d + interval '7 days'),
           'inscrits', (select count(*) from partenaire_filleuls f where f.partenaire_id = p_id and f.cree_le >= s.d and f.cree_le < s.d + interval '7 days'),
           'paiements', (select count(*) from public.partenaire_paiements(p_id) q where q.paye_le >= s.d and q.paye_le < s.d + interval '7 days')
         ) order by s.d), '[]'::jsonb)
    into v_sem
    from generate_series(date_trunc('week', now()) - interval '7 weeks', date_trunc('week', now()), interval '1 week') as s(d);

  select count(*) into v_sur from partenaires where actif;
  select 1 + count(*) into v_rang from partenaires o
   where o.actif and o.id <> p_id and public.partenaire_nb_payeurs(o.id) > v_payes;

  return b || jsonb_build_object('resume', v_res, 'paliers', v_pal, 'semaines', v_sem,
                                 'classement', jsonb_build_object('rang', v_rang, 'sur', v_sur));
end $function$;
revoke all on function public.partenaire_donnees(uuid, boolean) from public, anon, authenticated;

-- Accès : le lien court (12 caractères) ou l'ancien lien long, tous deux valables.
create or replace function public.partenaire_tableau(p_jeton text)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare v_id uuid; v_actif boolean;
begin
  if p_jeton is null or char_length(p_jeton) < 12 then return jsonb_build_object('ok', false, 'message', 'Lien non valide.'); end if;
  select id, actif into v_id, v_actif from partenaires where jeton_court = p_jeton or jeton = p_jeton;
  if v_id is null then return jsonb_build_object('ok', false, 'message', 'Lien non valide.'); end if;
  if not v_actif then return jsonb_build_object('ok', false, 'message', 'Cet accès est fermé. Contactez l''équipe Mon Concours.'); end if;
  return jsonb_build_object('ok', true) || public.partenaire_donnees(v_id, false);
end $function$;
revoke all on function public.partenaire_tableau(text) from public;
grant execute on function public.partenaire_tableau(text) to anon, authenticated;

create or replace function public.admin_partenaire_detail(p_id uuid)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
begin
  if not exists (select 1 from roles_utilisateur where user_id = auth.uid() and role in ('admin', 'investisseur')) then
    return jsonb_build_object('ok', false, 'message', 'Réservé à l''administration.'); end if;
  return jsonb_build_object('ok', true, 'jeton', (select jeton from partenaires where id = p_id),
                            'jeton_court', (select jeton_court from partenaires where id = p_id))
         || coalesce(public.partenaire_donnees(p_id, true), '{}'::jsonb);
end $function$;
revoke all on function public.admin_partenaire_detail(uuid) from public, anon;
grant execute on function public.admin_partenaire_detail(uuid) to authenticated;

create or replace function public.admin_partenaire_creer(p_nom text, p_code text, p_telephone text, p_mois integer, p_an integer)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')); v_nom text := trim(coalesce(p_nom, '')); v_id uuid; v_jeton text; v_court text;
begin
  if not securite.est_admin() then return jsonb_build_object('ok', false, 'message', 'Réservé à l''administration.'); end if;
  if char_length(v_nom) < 3 then return jsonb_build_object('ok', false, 'message', 'Écrivez le nom du partenaire.'); end if;
  if v_code !~ '^[A-Z0-9]{3,14}$' then return jsonb_build_object('ok', false, 'message', 'Le code : de 3 à 14 lettres ou chiffres.'); end if;
  if exists (select 1 from partenaires where code = v_code) then return jsonb_build_object('ok', false, 'message', 'Ce code existe déjà. Choisissez-en un autre.'); end if;
  insert into partenaires (nom, code, telephone, commission_mois, commission_an)
  values (v_nom, v_code, nullif(trim(coalesce(p_telephone, '')), ''), coalesce(p_mois, 200), coalesce(p_an, 1000))
  returning id, jeton, jeton_court into v_id, v_jeton, v_court;
  insert into journal_activite (acteur, action, table_cible) values (auth.uid(), 'partenaire_cree', 'partenaires');
  return jsonb_build_object('ok', true, 'id', v_id, 'jeton', v_jeton, 'jeton_court', v_court, 'code', v_code);
end $function$;
revoke all on function public.admin_partenaire_creer(text, text, text, integer, integer) from public, anon;
grant execute on function public.admin_partenaire_creer(text, text, text, integer, integer) to authenticated;

create or replace function public.admin_partenaire_maj(p_id uuid, p_actif boolean, p_mois integer, p_an integer, p_note text, p_nouveau_lien boolean)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not securite.est_admin() then return jsonb_build_object('ok', false, 'message', 'Réservé à l''administration.'); end if;
  update partenaires set
    actif = coalesce(p_actif, actif),
    commission_mois = coalesce(p_mois, commission_mois),
    commission_an = coalesce(p_an, commission_an),
    note = case when p_note is null then note else nullif(trim(p_note), '') end,
    jeton = case when coalesce(p_nouveau_lien, false) then replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') else jeton end,
    jeton_court = case when coalesce(p_nouveau_lien, false) then substr(replace(gen_random_uuid()::text, '-', ''), 1, 12) else jeton_court end
   where id = p_id;
  insert into journal_activite (acteur, action, table_cible) values (auth.uid(), 'partenaire_modifie', 'partenaires');
  return jsonb_build_object('ok', true);
end $function$;
revoke all on function public.admin_partenaire_maj(uuid, boolean, integer, integer, text, boolean) from public, anon;
grant execute on function public.admin_partenaire_maj(uuid, boolean, integer, integer, text, boolean) to authenticated;
