-- Administration · lot 2 : analytique sur période libre, rétention en calendrier, entonnoir de paiement,
-- fiche complète d'un candidat, recherche, historique des actions, suivi des compositions, bilan.

create or replace function public.tel_visible(t text)
 returns text language sql stable security definer set search_path to 'public' as $$
  select case when t is null then null when securite.est_equipe() then t else left(t, 2) || ' •• •• ' || right(t, 2) end;
$$;

create or replace function public.analytique_totaux(d1 date, d2 date)
 returns jsonb language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select jsonb_build_object(
    'inscrits',   (select count(*) from public.profils where cree_le::date between d1 and d2),
    'actifs',     (select count(distinct user_id) from public.sessions where debut_le::date between d1 and d2 and user_id is not null),
    'sessions',   (select count(*) from public.sessions where debut_le::date between d1 and d2),
    'minutes',    (select round(coalesce(sum(duree_active_s), 0) / 60.0) from public.sessions where debut_le::date between d1 and d2),
    'questions',  (select count(*) from public.tentatives_question where cree_le::date between d1 and d2),
    'bonnes',     (select count(*) from public.tentatives_question where cree_le::date between d1 and d2 and correcte),
    'compositions', (select count(*) from public.compositions where debut_le::date between d1 and d2),
    'terminees',  (select count(*) from public.compositions where debut_le::date between d1 and d2 and terminee),
    'paiements',  (select count(*) from public.paiements where statut = 'confirme' and montant_fcfa > 0 and coalesce(regle_le, cree_le)::date between d1 and d2),
    'montant',    (select coalesce(sum(montant_fcfa), 0) from public.paiements where statut = 'confirme' and coalesce(regle_le, cree_le)::date between d1 and d2),
    'demandes',   (select count(*) from public.paiements where cree_le::date between d1 and d2 and operateur not in ('code', 'admin')),
    'nouveaux_abonnes', (select count(distinct user_id) from public.abonnements where formule <> 'essai' and cree_le::date between d1 and d2),
    'partages',   (select count(*) from public.evenements where cree_le::date between d1 and d2 and nom in ('SHARE', 'CHALLENGE_SHARED', 'QUESTION_SHARED', 'DAILY_QUESTION_SHARED', 'RESULT_CARD_SHARED', 'PROGRESS_CARD_SHARED', 'PROXY_PAY_SHARED'))
  );
$$;

create or replace function public.analytique(p_du date, p_au date)
 returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
