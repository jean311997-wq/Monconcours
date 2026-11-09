-- Qui a confirmé / activé chaque paiement (pour repérer le travail de l'équipe 2 = rôle investisseur)
alter table public.paiements add column if not exists regle_par uuid;

create or replace function public.confirmer_paiement(p_id uuid, p_confirme boolean, p_motif text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v_p record; v_fin timestamptz; v_cle text; v_abo uuid;
begin
  if not securite.est_admin() then return jsonb_build_object('ok', false, 'message', 'Réservé à l''administration.'); end if;
  select * into v_p from public.paiements where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'message', 'Introuvable.'); end if;
  if v_p.statut <> 'en_attente' then return jsonb_build_object('ok', false, 'message', 'Cette demande a déjà été traitée.'); end if;
  if not p_confirme then
    update public.paiements set statut = 'refuse', regle_le = now(), regle_par = auth.uid(), motif_refus = nullif(trim(coalesce(p_motif,'')), '') where id = p_id;
    return jsonb_build_object('ok', true, 'statut', 'refuse');
  end if;
  v_cle := coalesce(v_p.formule, v_p.reference_externe, 'mensuelle');
  if not exists (select 1 from public.tarifs where cle = v_cle) then v_cle := 'mensuelle'; end if;
  v_fin := securite.activer_pass(v_p.user_id, v_cle);
  select id into v_abo from public.abonnements where user_id = v_p.user_id order by fin_le desc limit 1;
  update public.paiements set statut = 'confirme', regle_le = now(), regle_par = auth.uid(), abonnement_id = v_abo where id = p_id;
  return jsonb_build_object('ok', true, 'statut', 'confirme', 'fin_le', v_fin, 'message', 'Abonnement activé. Le candidat est prévenu.');
end $function$;

create or replace function public.admin_activer_pass(p_telephone text, p_formule text, p_note text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v_tel text := right(regexp_replace(coalesce(p_telephone, ''), '\D', '', 'g'), 8); v_u uuid; v_t public.tarifs%rowtype; v_fin timestamptz; v_nom text;
begin
  if not securite.est_admin() then return jsonb_build_object('ok', false, 'message', 'Réservé à l''administration.'); end if;
  select * into v_t from public.tarifs where cle = p_formule;
  if not found then return jsonb_build_object('ok', false, 'message', 'Abonnement inconnu.'); end if;
  select id, nom into v_u, v_nom from public.profils where right(regexp_replace(coalesce(telephone,''), '\D', '', 'g'), 8) = v_tel limit 1;
  if v_u is null then return jsonb_build_object('ok', false, 'message', 'Aucun candidat avec ce numéro.'); end if;
  v_fin := securite.activer_pass(v_u, p_formule);
  insert into public.paiements (user_id, operateur, montant_fcfa, statut, formule, mode, regle_le, regle_par, nom_compte)
  values (v_u, 'admin', v_t.montant_fcfa, 'confirme', p_formule, 'proche', now(), auth.uid(), nullif(trim(coalesce(p_note,'')), ''));
  perform public.creer_notification(v_u, 'paiement', 'Un proche a payé pour vous', 'Votre ' || v_t.libelle || ' est actif. Bon courage !', 'proche-' || gen_random_uuid()::text);
  return jsonb_build_object('ok', true, 'nom', v_nom, 'fin_le', v_fin);
end $function$;

create or replace function public.paiements_vue(p_du date, p_au date)
returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $function$
declare v_au date; v_du date; v_admin boolean := securite.est_admin(); res jsonb;
begin
  if not securite.est_lecteur() then raise exception 'Réservé à l''équipe'; end if;
  v_au := least(coalesce(p_au, current_date), current_date);
  v_du := least(coalesce(p_du, v_au - 29), v_au);
  with ligne as (
    select p.id, p.user_id, pr.nom, public.tel_visible(coalesce(p.telephone, pr.telephone)) tel, p.nom_compte, p.operateur, p.mode,
           coalesce(p.formule, p.reference_externe) formule, p.montant_fcfa montant, p.statut, p.motif_refus motif, p.cree_le, p.regle_le,
           exists (select 1 from public.roles_utilisateur r where r.user_id = p.regle_par and r.role = 'investisseur') equipe2,
           case when v_admin then p.preuve_chemin end preuve
      from public.paiements p left join public.profils pr on pr.id = p.user_id
  ), ev as (
    select e.user_id, min(e.cree_le) premiere, max(e.cree_le) derniere,
           max(case e.nom when 'PAYMENT_STARTED' then 3 when 'PAYMENT_DECLARED' then 4 when 'PAYMENT_PROOF_SENT' then 5 when 'PAYMENT_SENT' then 5 end) etape,
           bool_or(e.nom = 'PAYMENT_ABANDONED') abandon,
           (array_agg(e.meta ->> 'formule' order by e.cree_le desc) filter (where e.meta ? 'formule'))[1] formule
      from public.evenements e
     where e.user_id is not null and e.cree_le::date between v_du and v_au
       and e.nom in ('PAYMENT_STARTED', 'PAYMENT_DECLARED', 'PAYMENT_PROOF_SENT', 'PAYMENT_SENT', 'PAYMENT_ABANDONED')
     group by e.user_id
  ), sans as (
    select ev.*, pr.nom, public.tel_visible(pr.telephone) tel from ev left join public.profils pr on pr.id = ev.user_id
     where not exists (select 1 from public.paiements p where p.user_id = ev.user_id and p.operateur not in ('code', 'admin') and p.cree_le >= ev.premiere - interval '1 hour')
  )
  select jsonb_build_object(
    'du', v_du, 'au', v_au, 'admin', v_admin,
    'recus', (select coalesce(jsonb_agg(to_jsonb(l) order by coalesce(l.regle_le, l.cree_le) desc), '[]'::jsonb) from ligne l
               where l.statut = 'confirme' and l.montant > 0 and coalesce(l.regle_le, l.cree_le)::date between v_du and v_au),
    'equipe2', (select coalesce(jsonb_agg(to_jsonb(l) order by coalesce(l.regle_le, l.cree_le) desc), '[]'::jsonb) from ligne l
               where l.statut = 'confirme' and l.montant > 0 and l.equipe2 and coalesce(l.regle_le, l.cree_le)::date between v_du and v_au),
    'codes', (select count(*) from ligne l where l.statut = 'confirme' and l.montant = 0 and coalesce(l.regle_le, l.cree_le)::date between v_du and v_au),
    'attente', (select coalesce(jsonb_agg(to_jsonb(l) order by l.cree_le), '[]'::jsonb) from ligne l where l.statut = 'en_attente'),
    'en_cours', (select coalesce(jsonb_agg(jsonb_build_object('user_id', s.user_id, 'nom', s.nom, 'tel', s.tel, 'etape', s.etape, 'formule', s.formule,
                   'premiere', s.premiere, 'derniere', s.derniere) order by s.derniere desc), '[]'::jsonb)
                 from sans s where s.etape is not null and not s.abandon and s.derniere > now() - interval '24 hours'),
    'refuses', (select coalesce(jsonb_agg(to_jsonb(l) order by l.cree_le desc), '[]'::jsonb) from ligne l
                 where l.statut = 'refuse' and l.cree_le::date between v_du and v_au),
    'abandons', (select coalesce(jsonb_agg(jsonb_build_object('user_id', s.user_id, 'nom', s.nom, 'tel', s.tel, 'etape', s.etape, 'formule', s.formule,
                   'derniere', s.derniere, 'abandon', s.abandon) order by s.derniere desc), '[]'::jsonb)
                 from sans s where s.abandon or s.derniere <= now() - interval '24 hours'),
    'par_operateur', (select coalesce(jsonb_agg(jsonb_build_object('nom', q.operateur, 'n', q.n, 'montant', q.m) order by q.m desc), '[]'::jsonb)
                       from (select operateur, count(*) n, sum(montant) m from ligne l where l.statut = 'confirme' and l.montant > 0
                                and coalesce(l.regle_le, l.cree_le)::date between v_du and v_au group by operateur) q),
    'par_formule', (select coalesce(jsonb_agg(jsonb_build_object('nom', q.formule, 'n', q.n, 'montant', q.m) order by q.m desc), '[]'::jsonb)
                     from (select formule, count(*) n, sum(montant) m from ligne l where l.statut = 'confirme' and l.montant > 0
                              and coalesce(l.regle_le, l.cree_le)::date between v_du and v_au group by formule) q),
    'serie', (select coalesce(jsonb_agg(jsonb_build_object('jour', j.d::date, 'montant', coalesce((select sum(montant) from ligne l where l.statut = 'confirme' and l.montant > 0 and coalesce(l.regle_le, l.cree_le)::date = j.d::date), 0),
                   'n', (select count(*) from ligne l where l.statut = 'confirme' and l.montant > 0 and coalesce(l.regle_le, l.cree_le)::date = j.d::date)) order by j.d), '[]'::jsonb)
                from generate_series(v_du, v_au, interval '1 day') j(d))
  ) into res;
  return res;
end $function$;
