-- =====================================================================
-- 14 octobre 2026 — Accueil intelligent, fil « Pour toi », compositions
-- collectives, pseudos, réactions, question du jour, signalements,
-- rappels. Et une fermeture : les copies ne s'écrivent plus que par
-- le serveur.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Sécurité : un candidat lisait ET écrivait ses compositions et ses
--    réponses en direct. Il pouvait reculer son heure de début ou
--    s'inscrire des réponses justes. Désormais : lecture seule, toute
--    écriture passe par ouvrir / remettre / rejoindre (SECURITY DEFINER).
-- ---------------------------------------------------------------------
-- Politiques restrictives : elles s'ajoutent aux politiques existantes et
-- bloquent toute écriture directe d'un candidat (les fonctions du serveur,
-- propriétaires des tables, ne sont pas concernées).
create policy "ecriture serveur seulement (maj)" on public.compositions as restrictive for update using (securite.est_equipe());
create policy "ecriture serveur seulement (ajout)" on public.compositions as restrictive for insert with check (securite.est_equipe());
create policy "ecriture serveur seulement (suppr)" on public.compositions as restrictive for delete using (securite.est_equipe());
create policy "ecriture serveur seulement (maj)" on public.composition_reponses as restrictive for update using (securite.est_equipe());
create policy "ecriture serveur seulement (ajout)" on public.composition_reponses as restrictive for insert with check (securite.est_equipe());
create policy "ecriture serveur seulement (suppr)" on public.composition_reponses as restrictive for delete using (securite.est_equipe());

-- ---------------------------------------------------------------------
-- 1. Pseudos et objectif du jour
-- ---------------------------------------------------------------------
alter table public.profils add column if not exists pseudo text;
alter table public.profils add column if not exists objectif_jour smallint not null default 20;
alter table public.profils drop constraint if exists profils_objectif_jour_check;
alter table public.profils add constraint profils_objectif_jour_check
  check (objectif_jour in (10, 20, 50, 100));
create unique index if not exists profils_pseudo_unique on public.profils (lower(pseudo));

create or replace function public.generer_pseudo()
returns text language plpgsql volatile set search_path = public as $$
declare
  mots text[] := array['Baobab','Karité','Néré','Faucon','Lion','Étoile','Savane','Sahel',
    'Tamarin','Calao','Éléphant','Guépard','Kora','Djembé','Balafon','Tisserin','Antilope',
    'Zébu','Panthère','Aigle','Gazelle','Rônier','Hibou','Caïman','Fromager','Harmattan'];
  v text; essai int := 0;
begin
  loop
    v := mots[1 + floor(random() * array_length(mots, 1))::int] || '-' || lpad((floor(random() * 9000) + 1000)::int::text, 4, '0');
    exit when not exists (select 1 from public.profils where lower(pseudo) = lower(v));
    essai := essai + 1;
    if essai > 20 then v := v || floor(random()*10)::int::text; exit; end if;
  end loop;
  return v;
end $$;
revoke all on function public.generer_pseudo() from public, anon, authenticated;

create or replace function public.profils_pseudo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.pseudo is null or not securite.est_equipe() then new.pseudo := public.generer_pseudo(); end if;
  else
    -- le pseudo est attribué par le serveur, pas modifiable par le candidat
    if not securite.est_equipe() then new.pseudo := old.pseudo; end if;
    if new.pseudo is null then new.pseudo := public.generer_pseudo(); end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_profils_pseudo on public.profils;
create trigger trg_profils_pseudo before insert or update on public.profils
  for each row execute function public.profils_pseudo();

update public.profils set pseudo = public.generer_pseudo() where pseudo is null;

-- ---------------------------------------------------------------------
-- 2. Compositions collectives
-- ---------------------------------------------------------------------
create table if not exists public.epreuves_collectives (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  sujet_id uuid not null references public.sujets(id),
  debut_le timestamptz not null,
  fin_le timestamptz not null,
  recompense text,
  message text,
  statut text not null default 'programmee' check (statut in ('programmee','annulee')),
  cree_par uuid,
  cree_le timestamptz not null default now(),
  check (fin_le > debut_le)
);
alter table public.epreuves_collectives enable row level security;
drop policy if exists "epreuves visibles" on public.epreuves_collectives;
create policy "epreuves visibles" on public.epreuves_collectives
  for select using (statut = 'programmee' or securite.est_equipe());
drop policy if exists "epreuves gérées par l'équipe" on public.epreuves_collectives;
create policy "epreuves gérées par l'équipe" on public.epreuves_collectives
  for all using (securite.est_equipe()) with check (securite.est_equipe());
create index if not exists epreuves_debut_idx on public.epreuves_collectives (debut_le desc);

alter table public.compositions add column if not exists epreuve_id uuid references public.epreuves_collectives(id);
create unique index if not exists compositions_une_par_epreuve
  on public.compositions (user_id, epreuve_id) where epreuve_id is not null;

-- Une question est « gardée » tant qu'une épreuve collective qui la contient
-- n'est pas terminée : ni correction en révision, ni cahier, ni question du jour.
create or replace function public.question_gardee(p_question uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.epreuves_collectives ec
                   join public.sujet_questions sq on sq.sujet_id = ec.sujet_id
                  where sq.question_id = p_question and ec.statut = 'programmee'
                    and ec.fin_le > now() and ec.debut_le < now() + interval '7 days');
$$;
revoke all on function public.question_gardee(uuid) from public, anon, authenticated;

create table if not exists public.reactions_epreuve (
  id bigint generated always as identity primary key,
  epreuve_id uuid not null references public.epreuves_collectives(id) on delete cascade,
  composition_id uuid not null references public.compositions(id) on delete cascade,
  auteur uuid not null,
  type text not null check (type in ('bravo','bien_joue','respect')),
  cree_le timestamptz not null default now(),
  unique (composition_id, auteur, type)
);
alter table public.reactions_epreuve enable row level security;
-- aucune politique : lecture et écriture passent par les fonctions

-- ---------------------------------------------------------------------
-- 3. Signalements de questions
-- ---------------------------------------------------------------------
create table if not exists public.signalements (
  id bigint generated always as identity primary key,
  question_id uuid not null references public.questions(id) on delete cascade,
  user_id uuid,
  motif text not null check (motif in ('reponse_fausse','enonce_errone','faute','perime','autre')),
  commentaire text check (char_length(commentaire) <= 500),
  statut text not null default 'nouveau' check (statut in ('nouveau','corrige','rejete')),
  cree_le timestamptz not null default now()
);
alter table public.signalements enable row level security;
drop policy if exists "signalements équipe" on public.signalements;
create policy "signalements équipe" on public.signalements
  for all using (securite.est_equipe()) with check (securite.est_equipe());

