-- Trois Pass (Semaine 500 F, Mois 1 000 F, Année 4 000 F), trois opérateurs,
-- codes d'accès, activation par l'administration (« un proche paie pour moi »),
-- deux compositions offertes, notifications masquables, question du jour jamais répétée.
-- Le site reste en phase gratuite tant que securite.parametres.mode_gratuit = true.

-- 1. Tarifs
alter table public.tarifs drop constraint if exists tarifs_cle_check;
alter table public.tarifs add constraint tarifs_cle_check check (cle in ('semaine','mensuelle','annuelle'));
insert into public.tarifs (cle, libelle, montant_fcfa, jours) values ('semaine','Pass Semaine',500,7)
  on conflict (cle) do update set libelle = excluded.libelle, montant_fcfa = excluded.montant_fcfa, jours = excluded.jours, maj_le = now();
update public.tarifs set libelle='Pass Mois',  montant_fcfa=1000, jours=30,  maj_le=now() where cle='mensuelle';
update public.tarifs set libelle='Pass Année', montant_fcfa=4000, jours=365, maj_le=now() where cle='annuelle';

alter table public.abonnements drop constraint if exists abonnements_formule_check;
alter table public.abonnements add constraint abonnements_formule_check check (formule in ('essai','semaine','mensuelle','annuelle'));
alter table public.paiements drop constraint if exists paiements_formule_check;
alter table public.paiements add constraint paiements_formule_check check (formule is null or formule in ('semaine','mensuelle','annuelle'));
alter table public.paiements drop constraint if exists paiements_operateur_check;
alter table public.paiements add constraint paiements_operateur_check check (operateur in ('orange_money','moov_money','wave','code','admin'));
alter table public.paiements add column if not exists mode text not null default 'capture';
alter table public.paiements drop constraint if exists paiements_mode_check;
alter table public.paiements add constraint paiements_mode_check check (mode in ('capture','proche','code'));

-- 2. Activation d'un Pass (interne, non exposée) : prolonge si déjà actif
create or replace function securite.activer_pass(p_user uuid, p_cle text)
returns timestamptz language plpgsql security definer set search_path to 'public' as $$
declare v_t public.tarifs%rowtype; v_abo uuid; v_fin timestamptz;
begin
  select * into v_t from public.tarifs where cle = p_cle;
  if not found then raise exception 'Pass inconnu'; end if;
  select id into v_abo from public.abonnements
   where user_id = p_user and fin_le > now() and annule_le is null and formule <> 'essai'
   order by fin_le desc limit 1;
  if v_abo is not null then
    update public.abonnements set fin_le = fin_le + make_interval(days => v_t.jours) where id = v_abo returning fin_le into v_fin;
  else
    insert into public.abonnements (user_id, formule, debut_le, fin_le)
    values (p_user, v_t.cle, now(), greatest(now(), coalesce((select max(fin_le) from public.abonnements where user_id = p_user and annule_le is null), now())) + make_interval(days => v_t.jours))
    returning fin_le into v_fin;
  end if;
  return v_fin;
end $$;
revoke all on function securite.activer_pass(uuid, text) from public, anon, authenticated;

