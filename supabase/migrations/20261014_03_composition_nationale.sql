-- =====================================================================
-- 14 octobre 2026 (3) — Composition nationale du samedi 17 h
-- Un concours différent chaque semaine, un nombre de places, des
-- inscriptions, un résultat Admis / Liste d'attente / Échoué.
-- Aussi : lecture des cours suivie (niveau « Prêt »), rappels toutes les
-- heures ou toutes les 4 heures.
-- =====================================================================

-- ---------- concours supplémentaires (niveaux et places modifiables dans l'administration) ----------
insert into public.concours (nom, sigle, niveau_requis, actif, type_epreuve)
select x.nom, x.sigle, x.niv::public.niveau_scolaire, true, 'Concours direct · épreuve écrite'
  from (values ('Éducateur de la petite enfance', 'EDUC-PE', 'terminale'),
               ('Assistant des eaux et forêts', 'EAUX-FORETS', 'terminale'),
               ('Contrôleur du travail', 'CONTROLEUR-TRAVAIL', 'terminale'),
               ('Adjoint administratif', 'ADJ-ADMIN', 'troisieme')) x(nom, sigle, niv)
 where not exists (select 1 from public.concours c where c.sigle = x.sigle or c.nom = x.nom);

-- ---------- l'épreuve connaît son concours et son nombre de places ----------
alter table public.epreuves_collectives add column if not exists concours_id uuid references public.concours(id);
alter table public.epreuves_collectives add column if not exists places int not null default 30 check (places between 1 and 100000);

create table if not exists public.inscriptions_epreuve (
  epreuve_id uuid not null references public.epreuves_collectives(id) on delete cascade,
  user_id uuid not null,
  afficher_nom boolean not null default true,
  cree_le timestamptz not null default now(),
  primary key (epreuve_id, user_id)
);
alter table public.inscriptions_epreuve enable row level security;

create or replace function public.inscrire_epreuve(p_epreuve uuid, p_afficher_nom boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'connexion', true, 'message', 'Crée ton compte pour t''inscrire.'); end if;
  if not exists (select 1 from public.epreuves_collectives where id = p_epreuve and statut = 'programmee' and fin_le > now()) then
    return jsonb_build_object('ok', false, 'message', 'Cette composition est terminée.'); end if;
  insert into public.inscriptions_epreuve (epreuve_id, user_id, afficher_nom)
  values (p_epreuve, auth.uid(), coalesce(p_afficher_nom, true))
  on conflict (epreuve_id, user_id) do update set afficher_nom = excluded.afficher_nom;
  return jsonb_build_object('ok', true, 'inscrits', (select count(*) from public.inscriptions_epreuve where epreuve_id = p_epreuve));
end $$;

-- rejoindre inscrit automatiquement (le nom s'affiche, sauf refus déjà enregistré)
do $do$
declare d text;
begin
  d := pg_get_functiondef('public.rejoindre_epreuve(uuid)'::regprocedure);
  if position('inscriptions_epreuve' in d) = 0 then
    d := replace(d, '  select * into v_sujet from public.sujets where id = v_ep.sujet_id;',
'  insert into public.inscriptions_epreuve (epreuve_id, user_id) values (v_ep.id, v_user) on conflict do nothing;
  select * into v_sujet from public.sujets where id = v_ep.sujet_id;');
    execute d;
  end if;
end $do$;

-- nom affiché dans les résultats : le nom si le candidat l'accepte, sinon le pseudo
create or replace function public.nom_resultat(p_user uuid, p_epreuve uuid)
returns text language sql stable security definer set search_path = public as $$
  select case when coalesce((select afficher_nom from public.inscriptions_epreuve where epreuve_id = p_epreuve and user_id = p_user), true)
              then coalesce(nullif(trim(p.nom), ''), p.pseudo) else p.pseudo end
    from public.profils p where p.id = p_user;
$$;
revoke all on function public.nom_resultat(uuid, uuid) from public, anon, authenticated;

-- ---------- la composition du moment ----------
create or replace function public.epreuve_du_moment()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_ep record; v_moi jsonb; v_inscrit boolean := false; v_conc text;
begin
  select * into v_ep from public.epreuves_collectives
   where statut = 'programmee' and fin_le > now()
   order by debut_le limit 1;
  if not found then
    select * into v_ep from public.epreuves_collectives
     where statut = 'programmee' and fin_le <= now() and fin_le > now() - interval '7 days'
     order by fin_le desc limit 1;
  end if;
  if not found then return null; end if;
  select nom into v_conc from public.concours where id = v_ep.concours_id;
  if auth.uid() is not null then
    select jsonb_build_object('composition', id, 'terminee', terminee,
             'score', case when now() >= v_ep.fin_le or terminee then score end, 'sur', nb_questions)
      into v_moi from public.compositions where user_id = auth.uid() and epreuve_id = v_ep.id;
    v_inscrit := exists (select 1 from public.inscriptions_epreuve where epreuve_id = v_ep.id and user_id = auth.uid());
  end if;
  return jsonb_build_object('id', v_ep.id, 'titre', v_ep.titre, 'concours', v_conc, 'places', v_ep.places,
    'debut_le', v_ep.debut_le, 'fin_le', v_ep.fin_le,
    'recompense', v_ep.recompense, 'message', v_ep.message,
    'etat', case when now() < v_ep.debut_le then 'a_venir' when now() < v_ep.fin_le then 'en_cours' else 'terminee' end,
    'inscrit', v_inscrit,
    'inscrits', (select count(*) from public.inscriptions_epreuve where epreuve_id = v_ep.id),
    'participants', (select count(*) from public.compositions where epreuve_id = v_ep.id),
    'composent', (select count(*) from public.compositions where epreuve_id = v_ep.id and not terminee),
    'nb_questions', (select count(*) from public.sujet_questions where sujet_id = v_ep.sujet_id),
    'duree', extract(epoch from (v_ep.fin_le - v_ep.debut_le))::int,
    'moi', v_moi);
end $$;

-- ---------- les résultats : Admis, Liste d'attente, Échoué ----------
create or replace function public.classement_epreuve(p_epreuve uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_ep record; v_user uuid := auth.uid(); v_res jsonb; v_moi jsonb; v_total int; v_moy numeric; v_conc text;
begin
  select * into v_ep from public.epreuves_collectives where id = p_epreuve and statut = 'programmee';
  if not found then return jsonb_build_object('ok', false, 'message', 'Composition introuvable.'); end if;
  if now() < v_ep.fin_le then
    return jsonb_build_object('ok', true, 'termine', false, 'fin_le', v_ep.fin_le,
      'participants', (select count(*) from public.compositions where epreuve_id = v_ep.id));
  end if;
  select nom into v_conc from public.concours where id = v_ep.concours_id;

  with r as (
    select c.id, c.user_id, c.score, c.nb_questions, c.duree_secondes,
           public.nom_resultat(c.user_id, v_ep.id) nom,
           rank() over (order by c.score desc, c.duree_secondes asc nulls last) rang
      from public.compositions c
     where c.epreuve_id = v_ep.id and c.terminee
  )
  select jsonb_agg(jsonb_build_object('rang', rang, 'nom', nom, 'pseudo', nom, 'score', score, 'sur', nb_questions,
           'duree', duree_secondes, 'composition', id, 'moi', user_id = v_user,
           'statut', case when rang <= v_ep.places then 'admis' when rang <= 2 * v_ep.places then 'attente' else 'echoue' end,
           'reactions', (select coalesce(jsonb_object_agg(type, n), '{}'::jsonb) from (
               select re.type, count(*) n from public.reactions_epreuve re where re.composition_id = t.id group by re.type) z),
           'mes_reactions', (select coalesce(jsonb_agg(re.type), '[]'::jsonb) from public.reactions_epreuve re
                              where re.composition_id = t.id and re.auteur = v_user))
         order by rang, nom)
    into v_res from (select * from r where rang <= 2 * v_ep.places order by rang limit 400) t;

  select jsonb_build_object('rang', rang, 'nom', nom, 'score', score, 'sur', nb_questions, 'duree', duree_secondes,
           'statut', case when rang <= v_ep.places then 'admis' when rang <= 2 * v_ep.places then 'attente' else 'echoue' end)
    into v_moi from (
      select c.user_id, c.score, c.nb_questions, c.duree_secondes, public.nom_resultat(c.user_id, v_ep.id) nom,
             rank() over (order by c.score desc, c.duree_secondes asc nulls last) rang
        from public.compositions c where c.epreuve_id = v_ep.id and c.terminee) z
   where v_user is not null and z.user_id = v_user;

  select count(*), round(avg(score)::numeric, 1) into v_total, v_moy
    from public.compositions where epreuve_id = v_ep.id and terminee;

  return jsonb_build_object('ok', true, 'termine', true, 'titre', v_ep.titre, 'concours', v_conc, 'places', v_ep.places,
    'debut_le', v_ep.debut_le, 'recompense', v_ep.recompense, 'message', v_ep.message,
    'participants', v_total, 'moyenne', v_moy,
    'admis', least(v_total, v_ep.places), 'attente', greatest(0, least(v_total, 2 * v_ep.places) - v_ep.places),
    'echoues', greatest(0, v_total - 2 * v_ep.places),
    'sur', (select count(*) from public.sujet_questions where sujet_id = v_ep.sujet_id),
    'classement', coalesce(v_res, '[]'::jsonb), 'moi', v_moi);
end $$;

-- ---------- programmer (équipe) : concours et nombre de places ----------
create or replace function public.programmer_nationale(p_titre text, p_sujet uuid, p_debut timestamptz,
  p_recompense text, p_message text, p_concours uuid, p_places int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_s record; v_id uuid;
begin
  if not securite.est_equipe() then raise exception 'Réservé à l''équipe'; end if;
  select * into v_s from public.sujets where id = p_sujet;
  if not found then return jsonb_build_object('ok', false, 'message', 'Sujet introuvable.'); end if;
  if not exists (select 1 from public.sujet_questions where sujet_id = p_sujet) then
    return jsonb_build_object('ok', false, 'message', 'Ce sujet n''a pas de questions.'); end if;
  if p_debut < now() then return jsonb_build_object('ok', false, 'message', 'La date est déjà passée.'); end if;
  if length(trim(coalesce(p_titre, ''))) < 3 then return jsonb_build_object('ok', false, 'message', 'Donnez un titre.'); end if;

  insert into public.epreuves_collectives (titre, sujet_id, debut_le, fin_le, recompense, message, cree_par, concours_id, places)
  values (trim(p_titre), p_sujet, p_debut, p_debut + make_interval(secs => coalesce(v_s.duree_secondes, 1500)),
          nullif(trim(coalesce(p_recompense, '')), ''), nullif(trim(coalesce(p_message, '')), ''), auth.uid(),
          p_concours, greatest(1, coalesce(p_places, 30)))
  returning id into v_id;
  perform public.annoncer_epreuve(v_id);
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.annoncer_epreuve(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_ep record; v_quand text;
begin
  select * into v_ep from public.epreuves_collectives where id = p_id;
  v_quand := to_char(v_ep.debut_le at time zone 'UTC', 'DD/MM à HH24"h"MI');
  insert into public.notifications (user_id, type, titre, message, cle_unicite)
  select p.id, 'rappel', v_ep.titre,
         'Composition nationale le ' || v_quand || ' : même sujet, même durée pour tous. ' || v_ep.places
         || ' places, classement et liste des admis à la fin. Inscris-toi depuis l''application.',
         'epreuve-' || p_id::text
    from public.profils p
  on conflict do nothing;
end $$;
revoke all on function public.annoncer_epreuve(uuid) from public, anon, authenticated;

-- ---------- chaque samedi 17 h : la composition nationale se programme toute seule ----------
create or replace function public.planifier_composition_nationale()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_samedi timestamptz; v_c record; v_s record; v_id uuid;
begin
  -- prochain samedi 17 h, heure de Ouagadougou (UTC)
  v_samedi := (date_trunc('week', now() at time zone 'UTC') + interval '5 days 17 hours') at time zone 'UTC';
  if v_samedi <= now() then v_samedi := v_samedi + interval '7 days'; end if;
  if exists (select 1 from public.epreuves_collectives where statut = 'programmee'
              and debut_le >= v_samedi - interval '12 hours' and debut_le < v_samedi + interval '12 hours') then
    return jsonb_build_object('ok', true, 'deja', true);
  end if;
  -- le concours le moins récemment utilisé
  select c.* into v_c from public.concours c where c.actif
   order by (select max(e.debut_le) from public.epreuves_collectives e where e.concours_id = c.id) asc nulls first, random()
   limit 1;
  if not found then return jsonb_build_object('ok', false, 'message', 'Aucun concours actif.'); end if;
  -- un sujet du bon niveau, jamais utilisé en composition nationale, le moins composé
  select s.* into v_s from public.sujets s
   where s.statut = 'publie' and exists (select 1 from public.sujet_questions q where q.sujet_id = s.id)
   order by (s.niveau = v_c.niveau_requis) desc nulls last,
            exists (select 1 from public.epreuves_collectives e where e.sujet_id = s.id),
            (select count(*) from public.compositions c where c.sujet_id = s.id), random()
   limit 1;
  if not found then return jsonb_build_object('ok', false, 'message', 'Aucun sujet publié.'); end if;
  insert into public.epreuves_collectives (titre, sujet_id, debut_le, fin_le, concours_id, places, message)
  values ('Composition nationale · ' || v_c.nom, v_s.id, v_samedi,
          v_samedi + make_interval(secs => coalesce(v_s.duree_secondes, 1500)), v_c.id, coalesce(v_c.nb_places, 30),
          'Félicitations à tous les admis. Rendez-vous samedi prochain à 17 h.')
  returning id into v_id;
  perform public.annoncer_epreuve(v_id);
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;
revoke all on function public.planifier_composition_nationale() from public, anon, authenticated;

-- ---------- lecture des cours (pour le niveau « Prêt pour le concours ») ----------
create table if not exists public.lectures (
  user_id uuid not null, ressource_id uuid not null references public.ressources(id) on delete cascade,
  lu_le timestamptz not null default now(), primary key (user_id, ressource_id)
);
alter table public.lectures enable row level security;

create or replace function public.marquer_lu(p_ressources uuid[])
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return jsonb_build_object('ok', false); end if;
  insert into public.lectures (user_id, ressource_id)
  select auth.uid(), r.id from public.ressources r where r.id = any(p_ressources[1:50]) and r.statut = 'publie'
  on conflict do nothing;
  return jsonb_build_object('ok', true);
end $$;

-- mes_details : questions de QCM (hors compositions) et cours lus
do $do$
declare d text;
begin
  d := pg_get_functiondef('public.mes_details()'::regprocedure);
  if position('cours_lus' in d) = 0 then
    d := replace(d, '''defis'', (select count(*) from public.defis_scores where user_id = v_user and termine),',
'''defis'', (select count(*) from public.defis_scores where user_id = v_user and termine),
    ''qcm_revision'', (select count(*) from public.tentatives_question where user_id = v_user and contexte <> ''composition''),
    ''cours_total'', (select count(*) from public.ressources r where r.statut = ''publie'' and r.texte is not null
                        and (r.niveau is null or r.niveau = (select niveau from public.profils where id = v_user))),
    ''cours_lus'', (select count(*) from public.lectures l join public.ressources r on r.id = l.ressource_id
                      where l.user_id = v_user and r.statut = ''publie'' and r.texte is not null
                        and (r.niveau is null or r.niveau = (select niveau from public.profils where id = v_user))),');
    execute d;
  end if;
end $do$;

-- ---------- rappels : une heure fixe, ou toutes les 1, 4, 6, 12 heures (de 6 h à 21 h) ----------
alter table public.push_abonnements add column if not exists frequence text not null default 'quotidien'
  check (frequence in ('quotidien', 'heure', '4h', '6h', '12h'));
alter table public.push_abonnements add column if not exists dernier_envoi timestamptz;

create or replace function public.enregistrer_rappel_freq(p_endpoint text, p_p256dh text, p_auth text, p_heure int,
  p_minute int, p_frequence text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'connexion', true); end if;
  if p_endpoint !~ '^https://' or length(p_endpoint) > 1000 then return jsonb_build_object('ok', false); end if;
  if p_heure not between 0 and 23 or p_minute not in (0, 15, 30, 45) then return jsonb_build_object('ok', false); end if;
  if coalesce(p_frequence, 'quotidien') not in ('quotidien', 'heure', '4h', '6h', '12h') then return jsonb_build_object('ok', false); end if;
  insert into public.push_abonnements (endpoint, user_id, p256dh, auth, heure, minute, actif, frequence)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth, p_heure, p_minute, true, coalesce(p_frequence, 'quotidien'))
  on conflict (endpoint) do update set user_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth,
    heure = excluded.heure, minute = excluded.minute, actif = true, frequence = excluded.frequence;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.mon_rappel()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select jsonb_build_object('heure', heure, 'minute', minute, 'actif', actif, 'frequence', frequence)
                     from public.push_abonnements where user_id = auth.uid() and actif
                     order by cree_le desc limit 1), 'null'::jsonb);
$$;

-- envois : les rappels fréquents (6 h - 21 h seulement, jamais la nuit)
do $do$
declare d text;
begin
  d := pg_get_functiondef('public.envois_a_faire()'::regprocedure);
  if position('frequence' in d) = 0 then
    d := replace(d, '     where a.actif and (a.dernier_rappel is null or a.dernier_rappel < current_date)
       and v_min - (a.heure * 60 + a.minute) between 0 and 20',
'     where a.actif and (
             (a.frequence = ''quotidien'' and (a.dernier_rappel is null or a.dernier_rappel < current_date)
              and v_min - (a.heure * 60 + a.minute) between 0 and 20)
          or (a.frequence = ''heure'' and v_min between 6 * 60 and 21 * 60 + 20
              and (a.dernier_envoi is null or a.dernier_envoi < now() - interval ''55 minutes''))
          or (((a.frequence = ''4h'' and (v_min / 60) in (8, 12, 16, 20))
               or (a.frequence = ''6h'' and (v_min / 60) in (8, 14, 20))
               or (a.frequence = ''12h'' and (v_min / 60) in (8, 20)))
              and v_min % 60 <= 20
              and (a.dernier_envoi is null or a.dernier_envoi < now() - interval ''3 hours'')))');
    d := replace(d, '    update public.push_abonnements a set dernier_rappel = current_date
      from dus',
'    update public.push_abonnements a set dernier_rappel = current_date, dernier_envoi = now()
      from dus');
    execute d;
  end if;
end $do$;

-- ---------- droits ----------
revoke all on function public.inscrire_epreuve(uuid, boolean), public.marquer_lu(uuid[]),
  public.programmer_nationale(text, uuid, timestamptz, text, text, uuid, int),
  public.enregistrer_rappel_freq(text, text, text, int, int, text) from public, anon, authenticated;
grant execute on function public.inscrire_epreuve(uuid, boolean), public.marquer_lu(uuid[]),
  public.programmer_nationale(text, uuid, timestamptz, text, text, uuid, int),
  public.enregistrer_rappel_freq(text, text, text, int, int, text) to authenticated;

-- ---------- planification automatique : tous les jours à 6 h, et maintenant ----------
select cron.schedule('composition-nationale', '0 6 * * *', $cron$ select public.planifier_composition_nationale(); $cron$);
select public.planifier_composition_nationale();

-- liste des cours lus par le candidat (affichage « lus » dans Révisions)
create or replace function public.mes_lectures()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(ressource_id), '[]'::jsonb) from public.lectures where user_id = auth.uid();
$$;
revoke all on function public.mes_lectures() from public, anon, authenticated;
grant execute on function public.mes_lectures() to authenticated;

create policy "equipe lit les inscriptions" on public.inscriptions_epreuve for select to authenticated using (securite.est_equipe());
