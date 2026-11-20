alter table public.avis add column if not exists partage_propose_le timestamptz;

create or replace function public.partage_avis_etat() returns jsonb language sql stable security definer set search_path = public as $f$
  select jsonb_build_object('afficher', exists (
    select 1 from public.avis
     where user_id = auth.uid() and aime and reponse is not null
       and reponse_le <= now() - interval '30 minutes' and partage_propose_le is null))
$f$;

create or replace function public.partage_avis_vu() returns jsonb language plpgsql security definer set search_path = public as $f$
begin
  update public.avis set partage_propose_le = now()
   where user_id = auth.uid() and aime and reponse is not null
     and reponse_le <= now() - interval '30 minutes' and partage_propose_le is null;
  return jsonb_build_object('ok', true);
end $f$;

revoke all on function public.partage_avis_etat() from public, anon;
revoke all on function public.partage_avis_vu() from public, anon;
grant execute on function public.partage_avis_etat() to authenticated;
grant execute on function public.partage_avis_vu() to authenticated;
