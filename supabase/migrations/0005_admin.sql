-- Super admin: the owner of the system sees and manages everything. Run once in Supabase →
-- SQL Editor, after 0004. Then make yourself the first admin (your number, as you sign in with it):
--
--   insert into public.admin_phones (phone) values ('09121234567');
--
-- After that, admins add and remove other admins, coaches and accounts from the app.
--
-- What an admin may do
--   - read every row of every table (people, plans, workouts, weights, questionnaires);
--   - change any student or plan, as their coach would;
--   - grant and remove coach access, switch a coach off without losing their data, move students
--     between coaches, reset a student's login, delete an account, add and remove admins;
--   - read the activity of the whole system and the log of what admins did.
-- All of it is enforced here, in the database: the app only shows the buttons.

/* ---------- who is an admin ---------- */

create table public.admin_phones (
  phone text primary key,
  added_at timestamptz not null default now()
);
alter table public.admin_phones enable row level security;
revoke all on public.admin_phones from anon, authenticated;

create trigger admin_phones_norm
  before insert on public.admin_phones
  for each row execute function public.coach_phones_norm();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from auth.users u join public.admin_phones a on a.phone = public.phone_of_email(u.email)
     where u.id = auth.uid())
$$;
-- Every policy below asks it, so signed-out visitors may too (for them it is simply false).
grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.admin_guard() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
end $$;

/* ---------- what admins did ---------- */

create table public.admin_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  admin_id uuid,
  action text not null,
  detail jsonb not null default '{}'
);
create index on public.admin_log (at desc);
alter table public.admin_log enable row level security;
revoke all on public.admin_log from anon, authenticated;
grant select on public.admin_log to authenticated;
create policy "admin reads log" on public.admin_log for select using (public.is_admin());

create or replace function public.admin_note(p_action text, p_detail jsonb) returns void
language sql security definer set search_path = public as $$
  insert into public.admin_log (admin_id, action, detail) values (auth.uid(), p_action, coalesce(p_detail, '{}'))
$$;
revoke execute on function public.admin_note(text, jsonb) from public, anon, authenticated;

/* ---------- a coach can be switched off, keeping their students and data ---------- */

alter table public.coaches add column if not exists active boolean not null default true;

create or replace function public.is_active_coach() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.coaches where id = auth.uid() and active)
$$;

-- Every coach rule goes through these two, so switching a coach off closes all of them.
create or replace function public.coaches_student(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.students s join public.coaches c on c.id = s.coach_id
                  where s.id = sid and s.coach_id = auth.uid() and c.active)
$$;

drop policy if exists "coach manages own students" on public.students;
create policy "coach manages own students" on public.students for all
  using (coach_id = auth.uid() and public.is_active_coach())
  with check (coach_id = auth.uid() and public.is_active_coach());

-- A coach may rename themselves, but not switch themselves back on.
revoke update on public.coaches from authenticated;
grant update (full_name) on public.coaches to authenticated;

/* ---------- admins reach every row ---------- */

create policy "admin all" on public.coaches for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all" on public.students for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all" on public.routines for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all" on public.routine_items for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all" on public.workouts for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all" on public.workout_sets for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all" on public.body_weights for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all" on public.intakes for all using (public.is_admin()) with check (public.is_admin());
grant delete on public.intakes to authenticated;

/* ---------- plans: when they last changed; admins may save any ---------- */

alter table public.students add column if not exists plan_updated_at timestamptz;

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
  perform public.plan_touched(p_student);
end $$;

-- Stamps the plan's time; an admin saving someone else's student's plan is logged. Checks for
-- itself who is asking, since anyone signed in can call it.
create or replace function public.plan_touched(p_student uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.coaches_student(p_student) then
    update public.students set plan_updated_at = now() where id = p_student;
  elsif public.is_admin() then
    update public.students set plan_updated_at = now() where id = p_student;
    perform public.admin_note('plan_saved', jsonb_build_object('student', p_student));
  end if;
end $$;
revoke execute on function public.plan_touched(uuid) from public, anon;
grant execute on function public.plan_touched(uuid) to authenticated;

/* ---------- reading the whole system ---------- */

create or replace function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_guard();
  return jsonb_build_object(
    'users', (select count(*) from auth.users),
    'signups_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'no_role', (select count(*) from auth.users u where not exists (select 1 from coaches c where c.id = u.id)
                  and not exists (select 1 from students s where s.user_id = u.id)
                  and not exists (select 1 from admin_phones a where a.phone = phone_of_email(u.email))),
    'coaches', (select count(*) from coaches where active),
    'coaches_off', (select count(*) from coaches where not active),
    'coach_phones_waiting', (select count(*) from coach_phones p where not exists (select 1 from auth.users u where phone_of_email(u.email) = p.phone)),
    'students', (select count(*) from students),
    'students_linked', (select count(*) from students where user_id is not null and active),
    'students_waiting', (select count(*) from students where user_id is null and active),
    'students_off', (select count(*) from students where not active),
    'workouts', (select count(*) from workouts),
    'workouts_7d', (select count(*) from workouts where date > current_date - 7),
    'sets', (select count(*) from workout_sets),
    'admins', (select count(*) from admin_phones)
  );