-- ---------------------------------------------------------------------
-- 4. Question du jour
-- ---------------------------------------------------------------------
create table if not exists public.reponses_question_jour (
  id bigint generated always as identity primary key,
  jour date not null default current_date,
  question_id uuid not null,
  user_id uuid,
  session_id uuid,
  correcte boolean not null,
  cree_le timestamptz not null default now()
);
create unique index if not exists rqj_user on public.reponses_question_jour (jour, user_id) where user_id is not null;
create unique index if not exists rqj_session on public.reponses_question_jour (jour, session_id) where user_id is null and session_id is not null;
alter table public.reponses_question_jour enable row level security;

-- ---------------------------------------------------------------------
-- 5. Rappels (notifications du téléphone)
-- ---------------------------------------------------------------------
create table if not exists public.push_abonnements (
  endpoint text primary key,
  user_id uuid not null,
  p256dh text not null,
  auth text not null,
  heure smallint not null default 19 check (heure between 0 and 23),
  minute smallint not null default 0 check (minute in (0, 15, 30, 45)),
  actif boolean not null default true,
  dernier_rappel date,
  cree_le timestamptz not null default now()
);
alter table public.push_abonnements enable row level security;
create table if not exists public.envois_push (
  endpoint text not null,
  cle text not null,
  envoye_le timestamptz not null default now(),
  primary key (endpoint, cle)
);
alter table public.envois_push enable row level security;

-- =====================================================================
-- FONCTIONS
-- =====================================================================

-- Les questions d'un sujet, avec leur matière (pour le bilan par matière)
create or replace function public.questions_du_sujet(p_sujet uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', q.id, 'enonce', q.enonce, 'matiere', m.nom,
           'options', (select jsonb_agg(o.texte order by o.position)
                         from public.question_options o where o.question_id = q.id))
           order by sq.position), '[]'::jsonb)
    from public.sujet_questions sq
    join public.questions q on q.id = sq.question_id
    left join public.matieres m on m.id = q.matiere_id
   where sq.sujet_id = p_sujet;
$$;
revoke all on function public.questions_du_sujet(uuid) from public, anon, authenticated;

-- ---------- ouvrir_composition : sujets des épreuves collectives écartés,
--            matière renvoyée, épreuve en cours reprise ----------
create or replace function public.ouvrir_composition(p_niveau text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_niveau public.niveau_scolaire; v_compo record; v_sujet record; v_concours text;
  v_restant int; v_seuil int; v_ep jsonb;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'connexion', true, 'message', 'Créez votre compte pour composer.');
  end if;
  if not (securite.est_abonne(v_user) or securite.est_equipe()) then
    return jsonb_build_object('ok', false, 'abonnement', true, 'message', 'La composition fait partie de l''abonnement.');
  end if;

  begin
    v_niveau := coalesce(nullif(p_niveau, '')::public.niveau_scolaire,
                         (select niveau from public.profils where id = v_user), 'terminale');
  exception when others then v_niveau := 'terminale';
  end;

  select c.*, coalesce(s.duree_secondes, 1500) as duree into v_compo
    from public.compositions c left join public.sujets s on s.id = c.sujet_id
   where c.user_id = v_user and not c.terminee
     and c.debut_le > now() - make_interval(secs => coalesce(s.duree_secondes, 1500) + 120)
   order by c.debut_le desc limit 1;

  if found then
    select * into v_sujet from public.sujets where id = v_compo.sujet_id;
  else
    select s.* into v_sujet from public.sujets s
     where s.statut = 'publie' and (s.niveau = v_niveau or s.niveau is null)
       and exists (select 1 from public.sujet_questions sq where sq.sujet_id = s.id)
       and not exists (select 1 from public.epreuves_collectives ec
                        where ec.sujet_id = s.id and ec.statut = 'programmee' and ec.fin_le > now())
     order by (s.niveau = v_niveau) desc nulls last,
              (select count(*) from public.compositions c where c.user_id = v_user and c.sujet_id = s.id),
              random()
     limit 1;
    if not found then
      return jsonb_build_object('ok', false, 'message', 'Aucun sujet n''est encore publié pour ce niveau.');
    end if;
    insert into public.compositions (user_id, sujet_id, nb_questions, nb_traitees)
    values (v_user, v_sujet.id, (select count(*) from public.sujet_questions where sujet_id = v_sujet.id), 0)
    returning *, coalesce(v_sujet.duree_secondes, 1500) as duree into v_compo;
  end if;

  select c.nom, c.seuil_dernier_admis into v_concours, v_seuil from public.concours c
   where c.id = v_sujet.concours_id and (c.niveau_requis = v_niveau or c.niveau_requis is null);
  if v_concours is null then
    select c.nom, c.seuil_dernier_admis into v_concours, v_seuil from public.concours c
     where c.actif and c.niveau_requis = v_niveau order by random() limit 1;
  end if;

  v_restant := greatest(0, coalesce(v_sujet.duree_secondes, 1500)
                 - floor(extract(epoch from (now() - v_compo.debut_le)))::int);

  if v_compo.epreuve_id is not null then
    select jsonb_build_object('id', id, 'titre', titre, 'fin_le', fin_le) into v_ep
      from public.epreuves_collectives where id = v_compo.epreuve_id;
  end if;

  return jsonb_build_object('ok', true, 'id', v_compo.id, 'sujet', v_sujet.reference,
    'duree', coalesce(v_sujet.duree_secondes, 1500), 'restant', v_restant,
    'concours', coalesce(v_concours, 'Concours direct'), 'niveau', v_niveau,
    'seuil', v_seuil,
    'epreuve', v_ep,
    'questions', public.questions_du_sujet(v_sujet.id));
end $$;