-- 3. Soumission : Orange, Moov et Wave
create or replace function public.soumettre_paiement(p_formule text, p_operateur text, p_telephone text, p_nom_compte text, p_preuve_chemin text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_user uuid := auth.uid(); v_tarif public.tarifs%rowtype; v_op text; v_tel text; v_id uuid;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'message', 'Non connecté.'); end if;
  select * into v_tarif from public.tarifs where cle = lower(trim(coalesce(p_formule, '')));
  if not found then return jsonb_build_object('ok', false, 'message', 'Formule inconnue.'); end if;
  v_op := case regexp_replace(lower(coalesce(p_operateur, '')), '[^a-z]', '', 'g')
            when 'orange' then 'orange_money' when 'orangemoney' then 'orange_money' when 'om' then 'orange_money'
            when 'moov' then 'moov_money' when 'moovmoney' then 'moov_money'
            when 'wave' then 'wave' else null end;
  if v_op is null then return jsonb_build_object('ok', false, 'message', 'Moyen de paiement inconnu.'); end if;
  v_tel := regexp_replace(coalesce(p_telephone, ''), '\D', '', 'g');
  if length(v_tel) <> 8 then return jsonb_build_object('ok', false, 'message', 'Numéro de téléphone invalide.'); end if;
  if p_nom_compte is null or length(trim(p_nom_compte)) < 2 then
    return jsonb_build_object('ok', false, 'message', 'Le nom du compte est requis.'); end if;
  if p_preuve_chemin is null or (storage.foldername(p_preuve_chemin))[1] <> v_user::text then
    return jsonb_build_object('ok', false, 'message', 'La capture de paiement est requise.'); end if;
  if exists (select 1 from public.paiements where user_id = v_user and statut = 'en_attente') then
    return jsonb_build_object('ok', false, 'message', 'Une demande est déjà en cours de vérification.'); end if;
  insert into public.paiements (user_id, operateur, montant_fcfa, telephone, nom_compte, preuve_chemin, statut, formule, mode)
  values (v_user, v_op, v_tarif.montant_fcfa, v_tel, trim(p_nom_compte), p_preuve_chemin, 'en_attente', v_tarif.cle, 'capture')
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'statut', 'en_attente', 'montant', v_tarif.montant_fcfa, 'formule', v_tarif.cle,
    'message', 'Paiement bien reçu. Patientez : nous vérifions votre capture, au plus tard dans les 2 heures. Vous pouvez continuer à utiliser Mon Concours.');
end $$;

-- 4. Confirmation par l'administration (même règle, via l'aide commune)
create or replace function public.confirmer_paiement(p_id uuid, p_confirme boolean, p_motif text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_p record; v_fin timestamptz; v_cle text; v_abo uuid;
begin
  if not securite.est_admin() then return jsonb_build_object('ok', false, 'message', 'Réservé à l''administration.'); end if;
  select * into v_p from public.paiements where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'message', 'Introuvable.'); end if;
  if v_p.statut <> 'en_attente' then return jsonb_build_object('ok', false, 'message', 'Cette demande a déjà été traitée.'); end if;
  if not p_confirme then
    update public.paiements set statut = 'refuse', regle_le = now(), motif_refus = nullif(trim(coalesce(p_motif,'')), '') where id = p_id;
    return jsonb_build_object('ok', true, 'statut', 'refuse');
  end if;
  v_cle := coalesce(v_p.formule, v_p.reference_externe, 'mensuelle');
  if not exists (select 1 from public.tarifs where cle = v_cle) then v_cle := 'mensuelle'; end if;
  v_fin := securite.activer_pass(v_p.user_id, v_cle);
  select id into v_abo from public.abonnements where user_id = v_p.user_id order by fin_le desc limit 1;
  update public.paiements set statut = 'confirme', regle_le = now(), abonnement_id = v_abo where id = p_id;
  return jsonb_build_object('ok', true, 'statut', 'confirme', 'fin_le', v_fin, 'message', 'Pass activé. Le candidat est prévenu.');
end $$;

-- 5. Notification finale au candidat : confirmé ou rejeté
create or replace function public.notifier_paiement() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare v_lib text;
begin
  select libelle into v_lib from public.tarifs where cle = coalesce(new.formule, 'mensuelle');
  if new.statut = 'confirme' and old.statut = 'en_attente' then
    perform public.creer_notification(new.user_id, 'paiement', 'Paiement confirmé',
      'Votre ' || coalesce(v_lib, 'Pass') || ' est actif. Corrections illimitées, compositions illimitées, feuille détaillée et plan de révision sont à vous. Bon courage !',
      'paiement-' || new.id::text);
  elsif new.statut = 'refuse' and old.statut = 'en_attente' then
    perform public.creer_notification(new.user_id, 'paiement', 'Paiement rejeté',
      coalesce(nullif(new.motif_refus, ''), 'Nous n''avons pas pu valider votre capture.') || ' Vous pouvez renvoyer une capture, ou nous écrire sur WhatsApp.',
      'paiement-refus-' || new.id::text);
  end if;
  return new;
end $$;

