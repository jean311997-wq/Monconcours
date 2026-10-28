-- Promotions manuelles : prix réduits des abonnements, lancés et arrêtés depuis l'administration,
-- pour tout le monde, un groupe ou des numéros précis. Le prix est appliqué par le serveur.

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  actif boolean not null default true,
  cible text not null default 'tous',
  telephones text[] not null default '{}',
  prix jsonb not null,
  message text,
  fin_le timestamptz,
  lance_le timestamptz not null default now(),
  arrete_le timestamptz,
  destinataires integer not null default 0,
  cree_par uuid
);
alter table public.promotions enable row level security;
revoke all on public.promotions from anon, authenticated;
drop policy if exists "equipe lit les promotions" on public.promotions;
create policy "equipe lit les promotions" on public.promotions for select using (securite.est_lecteur());
grant select on public.promotions to authenticated;

-- le candidat fait-il partie de ce groupe ? (même logique que cible_diffusion, pour un seul candidat)
create or replace function public.dans_cible(p_cible text, p_user uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.profils p
   where p.id = p_user
     and not exists (select 1 from public.bannissements b where b.user_id = p.id and b.leve_le is null and (b.jusqu_au is null or b.jusqu_au > now()))
     and case coalesce(p_cible, 'tous')
       when 'abonnes' then exists (select 1 from public.abonnements a where a.user_id = p.id and a.fin_le > now() and a.annule_le is null and a.formule <> 'essai')
       when 'essai' then exists (select 1 from public.abonnements a where a.user_id = p.id and a.fin_le > now() and a.annule_le is null and a.formule = 'essai')
                     and not exists (select 1 from public.abonnements a where a.user_id = p.id and a.fin_le > now() and a.annule_le is null and a.formule <> 'essai')
       when 'gratuits' then not exists (select 1 from public.abonnements a where a.user_id = p.id and a.fin_le > now() and a.annule_le is null)
       when 'actifs7' then exists (select 1 from public.sessions s where s.user_id = p.id and s.debut_le > now() - interval '7 days')
       when 'inactifs7' then not exists (select 1 from public.sessions s where s.user_id = p.id and s.debut_le > now() - interval '7 days')
       else true end);
$$;
revoke all on function public.dans_cible(text, uuid) from public, anon, authenticated;

create or replace function public.promotion_pour(p_user uuid, p_marge interval default interval '0')
returns public.promotions language sql stable security definer set search_path to 'public' as $$
  select pr.* from public.promotions pr
   where p_user is not null and pr.actif
     and (pr.fin_le is null or pr.fin_le + p_marge > now())
     and case when pr.cible = 'numeros'
              then exists (select 1 from public.profils p where p.id = p_user and p.telephone = any(pr.telephones))
              else public.dans_cible(pr.cible, p_user) end
   order by pr.lance_le desc limit 1;
$$;
revoke all on function public.promotion_pour(uuid, interval) from public, anon, authenticated;

-- ce que voit le candidat
create or replace function public.ma_promotion()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_pr public.promotions%rowtype;
begin
  if auth.uid() is null then return jsonb_build_object('actif', false); end if;
  v_pr := public.promotion_pour(auth.uid());
  if v_pr.id is null then return jsonb_build_object('actif', false); end if;
  return jsonb_build_object('actif', true, 'id', v_pr.id, 'nom', v_pr.nom, 'message', v_pr.message, 'fin_le', v_pr.fin_le,
    'prix', (select coalesce(jsonb_object_agg(t.cle, jsonb_build_object('promo', (v_pr.prix ->> t.cle)::int, 'normal', t.montant_fcfa)), '{}'::jsonb)
               from public.tarifs t where v_pr.prix ? t.cle));
end $$;
revoke all on function public.ma_promotion() from public, anon;
grant execute on function public.ma_promotion() to authenticated;

