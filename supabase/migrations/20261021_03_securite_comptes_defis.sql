-- 21 octobre 2026 : sécurité des comptes et des défis (audit avant lancement).
--
-- 1. Changer un code ferme toutes les sessions ouvertes de la personne
--    (reinitialiser_code et admin_changer_code).
-- 2. Plus personne ne peut modifier sa propre ligne de profil directement
--    (numéro, couleur, pseudo…). Seules les fonctions serveur le font
--    (definir_concours, definir_objectif).
-- 3. inviter_defi : trente invitations par jour au plus, plus de liste
--    de numéros absents, plus de décompte qui révèle qui est inscrit.

-- 1a. Réinitialisation du code par la personne (couleur secrète)
create or replace function public.reinitialiser_code(p_telephone text, p_couleur text, p_nouveau text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
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
  -- toutes les connexions déjà ouvertes (autres téléphones) sont fermées :
  -- les jetons sont révoqués et les sessions expirées, sans rien effacer
  update auth.refresh_tokens set revoked = true, updated_at = now()
   where user_id = v_id::text and not revoked;
  update auth.sessions set not_after = now(), updated_at = now() where user_id = v_id;
  insert into public.tentatives_reinit (telephone, reussie) values (v_tel, true);
  insert into public.journal_activite (acteur, action, table_cible, ligne_cible)
  values (null, 'reinitialisation_code', 'profils', v_id);
  perform public.creer_notification(v_id, 'securite', 'Votre code a été changé',
    'Votre code secret a été changé le ' || to_char(now() at time zone 'Africa/Ouagadougou', 'DD/MM/YYYY à HH24:MI') ||
    '. Si ce n''est pas vous, écrivez tout de suite à l''administrateur sur WhatsApp.', null);
  return jsonb_build_object('ok', true, 'message', 'Code changé. Connectez-vous avec le nouveau code.');
end $function$;

-- 1b. Changement du code par l'administrateur
create or replace function public.admin_changer_code(p_telephone text, p_nouveau text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
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
  -- toutes les connexions déjà ouvertes (autres téléphones) sont fermées :
  -- les jetons sont révoqués et les sessions expirées, sans rien effacer
  update auth.refresh_tokens set revoked = true, updated_at = now()
   where user_id = v_id::text and not revoked;
  update auth.sessions set not_after = now(), updated_at = now() where user_id = v_id;
  -- un succès enregistré remet les compteurs à zéro (déblocage)
  insert into public.tentatives_reinit (telephone, reussie) values (v_tel, true);
  insert into public.tentatives_connexion (telephone, reussie) values (v_tel, true);
  insert into public.journal_activite (acteur, action, table_cible, ligne_cible)
  values (auth.uid(), 'changement_code_par_admin', 'profils', v_id);
  return jsonb_build_object('ok', true, 'message', 'Code changé et numéro débloqué.');
end $function$;

-- 2. Le profil ne se modifie plus directement depuis le navigateur.
--    Lecture et inscription restent comme avant ; definir_concours et
--    definir_objectif (fonctions serveur) continuent de fonctionner.
revoke update on public.profils from anon, authenticated;

-- 3. Invitations à un défi
create or replace function public.inviter_defi(p_defi uuid, p_telephones text[], p_pseudos text[])
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_user uuid := auth.uid(); v_d record; v_tel text; v_chiffres text; v_cible uuid; v_nom text; v_mat text;
  v_demandes int; v_jour int; v_ps text; v_moi text;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'connexion', true); end if;
  select d.*, m.nom matiere into v_d from public.defis d left join public.matieres m on m.id = d.matiere_id where d.id = p_defi;
  if not found or v_d.auteur <> v_user then return jsonb_build_object('ok', false, 'message', 'Défi introuvable.'); end if;
  if (select count(*) from public.defis_invitations where defi_id = p_defi) + coalesce(array_length(p_telephones, 1), 0)
     + coalesce(array_length(p_pseudos, 1), 0) > 10 then
    return jsonb_build_object('ok', false, 'message', 'Dix invités au plus par défi.'); end if;

  -- plafond par personne et par jour : trente numéros ou pseudos essayés au plus
  select count(*) into v_demandes from unnest(coalesce(p_telephones, '{}')) t
   where length(right(regexp_replace(t, '\D', '', 'g'), 8)) = 8;
  v_demandes := v_demandes + (select count(*) from unnest(coalesce(p_pseudos, '{}')) s where length(trim(s)) > 0);
  if v_demandes > 0 then
    insert into securite.compteurs (cle, minute, n)
    values ('inviter:' || v_user, date_trunc('day', now()), v_demandes)
    on conflict (cle, minute) do update set n = securite.compteurs.n + v_demandes
    returning n into v_jour;
    if v_jour > 30 then
      update securite.compteurs set n = n - v_demandes
       where cle = 'inviter:' || v_user and minute = date_trunc('day', now());
      return jsonb_build_object('ok', false,
        'message', 'Trente invitations par jour au plus. Réessayez demain, ou envoyez le défi par WhatsApp.');
    end if;
  end if;

  -- nom affiché : celui du profil de l'appelant, jamais une saisie de l'appelant
  v_nom := left(regexp_replace(coalesce(public.nom_public(v_user), 'Un ami'), '[[:cntrl:]]', '', 'g'), 40);
  v_moi := left(regexp_replace(coalesce((select pseudo from public.profils where id = v_user), v_nom), '[[:cntrl:]]', '', 'g'), 40);
  v_mat := coalesce(v_d.libelle, v_d.matiere, 'toutes matières');

  foreach v_tel in array coalesce(p_telephones, '{}') loop
    v_chiffres := right(regexp_replace(v_tel, '\D', '', 'g'), 8);
    if length(v_chiffres) <> 8 then continue; end if;
    select id into v_cible from public.profils
     where right(regexp_replace(coalesce(telephone, ''), '\D', '', 'g'), 8) = v_chiffres and id <> v_user limit 1;
    -- numéro sans compte : aucune trace, aucune réponse différente
    if v_cible is null then continue; end if;
    insert into public.defis_invitations (defi_id, invite) values (p_defi, v_cible) on conflict do nothing;
    if found then
      perform public.notifier(v_cible, 'defi', 'Défi de ' || v_nom,
        v_nom || ' vous défie : ' || array_length(v_d.questions, 1) || ' questions (' || v_mat || ') en '
        || round(v_d.duree_secondes / 60.0) || ' minutes. Acceptez-vous le défi ?',
        'defi-' || p_defi, 'defi:' || p_defi, true);
    end if;
    v_cible := null;
  end loop;

  foreach v_ps in array coalesce(p_pseudos, '{}') loop
    select id into v_cible from public.profils where pseudo = v_ps and id <> v_user;
    if v_cible is null then continue; end if;
    insert into public.defis_invitations (defi_id, invite) values (p_defi, v_cible) on conflict do nothing;
    if found then
      perform public.notifier(v_cible, 'defi', 'Défi de ' || v_moi,
        v_moi || ' (top 10 de la semaine) vous défie : '
        || array_length(v_d.questions, 1) || ' questions (' || v_mat || ') en ' || round(v_d.duree_secondes / 60.0)
        || ' minutes. Acceptez-vous le défi ?',
        'defi-' || p_defi, 'defi:' || p_defi, true);
    end if;
    v_cible := null;
  end loop;

  -- la réponse ne dépend pas de qui est inscrit : on renvoie le nombre de numéros
  -- reçus, jamais le nombre de personnes trouvées, et plus de liste de numéros absents
  return jsonb_build_object('ok', true, 'invites', v_demandes, 'introuvables', '[]'::jsonb);
end $function$;