-- 6. Codes d'accès
create table if not exists public.codes_acces (
  code text primary key, formule text not null references public.tarifs(cle),
  cree_le timestamptz not null default now(), cree_par uuid, note text,
  utilise_par uuid, utilise_le timestamptz
);
alter table public.codes_acces enable row level security;
create table if not exists public.codes_essais (user_id uuid not null, cree_le timestamptz not null default now());
alter table public.codes_essais enable row level security;
create index if not exists codes_essais_user on public.codes_essais (user_id, cree_le desc);

create or replace function public.admin_creer_codes(p_formule text, p_nombre int, p_note text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_codes text[] := '{}'; v_c text; i int;
begin
  if not securite.est_admin() then return jsonb_build_object('ok', false, 'message', 'Réservé à l''administration.'); end if;
  if not exists (select 1 from public.tarifs where cle = p_formule) then return jsonb_build_object('ok', false, 'message', 'Pass inconnu.'); end if;
  if p_nombre is null or p_nombre < 1 or p_nombre > 100 then return jsonb_build_object('ok', false, 'message', 'Entre 1 et 100 codes.'); end if;
  for i in 1..p_nombre loop
    v_c := upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 10));
    v_c := substr(v_c, 1, 5) || '-' || substr(v_c, 6, 5);
    insert into public.codes_acces (code, formule, cree_par, note) values (v_c, p_formule, auth.uid(), nullif(trim(coalesce(p_note,'')), ''));
    v_codes := v_codes || v_c;
  end loop;
  return jsonb_build_object('ok', true, 'codes', to_jsonb(v_codes));
end $$;

create or replace function public.admin_liste_codes()
returns jsonb language plpgsql security definer set search_path to 'public' as $$
begin
  if not securite.est_admin() then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('code', c.code, 'formule', c.formule, 'note', c.note, 'cree_le', c.cree_le,
           'utilise_le', c.utilise_le, 'utilise_par', pr.nom) order by c.cree_le desc)
    from (select * from public.codes_acces order by cree_le desc limit 200) c left join public.profils pr on pr.id = c.utilise_par), '[]'::jsonb);
end $$;

create or replace function public.utiliser_code(p_code text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_user uuid := auth.uid(); v_n text; v_c public.codes_acces%rowtype; v_fin timestamptz; v_lib text;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'connexion', true, 'message', 'Créez votre compte pour utiliser un code.'); end if;
  if (select count(*) from public.codes_essais where user_id = v_user and cree_le > now() - interval '10 minutes') >= 8 then
    return jsonb_build_object('ok', false, 'message', 'Trop d''essais. Réessayez dans quelques minutes, ou écrivez-nous sur WhatsApp.'); end if;
  v_n := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  if length(v_n) <> 10 then
    insert into public.codes_essais (user_id) values (v_user);
    return jsonb_build_object('ok', false, 'message', 'Ce code n''est pas valide. Vérifiez-le.'); end if;
  v_n := substr(v_n, 1, 5) || '-' || substr(v_n, 6, 5);
  select * into v_c from public.codes_acces where code = v_n for update;
  if not found then
    insert into public.codes_essais (user_id) values (v_user);
    return jsonb_build_object('ok', false, 'message', 'Ce code n''est pas valide. Vérifiez-le.'); end if;
  if v_c.utilise_le is not null then return jsonb_build_object('ok', false, 'message', 'Ce code a déjà été utilisé.'); end if;
  v_fin := securite.activer_pass(v_user, v_c.formule);
  update public.codes_acces set utilise_par = v_user, utilise_le = now() where code = v_n;
  insert into public.paiements (user_id, operateur, montant_fcfa, statut, formule, mode, regle_le, reference_externe)
  values (v_user, 'code', 0, 'confirme', v_c.formule, 'code', now(), 'code-' || v_n);
  select libelle into v_lib from public.tarifs where cle = v_c.formule;
  perform public.creer_notification(v_user, 'paiement', 'Code accepté', 'Votre ' || v_lib || ' est actif.', 'code-' || v_n);
  return jsonb_build_object('ok', true, 'formule', v_c.formule, 'libelle', v_lib, 'fin_le', v_fin);
end $$;

