-- Athletes. Run once in Supabase → SQL Editor, after 0007.
--
-- Anyone who signs up can train on their own: a «student» row with no coach, routines of their
-- own making. A coach is something an athlete joins — with the coach's code, by their own
-- choice — and can leave again. What the coach writes and what the athlete writes stay apart:
-- each routine has an owner, and neither side edits the other's.

/* ---------- a student without a coach ---------- */

alter table public.students alter column coach_id drop not null;
-- Started on their own (not registered by a coach): the questionnaire is offered, not required.
alter table public.students add column if not exists self_started boolean not null default false;

-- Who wrote a routine: the coach (plans and programs), or the athlete themselves.
alter table public.routines add column if not exists owner text not null default 'coach'
  check (owner in ('coach', 'self'));
alter table public.routines add constraint routines_self_not_program check (owner = 'coach' or program_id is null);

create or replace function public.routine_owner(rid uuid) returns text
language sql stable security definer set search_path = public as $$
  select owner from public.routines where id = rid
$$;

-- A coach writes only the coach's routines; reads all of their students' (to see what they do).
drop policy if exists "coach manages routines" on public.routines;
create policy "coach manages routines" on public.routines for all
  using (public.coaches_student(student_id) and owner = 'coach')
  with check (public.coaches_student(student_id) and owner = 'coach');
create policy "coach reads athlete routines" on public.routines for select using (public.coaches_student(student_id));
drop policy if exists "coach manages routine items" on public.routine_items;
create policy "coach manages routine items" on public.routine_items for all
  using (public.coaches_student(public.routine_student(routine_id)) and public.routine_owner(routine_id) = 'coach')
  with check (public.coaches_student(public.routine_student(routine_id)) and public.routine_owner(routine_id) = 'coach');
create policy "coach reads athlete routine items" on public.routine_items for select
  using (public.coaches_student(public.routine_student(routine_id)));

-- The athlete writes their own.
create policy "athlete manages own routines" on public.routines for all
  using (public.is_student(student_id) and owner = 'self')
  with check (public.is_student(student_id) and owner = 'self' and program_id is null);
create policy "athlete manages own routine items" on public.routine_items for all
  using (public.is_student(public.routine_student(routine_id)) and public.routine_owner(routine_id) = 'self')
  with check (public.is_student(public.routine_student(routine_id)) and public.routine_owner(routine_id) = 'self');

/* ---------- starting out alone ---------- */

