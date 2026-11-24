-- 25 novembre 2026 — Discussion : modifier son message, répondre à un message, @mention, épingler (administration).

alter table public.discussion_messages
  add column if not exists modifie_le timestamptz,
  add column if not exists reponse_a uuid references public.discussion_messages(id) on delete set null,
  add column if not exists epingle_le timestamptz;
create index if not exists discussion_messages_epingle on public.discussion_messages(epingle_le) where epingle_le is not null;

/* ---------- charger : réponse citée, « modifié », message épinglé, liste des auteurs pour @ ---------- */
create or replace function public.discussion_charger(p_epreuve uuid)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_user uuid := auth.uid(); v_msgs jsonb; v_n int; v_ecr jsonb; v_pin jsonb; v_aut jsonb;
begin
  if v_user is null or not exists (select 1 from public.epreuves_collectives e where e.id = p_epreuve and e.statut = 'programmee' and now() >= e.fin_le) then
    return jsonb_build_object('ok', false, 'message', 'Discussion ouverte à la fin de la composition.');
  end if;
  select coalesce(jsonb_agg(j order by (j->>'cree_le')), '[]'::jsonb) into v_msgs from (
    select jsonb_build_object('id', m.id, 'texte', m.texte, 'cree_le', m.cree_le,
      'nom', public.nom_resultat(m.auteur, m.epreuve_id),
      'equipe', exists (select 1 from public.communaute_signatures s where s.user_id = m.auteur),
      'coeurs', (select count(*) from public.discussion_coeurs c where c.message_id = m.id),
      'aime', exists (select 1 from public.discussion_coeurs c where c.message_id = m.id and c.user_id = v_user),
      'moi', m.auteur = v_user,
      'modifie', m.modifie_le is not null,
      'epingle', m.epingle_le is not null,
      'reponse', case when r.id is not null then jsonb_build_object('id', r.id, 'nom', public.nom_resultat(r.auteur, r.epreuve_id), 'extrait', left(r.texte, 90)) end) j
    from public.discussion_messages m left join public.discussion_messages r on r.id = m.reponse_a
    order by m.cree_le desc limit 60) z;
  select jsonb_build_object('id', m.id, 'texte', m.texte, 'nom', public.nom_resultat(m.auteur, m.epreuve_id)) into v_pin
    from public.discussion_messages m where m.epingle_le is not null order by m.epingle_le desc limit 1;
  select coalesce(jsonb_agg(nom order by der desc), '[]'::jsonb) into v_aut from (
    select public.nom_resultat(a.auteur, a.ep) nom, a.der from (
      select m.auteur, (array_agg(m.epreuve_id order by m.cree_le desc))[1] ep, max(m.cree_le) der
        from public.discussion_messages m where m.auteur <> v_user group by m.auteur order by max(m.cree_le) desc limit 40) a) q;
  insert into public.discussion_vues(epreuve_id, user_id, vu_le) values (p_epreuve, v_user, now()) on conflict (epreuve_id, user_id) do update set vu_le = now();
  select count(*) into v_n from public.discussion_messages;
  select coalesce(jsonb_agg(nom), '[]'::jsonb) into v_ecr from (
    select public.nom_resultat(d.user_id, p_epreuve) nom
      from public.discussion_presence d where d.epreuve_id = p_epreuve and d.user_id <> v_user and d.ecrit_le > now() - interval '8 seconds'
     order by d.ecrit_le desc limit 12) q;
  return jsonb_build_object('ok', true, 'messages', v_msgs, 'total', v_n, 'ecrivent', v_ecr, 'epingle', v_pin, 'auteurs', v_aut,
    'voient', (select count(*) from public.discussion_vues where epreuve_id = p_epreuve and vu_le > now() - interval '30 seconds'),
    'equipe', securite.comm_est_adm(v_user), 'peut_ecrire', securite.discussion_acces(p_epreuve, v_user));
end $function$;

