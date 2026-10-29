-- 29 octobre 2026 : la composition nationale programmée toute seule passe à 18 h 00 (heure de Ouagadougou = UTC),
-- et le message de fin ne cite plus ni jour ni heure fixes.
create or replace function public.planifier_composition_nationale()
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_samedi timestamptz; v_c record; v_s record; v_id uuid;
begin
  v_samedi := (date_trunc('week', now() at time zone 'UTC') + interval '5 days 18 hours') at time zone 'UTC';
  if v_samedi <= now() then v_samedi := v_samedi + interval '7 days'; end if;
  if exists (select 1 from public.epreuves_collectives where statut = 'programmee'
              and debut_le >= v_samedi - interval '12 hours' and debut_le < v_samedi + interval '12 hours') then
    return jsonb_build_object('ok', true, 'deja', true);
  end if;
  select c.* into v_c from public.concours c where c.actif
   order by (select max(e.debut_le) from public.epreuves_collectives e where e.concours_id = c.id) asc nulls first, random()
   limit 1;
  if not found then return jsonb_build_object('ok', false, 'message', 'Aucun concours actif.'); end if;
  select s.* into v_s from public.sujets s
   where s.statut = 'publie' and exists (select 1 from public.sujet_questions q where q.sujet_id = s.id)
   order by (s.niveau = v_c.niveau_requis) desc nulls last,
            exists (select 1 from public.epreuves_collectives e where e.sujet_id = s.id),
            (select count(*) from public.compositions c where c.sujet_id = s.id), random()
   limit 1;
  if not found then return jsonb_build_object('ok', false, 'message', 'Aucun sujet publié.'); end if;
  insert into public.epreuves_collectives (titre, sujet_id, debut_le, fin_le, concours_id, places, message)
  values ('Composition nationale · ' || v_c.nom, v_s.id, v_samedi,
          v_samedi + make_interval(secs => coalesce(v_s.duree_secondes, 1500)), v_c.id, coalesce(v_c.nb_places, 30),
          'Félicitations à tous les admis. La prochaine composition nationale est annoncée dans l''application.')
  returning id into v_id;
  perform public.annoncer_epreuve(v_id);
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;
