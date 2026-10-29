-- Body: measurements and a readiness check-in. Run once in Supabase → SQL Editor, after 0008.
--
-- Both are the athlete's alone: no coach policy at all, so a coach never sees them (the coach
-- page says so before anyone joins). Progress photos never reach the server: they stay on the
-- phone (src/lib/photos.js).

create table if not exists public.body_measurements (
  student_id uuid not null references public.students (id) on delete cascade,
  date date not null default current_date,
  waist numeric(5,1) check (waist between 30 and 250),
  chest numeric(5,1) check (chest between 30 and 250),
  hips numeric(5,1) check (hips between 30 and 250),
  arm numeric(5,1) check (arm between 10 and 100),
  thigh numeric(5,1) check (thigh between 20 and 150),
  neck numeric(5,1) check (neck between 15 and 80),
  body_fat numeric(4,1) check (body_fat between 2 and 70),
  primary key (student_id, date)
);
alter table public.body_measurements enable row level security;
create policy "athlete keeps measurements" on public.body_measurements for all
  using (public.is_student(student_id)) with check (public.is_student(student_id));
grant select, insert, update, delete on public.body_measurements to authenticated;

-- How the athlete feels before training, 1 (bad) to 5 (good) on each; soreness and stress are
-- asked so that 5 means none.
create table if not exists public.readiness_checks (
  student_id uuid not null references public.students (id) on delete cascade,
  date date not null default current_date,
  sleep smallint not null check (sleep between 1 and 5),
  energy smallint not null check (energy between 1 and 5),
  soreness smallint not null check (soreness between 1 and 5),
  stress smallint not null check (stress between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (student_id, date)
);
alter table public.readiness_checks enable row level security;
create policy "athlete checks in" on public.readiness_checks for all
  using (public.is_student(student_id)) with check (public.is_student(student_id));
grant select, insert, update, delete on public.readiness_checks to authenticated;
