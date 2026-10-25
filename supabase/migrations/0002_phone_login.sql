-- Sign-in with phone number + password, no SMS and no Google account.
-- Run once in Supabase → SQL Editor, after 0001_init.sql.
--
-- How it works
--   Supabase Auth signs people in with an e-mail and a password. The app turns a phone number into
--   a stand-in address, 09121234567@phone.invalid (".invalid" is a reserved domain: nothing is
--   ever delivered there), so the person only ever types their number. "Confirm email" must be
--   switched off in Authentication → Sign In / Providers → Email, since no mail can be confirmed.
--
--   Nobody proves a phone number by SMS, so a number alone opens nothing:
--     - a student is linked to their row only with the invite code the coach gives them
--       (claim_invite below);
--     - a coach is made only by the project owner, in the SQL editor, after that person has
--       signed up: insert into public.coach_phones (phone) values ('09121234567');

/* ---------- phone numbers ---------- */

-- "۰۹۱۲ ۱۲۳ ۴۵۶۷", "+98 912 123 4567" and "00989121234567" are all 09121234567.
create or replace function public.phone_norm(p text) returns text
language sql immutable as $$
  select case
    when d ~ '^0098[0-9]{10}$' then '0' || substr(d, 5)
    when d ~ '^98[0-9]{10}$' then '0' || substr(d, 3)
    when d ~ '^9[0-9]{9}$' then '0' || d
    else d
  end
  from (select regexp_replace(translate(coalesce(p, ''), '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩', '01234567890123456789'), '[^0-9]', '', 'g') as d) x
$$;

-- The phone behind a stand-in address, or null for a real one.
create or replace function public.phone_of_email(e text) returns text
language sql immutable as $$
  select case when lower(e) like '%@phone.invalid' then split_part(lower(e), '@', 1) end
$$;

-- Six characters with nothing that reads two ways (no 0/O, 1/I/L). 31^6 ≈ 887 million codes.
-- search_path: on Supabase, pgcrypto's gen_random_bytes lives in the `extensions` schema.
create or replace function public.new_invite_code() returns text
language sql volatile set search_path = public, extensions as $$
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + (get_byte(b, i) % 31), 1), '')
  from (select gen_random_bytes(6) as b) x, generate_series(0, 5) i
$$;

/* ---------- students: a phone instead of (or beside) an e-mail ---------- */

alter table public.students alter column email drop not null;
alter table public.students drop constraint if exists students_email_check;
alter table public.students add constraint students_email_check
  check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');
alter table public.students add column phone text unique check (phone ~ '^[0-9]{8,15}$');
alter table public.students add column invite_code text not null default public.new_invite_code();
alter table public.students add constraint students_contact check (phone is not null or email is not null);

-- Whatever the coach typed is stored normalised, so the student's own typing always matches.
create or replace function public.students_norm_phone() returns trigger
language plpgsql as $$
begin
  if new.phone is not null then new.phone := nullif(public.phone_norm(new.phone), ''); end if;
  if new.invite_code is not null then new.invite_code := upper(trim(new.invite_code)); end if;
  return new;
end $$;

create trigger students_norm_phone
  before insert or update of phone, invite_code on public.students
  for each row execute function public.students_norm_phone();

-- The coach may now also set the phone and hand out a new code.
grant update (phone, invite_code) on public.students to authenticated;

/* ---------- coaches by phone ---------- */

create table public.coach_phones (
  phone text primary key
);
alter table public.coach_phones enable row level security;   -- no policies: SQL editor only
revoke all on public.coach_phones from anon, authenticated;

create or replace function public.coach_phones_norm() returns trigger
language plpgsql as $$
begin new.phone := public.phone_norm(new.phone); return new; end $$;

create trigger coach_phones_norm
  before insert on public.coach_phones
  for each row execute function public.coach_phones_norm();

create or replace function public.link_coach_phone() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.coaches (id, email, full_name)
  select u.id, u.email, coalesce(u.raw_user_meta_data ->> 'full_name', '')
    from auth.users u where public.phone_of_email(u.email) = new.phone
  on conflict (id) do nothing;
  return new;
end $$;

create trigger coach_phones_link
  after insert on public.coach_phones
  for each row execute function public.link_coach_phone();

-- New accounts: a listed phone becomes a coach at once (for an owner who lists it first).
-- Students are never linked here; that takes the invite code (claim_invite).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.coach_emails c where public.email_key(c.email) = public.email_key(new.email))
     or exists (select 1 from public.coach_phones c where c.phone = public.phone_of_email(new.email)) then
    insert into public.coaches (id, email, full_name)
    values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''))
    on conflict (id) do nothing;
  end if;
  -- Google / real e-mail sign-in keeps working: a verified address links as before.
  if public.phone_of_email(new.email) is null then
    update public.students set user_id = new.id
     where email_key = public.email_key(new.email) and user_id is null;
  end if;
  return new;
end $$;

-- The e-mail link on registration must not pick up a phone account's stand-in address.
create or replace function public.link_student_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is null and new.email is not null then
    select u.id into new.user_id from auth.users u
     where public.email_key(u.email) = public.email_key(new.email)
       and public.phone_of_email(u.email) is null
       and not exists (select 1 from public.students s where s.user_id = u.id)
     limit 1;
  end if;
  return new;
end $$;

/* ---------- claiming an invite ---------- */

-- The signed-in student proves they are the person the coach registered: their account's phone
-- must be the row's phone, and the code must be the row's code. Returns the student's name.
create or replace function public.claim_invite(p_code text) returns text
language plpgsql security definer set search_path = public as $$
declare v_phone text; v_id uuid; v_name text;
begin
  select public.phone_of_email(email) into v_phone from auth.users where id = auth.uid();
  if v_phone is null then raise exception 'not a phone account' using errcode = '22023'; end if;
  if exists (select 1 from public.students where user_id = auth.uid()) then
    raise exception 'already linked' using errcode = '22023';
  end if;
  select id, full_name into v_id, v_name from public.students
   where phone = v_phone and invite_code = upper(trim(p_code)) and user_id is null and active;
  if v_id is null then raise exception 'wrong code' using errcode = '22023'; end if;
  update public.students set user_id = auth.uid() where id = v_id;
  return v_name;
end $$;

revoke execute on function public.claim_invite(text) from public, anon;
grant execute on function public.claim_invite(text) to authenticated;

-- The coach's "new code" button asks for one through the API.
grant execute on function public.new_invite_code() to authenticated;