-- ---------- rejoindre une composition collective ----------
create or replace function public.rejoindre_epreuve(p_epreuve uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid(); v_ep record; v_sujet record; v_compo record; v_existe boolean;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'connexion', true, 'message', 'Créez votre compte pour participer.');
  end if;
  if not (securite.est_abonne(v_user) or securite.est_equipe()) then
    return jsonb_build_object('ok', false, 'abonnement', true, 'message', 'La composition fait partie de l''abonnement.');
  end if;
  select * into v_ep from public.epreuves_collectives where id = p_epreuve and statut = 'programmee';
  if not found then return jsonb_build_object('ok', false, 'message', 'Composition collective introuvable.'); end if;
  if now() < v_ep.debut_le then
    return jsonb_build_object('ok', false, 'attente', true, 'debut_le', v_ep.debut_le,
      'message', 'La composition n''a pas encore commencé.');
  end if;

  select * into v_compo from public.compositions where user_id = v_user and epreuve_id = v_ep.id;
  v_existe := found;
  if v_existe and v_compo.terminee then
    return jsonb_build_object('ok', false, 'deja', true, 'message', 'Vous avez déjà remis votre copie pour cette composition.');
  end if;
  if now() > v_ep.fin_le - interval '30 seconds' then
    return jsonb_build_object('ok', false, 'termine', true, 'message', 'La composition est terminée.');
  end if;

  select * into v_sujet from public.sujets where id = v_ep.sujet_id;
  if not v_existe then
    insert into public.compositions (user_id, sujet_id, nb_questions, nb_traitees)
    values (v_user, v_sujet.id, (select count(*) from public.sujet_questions where sujet_id = v_sujet.id), 0)
    returning * into v_compo;
    -- tout le monde compose sur la même horloge : l'heure de début est celle de l'épreuve
    update public.compositions set debut_le = v_ep.debut_le, epreuve_id = v_ep.id
     where id = v_compo.id;
  end if;

  return jsonb_build_object('ok', true, 'id', v_compo.id, 'sujet', v_sujet.reference,
    'duree', coalesce(v_sujet.duree_secondes, 1500),
    'restant', greatest(0, floor(extract(epoch from (v_ep.fin_le - now())))::int),
    'concours', v_ep.titre, 'seuil', null,
    'epreuve', jsonb_build_object('id', v_ep.id, 'titre', v_ep.titre, 'fin_le', v_ep.fin_le),
    'questions', public.questions_du_sujet(v_sujet.id));
end $$;

-- ---------- remettre : la correction d'une épreuve collective attend la fin ----------
create or replace function public.remettre_composition(p_composition uuid, p_reponses jsonb, p_duree integer default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_user uuid := auth.uid();
  v_sujet uuid; v_debut timestamptz; v_alloue int; v_epreuve uuid; v_fin_ep timestamptz;
  v_score int; v_traitees int; v_total int; v_ecoule int; v_corrige jsonb;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'message', 'Non connecté.'); end if;

  select c.sujet_id, c.debut_le, coalesce(s.duree_secondes, 1500), c.epreuve_id
    into v_sujet, v_debut, v_alloue, v_epreuve
    from public.compositions c left join public.sujets s on s.id = c.sujet_id
   where c.id = p_composition and c.user_id = v_user and coalesce(c.terminee, false) = false
   for update of c;
  if not found then
    return jsonb_build_object('ok', false, 'message', 'Composition introuvable ou déjà remise.');
  end if;
  if v_epreuve is not null then
    select fin_le into v_fin_ep from public.epreuves_collectives where id = v_epreuve;
  end if;

  v_ecoule := greatest(0, floor(extract(epoch from (now() - v_debut)))::int);

  with liens as (
    select (row_number() over (order by sq.position) - 1)::int as idx, sq.question_id
      from public.sujet_questions sq where sq.sujet_id = v_sujet
  ),
  choix as (
    select (e.key)::int as idx,
           coalesce(array(select distinct (v)::int from jsonb_array_elements_text(e.value) v order by 1),
                    array[]::int[]) as choisies
      from jsonb_each(case when jsonb_typeof(p_reponses) = 'object' then p_reponses else '{}'::jsonb end) e
     where jsonb_typeof(e.value) = 'array' and e.key ~ '^[0-9]{1,3}$'
  )
  insert into public.composition_reponses (composition_id, question_id, options_choisies, correcte, repondu_le)
  select p_composition, l.question_id, c.choisies::smallint[],
         (c.choisies = public.bonnes_reponses(l.question_id)
            and array_length(public.bonnes_reponses(l.question_id), 1) is not null),
         now()
    from liens l join choix c on c.idx = l.idx
   where array_length(c.choisies, 1) is not null
  on conflict (composition_id, question_id) do update
    set options_choisies = excluded.options_choisies, correcte = excluded.correcte,
        repondu_le = excluded.repondu_le;

  select count(*) filter (where correcte), count(*) into v_score, v_traitees
    from public.composition_reponses where composition_id = p_composition;
  select count(*) into v_total from public.sujet_questions where sujet_id = v_sujet;

  perform set_config('app.notation_serveur', '1', true);
  update public.compositions
     set score = v_score, nb_traitees = v_traitees, terminee = true, fin_le = now(),
         duree_secondes = least(v_ecoule, v_alloue),
         nb_questions = coalesce(nullif(v_total, 0), nb_questions)
   where id = p_composition;

  insert into public.erreurs_utilisateur (user_id, question_id, origine, nb_echecs, revoir_le)
  select v_user, r.question_id, 'composition', 1, current_date
    from public.composition_reponses r where r.composition_id = p_composition and not r.correcte
  on conflict (user_id, question_id) do update
    set nb_echecs = erreurs_utilisateur.nb_echecs + 1, reussites_consecutives = 0, palier = 0,
        revoir_le = current_date, acquise = false, derniere_erreur = now(), maj_le = now();

  insert into public.tentatives_question (user_id, question_id, contexte, choix, correcte, position_dans_epreuve)
  select v_user, r.question_id, 'composition', r.options_choisies, r.correcte, l.position
    from public.composition_reponses r
    join public.sujet_questions l on l.sujet_id = v_sujet and l.question_id = r.question_id
   where r.composition_id = p_composition;

  insert into public.assiduite (user_id, jour, compose) values (v_user, current_date, true)
  on conflict (user_id, jour) do update set compose = true;
  perform public.crediter_points(v_user, 'composition', v_score * 15, p_composition);

  if v_fin_ep is not null and now() < v_fin_ep then
    -- les autres composent encore : le corrigé attend la fin de l'épreuve
    return jsonb_build_object('ok', true, 'note', v_score,
      'sur', coalesce(nullif(v_total, 0), v_traitees), 'traitees', v_traitees,
      'duree', least(v_ecoule, v_alloue), 'corrige', null, 'correction_le', v_fin_ep,
      'epreuve', v_epreuve);
  end if;

  select coalesce(jsonb_agg(to_jsonb(public.bonnes_reponses(sq.question_id)) order by sq.position), '[]'::jsonb)
    into v_corrige from public.sujet_questions sq where sq.sujet_id = v_sujet;

  return jsonb_build_object('ok', true, 'note', v_score,
    'sur', coalesce(nullif(v_total, 0), v_traitees), 'traitees', v_traitees,
    'duree', least(v_ecoule, v_alloue), 'hors_delai', v_ecoule > v_alloue + 120,
    'corrige', v_corrige, 'epreuve', v_epreuve);
