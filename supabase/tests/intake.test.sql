-- Intake: the student writes their own, their coach reads it, nobody else sees it.
\set ON_ERROR_STOP 1
begin;
set local role authenticated;
select public.t_as('00000000-0000-0000-0000-0000000000a1');
insert into public.intakes (student_id, answers, completed_at)
values ('00000000-0000-0000-0000-0000000000aa', '{"goals":["muscle"],"injuries":["knee"],"injuries_note":"زانوی چپ"}', now());
update public.intakes set answers = answers || '{"weight":80}' where student_id = '00000000-0000-0000-0000-0000000000aa';
select public.t_check((select answers ->> 'weight' = '80' from public.intakes), 'student edits own intake');
select public.t_fails($$insert into public.intakes (student_id) values ('00000000-0000-0000-0000-0000000000bb')$$, 'student writing someone else''s intake');
select public.t_fails($$update public.intakes set answers = '[]' where student_id = '00000000-0000-0000-0000-0000000000aa'$$, 'answers must be an object');
commit;
begin;
set local role authenticated;
select public.t_as('00000000-0000-0000-0000-0000000000c1');
select public.t_check((select answers -> 'injuries' ->> 0 = 'knee' from public.intakes where student_id = '00000000-0000-0000-0000-0000000000aa'), 'coach reads the intake');
update public.intakes set answers = '{}' where student_id = '00000000-0000-0000-0000-0000000000aa';
commit;
begin;
set local role authenticated;
select public.t_as('00000000-0000-0000-0000-0000000000c1');
select public.t_check((select answers ->> 'weight' = '80' from public.intakes), 'coach cannot change it');
select public.t_as('00000000-0000-0000-0000-0000000000c2');
select public.t_check((select count(*) = 0 from public.intakes), 'another coach sees nothing');
select public.t_as('00000000-0000-0000-0000-0000000000ff');
select public.t_check((select count(*) = 0 from public.intakes), 'a stranger sees nothing');
commit;
\echo ALL INTAKE TESTS PASSED
