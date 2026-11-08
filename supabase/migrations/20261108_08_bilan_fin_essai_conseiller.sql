-- Bilan de fin d'essai : plus de prix dans le message, on oriente vers le conseiller WhatsApp.
create or replace function public.bilan_fin_essai()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare r record; v_q int; v_c int; v_n int := 0; v_txt text;
begin
  for r in select a.user_id, a.debut_le, a.fin_le from abonnements a
           where a.formule='essai' and a.fin_le <= now() and a.fin_le > now() - interval '2 hours'
             and a.fin_le - a.debut_le <= interval '3 days 1 hour'
             and not securite.est_abonne(a.user_id)
             and not exists (select 1 from notifications n where n.user_id=a.user_id and n.cle_unicite='bilan-essai-'||a.user_id::text)
  loop
    select count(*) into v_q from tentatives_question where user_id=r.user_id and cree_le between r.debut_le and r.fin_le;
    select count(*) into v_c from compositions where user_id=r.user_id and debut_le between r.debut_le and r.fin_le and (terminee or nb_traitees>0);
    v_txt := case when v_q + v_c > 0
      then 'En 3 jours, vous avez fait ' || v_q || ' question' || case when v_q>1 then 's' else '' end
           || case when v_c>0 then ' et ' || v_c || ' composition' || case when v_c>1 then 's' else '' end else '' end
           || '. Votre essai est terminé. Un conseiller peut activer votre abonnement avec vous sur WhatsApp, en quelques minutes. Touchez ici pour continuer.'
      else 'Votre essai est terminé. Un conseiller peut activer votre abonnement avec vous sur WhatsApp, en quelques minutes. Touchez ici pour continuer.' end;
    perform public.notifier(r.user_id, 'paiement', 'Gardez votre rythme', v_txt, 'bilan-essai-'||r.user_id::text, 'abonnement', true);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $function$;
