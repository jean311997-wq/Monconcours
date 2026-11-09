-- Partenaires (ambassadeurs) : un code, un lien secret vers leur tableau de bord, des commissions
-- calculées sur les vrais paiements de leurs filleuls, et un registre des versements.
-- Rien n'est payé d'avance : une commission n'existe que lorsqu'un filleul a payé de l'argent réel.

create table if not exists public.partenaires (
  id uuid primary key default gen_random_uuid(),
  nom text not null check (char_length(nom) between 3 and 80),
  code text not null unique check (code ~ '^[A-Z0-9]{3,14}$'),
  jeton text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  telephone text,
  commission_mois integer not null default 200 check (commission_mois >= 0),
  commission_an integer not null default 1000 check (commission_an >= 0),
  delai_jours integer not null default 7 check (delai_jours between 0 and 60),
  actif boolean not null default true,
  note text,
  cree_le timestamptz not null default now()
);

create table if not exists public.partenaire_filleuls (
  user_id uuid primary key references auth.users(id) on delete cascade,
  partenaire_id uuid not null references public.partenaires(id) on delete cascade,
  cree_le timestamptz not null default now()
);
create index if not exists partenaire_filleuls_p on public.partenaire_filleuls (partenaire_id);

create table if not exists public.partenaire_versements (
  id uuid primary key default gen_random_uuid(),
  partenaire_id uuid not null references public.partenaires(id) on delete cascade,
  montant integer not null check (montant > 0),
  verse_le timestamptz not null default now(),
  note text,
  par uuid
);
create index if not exists partenaire_versements_p on public.partenaire_versements (partenaire_id);

alter table public.partenaires enable row level security;
alter table public.partenaire_filleuls enable row level security;
alter table public.partenaire_versements enable row level security;
revoke all on public.partenaires, public.partenaire_filleuls, public.partenaire_versements from anon, authenticated;

-- Le calcul : un seul endroit pour le tableau du partenaire et pour l'administration.
-- La commission porte sur le PREMIER paiement confirmé d'argent réel (montant > 0) de chaque filleul.
-- Elle devient « validée » après le délai (7 jours par défaut), puis elle se solde par des versements.
create or replace function public.partenaire_donnees(p_id uuid, p_admin boolean)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare
  v_p record; v_fil jsonb; v_ver jsonb; v_res jsonb;
  v_attente int; v_validee int; v_verse int;
begin
  select * into v_p from partenaires where id = p_id;
  if not found then return null; end if;

  with f as (
    select pf.user_id, pf.cree_le as rattache_le, pr.nom, pr.telephone, pr.cree_le as inscrit_le,
           pay.formule as pay_formule, pay.montant_fcfa as pay_montant,
           coalesce(pay.regle_le, pay.cree_le) as paye_le,
           (pay.id is not null) as paye,
           exists (select 1 from paiements q where q.user_id = pf.user_id and q.statut = 'refuse') as refuse,
           exists (select 1 from paiements q where q.user_id = pf.user_id and q.statut not in ('confirme', 'refuse')) as en_verif,
           exists (select 1 from evenements e where e.user_id = pf.user_id
                    and e.nom in ('SUBSCRIPTION_PLAN_SELECTED', 'PAYMENT_STARTED', 'PAYMENT_DECLARED', 'PAYMENT_SENT', 'PAYMENT_PROOF_SENT')) as voulu,
           (select count(distinct (e.cree_le at time zone 'UTC')::date) from evenements e where e.user_id = pf.user_id) as jours_actifs,
           (select max(e.cree_le) from evenements e where e.user_id = pf.user_id) as derniere_vue
      from partenaire_filleuls pf
      join profils pr on pr.id = pf.user_id
      left join lateral (
        select p.* from paiements p
         where p.user_id = pf.user_id and p.statut = 'confirme' and p.montant_fcfa > 0
         order by coalesce(p.regle_le, p.cree_le) limit 1
      ) pay on true
     where pf.partenaire_id = p_id
  ), g as (
    select f.*,
           case when f.pay_formule = 'mensuelle' then v_p.commission_mois
                when f.pay_formule = 'annuelle' then v_p.commission_an else 0 end as commission,
           case when f.paye then 'paye'
                when f.en_verif then 'en_verification'
                when f.refuse then 'non_abouti'
                when f.voulu then 'a_voulu_payer'
                else 'inscrit' end as etat
      from f
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', case when p_admin then g.user_id end,
           'nom', case when p_admin then g.nom
                       else initcap(split_part(trim(g.nom), ' ', 1)) ||
                            coalesce(' ' || upper(left(nullif(split_part(trim(g.nom), ' ', 2), ''), 1)) || '.', '') end,
           'telephone', case when p_admin or not g.paye then g.telephone end,
           'inscrit_le', g.inscrit_le,
           'etat', g.etat,
           'formule', g.pay_formule,
           'montant', g.pay_montant,
           'paye_le', g.paye_le,
           'commission', case when g.paye then g.commission end,
           'commission_etat', case when not g.paye or g.commission = 0 then null
                                   when g.paye_le + make_interval(days => v_p.delai_jours) <= now() then 'validee'
                                   else 'attente' end,
           'valide_le', case when g.paye then g.paye_le + make_interval(days => v_p.delai_jours) end,
           'jours_actifs', g.jours_actifs,
           'derniere_vue', g.derniere_vue
         ) order by g.inscrit_le desc), '[]'::jsonb),
         coalesce(sum(g.commission) filter (where g.paye and g.paye_le + make_interval(days => v_p.delai_jours) > now()), 0),
         coalesce(sum(g.commission) filter (where g.paye and g.paye_le + make_interval(days => v_p.delai_jours) <= now()), 0),
         jsonb_build_object(
           'inscrits', count(*),
           'actifs3', count(*) filter (where g.jours_actifs >= 3),
           'a_voulu_payer', count(*) filter (where g.etat in ('a_voulu_payer', 'en_verification', 'non_abouti')),
           'payes', count(*) filter (where g.paye),
           'inscrits_seuls', count(*) filter (where g.etat = 'inscrit'))
    into v_fil, v_attente, v_validee, v_res
    from g;

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
      'commission_attente', v_attente, 'commission_validee', v_validee, 'verse', v_verse,
      'solde', greatest(v_validee - v_verse, 0)),
    'filleuls', v_fil, 'versements', v_ver);
