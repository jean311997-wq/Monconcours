-- Ce qui fait revenir le candidat :
--   1. un message après une absence (J+3 puis J+7, un seul chaque fois),
--   2. ses chances d'admission et ses jours de travail (badges),
--   3. un pack de questions pour réviser sans réseau, renvoyé au retour.

-- 1. Relances après une absence -------------------------------------------
create or replace function public.relances_absence()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare v_n int := 0; r record; v_lundi timestamptz := date_trunc('week', now());
  v_moi int; v_depasses int; v_erreurs int; v_titre text; v_msg text;
begin
  for r in
    with dernier as (
      select p.id user_id, p.pseudo,
             greatest(p.cree_le::date,
               coalesce((select max(a.jour) from public.assiduite a where a.user_id = p.id), '-infinity'::date),
               coalesce((select max(c.debut_le)::date from public.compositions c where c.user_id = p.id), '-infinity'::date)) jour
        from public.profils p
    )
    select * from dernier where current_date - jour in (3, 7)
  loop
    -- le chiffre personnel : ceux qui l'ont dépassé cette semaine, sinon ses erreurs
    select coalesce(sum(points), 0) into v_moi from public.points_journal
     where user_id = r.user_id and cree_le >= v_lundi;
    select count(*) into v_depasses from (
      select pj.user_id,
             sum(pj.points) filter (where pj.cree_le < r.jour + 1) avant, sum(pj.points) apres
        from public.points_journal pj
       where pj.cree_le >= v_lundi and pj.user_id <> r.user_id
       group by pj.user_id) z
     where coalesce(z.avant, 0) <= v_moi and z.apres > v_moi;
    select count(*) into v_erreurs from public.erreurs_utilisateur
     where user_id = r.user_id and not acquise and revoir_le <= current_date;

    if current_date - r.jour = 3 then
      v_titre := 'Vos révisions vous attendent';
    else
      v_titre := 'Une semaine sans réviser';
    end if;
    if v_depasses > 0 then
      v_msg := v_depasses || ' candidat' || case when v_depasses > 1 then 's vous ont' else ' vous a' end
               || ' dépassé au classement de la semaine depuis votre dernière visite. Dix minutes suffisent pour reprendre des places.';
    elsif v_erreurs > 0 then
      v_msg := v_erreurs || ' de vos erreurs ' || case when v_erreurs > 1 then 'sont prêtes' else 'est prête' end
               || ' à être revue' || case when v_erreurs > 1 then 's' else '' end || '. Dix minutes suffisent.';
    else
      v_msg := 'La question du jour et votre série vous attendent. Dix minutes suffisent pour reprendre le rythme.';
    end if;

    perform public.notifier(r.user_id, 'motivation', v_titre, v_msg,
      'absence' || (current_date - r.jour) || '-' || to_char(r.jour, 'YYYYMMDD'), null, true);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
revoke all on function public.relances_absence() from public, anon, authenticated;

do $$ begin
  if exists (select 1 from cron.job where jobname = 'relances-absence') then
    perform cron.unschedule('relances-absence');
  end if;
  -- 17 h à Ouagadougou (UTC)
  perform cron.schedule('relances-absence', '0 17 * * *', 'select public.relances_absence();');
end $$;

-- 2. Élan : jours de travail et chances d'admission ------------------------
create or replace function public.mon_elan()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_user uuid := auth.uid(); v_n int; v_moy numeric; v_ep record; v_sur int;
  v_part int; v_rang int; v_statut text; v_conc text;
begin
  if v_user is null then return null; end if;

  select count(*), avg(score::numeric / nb_questions) into v_n, v_moy from (
    select score, nb_questions from public.compositions
     where user_id = v_user and terminee and nb_questions >= 10 and score is not null
     order by debut_le desc limit 5) z;

  if v_n > 0 then
    -- la dernière composition nationale terminée, celle du concours visé d'abord
    select ec.* into v_ep from public.epreuves_collectives ec
     where ec.statut = 'programmee' and ec.fin_le < now() and coalesce(ec.places, 0) > 0
       and exists (select 1 from public.compositions c where c.epreuve_id = ec.id and c.terminee)
     order by (ec.concours_id is not distinct from (select concours_id from public.profils where id = v_user)) desc,
              ec.fin_le desc
     limit 1;
    if found then
      select max(nb_questions), count(*) into v_sur, v_part
        from public.compositions where epreuve_id = v_ep.id and terminee;
      select 1 + count(*) into v_rang from public.compositions
       where epreuve_id = v_ep.id and terminee and nb_questions > 0
         and score::numeric / nb_questions > v_moy;
      v_statut := case when v_rang <= v_ep.places then 'admis'
                       when v_rang <= 2 * v_ep.places then 'attente' else 'echoue' end;
      select nom into v_conc from public.concours where id = v_ep.concours_id;
    end if;
  end if;

  return jsonb_build_object(
    'jours_actifs', (select count(*) from public.assiduite where user_id = v_user),
    'chances', case when v_n > 0 then jsonb_build_object(
        'compositions', v_n,
        'pourcentage', round(100 * v_moy),
        'sur', coalesce(v_sur, 50),
        'note', round(v_moy * coalesce(v_sur, 50)),
        'rang', v_rang, 'participants', v_part, 'places', v_ep.places,
        'statut', v_statut, 'concours', coalesce(v_conc, v_ep.titre),
        'date', v_ep.debut_le) end);
