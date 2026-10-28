-- Détail d'un bouton : qui a cliqué (lignes cliquables de « Écrans et boutons »)
create or replace function public.detail_evenement(p_type text, p_valeur text, p_du date, p_au date)
 returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
declare v_au date := least(coalesce(p_au, current_date), current_date); v_du date := least(coalesce(p_du, current_date - 29), least(coalesce(p_au, current_date), current_date));
begin
  if not securite.est_lecteur() then raise exception 'Réservé à l''équipe'; end if;
  if p_type = 'zone' then
    return coalesce((select jsonb_agg(jsonb_build_object('user_id', x.user_id, 'nom', pr.nom, 'telephone', public.tel_visible(pr.telephone),
              'minutes', x.minutes, 'visites', x.visites, 'derniere', x.derniere) order by x.minutes desc)
      from (select e.user_id, round(sum(least(coalesce((e.meta ->> 'duree_ms')::numeric, 0), 1800000)) / 60000.0, 1) minutes, count(*) visites, max(e.cree_le) derniere
              from public.evenements e
             where e.nom = 'SCREEN_LEFT' and e.meta ->> 'ecran' = p_valeur and e.cree_le::date between v_du and v_au and e.user_id is not null
             group by e.user_id order by sum(least(coalesce((e.meta ->> 'duree_ms')::numeric, 0), 1800000)) desc limit 80) x
      left join public.profils pr on pr.id = x.user_id), '[]'::jsonb);
  elsif p_type = 'bouton' then
    return coalesce((select jsonb_agg(jsonb_build_object('user_id', x.user_id, 'nom', pr.nom, 'telephone', public.tel_visible(pr.telephone),
              'visites', x.n, 'minutes', null, 'derniere', x.derniere) order by x.n desc)
      from (select e.user_id, count(*) n, max(e.cree_le) derniere from public.evenements e
             where e.nom = 'BUTTON_CLICKED' and e.element = p_valeur and e.cree_le::date between v_du and v_au and e.user_id is not null
             group by e.user_id order by count(*) desc limit 80) x
      left join public.profils pr on pr.id = x.user_id), '[]'::jsonb);
  else
    return coalesce((select jsonb_agg(jsonb_build_object('user_id', x.user_id, 'nom', pr.nom, 'telephone', public.tel_visible(pr.telephone),
              'visites', x.n, 'minutes', null, 'derniere', x.derniere) order by x.n desc)
      from (select e.user_id, count(*) n, max(e.cree_le) derniere from public.evenements e
             where e.nom = p_valeur and e.cree_le::date between v_du and v_au and e.user_id is not null
             group by e.user_id order by count(*) desc limit 80) x
      left join public.profils pr on pr.id = x.user_id), '[]'::jsonb);
  end if;
end $$;
