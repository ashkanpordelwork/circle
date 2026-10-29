-- Coaching. Run once in Supabase → SQL Editor, after 0009.
--
--   1. Becoming a coach: an athlete applies; an admin approves (they become a coach) or declines
--      with a note. Every application and decision is kept.
--   2. Coach plans: how many active students a coach may have — free 10, pro 30, studio no limit.
--      There is no payment: an admin grants a plan, optionally until a date, after which it is
--      free again. Lowering a plan keeps every student; only new ones are refused.
--   3. Feedback: coach and student talk under each workout.

/* ---------- 1. applications ---------- */

create table if not exists public.coach_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  first_name text not null check (length(trim(first_name)) between 1 and 40),
  last_name text not null check (length(trim(last_name)) between 1 and 40),
  years smallint not null check (years between 0 and 60),
  focus text[] not null check (array_length(focus, 1) between 1 and 8),
  clients smallint not null check (clients between 0 and 10000),
  credentials text not null default '' check (length(credentials) <= 1000),
  note text not null default '' check (length(note) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  review_note text not null default '' check (length(review_note) <= 1000),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists coach_applications_one_pending on public.coach_applications (user_id) where status = 'pending';
alter table public.coach_applications enable row level security;
create policy "applicant reads own" on public.coach_applications for select using (user_id = auth.uid());
create policy "admin all" on public.coach_applications for all using (public.is_admin()) with check (public.is_admin());
grant select on public.coach_applications to authenticated;

-- Apply (or re-apply after a decline). Not for someone who already coaches.
create or replace function public.apply_to_coach(p_first text, p_last text, p_years int, p_focus text[], p_clients int, p_credentials text, p_note text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if exists (select 1 from coaches where id = auth.uid() and active) then raise exception 'already a coach' using errcode = '22023'; end if;
  if exists (select 1 from coach_applications where user_id = auth.uid() and status = 'pending') then raise exception 'already applied' using errcode = '22023'; end if;
  insert into coach_applications (user_id, first_name, last_name, years, focus, clients, credentials, note)
  values (auth.uid(), trim(p_first), trim(p_last), p_years, p_focus, p_clients, coalesce(p_credentials, ''), coalesce(p_note, ''))
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.apply_to_coach(text, text, int, text[], int, text, text) from public, anon;
grant execute on function public.apply_to_coach(text, text, int, text[], int, text, text) to authenticated;

-- The admin's decision. Approving makes the applicant a coach under their own name, on the free plan.
create or replace function public.admin_review_application(p_id uuid, p_approve boolean, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare a coach_applications;
begin
  perform public.admin_guard();
  select * into a from coach_applications where id = p_id for update;
  if not found then raise exception 'no such application' using errcode = '22023'; end if;
  if a.status <> 'pending' then raise exception 'already decided' using errcode = '22023'; end if;
  update coach_applications set status = case when p_approve then 'approved' else 'declined' end,
    review_note = coalesce(p_note, ''), reviewed_by = auth.uid(), reviewed_at = now() where id = p_id;
  if p_approve then
    insert into coaches (id, email, full_name, plan)
      select u.id, u.email, a.first_name || ' ' || a.last_name, 'free' from auth.users u where u.id = a.user_id
      on conflict (id) do update set active = true;
    insert into coach_phones (phone) select phone_of_email(email) from auth.users where id = a.user_id and phone_of_email(email) is not null
      on conflict do nothing;
  end if;
  perform public.admin_note(case when p_approve then 'application_approved' else 'application_declined' end,
    jsonb_build_object('user', a.user_id, 'name', a.first_name || ' ' || a.last_name));
end $$;
revoke execute on function public.admin_review_application(uuid, boolean, text) from public, anon;
grant execute on function public.admin_review_application(uuid, boolean, text) to authenticated;

/* ---------- 2. plans ---------- */

-- Coaches from before plans existed keep working as they did: no limit. (Only the first time this
-- runs: the column is new then.)
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'coaches' and column_name = 'plan') then
    alter table public.coaches add column plan text not null default 'free' check (plan in ('free', 'pro', 'studio'));
    update public.coaches set plan = 'studio';
  end if;
end $$;
alter table public.coaches add column if not exists plan_until date;

-- How many active students a coach may have now; null is no limit. A granted plan past its
-- date is free again.
create or replace function public.coach_capacity(p_coach uuid) returns int
language sql stable security definer set search_path = public as $$
  select case when c.plan_until is not null and c.plan_until < current_date then 10
              when c.plan = 'free' then 10 when c.plan = 'pro' then 30 else null end
  from public.coaches c where c.id = p_coach
$$;
grant execute on function public.coach_capacity(uuid) to authenticated;

-- A new student (or one switched back on, or joining by code) needs room on the coach's plan.
create or replace function public.students_capacity() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_cap int;
begin
  if new.coach_id is null or not new.active then return new; end if;
  if tg_op = 'UPDATE' and old.coach_id is not distinct from new.coach_id and old.active then return new; end if;
  v_cap := public.coach_capacity(new.coach_id);
  if v_cap is not null and (select count(*) from students where coach_id = new.coach_id and active and id <> new.id) >= v_cap then
    raise exception 'coach is full' using errcode = '22023';
  end if;
  return new;
end $$;
drop trigger if exists students_capacity on public.students;
create trigger students_capacity before insert or update of coach_id, active on public.students
  for each row execute function public.students_capacity();

create or replace function public.admin_set_plan(p_coach uuid, p_plan text, p_until date) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_guard();
  update coaches set plan = p_plan, plan_until = p_until where id = p_coach;
  if not found then raise exception 'no such coach' using errcode = '22023'; end if;
  perform public.admin_note('plan_set', jsonb_build_object('coach', p_coach, 'plan', p_plan, 'until', p_until));
end $$;
revoke execute on function public.admin_set_plan(uuid, text, date) from public, anon;
grant execute on function public.admin_set_plan(uuid, text, date) to authenticated;

/* ---------- 3. feedback under a workout ---------- */

create table if not exists public.workout_comments (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  author uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists workout_comments_workout on public.workout_comments (workout_id, created_at);
alter table public.workout_comments enable row level security;
-- The student whose workout it is, and their coach, read and write; each deletes only their own.
create policy "student talks on own workouts" on public.workout_comments for select using (public.is_student(public.workout_student(workout_id)));
create policy "coach talks on student workouts" on public.workout_comments for select using (public.coaches_student(public.workout_student(workout_id)));
create policy "write as yourself" on public.workout_comments for insert with check (
  author = auth.uid() and (public.is_student(public.workout_student(workout_id)) or public.coaches_student(public.workout_student(workout_id))));
create policy "delete own" on public.workout_comments for delete using (author = auth.uid());
create policy "admin all" on public.workout_comments for all using (public.is_admin()) with check (public.is_admin());
grant select, insert, delete on public.workout_comments to authenticated;
