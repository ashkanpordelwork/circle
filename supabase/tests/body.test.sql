-- Body measurements and readiness: the athlete's own; no coach, no other athlete.
\set ON_ERROR_STOP 1
begin;
set local role authenticated;
select public.t_as('00000000-0000-0000-0000-0000000000a1');
insert into public.body_measurements (student_id, waist, arm) values ('00000000-0000-0000-0000-0000000000aa', 82.5, 36);
insert into public.readiness_checks (student_id, sleep, energy, soreness, stress) values ('00000000-0000-0000-0000-0000000000aa', 4, 3, 2, 4);
select public.t_check((select count(*) = 1 from public.body_measurements), 'athlete saves a measurement');
select public.t_fails($$insert into public.readiness_checks (student_id, sleep, energy, soreness, stress) values ('00000000-0000-0000-0000-0000000000aa', 9, 3, 2, 4)$$, 'a score outside 1–5');
commit;

begin;
set local role authenticated;
select public.t_as('00000000-0000-0000-0000-0000000000c1');   -- Ali's coach
select public.t_check((select count(*) = 0 from public.body_measurements), 'the coach sees no measurements');
select public.t_check((select count(*) = 0 from public.readiness_checks), 'nor the check-ins');
select public.t_fails($$insert into public.body_measurements (student_id, waist) values ('00000000-0000-0000-0000-0000000000aa', 90)$$, 'the coach writing one');
select public.t_as('00000000-0000-0000-0000-0000000000f2');   -- another athlete
select public.t_check((select count(*) = 0 from public.body_measurements), 'another athlete sees none');
commit;
\echo ALL BODY TESTS PASSED
