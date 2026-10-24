-- Offre flash : le Pass Année à 2 000 FCFA jusqu'à minuit, une seule fois par candidat.
-- Le prix réduit est appliqué par le serveur au moment de la demande de paiement.

create table if not exists public.offres_flash (
  user_id uuid primary key references auth.users(id) on delete cascade,
  formule text not null,
  montant_fcfa integer not null check (montant_fcfa > 0),
  debut_le timestamptz not null default now(),
  fin_le timestamptz not null
);
alter table public.offres_flash enable row level security;
revoke all on public.offres_flash from anon, authenticated;

create or replace function public.mon_offre_flash(p_creer boolean default false)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_user uuid := auth.uid(); v_o public.offres_flash%rowtype; v_normal integer; v_nouvelle boolean := false; v_fin timestamptz; v_jour text;
begin
  if v_user is null then return jsonb_build_object('actif', false); end if;
  if public.plateforme_gratuite() then return jsonb_build_object('actif', false); end if;
  if exists (select 1 from public.abonnements
              where user_id = v_user and fin_le > now() and annule_le is null and formule <> 'essai') then
    return jsonb_build_object('actif', false);
  end if;
  select * into v_o from public.offres_flash where user_id = v_user;
  if not found then
    if not coalesce(p_creer, false) then return jsonb_build_object('actif', false); end if;
    /* l'offre expire à minuit (heure du Burkina = UTC) ; s'il reste moins de 6 h, elle court jusqu'à demain minuit */
    v_fin := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC' + interval '1 day';
    if v_fin - now() < interval '6 hours' then v_fin := v_fin + interval '1 day'; end if;
    v_jour := case when v_fin - now() > interval '24 hours' then 'demain à minuit' else 'ce soir à minuit' end;
    insert into public.offres_flash (user_id, formule, montant_fcfa, debut_le, fin_le)
    values (v_user, 'annuelle', 2000, now(), v_fin)
    on conflict (user_id) do nothing;
    select * into v_o from public.offres_flash where user_id = v_user;
    v_nouvelle := true;
    insert into public.notifications (user_id, type, titre, message, cle_unicite, lien)
    values (v_user, 'paiement', 'Offre flash : valable aujourd''hui seulement',
            'Le Pass Année à 2 000 FCFA au lieu de 4 000. L''offre expire ' || v_jour || '. Touchez pour en profiter.',
            'offre-flash', 'offre')
    on conflict (user_id, cle_unicite) where cle_unicite is not null do nothing;
  end if;
  select montant_fcfa into v_normal from public.tarifs where cle = v_o.formule;
  return jsonb_build_object('actif', v_o.fin_le > now(), 'formule', v_o.formule, 'montant', v_o.montant_fcfa,
                            'normal', v_normal, 'fin_le', v_o.fin_le, 'nouvelle', v_nouvelle);
end $$;
revoke execute on function public.mon_offre_flash(boolean) from public, anon;
grant execute on function public.mon_offre_flash(boolean) to authenticated;

create or replace function public.soumettre_paiement(p_formule text, p_operateur text, p_telephone text, p_nom_compte text, p_preuve_chemin text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_user uuid := auth.uid(); v_tarif public.tarifs%rowtype; v_op text; v_tel text; v_id uuid; v_montant integer;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'message', 'Non connecté.'); end if;
  select * into v_tarif from public.tarifs where cle = lower(trim(coalesce(p_formule, '')));
  if not found then return jsonb_build_object('ok', false, 'message', 'Formule inconnue.'); end if;
  v_montant := v_tarif.montant_fcfa;
  /* offre flash : une heure de marge pour envoyer la capture après la fin */
  select o.montant_fcfa into v_montant from public.offres_flash o
   where o.user_id = v_user and o.formule = v_tarif.cle and o.fin_le + interval '1 hour' > now();
  if v_montant is null then v_montant := v_tarif.montant_fcfa; end if;
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