declare v_du date; v_au date; v_n int; v_pdu date; v_pau date;
begin
  if not securite.est_lecteur() then raise exception 'Réservé à l''équipe'; end if;
  v_au := least(coalesce(p_au, current_date), current_date);
  v_du := least(coalesce(p_du, v_au - 29), v_au);
  if v_au - v_du > 370 then v_du := v_au - 370; end if;
  v_n := v_au - v_du + 1; v_pau := v_du - 1; v_pdu := v_pau - (v_n - 1);
  return jsonb_build_object(
    'du', v_du, 'au', v_au, 'jours', v_n,
    'tot', public.analytique_totaux(v_du, v_au),
    'prec', public.analytique_totaux(v_pdu, v_pau),
    'avant', (select count(*) from public.profils where cree_le::date < v_du),
    'serie', (
      with j as (select d::date as jour from generate_series(v_du, v_au, interval '1 day') d),
      ins as (select cree_le::date jour, count(*) n from public.profils where cree_le::date between v_du and v_au group by 1),
      ses as (select debut_le::date jour, count(distinct user_id) act, count(*) vis, round(coalesce(sum(duree_active_s), 0) / 60.0) mn
                from public.sessions where debut_le::date between v_du and v_au group by 1),
      que as (select cree_le::date jour, count(*) n, count(*) filter (where correcte) b from public.tentatives_question where cree_le::date between v_du and v_au group by 1),
      cmp as (select debut_le::date jour, count(*) n, count(*) filter (where terminee) t from public.compositions where debut_le::date between v_du and v_au group by 1),
      pai as (select coalesce(regle_le, cree_le)::date jour, count(*) filter (where montant_fcfa > 0) n, coalesce(sum(montant_fcfa), 0) m
                from public.paiements where statut = 'confirme' and coalesce(regle_le, cree_le)::date between v_du and v_au group by 1)
      select coalesce(jsonb_agg(jsonb_build_object(
        'jour', j.jour, 'inscrits', coalesce(ins.n, 0), 'actifs', coalesce(ses.act, 0), 'visites', coalesce(ses.vis, 0), 'minutes', coalesce(ses.mn, 0),
        'questions', coalesce(que.n, 0), 'bonnes', coalesce(que.b, 0), 'compositions', coalesce(cmp.n, 0), 'terminees', coalesce(cmp.t, 0),
        'paiements', coalesce(pai.n, 0), 'montant', coalesce(pai.m, 0)) order by j.jour), '[]'::jsonb)
        from j left join ins using (jour) left join ses using (jour) left join que using (jour) left join cmp using (jour) left join pai using (jour)),
    'heures', (select coalesce(jsonb_agg(jsonb_build_object('h', g.h, 'n', (select count(*) from public.sessions s where s.debut_le::date between v_du and v_au and extract(hour from s.debut_le) = g.h)) order by g.h), '[]'::jsonb)
                 from generate_series(0, 23) g(h)),
    'semaine', (select coalesce(jsonb_agg(jsonb_build_object('j', g.j, 'n', (select count(*) from public.sessions s where s.debut_le::date between v_du and v_au and extract(isodow from s.debut_le) = g.j)) order by g.j), '[]'::jsonb)
                 from generate_series(1, 7) g(j)),
    'sources', (select coalesce(jsonb_agg(x order by (x ->> 'n')::int desc), '[]'::jsonb) from (
                 select jsonb_build_object('nom', q.nom, 'n', q.n) x from (select coalesce(nullif(source, ''), 'direct') nom, count(*) n from public.sessions
                  where debut_le::date between v_du and v_au group by 1 order by count(*) desc limit 8) q) t),
    'systemes', (select coalesce(jsonb_agg(x order by (x ->> 'n')::int desc), '[]'::jsonb) from (
                 select jsonb_build_object('nom', q.nom, 'n', q.n) x from (select coalesce(nullif(systeme, ''), 'inconnu') nom, count(*) n from public.sessions
                  where debut_le::date between v_du and v_au group by 1 order by count(*) desc limit 6) q) t),
    'niveaux', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
                 select jsonb_build_object('nom', q.nom, 'n', q.n) x from (select coalesce(niveau::text, 'non indiqué') nom, count(*) n from public.profils
                  where cree_le::date between v_du and v_au group by 1 order by count(*) desc) q) t),
    'matieres', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
                 select jsonb_build_object('nom', m.nom, 'reponses', count(*), 'taux', round(100.0 * count(*) filter (where t.correcte) / count(*))) x
                   from public.tentatives_question t join public.questions q on q.id = t.question_id join public.matieres m on m.id = q.matiere_id
                  where t.cree_le::date between v_du and v_au group by m.nom order by count(*) desc limit 10) z)
  );
end $$;

create or replace function public.retention_cohortes(p_du date, p_au date)
 returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
declare v_au date; v_du date;
begin
  if not securite.est_lecteur() then raise exception 'Réservé à l''équipe'; end if;
  v_au := least(coalesce(p_au, current_date), current_date);
  v_du := least(coalesce(p_du, v_au - 29), v_au);
  if v_au - v_du > 120 then v_du := v_au - 120; end if;
  return coalesce((
    with coh as (select id, cree_le::date jour from public.profils where cree_le::date between v_du and v_au),
    ks as (select unnest(array[1, 2, 3, 4, 5, 6, 7, 14, 21, 30]) k),
    ret as (
      select c.jour, k.k, count(*) filter (where exists (select 1 from public.sessions s where s.user_id = c.id and s.debut_le::date = c.jour + k.k)) r
        from coh c cross join ks k group by c.jour, k.k)
    select jsonb_agg(jsonb_build_object(
        'jour', d.jour, 'n', d.n,
        'j', (select jsonb_object_agg(r2.k::text, case when d.jour + r2.k <= current_date then r2.r end) from ret r2 where r2.jour = d.jour)
      ) order by d.jour desc)
    from (select jour, count(*) n from coh group by jour) d
  ), '[]'::jsonb);
end $$;

create or replace function public.entonnoir_paiement(p_du date, p_au date)
 returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
