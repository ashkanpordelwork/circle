-- Tempo: saved through save_plan, readable by the student, and only in the four-character form.
\set ON_ERROR_STOP 1
begin;
set local role authenticated;
select public.t_as('00000000-0000-0000-0000-0000000000c1');
select public.save_plan('00000000-0000-0000-0000-0000000000aa', '[
  {"id":"00000000-0000-0000-0000-000000000001","name":"پا","days":[6],
   "items":[{"exercise_id":"Barbell_Squat","sets":4,"reps":"8","tempo":"31x0"},{"exercise_id":"Lunges","sets":3,"reps":"12"}]}
]'::jsonb);
select public.t_check((select tempo = '31X0' from public.routine_items where exercise_id = 'Barbell_Squat'), 'tempo saved, X upper-cased');
select public.t_check((select tempo = '' from public.routine_items where exercise_id = 'Lunges'), 'no tempo = empty');
select public.t_fails($$select public.save_plan('00000000-0000-0000-0000-0000000000aa', '[{"id":"00000000-0000-0000-0000-000000000001","name":"پا","days":[],"items":[{"exercise_id":"e","tempo":"3-1-0"}]}]')$$, 'malformed tempo refused');
commit;
begin;
set local role authenticated;
select public.t_as('00000000-0000-0000-0000-0000000000a1');
select public.t_check((select tempo = '31X0' from public.routine_items where exercise_id = 'Barbell_Squat'), 'student reads the tempo');
commit;
\echo ALL TEMPO TESTS PASSED
