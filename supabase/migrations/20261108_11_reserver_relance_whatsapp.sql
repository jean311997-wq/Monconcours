-- Relance WhatsApp : la personne est réservée à celui qui clique en premier.
-- Un autre administrateur qui tente de relancer la même personne dans les 24 h est averti et rien ne s'ouvre.
create or replace function public.admin_reserver_relance(p_user uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_moi uuid := auth.uid(); v_r record; v_nom text;
begin
  if not exists (select 1 from roles_utilisateur where user_id = v_moi and role in ('admin','investisseur')) then
    return jsonb_build_object('ok', false, 'message', 'Réservé à l''administration.');
  end if;
  insert into relances_whatsapp(user_id, par) values (p_user, v_moi) on conflict (user_id) do nothing;
  if found then return jsonb_build_object('ok', true, 'deja', false); end if;
  select * into v_r from relances_whatsapp where user_id = p_user for update;
  if v_r.envoye_le > now() - interval '24 hours' and v_r.par is distinct from v_moi then
    select coalesce((select s.nom from communaute_signatures s where s.user_id = v_r.par), (select p.nom from profils p where p.id = v_r.par), 'un autre administrateur') into v_nom;
    return jsonb_build_object('ok', true, 'deja', true, 'par', v_nom, 'le', v_r.envoye_le);
  end if;
  update relances_whatsapp set envoye_le = now(), par = v_moi where user_id = p_user;
  return jsonb_build_object('ok', true, 'deja', false);
end $function$;
revoke all on function public.admin_reserver_relance(uuid) from public, anon;
grant execute on function public.admin_reserver_relance(uuid) to authenticated;
