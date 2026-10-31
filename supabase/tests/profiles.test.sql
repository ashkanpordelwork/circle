-- Stage 2: signing up without a coach or a code, and the questionnaire.
\set ON_ERROR_STOP 1
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a7', '09141110001@phone.invalid'),
  ('00000000-0000-0000-0000-0000000000a8', '09141110002@phone.invalid'),
  ('00000000-0000-0000-0000-0000000000a9', 'someone@example.com');

begin;
set local role authenticated;
select public.t_as('00000000-0000-0000-0000-0000000000a7');
select public.start_user();
select public.t_check((select coach_id is null and self_started and full_name = '09141110001' from public.students where user_id = '00000000-0000-0000-0000-0000000000a7'), 'a new user, named by their number');
select public.t_check((select count(*) = 1 from public.profiles where user_id = '00000000-0000-0000-0000-0000000000a7'), 'with an empty profile');
select public.t_check((select public.start_user() = id from public.students where user_id = '00000000-0000-0000-0000-0000000000a7'), 'calling again answers the same record');
update public.profiles set answers = '{"goal":"health"}', level = 'beginner', completed_at = now() where user_id = '00000000-0000-0000-0000-0000000000a7';
select public.t_check((select level = 'beginner' and answers ->> 'goal' = 'health' from public.profiles where user_id = '00000000-0000-0000-0000-0000000000a7'), 'saves own answers');
select public.t_fails($$insert into public.profiles (user_id) values ('00000000-0000-0000-0000-0000000000a8')$$, 'writing someone else''s profile');
commit;

begin;
set local role authenticated;
select public.t_as('00000000-0000-0000-0000-0000000000a8');
select public.start_user();
select public.t_check((select count(*) = 1 from public.profiles), 'another user sees only their own profile');
select public.t_check((select answers = '{}' from public.profiles), 'and it is theirs');
commit;

begin;
set local role authenticated;
select public.t_as('00000000-0000-0000-0000-0000000000a9');
select public.t_fails($$select public.start_user()$$, 'an email account is not a phone user');
commit;

begin;
set local role anon;
select public.t_fails($$select public.start_user()$$, 'signed out');
commit;