-- le prix demandé au paiement : celui de la promotion si le candidat y a droit
create or replace function public.soumettre_paiement(p_formule text, p_operateur text, p_telephone text, p_nom_compte text, p_preuve_chemin text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_user uuid := auth.uid(); v_tarif public.tarifs%rowtype; v_op text; v_tel text; v_id uuid; v_montant integer; v_pr public.promotions%rowtype;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'message', 'Non connecté.'); end if;
  select * into v_tarif from public.tarifs where cle = lower(trim(coalesce(p_formule, '')));
  if not found then return jsonb_build_object('ok', false, 'message', 'Formule inconnue.'); end if;
  v_montant := v_tarif.montant_fcfa;
  /* promotion : deux heures de marge pour envoyer la capture après la fin */
  v_pr := public.promotion_pour(v_user, interval '2 hours');
  if v_pr.id is not null and v_pr.prix ? v_tarif.cle then v_montant := (v_pr.prix ->> v_tarif.cle)::int; end if;
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
  values (v_user, v_op, v_montant, v_tel, trim(p_nom_compte), p_preuve_chemin, 'en_attente', v_tarif.cle, 'capture')
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'statut', 'en_attente', 'montant', v_montant, 'formule', v_tarif.cle,
    'message', 'Paiement bien reçu. Patientez : nous vérifions votre capture, au plus tard dans les 2 heures. Vous pouvez continuer à utiliser Mon Concours.');
end $$;

