create table if not exists securite.relance_manuelle (
  user_id uuid primary key references auth.users(id) on delete cascade,
  relance_le timestamptz not null default now(),
  par uuid,
  nb integer not null default 1
);
alter table securite.relance_manuelle enable row level security;

create or replace function public.admin_relance_manuelle()
returns jsonb language plpgsql security definer set search_path to 'public' as $f$
declare r jsonb; v_jour date;
begin
  if not exists (select 1 from roles_utilisateur where user_id = auth.uid() and role in ('admin','investisseur')) then
    return jsonb_build_object('ok', false);
  end if;
  select max(jour) into v_jour from suivi_fidelisation;
  with base as (
    select s.user_id, s.groupe, s.jours_14j, s.compositions, s.abonne,
           p.nom, p.telephone,
           (select max(x.debut_le) from sessions x where x.user_id = s.user_id) derniere,
           m.relance_le, m.nb,
           coalesce((select pp.nom from profils pp where pp.id = m.par), 'équipe') par_nom
    from suivi_fidelisation s
    join profils p on p.id = s.user_id
    left join securite.relance_manuelle m on m.user_id = s.user_id
    where s.jour = v_jour and not s.a_notifs
  )
  select jsonb_build_object('ok', true, 'jour', v_jour,
    'liste', coalesce(jsonb_agg(jsonb_build_object(
        'id', user_id, 'nom', nom, 'tel', telephone, 'groupe', groupe, 'jours', jours_14j,
        'compos', compositions, 'abonne', abonne, 'derniere', derniere,
        'relance_le', relance_le, 'nb', nb, 'par', par_nom,
        'revenu', (relance_le is not null and derniere is not null and derniere > relance_le))
      order by (relance_le is not null),
               case groupe when 'noyau' then 1 when 'regulier' then 2 else 3 end,
               jours_14j desc, nom), '[]'::jsonb))
  into r from base;
  return r;
end $f$;

create or replace function public.admin_relance_manuelle_marquer(p_user uuid, p_fait boolean default true)
returns jsonb language plpgsql security definer set search_path to 'public' as $f$
begin
  if not exists (select 1 from roles_utilisateur where user_id = auth.uid() and role in ('admin','investisseur')) then
    return jsonb_build_object('ok', false);
  end if;
  if p_fait then
    insert into securite.relance_manuelle(user_id, par) values (p_user, auth.uid())
      on conflict (user_id) do update set relance_le = now(), par = auth.uid(), nb = securite.relance_manuelle.nb + 1;
  else
    delete from securite.relance_manuelle where user_id = p_user;
  end if;
  return jsonb_build_object('ok', true);
end $f$;

revoke all on function public.admin_relance_manuelle() from public, anon;
revoke all on function public.admin_relance_manuelle_marquer(uuid, boolean) from public, anon;
grant execute on function public.admin_relance_manuelle() to authenticated;
grant execute on function public.admin_relance_manuelle_marquer(uuid, boolean) to authenticated;