end $$;
revoke all on function public.mon_elan() from public, anon;
grant execute on function public.mon_elan() to authenticated;

-- 3. Pack hors ligne ---------------------------------------------------------
create table if not exists public.packs_hors_ligne (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  cree_le timestamptz not null default now(),
  nombre int not null
);
alter table public.packs_hors_ligne enable row level security;
revoke all on public.packs_hors_ligne from anon, authenticated;
create index if not exists packs_hors_ligne_user on public.packs_hors_ligne (user_id, cree_le);

-- Les corrigés partent avec le pack (sans réseau, il faut corriger sur le
-- téléphone) : jamais ceux des compositions à venir, et 3 packs par jour au plus.
create or replace function public.pack_hors_ligne(p_niveau text, p_matieres text[], p_nombre int default 50)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_user uuid := auth.uid(); v_niveau public.niveau_scolaire; v_ids uuid[]; v_res jsonb; v_nb int;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'connexion', true); end if;
  if (select count(*) from public.packs_hors_ligne where user_id = v_user and cree_le > now() - interval '1 day') >= 3 then
    return jsonb_build_object('ok', false, 'message', 'Trois packs par jour au plus. Révisez celui-ci, un nouveau sera possible demain.');
  end if;
  begin v_niveau := nullif(p_niveau, '')::public.niveau_scolaire; exception when others then v_niveau := null; end;
  select array_agg(id) into v_ids from public.matieres
   where coalesce(array_length(p_matieres, 1), 0) > 0 and nom = any(p_matieres);
  v_nb := least(greatest(coalesce(p_nombre, 50), 10), 50);

  select jsonb_agg(x) into v_res from (
    select jsonb_build_object('id', q.id, 'enonce', q.enonce, 'matiere', m.nom, 'explication', q.explication,
             'options', (select jsonb_agg(o.texte order by o.position) from public.question_options o where o.question_id = q.id),
             'bonnes', to_jsonb(public.bonnes_reponses(q.id))) x
      from public.questions q left join public.matieres m on m.id = q.matiere_id
     where q.statut = 'publie'
       and (v_ids is null or q.matiere_id = any(v_ids))
       and (v_niveau is null or q.niveau = v_niveau or q.niveau is null)
       and public.matiere_du_niveau(q.matiere_id, v_niveau)
       and (select count(*) from public.question_options o where o.question_id = q.id) >= 2
       and not public.question_gardee(q.id)
       and not exists (select 1 from public.epreuves_collectives ec join public.sujet_questions sq on sq.sujet_id = ec.sujet_id
                        where sq.question_id = q.id and ec.statut = 'programmee' and ec.fin_le > now())
     order by random() limit v_nb) z;

  if v_res is null or jsonb_array_length(v_res) < 5 then
    return jsonb_build_object('ok', false, 'message', 'Pas assez de questions pour ce choix. Prenez « Toutes les matières ».');
  end if;
  insert into public.packs_hors_ligne (user_id, nombre) values (v_user, jsonb_array_length(v_res));
  return jsonb_build_object('ok', true, 'questions', v_res, 'cree_le', now());
end $$;
revoke all on function public.pack_hors_ligne(text, text[], int) from public, anon;
grant execute on function public.pack_hors_ligne(text, text[], int) to authenticated;

-- Au retour du réseau : les réponses faites hors ligne sont recorrigées par
-- le serveur (rien n'est cru sur parole) et comptent comme des révisions.
create or replace function public.remettre_hors_ligne(p_reponses jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_user uuid := auth.uid(); v_r jsonb; v_ok int := 0; v_res jsonb; v_choix int[];
begin
  if v_user is null then return jsonb_build_object('ok', false, 'connexion', true); end if;
  if jsonb_typeof(p_reponses) <> 'array' then return jsonb_build_object('ok', false); end if;
  for v_r in select value from jsonb_array_elements(p_reponses) limit 150 loop
    begin
      select coalesce(array_agg(c::int), '{}') into v_choix from jsonb_array_elements_text(coalesce(v_r->'choix', '[]')) c;
      v_res := public.corriger_question((v_r->>'q')::uuid, v_choix, 'revision',
                 least(greatest(coalesce((v_r->>'t')::int, 0), 0), 300000), null);
      if coalesce((v_res->>'ok')::boolean, false) then v_ok := v_ok + 1; end if;
    exception when others then null;
    end;
  end loop;
  return jsonb_build_object('ok', true, 'enregistrees', v_ok);
end $$;
revoke all on function public.remettre_hors_ligne(jsonb) from public, anon;
grant execute on function public.remettre_hors_ligne(jsonb) to authenticated;