declare v_au date; v_du date; res jsonb;
begin
  if not securite.est_lecteur() then raise exception 'Réservé à l''équipe'; end if;
  v_au := least(coalesce(p_au, current_date), current_date);
  v_du := least(coalesce(p_du, v_au - 29), v_au);
  with ev as (
    select coalesce(user_id::text, 'S' || session_id::text) cle, user_id, cree_le,
           case when nom in ('SUBSCRIPTION_PAGE_VIEWED', 'PAYWALL_VIEWED', 'PARCOURS_D_PAYWALL_SHOWN') then 1
                when nom in ('SUBSCRIPTION_PLAN_SELECTED', 'PAYWALL_CLICKED', 'PARCOURS_D_PAYWALL_CLICKED') then 2
                when nom = 'PAYMENT_STARTED' then 3
                when nom = 'PAYMENT_DECLARED' then 4
                when nom in ('PAYMENT_PROOF_SENT', 'PAYMENT_SENT') then 5
                when nom = 'PAYMENT_ABANDONED' then 0 end etape,
           nom, meta
      from public.evenements
     where cree_le::date between v_du and v_au
       and nom in ('SUBSCRIPTION_PAGE_VIEWED', 'PAYWALL_VIEWED', 'PARCOURS_D_PAYWALL_SHOWN', 'SUBSCRIPTION_PLAN_SELECTED', 'PAYWALL_CLICKED',
                   'PARCOURS_D_PAYWALL_CLICKED', 'PAYMENT_STARTED', 'PAYMENT_DECLARED', 'PAYMENT_PROOF_SENT', 'PAYMENT_SENT', 'PAYMENT_ABANDONED')
  ), pers as (
    select cle, (array_agg(user_id) filter (where user_id is not null))[1] user_id,
           coalesce(max(etape), 0) etape, max(cree_le) derniere,
           bool_or(nom = 'PAYMENT_ABANDONED') abandon,
           (array_agg(meta ->> 'formule' order by cree_le desc) filter (where meta ? 'formule'))[1] formule
      from ev group by cle
  ), pa as (
    select user_id, max(case statut when 'confirme' then 7 else 6 end) etape, max(cree_le) derniere,
           (array_agg(statut order by cree_le desc))[1] statut, (array_agg(formule order by cree_le desc))[1] formule
      from public.paiements where cree_le::date between v_du and v_au and operateur not in ('code', 'admin') group by user_id
  ), tous as (
    select coalesce(p.user_id::text, p.cle) cle, p.user_id,
           greatest(p.etape, coalesce(a.etape, 0)) etape, greatest(p.derniere, coalesce(a.derniere, p.derniere)) derniere,
           p.abandon, coalesce(a.formule, p.formule) formule, a.statut
      from pers p left join pa a on a.user_id = p.user_id
    union all
    select a.user_id::text, a.user_id, a.etape, a.derniere, false, a.formule, a.statut
      from pa a where not exists (select 1 from pers p where p.user_id = a.user_id)
  ), libelles as (
    select * from (values (1, 'A vu la page abonnement'), (2, 'A choisi une formule'), (3, 'A commencé le paiement'),
                          (4, 'A déclaré avoir payé'), (5, 'A envoyé la preuve'), (6, 'Demande reçue par l''équipe'), (7, 'Paiement confirmé')) v(etape, libelle)
  )
  select jsonb_build_object(
    'du', v_du, 'au', v_au,
    'etapes', (select jsonb_agg(jsonb_build_object('etape', l.etape, 'libelle', l.libelle,
                  'atteint', (select count(*) from tous t where t.etape >= l.etape),
                  'arret', (select count(*) from tous t where t.etape = l.etape)) order by l.etape) from libelles l),
    'sans_etape', (select count(*) from tous where etape = 0),
    'abandons', (select count(*) from tous where abandon),
    'personnes', (select coalesce(jsonb_agg(jsonb_build_object(
          'user_id', x.user_id, 'nom', pr.nom, 'telephone', public.tel_visible(pr.telephone), 'etape', x.etape,
          'libelle', (select libelle from libelles where etape = x.etape), 'derniere', x.derniere,
          'formule', x.formule, 'statut', x.statut, 'abandon', x.abandon) order by x.etape desc, x.derniere desc), '[]'::jsonb)
        from (select * from tous where user_id is not null order by etape desc, derniere desc limit 250) x
        left join public.profils pr on pr.id = x.user_id)
  ) into res;
  return res;
end $$;

create or replace function public.fiche_candidat(p_user uuid)
 returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
