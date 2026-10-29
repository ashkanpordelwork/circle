-- Smart workouts: each exercise keeps its progression rule; a workout keeps its time and end reason.
\set ON_ERROR_STOP 1
begin;
set local role authenticated;
select public.t_as('00000000-0000-0000-0000-0000000000c1');
select public.save_program('00000000-0000-0000-0000-00000000bb07', '00000000-0000-0000-0000-0000000000aa', '2027-06-01', 4, 2,
  '[{"id":"00000000-0000-0000-0000-00000000bd11","week":1,"session":1,"items":[
     {"exercise_id":"squat","sets":3,"reps":"5","progression":"greyskull"},
     {"exercise_id":"curl","sets":3,"reps":"8-12","progression":"double"},
     {"exercise_id":"plank","sets":3,"reps":"10"}]}]');
select public.t_check((select array_agg(progression order by position) = '{greyskull,double,linear}'
  from public.routine_items where routine_id = '00000000-0000-0000-0000-00000000bd11'), 'rules saved, linear by default');
select public.t_fails($$select public.save_program('00000000-0000-0000-0000-00000000bb07', '00000000-0000-0000-0000-0000000000aa', '2027-06-01', 4, 2,
  '[{"id":"00000000-0000-0000-0000-00000000bd11","week":1,"session":1,"items":[{"exercise_id":"squat","progression":"magic"}]}]')$$, 'an unknown rule');
select public.save_plan('00000000-0000-0000-0000-0000000000aa',
  '[{"id":"00000000-0000-0000-0000-00000000bd99","name":"A","days":[1],"items":[{"exercise_id":"row","progression":"off"}]}]');
select public.t_check((select progression = 'off' from public.routine_items where routine_id = '00000000-0000-0000-0000-00000000bd99'), 'weekday plans keep the rule too');
commit;

begin;
set local role authenticated;
select public.t_as('00000000-0000-0000-0000-0000000000a1');
insert into public.workouts (student_id, routine_name, started_at, duration_sec, end_reason)
values ('00000000-0000-0000-0000-0000000000aa', 'جلسه ۱', now() - interval '40 minutes', 2400, 'time');
select public.t_check((select duration_sec = 2400 and end_reason = 'time' from public.workouts where routine_name = 'جلسه ۱' order by created_at desc limit 1), 'workout keeps its time and reason');
select public.t_fails($$insert into public.workouts (student_id, end_reason) values ('00000000-0000-0000-0000-0000000000aa', 'bored')$$, 'an unknown end reason');
commit;
\echo ALL SMART TESTS PASSED
