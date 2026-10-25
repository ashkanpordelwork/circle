-- Super admin: sees and manages everything; nobody else reaches any of it.
-- Runs after rls.test.sql (which defines t_as / t_check / t_fails).
\set ON_ERROR_STOP 1

-- d1 admin · e1, e2 coaches · f1 student of e1 (signed up) · g2 student of e2 · f9 a stranger
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', '09120000001@phone.invalid'),
  ('00000000-0000-0000-0000-0000000000e1', '09120000002@phone.invalid'),
  ('00000000-0000-0000-0000-0000000000e2', '09120000003@phone.invalid'),
  ('00000000-0000-0000-0000-0000000000f1', '09120000004@phone.invalid'),
  ('00000000-0000-0000-0000-0000000000f9', '09120000009@phone.invalid');
insert into public.coach_phones values ('09120000002'), ('09120000003');
insert into public.admin_phones (phone) values ('۰۹۱۲ ۰۰۰ ۰۰۰۱');
insert into public.students (id, coach_id, full_name, phone, user_id) values
  ('00000000-0000-0000-0000-0000000000f0', '00000000-0000-0000-0000-0000000000e1', 'فرهاد', '09120000004', '00000000-0000-0000-0000-0000000000f1'),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000e2', 'گلاره', '09120000005', null);

-- A stranger and a coach: none of the admin tools, no one else's rows.
begin;
set local role authenticated;
select public.t_as('00000000-0000-0000-0000-0000000000f9');
select public.t_check(not public.is_admin(), 'stranger is not an admin');
select public.t_fails($$select public.admin_stats()$$, 'stranger reading stats');
select public.t_fails($$select * from public.admin_users()$$, 'stranger listing accounts');
select public.t_fails($$select * from public.admin_activity()$$, 'stranger reading activity');
select public.t_fails($$select public.admin_set_admin('09120000009', true)$$, 'stranger making themselves admin');
select public.t_fails($$insert into public.admin_phones (phone) values ('09120000009')$$, 'stranger writing admin_phones');
select public.plan_touched('00000000-0000-0000-0000-0000000000f0');
select public.t_check((select count(*) = 0 from public.admin_log), 'stranger cannot read or forge the admin log');
select public.t_as('00000000-0000-0000-0000-0000000000e1');
select public.t_check((select count(*) = 1 from public.students), 'a coach still sees only their own students');
select public.t_fails($$select public.admin_move_student('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000e1')$$, 'coach moving a student');
select public.t_fails($$update public.coaches set active = true where id = auth.uid()$$, 'coach switching themselves on');
commit;

-- The admin reads everything and changes anything.
begin;
set local role authenticated;
select public.t_as('00000000-0000-0000-0000-0000000000d1');
select public.t_check(public.is_admin(), 'admin by phone, written any way');
select public.t_check((select count(*) >= 4 from public.students), 'admin sees every student');
select public.t_check((select count(*) >= 4 from public.coaches), 'admin sees every coach');
select public.t_check((select (public.admin_stats() ->> 'admins')::int = 1), 'stats');
select public.t_check((select count(*) = 1 from public.admin_users() where student_name = 'فرهاد' and student_coach is not null), 'accounts with their roles');
update public.students set note = 'از طرف مدیر' where id = '00000000-0000-0000-0000-0000000000f2';
select public.save_plan('00000000-0000-0000-0000-0000000000f2', '[{"id":"00000000-0000-0000-0000-00000000aa01","name":"کل بدن","days":[6],"items":[{"exercise_id":"squat","sets":3,"reps":"8"}]}]');
select public.t_check((select count(*) = 1 from public.routines where student_id = '00000000-0000-0000-0000-0000000000f2'), 'admin saves any plan');
select public.t_check((select plan_updated_at is not null from public.students where id = '00000000-0000-0000-0000-0000000000f2'), 'plan time stamped');
select public.admin_move_student('00000000-0000-0000-0000-0000000000f0', '00000000-0000-0000-0000-0000000000e2');
select public.t_check((select coach_id = '00000000-0000-0000-0000-0000000000e2' from public.students where id = '00000000-0000-0000-0000-0000000000f0'), 'student moved');
select public.admin_set_coach_active('00000000-0000-0000-0000-0000000000e2', false);
commit;

