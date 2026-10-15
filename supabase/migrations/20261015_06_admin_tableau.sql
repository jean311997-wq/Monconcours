-- Administration : tableau de bord, détection des comptes suspects, bannissements.
-- Tout est réservé à l'équipe (vérifié dans chaque fonction).

-- 1. Les bannissements ----------------------------------------------------
create table if not exists public.bannissements (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  telephone text,
  nom text,
  motif text not null,
  jusqu_au timestamptz,                 -- null = définitif
  par uuid,
  cree_le timestamptz not null default now(),
  leve_le timestamptz,
  leve_par uuid
);
alter table public.bannissements enable row level security;
revoke all on public.bannissements from anon, authenticated;
grant select on public.bannissements to authenticated;
create policy "equipe lit les bannissements" on public.bannissements
  for select to authenticated using ((select securite.est_equipe()));
create index if not exists bannissements_user on public.bannissements (user_id, leve_le);

-- 2. Le tableau de bord -----------------------------------------------------
create or replace function public.tableau_de_bord(p_jours int default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_j int := least(greatest(coalesce(p_jours, 30), 7), 90); v_debut date := current_date - (least(greatest(coalesce(p_jours, 30), 7), 90) - 1);
begin
  if not securite.est_equipe() then raise exception 'réservé à l''équipe'; end if;
  return jsonb_build_object(
    'maintenant', now(),
    'inscrits', (select count(*) from profils),
    'nouveaux_jour', (select count(*) from profils where cree_le >= current_date),
    'nouveaux_7j', (select count(*) from profils where cree_le >= current_date - 6),
    'nouveaux_7j_avant', (select count(*) from profils where cree_le >= current_date - 13 and cree_le < current_date - 6),
    'actifs_jour', (select count(distinct u) from (
        select user_id u from evenements where cree_le >= current_date and user_id is not null
        union select user_id from assiduite where jour = current_date) z),
    'actifs_7j', (select count(distinct u) from (
        select user_id u from evenements where cree_le >= current_date - 6 and user_id is not null
        union select user_id from assiduite where jour >= current_date - 6) z),
    'visiteurs_jour', (select count(distinct coalesce(user_id::text, session_id::text)) from evenements where cree_le >= current_date),
    'en_ligne', (select count(distinct coalesce(user_id::text, session_id::text)) from evenements where cree_le > now() - interval '5 minutes'),
    'en_ligne_comptes', (select count(distinct user_id) from evenements where cree_le > now() - interval '5 minutes' and user_id is not null),
    'en_composition', (select count(*) from compositions where not terminee and debut_le > now() - interval '40 minutes'),
    'questions_jour', (select count(*) from tentatives_question where cree_le >= current_date),
    'compositions_jour', (select count(*) from compositions where debut_le >= current_date),
    'defis_7j', (select count(*) from defis where cree_le >= current_date - 6),
    'push_actifs', (select count(*) from push_abonnements where actif),
    'packs_7j', (select count(*) from packs_hors_ligne where cree_le >= current_date - 6),
    'bannis', (select count(*) from bannissements where leve_le is null and (jusqu_au is null or jusqu_au > now())),
    'suppressions_30j', (select count(*) from journal_activite where action = 'suppression_compte' and cree_le > now() - interval '30 days'),
    'jours', v_j,
    'avant_periode', (select count(*) from profils where cree_le < v_debut),
    'croissance', (select coalesce(jsonb_agg(jsonb_build_object('jour', d, 'inscrits', i, 'actifs', a) order by d), '[]'::jsonb) from (
        select g.d::date d,
               (select count(*) from profils p where p.cree_le::date = g.d::date) i,
               (select count(distinct u) from (
                  select e.user_id u from evenements e where e.cree_le::date = g.d::date and e.user_id is not null
                  union select s.user_id from assiduite s where s.jour = g.d::date) z) a
          from generate_series(v_debut, current_date, interval '1 day') g(d)) x),
    'heures', (select coalesce(jsonb_agg(jsonb_build_object('h', h, 'n', n) order by h), '[]'::jsonb) from (
        select g.h, (select count(distinct coalesce(e.user_id::text, e.session_id::text) || e.cree_le::date)
                       from evenements e where e.cree_le >= current_date - 6 and extract(hour from e.cree_le) = g.h) n
          from generate_series(0, 23) g(h)) x),
    'zones', (select coalesce(jsonb_agg(z order by (z->>'minutes')::numeric desc), '[]'::jsonb) from (
        select jsonb_build_object('ecran', e.meta->>'ecran',
                 'minutes', round(sum(least(coalesce((e.meta->>'duree_ms')::numeric, 0), 1800000)) / 60000.0, 1),
                 'visites', count(*),
                 'personnes', count(distinct coalesce(e.user_id::text, e.session_id::text)),
                 'moyenne_s', round(avg(least(coalesce((e.meta->>'duree_ms')::numeric, 0), 1800000)) / 1000.0)) z
          from evenements e
         where e.nom = 'SCREEN_LEFT' and e.cree_le >= v_debut and e.meta ? 'ecran'
         group by e.meta->>'ecran') x),
    'actions', (select coalesce(jsonb_agg(jsonb_build_object('nom', nom, 'n', n, 'personnes', p) order by n desc), '[]'::jsonb) from (
        select nom, count(*) n, count(distinct coalesce(user_id::text, session_id::text)) p
          from evenements
         where cree_le >= v_debut
           and nom not in ('SCREEN_VIEWED','SCREEN_LEFT','BUTTON_CLICKED','SCROLL_DEPTH_REACHED','APP_BACKGROUND',
                           'APP_FOREGROUND','SESSION_STARTED','SESSION_ENDED','USER_RETURNED','USER_FIRST_VISIT','APP_ENTERED')
         group by nom order by count(*) desc limit 25) x),
    'appareils', (select coalesce(jsonb_agg(jsonb_build_object('systeme', s, 'n', n) order by n desc), '[]'::jsonb) from (
        select coalesce(nullif(systeme, ''), 'Inconnu') s, count(distinct coalesce(user_id::text, id::text)) n
          from sessions where debut_le >= v_debut group by 1 order by 2 desc limit 6) x),
    'nouveautes', jsonb_build_object(
        'nationale_inscrits', (select count(*) from inscriptions_epreuve where cree_le >= v_debut),
        'defis', (select count(*) from defis where cree_le >= v_debut),
        'invitations', (select count(*) from defis_invitations where cree_le >= v_debut),
        'packs', (select count(*) from packs_hors_ligne where cree_le >= v_debut),
        'cartes', (select count(*) from evenements where nom = 'RESULT_CARD_SHARED' and cree_le >= v_debut),
        'attestations', (select count(*) from evenements where nom = 'CERTIFICATE_DOWNLOADED' and cree_le >= v_debut),
        'badges', (select count(*) from evenements where nom = 'BADGE_EARNED' and cree_le >= v_debut),
        'relances', (select count(*) from notifications where cle_unicite like 'absence%' and cree_le >= v_debut),
        'retours_relance', (select count(distinct n.user_id) from notifications n
            where n.cle_unicite like 'absence%' and n.cree_le >= v_debut
              and exists (select 1 from assiduite a where a.user_id = n.user_id and a.jour between n.cree_le::date and n.cree_le::date + 2))));
end $$;
revoke all on function public.tableau_de_bord(int) from public, anon;
grant execute on function public.tableau_de_bord(int) to authenticated;

-- 3. Les comptes à surveiller ---------------------------------------------
create or replace function public.candidats_suspects()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not securite.est_equipe() then raise exception 'réservé à l''équipe'; end if;
  return (select coalesce(jsonb_agg(x order by (x->>'score')::int desc), '[]'::jsonb) from (
    select jsonb_build_object('id', p.id, 'nom', p.nom, 'pseudo', p.pseudo, 'telephone', p.telephone, 'cree_le', p.cree_le,
             'score', s.score, 'raisons', s.raisons,
             'banni', exists (select 1 from bannissements b where b.user_id = p.id and b.leve_le is null and (b.jusqu_au is null or b.jusqu_au > now()))) x
      from profils p
      cross join lateral (
        select echecs, reinit, invitations, questions, sig,
               (least(echecs, 30) + reinit * 5 + greatest(invitations - 20, 0) + greatest(questions - 400, 0) / 20 + sig * 2
                + case when nom_louche then 15 else 0 end) score,
               array_remove(array[
                 case when echecs >= 8 then echecs || ' codes faux en 24 h' end,
                 case when reinit >= 2 then reinit || ' essais « code oublié » ratés' end,
                 case when invitations > 20 then invitations || ' invitations à des défis en 7 jours' end,
                 case when questions > 400 then questions || ' questions en 24 h (robot ?)' end,
                 case when sig >= 5 then sig || ' signalements envoyés en 24 h' end,
                 case when nom_louche then 'nom ou pseudo qui imite l''équipe ou contient un numéro' end], null) raisons
          from (select
            (select count(*) from tentatives_connexion t where t.telephone = p.telephone and not t.reussie and t.cree_le > now() - interval '24 hours') echecs,
            (select count(*) from tentatives_reinit t where t.telephone = p.telephone and not t.reussie and t.cree_le > now() - interval '30 days') reinit,
            (select count(*) from defis_invitations i join defis d on d.id = i.defi_id where d.auteur = p.id and i.cree_le > now() - interval '7 days') invitations,
            (select count(*) from tentatives_question q where q.user_id = p.id and q.cree_le > now() - interval '24 hours') questions,
            (select count(*) from signalements g where g.user_id = p.id and g.cree_le > now() - interval '24 hours') sig,
            (coalesce(p.nom, '') || ' ' || coalesce(p.pseudo, '')) ~* '(admin|mon ?concours|service|support|equipe|équipe|\d{5,})' nom_louche) c
      ) s
     where s.score >= 8
       and not exists (select 1 from roles_utilisateur r where r.user_id = p.id and r.role in ('admin', 'correcteur'))
     order by s.score desc limit 60) z);
end $$;
revoke all on function public.candidats_suspects() from public, anon;
grant execute on function public.candidats_suspects() to authenticated;
