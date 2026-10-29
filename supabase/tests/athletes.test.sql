-- Athletes: training alone, their own routines, joining and leaving a coach.
\set ON_ERROR_STOP 1
-- f1 a new phone account with no role; f2 another one.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', '09131110001@phone.invalid'),
  ('00000000-0000-0000-0000-0000000000f2', '09131110002@phone.invalid');

begin;
set local role authenticated;
select public.t_as('00000000-0000-0000-0000-0000000000f1');
select public.t_fails($$select public.start_athlete('   ')$$, 'a blank name');
select public.start_athlete('رها');
select public.t_check((select coach_id is null and self_started and phone = '09131110001' from public.students where user_id = '00000000-0000-0000-0000-0000000000f1'), 'athlete without a coach');
select public.t_fails($$select public.start_athlete('دوباره')$$, 'starting twice');
-- Their own routine.
select public.save_my_routine('00000000-0000-0000-0000-00000000ee01', 'پا', '[{"exercise_id":"squat","sets":5,"reps":"5","progression":"greyskull"}]');
select public.t_check((select owner = 'self' from public.routines where id = '00000000-0000-0000-0000-00000000ee01'), 'own routine saved as theirs');
select public.t_check((select progression = 'greyskull' from public.routine_items where routine_id = '00000000-0000-0000-0000-00000000ee01'), 'with its rule');
update public.routines set name = 'پای سنگین' where id = '00000000-0000-0000-0000-00000000ee01';
select public.t_check((select name = 'پای سنگین' from public.routines where id = '00000000-0000-0000-0000-00000000ee01'), 'renames own routine');
-- A coach's routine is not theirs to write.
select public.t_fails($$insert into public.routines (student_id, name, owner) select id, 'x', 'coach' from public.students where user_id = '00000000-0000-0000-0000-0000000000f1'$$, 'writing a coach routine');
select public.t_fails($$select public.join_coach('NOPE00')$$, 'a wrong coach code');
commit;

-- Another athlete cannot touch it.
begin;
set local role authenticated;
select public.t_as('00000000-0000-0000-0000-0000000000f2');
select public.start_athlete('نیما');
select public.t_check((select count(*) = 0 from public.routines where id = '00000000-0000-0000-0000-00000000ee01'), 'another athlete sees nothing');
select public.t_fails($$select public.save_my_routine('00000000-0000-0000-0000-00000000ee01', 'دزدی', '[]')$$, 'another athlete overwriting it');
commit;

-- A number a coach already registered is invited, not new.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f3', '09120000000@phone.invalid');
begin;
set local role authenticated;
select public.t_as('00000000-0000-0000-0000-0000000000c1');
insert into public.students (full_name, phone) values ('دعوتی', '09130000099');
commit;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f4', '09130000099@phone.invalid');
begin;
set local role authenticated;
select public.t_as('00000000-0000-0000-0000-0000000000f4');
select public.t_fails($$select public.start_athlete('دعوتی')$$, 'an invited number starting alone');
commit;

-- Joining coach one with their code; the coach reads but does not write the athlete's routines.
-- (The athlete cannot read the coaches table; the coach hands the code over in person.)
select join_code as c1_code from public.coaches where id = '00000000-0000-0000-0000-0000000000c1' \gset
select join_code as c2_code from public.coaches where id = '00000000-0000-0000-0000-0000000000c2' \gset
select full_name as c1_name from public.coaches where id = '00000000-0000-0000-0000-0000000000c1' \gset
update public.coaches set active = true where id in ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c2');
begin;
set local role authenticated;
select public.t_as('00000000-0000-0000-0000-0000000000f1');
select public.join_coach(:'c1_code');
select public.t_fails(format('select public.join_coach(%L)', :'c2_code'), 'joining a second coach');
select public.t_check(public.my_coach_name() = :'c1_name', 'the athlete knows their coach by name');
commit;
begin;
set local role authenticated;
select public.t_as('00000000-0000-0000-0000-0000000000c1');
select public.t_check((select count(*) = 1 from public.students where user_id = '00000000-0000-0000-0000-0000000000f1'), 'the coach now sees the athlete');
select public.t_check((select count(*) = 1 from public.routines where id = '00000000-0000-0000-0000-00000000ee01'), 'and reads their routine');
update public.routines set name = 'تغییر مربی' where id = '00000000-0000-0000-0000-00000000ee01';
select public.t_check((select name = 'پای سنگین' from public.routines where id = '00000000-0000-0000-0000-00000000ee01'), 'but cannot change it');
select public.save_plan((select id from public.students where user_id = '00000000-0000-0000-0000-0000000000f1'), '[]');
select public.t_check((select count(*) = 1 from public.routines where id = '00000000-0000-0000-0000-00000000ee01'), 'the plan editor leaves it alone');
commit;

-- Leaving: the coach loses access at once.
begin;
set local role authenticated;
select public.t_as('00000000-0000-0000-0000-0000000000f1');
select public.leave_coach();
select public.t_as('00000000-0000-0000-0000-0000000000c1');
select public.t_check((select count(*) = 0 from public.students where user_id = '00000000-0000-0000-0000-0000000000f1'), 'after leaving the coach sees nothing');
commit;

-- Water: the athlete's own.
begin;
set local role authenticated;
select public.t_as('00000000-0000-0000-0000-0000000000f1');
insert into public.water_logs (student_id, ml) select id, 500 from public.students where user_id = '00000000-0000-0000-0000-0000000000f1';
select public.t_as('00000000-0000-0000-0000-0000000000f2');
select public.t_check((select count(*) = 0 from public.water_logs), 'water is private');
commit;
\echo ALL ATHLETE TESTS PASSED