declare r jsonb;
begin
  if not securite.est_lecteur() then raise exception 'Réservé à l''équipe'; end if;
  select jsonb_build_object(
    'profil', (select jsonb_build_object('id', p.id, 'nom', p.nom, 'pseudo', p.pseudo, 'telephone', public.tel_visible(p.telephone),
                'niveau', p.niveau, 'ville', p.ville, 'concours', (select c.nom from public.concours c where c.id = p.concours_id), 'cree_le', p.cree_le)
                 from public.profils p where p.id = p_user),
    'abonnements', (select coalesce(jsonb_agg(jsonb_build_object('formule', formule, 'debut_le', debut_le, 'fin_le', fin_le,
                'actif', (fin_le > now() and annule_le is null)) order by fin_le desc), '[]'::jsonb) from public.abonnements where user_id = p_user),
    'paiements', (select coalesce(jsonb_agg(jsonb_build_object('montant', montant_fcfa, 'statut', statut, 'formule', formule, 'operateur', operateur,
                'cree_le', cree_le, 'regle_le', regle_le, 'motif', motif_refus) order by cree_le desc), '[]'::jsonb) from public.paiements where user_id = p_user),
    'sessions', (select jsonb_build_object('n', count(*), 'premiere', min(debut_le), 'derniere', max(debut_le),
                'minutes', round(coalesce(sum(duree_active_s), 0) / 60.0),
                'appareil', (array_agg(appareil order by debut_le desc))[1], 'systeme', (array_agg(systeme order by debut_le desc))[1])
                 from public.sessions where user_id = p_user),
    'zones', (select coalesce(jsonb_agg(z), '[]'::jsonb) from (
                select jsonb_build_object('ecran', e.meta ->> 'ecran',
                         'minutes', round(sum(least(coalesce((e.meta ->> 'duree_ms')::numeric, 0), 1800000)) / 60000.0, 1), 'visites', count(*)) z
                  from public.evenements e where e.user_id = p_user and e.nom = 'SCREEN_LEFT' and e.meta ? 'ecran'
                 group by e.meta ->> 'ecran' order by sum(least(coalesce((e.meta ->> 'duree_ms')::numeric, 0), 1800000)) desc limit 12) t),
    'actions', (select coalesce(jsonb_agg(z), '[]'::jsonb) from (
                select jsonb_build_object('nom', nom, 'n', count(*)) z from public.evenements
                 where user_id = p_user and nom not in ('SCREEN_VIEWED', 'SCREEN_LEFT', 'BUTTON_CLICKED', 'SCROLL_DEPTH_REACHED', 'APP_BACKGROUND', 'APP_FOREGROUND',
                                                        'SESSION_STARTED', 'SESSION_ENDED', 'USER_RETURNED', 'USER_FIRST_VISIT', 'APP_ENTERED', 'PARCOURS_ASSIGNE')
                 group by nom order by count(*) desc limit 12) t),
    'questions', (select jsonb_build_object('n', count(*), 'bonnes', count(*) filter (where correcte)) from public.tentatives_question where user_id = p_user),
    'matieres', (select coalesce(jsonb_agg(z), '[]'::jsonb) from (
                select jsonb_build_object('nom', m.nom, 'n', count(*), 'taux', round(100.0 * count(*) filter (where t.correcte) / count(*))) z
                  from public.tentatives_question t join public.questions q on q.id = t.question_id join public.matieres m on m.id = q.matiere_id
                 where t.user_id = p_user group by m.nom order by count(*) desc limit 8) t),
    'compositions', (select jsonb_build_object('n', count(*), 'terminees', count(*) filter (where terminee),
                'moyenne', round(avg(score * 100.0 / nullif(nb_questions, 0)) filter (where terminee))) from public.compositions where user_id = p_user),
    'dernieres_compositions', (select coalesce(jsonb_agg(z), '[]'::jsonb) from (
                select jsonb_build_object('debut_le', debut_le, 'score', score, 'nb', nb_questions, 'terminee', terminee, 'traitees', nb_traitees, 'epreuve', epreuve_id is not null) z
                  from public.compositions where user_id = p_user order by debut_le desc limit 6) t),
    'erreurs_ouvertes', (select count(*) from public.erreurs_utilisateur where user_id = p_user and not acquise),
    'push', (select jsonb_build_object('actif', coalesce(bool_or(actif), false), 'appareils', count(*)) from public.push_abonnements where user_id = p_user),
    'notifications', (select jsonb_build_object('recues', count(*), 'non_lues', count(*) filter (where not lue)) from public.notifications where user_id = p_user),
    'avis', (select coalesce(jsonb_agg(jsonb_build_object('message', message, 'reponse', reponse, 'cree_le', cree_le) order by cree_le desc), '[]'::jsonb)
               from (select * from public.avis where user_id = p_user order by cree_le desc limit 3) a),
    'jours_actifs', (select count(*) from public.assiduite where user_id = p_user),
    'banni', exists (select 1 from public.bannissements b where b.user_id = p_user and b.leve_le is null and (b.jusqu_au is null or b.jusqu_au > now())),
    'code_demande', exists (select 1 from public.demandes_code where user_id = p_user and expire_le > now()),
    'dernieres', (select coalesce(jsonb_agg(jsonb_build_object('quand', cree_le, 'nom', nom, 'ecran', ecran, 'element', element) order by cree_le desc), '[]'::jsonb)
                    from (select * from public.evenements where user_id = p_user
                           and nom not in ('SCREEN_VIEWED', 'SCREEN_LEFT', 'BUTTON_CLICKED', 'SCROLL_DEPTH_REACHED', 'APP_BACKGROUND', 'APP_FOREGROUND')
                           order by cree_le desc limit 30) e)
  ) into r;
  return r;
