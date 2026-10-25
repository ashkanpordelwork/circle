-- Monthly programs. Run once in Supabase → SQL Editor, after 0005.
--
-- A program runs from a start date for a number of weeks (four: a month), with so many sessions a
-- week. Its sessions are routines with a week and a session number («هفته ۲، جلسه ۳»), not tied
-- to weekdays: the student does this week's sessions in order, on whatever days suit them.
-- The weekday plans from before stay as they are until the coach writes a program.

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  start_date date not null,
  weeks smallint not null default 4 check (weeks between 1 and 16),
  per_week smallint not null check (per_week between 1 and 7),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.programs (student_id, start_date desc);

alter table public.routines add column if not exists program_id uuid references public.programs (id) on delete cascade;
alter table public.routines add column if not exists week smallint check (week between 1 and 16);
alter table public.routines add column if not exists session smallint check (session between 1 and 7);
alter table public.routines add constraint routines_program_slot
  check ((program_id is null and week is null and session is null) or (program_id is not null and week is not null and session is not null));
create unique index if not exists routines_program_slot_key on public.routines (program_id, week, session) where program_id is not null;

alter table public.programs enable row level security;
create policy "coach manages programs" on public.programs for all
  using (public.coaches_student(student_id)) with check (public.coaches_student(student_id));
create policy "student reads programs" on public.programs for select using (public.is_student(student_id));
create policy "admin all" on public.programs for all using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.programs to authenticated;

-- The weekday plan editor no longer touches a program's sessions.
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
      insert into public.routine_items (routine_id, exercise_id, sets, reps, weight, rest_sec, note, tempo, position)
      values ((r ->> 'id')::uuid, i ->> 'exercise_id', coalesce((i ->> 'sets')::int, 3),
              coalesce(i ->> 'reps', '10'), nullif(i ->> 'weight', '')::numeric,
              nullif(i ->> 'rest_sec', '')::int, coalesce(i ->> 'note', ''),
              upper(coalesce(i ->> 'tempo', '')), ipos);
      ipos := ipos + 1;
    end loop;
    pos := pos + 1;
  end loop;
  perform public.plan_touched(p_student);
end $$;

-- Save a whole program at once: its dates and every session that has exercises.
-- p_sessions: [{id, week, session, items: [{exercise_id, sets, reps, weight, rest_sec, tempo, note}]}]
-- Sessions missing from the list are deleted (a workout logged against one keeps its name).
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
      insert into public.routine_items (routine_id, exercise_id, sets, reps, weight, rest_sec, note, tempo, position)
      values ((r ->> 'id')::uuid, i ->> 'exercise_id', coalesce((i ->> 'sets')::int, 3),
              coalesce(i ->> 'reps', '10'), nullif(i ->> 'weight', '')::numeric,
              nullif(i ->> 'rest_sec', '')::int, coalesce(i ->> 'note', ''),
              upper(coalesce(i ->> 'tempo', '')), ipos);
      ipos := ipos + 1;
    end loop;
  end loop;
  perform public.plan_touched(p_student);
end $$;
revoke execute on function public.save_program(uuid, uuid, date, int, int, jsonb) from public, anon;
grant execute on function public.save_program(uuid, uuid, date, int, int, jsonb) to authenticated;