end $$;

-- ---------- relire sa copie (corrigé caché tant que l'épreuve collective dure) ----------
create or replace function public.ma_copie(p_composition uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_c record; v_questions jsonb; v_fin timestamptz; v_cache boolean;
begin
  select c.*, s.reference into v_c from public.compositions c left join public.sujets s on s.id = c.sujet_id
   where c.id = p_composition and c.user_id = v_user and c.terminee;
  if not found then return jsonb_build_object('ok', false, 'message', 'Copie introuvable.'); end if;
  if v_c.epreuve_id is not null then
    select fin_le into v_fin from public.epreuves_collectives where id = v_c.epreuve_id;
  end if;
  v_cache := v_fin is not null and now() < v_fin;

  select coalesce(jsonb_agg(jsonb_build_object(
           'enonce', q.enonce, 'matiere', m.nom,
           'options', (select jsonb_agg(o.texte order by o.position) from public.question_options o where o.question_id = q.id),
           'bonnes', case when v_cache then null else to_jsonb(public.bonnes_reponses(q.id)) end,
           'choisies', coalesce((select to_jsonb(r.options_choisies) from public.composition_reponses r
                                  where r.composition_id = v_c.id and r.question_id = q.id), '[]'::jsonb))
           order by sq.position), '[]'::jsonb)
    into v_questions
    from public.sujet_questions sq join public.questions q on q.id = sq.question_id
    left join public.matieres m on m.id = q.matiere_id
   where sq.sujet_id = v_c.sujet_id;

  return jsonb_build_object('ok', true, 'date', v_c.debut_le, 'note', v_c.score,
    'duree', v_c.duree_secondes, 'sujet', v_c.reference, 'questions', v_questions,
    'correction_le', case when v_cache then v_fin else null end);
end $$;

-- ---------- le cahier n'affiche pas les questions d'une épreuve en cours ----------
create or replace function public.mes_erreurs()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'question_id', q.id, 'enonce', q.enonce, 'explication', q.explication,
      'matiere', m.nom, 'theme', c.nom,
      'options', (select jsonb_agg(o.texte order by o.position) from public.question_options o where o.question_id = q.id),
      'bonne', (public.bonnes_reponses(q.id))[1],
      'derniere', (select to_jsonb(t.choix) from public.tentatives_question t
                    where t.user_id = v_user and t.question_id = q.id and not t.correcte
                    order by t.cree_le desc limit 1),
      'rate', e.nb_echecs, 'suite', e.reussites_consecutives,
      'revoir_le', e.revoir_le, 'jours', greatest(0, e.revoir_le - current_date)
    ) order by e.revoir_le, e.nb_echecs desc)
    from public.erreurs_utilisateur e
    join public.questions q on q.id = e.question_id
    left join public.matieres m on m.id = q.matiere_id
    left join public.chapitres c on c.id = q.chapitre_id
    where e.user_id = v_user and not e.acquise and not public.question_gardee(q.id)
  ), '[]'::jsonb);
end $$;

-- ---------- corriger_question : refuse une question gardée ----------
do $do$
declare d text;
begin
  d := pg_get_functiondef('public.corriger_question(uuid,integer[],text,integer,uuid)'::regprocedure);
  if position('question_gardee' in d) = 0 then
    d := replace(d,
      E'  v_abonne := securite.est_abonne(v_user) or securite.est_equipe();',
      E'  if public.question_gardee(p_question) and not securite.est_equipe() then\n'
      || E'    return jsonb_build_object(''ok'', false, ''message'', ''Cette question fait partie d''''une composition collective en cours. Sa correction sera visible à la fin de l''''épreuve.'');\n'
      || E'  end if;\n\n'
      || E'  v_abonne := securite.est_abonne(v_user) or securite.est_equipe();');
    execute d;
  end if;
end $do$;

-- ---------- ma journée : tout ce qu'il faut à l'accueil, en un appel ----------
create or replace function public.ma_journee()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user uuid := auth.uid(); v_p record; v_semaine timestamptz := date_trunc('week', now());
  v_type int := (extract(week from now())::int) % 4;
begin
  if v_user is null then return null; end if;
  select pseudo, objectif_jour, niveau into v_p from public.profils where id = v_user;
  return jsonb_build_object(
    'pseudo', v_p.pseudo,
    'objectif', coalesce(v_p.objectif_jour, 20),
    'faites_jour', (select count(*) from public.tentatives_question where user_id = v_user and cree_le >= date_trunc('day', now())),
    'justes_jour', (select count(*) from public.tentatives_question where user_id = v_user and correcte and cree_le >= date_trunc('day', now())),
    'dues', (select count(*) from public.erreurs_utilisateur e where e.user_id = v_user and not e.acquise
               and e.revoir_le <= current_date and not public.question_gardee(e.question_id)),
    'jours_semaine', (select count(*) from public.assiduite where user_id = v_user and compose and jour >= v_semaine::date),
    'compos_semaine', (select count(*) from public.compositions where user_id = v_user and terminee and debut_le >= v_semaine),
    'meilleure_semaine', (select coalesce(max(round(100.0 * score / nullif(nb_questions, 0))), 0)
                            from public.compositions where user_id = v_user and terminee and debut_le >= v_semaine),
    'refermees_semaine', (select count(*) from public.erreurs_utilisateur where user_id = v_user and acquise and maj_le >= v_semaine),
    'defi', v_type,
    'compositions', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'score', score, 'sur', nb_questions,
                        'date', debut_le, 'collective', epreuve_id is not null) order by debut_le desc)
                      from (select * from public.compositions where user_id = v_user and terminee
                             order by debut_le desc limit 12) z), '[]'::jsonb),
    'jours14', coalesce((select jsonb_agg(jsonb_build_object('jour', j, 'n',
                    (select count(*) from public.tentatives_question t where t.user_id = v_user
                        and t.cree_le >= j and t.cree_le < j + interval '1 day')) order by j)
                  from generate_series(current_date - 13, current_date, '1 day') j), '[]'::jsonb)
  );
