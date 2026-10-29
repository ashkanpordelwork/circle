-- Coaching: applying and the admin's decision, plan limits, feedback under a workout.
\set ON_ERROR_STOP 1
-- d9 an athlete who applies; the admin is whoever admin.test.sql made (looked up below).
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000d9', '09140000001@phone.invalid');
select id as admin_id from auth.users where public.phone_of_email(email) in (select phone from public.admin_phones) limit 1 \gset

begin;
set local role authenticated;
select public.t_as('00000000-0000-0000-0000-0000000000d9');
select public.apply_to_coach('سینا', 'راد', 5, '{قدرتی,کاهش وزن}', 12, 'مدرک فدراسیون', '');
select public.t_fails($$select public.apply_to_coach('سینا', 'راد', 5, '{قدرتی}', 12, '', '')$$, 'two pending applications');
select public.t_check((select count(*) = 1 from public.coach_applications), 'the applicant reads their own');
select public.t_fails($$select public.admin_review_application((select id from public.coach_applications limit 1), true, '')$$, 'approving yourself');
commit;

begin;
set local role authenticated;
select public.t_as(:'admin_id');
select public.admin_review_application((select id from public.coach_applications where user_id = '00000000-0000-0000-0000-0000000000d9'), true, 'خوش آمدی');
select public.t_check((select active and plan = 'free' and full_name = 'سینا راد' from public.coaches where id = '00000000-0000-0000-0000-0000000000d9'), 'approved: a coach on the free plan');
select public.t_fails($$select public.admin_review_application((select id from public.coach_applications where user_id = '00000000-0000-0000-0000-0000000000d9'), false, '')$$, 'deciding twice');
commit;

-- The free plan holds ten active students; the eleventh is refused.
begin;
set local role authenticated;
select public.t_as('00000000-0000-0000-0000-0000000000d9');
insert into public.students (full_name, phone) select 'شاگرد ' || i, '0914100' || lpad(i::text, 4, '0') from generate_series(1, 10) i;
select public.t_fails($$insert into public.students (full_name, phone) values ('یازدهم', '09141009999')$$, 'an eleventh student on the free plan');
-- Switching one off makes room.
update public.students set active = false where phone = '09141000001';
insert into public.students (full_name, phone) values ('یازدهم', '09141009999');
select public.t_fails($$update public.students set active = true where phone = '09141000001'$$, 'switching one back on when full');
commit;

begin;
set local role authenticated;
select public.t_as(:'admin_id');
select public.admin_set_plan('00000000-0000-0000-0000-0000000000d9', 'pro', current_date + 30);
select public.t_check(public.coach_capacity('00000000-0000-0000-0000-0000000000d9') = 30, 'pro holds thirty');
select public.admin_set_plan('00000000-0000-0000-0000-0000000000d9', 'pro', current_date - 1);
select public.t_check(public.coach_capacity('00000000-0000-0000-0000-0000000000d9') = 10, 'a lapsed plan is free again');
commit;

-- Feedback: Ali and his coach talk under Ali's workout; another coach sees nothing.
begin;
set local role authenticated;
select public.t_as('00000000-0000-0000-0000-0000000000a1');
insert into public.workouts (id, student_id, routine_name) values ('00000000-0000-0000-0000-00000000fb01', '00000000-0000-0000-0000-0000000000aa', 'فیدبک');
insert into public.workout_comments (workout_id, body) values ('00000000-0000-0000-0000-00000000fb01', 'ست آخر سخت بود');
select public.t_as('00000000-0000-0000-0000-0000000000c1');
insert into public.workout_comments (workout_id, body) values ('00000000-0000-0000-0000-00000000fb01', 'هفته‌ی بعد همین وزنه');
select public.t_check((select count(*) = 2 from public.workout_comments where workout_id = '00000000-0000-0000-0000-00000000fb01'), 'coach reads the conversation');
select public.t_fails($$insert into public.workout_comments (workout_id, author, body) values ('00000000-0000-0000-0000-00000000fb01', '00000000-0000-0000-0000-0000000000a1', 'جعل')$$, 'writing as someone else');
select public.t_as('00000000-0000-0000-0000-0000000000c2');
select public.t_check((select count(*) = 0 from public.workout_comments), 'another coach reads nothing');
select public.t_fails($$insert into public.workout_comments (workout_id, body) values ('00000000-0000-0000-0000-00000000fb01', 'سلام')$$, 'another coach writing');
commit;
\echo ALL COACHING TESTS PASSED
