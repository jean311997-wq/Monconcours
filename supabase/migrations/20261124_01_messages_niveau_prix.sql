-- 24 novembre 2026 — décisions de Kantagba :
-- 1. message de félicitations aux candidats actifs ; 2. message « Mon Concours t'aide… » à tous et aux nouveaux ;
-- 3. carte de niveau plein écran : les 3 matins qui suivent l'inscription et chaque dimanche matin ;
-- 4. fin de l'offre de lancement −50 % le 30 novembre, prix réels le 1er décembre (Mois 2 000 F, Année 8 000 F).
-- Tout passe par public.notifier (une seule notification par personne et par clé, jamais de doublon).

/* ---------- 1 et 2 : le message d'équipe, une fois par personne ---------- */
create or replace function public.message_mission(p_nouveaux boolean default false)
 returns int language plpgsql security definer set search_path to 'public'
as $f$
declare v_n int := 0; r record;
begin
  for r in
    select p.id user_id,
           (select count(distinct (t.cree_le at time zone 'UTC')::date) from tentatives_question t
             where t.user_id = p.id and t.cree_le > now() - interval '7 days')::int jours7
      from profils p
     where p.id not in (select user_id from roles_utilisateur where role::text in ('admin','correcteur','investisseur'))
       and (not p_nouveaux or p.cree_le > now() - interval '2 days')
       and not exists (select 1 from notifications x where x.user_id = p.id and x.cle_unicite = 'mission-mc')
  loop
    if r.jours7 > 0 and not p_nouveaux then
      perform public.notifier(r.user_id, 'annonce_plein', 'Bravo, tu tiens le rythme',
        'Tu t''es entraîné ' || r.jours7 || case when r.jours7 > 1 then ' jours' else ' jour' end || ' sur 7 cette semaine. '
        || 'C''est comme ça qu''on réussit un concours : un peu chaque jour. '
        || 'Mon Concours t''aide à identifier tes lacunes, à t''entraîner en conditions réelles et à progresser jusqu''au jour du concours. Courage, continue !',
        'mission-mc', 'accueil', true);
    else
      perform public.notifier(r.user_id, 'annonce_plein', 'Mon Concours, jusqu''au jour du concours',
        'Mon Concours t''aide à identifier tes lacunes, à t''entraîner en conditions réelles et à progresser jusqu''au jour du concours. '
        || 'Quelques questions ou une composition aujourd''hui, et tu verras où tu en es.',
        'mission-mc', 'accueil', not p_nouveaux);
    end if;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $f$;
revoke all on function public.message_mission(boolean) from public, anon, authenticated;

/* ---------- 3 : la carte de niveau ---------- */
create or replace function public.niveau_cartes(p_mode text)
 returns int language plpgsql security definer set search_path to 'public'
as $f$
declare v_n int := 0; r record; v_taux int; v_niv text; v_phrase text; v_msg text; v_titre text;
begin
  if p_mode not in ('debut', 'dimanche') then return 0; end if;
  v_titre := case when p_mode = 'debut' then 'Ton niveau du jour' else 'Ton niveau de la semaine' end;
  for r in
    with cible as (
      select p.id user_id
        from profils p
       where p.id not in (select user_id from roles_utilisateur where role::text in ('admin','correcteur','investisseur'))
         and case when p_mode = 'debut'
                  then (p.cree_le at time zone 'UTC')::date between current_date - 3 and current_date - 1
                  else exists (select 1 from tentatives_question t where t.user_id = p.id and t.cree_le > now() - interval '14 days') end
    ),
    t as (
      select t.user_id, t.correcte, q.matiere_id, t.cree_le
        from tentatives_question t join cible c using (user_id) join questions q on q.id = t.question_id
       where t.cree_le > now() - interval '30 days'
    ),
    g as (
      select user_id, count(*) n, count(*) filter (where correcte) ok,
             count(distinct (cree_le at time zone 'UTC')::date) filter (where cree_le > now() - interval '7 days') jours7
        from t group by 1
    ),
    m as (
      select user_id, matiere_id, count(*) n, round(100.0 * count(*) filter (where correcte) / count(*))::int taux
        from t where matiere_id is not null group by 1, 2 having count(*) >= 5
    ),
    fo as (select distinct on (user_id) user_id, matiere_id, taux from m order by user_id, taux desc, n desc),
    fa as (select distinct on (user_id) user_id, matiere_id, taux from m order by user_id, taux asc, n desc)
    select c.user_id, coalesce(g.n, 0) n, coalesce(g.ok, 0) ok, coalesce(g.jours7, 0) jours7,
           (select nom from matieres where id = fo.matiere_id) mat_fort, fo.taux taux_fort,
           (select nom from matieres where id = fa.matiere_id) mat_faible, fa.taux taux_faible
      from cible c left join g using (user_id) left join fo using (user_id) left join fa using (user_id)
  loop
    v_taux := case when r.n > 0 then round(100.0 * r.ok / r.n)::int end;
    if r.n < 10 then
      v_niv := 'À découvrir';
      v_phrase := 'Réponds à 10 questions aujourd''hui : ta prochaine carte affichera ton vrai niveau.';
    elsif v_taux < 40 then
      v_niv := 'Débutant';
      v_phrase := 'Chaque erreur corrigée te rapproche du concours. Commence par ta matière la plus faible.';
    elsif v_taux < 55 then
      v_niv := 'En construction';
      v_phrase := 'Tu poses les bases. Quelques séances régulières et tu passes au niveau supérieur.';
    elsif v_taux < 70 then
      v_niv := 'En progression';
      v_phrase := 'Tu es sur la bonne voie. Garde le rythme et vise 70 % de bonnes réponses.';
    else
      v_niv := 'Solide';
      v_phrase := 'Tu as un bon niveau. Les compositions en conditions réelles feront la différence.';
    end if;
    v_msg := 'Message|' || v_phrase || E'\n' || 'Ton niveau|' || v_niv
      || case when r.n >= 10 then E'\nBonnes réponses|' || v_taux || ' %' else E'\nQuestions faites|' || r.n end
      || case when p_mode = 'dimanche' then E'\nJours travaillés|' || r.jours7 || ' sur 7' else '' end
      || case when r.mat_fort is not null and r.mat_fort is distinct from r.mat_faible then E'\nPoint fort|' || r.mat_fort || ' (' || r.taux_fort || ' %)' else '' end
      || case when r.mat_faible is not null then E'\nÀ travailler|' || r.mat_faible || ' (' || r.taux_faible || ' %)' else '' end;
    perform public.notifier(r.user_id, 'annonce_plein', v_titre, v_msg,
      'niveau-' || p_mode || '-' || current_date::text, 'bilan:niveau', true);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $f$;
