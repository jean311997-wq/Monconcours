create or replace function public.swipe_invite_banque()
returns jsonb language sql stable security definer set search_path = public as $$
with ok as (
  select q.id, m.nom mat, q.enonce, q.explication, q.annee_session,
    row_number() over (partition by m.nom order by (q.annee_session is null), md5(q.id::text)) rn,
    (select jsonb_agg(o.texte order by o.position) from question_options o where o.question_id=q.id) opts,
    (select (array_agg(o.position order by o.position))[1] - 0 from question_options o where o.question_id=q.id) minpos,
    (select o.position from question_options o where o.question_id=q.id and o.est_correcte) bonpos
  from questions q join matieres m on m.id=q.matiere_id
  where q.statut='publie' and q.type_question='qcm'
    and (q.niveau is null or q.niveau::text in ('troisieme','terminale'))
    and length(coalesce(q.explication,''))>20 and length(q.enonce) between 20 and 260
    and (select count(*) from question_options o where o.question_id=q.id)=4
    and (select count(*) from question_options o where o.question_id=q.id and o.est_correcte)=1
    and not exists (select 1 from question_options o where o.question_id=q.id and length(o.texte)>110)
), quota(mat,n) as (values ('Culture générale',24),('Français',10),('Histoire',8),('Géographie',8),('Institutions et AES',8),('Mathématiques',8),('Sciences de la vie et de la Terre',10),('Tests psychotechniques',6),('Sciences physiques',4),('Géopolitique',4)),
sel as (select ok.* from ok join quota on quota.mat=ok.mat and ok.rn<=quota.n)
select coalesce(jsonb_agg(jsonb_build_object('id',id,'matiere',mat,'enonce',enonce,'options',opts,
  'bonnes',jsonb_build_array((bonpos - minpos)),'explication',explication,'annale',annee_session is not null,'annee',annee_session) order by md5(id::text)),'[]'::jsonb)
from sel;
$$;
grant execute on function public.swipe_invite_banque() to anon, authenticated;