end $$;

create or replace function public.definir_objectif(p_objectif int)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return jsonb_build_object('ok', false); end if;
  if p_objectif not in (10, 20, 50, 100) then return jsonb_build_object('ok', false, 'message', 'Objectif non prévu.'); end if;
  update public.profils set objectif_jour = p_objectif where id = auth.uid();
  return jsonb_build_object('ok', true, 'objectif', p_objectif);
end $$;

-- ---------- le fil « Pour toi » ----------
create or replace function public.fil_pour_toi(p_niveau text default null, p_nombre int default 10)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user uuid := auth.uid(); v_niveau public.niveau_scolaire; v_n int := least(greatest(coalesce(p_nombre, 10), 1), 20);
begin
  begin
    v_niveau := coalesce(nullif(p_niveau, '')::public.niveau_scolaire,
                         (select niveau from public.profils where id = v_user), 'terminale');
  exception when others then v_niveau := 'terminale';
  end;

  return coalesce((
    with taux as (
      select q.matiere_id, count(*) n, 100.0 * count(*) filter (where t.correcte) / count(*) pct
        from public.tentatives_question t join public.questions q on q.id = t.question_id
       where v_user is not null and t.user_id = v_user
       group by q.matiere_id
    ),
    vues as (
      select question_id, max(cree_le) derniere from public.tentatives_question
       where v_user is not null and user_id = v_user group by question_id
    ),
    cand as (
      select q.id, q.enonce, q.matiere_id, m.nom matiere, e.nb_echecs, e.revoir_le, e.acquise, e.maj_le err_maj,
             tx.pct, tx.n, v.derniere,
             case
               when e.id is not null and not e.acquise and e.revoir_le <= current_date then 60
               when e.id is not null and not e.acquise then -200
               when e.id is not null and e.acquise and e.maj_le < now() - interval '30 days' then 25
               else 0 end
             + case when tx.n >= 5 and tx.pct < 60 then 30 else 0 end
             + case when v.derniere is null then 15
                    when v.derniere < now() - interval '7 days' then 20
                    when v.derniere > now() - interval '1 day' then -40 else 0 end
             + random() * 12 as score
        from public.questions q
        join public.matieres m on m.id = q.matiere_id
        left join public.erreurs_utilisateur e on e.user_id = v_user and e.question_id = q.id
        left join taux tx on tx.matiere_id = q.matiere_id
        left join vues v on v.question_id = q.id
       where q.statut = 'publie' and (q.niveau = v_niveau or q.niveau is null)
         and (select count(*) from public.question_options o where o.question_id = q.id) >= 2
         and not public.question_gardee(q.id)
    ),
    classes as (
      select *, row_number() over (partition by matiere_id order by score desc) rang_m
        from cand where score > -100
    ),
    choisis as (
      select * from classes where rang_m <= greatest(2, ceil(v_n / 2.0)::int)
       order by score desc limit v_n
    )
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'enonce', c.enonce, 'matiere', c.matiere,
      'options', (select jsonb_agg(o.texte order by o.position) from public.question_options o where o.question_id = c.id),
      'contexte', case when c.nb_echecs is not null and not c.acquise then 'erreurs' else 'revision' end,
      'etiquette', case
          when c.nb_echecs is not null and not c.acquise then 'Prioritaire'
          when c.acquise and c.err_maj < now() - interval '30 days' then 'À consolider'
          when c.n >= 5 and c.pct < 60 then 'Recommandée'
          when c.derniere is null then 'Nouvelle'
          else 'À reprendre' end,
      'raison', case
          when c.nb_echecs is not null and not c.acquise then
            'Ratée ' || c.nb_echecs || ' fois : elle revient aujourd''hui jusqu''à être acquise.'
          when c.acquise and c.err_maj < now() - interval '30 days' then 'Acquise il y a plus d''un mois : on vérifie qu''elle tient.'
          when c.n >= 5 and c.pct < 60 then
            c.matiere || ' : ' || round(c.pct) || ' % de bonnes réponses sur ' || c.n || '. C''est une matière à renforcer.'
          when c.derniere is null then 'Une question que tu n''as jamais vue.'
          else 'Pas revue depuis ' || greatest(1, (current_date - c.derniere::date)) || ' jours.' end
    ) order by c.score desc)
    from choisis c
  ), '[]'::jsonb);
end $$;

-- ---------- question du jour (ouverte à tous, même sans compte) ----------
create or replace function public.id_question_du_jour(p_jour date default current_date)
returns uuid language sql stable security definer set search_path = public as $$
  select q.id from public.questions q
   where q.statut = 'publie' and q.explication is not null and length(q.explication) > 20
     and (select count(*) from public.question_options o where o.question_id = q.id) >= 3
     and not public.question_gardee(q.id)
   order by md5(q.id::text || p_jour::text) limit 1;
$$;
revoke all on function public.id_question_du_jour(date) from public, anon, authenticated;

create or replace function public.question_du_jour()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid := public.id_question_du_jour(); v_q record; v_deja boolean := false;
begin
  if v_id is null then return jsonb_build_object('ok', false); end if;
  select q.id, q.enonce, m.nom matiere into v_q from public.questions q
    left join public.matieres m on m.id = q.matiere_id where q.id = v_id;
  if auth.uid() is not null then
    v_deja := exists (select 1 from public.reponses_question_jour where jour = current_date and user_id = auth.uid());
  end if;
  return jsonb_build_object('ok', true, 'jour', current_date, 'id', v_q.id, 'enonce', v_q.enonce,
    'matiere', v_q.matiere,
    'options', (select jsonb_agg(o.texte order by o.position) from public.question_options o where o.question_id = v_q.id),
    'repondants', (select count(*) from public.reponses_question_jour where jour = current_date),
    'deja', v_deja);
end $$;

