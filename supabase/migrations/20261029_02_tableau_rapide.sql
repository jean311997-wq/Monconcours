-- 29 octobre 2026 : le tableau de bord de l'admin dépassait les 8 s autorisées (« canceling statement due to statement timeout »).
-- Les blocs « croissance » et « heures » rescannaient la table des évènements une fois par jour / par heure.
-- Ils sont réécrits en un seul passage. Même résultat, 8 à 11 s -> moins d'une seconde.
do $do$
declare f text; d text; a int; b int; neuf text; fin text; fin1 text; deb text;
begin
  foreach f in array array['tableau_de_bord', 'tableau_de_bord_p'] loop
    select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = f;
    a := position($q$'croissance'$q$ in d);
    b := position($q$'zones'$q$ in d);
    if a = 0 or b = 0 or b < a then raise exception 'repères introuvables dans %', f; end if;
    if f = 'tableau_de_bord_p' then fin := 'v_fin'; fin1 := 'v_fin1'; deb := 'greatest(v_debut, v_fin - 6)';
    else fin := 'current_date'; fin1 := '(current_date + 1)'; deb := 'current_date - 6'; end if;
    neuf := $n$'croissance', (select coalesce(jsonb_agg(jsonb_build_object('jour', g.d::date, 'inscrits', coalesce(i.n, 0), 'actifs', coalesce(a.n, 0)) order by g.d), '[]'::jsonb)
        from generate_series(v_debut, $n$ || fin || $n$, interval '1 day') g(d)
        left join (select cree_le::date d, count(*) n from profils where cree_le >= v_debut and cree_le < $n$ || fin1 || $n$ group by 1) i on i.d = g.d::date
        left join (select d, count(distinct u) n from (
              select cree_le::date d, user_id u from evenements where cree_le >= v_debut and cree_le < $n$ || fin1 || $n$ and user_id is not null
              union select jour, user_id from assiduite where jour >= v_debut and jour <= $n$ || fin || $n$) z group by d) a on a.d = g.d::date),
    'heures', (select coalesce(jsonb_agg(jsonb_build_object('h', g.h, 'n', coalesce(z.n, 0)) order by g.h), '[]'::jsonb)
        from generate_series(0, 23) g(h)
        left join (select extract(hour from e.cree_le)::int h, count(distinct coalesce(e.user_id::text, e.session_id::text) || e.cree_le::date) n
                     from evenements e where e.cree_le >= $n$ || deb || $n$ and e.cree_le < $n$ || fin1 || $n$ group by 1) z on z.h = g.h),
    $n$;
    d := substr(d, 1, a - 1) || neuf || substr(d, b);
    execute d;
  end loop;
end $do$;
