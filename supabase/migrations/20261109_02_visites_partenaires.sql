-- Visiteurs venus par le lien d'un partenaire (?p=CODE) : une ligne par visiteur, avec le nombre de passages.
create table if not exists public.partenaire_visites (
  partenaire_id uuid not null references public.partenaires(id) on delete cascade,
  visiteur text not null check (char_length(visiteur) between 8 and 80),
  premiere_le timestamptz not null default now(),
  derniere_le timestamptz not null default now(),
  nb integer not null default 1,
  primary key (partenaire_id, visiteur)
);
alter table public.partenaire_visites enable row level security;
revoke all on public.partenaire_visites from anon, authenticated;

create or replace function public.noter_visite_partenaire(p_code text, p_visiteur text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_id uuid;
begin
  if p_visiteur is null or char_length(p_visiteur) < 8 or char_length(p_visiteur) > 80 then return; end if;
  select id into v_id from partenaires where code = upper(trim(coalesce(p_code, ''))) and actif;
  if v_id is null then return; end if;
  insert into partenaire_visites (partenaire_id, visiteur) values (v_id, p_visiteur)
  on conflict (partenaire_id, visiteur) do update set nb = partenaire_visites.nb + 1, derniere_le = now();
end $function$;
revoke all on function public.noter_visite_partenaire(text, text) from public;
grant execute on function public.noter_visite_partenaire(text, text) to anon, authenticated;

-- Le résumé du partenaire reçoit le nombre de visiteurs (l'ancien calcul est gardé tel quel).
alter function public.partenaire_donnees(uuid, boolean) rename to partenaire_donnees_base;
create or replace function public.partenaire_donnees(p_id uuid, p_admin boolean)
 returns jsonb
 language sql
 stable
 security definer
 set search_path to 'public'
as $$
  select jsonb_set(b, '{resume,visiteurs}', to_jsonb((select count(*) from partenaire_visites v where v.partenaire_id = p_id)))
    from (select public.partenaire_donnees_base(p_id, p_admin) as b) x
   where b is not null;
$$;
revoke all on function public.partenaire_donnees(uuid, boolean) from public, anon, authenticated;
revoke all on function public.partenaire_donnees_base(uuid, boolean) from public, anon, authenticated;
