-- Administration · paiements (reçus / en cours / non confirmés), dépôts publiables, lecture des cours par les candidats.

/* ---------- 1. les candidats peuvent lire les fichiers des ressources publiées ---------- */
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'candidats lisent les fichiers publies') then
    create policy "candidats lisent les fichiers publies" on storage.objects for select to authenticated
      using (bucket_id in ('cours', 'documents-importes')
             and exists (select 1 from public.ressources r where r.fichier_chemin = storage.objects.name and r.statut = 'publie'));
  end if;
end $$;

/* ---------- 2. publier un dépôt-fichier dans la bibliothèque ---------- */
create or replace function public.admin_publier_depot(p_depot uuid, p_titre text, p_matiere uuid, p_niveau text, p_type text default 'cours')
 returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare d public.depots%rowtype; v_titre text;
begin
  if not securite.est_equipe() then return jsonb_build_object('ok', false, 'message', 'Réservé à l''équipe.'); end if;
  select * into d from public.depots where id = p_depot for update;
  if not found then return jsonb_build_object('ok', false, 'message', 'Dépôt introuvable.'); end if;
  if d.fichier_chemin is null then return jsonb_build_object('ok', false, 'message', 'Ce dépôt est un texte : utilisez « Ranger et intégrer ».'); end if;
  v_titre := coalesce(nullif(btrim(coalesce(p_titre, '')), ''), d.titre, d.nom_fichier, 'Document');
  if not exists (select 1 from public.ressources r where r.fichier_chemin = d.fichier_chemin and r.statut = 'publie') then
    insert into public.ressources (titre, type_ressource, matiere_id, niveau, fichier_chemin, nom_fichier, taille_octets, telechargeable, statut, publie_le, depose_par)
    values (v_titre, coalesce(nullif(p_type, ''), 'cours')::type_ressource, p_matiere, nullif(p_niveau, '')::niveau_scolaire,
            d.fichier_chemin, d.nom_fichier, d.taille_octets, true, 'publie', now(), auth.uid());
  end if;
  update public.depots set statut = 'range', range_vers = coalesce(nullif(p_type, ''), 'cours'), range_par = auth.uid(), range_le = now(),
         matiere_id = coalesce(p_matiere, matiere_id), niveau = coalesce(nullif(p_niveau, '')::niveau_scolaire, niveau)
   where id = p_depot;
  insert into public.journal_activite (acteur, action, table_cible) values (auth.uid(), 'depot_publie', 'ressources');
  return jsonb_build_object('ok', true);
end $$;

/* dépôts-fichiers rangés mais jamais publiés */
create or replace function public.depots_non_publies()
 returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not securite.est_lecteur() then raise exception 'Réservé à l''équipe'; end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.cree_le desc) from (
    select d.id, d.titre, d.nom_fichier, d.taille_octets, d.matiere_id, d.niveau, d.nature_retenue, d.cree_le, d.statut
      from public.depots d
     where d.fichier_chemin is not null and d.statut in ('range', 'a_ranger')
       and not exists (select 1 from public.ressources r where r.fichier_chemin = d.fichier_chemin and r.statut = 'publie')) x), '[]'::jsonb);
end $$;

/* ---------- 3. paiements : reçus, en cours, non confirmés ---------- */
create or replace function public.paiements_vue(p_du date, p_au date)
 returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
