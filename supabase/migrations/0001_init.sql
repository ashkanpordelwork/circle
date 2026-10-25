-- Coach app schema. Run once in Supabase → SQL Editor (or `supabase db push`).
--
-- Who is who
--   coach_emails   Gmail addresses allowed to act as a coach. You add your own after running this:
--                    insert into public.coach_emails (email) values ('you@gmail.com');
--   coaches        One row per coach, made when that address first signs in.
--   students       Made by a coach (name + Gmail) before the student ever signs in. Linked to the
--                  student's auth user (user_id) when an account with that address exists.
--
-- Nobody else gets any data: every table has row level security, and a signed-in user who is
-- neither a coach nor a registered student matches no policy at all.

create extension if not exists pgcrypto;

-- Gmail ignores dots and "+tags" in the local part, and googlemail.com is the same mailbox.
-- "Ali.Rezaei@Gmail.com" typed by a coach must match "alirezaei@gmail.com" from Google.
create or replace function public.email_key(e text) returns text
language sql immutable as $$
  select case
    when split_part(lower(trim(e)), '@', 2) in ('gmail.com', 'googlemail.com') then
      replace(split_part(split_part(lower(trim(e)), '@', 1), '+', 1), '.', '') || '@gmail.com'
    else lower(trim(e))
  end
$$;

create table public.coach_emails (
  email text primary key
);

create table public.coaches (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  created_at timestamptz not null default now()
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null default auth.uid() references public.coaches (id) on delete cascade,
  full_name text not null check (length(trim(full_name)) between 1 and 60),
  email text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  email_key text generated always as (public.email_key(email)) stored unique,
  user_id uuid unique references auth.users (id) on delete set null,
  note text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- A routine is one session ("Legs"), shown on the weekdays in `days` (0 = Sunday … 6 = Saturday,
-- the same numbering as JavaScript's getDay()).
create table public.routines (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  days smallint[] not null default '{}' check (days <@ array[0,1,2,3,4,5,6]::smallint[]),
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table public.routine_items (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.routines (id) on delete cascade,
  exercise_id text not null,
  sets int not null default 3 check (sets between 1 and 20),
  reps text not null default '10' check (length(reps) <= 20),
  weight numeric(6,2) check (weight >= 0),
  rest_sec int check (rest_sec between 0 and 900),
  note text not null default '' check (length(note) <= 500),
  position int not null default 0
);

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  routine_id uuid references public.routines (id) on delete set null,
  routine_name text not null default '',
  date date not null default current_date,
  note text not null default '' check (length(note) <= 1000),
  created_at timestamptz not null default now()
);

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  exercise_id text not null,
  set_index int not null check (set_index between 1 and 50),
  reps int check (reps between 0 and 1000),
  weight numeric(6,2) check (weight >= 0)
);

create table public.body_weights (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  date date not null default current_date,
  weight numeric(5,2) not null check (weight between 20 and 400),
  unique (student_id, date)
);

create index on public.students (coach_id);
create index on public.routines (student_id);
create index on public.routine_items (routine_id);
create index on public.workouts (student_id, date desc);
create index on public.workout_sets (workout_id);
create index on public.body_weights (student_id, date desc);

/* ---------- linking accounts ---------- */

-- A new auth user becomes a coach when their address is listed, and is linked to a student row
-- a coach already made for that address.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.coach_emails c where public.email_key(c.email) = public.email_key(new.email)) then
    insert into public.coaches (id, email, full_name)
    values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''))
    on conflict (id) do nothing;
  end if;
  update public.students set user_id = new.id
   where email_key = public.email_key(new.email) and user_id is null;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- The other order: the account existed (the student tried to sign in too early) and the coach
-- registers the address afterwards.
create or replace function public.link_student_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is null then
    select u.id into new.user_id from auth.users u
     where public.email_key(u.email) = public.email_key(new.email)   -- new.email_key is not computed yet in a BEFORE trigger
       and not exists (select 1 from public.students s where s.user_id = u.id)
     limit 1;
  end if;
  return new;
end $$;

create trigger students_link_user
  before insert or update of email on public.students
  for each row execute function public.link_student_user();