create or replace function public.repondre_question_du_jour(p_choix int[], p_session uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := public.id_question_du_jour(); v_user uuid := auth.uid();
  v_bonnes int[]; v_choix int[]; v_ok boolean; v_expl text; v_n int; v_j int;
begin
  if v_id is null then return jsonb_build_object('ok', false); end if;
  if v_user is null and p_session is null then
    return jsonb_build_object('ok', false, 'message', 'Session inconnue.');
  end if;
  v_bonnes := public.bonnes_reponses(v_id);
  select coalesce(array_agg(distinct c order by c), array[]::int[]) into v_choix
    from unnest(coalesce(p_choix, array[]::int[])) c where c between 0 and 9;
  v_ok := array_length(v_bonnes, 1) is not null and v_choix = v_bonnes;

  begin
    insert into public.reponses_question_jour (question_id, user_id, session_id, correcte)
    values (v_id, v_user, case when v_user is null then p_session end, v_ok);
  exception when unique_violation then null;   -- une seule réponse comptée par jour
  end;

  if v_user is not null then
    perform public.corriger_question(v_id, v_choix, 'revision', null, p_session);
  end if;

  select explication into v_expl from public.questions where id = v_id;
  select count(*), count(*) filter (where correcte) into v_n, v_j
    from public.reponses_question_jour where jour = current_date;
  return jsonb_build_object('ok', true, 'correcte', v_ok, 'bonnes', to_jsonb(v_bonnes),
    'explication', v_expl, 'repondants', v_n,
    'taux', case when v_n > 0 then round(100.0 * v_j / v_n) else null end);
end $$;

-- ---------- une question partagée par lien (sans corrigé) ----------
create or replace function public.question_publique(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_q record;
begin
  select q.id, q.enonce, m.nom matiere into v_q from public.questions q
    left join public.matieres m on m.id = q.matiere_id
   where q.id = p_id and q.statut = 'publie' and not public.question_gardee(q.id);
  if not found then return jsonb_build_object('ok', false); end if;
  return jsonb_build_object('ok', true, 'id', v_q.id, 'enonce', v_q.enonce, 'matiere', v_q.matiere,
    'options', (select jsonb_agg(o.texte order by o.position) from public.question_options o where o.question_id = v_q.id));
end $$;

-- ---------- activité en direct (chiffres seulement) ----------
create or replace function public.activite_en_direct()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'en_ligne', (select count(distinct session_id) from public.evenements where cree_le >= now() - interval '5 minutes'),
    'composent', (select count(*) from public.compositions where not terminee and debut_le >= now() - interval '40 minutes'));
$$;

-- ---------- la composition collective du moment ----------
create or replace function public.epreuve_du_moment()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_ep record; v_moi jsonb;
begin
  -- en cours, sinon la prochaine, sinon la dernière terminée (affichée 7 jours)
  select * into v_ep from public.epreuves_collectives
   where statut = 'programmee' and fin_le > now()
   order by debut_le limit 1;
  if not found then
    select * into v_ep from public.epreuves_collectives
     where statut = 'programmee' and fin_le <= now() and fin_le > now() - interval '7 days'
     order by fin_le desc limit 1;
  end if;
  if not found then return null; end if;
  if auth.uid() is not null then
    select jsonb_build_object('composition', id, 'terminee', terminee,
             'score', case when now() >= v_ep.fin_le or terminee then score end, 'sur', nb_questions)
      into v_moi from public.compositions
     where user_id = auth.uid() and epreuve_id = v_ep.id;
  end if;
  return jsonb_build_object('id', v_ep.id, 'titre', v_ep.titre, 'debut_le', v_ep.debut_le, 'fin_le', v_ep.fin_le,
    'recompense', v_ep.recompense, 'message', v_ep.message,
    'etat', case when now() < v_ep.debut_le then 'a_venir' when now() < v_ep.fin_le then 'en_cours' else 'terminee' end,
    'participants', (select count(*) from public.compositions where epreuve_id = v_ep.id),
    'composent', (select count(*) from public.compositions where epreuve_id = v_ep.id and not terminee),
    'nb_questions', (select count(*) from public.sujet_questions where sujet_id = v_ep.sujet_id),
    'duree', extract(epoch from (v_ep.fin_le - v_ep.debut_le))::int,
    'moi', v_moi);
end $$;

-- ---------- le classement d'une composition collective (après la fin) ----------
create or replace function public.classement_epreuve(p_epreuve uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_ep record; v_user uuid := auth.uid(); v_res jsonb; v_moi jsonb; v_total int; v_moy numeric;
begin
  select * into v_ep from public.epreuves_collectives where id = p_epreuve and statut = 'programmee';
  if not found then return jsonb_build_object('ok', false, 'message', 'Composition introuvable.'); end if;
  if now() < v_ep.fin_le then
    return jsonb_build_object('ok', true, 'termine', false, 'fin_le', v_ep.fin_le,
      'participants', (select count(*) from public.compositions where epreuve_id = v_ep.id));
  end if;

  with r as (
    select c.id, c.user_id, c.score, c.nb_questions, c.duree_secondes, p.pseudo,
           rank() over (order by c.score desc, c.duree_secondes asc nulls last) rang
      from public.compositions c join public.profils p on p.id = c.user_id
     where c.epreuve_id = v_ep.id and c.terminee
  )
  select jsonb_agg(jsonb_build_object('rang', rang, 'pseudo', pseudo, 'score', score, 'sur', nb_questions,
           'duree', duree_secondes, 'composition', id, 'moi', user_id = v_user,
           'reactions', (select coalesce(jsonb_object_agg(type, n), '{}'::jsonb) from (
               select re.type, count(*) n from public.reactions_epreuve re where re.composition_id = t.id group by re.type) z),
           'mes_reactions', (select coalesce(jsonb_agg(re.type), '[]'::jsonb) from public.reactions_epreuve re
                              where re.composition_id = t.id and re.auteur = v_user))
         order by rang, pseudo)
    into v_res from (select * from r order by rang limit 20) t;

  select jsonb_build_object('rang', rang, 'pseudo', pseudo, 'score', score, 'sur', nb_questions, 'duree', duree_secondes)
    into v_moi from (
      select c.user_id, c.score, c.nb_questions, c.duree_secondes, p.pseudo,
             rank() over (order by c.score desc, c.duree_secondes asc nulls last) rang
        from public.compositions c join public.profils p on p.id = c.user_id
       where c.epreuve_id = v_ep.id and c.terminee) z
   where v_user is not null and z.user_id = v_user;

  select count(*), round(avg(score)::numeric, 1) into v_total, v_moy
    from public.compositions where epreuve_id = v_ep.id and terminee;

  return jsonb_build_object('ok', true, 'termine', true, 'titre', v_ep.titre, 'debut_le', v_ep.debut_le,
    'recompense', v_ep.recompense, 'message', v_ep.message,
    'participants', v_total, 'moyenne', v_moy,
    'sur', (select count(*) from public.sujet_questions where sujet_id = v_ep.sujet_id),
    'classement', coalesce(v_res, '[]'::jsonb), 'moi', v_moi);
end $$;

create or replace function public.reagir_epreuve(p_composition uuid, p_type text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_c record; v_fin timestamptz;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'connexion', true, 'message', 'Connectez-vous pour féliciter.'); end if;
  if p_type not in ('bravo','bien_joue','respect') then return jsonb_build_object('ok', false); end if;
  select c.id, c.user_id, c.epreuve_id into v_c from public.compositions c where c.id = p_composition and c.terminee;
  if not found or v_c.epreuve_id is null then return jsonb_build_object('ok', false); end if;
  if v_c.user_id = v_user then return jsonb_build_object('ok', false, 'message', 'On ne se félicite pas soi-même.'); end if;
  select fin_le into v_fin from public.epreuves_collectives where id = v_c.epreuve_id;
  if now() < v_fin then return jsonb_build_object('ok', false); end if;
  if exists (select 1 from public.reactions_epreuve where composition_id = p_composition and auteur = v_user and type = p_type) then
    delete from public.reactions_epreuve where composition_id = p_composition and auteur = v_user and type = p_type;
    return jsonb_build_object('ok', true, 'retire', true);
  end if;
  if (select count(*) from public.reactions_epreuve where auteur = v_user and cree_le > now() - interval '1 hour') >= 60 then
    return jsonb_build_object('ok', false, 'message', 'Doucement : réessayez plus tard.');
  end if;
  insert into public.reactions_epreuve (epreuve_id, composition_id, auteur, type)
  values (v_c.epreuve_id, p_composition, v_user, p_type);
  return jsonb_build_object('ok', true);
end $$;

-- ---------- signaler une question ----------
create or replace function public.signaler_question(p_question uuid, p_motif text, p_commentaire text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then return jsonb_build_object('ok', false, 'connexion', true, 'message', 'Connectez-vous pour signaler une question.'); end if;
  if p_motif not in ('reponse_fausse','enonce_errone','faute','perime','autre') then
    return jsonb_build_object('ok', false, 'message', 'Motif inconnu.'); end if;
  if not exists (select 1 from public.questions where id = p_question) then
    return jsonb_build_object('ok', false, 'message', 'Question introuvable.'); end if;
  if (select count(*) from public.signalements where user_id = v_user and cree_le > now() - interval '1 day') >= 30 then
    return jsonb_build_object('ok', false, 'message', 'Trop de signalements aujourd''hui. Merci, nous traitons déjà les vôtres.'); end if;
  if exists (select 1 from public.signalements where user_id = v_user and question_id = p_question and statut = 'nouveau') then
    return jsonb_build_object('ok', true, 'deja', true); end if;
  insert into public.signalements (question_id, user_id, motif, commentaire)
  values (p_question, v_user, p_motif, nullif(left(trim(coalesce(p_commentaire, '')), 500), ''));
  return jsonb_build_object('ok', true);
end $$;

-- ---------- programmer une composition collective (équipe) ----------
create or replace function public.programmer_epreuve(p_titre text, p_sujet uuid, p_debut timestamptz,
  p_recompense text default null, p_message text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_s record; v_id uuid; v_quand text;
begin
  if not securite.est_equipe() then raise exception 'Réservé à l''équipe'; end if;
  select * into v_s from public.sujets where id = p_sujet;
  if not found then return jsonb_build_object('ok', false, 'message', 'Sujet introuvable.'); end if;
  if not exists (select 1 from public.sujet_questions where sujet_id = p_sujet) then
    return jsonb_build_object('ok', false, 'message', 'Ce sujet n''a pas de questions.'); end if;
  if p_debut < now() then return jsonb_build_object('ok', false, 'message', 'La date est déjà passée.'); end if;
  if length(trim(coalesce(p_titre, ''))) < 3 then return jsonb_build_object('ok', false, 'message', 'Donnez un titre.'); end if;

  insert into public.epreuves_collectives (titre, sujet_id, debut_le, fin_le, recompense, message, cree_par)
  values (trim(p_titre), p_sujet, p_debut, p_debut + make_interval(secs => coalesce(v_s.duree_secondes, 1500)),
          nullif(trim(coalesce(p_recompense, '')), ''), nullif(trim(coalesce(p_message, '')), ''), auth.uid())
  returning id into v_id;

  -- Burkina Faso : heure de Ouagadougou = UTC
  v_quand := to_char(p_debut at time zone 'UTC', 'DD/MM à HH24"h"MI');
  insert into public.notifications (user_id, type, titre, message, cle_unicite)
  select p.id, 'rappel', 'Composition collective : ' || trim(p_titre),
         'Tous les candidats composent le même sujet le ' || v_quand || '. Classement national à la fin.'
         || coalesce(' Récompense : ' || nullif(trim(coalesce(p_recompense, '')), '') || '.', ''),
         'epreuve-' || v_id::text
    from public.profils p
  on conflict do nothing;

  insert into public.journal_activite (acteur, action, table_cible, ligne_cible, details)
  values (auth.uid(), 'epreuve_programmee', 'epreuves_collectives', v_id, jsonb_build_object('debut', p_debut));
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

-- ---------- rappels : abonnement du téléphone ----------
create or replace function public.enregistrer_rappel(p_endpoint text, p_p256dh text, p_auth text, p_heure int, p_minute int default 0)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'connexion', true); end if;
  if p_endpoint !~ '^https://' or length(p_endpoint) > 1000 then return jsonb_build_object('ok', false); end if;
  if p_heure not between 0 and 23 or p_minute not in (0, 15, 30, 45) then return jsonb_build_object('ok', false); end if;
  insert into public.push_abonnements (endpoint, user_id, p256dh, auth, heure, minute, actif)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth, p_heure, p_minute, true)
  on conflict (endpoint) do update set user_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth,
    heure = excluded.heure, minute = excluded.minute, actif = true;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.retirer_rappel(p_endpoint text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  delete from public.push_abonnements where endpoint = p_endpoint and user_id = auth.uid();
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.mon_rappel()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select jsonb_build_object('heure', heure, 'minute', minute, 'actif', actif)
                     from public.push_abonnements where user_id = auth.uid() and actif
                     order by cree_le desc limit 1), 'null'::jsonb);
$$;

-- ---------- ce que la fonction d'envoi doit expédier (rôle service seulement) ----------
create or replace function public.envois_a_faire()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_res jsonb := '[]'::jsonb; v_r2 jsonb; v_min int := extract(hour from now() at time zone 'UTC')::int * 60
                                               + extract(minute from now() at time zone 'UTC')::int;
begin
  -- 1. rappels quotidiens : l'heure choisie est passée depuis moins de 20 minutes,
  --    pas encore envoyé aujourd'hui, et l'objectif du jour n'est pas atteint
  with dus as (
    select a.endpoint, a.p256dh, a.auth, a.user_id,
           coalesce(p.objectif_jour, 20) obj,
           (select count(*) from public.tentatives_question t where t.user_id = a.user_id and t.cree_le >= date_trunc('day', now())) faites,
           (select count(*) from public.erreurs_utilisateur e where e.user_id = a.user_id and not e.acquise and e.revoir_le <= current_date) erreurs
      from public.push_abonnements a join public.profils p on p.id = a.user_id
     where a.actif and (a.dernier_rappel is null or a.dernier_rappel < current_date)
       and v_min - (a.heure * 60 + a.minute) between 0 and 20
  ), marques as (
    update public.push_abonnements a set dernier_rappel = current_date
      from dus where a.endpoint = dus.endpoint and dus.faites < dus.obj
    returning dus.*
  )
  select coalesce(jsonb_agg(jsonb_build_object('endpoint', endpoint, 'p256dh', p256dh, 'auth', auth,
      'titre', 'Ta séance du jour',
      'message', case when erreurs > 0 then erreurs || ' erreur' || case when erreurs > 1 then 's' else '' end
                        || ' à revoir aujourd''hui, et ' || greatest(0, obj - faites) || ' questions pour ton objectif.'
                      else 'Il te reste ' || greatest(0, obj - faites) || ' questions pour atteindre ton objectif du jour.' end,
      'lien', '/?depuis=rappel')), '[]'::jsonb)
    into v_res from marques;

  -- 2. composition collective qui commence dans moins de 20 minutes
  with ep as (
    select * from public.epreuves_collectives
     where statut = 'programmee' and debut_le > now() and debut_le <= now() + interval '20 minutes'
  ), cibles as (
    insert into public.envois_push (endpoint, cle)
    select a.endpoint, 'epreuve-' || ep.id from public.push_abonnements a cross join ep where a.actif
    on conflict do nothing
    returning endpoint, cle
  )
  select coalesce(jsonb_agg(jsonb_build_object('endpoint', a.endpoint, 'p256dh', a.p256dh, 'auth', a.auth,
      'titre', 'Composition collective : ' || ep.titre,
      'message', 'Elle commence à ' || to_char(ep.debut_le at time zone 'UTC', 'HH24"h"MI') || '. Même sujet pour tous, classement national à la fin.',
      'lien', '/?epreuve=' || ep.id)), '[]'::jsonb)
    into v_r2
    from cibles c join public.push_abonnements a on a.endpoint = c.endpoint
    join ep on c.cle = 'epreuve-' || ep.id;

  return v_res || v_r2;
end $$;

create or replace function public.rappel_expire(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from public.push_abonnements where endpoint = p_endpoint;
$$;

-- ---------------------------------------------------------------------
-- Droits d'exécution
-- ---------------------------------------------------------------------
revoke all on function public.rejoindre_epreuve(uuid), public.ma_journee(), public.definir_objectif(int),
  public.reagir_epreuve(uuid, text), public.signaler_question(uuid, text, text),
  public.programmer_epreuve(text, uuid, timestamptz, text, text),
  public.enregistrer_rappel(text, text, text, int, int), public.retirer_rappel(text), public.mon_rappel(),
  public.envois_a_faire(), public.rappel_expire(text),
  public.fil_pour_toi(text, int), public.question_du_jour(), public.repondre_question_du_jour(int[], uuid),
  public.question_publique(uuid), public.activite_en_direct(), public.epreuve_du_moment(),
  public.classement_epreuve(uuid), public.questions_du_sujet(uuid), public.profils_pseudo()
  from public, anon, authenticated;

grant execute on function public.rejoindre_epreuve(uuid), public.ma_journee(), public.definir_objectif(int),
  public.reagir_epreuve(uuid, text), public.signaler_question(uuid, text, text),
  public.programmer_epreuve(text, uuid, timestamptz, text, text),
  public.enregistrer_rappel(text, text, text, int, int), public.retirer_rappel(text), public.mon_rappel(),
  public.fil_pour_toi(text, int)
  to authenticated;

grant execute on function public.question_du_jour(), public.repondre_question_du_jour(int[], uuid),
  public.question_publique(uuid), public.activite_en_direct(), public.epreuve_du_moment(),
  public.classement_epreuve(uuid)
  to anon, authenticated;

grant execute on function public.envois_a_faire(), public.rappel_expire(text) to service_role;

-- ---------------------------------------------------------------------
-- Rappels : clés VAPID et secret du planificateur rangés dans le coffre
-- (vault.create_secret 'vapid_prive', 'vapid_public', 'cron_rappels',
-- faits à la main : les valeurs ne figurent pas dans ce fichier).
-- ---------------------------------------------------------------------
create or replace function public.cles_push()
returns jsonb language sql stable security definer set search_path = public, vault as $$
  select jsonb_build_object(
    'prive', (select decrypted_secret from vault.decrypted_secrets where name = 'vapid_prive'),
    'public', (select decrypted_secret from vault.decrypted_secrets where name = 'vapid_public'),
    'cron', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_rappels'));
$$;
revoke all on function public.cles_push() from public, anon, authenticated;
grant execute on function public.cles_push() to service_role;

create extension if not exists pg_net;
select cron.schedule('rappels-push', '*/15 * * * *', $cron$
  select net.http_post(
    url := 'https://uonhpsumbfuahipbdjnu.supabase.co/functions/v1/rappels',
    headers := jsonb_build_object('Content-Type','application/json',
      'x-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_rappels')),
    body := '{}'::jsonb, timeout_milliseconds := 20000);
$cron$);

-- limite anti-abus sur la question du jour (20 réponses par minute et par adresse)
create trigger trg_limite_qdj before insert on public.reponses_question_jour for each row execute function securite.limiter_ajouts('20', '20000');
