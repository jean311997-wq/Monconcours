-- =====================================================================
-- 14 octobre 2026 (suite) — tout ce qui restait des propositions :
-- notes personnelles, pause de série, défis entre amis, top 10 de la
-- semaine, questions les plus ratées, questions similaires, notion du
-- jour, concours visé, propositions de questions par les candidats,
-- détails de progression, résumé du dimanche, indicateurs.
-- =====================================================================

-- ---------- notes personnelles sous une erreur ----------
alter table public.erreurs_utilisateur add column if not exists note_perso text
  check (char_length(note_perso) <= 300);

create or replace function public.noter_erreur(p_question uuid, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return jsonb_build_object('ok', false); end if;
  update public.erreurs_utilisateur set note_perso = nullif(left(trim(coalesce(p_note, '')), 300), '')
   where user_id = auth.uid() and question_id = p_question;
  return jsonb_build_object('ok', found);
end $$;

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
      'rate', e.nb_echecs, 'suite', e.reussites_consecutives, 'note_perso', e.note_perso,
      'premiere', (select min(t.cree_le) from public.tentatives_question t where t.user_id = v_user and t.question_id = q.id and not t.correcte),
      'revoir_le', e.revoir_le, 'jours', greatest(0, e.revoir_le - current_date)
    ) order by e.revoir_le, e.nb_echecs desc)
    from public.erreurs_utilisateur e
    join public.questions q on q.id = e.question_id
    left join public.matieres m on m.id = q.matiere_id
    left join public.chapitres c on c.id = q.chapitre_id
    where e.user_id = v_user and not e.acquise and not public.question_gardee(q.id)
  ), '[]'::jsonb);
end $$;

-- ---------- pause de série : deux jours par mois, sans perdre la série ----------
create table if not exists public.pauses_serie (
  user_id uuid not null, jour date not null, cree_le timestamptz not null default now(),
  primary key (user_id, jour)
);
alter table public.pauses_serie enable row level security;

create or replace function public.prendre_pause()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_n int;
begin
  if v_user is null then return jsonb_build_object('ok', false); end if;
  select count(*) into v_n from public.pauses_serie
   where user_id = v_user and jour >= date_trunc('month', current_date)::date;
  if v_n >= 2 then
    return jsonb_build_object('ok', false, 'message', 'Deux jours de pause par mois au plus. Ils reviennent le mois prochain.');
  end if;
  insert into public.pauses_serie (user_id, jour) values (v_user, current_date) on conflict do nothing;
  return jsonb_build_object('ok', true, 'restantes', 1 - v_n);
end $$;

-- mes_stats : un jour de pause ne casse pas la série (il ne la fait pas monter non plus)
do $do$
declare d text;
begin
  d := pg_get_functiondef('public.mes_stats()'::regprocedure);
  if position('pauses_serie' in d) = 0 then
    d := replace(d,
'  loop
    exit when not exists (select 1 from public.assiduite
                           where user_id = v_user and jour = v_jour and compose);
    v_serie := v_serie + 1;
    v_jour := v_jour - 1;
  end loop;',
'  -- aujourd''hui ne compte pas encore s''il n''y a rien eu : la série d''hier tient jusqu''à minuit
  if not exists (select 1 from public.assiduite where user_id = v_user and jour = v_jour and compose)
     and not exists (select 1 from public.pauses_serie where user_id = v_user and jour = v_jour) then
    v_jour := v_jour - 1;
  end if;
  loop
    if exists (select 1 from public.assiduite where user_id = v_user and jour = v_jour and compose) then
      v_serie := v_serie + 1;
    elsif not exists (select 1 from public.pauses_serie where user_id = v_user and jour = v_jour) then
      exit;
    end if;
    v_jour := v_jour - 1;
    exit when v_jour < current_date - 400;
  end loop;');
    execute d;
  end if;
end $do$;

-- ---------- concours visé ----------
create or replace function public.definir_concours(p_concours uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return jsonb_build_object('ok', false); end if;
  if p_concours is not null and not exists (select 1 from public.concours where id = p_concours and actif) then
    return jsonb_build_object('ok', false, 'message', 'Concours inconnu.');
  end if;
  update public.profils set concours_id = p_concours where id = auth.uid();
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.mon_concours()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'choisi', (select jsonb_build_object('id', c.id, 'nom', c.nom, 'sigle', c.sigle, 'date_ecrit', c.date_ecrit, 'type_epreuve', c.type_epreuve)
                 from public.profils p join public.concours c on c.id = p.concours_id where p.id = auth.uid()),
    'liste', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nom', nom, 'sigle', sigle, 'niveau', niveau_requis, 'date_ecrit', date_ecrit) order by nom)
                 from public.concours where actif), '[]'::jsonb));