-- 7. « Un proche paie pour moi » : l'administration active le Pass du candidat par son numéro
create or replace function public.admin_activer_pass(p_telephone text, p_formule text, p_note text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_tel text := right(regexp_replace(coalesce(p_telephone, ''), '\D', '', 'g'), 8); v_u uuid; v_t public.tarifs%rowtype; v_fin timestamptz; v_nom text;
begin
  if not securite.est_admin() then return jsonb_build_object('ok', false, 'message', 'Réservé à l''administration.'); end if;
  select * into v_t from public.tarifs where cle = p_formule;
  if not found then return jsonb_build_object('ok', false, 'message', 'Pass inconnu.'); end if;
  select id, nom into v_u, v_nom from public.profils where right(regexp_replace(coalesce(telephone,''), '\D', '', 'g'), 8) = v_tel limit 1;
  if v_u is null then return jsonb_build_object('ok', false, 'message', 'Aucun candidat avec ce numéro.'); end if;
  v_fin := securite.activer_pass(v_u, p_formule);
  insert into public.paiements (user_id, operateur, montant_fcfa, statut, formule, mode, regle_le, nom_compte)
  values (v_u, 'admin', v_t.montant_fcfa, 'confirme', p_formule, 'proche', now(), nullif(trim(coalesce(p_note,'')), ''));
  perform public.creer_notification(v_u, 'paiement', 'Un proche a payé pour vous', 'Votre ' || v_t.libelle || ' est actif. Bon courage !', 'proche-' || gen_random_uuid()::text);
  return jsonb_build_object('ok', true, 'nom', v_nom, 'fin_le', v_fin);
end $$;

revoke all on function public.admin_creer_codes(text,int,text), public.admin_liste_codes(), public.admin_activer_pass(text,text,text) from public, anon;
revoke all on function public.utiliser_code(text) from public, anon;
grant execute on function public.admin_creer_codes(text,int,text), public.admin_liste_codes(), public.admin_activer_pass(text,text,text), public.utiliser_code(text) to authenticated;

-- 8. Deux compositions offertes ; au-delà, le Pass. La nationale du samedi reste gratuite.
create or replace function public.ouvrir_composition(p_niveau text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_user uuid := auth.uid();
  v_niveau public.niveau_scolaire; v_compo record; v_sujet record; v_concours text;
  v_restant int; v_seuil int; v_ep jsonb; v_libre boolean; v_deja int;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'connexion', true, 'message', 'Créez votre compte pour composer.');
  end if;
  v_libre := securite.est_abonne(v_user) or securite.est_equipe();
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
    if not v_libre then
      select count(*) into v_deja from public.compositions where user_id = v_user and epreuve_id is null;
      if v_deja >= 2 then
        return jsonb_build_object('ok', false, 'abonnement', true, 'offre', 'composition',
          'message', 'Vos 2 compositions offertes sont faites. Pour en composer d''autres, prenez un Pass.');
      end if;
    end if;
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
    'seuil', v_seuil, 'epreuve', v_ep,
    'questions', public.questions_du_sujet(v_sujet.id));
end $$;

-- 9. Notifications : « tout supprimer » (masquées, jamais perdues pour les clés d'unicité)
alter table public.notifications add column if not exists masquee boolean not null default false;
create or replace function public.mes_notifications() returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', n.id, 'type', n.type, 'titre', n.titre, 'message', n.message, 'lue', n.lue, 'cree_le', n.cree_le,
      'lien', coalesce(n.lien,
        case when n.cle_unicite like 'resultat-%' then 'copie:' || substr(n.cle_unicite, 10)
             when n.cle_unicite like 'epreuve-%' then 'epreuve:' || substr(n.cle_unicite, 9) end)
    ) order by n.cree_le desc)
    from (select * from public.notifications where user_id = v_user and not masquee order by cree_le desc limit 40) n
  ), '[]'::jsonb);
end $$;
create or replace function public.supprimer_notifications(p_id uuid default null) returns void
language plpgsql security definer set search_path to 'public' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then return; end if;
  if p_id is null then update public.notifications set masquee = true, lue = true where user_id = v_user and not masquee;
  else update public.notifications set masquee = true, lue = true where user_id = v_user and id = p_id; end if;
