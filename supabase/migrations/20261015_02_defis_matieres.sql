-- 15 octobre 2026 (2) — défi sur plusieurs matières, feuille corrigée du défi
-- retrouvable, accepter un défi après l'avoir refusé.
alter table public.defis add column if not exists libelle text;
alter table public.defis_scores add column if not exists reponses jsonb;

create or replace function public.creer_defi_matieres(p_matieres text[], p_niveau text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_ids uuid[]; v_niveau public.niveau_scolaire; v_q uuid[]; v_id uuid; v_noms text[];
begin
  if v_user is null then return jsonb_build_object('ok', false, 'connexion', true, 'message', 'Créez votre compte pour lancer un défi.'); end if;
  if (select count(*) from public.defis where auteur = v_user and cree_le > now() - interval '1 day') >= 20 then
    return jsonb_build_object('ok', false, 'message', 'Vingt défis par jour au plus.'); end if;
  begin v_niveau := nullif(p_niveau, '')::public.niveau_scolaire; exception when others then v_niveau := null; end;
  select array_agg(id), array_agg(nom order by ordre) into v_ids, v_noms from public.matieres where nom = any(coalesce(p_matieres, '{}'));
  select array_agg(id) into v_q from (
    select q.id from public.questions q
     where q.statut = 'publie' and (v_ids is null or q.matiere_id = any(v_ids))
       and (v_niveau is null or q.niveau = v_niveau or q.niveau is null) and public.matiere_du_niveau(q.matiere_id, v_niveau)
       and (select count(*) from public.question_options o where o.question_id = q.id) >= 2
       and not public.question_gardee(q.id)
     order by random() limit 10) z;
  if coalesce(array_length(v_q, 1), 0) < 5 then
    return jsonb_build_object('ok', false, 'message', 'Pas assez de questions dans ces matières pour un défi.'); end if;
  insert into public.defis (auteur, matiere_id, questions, libelle)
  values (v_user, case when array_length(v_ids, 1) = 1 then v_ids[1] end, v_q,
          case when array_length(v_noms, 1) > 1 then array_to_string(v_noms, ', ') end)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;
revoke all on function public.creer_defi_matieres(text[], text) from public, anon, authenticated;
grant execute on function public.creer_defi_matieres(text[], text) to authenticated;

create or replace function public.ouvrir_defi(p_defi uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_d record; v_s record; v_restant int; v_mat text;
begin
  select d.*, m.nom matiere into v_d from public.defis d left join public.matieres m on m.id = d.matiere_id where d.id = p_defi;
  if not found then return jsonb_build_object('ok', false, 'message', 'Défi introuvable.'); end if;
  v_mat := coalesce(v_d.libelle, v_d.matiere);
  if v_user is null then
    return jsonb_build_object('ok', false, 'connexion', true, 'matiere', v_mat, 'auteur', public.nom_public(v_d.auteur),
      'message', 'Créez votre compte gratuit pour relever ce défi.');
  end if;
  if exists (select 1 from public.defis_invitations where defi_id = p_defi and invite = v_user and statut <> 'accepte')
     and not exists (select 1 from public.defis_scores where defi_id = p_defi and user_id = v_user) then
    return jsonb_build_object('ok', true, 'invitation', (select statut from public.defis_invitations where defi_id = p_defi and invite = v_user),
      'id', v_d.id, 'matiere', v_mat, 'auteur', public.nom_public(v_d.auteur), 'duree', v_d.duree_secondes,
      'nb', array_length(v_d.questions, 1));
  end if;
  select * into v_s from public.defis_scores where defi_id = p_defi and user_id = v_user;
  if found and v_s.termine then
    return jsonb_build_object('ok', true, 'termine', true, 'id', v_d.id, 'matiere', v_mat, 'auteur', public.nom_public(v_d.auteur),
      'mien', v_d.auteur = v_user, 'score', v_s.score, 'sur', array_length(v_d.questions, 1), 'duree', v_s.duree_secondes,
      'reponses', coalesce(v_s.reponses, '{}'::jsonb),
      'questions', (select jsonb_agg(jsonb_build_object('id', q.id, 'enonce', q.enonce,
          'options', (select jsonb_agg(o.texte order by o.position) from public.question_options o where o.question_id = q.id),
          'bonnes', to_jsonb(public.bonnes_reponses(q.id)))
          order by array_position(v_d.questions, q.id))
        from public.questions q where q.id = any(v_d.questions)),
      'resultat', public.resultat_defi(p_defi));
  end if;
  if not found then
    insert into public.defis_scores (defi_id, user_id) values (p_defi, v_user) returning * into v_s;
  end if;
  v_restant := greatest(0, v_d.duree_secondes - floor(extract(epoch from now() - v_s.debut_le))::int);
  return jsonb_build_object('ok', true, 'termine', false, 'id', v_d.id, 'matiere', v_mat,
    'auteur', public.nom_public(v_d.auteur), 'mien', v_d.auteur = v_user, 'duree', v_d.duree_secondes, 'restant', v_restant,
    'questions', (select jsonb_agg(jsonb_build_object('id', q.id, 'enonce', q.enonce,
        'options', (select jsonb_agg(o.texte order by o.position) from public.question_options o where o.question_id = q.id))
        order by array_position(v_d.questions, q.id))
      from public.questions q where q.id = any(v_d.questions)));
end $$;

-- la copie du défi est gardée pour la feuille corrigée
do $do$
declare d text;
begin
  d := pg_get_functiondef('public.remettre_defi(uuid,jsonb)'::regprocedure);
  if position('reponses = p_reponses' in d) = 0 then
    d := replace(d, 'update public.defis_scores set score = v_score, duree_secondes = v_duree, termine = true',
                    'update public.defis_scores set score = v_score, duree_secondes = v_duree, termine = true, reponses = p_reponses');
    execute d;
  end if;
  d := pg_get_functiondef('public.inviter_defi(uuid,text[],text[])'::regprocedure);
  if position('libelle' in d) = 0 then
    d := replace(d, 'v_mat := coalesce(v_d.matiere, ''toutes matières'');', 'v_mat := coalesce(v_d.libelle, v_d.matiere, ''toutes matières'');');
    execute d;
  end if;
  -- on peut accepter un défi refusé
  d := pg_get_functiondef('public.repondre_defi(uuid,boolean)'::regprocedure);
  if position('statut <> ''accepte''' in d) = 0 then
    d := replace(d, 'where defi_id = p_defi and invite = v_user and statut = ''en_attente'';',
                    'where defi_id = p_defi and invite = v_user and (statut = ''en_attente'' or (p_accepte and statut <> ''accepte''));');
    execute d;
  end if;
end $do$;
