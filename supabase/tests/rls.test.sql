-- Access-rule tests. Run on a fresh database after supabase-shim.sql and the migration
-- (scripts/test-db.sh does all three). Each block acts as one user — role `authenticated` plus
-- their JWT subject, which is what Supabase sets — and raises on a wrong answer.

\set ON_ERROR_STOP 1
create function public.t_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true)
$$;
create function public.t_check(ok boolean, what text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAILED: %', what; end if; end $$;
-- Expects `sql` to fail (RLS violation, permission denied, or our own raise).
create function public.t_fails(sql text, what text) returns void language plpgsql as $$
begin
  begin execute sql; exception when others then return; end;
  raise exception 'FAILED (should have been refused): %', what;
end $$;
grant execute on function public.t_as(uuid), public.t_check(boolean, text), public.t_fails(text, text) to authenticated;

-- ids
--   c1, c2  coaches            a1 Ali's account   ff stranger's account
--   sa      Ali (student row)  ss Sara (student row, signs in later)
--   r1      Ali's routine      x1 a routine of coach two's student

insert into public.coach_emails values ('Coach.One@gmail.com'), ('coach2@gmail.com');
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000c1', 'coachone@gmail.com', '{"full_name":"مربی یک"}'),
  ('00000000-0000-0000-0000-0000000000c2', 'coach2@gmail.com', '{}'),
  ('00000000-0000-0000-0000-0000000000a1', 'ali.rezaei@gmail.com', '{}'),
  ('00000000-0000-0000-0000-0000000000ff', 'stranger@gmail.com', '{}');
select public.t_check((select count(*) = 2 from public.coaches), 'coach addresses become coaches, dots and case ignored');
select public.t_check((select full_name = 'مربی یک' from public.coaches where id = '00000000-0000-0000-0000-0000000000c1'), 'coach name taken from Google');

-- Coach one: registers Ali (his account exists → linked now) and Sara, and writes Ali's plan.
begin;
set local role authenticated;
select public.t_as('00000000-0000-0000-0000-0000000000c1');
insert into public.students (id, full_name, email) values
  ('00000000-0000-0000-0000-0000000000aa', 'علی', 'AliRezaei+gym@gmail.com'),
  ('00000000-0000-0000-0000-0000000000bb', 'سارا', 'sara@gmail.com');
select public.t_check((select user_id = '00000000-0000-0000-0000-0000000000a1' from public.students where id = '00000000-0000-0000-0000-0000000000aa'), 'existing account linked on registration');
select public.t_check((select coach_id = '00000000-0000-0000-0000-0000000000c1' from public.students where id = '00000000-0000-0000-0000-0000000000aa'), 'coach_id defaults to the caller');
select public.t_fails($$insert into public.students (full_name, email) values ('دوباره', 'alirezaei@gmail.com')$$, 'same Gmail twice');
select public.save_plan('00000000-0000-0000-0000-0000000000aa', '[
  {"id":"00000000-0000-0000-0000-000000000001","name":"پا","days":[6,3],
   "items":[{"exercise_id":"Barbell_Squat","sets":4,"reps":"8-10","weight":"60"},{"exercise_id":"Lunges","sets":3,"reps":"12"}]}
]'::jsonb);
select public.t_check((select count(*) = 2 from public.routine_items), 'plan saved with two exercises');
update public.students set note = 'آب زیاد بخور' where id = '00000000-0000-0000-0000-0000000000aa';
commit;

-- Coach two: own student, and none of coach one's.
begin;
set local role authenticated;
select public.t_as('00000000-0000-0000-0000-0000000000c2');
select public.t_check((select count(*) = 0 from public.students), 'coach two sees nobody of coach one');
select public.t_check((select count(*) = 0 from public.routines), 'coach two sees no routines of coach one');
insert into public.students (id, full_name, email) values ('00000000-0000-0000-0000-0000000000cc', 'رضا', 'reza@gmail.com');
select public.save_plan('00000000-0000-0000-0000-0000000000cc', '[{"id":"00000000-0000-0000-0000-000000000009","name":"x","days":[1],"items":[]}]');
select public.t_fails($$select public.save_plan('00000000-0000-0000-0000-0000000000aa', '[]')$$, 'coach two writing coach one''s student plan');
select public.t_fails($$insert into public.students (full_name, email, coach_id) values ('ربوده', 'x@gmail.com', '00000000-0000-0000-0000-0000000000c1')$$, 'creating a student for another coach');
commit;

-- Coach one cannot hijack coach two's routine id through save_plan.
begin;
set local role authenticated;
select public.t_as('00000000-0000-0000-0000-0000000000c1');
select public.t_fails($$select public.save_plan('00000000-0000-0000-0000-0000000000aa', '[{"id":"00000000-0000-0000-0000-000000000009","name":"y","days":[],"items":[]}]')$$, 'reusing another student''s routine id');
commit;

-- Ali, the student: reads his plan and note, logs a workout and his weight, cannot touch the plan.
begin;
set local role authenticated;
select public.t_as('00000000-0000-0000-0000-0000000000a1');
select public.t_check((select count(*) = 1 from public.students), 'student sees exactly himself');
select public.t_check((select note = 'آب زیاد بخور' from public.students), 'student reads coach note');
select public.t_check((select days = '{6,3}' from public.routines), 'student reads his routine');
select public.t_check((select count(*) = 2 from public.routine_items), 'student reads his exercises');
insert into public.workouts (id, student_id, routine_id, routine_name) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-000000000001', 'پا');
insert into public.workout_sets (workout_id, exercise_id, set_index, reps, weight) values
  ('00000000-0000-0000-0000-0000000000e1', 'Barbell_Squat', 1, 10, 60);
insert into public.body_weights (student_id, weight) values ('00000000-0000-0000-0000-0000000000aa', 78.5);
update public.routines set name = 'hacked';   -- RLS: matches no row for a student
select public.t_check((select name = 'پا' from public.routines), 'routine unchanged by student');
select public.t_fails($$select public.save_plan('00000000-0000-0000-0000-0000000000aa', '[]')$$, 'student saving a plan');
select public.t_fails($$update public.students set coach_id = '00000000-0000-0000-0000-0000000000c2'$$, 'student changing coach');
select public.t_fails($$insert into public.workouts (student_id) values ('00000000-0000-0000-0000-0000000000bb')$$, 'logging a workout for Sara');
commit;

-- The stranger: signed in, matches nothing.
begin;
set local role authenticated;
select public.t_as('00000000-0000-0000-0000-0000000000ff');
select public.t_check((select count(*) = 0 from public.students), 'stranger sees no students');
select public.t_check((select count(*) = 0 from public.routines), 'stranger sees no routines');
select public.t_check((select count(*) = 0 from public.workouts), 'stranger sees no workouts');
select public.t_check((select count(*) = 0 from public.coaches), 'stranger is no coach');
select public.t_fails($$select * from public.coach_emails$$, 'nobody reads the coach list');
select public.t_fails($$insert into public.students (full_name, email) values ('من', 'me@gmail.com')$$, 'stranger registering a student');
commit;

-- Anonymous visitors see nothing either.
begin;
set local role anon;
select public.t_check((select count(*) = 0 from public.students), 'anon sees no students');
select public.t_check((select count(*) = 0 from public.routine_items), 'anon sees no exercises');
commit;

-- Coach one reads Ali's training back.
begin;
set local role authenticated;
select public.t_as('00000000-0000-0000-0000-0000000000c1');
select public.t_check((select count(*) = 1 from public.workouts), 'coach reads student workouts');
select public.t_check((select reps = 10 from public.workout_sets), 'coach reads logged sets');
select public.t_check((select weight = 78.5 from public.body_weights), 'coach reads body weight');
-- Plan edited again: the routine keeps its id, so the logged workout stays linked.
select public.save_plan('00000000-0000-0000-0000-0000000000aa', '[
  {"id":"00000000-0000-0000-0000-000000000001","name":"پا و شکم","days":[6],"items":[{"exercise_id":"Crunches","sets":3,"reps":"20"}]}
]'::jsonb);
select public.t_check((select routine_id is not null from public.workouts), 'workout still linked after plan edit');
select public.t_check((select count(*) = 1 from public.routine_items), 'items replaced');
commit;

-- Sara signs in for the first time: linked by the auth trigger.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000b2', 'Sara@Gmail.com');
select public.t_check((select user_id = '00000000-0000-0000-0000-0000000000b2' from public.students where id = '00000000-0000-0000-0000-0000000000bb'), 'student linked on first sign-in');

-- A coach address added after the person already signed in.
insert into public.coach_emails values ('stranger@gmail.com');
select public.t_check((select count(*) = 3 from public.coaches), 'late coach address still makes a coach');

\echo ALL RLS TESTS PASSED