-- A coach address added after that person already signed in still makes them a coach.
create or replace function public.link_coach_email() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.coaches (id, email, full_name)
  select u.id, u.email, coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', '')
    from auth.users u where public.email_key(u.email) = public.email_key(new.email)
  on conflict (id) do nothing;
  return new;
end $$;

create trigger coach_emails_link
  after insert on public.coach_emails
  for each row execute function public.link_coach_email();

/* ---------- who may see what ---------- */

-- Security definer so policies can ask without tripping over each other's RLS.
create or replace function public.coaches_student(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.students s where s.id = sid and s.coach_id = auth.uid())
$$;

create or replace function public.is_student(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.students s where s.id = sid and s.user_id = auth.uid() and s.active)
$$;

create or replace function public.routine_student(rid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select student_id from public.routines where id = rid
$$;

create or replace function public.workout_student(wid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select student_id from public.workouts where id = wid
$$;

alter table public.coach_emails enable row level security;  -- no policies: SQL editor only
alter table public.coaches enable row level security;
alter table public.students enable row level security;
alter table public.routines enable row level security;
alter table public.routine_items enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_sets enable row level security;
alter table public.body_weights enable row level security;

create policy "coach reads self" on public.coaches for select using (id = auth.uid());
create policy "coach renames self" on public.coaches for update using (id = auth.uid()) with check (id = auth.uid());

create policy "coach manages own students" on public.students for all
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid() and exists (select 1 from public.coaches where id = auth.uid()));
create policy "student reads self" on public.students for select using (user_id = auth.uid() and active);

create policy "coach manages routines" on public.routines for all
  using (public.coaches_student(student_id)) with check (public.coaches_student(student_id));
create policy "student reads routines" on public.routines for select using (public.is_student(student_id));

create policy "coach manages routine items" on public.routine_items for all
  using (public.coaches_student(public.routine_student(routine_id)))
  with check (public.coaches_student(public.routine_student(routine_id)));
create policy "student reads routine items" on public.routine_items for select
  using (public.is_student(public.routine_student(routine_id)));

create policy "student logs workouts" on public.workouts for all
  using (public.is_student(student_id)) with check (public.is_student(student_id));
create policy "coach reads workouts" on public.workouts for select using (public.coaches_student(student_id));

create policy "student logs sets" on public.workout_sets for all
  using (public.is_student(public.workout_student(workout_id)))
  with check (public.is_student(public.workout_student(workout_id)));
create policy "coach reads sets" on public.workout_sets for select
  using (public.coaches_student(public.workout_student(workout_id)));

create policy "student logs weight" on public.body_weights for all
  using (public.is_student(student_id)) with check (public.is_student(student_id));
create policy "coach reads weight" on public.body_weights for select using (public.coaches_student(student_id));

-- A student may not move their own row to another coach or rename themselves; the coach owns it.
revoke update on public.students from authenticated;
grant update (full_name, email, note, active) on public.students to authenticated;

/* ---------- saving a whole plan at once ---------- */

-- The coach's editor sends the full plan: [{id, name, days, items: [{exercise_id, sets, …}]}].
-- Routines keep their ids (so logged workouts stay linked); ones missing from the payload are
-- deleted; items are replaced. One transaction, so the student never sees half a plan.
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
    -- An id that belongs to some other student's routine was not updated above; refuse it rather
    -- than touch that routine's items below.
    if not exists (select 1 from public.routines where id = (r ->> 'id')::uuid and student_id = p_student) then
      raise exception 'routine % is not in this plan', r ->> 'id';
    end if;
    delete from public.routine_items where routine_id = (r ->> 'id')::uuid;
    ipos := 0;
    for i in select * from jsonb_array_elements(coalesce(r -> 'items', '[]')) loop
      insert into public.routine_items (routine_id, exercise_id, sets, reps, weight, rest_sec, note, position)
      values ((r ->> 'id')::uuid, i ->> 'exercise_id', coalesce((i ->> 'sets')::int, 3),
              coalesce(i ->> 'reps', '10'), nullif(i ->> 'weight', '')::numeric,
              nullif(i ->> 'rest_sec', '')::int, coalesce(i ->> 'note', ''), ipos);
      ipos := ipos + 1;
    end loop;
    pos := pos + 1;
  end loop;
end $$;

grant execute on function public.save_plan(uuid, jsonb) to authenticated;
