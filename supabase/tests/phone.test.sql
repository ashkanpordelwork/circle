-- Phone sign-in (0002). Runs after rls.test.sql, which leaves its helpers (t_as, t_check, t_fails).
\set ON_ERROR_STOP 1

select public.t_check(public.phone_norm('۰۹۱۲ ۱۲۳ ۴۵۶۷') = '09121234567', 'Persian digits and spaces');
select public.t_check(public.phone_norm('+98 912 123 4567') = '09121234567', '+98');
select public.t_check(public.phone_norm('00989121234567') = '09121234567', '0098');
select public.t_check(public.phone_norm('9121234567') = '09121234567', 'missing leading zero');
select public.t_check(public.phone_of_email('09121234567@phone.invalid') = '09121234567', 'stand-in address');
select public.t_check(public.phone_of_email('ali@gmail.com') is null, 'real address has no phone');
select public.t_check(length(public.new_invite_code()) = 6, 'six-character code');

-- The coach (c1 from rls.test.sql) registers Mina by phone, typed loosely.
begin;
set local role authenticated;
select public.t_as('00000000-0000-0000-0000-0000000000c1');
insert into public.students (id, full_name, phone, invite_code) values
  ('00000000-0000-0000-0000-0000000000d1', 'مینا', '+98 935 000 1111', 'abc234');
select public.t_check((select phone = '09350001111' and invite_code = 'ABC234' from public.students where id = '00000000-0000-0000-0000-0000000000d1'), 'phone and code stored normalised');
select public.t_fails($$insert into public.students (full_name, phone) values ('تکراری', '09350001111')$$, 'same phone twice');
select public.t_fails($$insert into public.students (full_name) values ('بی‌شماره')$$, 'neither phone nor email');
commit;

-- Mina signs up (phone stand-in address). Not linked by the sign-up itself.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000d2', '09350001111@phone.invalid');
select public.t_check((select user_id is null from public.students where id = '00000000-0000-0000-0000-0000000000d1'), 'sign-up alone links nothing');

-- Someone else signs up with Mina's number first? Here: a stranger with another number tries her code.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000d3', '09359999999@phone.invalid');
begin;
set local role authenticated;
select public.t_as('00000000-0000-0000-0000-0000000000d3');
select public.t_fails($$select public.claim_invite('ABC234')$$, 'right code, wrong phone');
commit;

begin;
set local role authenticated;
select public.t_as('00000000-0000-0000-0000-0000000000d2');
select public.t_check((select count(*) = 0 from public.students), 'unlinked account sees nothing');
select public.t_fails($$select public.claim_invite('ZZZZZZ')$$, 'wrong code');
select public.t_check(public.claim_invite(' abc234 ') = 'مینا', 'right phone + right code links (case and spaces ignored)');
select public.t_check((select count(*) = 1 from public.students), 'linked student sees herself');
select public.t_fails($$select public.claim_invite('ABC234')$$, 'claiming twice');
commit;

-- anon cannot call claim_invite at all
begin;
set local role anon;
select public.t_fails($$select public.claim_invite('ABC234')$$, 'anon claiming');
select public.t_fails($$select * from public.coach_phones$$, 'anon reading coach phones');
commit;

-- A coach by phone: signs up first, the owner lists the number afterwards.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000e9', '09120000000@phone.invalid');
select public.t_check((select count(*) = 0 from public.coaches where id = '00000000-0000-0000-0000-0000000000e9'), 'a number alone makes no coach');
insert into public.coach_phones values ('+989120000000');
select public.t_check((select count(*) = 1 from public.coaches where id = '00000000-0000-0000-0000-0000000000e9'), 'listing the number makes the coach');
-- and the other order: listed first, signs up later
insert into public.coach_phones values ('09127777777');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000ea', '09127777777@phone.invalid');
select public.t_check((select count(*) = 1 from public.coaches where id = '00000000-0000-0000-0000-0000000000ea'), 'listed number becomes coach on sign-up');

-- The coach can hand out a new code.
begin;
set local role authenticated;
select public.t_as('00000000-0000-0000-0000-0000000000c1');
update public.students set invite_code = public.new_invite_code() where id = '00000000-0000-0000-0000-0000000000d1';
select public.t_check((select invite_code <> 'ABC234' from public.students where id = '00000000-0000-0000-0000-0000000000d1'), 'new code');
commit;

\echo ALL PHONE TESTS PASSED