end $function$;
revoke all on function public.partenaire_donnees(uuid, boolean) from public, anon, authenticated;

-- Page privée du partenaire : le jeton secret du lien fait office d'accès.
create or replace function public.partenaire_tableau(p_jeton text)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare v_id uuid; v_actif boolean;
begin
  if p_jeton is null or char_length(p_jeton) < 32 then return jsonb_build_object('ok', false, 'message', 'Lien non valide.'); end if;
  select id, actif into v_id, v_actif from partenaires where jeton = p_jeton;
  if v_id is null then return jsonb_build_object('ok', false, 'message', 'Lien non valide.'); end if;
  if not v_actif then return jsonb_build_object('ok', false, 'message', 'Cet accès est fermé. Contactez l''équipe Mon Concours.'); end if;
  return jsonb_build_object('ok', true) || public.partenaire_donnees(v_id, false);
end $function$;
revoke all on function public.partenaire_tableau(text) from public;
grant execute on function public.partenaire_tableau(text) to anon, authenticated;

-- Le code existe-t-il ? (pour confirmer au candidat que son code est reconnu)
create or replace function public.partenaire_code_valide(p_code text)
 returns jsonb
 language sql
 stable
 security definer
 set search_path to 'public'
as $$
  select jsonb_build_object('ok', exists (select 1 from partenaires where code = upper(trim(coalesce(p_code, ''))) and actif));
$$;
revoke all on function public.partenaire_code_valide(text) from public;
grant execute on function public.partenaire_code_valide(text) to anon, authenticated;

-- Rattachement : une seule fois, pour un compte tout neuf, jamais à son propre parrain.
create or replace function public.rattacher_partenaire(p_code text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_moi uuid := auth.uid(); v_p record; v_pr record;
begin
  if v_moi is null then return jsonb_build_object('ok', false); end if;
  select * into v_p from partenaires where code = upper(trim(coalesce(p_code, ''))) and actif;
  if not found then return jsonb_build_object('ok', false, 'message', 'Code inconnu.'); end if;
  select * into v_pr from profils where id = v_moi;
  if not found then return jsonb_build_object('ok', false); end if;
  if v_pr.cree_le < now() - interval '2 days' then return jsonb_build_object('ok', false, 'message', 'Le code se saisit à l''inscription.'); end if;
  if v_p.telephone is not null and regexp_replace(coalesce(v_pr.telephone, ''), '\D', '', 'g') = regexp_replace(v_p.telephone, '\D', '', 'g') then
    return jsonb_build_object('ok', false, 'message', 'Vous ne pouvez pas utiliser votre propre code.'); end if;
  insert into partenaire_filleuls (user_id, partenaire_id) values (v_moi, v_p.id) on conflict (user_id) do nothing;
  return jsonb_build_object('ok', true);
end $function$;
revoke all on function public.rattacher_partenaire(text) from public, anon;
grant execute on function public.rattacher_partenaire(text) to authenticated;

-- Administration -----------------------------------------------------------------

create or replace function public.admin_partenaires()
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare v_out jsonb;
begin
  if not exists (select 1 from roles_utilisateur where user_id = auth.uid() and role in ('admin', 'investisseur')) then
    return jsonb_build_object('ok', false, 'message', 'Réservé à l''administration.'); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', d->>'id', 'nom', d->>'nom', 'code', d->>'code', 'actif', (d->>'actif')::boolean, 'cree_le', d->>'cree_le',
           'resume', d->'resume') order by (d->>'cree_le') desc), '[]'::jsonb)
    into v_out
    from (select public.partenaire_donnees(id, true) d from partenaires) x;
  return jsonb_build_object('ok', true, 'liste', v_out);