revoke all on function public.niveau_cartes(text) from public, anon, authenticated;

/* ---------- 4 : fin de l'offre de lancement et prix réels ---------- */
create or replace function public.annoncer_prix(p_etape text)
 returns int language plpgsql security definer set search_path to 'public'
as $f$
declare v_n int := 0; r record; v_titre text; v_msg text;
begin
  if p_etape = 'annonce' and current_date = date '2026-11-25' then
    v_titre := 'Offre de lancement : −50 % jusqu''au 30 novembre';
    v_msg := 'Jusqu''au 30 novembre, le Mois est à 1 000 F au lieu de 2 000 F et l''Année à 4 000 F au lieu de 8 000 F. '
          || 'À partir du 1er décembre, les prix réels s''appliquent : 2 000 F le mois, 8 000 F l''année. '
          || 'Profite de l''offre pour préparer ton concours jusqu''au bout.';
  elsif p_etape = 'dernier' and current_date = date '2026-11-30' then
    v_titre := 'Dernier jour de l''offre −50 %';
    v_msg := 'Jusqu''à ce soir minuit : le Mois à 1 000 F et l''Année à 4 000 F. '
          || 'Demain, les prix passent à 2 000 F et 8 000 F. L''Année à 4 000 F couvre toute ta préparation.';
  else
    return 0;
  end if;
  for r in
    select p.id user_id from profils p
     where p.id not in (select user_id from roles_utilisateur where role::text in ('admin','correcteur','investisseur'))
       and not exists (select 1 from abonnements a where a.user_id = p.id and a.formule = 'annuelle' and a.fin_le > now() and a.annule_le is null)
  loop
    perform public.notifier(r.user_id, 'annonce_plein', v_titre, v_msg, 'prix-' || p_etape, 'abonnement', true);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $f$;
revoke all on function public.annoncer_prix(text) from public, anon, authenticated;

create or replace function public.basculer_prix_reels()
 returns void language plpgsql security definer set search_path to 'public'
as $f$
declare v_f text; v_def text;
begin
  if current_date < date '2026-12-01' then return; end if;
  update public.tarifs set montant_fcfa = 2000, maj_le = now() where cle = 'mensuelle' and montant_fcfa <> 2000;
  update public.tarifs set montant_fcfa = 8000, maj_le = now() where cle = 'annuelle' and montant_fcfa <> 8000;
  /* les textes automatiques qui citent les prix suivent */
  foreach v_f in array array['preparer_renouvellements', 'preparer_relances_fin_essai', 'signaler_limite'] loop
    v_def := pg_get_functiondef(('public.' || v_f)::regproc);
    if position('1 000 F' in v_def) > 0 or position('4 000 F' in v_def) > 0 then
      execute replace(replace(v_def, '1 000 F', '2 000 F'), '4 000 F', '8 000 F');
    end if;
  end loop;
  perform cron.unschedule(jobname) from cron.job where jobname in ('prix-annonce', 'prix-dernier-jour', 'prix-bascule');
end $f$;
revoke all on function public.basculer_prix_reels() from public, anon, authenticated;

/* ---------- les rendez-vous ---------- */
select cron.schedule('mission-nouveaux', '50 */2 * * *', 'set statement_timeout=''30s''; select public.message_mission(true)');
select cron.schedule('niveau-debut', '5 8 * * *', 'set statement_timeout=''60s''; select public.niveau_cartes(''debut'')');
select cron.schedule('niveau-dimanche', '0 8 * * 0', 'set statement_timeout=''120s''; select public.niveau_cartes(''dimanche'')');
select cron.unschedule('bilan-dimanche');  -- la carte du dimanche matin remplace le bilan du dimanche soir
select cron.schedule('prix-annonce', '0 9 25 11 *', 'select public.annoncer_prix(''annonce'')');
select cron.schedule('prix-dernier-jour', '0 9 30 11 *', 'select public.annoncer_prix(''dernier'')');
select cron.schedule('prix-bascule', '1 0 1 12 *', 'select public.basculer_prix_reels()');
