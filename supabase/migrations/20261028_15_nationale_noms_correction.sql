-- Les classements affichent le nom et le prénom, jamais le pseudo.
create or replace function public.nom_resultat(p_user uuid, p_epreuve uuid)
returns text language sql stable security definer set search_path to 'public' as $$
  select case when coalesce((select afficher_nom from public.inscriptions_epreuve where epreuve_id = p_epreuve and user_id = p_user), true)
              then coalesce(nullif(trim(p.nom), ''), 'Candidat') else 'Candidat anonyme' end
    from public.profils p where p.id = p_user;
$$;

create or replace function public.nom_public(p_user uuid)
returns text language sql stable security definer set search_path to 'public' as $$
  select coalesce(nullif(trim(nom), ''), 'Candidat') from public.profils where id = p_user;
$$;

create or replace function public.top_semaine()
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_user uuid := auth.uid(); v_debut timestamptz := date_trunc('week', now());
begin
  return (with s as (
      select pj.user_id, sum(pj.points) pts from public.points_journal pj
       where pj.cree_le >= v_debut group by pj.user_id having sum(pj.points) > 0),
    r as (select s.*, public.nom_public(s.user_id) nom, p.pseudo, rank() over (order by s.pts desc) rang from s join public.profils p on p.id = s.user_id)
    select jsonb_build_object(
      'depuis', v_debut,
      'top', coalesce((select jsonb_agg(jsonb_build_object('rang', rang, 'nom', nom, 'pseudo', pseudo, 'points', pts, 'moi', user_id = v_user) order by rang, nom)
                         from (select * from r order by rang limit 10) z), '[]'::jsonb),
      'moi', (select jsonb_build_object('rang', rang, 'points', pts, 'nom', nom, 'pseudo', pseudo) from r where user_id = v_user),
      'participants', (select count(*) from r)));
end $$;

-- classement : la clé « pseudo » reprend le nom (compatibilité des anciens écrans en cache)
-- (classement_epreuve utilise déjà nom_resultat pour « nom » et « pseudo »)

-- La dernière composition nationale terminée, visible par tous (même sans compte).
create or replace function public.derniere_nationale()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_ep record; v_conc text;
begin
  select * into v_ep from public.epreuves_collectives
   where statut = 'programmee' and fin_le <= now()
     and exists (select 1 from public.compositions c where c.epreuve_id = epreuves_collectives.id and c.terminee)
   order by fin_le desc limit 1;
  if not found then return null; end if;
  select nom into v_conc from public.concours where id = v_ep.concours_id;
  return jsonb_build_object('id', v_ep.id, 'titre', v_ep.titre, 'concours', v_conc,
    'debut_le', v_ep.debut_le, 'fin_le', v_ep.fin_le, 'places', v_ep.places,
    'participants', (select count(*) from public.compositions where epreuve_id = v_ep.id and terminee));
end $$;
grant execute on function public.derniere_nationale() to anon, authenticated;

-- Le corrigé général d'une composition terminée : questions, bonnes réponses,
-- explication et taux de réussite. Ouvert à tous une fois l'épreuve finie.
create or replace function public.correction_epreuve(p_epreuve uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_ep record; v_q jsonb; v_n int;
begin
  select * into v_ep from public.epreuves_collectives where id = p_epreuve and statut = 'programmee';
  if not found then return jsonb_build_object('ok', false, 'message', 'Composition introuvable.'); end if;
  if now() < v_ep.fin_le then
    return jsonb_build_object('ok', true, 'publie', false, 'fin_le', v_ep.fin_le);
  end if;
  -- un sujet encore programmé pour une épreuve à venir reste secret
  if exists (select 1 from public.epreuves_collectives e2
              where e2.sujet_id = v_ep.sujet_id and e2.id <> v_ep.id and e2.statut = 'programmee' and e2.fin_le > now()) then
    return jsonb_build_object('ok', true, 'publie', false, 'fin_le', null);
  end if;
  select count(*) into v_n from public.compositions where epreuve_id = v_ep.id and terminee;
  select coalesce(jsonb_agg(jsonb_build_object(
           'enonce', q.enonce, 'matiere', m.nom, 'explication', q.explication,
           'options', (select jsonb_agg(o.texte order by o.position) from public.question_options o where o.question_id = q.id),
           'bonnes', to_jsonb(public.bonnes_reponses(q.id)),
           'reussite', case when v_n > 0 then round(100.0 * (
               select count(*) from public.composition_reponses r join public.compositions c on c.id = r.composition_id
                where c.epreuve_id = v_ep.id and c.terminee and r.question_id = q.id and r.correcte) / v_n) end)
         order by sq.position), '[]'::jsonb)
    into v_q
    from public.sujet_questions sq join public.questions q on q.id = sq.question_id
    left join public.matieres m on m.id = q.matiere_id
   where sq.sujet_id = v_ep.sujet_id;
  return jsonb_build_object('ok', true, 'publie', true, 'titre', v_ep.titre, 'participants', v_n, 'questions', v_q);
end $$;
grant execute on function public.correction_epreuve(uuid) to anon, authenticated;