$$;

-- ---------- questions similaires, plus ratées, notion du jour ----------
create or replace function public.questions_similaires(p_question uuid, p_nombre int default 3)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_q record; v_user uuid := auth.uid();
begin
  if v_user is null then return '[]'::jsonb; end if;
  select matiere_id, chapitre_id, niveau into v_q from public.questions where id = p_question;
  if not found then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', q.id, 'enonce', q.enonce, 'matiere', m.nom, 'contexte', 'revision',
             'etiquette', 'Similaire', 'raison', 'Même notion que la question ratée : on vérifie que tu as compris.',
             'options', (select jsonb_agg(o.texte order by o.position) from public.question_options o where o.question_id = q.id)))
      from (select q.* from public.questions q
             where q.statut = 'publie' and q.id <> p_question and q.matiere_id = v_q.matiere_id
               and (q.niveau = v_q.niveau or q.niveau is null or v_q.niveau is null)
               and not public.question_gardee(q.id)
               and not exists (select 1 from public.tentatives_question t where t.user_id = v_user and t.question_id = q.id
                                and t.cree_le > now() - interval '3 days')
             order by (q.chapitre_id is not distinct from v_q.chapitre_id and v_q.chapitre_id is not null) desc, random()
             limit least(greatest(coalesce(p_nombre, 3), 1), 10)) q
      left join public.matieres m on m.id = q.matiere_id), '[]'::jsonb);
end $$;

create or replace function public.questions_plus_ratees(p_niveau text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_niveau public.niveau_scolaire;
begin
  if auth.uid() is null then return '[]'::jsonb; end if;
  begin v_niveau := nullif(p_niveau, '')::public.niveau_scolaire; exception when others then v_niveau := null; end;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', z.id, 'enonce', z.enonce, 'matiere', z.matiere, 'contexte', 'revision',
             'etiquette', 'Piège', 'raison', z.pct || ' % des candidats se trompent sur cette question.',
             'options', (select jsonb_agg(o.texte order by o.position) from public.question_options o where o.question_id = z.id))
             order by z.pct desc)
      from (
        select q.id, q.enonce, m.nom matiere,
               round(100.0 * count(*) filter (where not t.correcte) / count(*)) pct
          from public.tentatives_question t
          join public.questions q on q.id = t.question_id and q.statut = 'publie'
          left join public.matieres m on m.id = q.matiere_id
         where t.cree_le > now() - interval '30 days'
           and (v_niveau is null or q.niveau = v_niveau or q.niveau is null)
           and not public.question_gardee(q.id)
         group by q.id, q.enonce, m.nom
        having count(*) >= 3
         order by 4 desc, count(*) desc limit 10) z), '[]'::jsonb);
end $$;

