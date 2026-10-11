-- =====================================================================
-- 11 octobre 2026 · Code oublié, déblocage par l'admin, contrôle de connexion
-- Choix du propriétaire : la couleur reste le premier moyen. Au 3e échec
-- (comptés depuis le dernier succès, 30 jours au plus), le numéro est
-- bloqué et le candidat écrit à l'administrateur sur WhatsApp.
-- =====================================================================

create or replace function public.reinitialiser_code(p_telephone text, p_couleur text, p_nouveau text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id uuid; v_couleur text; v_tel text; v_echecs int; v_code text; v_depuis timestamptz;
begin
  v_tel  := regexp_replace(coalesce(p_telephone, ''), '\D', '', 'g');
  v_code := regexp_replace(coalesce(p_nouveau, ''), '\D', '', 'g');
  if length(v_tel) <> 8 then
    return jsonb_build_object('ok', false, 'message', 'Le numéro doit comporter 8 chiffres.');
  end if;
  -- les échecs comptent depuis le dernier succès (ou le dernier déblocage par l'admin)
  select greatest(now() - interval '30 days', coalesce(max(cree_le), '-infinity'::timestamptz))
    into v_depuis from public.tentatives_reinit where telephone = v_tel and reussie;
  select count(*) into v_echecs from public.tentatives_reinit
   where telephone = v_tel and not reussie and cree_le > v_depuis;
  if v_echecs >= 3 then
    return jsonb_build_object('ok', false, 'bloque', true,
      'message', 'Trop d''essais pour ce numéro. Écrivez à l''administrateur sur WhatsApp : il vérifiera votre identité et changera votre code.');
  end if;
  if length(v_code) <> 4 then
    return jsonb_build_object('ok', false, 'message', 'Le nouveau code doit comporter 4 chiffres.');
  end if;
  select id, couleur into v_id, v_couleur from public.profils where telephone = v_tel;
  if v_id is null or v_couleur is null
     or lower(trim(v_couleur)) <> lower(trim(coalesce(p_couleur, ''))) then
    insert into public.tentatives_reinit (telephone, reussie) values (v_tel, false);
    if v_echecs + 1 >= 3 then
      return jsonb_build_object('ok', false, 'bloque', true,
        'message', 'Numéro ou couleur incorrects. Ce numéro est maintenant bloqué : écrivez à l''administrateur sur WhatsApp.');
    end if;
    return jsonb_build_object('ok', false,
      'message', 'Numéro ou couleur incorrects. Il vous reste ' || (3 - v_echecs - 1) || ' essai' ||
                 case when 3 - v_echecs - 1 > 1 then 's' else '' end || '.');
  end if;
  update auth.users
     set encrypted_password = extensions.crypt(v_tel || '#' || v_code, extensions.gen_salt('bf')),
         updated_at = now()
   where id = v_id;
  insert into public.tentatives_reinit (telephone, reussie) values (v_tel, true);
  insert into public.journal_activite (acteur, action, table_cible, ligne_cible)
  values (null, 'reinitialisation_code', 'profils', v_id);
  perform public.creer_notification(v_id, 'securite', 'Votre code a été changé',
    'Votre code secret a été changé le ' || to_char(now() at time zone 'Africa/Ouagadougou', 'DD/MM/YYYY à HH24:MI') ||
    '. Si ce n''est pas vous, écrivez tout de suite à l''administrateur sur WhatsApp.', null);
  return jsonb_build_object('ok', true, 'message', 'Code changé. Connectez-vous avec le nouveau code.');
end $$;

create or replace function public.admin_changer_code(p_telephone text, p_nouveau text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_tel text; v_code text; v_id uuid;
begin
  if not securite.est_admin() then
    return jsonb_build_object('ok', false, 'message', 'Réservé à l''administration.');
  end if;
  v_tel  := regexp_replace(coalesce(p_telephone, ''), '\D', '', 'g');
  v_code := regexp_replace(coalesce(p_nouveau, ''), '\D', '', 'g');
  if length(v_tel) <> 8 or length(v_code) <> 4 then
    return jsonb_build_object('ok', false, 'message', 'Numéro à 8 chiffres et code à 4 chiffres.');
  end if;
  select id into v_id from public.profils where telephone = v_tel;
  if v_id is null then return jsonb_build_object('ok', false, 'message', 'Aucun compte avec ce numéro.'); end if;
  update auth.users set encrypted_password = extensions.crypt(v_tel || '#' || v_code, extensions.gen_salt('bf')),
         updated_at = now() where id = v_id;
  -- un succès enregistré remet les compteurs à zéro (déblocage)
  insert into public.tentatives_reinit (telephone, reussie) values (v_tel, true);
  insert into public.tentatives_connexion (telephone, reussie) values (v_tel, true);
  insert into public.journal_activite (acteur, action, table_cible, ligne_cible)
  values (auth.uid(), 'changement_code_par_admin', 'profils', v_id);
  return jsonb_build_object('ok', true, 'message', 'Code changé et numéro débloqué.');
end $$;
revoke execute on function public.admin_changer_code(text,text) from public, anon;
grant execute on function public.admin_changer_code(text,text) to authenticated;

-- connexion : les échecs comptent depuis le dernier succès ; le téléphone
-- ne peut plus déclarer un succès (ce qui effaçait le compteur).
create or replace function public.controle_connexion(p_telephone text, p_reussie boolean default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_tel text; v_echecs int; v_dernier timestamptz; v_restant int; v_depuis timestamptz;
begin
  v_tel := regexp_replace(coalesce(p_telephone, ''), '\D', '', 'g');
  if length(v_tel) <> 8 then return jsonb_build_object('bloque', false); end if;
  if p_reussie is false then
    insert into public.tentatives_connexion (telephone, reussie) values (v_tel, false);
  end if;
  select greatest(now() - interval '15 minutes', coalesce(max(cree_le), '-infinity'::timestamptz))
    into v_depuis from public.tentatives_connexion where telephone = v_tel and reussie;
  select count(*), max(cree_le) into v_echecs, v_dernier
    from public.tentatives_connexion
   where telephone = v_tel and not reussie and cree_le > v_depuis;
  if v_echecs >= 8 then
    v_restant := greatest(1, ceil(extract(epoch from (v_dernier + interval '15 minutes' - now())) / 60)::int);
    return jsonb_build_object('bloque', true, 'minutes', v_restant, 'essais', v_echecs);
  end if;
  return jsonb_build_object('bloque', false, 'essais', v_echecs, 'restants', greatest(0, 8 - v_echecs));
end $$;
