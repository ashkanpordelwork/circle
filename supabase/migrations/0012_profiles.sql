-- Circle v2, stage 2: signing up and the questionnaire (SPEC §3.4). Run once in Supabase →
-- SQL Editor, after 0011.
--
-- Anyone who signs up with a phone number becomes a user straight away: no coach, no invite code.
-- Their record is still a row in `students` (routines and workouts hang off it); `profiles` holds
-- what the questionnaire learns about them.

/* ---------- the questionnaire ---------- */

-- One row per user. answers: a JSON object shaped by src/lib/questionnaire.js.
-- level and needs_attention are worked out from the answers when they are saved.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  answers jsonb not null default '{}'
    check (jsonb_typeof(answers) = 'object' and length(answers::text) <= 12000),
  level text check (level in ('beginner', 'intermediate')),
  needs_attention boolean not null default false,
  medical_ack_at timestamptz,      -- «متوجه شدم» on the one-time «talk to your doctor» (stage 3)
  completed_at timestamptz,
  skipped_at timestamptz,          -- «بعداً»: no wall again, but no free program until answered
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Same touch-on-write as the old intakes (0004).
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch
  before insert or update on public.profiles
  for each row execute function public.intakes_touch();

alter table public.profiles enable row level security;
drop policy if exists "user fills own profile" on public.profiles;
create policy "user fills own profile" on public.profiles for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.profiles to authenticated;

/* ---------- signing up ---------- */

-- A new phone account becomes a user. Safe to call again: it answers the existing record.
-- A number someone once registered without an account (the coach days) is taken over.
create or replace function public.start_user() returns uuid
language plpgsql security definer set search_path = public as $$
declare v_phone text; v_id uuid;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select id into v_id from public.students where user_id = auth.uid();
  if v_id is null then
    select public.phone_of_email(email) into v_phone from auth.users where id = auth.uid();
    if v_phone is null then raise exception 'not a phone account' using errcode = '22023'; end if;
    update public.students set user_id = auth.uid(), coach_id = null, self_started = true
      where phone = v_phone and user_id is null returning id into v_id;
    if v_id is null then
      -- No name is asked at sign-up; the number stands in until they write one in «حساب».
      insert into public.students (coach_id, full_name, phone, user_id, self_started)
      values (null, v_phone, v_phone, auth.uid(), true) returning id into v_id;
    end if;
  end if;
  insert into public.profiles (user_id) values (auth.uid()) on conflict (user_id) do nothing;
  return v_id;
end $$;
revoke execute on function public.start_user() from public, anon;
grant execute on function public.start_user() to authenticated;
