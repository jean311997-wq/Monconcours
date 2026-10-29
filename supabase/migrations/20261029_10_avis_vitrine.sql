-- Quelques avis réels, sans nom, affichés sur l'écran d'accueil. L'équipe choisit lesquels (colonne vitrine).
alter table public.avis add column if not exists vitrine boolean not null default false;
create or replace function public.avis_vitrine() returns jsonb language sql stable security definer set search_path to 'public' as $$
  select coalesce(jsonb_agg(jsonb_build_object('message', m.message) order by m.cree_le desc), '[]'::jsonb)
    from (select message, cree_le from public.avis where vitrine and length(message) between 8 and 200 order by cree_le desc limit 3) m;
$$;
grant execute on function public.avis_vitrine() to anon, authenticated;
create or replace function public.admin_avis_vitrine(p_id bigint, p_val boolean) returns jsonb language plpgsql security definer set search_path to 'public' as $$
begin
  if not securite.est_equipe() then raise exception 'Réservé à l''équipe'; end if;
  update public.avis set vitrine = coalesce(p_val, false) where id = p_id;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.admin_avis_vitrine(bigint, boolean) from public, anon;
grant execute on function public.admin_avis_vitrine(bigint, boolean) to authenticated;