end $$;
revoke all on function public.supprimer_notifications(uuid) from public, anon;
grant execute on function public.supprimer_notifications(uuid) to authenticated;

-- 10. Question du jour : jamais deux fois la même, et le taux de réussite seulement s'il repose sur assez de réponses
create table if not exists public.questions_du_jour (jour date primary key, question_id uuid not null unique);
alter table public.questions_du_jour enable row level security;
insert into public.questions_du_jour (jour, question_id)
  select distinct on (jour) jour, question_id from public.reponses_question_jour order by jour, question_id
  on conflict do nothing;

create or replace function public.id_question_du_jour(p_jour date default current_date) returns uuid
language plpgsql volatile security definer set search_path to 'public' as $$
declare v_id uuid;
begin
  select question_id into v_id from public.questions_du_jour where jour = p_jour;
  if v_id is not null then return v_id; end if;
  select q.id into v_id from public.questions q
   where q.statut = 'publie' and q.explication is not null and length(q.explication) > 20
     and (select count(*) from public.question_options o where o.question_id = q.id) >= 3
     and not public.question_gardee(q.id)
     and not exists (select 1 from public.questions_du_jour d where d.question_id = q.id)
   order by md5(q.id::text || p_jour::text) limit 1;
  if v_id is not null and p_jour >= current_date then
    insert into public.questions_du_jour (jour, question_id) values (p_jour, v_id) on conflict do nothing;
    select question_id into v_id from public.questions_du_jour where jour = p_jour;
  end if;
  return v_id;
end $$;

create or replace function public.question_du_jour() returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid := public.id_question_du_jour(); v_q record; v_deja boolean := false; v_n int; v_j int;
begin
  if v_id is null then return jsonb_build_object('ok', false); end if;
  select q.id, q.enonce, m.nom matiere into v_q from public.questions q left join public.matieres m on m.id = q.matiere_id where q.id = v_id;
  if auth.uid() is not null then
    v_deja := exists (select 1 from public.reponses_question_jour where jour = current_date and user_id = auth.uid());
  end if;
  select count(*), count(*) filter (where correcte) into v_n, v_j from public.reponses_question_jour where jour = current_date;
  return jsonb_build_object('ok', true, 'jour', current_date, 'id', v_q.id, 'enonce', v_q.enonce, 'matiere', v_q.matiere,
    'options', (select jsonb_agg(o.texte order by o.position) from public.question_options o where o.question_id = v_q.id),
    'repondants', v_n, 'deja', v_deja,
    'taux', case when v_n >= 30 then round(100.0 * v_j / v_n) else null end);
end $$;

create or replace function public.repondre_question_du_jour(p_choix integer[], p_session uuid default null) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_id uuid := public.id_question_du_jour(); v_user uuid := auth.uid();
  v_bonnes int[]; v_choix int[]; v_ok boolean; v_expl text; v_n int; v_j int;
begin
  if v_id is null then return jsonb_build_object('ok', false); end if;
  if v_user is null and p_session is null then return jsonb_build_object('ok', false, 'message', 'Session inconnue.'); end if;
  v_bonnes := public.bonnes_reponses(v_id);
  select coalesce(array_agg(distinct c order by c), array[]::int[]) into v_choix
    from unnest(coalesce(p_choix, array[]::int[])) c where c between 0 and 9;
  v_ok := array_length(v_bonnes, 1) is not null and v_choix = v_bonnes;
  begin
    insert into public.reponses_question_jour (question_id, user_id, session_id, correcte)
    values (v_id, v_user, case when v_user is null then p_session end, v_ok);
  exception when unique_violation then null;
  end;
  if v_user is not null then perform public.corriger_question(v_id, v_choix, 'revision', null, p_session); end if;
  select explication into v_expl from public.questions where id = v_id;
  select count(*), count(*) filter (where correcte) into v_n, v_j from public.reponses_question_jour where jour = current_date;
  return jsonb_build_object('ok', true, 'correcte', v_ok, 'bonnes', to_jsonb(v_bonnes),
    'explication', v_expl, 'repondants', v_n,
    'taux', case when v_n >= 30 then round(100.0 * v_j / v_n) else null end);
end $$;
