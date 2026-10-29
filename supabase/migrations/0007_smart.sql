-- Smart workouts. Run once in Supabase → SQL Editor, after 0006.
--
-- Each exercise of a plan carries the rule that suggests its next weight (src/lib/smart.js,
-- openGym's progression engine): linear, double progression, Greyskull LP, or none. Nothing about
-- the suggestion itself is stored — it is worked out from the logged sets every time.
-- A workout now keeps when it started, how long it took, and why it ended early if it did.

alter table public.routine_items add column if not exists progression text not null default 'linear'
  check (progression in ('linear', 'double', 'greyskull', 'off'));

alter table public.workouts add column if not exists started_at timestamptz;
alter table public.workouts add column if not exists duration_sec int check (duration_sec between 0 and 86400);
alter table public.workouts add column if not exists end_reason text not null default ''
  check (end_reason in ('', 'time', 'energy', 'pain', 'equipment', 'fit'));

-- The two plan savers, as in 0006, now writing each exercise's rule.
create or replace function public.save_plan(p_student uuid, p_routines jsonb) returns void
language plpgsql security invoker set search_path = public as $$
declare r jsonb; i jsonb; pos int := 0; ipos int;
begin
  if not (public.coaches_student(p_student) or public.is_admin()) then
    raise exception 'not your student' using errcode = '42501';
  end if;
  if jsonb_typeof(p_routines) <> 'array' or jsonb_array_length(p_routines) > 30 then
    raise exception 'invalid plan';
  end if;
  delete from public.routines
   where student_id = p_student and program_id is null
     and id not in (select (x ->> 'id')::uuid from jsonb_array_elements(p_routines) x);
  for r in select * from jsonb_array_elements(p_routines) loop
    insert into public.routines (id, student_id, name, days, position)
    values ((r ->> 'id')::uuid, p_student, r ->> 'name',
            coalesce((select array_agg(d::smallint) from jsonb_array_elements_text(r -> 'days') d), '{}'), pos)
    on conflict (id) do update
      set name = excluded.name, days = excluded.days, position = excluded.position
      where public.routines.student_id = p_student and public.routines.program_id is null;
    if not exists (select 1 from public.routines where id = (r ->> 'id')::uuid and student_id = p_student and program_id is null) then
      raise exception 'routine % is not in this plan', r ->> 'id';
    end if;
    delete from public.routine_items where routine_id = (r ->> 'id')::uuid;
    ipos := 0;
    for i in select * from jsonb_array_elements(coalesce(r -> 'items', '[]')) loop
      insert into public.routine_items (routine_id, exercise_id, sets, reps, weight, rest_sec, note, tempo, progression, position)
      values ((r ->> 'id')::uuid, i ->> 'exercise_id', coalesce((i ->> 'sets')::int, 3),
              coalesce(i ->> 'reps', '10'), nullif(i ->> 'weight', '')::numeric,
              nullif(i ->> 'rest_sec', '')::int, coalesce(i ->> 'note', ''),
              upper(coalesce(i ->> 'tempo', '')), coalesce(nullif(i ->> 'progression', ''), 'linear'), ipos);
      ipos := ipos + 1;
    end loop;
    pos := pos + 1;
  end loop;
  perform public.plan_touched(p_student);
end $$;


create or replace function public.save_program(p_program uuid, p_student uuid, p_start date, p_weeks int, p_per_week int, p_sessions jsonb)
returns void language plpgsql security invoker set search_path = public as $$
declare r jsonb; i jsonb; ipos int; v_owner uuid;
begin
  if not (public.coaches_student(p_student) or public.is_admin()) then
    raise exception 'not your student' using errcode = '42501';
  end if;
  if jsonb_typeof(p_sessions) <> 'array' or jsonb_array_length(p_sessions) > 112 then
    raise exception 'invalid program';
  end if;
  select student_id into v_owner from public.programs where id = p_program;
  if v_owner is not null and v_owner <> p_student then raise exception 'program of another student' using errcode = '42501'; end if;

  insert into public.programs (id, student_id, start_date, weeks, per_week)
  values (p_program, p_student, p_start, p_weeks, p_per_week)
  on conflict (id) do update set start_date = excluded.start_date, weeks = excluded.weeks,
    per_week = excluded.per_week, updated_at = now();

  delete from public.routines
   where program_id = p_program
     and id not in (select (x ->> 'id')::uuid from jsonb_array_elements(p_sessions) x);

  for r in select * from jsonb_array_elements(p_sessions) loop
    if (r ->> 'week')::int > p_weeks or (r ->> 'session')::int > p_per_week then
      raise exception 'session outside the program';
    end if;
    insert into public.routines (id, student_id, name, days, position, program_id, week, session)
    values ((r ->> 'id')::uuid, p_student, 'جلسه ' || translate(r ->> 'session', '0123456789', '۰۱۲۳۴۵۶۷۸۹'), '{}',
            (r ->> 'week')::int * 10 + (r ->> 'session')::int, p_program, (r ->> 'week')::int, (r ->> 'session')::int)
    on conflict (id) do update set week = excluded.week, session = excluded.session, name = excluded.name, position = excluded.position
      where public.routines.program_id = p_program;
    if not exists (select 1 from public.routines where id = (r ->> 'id')::uuid and program_id = p_program) then
      raise exception 'session % is not in this program', r ->> 'id';
    end if;
    delete from public.routine_items where routine_id = (r ->> 'id')::uuid;
    ipos := 0;
    for i in select * from jsonb_array_elements(coalesce(r -> 'items', '[]')) loop
      insert into public.routine_items (routine_id, exercise_id, sets, reps, weight, rest_sec, note, tempo, progression, position)
      values ((r ->> 'id')::uuid, i ->> 'exercise_id', coalesce((i ->> 'sets')::int, 3),
              coalesce(i ->> 'reps', '10'), nullif(i ->> 'weight', '')::numeric,
              nullif(i ->> 'rest_sec', '')::int, coalesce(i ->> 'note', ''),
              upper(coalesce(i ->> 'tempo', '')), coalesce(nullif(i ->> 'progression', ''), 'linear'), ipos);
      ipos := ipos + 1;
    end loop;
  end loop;
  perform public.plan_touched(p_student);
end $$;
revoke execute on function public.save_program(uuid, uuid, date, int, int, jsonb) from public, anon;
grant execute on function public.save_program(uuid, uuid, date, int, int, jsonb) to authenticated;