create or replace function public.notion_du_jour(p_niveau text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_niveau public.niveau_scolaire; v_r record;
begin
  begin v_niveau := nullif(p_niveau, '')::public.niveau_scolaire; exception when others then v_niveau := null; end;
  select r.id, r.titre, r.texte, r.theme, r.matiere_id, m.nom matiere into v_r
    from public.ressources r left join public.matieres m on m.id = r.matiere_id
   where r.statut = 'publie' and r.texte is not null and length(r.texte) between 300 and 6000
     and (v_niveau is null or r.niveau = v_niveau or r.niveau is null)
   order by md5(r.id::text || current_date::text) limit 1;
  if not found then return null; end if;
  return jsonb_build_object('id', v_r.id, 'titre', v_r.titre, 'theme', v_r.theme, 'matiere', v_r.matiere,
    'texte', left(v_r.texte, 1400), 'coupe', length(v_r.texte) > 1400,
    'questions', coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'enonce', q.enonce, 'matiere', v_r.matiere,
        'contexte', 'revision', 'etiquette', 'Notion du jour', 'raison', 'Application directe de la notion du jour.',
        'options', (select jsonb_agg(o.texte order by o.position) from public.question_options o where o.question_id = q.id)))
      from (select q.* from public.questions q where q.statut = 'publie' and q.matiere_id = v_r.matiere_id
              and (v_niveau is null or q.niveau = v_niveau or q.niveau is null) and not public.question_gardee(q.id)
             order by md5(q.id::text || current_date::text) limit 3) q), '[]'::jsonb));
end $$;

-- ---------- top 10 de la semaine (par pseudo) ----------
create or replace function public.top_semaine()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_debut timestamptz := date_trunc('week', now());
begin
  return (with s as (
      select pj.user_id, sum(pj.points) pts from public.points_journal pj
       where pj.cree_le >= v_debut group by pj.user_id having sum(pj.points) > 0),
    r as (select s.*, p.pseudo, rank() over (order by s.pts desc) rang from s join public.profils p on p.id = s.user_id)
    select jsonb_build_object(
      'depuis', v_debut,
      'top', coalesce((select jsonb_agg(jsonb_build_object('rang', rang, 'pseudo', pseudo, 'points', pts, 'moi', user_id = v_user) order by rang, pseudo)
                         from (select * from r order by rang limit 10) z), '[]'::jsonb),
      'moi', (select jsonb_build_object('rang', rang, 'points', pts, 'pseudo', pseudo) from r where user_id = v_user),
      'participants', (select count(*) from r)));
end $$;

-- ---------- défis entre amis : mêmes 10 questions, 5 minutes ----------
create table if not exists public.defis (
  id uuid primary key default gen_random_uuid(),
  auteur uuid not null,
  matiere_id uuid references public.matieres(id),
  questions uuid[] not null,
  duree_secondes int not null default 300,
  cree_le timestamptz not null default now()
);
alter table public.defis enable row level security;
create table if not exists public.defis_scores (
  defi_id uuid not null references public.defis(id) on delete cascade,
  user_id uuid not null,
  debut_le timestamptz not null default now(),
  score smallint, duree_secondes int, termine boolean not null default false,
  primary key (defi_id, user_id)
);
alter table public.defis_scores enable row level security;