/* ---------- envoyer : accepte une réponse à un message ---------- */
drop function if exists public.discussion_envoyer(uuid, text);
create or replace function public.discussion_envoyer(p_epreuve uuid, p_texte text, p_reponse uuid default null)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_user uuid := auth.uid(); v_txt text; v_adm boolean; v_bloc text; v_rep uuid;
begin
  if v_user is null or not securite.discussion_acces(p_epreuve, v_user) then return jsonb_build_object('ok', false, 'message', 'Discussion indisponible.'); end if;
  v_adm := securite.comm_est_adm(v_user);
  if not v_adm then
    v_bloc := securite.comm_blocage(v_user);
    if v_bloc is not null then return jsonb_build_object('ok', false, 'message', v_bloc); end if;
    if (select count(*) from public.discussion_messages where auteur = v_user and cree_le > now() - interval '10 minutes') >= 20 then
      return jsonb_build_object('ok', false, 'message', 'Vous écrivez beaucoup : réessayez dans un moment.'); end if;
  end if;
  v_txt := case when v_adm then left(btrim(coalesce(p_texte, '')), 500) else securite.comm_nettoyer(left(btrim(coalesce(p_texte, '')), 500)) end;
  if v_txt = '' then return jsonb_build_object('ok', false, 'message', 'Écrivez votre message.'); end if;
  select id into v_rep from public.discussion_messages where id = p_reponse;
  insert into public.discussion_messages(epreuve_id, auteur, texte, reponse_a) values (p_epreuve, v_user, v_txt, v_rep);
  delete from public.discussion_presence where epreuve_id = p_epreuve and user_id = v_user;
  return jsonb_build_object('ok', true);
end $function$;
revoke all on function public.discussion_envoyer(uuid, text, uuid) from public, anon;
grant execute on function public.discussion_envoyer(uuid, text, uuid) to authenticated;

/* ---------- modifier : seulement son propre message, même filtre qu'à l'envoi ---------- */
create or replace function public.discussion_modifier(p_message uuid, p_texte text)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_user uuid := auth.uid(); v_txt text; v_adm boolean; v_bloc text;
begin
  if v_user is null or not exists (select 1 from public.discussion_messages where id = p_message and auteur = v_user) then
    return jsonb_build_object('ok', false, 'message', 'Vous ne pouvez modifier que vos messages.'); end if;
  v_adm := securite.comm_est_adm(v_user);
  if not v_adm then
    v_bloc := securite.comm_blocage(v_user);
    if v_bloc is not null then return jsonb_build_object('ok', false, 'message', v_bloc); end if;
  end if;
  v_txt := case when v_adm then left(btrim(coalesce(p_texte, '')), 500) else securite.comm_nettoyer(left(btrim(coalesce(p_texte, '')), 500)) end;
  if v_txt = '' then return jsonb_build_object('ok', false, 'message', 'Écrivez votre message.'); end if;
  update public.discussion_messages set texte = v_txt, modifie_le = now() where id = p_message and auteur = v_user and texte is distinct from v_txt;
  return jsonb_build_object('ok', true);
end $function$;
revoke all on function public.discussion_modifier(uuid, text) from public, anon;
grant execute on function public.discussion_modifier(uuid, text) to authenticated;

/* ---------- épingler : administration seulement, un seul message épinglé à la fois ---------- */
create or replace function public.discussion_epingler(p_message uuid, p_on boolean default true)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_user uuid := auth.uid();
begin
  if v_user is null or not securite.comm_est_adm(v_user) then return jsonb_build_object('ok', false, 'message', 'Réservé à l''administration.'); end if;
  if p_on then
    update public.discussion_messages set epingle_le = null where epingle_le is not null and id <> p_message;
    update public.discussion_messages set epingle_le = now() where id = p_message;
  else
    update public.discussion_messages set epingle_le = null where id = p_message;
  end if;
  return jsonb_build_object('ok', found);
end $function$;
revoke all on function public.discussion_epingler(uuid, boolean) from public, anon;
grant execute on function public.discussion_epingler(uuid, boolean) to authenticated;
