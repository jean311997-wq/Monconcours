-- 21 octobre 2026 : « Donnez votre avis ».
-- Après une trentaine de minutes d'utilisation, l'application propose une fenêtre légère
-- (envoyer quelques mots, ou la faire glisser pour la fermer). L'équipe reçoit les avis
-- dans l'administration, onglet « Avis ».

create table if not exists public.avis (
  id bigint generated always as identity primary key,
  -- supprimé avec le compte (suppression de compte exigée par le Play Store)
  user_id uuid references auth.users(id) on delete cascade,
  message text not null check (char_length(message) between 3 and 1000),
  statut text not null default 'nouveau' check (statut in ('nouveau','lu')),
  cree_le timestamptz not null default now()
);
create index if not exists avis_cree_le_idx on public.avis (cree_le desc);

alter table public.avis enable row level security;
create policy "avis équipe" on public.avis
  for all using (securite.est_equipe()) with check (securite.est_equipe());

-- le navigateur n'écrit jamais directement : l'envoi passe par envoyer_avis
revoke all on public.avis from anon, authenticated;
grant select, update on public.avis to authenticated;

-- Envoi d'un avis par un candidat connecté : trois par heure et dix par jour au plus
create or replace function public.envoyer_avis(p_message text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_user uuid := auth.uid(); v_msg text; v_heure int; v_jour int;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'connexion', true, 'message', 'Connectez-vous pour donner votre avis.');
  end if;
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
  insert into public.avis (user_id, message) values (v_user, v_msg);
  return jsonb_build_object('ok', true);
end $function$;

-- Lecture par l'équipe (numéros masqués hors équipe, comme dans la liste des candidats)
create or replace function public.avis_liste(p_limite integer default 100)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
begin
  if not securite.est_lecteur() then raise exception 'réservé à l''équipe'; end if;
  return coalesce((select jsonb_agg(z.x order by z.quand desc) from (
    select a.cree_le as quand,
           jsonb_build_object('id', a.id, 'message', a.message, 'statut', a.statut, 'cree_le', a.cree_le,
             'nom', p.nom, 'niveau', p.niveau,
             'telephone', case when p.telephone is null then null when securite.est_equipe() then p.telephone
                               else left(p.telephone, 2) || ' •• •• ' || right(p.telephone, 2) end) as x
      from public.avis a left join public.profils p on p.id = a.user_id
     order by a.cree_le desc
     limit least(greatest(coalesce(p_limite, 100), 1), 300)) z), '[]'::jsonb);
end $function$;

revoke all on function public.envoyer_avis(text), public.avis_liste(integer) from public, anon;
grant execute on function public.envoyer_avis(text), public.avis_liste(integer) to authenticated;
