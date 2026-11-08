-- 1. Les comptes de l'administration apparaissent toujours sous leur signature (classement, discussion, défis, top).
create or replace function public.nom_public(p_user uuid)
 returns text language sql stable security definer set search_path to 'public'
as $f$
  select coalesce((select s.nom from public.communaute_signatures s where s.user_id = p_user), nullif(trim(nom), ''), 'Candidat')
    from public.profils where id = p_user;
$f$;
create or replace function public.nom_resultat(p_user uuid, p_epreuve uuid)
 returns text language sql stable security definer set search_path to 'public'
as $f$
  select coalesce(
    (select s.nom from public.communaute_signatures s where s.user_id = p_user),
    case when coalesce((select afficher_nom from public.inscriptions_epreuve where epreuve_id = p_epreuve and user_id = p_user), true)
         then coalesce(nullif(trim(p.nom), ''), 'Candidat') else 'Candidat anonyme' end)
    from public.profils p where p.id = p_user;
$f$;
-- 2. Discussion : nombre de personnes qui la regardent (présence sur 30 secondes).
create table if not exists public.discussion_vues(
  epreuve_id uuid not null, user_id uuid not null, vu_le timestamptz not null default now(),
  primary key(epreuve_id, user_id));
alter table public.discussion_vues enable row level security;
revoke all on public.discussion_vues from anon, authenticated;
do $do$
declare d text;
begin
  d := pg_get_functiondef('public.discussion_charger(uuid)'::regprocedure);
  d := replace(d, '  select count(*) into v_n from public.discussion_messages where epreuve_id = p_epreuve;',
    '  insert into public.discussion_vues(epreuve_id, user_id, vu_le) values (p_epreuve, v_user, now()) on conflict (epreuve_id, user_id) do update set vu_le = now();'
    || E'\n' || '  select count(*) into v_n from public.discussion_messages where epreuve_id = p_epreuve;');
  d := replace(d, '''ecrivent'', v_ecr,',
    '''ecrivent'', v_ecr, ''voient'', (select count(*) from public.discussion_vues where epreuve_id = p_epreuve and vu_le > now() - interval ''30 seconds''),');
  execute d;
end $do$;
