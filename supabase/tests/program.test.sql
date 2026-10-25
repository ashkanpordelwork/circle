-- Monthly programs: the coach writes them week by week, the student reads them, nobody else.
\set ON_ERROR_STOP 1
-- c1 coaches Ali (aa, account a1); c2 is another coach.
begin;
set local role authenticated;
select public.t_as('00000000-0000-0000-0000-0000000000c1');
select public.save_program('00000000-0000-0000-0000-00000000bb01', '00000000-0000-0000-0000-0000000000aa', '2026-10-23', 4, 3,
  '[{"id":"00000000-0000-0000-0000-00000000bc11","week":1,"session":1,"items":[{"exercise_id":"squat","sets":3,"reps":"8","weight":"60"}]},
    {"id":"00000000-0000-0000-0000-00000000bc12","week":1,"session":2,"items":[{"exercise_id":"bench","sets":4,"reps":"6"}]},
    {"id":"00000000-0000-0000-0000-00000000bc21","week":2,"session":1,"items":[{"exercise_id":"squat","sets":3,"reps":"8","weight":"62.5"}]}]');
select public.t_check((select per_week = 3 and weeks = 4 from public.programs where id = '00000000-0000-0000-0000-00000000bb01'), 'program saved');
select public.t_check((select count(*) = 3 from public.routines where program_id = '00000000-0000-0000-0000-00000000bb01'), 'sessions saved');
select public.t_check((select name = 'جلسه ۲' from public.routines where id = '00000000-0000-0000-0000-00000000bc12'), 'sessions named by number');
select public.t_fails($$select public.save_program('00000000-0000-0000-0000-00000000bb01', '00000000-0000-0000-0000-0000000000aa', '2026-10-23', 4, 3,
  '[{"id":"00000000-0000-0000-0000-00000000bc19","week":5,"session":1,"items":[]}]')$$, 'a session after the last week');
select public.t_fails($$select public.save_program('00000000-0000-0000-0000-00000000bb01', '00000000-0000-0000-0000-0000000000aa', '2026-10-23', 4, 3,
  '[{"id":"00000000-0000-0000-0000-00000000bc19","week":1,"session":4,"items":[]}]')$$, 'more sessions than the week has');
-- The weekday editor leaves the program alone.
select public.save_plan('00000000-0000-0000-0000-0000000000aa', '[]');
select public.t_check((select count(*) = 3 from public.routines where program_id = '00000000-0000-0000-0000-00000000bb01'), 'save_plan keeps program sessions');
-- Dropping a session from the list deletes it.
select public.save_program('00000000-0000-0000-0000-00000000bb01', '00000000-0000-0000-0000-0000000000aa', '2026-10-23', 4, 3,
  '[{"id":"00000000-0000-0000-0000-00000000bc11","week":1,"session":1,"items":[{"exercise_id":"squat"}]},
    {"id":"00000000-0000-0000-0000-00000000bc21","week":2,"session":1,"items":[{"exercise_id":"squat"}]}]');
select public.t_check((select count(*) = 2 from public.routines where program_id = '00000000-0000-0000-0000-00000000bb01'), 'removed session deleted');
commit;

begin;
set local role authenticated;
select public.t_as('00000000-0000-0000-0000-0000000000a1');
select public.t_check((select count(*) = 1 from public.programs), 'student reads their program');
select public.t_check((select count(*) = 2 from public.routines where program_id is not null), 'and its sessions');
select public.t_fails($$select public.save_program('00000000-0000-0000-0000-00000000bb01', '00000000-0000-0000-0000-0000000000aa', '2026-10-23', 4, 3, '[]')$$, 'student rewriting the program');
select public.t_as('00000000-0000-0000-0000-0000000000c2');
select public.t_check((select count(*) = 0 from public.programs), 'another coach sees nothing');
select public.t_fails($$select public.save_program('00000000-0000-0000-0000-00000000bb01', '00000000-0000-0000-0000-0000000000aa', '2026-10-23', 4, 3, '[]')$$, 'another coach writing it');
select public.t_fails($$select public.save_program('00000000-0000-0000-0000-00000000bb02', '00000000-0000-0000-0000-0000000000aa', '2026-10-23', 4, 3, '[]')$$, 'another coach starting one');
commit;
\echo ALL PROGRAM TESTS PASSED