end $function$;
revoke all on function public.admin_partenaires() from public, anon;
grant execute on function public.admin_partenaires() to authenticated;

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
  return jsonb_build_object('ok', true, 'jeton', (select jeton from partenaires where id = p_id)) || coalesce(public.partenaire_donnees(p_id, true), '{}'::jsonb);
end $function$;
revoke all on function public.admin_partenaire_detail(uuid) from public, anon;
grant execute on function public.admin_partenaire_detail(uuid) to authenticated;

create or replace function public.admin_partenaire_creer(p_nom text, p_code text, p_telephone text, p_mois integer, p_an integer)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')); v_nom text := trim(coalesce(p_nom, '')); v_id uuid; v_jeton text;
begin
  if not securite.est_admin() then return jsonb_build_object('ok', false, 'message', 'Réservé à l''administration.'); end if;
  if char_length(v_nom) < 3 then return jsonb_build_object('ok', false, 'message', 'Écrivez le nom du partenaire.'); end if;
  if v_code !~ '^[A-Z0-9]{3,14}$' then return jsonb_build_object('ok', false, 'message', 'Le code : de 3 à 14 lettres ou chiffres.'); end if;
  if exists (select 1 from partenaires where code = v_code) then return jsonb_build_object('ok', false, 'message', 'Ce code existe déjà. Choisissez-en un autre.'); end if;
  insert into partenaires (nom, code, telephone, commission_mois, commission_an)
  values (v_nom, v_code, nullif(trim(coalesce(p_telephone, '')), ''), coalesce(p_mois, 200), coalesce(p_an, 1000))
  returning id, jeton into v_id, v_jeton;
  insert into journal_activite (acteur, action, table_cible) values (auth.uid(), 'partenaire_cree', 'partenaires');
  return jsonb_build_object('ok', true, 'id', v_id, 'jeton', v_jeton, 'code', v_code);
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
    jeton = case when coalesce(p_nouveau_lien, false) then replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') else jeton end
   where id = p_id;
  insert into journal_activite (acteur, action, table_cible) values (auth.uid(), 'partenaire_modifie', 'partenaires');
  return jsonb_build_object('ok', true);
end $function$;
revoke all on function public.admin_partenaire_maj(uuid, boolean, integer, integer, text, boolean) from public, anon;
grant execute on function public.admin_partenaire_maj(uuid, boolean, integer, integer, text, boolean) to authenticated;

create or replace function public.admin_partenaire_verser(p_id uuid, p_montant integer, p_note text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_d jsonb; v_solde int;
begin
  if not securite.est_admin() then return jsonb_build_object('ok', false, 'message', 'Réservé à l''administration.'); end if;
  if p_montant is null or p_montant <= 0 then return jsonb_build_object('ok', false, 'message', 'Écrivez le montant versé.'); end if;
  v_d := public.partenaire_donnees(p_id, true);
  if v_d is null then return jsonb_build_object('ok', false, 'message', 'Partenaire introuvable.'); end if;
  v_solde := (v_d->'resume'->>'solde')::int;
  if p_montant > v_solde then
    return jsonb_build_object('ok', false, 'message', 'Le montant dépasse ce qui est à verser aujourd''hui (' || v_solde || ' F).'); end if;
  insert into partenaire_versements (partenaire_id, montant, note, par) values (p_id, p_montant, nullif(trim(coalesce(p_note, '')), ''), auth.uid());
  insert into journal_activite (acteur, action, table_cible) values (auth.uid(), 'partenaire_verse', 'partenaire_versements');
  return jsonb_build_object('ok', true);
end $function$;
revoke all on function public.admin_partenaire_verser(uuid, integer, text) from public, anon;
grant execute on function public.admin_partenaire_verser(uuid, integer, text) to authenticated;

create or replace function public.admin_partenaire_annuler_versement(p_versement uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not securite.est_admin() then return jsonb_build_object('ok', false, 'message', 'Réservé à l''administration.'); end if;
  delete from partenaire_versements where id = p_versement;
  insert into journal_activite (acteur, action, table_cible) values (auth.uid(), 'partenaire_versement_annule', 'partenaire_versements');
  return jsonb_build_object('ok', true);
end $function$;
revoke all on function public.admin_partenaire_annuler_versement(uuid) from public, anon;
grant execute on function public.admin_partenaire_annuler_versement(uuid) to authenticated;