end $$;

-- Every account, with what it is in the app.
create or replace function public.admin_users()
returns table (id uuid, phone text, email text, created_at timestamptz, last_sign_in_at timestamptz,
               is_admin boolean, coach_active boolean, coach_name text, coach_students int,
               student_id uuid, student_name text, student_coach text)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_guard();
  return query
  select u.id, phone_of_email(u.email), u.email::text, u.created_at, u.last_sign_in_at,
         exists (select 1 from admin_phones a where a.phone = phone_of_email(u.email)),
         c.active, c.full_name, (select count(*)::int from students s2 where s2.coach_id = c.id),
         s.id, s.full_name, sc.full_name
    from auth.users u
    left join coaches c on c.id = u.id
    left join students s on s.user_id = u.id
    left join coaches sc on sc.id = s.coach_id
   order by u.created_at desc;
end $$;

-- Coach numbers granted before that person signed up.
create or replace function public.admin_waiting_coaches() returns setof text
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_guard();
  return query select p.phone from coach_phones p
    where not exists (select 1 from auth.users u where phone_of_email(u.email) = p.phone) order by p.phone;
end $$;

create or replace function public.admin_admins() returns table (phone text, added_at timestamptz, signed_up boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_guard();
  return query select a.phone, a.added_at, exists (select 1 from auth.users u where phone_of_email(u.email) = a.phone)
    from admin_phones a order by a.added_at;
end $$;

-- What happened lately, newest first: sign-ups, sign-ins, workouts, plans, questionnaires,
-- students added, and every admin action.
create or replace function public.admin_activity(p_limit int default 80, p_before timestamptz default null)
returns table (at timestamptz, kind text, who text, detail text, student_id uuid, coach_id uuid)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_guard();
  return query
  with names as (
    select u.id, coalesce(nullif(c.full_name, ''), s.full_name, phone_of_email(u.email), u.email::text) as name
      from auth.users u left join coaches c on c.id = u.id left join students s on s.user_id = u.id
  ), ev as (
    select u.created_at as at, 'signup'::text as kind, n.name as who, ''::text as detail, null::uuid as student_id, null::uuid as coach_id
      from auth.users u join names n on n.id = u.id
    union all
    select u.last_sign_in_at, 'login', n.name, '', null, null
      from auth.users u join names n on n.id = u.id where u.last_sign_in_at is not null
    union all
    select w.created_at, 'workout', s.full_name, w.routine_name, s.id, s.coach_id
      from workouts w join students s on s.id = w.student_id
    union all
    select s.plan_updated_at, 'plan', s.full_name, coalesce(c.full_name, ''), s.id, s.coach_id
      from students s left join coaches c on c.id = s.coach_id where s.plan_updated_at is not null
    union all
    select i.updated_at, 'intake', s.full_name, '', s.id, s.coach_id
      from intakes i join students s on s.id = i.student_id
    union all
    select s.created_at, 'student_added', s.full_name, '', s.id, s.coach_id
      from students s
    union all
    select l.at, 'admin:' || l.action, coalesce(n.name, ''), l.detail::text,
           case when l.detail ? 'student' then (l.detail ->> 'student')::uuid end,
           case when l.detail ? 'coach' then (l.detail ->> 'coach')::uuid end
      from admin_log l left join names n on n.id = l.admin_id
  )
  select * from ev where ev.at is not null and (p_before is null or ev.at < p_before)
   order by ev.at desc limit least(greatest(p_limit, 1), 500);
end $$;

/* ---------- managing people ---------- */

-- Make a phone a coach (now, or when that person signs up). Switches a stopped coach back on.
create or replace function public.admin_grant_coach(p_phone text) returns void
language plpgsql security definer set search_path = public as $$
declare v text := phone_norm(p_phone);
begin
  perform public.admin_guard();
  if v !~ '^09[0-9]{9}$' then raise exception 'invalid phone' using errcode = '22023'; end if;
  insert into coach_phones (phone) values (v) on conflict do nothing;
  insert into coaches (id, email, full_name)
    select u.id, u.email, '' from auth.users u where phone_of_email(u.email) = v
    on conflict (id) do update set active = true;
  perform public.admin_note('coach_granted', jsonb_build_object('phone', v));
end $$;

-- Switch a coach off or on. Off: they can no longer sign in as a coach or see their students;
-- the students, plans and history stay, and their students keep training.
create or replace function public.admin_set_coach_active(p_coach uuid, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_phone text;
begin
  perform public.admin_guard();
  update coaches set active = p_active where id = p_coach returning phone_of_email(email) into v_phone;
  if not found then raise exception 'no such coach' using errcode = '22023'; end if;
  if v_phone is not null then
    if p_active then insert into coach_phones (phone) values (v_phone) on conflict do nothing;
    else delete from coach_phones where phone = v_phone; end if;
  end if;
  perform public.admin_note(case when p_active then 'coach_on' else 'coach_off' end, jsonb_build_object('coach', p_coach));
end $$;

create or replace function public.admin_revoke_waiting_coach(p_phone text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_guard();
  delete from coach_phones where phone = phone_norm(p_phone);
  perform public.admin_note('coach_revoked', jsonb_build_object('phone', phone_norm(p_phone)));
end $$;

create or replace function public.admin_rename_coach(p_coach uuid, p_name text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_guard();
  update coaches set full_name = left(trim(p_name), 60) where id = p_coach;
  perform public.admin_note('coach_renamed', jsonb_build_object('coach', p_coach, 'name', left(trim(p_name), 60)));
end $$;

-- Remove the coach role entirely. Only once their students have been moved elsewhere, so no
-- student's history goes with it. The account stays; it just has no role.
create or replace function public.admin_remove_coach(p_coach uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_phone text;
begin
  perform public.admin_guard();
  if exists (select 1 from students where coach_id = p_coach) then
    raise exception 'move this coach''s students first' using errcode = '22023';
  end if;
  delete from coaches where id = p_coach returning phone_of_email(email) into v_phone;
  if v_phone is not null then delete from coach_phones where phone = v_phone; end if;
  perform public.admin_note('coach_removed', jsonb_build_object('coach', p_coach, 'phone', v_phone));
end $$;

-- Move a student (with their plan and history) to another coach.
create or replace function public.admin_move_student(p_student uuid, p_coach uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_from uuid;
begin
  perform public.admin_guard();
  if not exists (select 1 from coaches where id = p_coach) then raise exception 'no such coach' using errcode = '22023'; end if;
  select coach_id into v_from from students where id = p_student;
  if v_from is null then raise exception 'no such student' using errcode = '22023'; end if;
  update students set coach_id = p_coach where id = p_student;
  perform public.admin_note('student_moved', jsonb_build_object('student', p_student, 'from', v_from, 'coach', p_coach));
end $$;

-- Forgotten password: the student's account is deleted and a new invite code issued; they sign up
-- again with the same number and keep their plan and history. Returns the new code.
create or replace function public.admin_reset_login(p_student uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_code text := public.new_invite_code();
begin
  perform public.admin_guard();
  select user_id into v_user from students where id = p_student;
  if not found then raise exception 'no such student' using errcode = '22023'; end if;
  if v_user = auth.uid() then raise exception 'not your own account' using errcode = '22023'; end if;
  if v_user is not null and (exists (select 1 from coaches where id = v_user)
       or exists (select 1 from auth.users u join admin_phones a on a.phone = phone_of_email(u.email) where u.id = v_user)) then
    raise exception 'this account is also a coach or an admin' using errcode = '22023';
  end if;
  update students set user_id = null, invite_code = v_code where id = p_student;
  if v_user is not null then delete from auth.users where id = v_user; end if;
  perform public.admin_note('login_reset', jsonb_build_object('student', p_student));
  return v_code;
end $$;

-- Delete an account. A student's row and history stay (unlinked, ready for a new sign-up); a coach
-- with students must have them moved first; nobody deletes their own account here.
create or replace function public.admin_delete_user(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_email text;
begin
  perform public.admin_guard();
  if p_user = auth.uid() then raise exception 'not your own account' using errcode = '22023'; end if;
  if exists (select 1 from students where coach_id = p_user) then
    raise exception 'move this coach''s students first' using errcode = '22023';
  end if;
  select email into v_email from auth.users where id = p_user;
  if not found then raise exception 'no such account' using errcode = '22023'; end if;
  delete from admin_phones where phone = phone_of_email(v_email);
  delete from coach_phones where phone = phone_of_email(v_email);
  update students set invite_code = public.new_invite_code() where user_id = p_user;
  delete from auth.users where id = p_user;
  perform public.admin_note('user_deleted', jsonb_build_object('phone', phone_of_email(v_email), 'email', v_email));
end $$;

-- Add or remove an admin. Nobody removes themselves, so there is always at least one.
create or replace function public.admin_set_admin(p_phone text, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v text := phone_norm(p_phone);
begin
  perform public.admin_guard();
  if v !~ '^09[0-9]{9}$' then raise exception 'invalid phone' using errcode = '22023'; end if;
  if p_on then
    insert into admin_phones (phone) values (v) on conflict do nothing;
  else
    if v = (select phone_of_email(email) from auth.users where id = auth.uid()) then
      raise exception 'not yourself' using errcode = '22023';
    end if;
    delete from admin_phones where phone = v;
  end if;
  perform public.admin_note(case when p_on then 'admin_added' else 'admin_removed' end, jsonb_build_object('phone', v));
end $$;

do $$
declare f text;
begin
  foreach f in array array['admin_guard()', 'admin_stats()', 'admin_users()', 'admin_waiting_coaches()', 'admin_admins()',
    'admin_activity(int, timestamptz)', 'admin_grant_coach(text)', 'admin_set_coach_active(uuid, boolean)',
    'admin_revoke_waiting_coach(text)', 'admin_rename_coach(uuid, text)', 'admin_remove_coach(uuid)',
    'admin_move_student(uuid, uuid)', 'admin_reset_login(uuid)', 'admin_delete_user(uuid)', 'admin_set_admin(text, boolean)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