create or replace function public.creer_defi(p_matiere text default null, p_niveau text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_m uuid; v_niveau public.niveau_scolaire; v_q uuid[]; v_id uuid;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'connexion', true, 'message', 'Crée ton compte pour lancer un défi.'); end if;
  if (select count(*) from public.defis where auteur = v_user and cree_le > now() - interval '1 day') >= 20 then
    return jsonb_build_object('ok', false, 'message', 'Vingt défis par jour au plus.'); end if;
  select id into v_m from public.matieres where nom = p_matiere;
  begin v_niveau := nullif(p_niveau, '')::public.niveau_scolaire; exception when others then v_niveau := null; end;
  select array_agg(id) into v_q from (
    select q.id from public.questions q
     where q.statut = 'publie' and (v_m is null or q.matiere_id = v_m)
       and (v_niveau is null or q.niveau = v_niveau or q.niveau is null)
       and (select count(*) from public.question_options o where o.question_id = q.id) >= 2
       and not public.question_gardee(q.id)
     order by random() limit 10) z;
  if coalesce(array_length(v_q, 1), 0) < 5 then
    return jsonb_build_object('ok', false, 'message', 'Pas assez de questions dans cette matière pour un défi.'); end if;
  insert into public.defis (auteur, matiere_id, questions) values (v_user, v_m, v_q) returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.ouvrir_defi(p_defi uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_d record; v_s record; v_restant int;
begin
  select d.*, m.nom matiere, p.pseudo auteur_pseudo into v_d from public.defis d
    left join public.matieres m on m.id = d.matiere_id left join public.profils p on p.id = d.auteur where d.id = p_defi;
  if not found then return jsonb_build_object('ok', false, 'message', 'Défi introuvable.'); end if;
  if v_user is null then
    return jsonb_build_object('ok', false, 'connexion', true, 'matiere', v_d.matiere, 'auteur', v_d.auteur_pseudo,
      'message', 'Crée ton compte gratuit pour relever ce défi.');
  end if;
  select * into v_s from public.defis_scores where defi_id = p_defi and user_id = v_user;
  if found and v_s.termine then
    return jsonb_build_object('ok', true, 'termine', true, 'matiere', v_d.matiere, 'auteur', v_d.auteur_pseudo, 'resultat', public.resultat_defi(p_defi));
  end if;
  if not found then
    insert into public.defis_scores (defi_id, user_id) values (p_defi, v_user) returning * into v_s;
  end if;
  v_restant := greatest(0, v_d.duree_secondes - floor(extract(epoch from now() - v_s.debut_le))::int);
  return jsonb_build_object('ok', true, 'termine', false, 'id', v_d.id, 'matiere', v_d.matiere,
    'auteur', v_d.auteur_pseudo, 'mien', v_d.auteur = v_user, 'duree', v_d.duree_secondes, 'restant', v_restant,
    'questions', (select jsonb_agg(jsonb_build_object('id', q.id, 'enonce', q.enonce,
        'options', (select jsonb_agg(o.texte order by o.position) from public.question_options o where o.question_id = q.id))
        order by array_position(v_d.questions, q.id))
      from public.questions q where q.id = any(v_d.questions)));
end $$;

create or replace function public.resultat_defi(p_defi uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'participants', (select count(*) from public.defis_scores where defi_id = p_defi and termine),
    'classement', coalesce((select jsonb_agg(jsonb_build_object('rang', rang, 'pseudo', pseudo, 'score', score,
        'duree', duree_secondes, 'moi', user_id = auth.uid(), 'auteur', user_id = auteur) order by rang, pseudo)
      from (select s.*, p.pseudo, d.auteur, rank() over (order by s.score desc, s.duree_secondes) rang
              from public.defis_scores s join public.profils p on p.id = s.user_id join public.defis d on d.id = s.defi_id
             where s.defi_id = p_defi and s.termine order by 9 limit 20) z), '[]'::jsonb),
    'sur', (select array_length(questions, 1) from public.defis where id = p_defi));
$$;
revoke all on function public.resultat_defi(uuid) from public, anon, authenticated;

create or replace function public.remettre_defi(p_defi uuid, p_reponses jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_d record; v_s record; v_score int := 0; v_corrige jsonb := '[]'::jsonb;
  i int; v_choix int[]; v_bonnes int[]; v_duree int;
begin
  if v_user is null then return jsonb_build_object('ok', false); end if;
  select * into v_d from public.defis where id = p_defi;
  select * into v_s from public.defis_scores where defi_id = p_defi and user_id = v_user for update;
  if v_d.id is null or v_s.defi_id is null then return jsonb_build_object('ok', false, 'message', 'Défi introuvable.'); end if;
  if v_s.termine then return jsonb_build_object('ok', false, 'message', 'Défi déjà remis.'); end if;
  v_duree := least(v_d.duree_secondes, greatest(0, floor(extract(epoch from now() - v_s.debut_le))::int));
  for i in 1 .. array_length(v_d.questions, 1) loop
    v_bonnes := public.bonnes_reponses(v_d.questions[i]);
    select coalesce(array_agg(distinct (x)::int order by (x)::int), array[]::int[]) into v_choix
      from jsonb_array_elements_text(coalesce(p_reponses -> (i - 1)::text, '[]'::jsonb)) x;
    if array_length(v_bonnes, 1) is not null and v_choix = v_bonnes then v_score := v_score + 1; end if;
    v_corrige := v_corrige || jsonb_build_array(to_jsonb(v_bonnes));
    -- les réponses du défi comptent comme des révisions (cahier d'erreurs, assiduité)
    if array_length(v_choix, 1) is not null then
      insert into public.tentatives_question (user_id, question_id, contexte, choix, correcte)
      values (v_user, v_d.questions[i], 'duel', v_choix::smallint[], array_length(v_bonnes, 1) is not null and v_choix = v_bonnes);
      if not (array_length(v_bonnes, 1) is not null and v_choix = v_bonnes) then
        insert into public.erreurs_utilisateur (user_id, question_id, origine, nb_echecs, revoir_le)
        values (v_user, v_d.questions[i], 'duel', 1, current_date)
        on conflict (user_id, question_id) do update set nb_echecs = erreurs_utilisateur.nb_echecs + 1,
          reussites_consecutives = 0, palier = 0, revoir_le = current_date, acquise = false, derniere_erreur = now(), maj_le = now();
      end if;
    end if;
  end loop;
  update public.defis_scores set score = v_score, duree_secondes = v_duree, termine = true
   where defi_id = p_defi and user_id = v_user;
  insert into public.assiduite (user_id, jour, compose) values (v_user, current_date, true)
  on conflict (user_id, jour) do update set compose = true;
  return jsonb_build_object('ok', true, 'score', v_score, 'sur', array_length(v_d.questions, 1), 'duree', v_duree,
    'corrige', v_corrige, 'resultat', public.resultat_defi(p_defi));
end $$;

-- ---------- les candidats proposent des questions ----------
create table if not exists public.propositions_candidats (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  matiere_id uuid references public.matieres(id),
  niveau public.niveau_scolaire,
  enonce text not null check (char_length(enonce) between 10 and 400),
  options jsonb not null,
  bonne smallint not null check (bonne between 0 and 3),
  explication text check (char_length(explication) <= 600),
  source text check (char_length(source) <= 200),
  statut text not null default 'nouvelle' check (statut in ('nouvelle','publiee','rejetee')),
  question_id uuid,
  cree_le timestamptz not null default now()
);
alter table public.propositions_candidats enable row level security;
create policy "propositions équipe" on public.propositions_candidats
  for all using (securite.est_equipe()) with check (securite.est_equipe());

create or replace function public.proposer_question(p_matiere text, p_niveau text, p_enonce text, p_options text[],
  p_bonne int, p_explication text default null, p_source text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_m uuid; v_niv public.niveau_scolaire; v_opts text[];
begin
  if v_user is null then return jsonb_build_object('ok', false, 'connexion', true, 'message', 'Connecte-toi pour proposer une question.'); end if;
  if (select count(*) from public.propositions_candidats where user_id = v_user and cree_le > now() - interval '1 day') >= 10 then
    return jsonb_build_object('ok', false, 'message', 'Dix propositions par jour au plus. Merci !'); end if;
  select array_agg(left(trim(x), 160)) into v_opts from unnest(p_options) x where length(trim(x)) > 0;
  if coalesce(array_length(v_opts, 1), 0) <> 4 then return jsonb_build_object('ok', false, 'message', 'Il faut exactement quatre propositions.'); end if;
  if length(trim(coalesce(p_enonce, ''))) < 10 then return jsonb_build_object('ok', false, 'message', 'L''énoncé est trop court.'); end if;
  if p_bonne not between 0 and 3 then return jsonb_build_object('ok', false, 'message', 'Indique la bonne réponse.'); end if;
  select id into v_m from public.matieres where nom = p_matiere;
  begin v_niv := nullif(p_niveau, '')::public.niveau_scolaire; exception when others then v_niv := null; end;
  insert into public.propositions_candidats (user_id, matiere_id, niveau, enonce, options, bonne, explication, source)
  values (v_user, v_m, v_niv, left(trim(p_enonce), 400), to_jsonb(v_opts), p_bonne,
          nullif(left(trim(coalesce(p_explication, '')), 600), ''), nullif(left(trim(coalesce(p_source, '')), 200), ''));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.valider_proposition_candidat(p_id bigint, p_publier boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_p record; v_q uuid; i int;
begin
  if not securite.est_equipe() then raise exception 'Réservé à l''équipe'; end if;
  select * into v_p from public.propositions_candidats where id = p_id and statut = 'nouvelle';
  if not found then return jsonb_build_object('ok', false, 'message', 'Déjà traitée.'); end if;
  if not p_publier then
    update public.propositions_candidats set statut = 'rejetee' where id = p_id;
    return jsonb_build_object('ok', true);
  end if;
  insert into public.questions (matiere_id, niveau, enonce, explication, type_question, difficulte, source, statut, publie_le, valide_le, valide_par)
  values (v_p.matiere_id, v_p.niveau, v_p.enonce, v_p.explication, 'qcm', 2, 'contribution', 'publie', now(), now(), auth.uid())
  returning id into v_q;
  for i in 0 .. 3 loop
    insert into public.question_options (question_id, position, texte, est_correcte)
    values (v_q, i, v_p.options ->> i, i = v_p.bonne);
  end loop;
  update public.propositions_candidats set statut = 'publiee', question_id = v_q where id = p_id;
  perform public.creer_notification(v_p.user_id, 'motivation', 'Ta question est publiée',
    'Merci ! La question que tu as proposée fait maintenant partie de la banque de Mon Concours.', 'proposition-' || p_id);
  return jsonb_build_object('ok', true, 'question', v_q);
end $$;

-- ---------- détails de progression (compte, parcours, accueil) ----------
create or replace function public.mes_details()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user uuid := auth.uid(); v_debut timestamptz := date_trunc('week', now()); v_moy numeric; v_pct numeric;
begin
  if v_user is null then return null; end if;
  select avg(score::numeric / nullif(nb_questions, 0)) into v_moy from public.compositions
   where user_id = v_user and terminee and debut_le > now() - interval '30 days';
  if v_moy is not null then
    select round(100.0 * count(*) filter (where m < v_moy) / nullif(count(*), 0)) into v_pct from (
      select avg(score::numeric / nullif(nb_questions, 0)) m from public.compositions
       where terminee and debut_le > now() - interval '30 days' and nb_questions > 0 group by user_id) z;
  end if;
  return jsonb_build_object(
    'premier_jour', (select min(jour) from public.assiduite where user_id = v_user and compose),
    'inscrit_le', (select cree_le from public.profils where id = v_user),
    'minutes_semaine', (select coalesce(round(sum(least(coalesce(temps_ms, 0), 300000)) / 60000.0), 0)
                          from public.tentatives_question where user_id = v_user and cree_le >= v_debut and contexte <> 'composition')
                     + (select coalesce(round(sum(duree_secondes) / 60.0), 0) from public.compositions
                          where user_id = v_user and terminee and debut_le >= v_debut),
    'par_matiere', coalesce((select jsonb_agg(x order by x->>'matiere') from (
        select jsonb_build_object('matiere', m.nom,
          'minutes', round(sum(least(coalesce(t.temps_ms, 0), 300000)) / 60000.0),
          'taux_recent', round(100.0 * count(*) filter (where t.correcte and t.cree_le > now() - interval '30 days')
                               / nullif(count(*) filter (where t.cree_le > now() - interval '30 days'), 0)),
          'n_recent', count(*) filter (where t.cree_le > now() - interval '30 days'),
          'taux_avant', round(100.0 * count(*) filter (where t.correcte and t.cree_le <= now() - interval '30 days')
                               / nullif(count(*) filter (where t.cree_le <= now() - interval '30 days'), 0)),
          'n_avant', count(*) filter (where t.cree_le <= now() - interval '30 days'),
          'erreurs_mois', count(*) filter (where not t.correcte and t.cree_le >= date_trunc('month', now())),
          'erreurs_mois_avant', count(*) filter (where not t.correcte and t.cree_le >= date_trunc('month', now()) - interval '1 month'
                                                   and t.cree_le < date_trunc('month', now()))) x
          from public.tentatives_question t join public.questions q on q.id = t.question_id
          join public.matieres m on m.id = q.matiere_id where t.user_id = v_user group by m.nom) z), '[]'::jsonb),
    'erreurs_mois', (select count(*) from public.tentatives_question where user_id = v_user and not correcte and cree_le >= date_trunc('month', now())),
    'refermees_total', (select count(*) from public.erreurs_utilisateur where user_id = v_user and acquise),
    'pauses_mois', (select count(*) from public.pauses_serie where user_id = v_user and jour >= date_trunc('month', current_date)::date),
    'pause_aujourdhui', exists (select 1 from public.pauses_serie where user_id = v_user and jour = current_date),
    'percentile', v_pct,
    'moyenne_30j', round(100 * v_moy),
    'defis', (select count(*) from public.defis_scores where user_id = v_user and termine),
    'propositions', (select count(*) from public.propositions_candidats where user_id = v_user and statut = 'publiee'));
end $$;

-- ---------- indicateurs (équipe) ----------
create or replace function public.indicateurs_produit()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not securite.est_equipe() then raise exception 'Réservé à l''équipe'; end if;
  return jsonb_build_object(
    'activation', (select jsonb_build_object('inscrits', count(*),
        'actives', count(*) filter (where (select count(*) from public.tentatives_question t where t.user_id = p.id and t.cree_le < p.cree_le + interval '1 day') >= 10
                                     or exists (select 1 from public.compositions c where c.user_id = p.id and c.terminee and c.debut_le < p.cree_le + interval '1 day')))
        from public.profils p where p.cree_le > now() - interval '30 days'),
    'retention', (select jsonb_build_object(
        'j1', round(100.0 * count(*) filter (where p.cree_le < now() - interval '1 day' and exists (select 1 from public.assiduite a where a.user_id = p.id and a.jour = p.cree_le::date + 1)) / nullif(count(*) filter (where p.cree_le < now() - interval '1 day'), 0)),
        'j7', round(100.0 * count(*) filter (where p.cree_le < now() - interval '7 days' and exists (select 1 from public.assiduite a where a.user_id = p.id and a.jour between p.cree_le::date + 1 and p.cree_le::date + 7)) / nullif(count(*) filter (where p.cree_le < now() - interval '7 days'), 0)),
        'j30', round(100.0 * count(*) filter (where p.cree_le < now() - interval '30 days' and exists (select 1 from public.assiduite a where a.user_id = p.id and a.jour between p.cree_le::date + 1 and p.cree_le::date + 30)) / nullif(count(*) filter (where p.cree_le < now() - interval '30 days'), 0)))
        from public.profils p),
    'apprentissage', (select jsonb_build_object('reprises', count(*), 'reussies', count(*) filter (where correcte),
        'taux', round(100.0 * count(*) filter (where correcte) / nullif(count(*), 0)))
        from public.tentatives_question where contexte = 'erreurs' and cree_le > now() - interval '30 days'),
    'compositions', coalesce((select jsonb_agg(jsonb_build_object('semaine', to_char(s, 'DD/MM'), 'n', n, 'moyenne', moy) order by s)
        from (select date_trunc('week', debut_le) s, count(*) n, round(100 * avg(score::numeric / nullif(nb_questions, 0))) moy
                from public.compositions where terminee and debut_le > now() - interval '8 weeks' group by 1) z), '[]'::jsonb),
    'acquisition', (select jsonb_build_object(
        'arrivees_lien', count(distinct session_id) filter (where nom = 'ARRIVED_FROM'),
        'partages', count(*) filter (where nom in ('QUESTION_SHARED','DAILY_QUESTION_SHARED','SHARE','SHARE_OPENED','CHALLENGE_SHARED','PROGRESS_CARD_SHARED')))
        from public.evenements where cree_le > now() - interval '30 days'),
    'sans_explication', (select count(*) from public.questions where statut = 'publie' and (explication is null or length(explication) < 10)),
    'signalements', (select count(*) from public.signalements where statut = 'nouveau'),
    'propositions', (select count(*) from public.propositions_candidats where statut = 'nouvelle'));
end $$;

-- ---------- difficulté ajustée dans le fil ----------
do $do$
declare d text;
begin
  d := pg_get_functiondef('public.fil_pour_toi(text,integer)'::regprocedure);
  if position('niveau_moyen' in d) = 0 then
    d := replace(d, '             + random() * 12 as score',
'             + case when (select niveau_moyen from moy) >= 70 and q.difficulte >= 3 then 10
                    when (select niveau_moyen from moy) < 50 and q.difficulte <= 2 then 10 else 0 end
             + random() * 12 as score');
    d := replace(d, '    vues as (',
'    moy as (
      select coalesce(100.0 * count(*) filter (where correcte) / nullif(count(*), 0), 60) niveau_moyen
        from public.tentatives_question where v_user is not null and user_id = v_user and cree_le > now() - interval ''30 days''
    ),
    vues as (');
    execute d;
  end if;
end $do$;

-- ---------- résumé du dimanche soir dans les envois ----------
do $do$
declare d text;
begin
  d := pg_get_functiondef('public.envois_a_faire()'::regprocedure);
  if position('hebdo-' in d) = 0 then
    d := replace(d, '  return v_res || v_r2;',
'    if extract(isodow from now()) = 7 and v_min between 19 * 60 and 19 * 60 + 20 then
    with cibles as (
      insert into public.envois_push (endpoint, cle)
      select a.endpoint, ''hebdo-'' || to_char(now(), ''IYYY-IW'') from public.push_abonnements a where a.actif
      on conflict do nothing returning endpoint
    )
    select v_r2 || coalesce(jsonb_agg(jsonb_build_object(''endpoint'', a.endpoint, ''p256dh'', a.p256dh, ''auth'', a.auth,
        ''titre'', ''Ta semaine sur Mon Concours'',
        ''message'', (select count(*) from public.tentatives_question t where t.user_id = a.user_id and t.cree_le >= date_trunc(''week'', now()))
                     || '' questions, '' ||
                     (select count(*) from public.assiduite s where s.user_id = a.user_id and s.compose and s.jour >= date_trunc(''week'', now())::date)
                     || '' jours de travail cette semaine. Une nouvelle semaine commence demain.'',
        ''lien'', ''/?depuis=hebdo'')), ''[]''::jsonb)
      into v_r2 from cibles c join public.push_abonnements a on a.endpoint = c.endpoint;
  end if;
  return v_res || v_r2;');
    execute d;
  end if;
end $do$;

-- ---------- droits ----------
revoke all on function public.noter_erreur(uuid, text), public.prendre_pause(), public.definir_concours(uuid), public.mon_concours(),
  public.questions_similaires(uuid, int), public.questions_plus_ratees(text), public.notion_du_jour(text), public.top_semaine(),
  public.creer_defi(text, text), public.ouvrir_defi(uuid), public.remettre_defi(uuid, jsonb),
  public.proposer_question(text, text, text, text[], int, text, text), public.valider_proposition_candidat(bigint, boolean),
  public.mes_details(), public.indicateurs_produit()
  from public, anon, authenticated;
grant execute on function public.noter_erreur(uuid, text), public.prendre_pause(), public.definir_concours(uuid), public.mon_concours(),
  public.questions_similaires(uuid, int), public.questions_plus_ratees(text), public.top_semaine(),
  public.creer_defi(text, text), public.remettre_defi(uuid, jsonb),
  public.proposer_question(text, text, text, text[], int, text, text), public.valider_proposition_candidat(bigint, boolean),
  public.mes_details(), public.indicateurs_produit()
  to authenticated;
grant execute on function public.notion_du_jour(text), public.ouvrir_defi(uuid) to anon, authenticated;

-- activité sur 30 jours (la clé reste jours14 pour ne rien casser)
-- appliqué par remplacement : generate_series(current_date - 29, current_date, ...) dans ma_journee()