end $$;

create or replace function public.chercher_candidats(p_q text)
 returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
declare v_q text := btrim(coalesce(p_q, '')); v_d text := regexp_replace(coalesce(p_q, ''), '\D', '', 'g');
begin
  if not securite.est_lecteur() then raise exception 'Réservé à l''équipe'; end if;
  if char_length(v_q) < 2 then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', p.id, 'nom', p.nom, 'pseudo', p.pseudo, 'telephone', public.tel_visible(p.telephone), 'niveau', p.niveau, 'cree_le', p.cree_le,
      'derniere', (select max(s.debut_le) from public.sessions s where s.user_id = p.id),
      'formule', (select a.formule from public.abonnements a where a.user_id = p.id and a.fin_le > now() and a.annule_le is null order by a.fin_le desc limit 1)
    ) order by p.cree_le desc)
    from (select * from public.profils
           where nom ilike '%' || replace(replace(v_q, '%', ''), '_', '') || '%'
              or pseudo ilike '%' || replace(replace(v_q, '%', ''), '_', '') || '%'
              or (char_length(v_d) >= 3 and telephone like '%' || v_d || '%')
           order by cree_le desc limit 40) p), '[]'::jsonb);
end $$;

create or replace function public.historique_actions(p_du timestamptz, p_au timestamptz, p_user uuid default null,
                                                      p_filtre text default 'important', p_limite integer default 60, p_offset integer default 0)
 returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
declare v_total bigint; v_liste jsonb;
begin
  if not securite.est_lecteur() then raise exception 'Réservé à l''équipe'; end if;
  with base as (
    select * from public.evenements e
     where e.cree_le >= coalesce(p_du, now() - interval '7 days') and e.cree_le < coalesce(p_au, now() + interval '1 minute')
       and (p_user is null or e.user_id = p_user)
       and case coalesce(p_filtre, 'important')
             when 'tout' then true
             when 'paiement' then e.nom ilike '%PAY%' or e.nom ilike '%SUBSCRIPTION%' or e.nom = 'CODE_REDEEMED'
             when 'compte' then e.nom in ('ACCOUNT_CREATED', 'ACCOUNT_DELETED', 'APP_ENTERED', 'LEVEL_CHANGED', 'TARGET_EXAM_SET', 'REMINDER_ENABLED')
             when 'composition' then e.nom in ('COMPOSITION_SUBMITTED', 'COMPOSITION_COMPLETED', 'COMPOSITION_QUIT', 'COMPOSITION_RESTARTED', 'NATIONAL_REGISTERED', 'NATIONAL_DECLINED')
             else e.nom not in ('SCREEN_VIEWED', 'SCREEN_LEFT', 'BUTTON_CLICKED', 'SCROLL_DEPTH_REACHED', 'APP_BACKGROUND', 'APP_FOREGROUND',
                                'SESSION_STARTED', 'SESSION_ENDED', 'USER_RETURNED', 'USER_FIRST_VISIT', 'PARCOURS_ASSIGNE',
                                'COMPOSITION_ANSWER_SELECTED', 'DIAGNOSTIC_ANSWER_SELECTED', 'FEED_ANSWERED', 'QUESTION_ANSWERED') end
  )
  select (select count(*) from base),
         coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'quand', b.cree_le, 'nom', b.nom, 'ecran', b.ecran, 'element', b.element,
                     'user_id', b.user_id, 'personne', p.nom, 'telephone', public.tel_visible(p.telephone)) order by b.cree_le desc)
                     from (select * from base order by cree_le desc offset greatest(coalesce(p_offset, 0), 0) limit least(greatest(coalesce(p_limite, 60), 1), 200)) b
                     left join public.profils p on p.id = b.user_id), '[]'::jsonb)
    into v_total, v_liste;
  return jsonb_build_object('total', v_total, 'liste', v_liste);
end $$;

create or replace function public.detail_evenement(p_type text, p_valeur text, p_du date, p_au date)
 returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
