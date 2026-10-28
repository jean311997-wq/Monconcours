-- Administration · détails cliquables : membres d'une cohorte, personnes derrière un chiffre, test d'alerte.

create or replace function public.retention_detail(p_jour date, p_k integer)
 returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
begin
  if not securite.est_lecteur() then raise exception 'Réservé à l''équipe'; end if;
  if p_k is null or p_k < 1 or p_k > 60 then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('user_id', p.id, 'nom', p.nom, 'telephone', public.tel_visible(p.telephone),
            'revenu', exists (select 1 from public.sessions s where s.user_id = p.id and s.debut_le::date = p.cree_le::date + p_k),
            'derniere', (select max(s.debut_le) from public.sessions s where s.user_id = p.id)) order by p.cree_le)
          from public.profils p where p.cree_le::date = p_jour), '[]'::jsonb);
end $$;

create or replace function public.liste_periode(p_type text, p_du date, p_au date)
 returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
declare v_au date := least(coalesce(p_au, current_date), current_date); v_du date := least(coalesce(p_du, current_date - 29), least(coalesce(p_au, current_date), current_date));
begin
  if not securite.est_lecteur() then raise exception 'Réservé à l''équipe'; end if;
  if p_type = 'inscrits' then
    return coalesce((select jsonb_agg(jsonb_build_object('user_id', p.id, 'nom', p.nom, 'telephone', public.tel_visible(p.telephone), 'quand', p.cree_le, 'valeur', p.niveau) order by p.cree_le desc)
      from (select * from public.profils where cree_le::date between v_du and v_au order by cree_le desc limit 200) p), '[]'::jsonb);
  elsif p_type = 'actifs' then
    return coalesce((select jsonb_agg(jsonb_build_object('user_id', x.user_id, 'nom', p.nom, 'telephone', public.tel_visible(p.telephone), 'quand', x.derniere,
        'valeur', x.n || ' visite' || case when x.n > 1 then 's' else '' end || ' · ' || x.mn || ' min') order by x.mn desc)
      from (select user_id, count(*) n, max(debut_le) derniere, round(coalesce(sum(duree_active_s), 0) / 60.0) mn from public.sessions
             where user_id is not null and debut_le::date between v_du and v_au group by user_id order by sum(duree_active_s) desc nulls last limit 200) x
      left join public.profils p on p.id = x.user_id), '[]'::jsonb);
  elsif p_type = 'payants' then
    return coalesce((select jsonb_agg(jsonb_build_object('user_id', x.user_id, 'nom', p.nom, 'telephone', public.tel_visible(p.telephone), 'quand', x.quand,
        'valeur', x.montant || ' F · ' || coalesce(x.formule, '')) order by x.quand desc)
      from (select user_id, max(coalesce(regle_le, cree_le)) quand, sum(montant_fcfa) montant, (array_agg(formule order by cree_le desc))[1] formule
              from public.paiements where statut = 'confirme' and montant_fcfa > 0 and coalesce(regle_le, cree_le)::date between v_du and v_au
             group by user_id limit 200) x left join public.profils p on p.id = x.user_id), '[]'::jsonb);
  elsif p_type = 'compositions' then
    return coalesce((select jsonb_agg(jsonb_build_object('user_id', x.user_id, 'nom', p.nom, 'telephone', public.tel_visible(p.telephone), 'quand', x.derniere,
        'valeur', x.n || ' composition' || case when x.n > 1 then 's' else '' end || ' · ' || x.t || ' terminée' || case when x.t > 1 then 's' else '' end) order by x.n desc)
      from (select user_id, count(*) n, count(*) filter (where terminee) t, max(debut_le) derniere from public.compositions
             where debut_le::date between v_du and v_au group by user_id order by count(*) desc limit 200) x
      left join public.profils p on p.id = x.user_id), '[]'::jsonb);
  elsif p_type = 'questions' then
    return coalesce((select jsonb_agg(jsonb_build_object('user_id', x.user_id, 'nom', p.nom, 'telephone', public.tel_visible(p.telephone), 'quand', x.derniere,
        'valeur', x.n || ' réponses · ' || x.taux || ' % justes') order by x.n desc)
      from (select user_id, count(*) n, round(100.0 * count(*) filter (where correcte) / count(*)) taux, max(cree_le) derniere from public.tentatives_question
             where cree_le::date between v_du and v_au group by user_id order by count(*) desc limit 200) x
      left join public.profils p on p.id = x.user_id), '[]'::jsonb);
  elsif p_type = 'partages' then
    return coalesce((select jsonb_agg(jsonb_build_object('user_id', x.user_id, 'nom', p.nom, 'telephone', public.tel_visible(p.telephone), 'quand', x.derniere,
        'valeur', x.n || ' partage' || case when x.n > 1 then 's' else '' end) order by x.n desc)
      from (select user_id, count(*) n, max(cree_le) derniere from public.evenements
             where user_id is not null and cree_le::date between v_du and v_au
               and nom in ('SHARE', 'CHALLENGE_SHARED', 'QUESTION_SHARED', 'DAILY_QUESTION_SHARED', 'RESULT_CARD_SHARED', 'PROGRESS_CARD_SHARED', 'PROXY_PAY_SHARED')
             group by user_id order by count(*) desc limit 200) x left join public.profils p on p.id = x.user_id), '[]'::jsonb);
  end if;
  return '[]'::jsonb;
end $$;

create or replace function public.admin_test_alerte()
 returns jsonb language plpgsql security definer set search_path to 'public' as $$
begin
  if not securite.est_admin() then return jsonb_build_object('ok', false, 'message', 'Réservé à l''administration.'); end if;
  perform public.alerter_admins('Alertes activées', 'Vous recevrez ici les paiements en cours, les avis et les signalements.', '/admin.html#app_admin', 'test-' || extract(epoch from now())::bigint);
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.retention_detail(date, integer) from public, anon;
revoke all on function public.liste_periode(text, date, date) from public, anon;
revoke all on function public.admin_test_alerte() from public, anon;
grant execute on function public.retention_detail(date, integer) to authenticated;
grant execute on function public.liste_periode(text, date, date) to authenticated;
grant execute on function public.admin_test_alerte() to authenticated;
