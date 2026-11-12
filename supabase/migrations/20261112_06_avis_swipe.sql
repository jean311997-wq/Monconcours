-- Avis donnés depuis le mode Swipe : même table, même section admin, étiquette « Avis mode Swipe ».
alter table public.avis add column if not exists origine text;
alter table public.avis drop constraint if exists avis_origine_ck;
alter table public.avis add constraint avis_origine_ck check (origine is null or origine in ('swipe'));

drop function if exists public.envoyer_avis(text);
create or replace function public.envoyer_avis(p_message text, p_origine text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_user uuid := auth.uid(); v_msg text; v_heure int; v_jour int; v_orig text;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'connexion', true, 'message', 'Connectez-vous pour donner votre avis.');
  end if;
  v_orig := case when p_origine = 'swipe' then 'swipe' else null end;
  v_msg := btrim(regexp_replace(coalesce(p_message, ''), '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g'));
  if char_length(v_msg) < 3 then
    return jsonb_build_object('ok', false, 'message', 'Écrivez quelques mots avant d''envoyer.');
  end if;
  if char_length(v_msg) > 1000 then
    return jsonb_build_object('ok', false, 'message', 'Mille caractères au plus, s''il vous plaît.');
  end if;
  select count(*) filter (where cree_le > now() - interval '1 hour'), count(*)
    into v_heure, v_jour from public.avis where user_id = v_user and cree_le > now() - interval '1 day';
  if v_heure >= 3 or v_jour >= 10 then
    return jsonb_build_object('ok', false, 'message', 'Merci, nous avons bien reçu vos avis. Réessayez un peu plus tard.');
  end if;
  insert into public.avis (user_id, message, origine) values (v_user, v_msg, v_orig);
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.envoyer_avis(text, text) from public, anon;
grant execute on function public.envoyer_avis(text, text) to authenticated;

create or replace function public.avis_liste(p_limite integer default 100)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not securite.est_lecteur() then raise exception 'réservé à l''équipe'; end if;
  return coalesce((select jsonb_agg(z.x order by z.quand desc) from (
    select a.cree_le as quand,
           jsonb_build_object('id', a.id, 'user_id', a.user_id, 'message', a.message, 'statut', a.statut, 'cree_le', a.cree_le,
             'reponse', a.reponse, 'reponse_le', a.reponse_le, 'aime', a.aime, 'vitrine', a.vitrine, 'origine', a.origine,
             'nom', p.nom, 'niveau', p.niveau,
             'telephone', case when p.telephone is null then null when securite.est_equipe() then p.telephone
                               else left(p.telephone, 2) || ' •• •• ' || right(p.telephone, 2) end) as x
      from public.avis a left join public.profils p on p.id = a.user_id
     order by a.cree_le desc
     limit least(greatest(coalesce(p_limite, 100), 1), 300)) z), '[]'::jsonb);
end $$;

create or replace function public.alerte_avis() returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_nom text;
begin
  select nom into v_nom from public.profils where id = new.user_id;
  perform public.alerter_admins(case when new.origine = 'swipe' then 'Nouvel avis mode Swipe' else 'Nouvel avis' end,
    coalesce(v_nom, 'Un candidat') || ' : ' || left(new.message, 110), '/admin.html#avis', 'avis-' || new.id);
  return new;
end $$;