-- A new account with no role becomes an athlete. A number a coach has already registered is
-- invited, not new: that person enters the coach's invite code instead.
create or replace function public.start_athlete(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_phone text; v_id uuid;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if length(trim(coalesce(p_name, ''))) not between 1 and 60 then raise exception 'invalid name' using errcode = '22023'; end if;
  if exists (select 1 from public.students where user_id = auth.uid()) then raise exception 'already an athlete' using errcode = '22023'; end if;
  select public.phone_of_email(email) into v_phone from auth.users where id = auth.uid();
  if v_phone is null then raise exception 'not a phone account' using errcode = '22023'; end if;
  if exists (select 1 from public.students where phone = v_phone) then raise exception 'invited' using errcode = '22023'; end if;
  insert into public.students (coach_id, full_name, phone, user_id, self_started)
  values (null, trim(p_name), v_phone, auth.uid(), true) returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.start_athlete(text) from public, anon;
grant execute on function public.start_athlete(text) to authenticated;

-- The athlete renames themselves.
create or replace function public.rename_me(p_name text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if length(trim(coalesce(p_name, ''))) not between 1 and 60 then raise exception 'invalid name' using errcode = '22023'; end if;
  update public.students set full_name = trim(p_name) where user_id = auth.uid();
end $$;
revoke execute on function public.rename_me(text) from public, anon;
grant execute on function public.rename_me(text) to authenticated;

/* ---------- the athlete's own routines ---------- */

-- Save one routine of their own, with its exercises, in one go. p_items as in save_plan.
create or replace function public.save_my_routine(p_id uuid, p_name text, p_items jsonb) returns void
language plpgsql security invoker set search_path = public as $$
declare v_student uuid; i jsonb; ipos int := 0;
begin
  select id into v_student from public.students where user_id = auth.uid() and active;
  if v_student is null then raise exception 'not an athlete' using errcode = '42501'; end if;
  if length(trim(coalesce(p_name, ''))) not between 1 and 80 then raise exception 'invalid name' using errcode = '22023'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 40 then raise exception 'invalid routine'; end if;
  insert into public.routines (id, student_id, name, days, position, owner)
  values (p_id, v_student, trim(p_name), '{}', (select coalesce(max(position), 0) + 1 from public.routines where student_id = v_student and owner = 'self'), 'self')
  on conflict (id) do update set name = excluded.name
    where public.routines.student_id = v_student and public.routines.owner = 'self';
  if not exists (select 1 from public.routines where id = p_id and student_id = v_student and owner = 'self') then
    raise exception 'not your routine' using errcode = '42501';
  end if;
  delete from public.routine_items where routine_id = p_id;
  for i in select * from jsonb_array_elements(p_items) loop
    insert into public.routine_items (routine_id, exercise_id, sets, reps, weight, rest_sec, note, tempo, progression, position)
    values (p_id, i ->> 'exercise_id', coalesce((i ->> 'sets')::int, 3),
            coalesce(i ->> 'reps', '10'), nullif(i ->> 'weight', '')::numeric,
            nullif(i ->> 'rest_sec', '')::int, coalesce(i ->> 'note', ''),
            upper(coalesce(i ->> 'tempo', '')), coalesce(nullif(i ->> 'progression', ''), 'linear'), ipos);
    ipos := ipos + 1;
  end loop;
end $$;
revoke execute on function public.save_my_routine(uuid, text, jsonb) from public, anon;
grant execute on function public.save_my_routine(uuid, text, jsonb) to authenticated;

/* ---------- joining a coach, and leaving ---------- */

-- Every coach has a code to give out; an athlete who enters it joins them.
alter table public.coaches add column if not exists join_code text unique default public.new_invite_code();
update public.coaches set join_code = public.new_invite_code() where join_code is null;

create or replace function public.join_coach(p_code text) returns text
language plpgsql security definer set search_path = public as $$
declare v_coach uuid; v_name text;
begin
  select id, full_name into v_coach, v_name from public.coaches where join_code = upper(trim(p_code)) and active;
  if v_coach is null then raise exception 'wrong code' using errcode = '22023'; end if;
  if v_coach = auth.uid() then raise exception 'own code' using errcode = '22023'; end if;
  update public.students set coach_id = v_coach where user_id = auth.uid() and active and coach_id is null;
  if not found then raise exception 'already has a coach' using errcode = '22023'; end if;
  return v_name;
end $$;
revoke execute on function public.join_coach(text) from public, anon;
grant execute on function public.join_coach(text) to authenticated;

-- The athlete's coach, by name (the athlete cannot read the coaches table itself).
create or replace function public.my_coach_name() returns text
language sql stable security definer set search_path = public as $$
  select c.full_name from public.students s join public.coaches c on c.id = s.coach_id where s.user_id = auth.uid()
$$;
revoke execute on function public.my_coach_name() from public, anon;
grant execute on function public.my_coach_name() to authenticated;

-- Leaving takes the coach's access away at once. What they wrote stays with the athlete to read.
create or replace function public.leave_coach() returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.students set coach_id = null where user_id = auth.uid();
end $$;
revoke execute on function public.leave_coach() from public, anon;
grant execute on function public.leave_coach() to authenticated;

-- The coach's plan editor touches only the coach's routines (it used to delete every routine
-- outside a program, which would now include the athlete's own).
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
   where student_id = p_student and program_id is null and owner = 'coach'
     and id not in (select (x ->> 'id')::uuid from jsonb_array_elements(p_routines) x);
  for r in select * from jsonb_array_elements(p_routines) loop
    insert into public.routines (id, student_id, name, days, position)
    values ((r ->> 'id')::uuid, p_student, r ->> 'name',
            coalesce((select array_agg(d::smallint) from jsonb_array_elements_text(r -> 'days') d), '{}'), pos)
    on conflict (id) do update
      set name = excluded.name, days = excluded.days, position = excluded.position
      where public.routines.student_id = p_student and public.routines.program_id is null and public.routines.owner = 'coach';
    if not exists (select 1 from public.routines where id = (r ->> 'id')::uuid and student_id = p_student and program_id is null and owner = 'coach') then
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

/* ---------- water ---------- */

create table if not exists public.water_logs (
  student_id uuid not null references public.students (id) on delete cascade,
  date date not null default current_date,
  ml int not null default 0 check (ml between 0 and 20000),
  primary key (student_id, date)
);
alter table public.water_logs enable row level security;
create policy "athlete logs water" on public.water_logs for all
  using (public.is_student(student_id)) with check (public.is_student(student_id));
create policy "admin all" on public.water_logs for all using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.water_logs to authenticated;