declare v_au date := least(coalesce(p_au, current_date), current_date); v_du date := least(coalesce(p_du, current_date - 29), least(coalesce(p_au, current_date), current_date));
begin
  if not securite.est_lecteur() then raise exception 'Réservé à l''équipe'; end if;
  if p_type = 'zone' then
    return coalesce((select jsonb_agg(jsonb_build_object('user_id', x.user_id, 'nom', pr.nom, 'telephone', public.tel_visible(pr.telephone),
              'minutes', x.minutes, 'visites', x.visites, 'derniere', x.derniere) order by x.minutes desc)
      from (select e.user_id, round(sum(least(coalesce((e.meta ->> 'duree_ms')::numeric, 0), 1800000)) / 60000.0, 1) minutes, count(*) visites, max(e.cree_le) derniere
              from public.evenements e
             where e.nom = 'SCREEN_LEFT' and e.meta ->> 'ecran' = p_valeur and e.cree_le::date between v_du and v_au and e.user_id is not null
             group by e.user_id order by sum(least(coalesce((e.meta ->> 'duree_ms')::numeric, 0), 1800000)) desc limit 80) x
      left join public.profils pr on pr.id = x.user_id), '[]'::jsonb);
  else
    return coalesce((select jsonb_agg(jsonb_build_object('user_id', x.user_id, 'nom', pr.nom, 'telephone', public.tel_visible(pr.telephone),
              'visites', x.n, 'minutes', null, 'derniere', x.derniere) order by x.n desc)
      from (select e.user_id, count(*) n, max(e.cree_le) derniere from public.evenements e
             where e.nom = p_valeur and e.cree_le::date between v_du and v_au and e.user_id is not null
             group by e.user_id order by count(*) desc limit 80) x
      left join public.profils pr on pr.id = x.user_id), '[]'::jsonb);
  end if;
end $$;

create or replace function public.compositions_suivi()
 returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
begin
  if not securite.est_lecteur() then raise exception 'Réservé à l''équipe'; end if;
  return jsonb_build_object(
    'aujourdhui', (select jsonb_build_object('commencees', count(*), 'terminees', count(*) filter (where terminee),
                     'moyenne', round(avg(score * 100.0 / nullif(nb_questions, 0)) filter (where terminee)))
                     from public.compositions where debut_le::date = current_date),
    'en_cours', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'user_id', c.user_id, 'nom', p.nom, 'telephone', public.tel_visible(p.telephone),
                     'debut_le', c.debut_le, 'traitees', c.nb_traitees, 'nb', c.nb_questions, 'sujet', s.reference,
                     'epreuve', (select e.titre from public.epreuves_collectives e where e.id = c.epreuve_id)) order by c.debut_le desc)
                  from public.compositions c left join public.profils p on p.id = c.user_id left join public.sujets s on s.id = c.sujet_id
                 where not c.terminee and c.debut_le >= now() - interval '2 hours'), '[]'::jsonb),
    'recentes', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'user_id', c.user_id, 'nom', p.nom, 'telephone', public.tel_visible(p.telephone),
                     'debut_le', c.debut_le, 'terminee', c.terminee, 'score', c.score, 'nb', c.nb_questions, 'traitees', c.nb_traitees,
                     'duree', c.duree_secondes, 'sujet', s.reference, 'nationale', c.epreuve_id is not null) order by c.debut_le desc)
                  from (select * from public.compositions order by debut_le desc limit 60) c
                  left join public.profils p on p.id = c.user_id left join public.sujets s on s.id = c.sujet_id), '[]'::jsonb),
    'epreuves', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'titre', e.titre, 'debut_le', e.debut_le, 'fin_le', e.fin_le, 'statut', e.statut,
                     'inscrits', (select count(*) from public.inscriptions_epreuve i where i.epreuve_id = e.id),
                     'participants', (select count(distinct c.user_id) from public.compositions c where c.epreuve_id = e.id),
                     'terminees', (select count(distinct c.user_id) from public.compositions c where c.epreuve_id = e.id and c.terminee),
                     'moyenne', (select round(avg(c.score * 100.0 / nullif(c.nb_questions, 0))) from public.compositions c where c.epreuve_id = e.id and c.terminee)) order by e.debut_le desc)
                  from (select * from public.epreuves_collectives order by debut_le desc limit 8) e), '[]'::jsonb),
    'inscrits_sans_retour', (select count(distinct i.user_id) from public.inscriptions_epreuve i join public.epreuves_collectives e on e.id = i.epreuve_id
                              where e.fin_le < now() and not exists (select 1 from public.compositions c where c.epreuve_id = e.id and c.user_id = i.user_id)
                                and not exists (select 1 from public.sessions s where s.user_id = i.user_id and s.debut_le > e.fin_le))
  );
