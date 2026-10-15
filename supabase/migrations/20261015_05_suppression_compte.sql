-- Suppression du compte par le candidat lui-même (exigence du Play Store).
-- Le code secret est redemandé : quelqu'un qui tient un téléphone déjà
-- connecté ne peut pas effacer le compte d'un autre.
create or replace function public.supprimer_mon_compte(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_user uuid := auth.uid(); v_tel text; v_mdp text; v_code text;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'message', 'Connectez-vous d''abord.'); end if;
  v_code := regexp_replace(coalesce(p_code, ''), '\D', '', 'g');
  select telephone into v_tel from public.profils where id = v_user;
  select encrypted_password into v_mdp from auth.users where id = v_user;
  if v_tel is null or v_mdp is null or length(v_code) <> 4
     or extensions.crypt(v_tel || '#' || v_code, v_mdp) <> v_mdp then
    if v_tel is not null then
      insert into public.tentatives_connexion (telephone, reussie) values (v_tel, false);
    end if;
    return jsonb_build_object('ok', false, 'message', 'Code secret incorrect.');
  end if;

  -- ce qui n'est pas relié au compte par une clé (le reste part avec lui)
  delete from public.defis_scores where user_id = v_user;
  delete from public.defis_invitations where invite = v_user;
  delete from public.defis_invitations where defi_id in (select id from public.defis where auteur = v_user);
  delete from public.defis_scores where defi_id in (select id from public.defis where auteur = v_user);
  delete from public.defis where auteur = v_user;
  delete from public.inscriptions_epreuve where user_id = v_user;
  delete from public.lectures where user_id = v_user;
  delete from public.push_file where user_id = v_user;
  delete from public.push_abonnements where user_id = v_user;
  delete from public.reponses_question_jour where user_id = v_user;
  delete from public.reactions_epreuve where auteur = v_user;
  delete from public.signalements where user_id = v_user;
  delete from public.tentatives_connexion where telephone = v_tel;
  delete from public.tentatives_reinit where telephone = v_tel;

  insert into public.journal_activite (acteur, action, table_cible, ligne_cible)
  values (null, 'suppression_compte', 'profils', null);

  -- le compte, son profil, ses compositions, erreurs, points, notifications…
  delete from auth.users where id = v_user;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.supprimer_mon_compte(text) from public, anon;
grant execute on function public.supprimer_mon_compte(text) to authenticated;
