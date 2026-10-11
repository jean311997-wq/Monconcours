-- =====================================================================
-- 11 octobre 2026 · Phase gratuite
-- Tant que mode_gratuit vaut true, tout candidat connecté compose et
-- corrige sans limite. Pour passer au payant plus tard :
--   update securite.parametres set valeur = 'false' where cle = 'mode_gratuit';
-- =====================================================================
create table if not exists securite.parametres (
  cle text primary key,
  valeur jsonb not null,
  maj_le timestamptz not null default now()
);
alter table securite.parametres enable row level security;
revoke all on securite.parametres from public, anon, authenticated;

insert into securite.parametres (cle, valeur) values ('mode_gratuit', 'true')
on conflict (cle) do update set valeur = excluded.valeur, maj_le = now();

create or replace function securite.mode_gratuit()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select (valeur)::text::boolean from securite.parametres where cle = 'mode_gratuit'), false);
$$;
revoke execute on function securite.mode_gratuit() from public, anon, authenticated;

create or replace function securite.est_abonne(p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select securite.mode_gratuit()
      or exists (select 1 from public.abonnements
                  where user_id = p_user and fin_le > now() and annule_le is null);
$$;
revoke execute on function securite.est_abonne(uuid) from public, anon, authenticated;

-- L'application sait si le payant est actif, pour masquer les formules
create or replace function public.plateforme_gratuite()
returns boolean language sql stable security definer set search_path = public as $$
  select securite.mode_gratuit();
$$;
revoke execute on function public.plateforme_gratuite() from public;
grant execute on function public.plateforme_gratuite() to anon, authenticated;
