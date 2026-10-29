-- Les minutes passées sur le site ne comptaient que les visites fermées proprement (7 %).
-- La durée de chaque session se cumule désormais à chaque écran quitté, et l'historique est recalculé.
update public.sessions s set duree_active_s = x.sec
  from (select session_id, least(round(sum(least(coalesce((meta->>'duree_ms')::numeric,0),1800000))/1000.0)::int, 86400) sec
          from public.evenements where nom = 'SCREEN_LEFT' and session_id is not null group by session_id) x
 where s.id = x.session_id and x.sec > coalesce(s.duree_active_s, 0);

create or replace function public.session_cumuler_ecran() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  update public.sessions set duree_active_s = least(coalesce(duree_active_s, 0) + round(least(coalesce((new.meta->>'duree_ms')::numeric, 0), 1800000) / 1000.0)::int, 86400)
   where id = new.session_id;
  return null;
end $$;
create or replace trigger trg_session_cumuler_ecran after insert on public.evenements
  for each row when (new.nom = 'SCREEN_LEFT') execute function public.session_cumuler_ecran();
-- fermer_session : garde la plus grande des deux durées (cumul des écrans ou durée mesurée à la fermeture)