end $$;

create or replace function public.epreuve_participants(p_epreuve uuid)
 returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
begin
  if not securite.est_lecteur() then raise exception 'Réservé à l''équipe'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('user_id', i.user_id, 'nom', p.nom, 'telephone', public.tel_visible(p.telephone), 'inscrit_le', i.cree_le,
            'a_compose', c.id is not null, 'terminee', coalesce(c.terminee, false), 'score', c.score, 'nb', c.nb_questions, 'traitees', c.nb_traitees, 'duree', c.duree_secondes)
            order by c.terminee desc nulls last, c.score desc nulls last, i.cree_le)
          from public.inscriptions_epreuve i
          left join public.profils p on p.id = i.user_id
          left join lateral (select * from public.compositions x where x.epreuve_id = i.epreuve_id and x.user_id = i.user_id order by x.debut_le desc limit 1) c on true
         where i.epreuve_id = p_epreuve), '[]'::jsonb);
end $$;

create or replace function public.bilan_metriques(p_du date, p_au date)
 returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
declare v_au date; v_du date;
begin
  if not securite.est_lecteur() then raise exception 'Réservé à l''équipe'; end if;
  v_au := least(coalesce(p_au, current_date), current_date);
  v_du := least(coalesce(p_du, v_au - 6), v_au);
  return jsonb_build_object(
    'du', v_du, 'au', v_au, 'jours', v_au - v_du + 1,
    'profils', (select count(*) from public.profils),
    'inscrits', (select count(*) from public.profils where cree_le::date between v_du and v_au),
    'actifs', (select count(distinct user_id) from public.sessions where debut_le::date between v_du and v_au and user_id is not null),
    'activation', (select round(100.0 * count(*) filter (where (select count(*) from public.tentatives_question t where t.user_id = p.id) >= 10) / nullif(count(*), 0))
                     from public.profils p where p.cree_le::date between v_du and v_au),
    'j1', (select round(100.0 * count(*) filter (where exists (select 1 from public.sessions s where s.user_id = p.id and s.debut_le::date = p.cree_le::date + 1)) / nullif(count(*), 0))
             from public.profils p where p.cree_le::date between v_du and least(v_au, current_date - 1)),
    'payants_actifs', (select count(distinct user_id) from public.abonnements where fin_le > now() and annule_le is null and formule <> 'essai'),
    'essais_actifs', (select count(distinct a.user_id) from public.abonnements a where a.fin_le > now() and a.annule_le is null and a.formule = 'essai'
                        and not exists (select 1 from public.abonnements b where b.user_id = a.user_id and b.fin_le > now() and b.annule_le is null and b.formule <> 'essai')),
    'essais_fin_3j', (select count(distinct a.user_id) from public.abonnements a where a.formule = 'essai' and a.annule_le is null and a.fin_le between now() and now() + interval '3 days'
                        and not exists (select 1 from public.abonnements b where b.user_id = a.user_id and b.fin_le > now() and b.annule_le is null and b.formule <> 'essai')),
    'push_actifs', (select count(distinct user_id) from public.push_abonnements where actif),
    'paie_demandes', (select count(*) from public.paiements where cree_le::date between v_du and v_au and operateur not in ('code', 'admin')),
    'paie_confirmes', (select count(*) from public.paiements where statut = 'confirme' and montant_fcfa > 0 and coalesce(regle_le, cree_le)::date between v_du and v_au),
    'paie_montant', (select coalesce(sum(montant_fcfa), 0) from public.paiements where statut = 'confirme' and coalesce(regle_le, cree_le)::date between v_du and v_au),
    'paie_attente', (select count(*) from public.paiements where statut = 'en_attente'),
    'paie_refuses', (select count(*) from public.paiements where statut = 'refuse' and cree_le::date between v_du and v_au),
    'paywall_vus', (select count(distinct coalesce(user_id::text, session_id::text)) from public.evenements where cree_le::date between v_du and v_au and nom in ('PAYWALL_VIEWED', 'SUBSCRIPTION_PAGE_VIEWED')),
    'paiement_commence', (select count(distinct coalesce(user_id::text, session_id::text)) from public.evenements where cree_le::date between v_du and v_au and nom = 'PAYMENT_STARTED'),
    'zones', coalesce((select jsonb_agg(z) from (
                select jsonb_build_object('ecran', e.meta ->> 'ecran', 'minutes', round(sum(least(coalesce((e.meta ->> 'duree_ms')::numeric, 0), 1800000)) / 60000.0),
                         'moyenne_s', round(avg(least(coalesce((e.meta ->> 'duree_ms')::numeric, 0), 1800000)) / 1000.0), 'visites', count(*)) z
                  from public.evenements e where e.nom = 'SCREEN_LEFT' and e.meta ? 'ecran' and e.cree_le::date between v_du and v_au
                 group by e.meta ->> 'ecran' order by sum(least(coalesce((e.meta ->> 'duree_ms')::numeric, 0), 1800000)) desc limit 6) t), '[]'::jsonb),
    'heure_pic', (select extract(hour from debut_le)::int from public.sessions where debut_le::date between v_du and v_au group by 1 order by count(*) desc limit 1),
    'avis_nouveaux', (select count(*) from public.avis where statut = 'nouveau'),
    'signalements', (select count(*) from public.signalements where statut = 'nouveau'),
    'depots', (select count(*) from public.depots where statut = 'a_ranger'),
    'compo_commencees', (select count(*) from public.compositions where debut_le::date between v_du and v_au),
    'compo_terminees', (select count(*) from public.compositions where debut_le::date between v_du and v_au and terminee),
    'questions', (select count(*) from public.tentatives_question where cree_le::date between v_du and v_au),
    'bonnes', (select count(*) from public.tentatives_question where cree_le::date between v_du and v_au and correcte),
    'sans_explication', (select count(*) from public.questions where statut = 'publie' and (explication is null or btrim(explication) = '')),
    'publiees', (select count(*) from public.questions where statut = 'publie'),
    'partages', (select count(*) from public.evenements where cree_le::date between v_du and v_au and nom in ('SHARE', 'CHALLENGE_SHARED', 'QUESTION_SHARED', 'DAILY_QUESTION_SHARED', 'RESULT_CARD_SHARED', 'PROGRESS_CARD_SHARED')),
    'arrivees_lien', (select count(*) from public.evenements where cree_le::date between v_du and v_au and nom = 'ARRIVED_FROM'),
    'defis', (select count(*) from public.evenements where cree_le::date between v_du and v_au and nom = 'CHALLENGE_CREATED'),
    'nationale', (select jsonb_build_object('titre', e.titre,
                     'inscrits', (select count(*) from public.inscriptions_epreuve i where i.epreuve_id = e.id),
                     'participants', (select count(distinct c.user_id) from public.compositions c where c.epreuve_id = e.id))
                   from public.epreuves_collectives e where e.fin_le < now() order by e.debut_le desc limit 1),
    'sans_retour_j7', (select count(*) from public.profils p where p.cree_le::date between v_du and v_au and p.cree_le < now() - interval '3 days'
                         and not exists (select 1 from public.sessions s where s.user_id = p.id and s.debut_le::date > p.cree_le::date))
  );