-- A coach switched off reaches nothing; switched on again, everything is back.
begin;
set local role authenticated;
select public.t_as('00000000-0000-0000-0000-0000000000e2');
select public.t_check((select count(*) = 0 from public.students), 'stopped coach sees no students');
select public.t_check((select count(*) = 0 from public.routines), 'stopped coach sees no plans');
select public.t_fails($$select public.save_plan('00000000-0000-0000-0000-0000000000f2', '[]')$$, 'stopped coach saving a plan');
select public.t_fails($$insert into public.students (full_name, phone) values ('x', '09120000077')$$, 'stopped coach adding a student');
commit;
begin;
set local role authenticated;
select public.t_as('00000000-0000-0000-0000-0000000000d1');
select public.admin_set_coach_active('00000000-0000-0000-0000-0000000000e2', true);
select public.t_as('00000000-0000-0000-0000-0000000000e2');
select public.t_check((select count(*) = 2 from public.students), 'coach on again sees both students');
commit;

-- Guards: no deleting a coach who still has students, no removing yourself, no deleting yourself.
begin;
set local role authenticated;
select public.t_as('00000000-0000-0000-0000-0000000000d1');
select public.t_fails($$select public.admin_remove_coach('00000000-0000-0000-0000-0000000000e2')$$, 'removing a coach who has students');
select public.t_fails($$select public.admin_delete_user('00000000-0000-0000-0000-0000000000e2')$$, 'deleting a coach account with students');
select public.t_fails($$select public.admin_set_admin('09120000001', false)$$, 'admin removing themselves');
select public.t_fails($$select public.admin_delete_user('00000000-0000-0000-0000-0000000000d1')$$, 'admin deleting themselves');
select public.admin_remove_coach('00000000-0000-0000-0000-0000000000e1');
select public.t_check(not exists (select 1 from public.coaches where id = '00000000-0000-0000-0000-0000000000e1'), 'coach without students removed');
select public.admin_grant_coach('0912 000 0002');
select public.t_check(exists (select 1 from public.coaches where id = '00000000-0000-0000-0000-0000000000e1' and active), 'coach granted again');
select public.admin_set_admin('09120000009', true);
select public.t_as('00000000-0000-0000-0000-0000000000f9');
select public.t_check(public.is_admin(), 'new admin');
select public.t_fails($$select public.admin_set_admin('09120000009', false)$$, 'new admin removing themselves');
select public.t_as('00000000-0000-0000-0000-0000000000d1');
select public.admin_set_admin('09120000009', false);
select public.t_as('00000000-0000-0000-0000-0000000000f9');
select public.t_check(not public.is_admin(), 'admin removed by another admin');
commit;

-- Forgotten password, deleted accounts, and the record of all of it.
begin;
set local role authenticated;
select public.t_as('00000000-0000-0000-0000-0000000000d1');
select public.t_check((select length(public.admin_reset_login('00000000-0000-0000-0000-0000000000f0')) = 6), 'reset gives a new code');
select public.t_check((select user_id is null from public.students where id = '00000000-0000-0000-0000-0000000000f0'), 'student unlinked, history kept');
select public.t_check(not exists (select 1 from public.admin_users() u where u.id = '00000000-0000-0000-0000-0000000000f1'), 'old account gone, number free to sign up again');
select public.admin_delete_user('00000000-0000-0000-0000-0000000000f9');
select public.t_check(not exists (select 1 from public.admin_users() u where u.id = '00000000-0000-0000-0000-0000000000f9'), 'account deleted');
select public.t_check((select count(*) >= 8 from public.admin_log), 'every admin action logged');
select public.t_check((select count(*) > 0 from public.admin_activity(20) where kind = 'admin:student_moved'), 'activity shows admin actions');
select public.t_check((select count(*) > 0 from public.admin_activity(500) where kind = 'plan'), 'activity shows plan saves');
commit;
\echo ALL ADMIN TESTS PASSED
