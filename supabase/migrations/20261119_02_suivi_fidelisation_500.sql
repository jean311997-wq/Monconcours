create table if not exists public.suivi_fidelisation (
  jour date not null, user_id uuid not null, jours_14j int, compositions int,
  a_notifs boolean, a_avis boolean, abonne boolean, groupe text,
  primary key (jour, user_id));
alter table public.suivi_fidelisation enable row level security;
revoke all on public.suivi_fidelisation from anon, authenticated;
insert into public.suivi_fidelisation (jour, user_id, jours_14j, compositions, a_notifs, a_avis, abonne, groupe)
select current_date, a.user_id, a.jours,
  (select count(*) from public.compositions c where c.user_id = a.user_id and c.terminee),
  exists (select 1 from public.push_abonnements p where p.user_id = a.user_id and p.actif),
  exists (select 1 from public.avis v where v.user_id = a.user_id),
  exists (select 1 from public.mon_abonnement m where m.user_id = a.user_id and m.actif),
  case when a.jours >= 5 then 'noyau' when a.jours >= 3 then 'regulier' else 'occasionnel' end
from (select user_id, count(distinct cree_le::date) as jours from public.tentatives_question
       where cree_le >= now() - interval '14 days' group by user_id) a
on conflict do nothing;
