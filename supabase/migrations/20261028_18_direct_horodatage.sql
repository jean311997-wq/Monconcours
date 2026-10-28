-- L'heure d'un événement vient du téléphone : une horloge déréglée plaçait des actions dans le futur
-- et faussait « En direct ». Le serveur remet l'heure réelle si elle est dans le futur
-- ou vieille de plus de 2 jours (une action mise en attente hors connexion garde son heure).
create or replace function securite.horodater_evenement() returns trigger language plpgsql as $$
begin
  if new.cree_le is null or new.cree_le > now() or new.cree_le < now() - interval '2 days' then
    new.cree_le := now();
  end if;
  return new;
end $$;
drop trigger if exists trg_horodater_evenement on public.evenements;
create trigger trg_horodater_evenement before insert on public.evenements
  for each row execute function securite.horodater_evenement();

update public.evenements set cree_le = now() where cree_le > now();


create or replace function public.temps_reel()
returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
declare v_jour timestamptz := date_trunc('day', now());
begin
  if not securite.est_lecteur() then raise exception 'Réservé à l''équipe'; end if;
  return jsonb_build_object(
    'maintenant', now(),
    'actifs_5min',  (select count(distinct session_id) from public.evenements where cree_le >= now() - interval '5 minutes' and cree_le <= now()),
    'actifs_15min', (select count(distinct session_id) from public.evenements where cree_le >= now() - interval '15 minutes' and cree_le <= now()),
    'actifs_60min', (select count(distinct session_id) from public.evenements where cree_le >= now() - interval '60 minutes' and cree_le <= now()),
    'comptes_15min', (select count(distinct user_id) from public.evenements where cree_le >= now() - interval '15 minutes' and cree_le <= now() and user_id is not null),
    'visiteurs_15min', (select count(distinct session_id) from public.evenements where cree_le >= now() - interval '15 minutes' and cree_le <= now() and user_id is null),
    'compositions_en_cours', (select count(*) from public.compositions where not terminee and debut_le >= now() - interval '2 hours'),
    'compositions_jour', (select count(*) from public.compositions where debut_le >= v_jour),
    'terminees_jour', (select count(*) from public.compositions where terminee and debut_le >= v_jour),
    'inscrits_jour', (select count(*) from public.profils where cree_le >= v_jour),
    'questions_jour', (select count(*) from public.tentatives_question where cree_le >= v_jour),
    'paiements_jour', (select count(*) from public.paiements where statut = 'confirme' and montant_fcfa > 0 and coalesce(regle_le, cree_le) >= v_jour),
    'montant_jour', (select coalesce(sum(montant_fcfa), 0) from public.paiements where statut = 'confirme' and montant_fcfa > 0 and coalesce(regle_le, cree_le) >= v_jour),
    'derniere_action', (select max(cree_le) from public.evenements where cree_le <= now()),
    'derniers', coalesce((
      select jsonb_agg(jsonb_build_object('nom', nom, 'ecran', ecran, 'quand', to_char(cree_le, 'HH24:MI:SS')) order by cree_le desc)
      from (select nom, ecran, cree_le from public.evenements where cree_le <= now() order by cree_le desc limit 25) z), '[]'::jsonb)
  );
end $$;

create or replace function public.en_ligne_maintenant()
returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
begin
  if not securite.est_lecteur() then raise exception 'Réservé à l''équipe'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('user_id', z.user_id, 'nom', z.nom, 'telephone', public.tel_visible(z.telephone),
                     'derniere', z.derniere, 'ecran', z.ecran, 'action', z.action) order by z.derniere desc)
    from (select e.user_id, p.nom, p.telephone, max(e.cree_le) derniere,
                 (array_agg(e.ecran order by e.cree_le desc))[1] ecran, (array_agg(e.nom order by e.cree_le desc))[1] action
            from public.evenements e left join public.profils p on p.id = e.user_id
           where e.cree_le >= now() - interval '15 minutes' and e.cree_le <= now() and e.user_id is not null
           group by e.user_id, p.nom, p.telephone order by max(e.cree_le) desc limit 40) z), '[]'::jsonb);
end $$;
revoke all on function public.en_ligne_maintenant() from public, anon;
grant execute on function public.en_ligne_maintenant() to authenticated;