-- lancer une promotion
create or replace function public.admin_promotion_lancer(p_nom text, p_cible text, p_telephones text, p_mensuelle integer, p_annuelle integer,
                                                         p_message text default null, p_fin_le timestamptz default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_id uuid := gen_random_uuid(); v_nom text := btrim(coalesce(p_nom, '')); v_tels text[]; v_prix jsonb := '{}'::jsonb;
  v_n int := 0; r record; v_msg text; v_inconnus text[] := '{}'; t text; v_norm_m int; v_norm_a int; v_part text[] := '{}';
begin
  if not securite.est_admin() then return jsonb_build_object('ok', false, 'message', 'Réservé à l''administration.'); end if;
  if char_length(v_nom) < 3 or char_length(v_nom) > 60 then return jsonb_build_object('ok', false, 'message', 'Le nom : de 3 à 60 caractères.'); end if;
  if coalesce(p_cible, 'tous') not in ('tous', 'gratuits', 'essai', 'abonnes', 'actifs7', 'inactifs7', 'numeros') then
    return jsonb_build_object('ok', false, 'message', 'Groupe inconnu.'); end if;
  select montant_fcfa into v_norm_m from public.tarifs where cle = 'mensuelle';
  select montant_fcfa into v_norm_a from public.tarifs where cle = 'annuelle';
  if p_mensuelle is not null then
    if p_mensuelle < 100 or p_mensuelle >= v_norm_m then return jsonb_build_object('ok', false, 'message', 'Le prix du Mois doit être entre 100 et ' || (v_norm_m - 1) || ' FCFA.'); end if;
    v_prix := v_prix || jsonb_build_object('mensuelle', p_mensuelle);
  end if;
  if p_annuelle is not null then
    if p_annuelle < 100 or p_annuelle >= v_norm_a then return jsonb_build_object('ok', false, 'message', 'Le prix de l''Année doit être entre 100 et ' || (v_norm_a - 1) || ' FCFA.'); end if;
    v_prix := v_prix || jsonb_build_object('annuelle', p_annuelle);
  end if;
  if v_prix = '{}'::jsonb then return jsonb_build_object('ok', false, 'message', 'Indiquez au moins un prix.'); end if;
  if p_fin_le is not null and p_fin_le <= now() then return jsonb_build_object('ok', false, 'message', 'La fin doit être dans le futur.'); end if;
  if length(coalesce(p_message, '')) > 400 then return jsonb_build_object('ok', false, 'message', 'Le message : 400 caractères au plus.'); end if;

  v_tels := '{}';
  if p_cible = 'numeros' then
    select coalesce(array_agg(distinct x), '{}') into v_tels
      from (select right(regexp_replace(s, '\D', '', 'g'), 8) x from unnest(regexp_split_to_array(coalesce(p_telephones, ''), '[,;\n]+')) s) z
     where length(x) = 8;
    if coalesce(array_length(v_tels, 1), 0) = 0 then return jsonb_build_object('ok', false, 'message', 'Indiquez au moins un numéro à 8 chiffres.'); end if;
    select coalesce(array_agg(x), '{}') into v_inconnus from unnest(v_tels) x where not exists (select 1 from public.profils where telephone = x);
  end if;

  -- une seule promotion à la fois par public : les précédentes sont arrêtées
  update public.promotions set actif = false, arrete_le = now() where actif;

  v_msg := coalesce(nullif(btrim(coalesce(p_message, '')), ''),
    concat_ws(' ',
      case when v_prix ? 'mensuelle' then 'Abonnement Mois à ' || (v_prix ->> 'mensuelle') || ' FCFA au lieu de ' || v_norm_m || '.' end,
      case when v_prix ? 'annuelle' then 'Abonnement Année à ' || (v_prix ->> 'annuelle') || ' FCFA au lieu de ' || v_norm_a || '.' end,
      case when p_fin_le is not null then 'Jusqu''au ' || to_char(p_fin_le at time zone 'UTC', 'DD/MM') || '.' end));

  insert into public.promotions (id, nom, actif, cible, telephones, prix, message, fin_le, cree_par)
  values (v_id, v_nom, true, coalesce(p_cible, 'tous'), v_tels, v_prix, v_msg, p_fin_le, auth.uid());

  for r in select p.id from public.profils p
            where case when p_cible = 'numeros' then p.telephone = any(v_tels)
                       else public.dans_cible(p_cible, p.id) end loop
    perform public.notifier(r.id, 'annonce_plein', v_nom, v_msg, 'promo-' || v_id, 'abonnement', true);
    v_n := v_n + 1;
  end loop;
  update public.promotions set destinataires = v_n where id = v_id;
  insert into public.journal_activite (acteur, action, table_cible) values (auth.uid(), 'promotion_lancee', 'promotions');
  return jsonb_build_object('ok', true, 'id', v_id, 'destinataires', v_n, 'inconnus', to_jsonb(v_inconnus));
end $$;

create or replace function public.admin_promotion_arreter(p_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
begin
  if not securite.est_admin() then return jsonb_build_object('ok', false, 'message', 'Réservé à l''administration.'); end if;
  update public.promotions set actif = false, arrete_le = now() where id = p_id;
  insert into public.journal_activite (acteur, action, table_cible) values (auth.uid(), 'promotion_arretee', 'promotions');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_promotion_reprendre(p_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
begin
  if not securite.est_admin() then return jsonb_build_object('ok', false, 'message', 'Réservé à l''administration.'); end if;
  if exists (select 1 from public.promotions where id = p_id and fin_le is not null and fin_le <= now()) then
    return jsonb_build_object('ok', false, 'message', 'Cette promotion est terminée. Lancez-en une nouvelle.'); end if;
  update public.promotions set actif = false, arrete_le = now() where actif and id <> p_id;
  update public.promotions set actif = true, arrete_le = null where id = p_id;
  insert into public.journal_activite (acteur, action, table_cible) values (auth.uid(), 'promotion_reprise', 'promotions');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_promotions()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not securite.est_lecteur() then raise exception 'Réservé à l''équipe'; end if;
  return jsonb_build_object(
    'normal', (select coalesce(jsonb_object_agg(cle, montant_fcfa), '{}'::jsonb) from public.tarifs),
    'liste', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'nom', x.nom, 'actif', x.actif and (x.fin_le is null or x.fin_le > now()),
        'terminee', x.fin_le is not null and x.fin_le <= now(), 'cible', x.cible, 'nb_numeros', coalesce(array_length(x.telephones, 1), 0),
        'prix', x.prix, 'message', x.message, 'fin_le', x.fin_le, 'lance_le', x.lance_le, 'arrete_le', x.arrete_le, 'destinataires', x.destinataires,
        'achats', (select count(*) from public.paiements p where p.statut = 'confirme' and p.cree_le >= x.lance_le and (x.arrete_le is null or p.cree_le <= x.arrete_le + interval '2 hours')
                    and p.formule is not null and x.prix ? p.formule and p.montant_fcfa = (x.prix ->> p.formule)::int))
        order by x.lance_le desc) from (select * from public.promotions order by lance_le desc limit 30) x), '[]'::jsonb));
end $$;

revoke all on function public.admin_promotion_lancer(text, text, text, integer, integer, text, timestamptz) from public, anon;
revoke all on function public.admin_promotion_arreter(uuid) from public, anon;
revoke all on function public.admin_promotion_reprendre(uuid) from public, anon;
revoke all on function public.admin_promotions() from public, anon;
grant execute on function public.admin_promotion_lancer(text, text, text, integer, integer, text, timestamptz) to authenticated;
grant execute on function public.admin_promotion_arreter(uuid) to authenticated;
grant execute on function public.admin_promotion_reprendre(uuid) to authenticated;
grant execute on function public.admin_promotions() to authenticated;
