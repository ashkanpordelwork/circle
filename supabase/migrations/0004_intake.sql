-- The student's intake questionnaire: body, goals, training background, injuries, medical
-- conditions and diet. Run once in Supabase → SQL Editor, after 0003.
--
-- One row per student. The student fills and edits it; their coach reads it. The answers are a
-- JSON object shaped by src/lib/intake.js (option keys plus an optional note per question).

create table if not exists public.intakes (
  student_id uuid primary key references public.students (id) on delete cascade,
  answers jsonb not null default '{}'
    check (jsonb_typeof(answers) = 'object' and length(answers::text) <= 12000),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create or replace function public.intakes_touch() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists intakes_touch on public.intakes;
create trigger intakes_touch
  before insert or update on public.intakes
  for each row execute function public.intakes_touch();

alter table public.intakes enable row level security;

drop policy if exists "student fills own intake" on public.intakes;
create policy "student fills own intake" on public.intakes for all
  using (public.is_student(student_id)) with check (public.is_student(student_id));
drop policy if exists "coach reads intake" on public.intakes;
create policy "coach reads intake" on public.intakes for select
  using (public.coaches_student(student_id));

grant select, insert, update on public.intakes to authenticated;