declare v_au date; v_du date; v_admin boolean := securite.est_admin(); res jsonb;
begin
  if not securite.est_lecteur() then raise exception 'Réservé à l''équipe'; end if;
  v_au := least(coalesce(p_au, current_date), current_date);
  v_du := least(coalesce(p_du, v_au - 29), v_au);
  with ligne as (
    select p.id, p.user_id, pr.nom, public.tel_visible(coalesce(p.telephone, pr.telephone)) tel, p.nom_compte, p.operateur, p.mode,
           coalesce(p.formule, p.reference_externe) formule, p.montant_fcfa montant, p.statut, p.motif_refus motif, p.cree_le, p.regle_le,
           case when v_admin then p.preuve_chemin end preuve
      from public.paiements p left join public.profils pr on pr.id = p.user_id
  ), ev as (
    select e.user_id, min(e.cree_le) premiere, max(e.cree_le) derniere,
           max(case e.nom when 'PAYMENT_STARTED' then 3 when 'PAYMENT_DECLARED' then 4 when 'PAYMENT_PROOF_SENT' then 5 when 'PAYMENT_SENT' then 5 end) etape,
           bool_or(e.nom = 'PAYMENT_ABANDONED') abandon,
           (array_agg(e.meta ->> 'formule' order by e.cree_le desc) filter (where e.meta ? 'formule'))[1] formule
      from public.evenements e
     where e.user_id is not null and e.cree_le::date between v_du and v_au
       and e.nom in ('PAYMENT_STARTED', 'PAYMENT_DECLARED', 'PAYMENT_PROOF_SENT', 'PAYMENT_SENT', 'PAYMENT_ABANDONED')
     group by e.user_id
  ), sans as (
    select ev.*, pr.nom, public.tel_visible(pr.telephone) tel from ev left join public.profils pr on pr.id = ev.user_id
     where not exists (select 1 from public.paiements p where p.user_id = ev.user_id and p.operateur not in ('code', 'admin') and p.cree_le >= ev.premiere - interval '1 hour')
  )
  select jsonb_build_object(
    'du', v_du, 'au', v_au, 'admin', v_admin,
    'recus', (select coalesce(jsonb_agg(to_jsonb(l) order by coalesce(l.regle_le, l.cree_le) desc), '[]'::jsonb) from ligne l
               where l.statut = 'confirme' and l.montant > 0 and coalesce(l.regle_le, l.cree_le)::date between v_du and v_au),
    'codes', (select count(*) from ligne l where l.statut = 'confirme' and l.montant = 0 and coalesce(l.regle_le, l.cree_le)::date between v_du and v_au),
    'attente', (select coalesce(jsonb_agg(to_jsonb(l) order by l.cree_le), '[]'::jsonb) from ligne l where l.statut = 'en_attente'),
    'en_cours', (select coalesce(jsonb_agg(jsonb_build_object('user_id', s.user_id, 'nom', s.nom, 'tel', s.tel, 'etape', s.etape, 'formule', s.formule,
                   'premiere', s.premiere, 'derniere', s.derniere) order by s.derniere desc), '[]'::jsonb)
                 from sans s where s.etape is not null and not s.abandon and s.derniere > now() - interval '24 hours'),
    'refuses', (select coalesce(jsonb_agg(to_jsonb(l) order by l.cree_le desc), '[]'::jsonb) from ligne l
                 where l.statut = 'refuse' and l.cree_le::date between v_du and v_au),
    'abandons', (select coalesce(jsonb_agg(jsonb_build_object('user_id', s.user_id, 'nom', s.nom, 'tel', s.tel, 'etape', s.etape, 'formule', s.formule,
                   'derniere', s.derniere, 'abandon', s.abandon) order by s.derniere desc), '[]'::jsonb)
                 from sans s where s.abandon or s.derniere <= now() - interval '24 hours'),
    'par_operateur', (select coalesce(jsonb_agg(jsonb_build_object('nom', q.operateur, 'n', q.n, 'montant', q.m) order by q.m desc), '[]'::jsonb)
                       from (select operateur, count(*) n, sum(montant) m from ligne l where l.statut = 'confirme' and l.montant > 0
                                and coalesce(l.regle_le, l.cree_le)::date between v_du and v_au group by operateur) q),
    'par_formule', (select coalesce(jsonb_agg(jsonb_build_object('nom', q.formule, 'n', q.n, 'montant', q.m) order by q.m desc), '[]'::jsonb)
                     from (select formule, count(*) n, sum(montant) m from ligne l where l.statut = 'confirme' and l.montant > 0
                              and coalesce(l.regle_le, l.cree_le)::date between v_du and v_au group by formule) q),
    'serie', (select coalesce(jsonb_agg(jsonb_build_object('jour', j.d::date, 'montant', coalesce((select sum(montant) from ligne l where l.statut = 'confirme' and l.montant > 0 and coalesce(l.regle_le, l.cree_le)::date = j.d::date), 0),
                   'n', (select count(*) from ligne l where l.statut = 'confirme' and l.montant > 0 and coalesce(l.regle_le, l.cree_le)::date = j.d::date)) order by j.d), '[]'::jsonb)
                from generate_series(v_du, v_au, interval '1 day') j(d))
  ) into res;
  return res;
end $$;

revoke all on function public.admin_publier_depot(uuid, text, uuid, text, text) from public, anon;
revoke all on function public.depots_non_publies() from public, anon;
revoke all on function public.paiements_vue(date, date) from public, anon;
grant execute on function public.admin_publier_depot(uuid, text, uuid, text, text) to authenticated;
grant execute on function public.depots_non_publies() to authenticated;
grant execute on function public.paiements_vue(date, date) to authenticated;