end $$;

revoke all on function public.tel_visible(text) from public, anon;
revoke all on function public.analytique_totaux(date, date) from public, anon, authenticated;
revoke all on function public.analytique(date, date) from public, anon;
revoke all on function public.retention_cohortes(date, date) from public, anon;
revoke all on function public.entonnoir_paiement(date, date) from public, anon;
revoke all on function public.fiche_candidat(uuid) from public, anon;
revoke all on function public.chercher_candidats(text) from public, anon;
revoke all on function public.historique_actions(timestamptz, timestamptz, uuid, text, integer, integer) from public, anon;
revoke all on function public.detail_evenement(text, text, date, date) from public, anon;
revoke all on function public.compositions_suivi() from public, anon;
revoke all on function public.epreuve_participants(uuid) from public, anon;
revoke all on function public.bilan_metriques(date, date) from public, anon;
grant execute on function public.tel_visible(text) to authenticated;
grant execute on function public.analytique(date, date) to authenticated;
grant execute on function public.retention_cohortes(date, date) to authenticated;
grant execute on function public.entonnoir_paiement(date, date) to authenticated;
grant execute on function public.fiche_candidat(uuid) to authenticated;
grant execute on function public.chercher_candidats(text) to authenticated;
grant execute on function public.historique_actions(timestamptz, timestamptz, uuid, text, integer, integer) to authenticated;
grant execute on function public.detail_evenement(text, text, date, date) to authenticated;
grant execute on function public.compositions_suivi() to authenticated;
grant execute on function public.epreuve_participants(uuid) to authenticated;
grant execute on function public.bilan_metriques(date, date) to authenticated;
