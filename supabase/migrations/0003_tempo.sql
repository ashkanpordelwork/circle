-- Tempo per exercise, set by the coach. Run once in Supabase → SQL Editor, after 0002.
--
-- Four characters, one per phase, in seconds: lowering, pause at the bottom, lifting, pause at
-- the top. "3010" = three seconds down, no pause, one second up, no pause. "X" means explosive.
-- Empty = no tempo prescribed.

alter table public.routine_items add column if not exists tempo text not null default ''
  check (tempo ~ '^([0-9X]{4})?$');

-- save_plan now stores the tempo too (otherwise unchanged from 0001).
create or replace function public.save_plan(p_student uuid, p_routines jsonb) returns void
language plpgsql security invoker set search_path = public as $$
declare r jsonb; i jsonb; pos int := 0; ipos int;
begin
  if not public.coaches_student(p_student) then
    raise exception 'not your student' using errcode = '42501';
  end if;
  if jsonb_typeof(p_routines) <> 'array' or jsonb_array_length(p_routines) > 30 then
    raise exception 'invalid plan';
  end if;

  delete from public.routines
   where student_id = p_student
     and id not in (select (x ->> 'id')::uuid from jsonb_array_elements(p_routines) x);

  for r in select * from jsonb_array_elements(p_routines) loop
    insert into public.routines (id, student_id, name, days, position)
    values ((r ->> 'id')::uuid, p_student, r ->> 'name',
            coalesce((select array_agg(d::smallint) from jsonb_array_elements_text(r -> 'days') d), '{}'), pos)
    on conflict (id) do update
      set name = excluded.name, days = excluded.days, position = excluded.position
      where public.routines.student_id = p_student;
    if not exists (select 1 from public.routines where id = (r ->> 'id')::uuid and student_id = p_student) then
      raise exception 'routine % is not in this plan', r ->> 'id';
    end if;
    delete from public.routine_items where routine_id = (r ->> 'id')::uuid;
    ipos := 0;
    for i in select * from jsonb_array_elements(coalesce(r -> 'items', '[]')) loop
      insert into public.routine_items (routine_id, exercise_id, sets, reps, weight, rest_sec, note, tempo, position)
      values ((r ->> 'id')::uuid, i ->> 'exercise_id', coalesce((i ->> 'sets')::int, 3),
              coalesce(i ->> 'reps', '10'), nullif(i ->> 'weight', '')::numeric,
              nullif(i ->> 'rest_sec', '')::int, coalesce(i ->> 'note', ''),
              upper(coalesce(i ->> 'tempo', '')), ipos);
      ipos := ipos + 1;
    end loop;
    pos := pos + 1;
  end loop;
end $$;
