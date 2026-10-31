-- Nutrition and supplements. Run once in Supabase → SQL Editor, after 0010.
--
-- The athlete's eating plan as their AI wrote it — daily targets, meals with their items,
-- supplements — and what they ticked off each day. All of it the athlete's alone, as in
-- 0009_body.sql: no coach policy at all.
--
-- A day's log keeps its own copy of the name and the macros it counted, so importing a new
-- plan (which replaces the meals and supplements) never changes what earlier days add up to.

/* ---------- the plan ---------- */

-- Daily targets: one row per athlete.
create table if not exists public.nutrition_targets (
  student_id uuid primary key references public.students (id) on delete cascade,
  calories int not null check (calories between 0 and 20000),
  protein int not null check (protein between 0 and 2000),
  carbs int not null check (carbs between 0 and 3000),
  fat int not null check (fat between 0 and 2000),
  updated_at timestamptz not null default now()
);

-- Meals in order, with an optional suggested time («08:00») and the meal's total macros.
create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  position int not null default 0,
  time text check (time is null or time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  calories numeric(7,1) not null default 0 check (calories >= 0),
  protein numeric(6,1) not null default 0 check (protein >= 0),
  carbs numeric(6,1) not null default 0 check (carbs >= 0),
  fat numeric(6,1) not null default 0 check (fat >= 0)
);
create index if not exists meals_student on public.meals (student_id, position);

-- What a meal is made of; the amount is free text («۴ عدد», «۲۰۰ گرم»).
create table if not exists public.meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  amount text not null default '' check (length(amount) <= 40),
  position int not null default 0,
  calories numeric(7,1) not null default 0 check (calories >= 0),
  protein numeric(6,1) not null default 0 check (protein >= 0),
  carbs numeric(6,1) not null default 0 check (carbs >= 0),
  fat numeric(6,1) not null default 0 check (fat >= 0)
);
create index if not exists meal_items_meal on public.meal_items (meal_id, position);

-- Supplements: a dose and the moments it is taken («صبح», «بعد از تمرین», «22:00»).
create table if not exists public.supplements (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  dose text not null default '' check (length(dose) <= 40),
  times text[] not null default '{}' check (array_length(times, 1) is null or array_length(times, 1) <= 8),
  position int not null default 0
);
create index if not exists supplements_student on public.supplements (student_id, position);

/* ---------- each day ---------- */

-- A meal ticked off on a day, or a quick entry outside the plan (no meal_id, a name optional).
create table if not exists public.meal_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  date date not null default current_date,
  meal_id uuid references public.meals (id) on delete set null,
  name text not null default '' check (length(name) <= 80),
  calories numeric(7,1) not null default 0 check (calories between 0 and 20000),
  protein numeric(6,1) not null default 0 check (protein between 0 and 2000),
  carbs numeric(6,1) not null default 0 check (carbs between 0 and 3000),
  fat numeric(6,1) not null default 0 check (fat between 0 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists meal_logs_day on public.meal_logs (student_id, date);
-- A planned meal counts once a day.
create unique index if not exists meal_logs_once on public.meal_logs (meal_id, date) where meal_id is not null;

-- One dose of a supplement taken on a day, at one of its times.
create table if not exists public.supplement_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  date date not null default current_date,
  supplement_id uuid references public.supplements (id) on delete set null,
  name text not null default '' check (length(name) <= 60),
  time text not null default '' check (length(time) <= 40),
  created_at timestamptz not null default now()
);
create index if not exists supplement_logs_day on public.supplement_logs (student_id, date);
create unique index if not exists supplement_logs_once on public.supplement_logs (supplement_id, date, time) where supplement_id is not null;

/* ---------- who may see what: the athlete, and no one else ---------- */

create or replace function public.meal_student(mid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select student_id from public.meals where id = mid
$$;

create or replace function public.supplement_student(sid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select student_id from public.supplements where id = sid
$$;

alter table public.nutrition_targets enable row level security;
alter table public.meals enable row level security;
alter table public.meal_items enable row level security;
alter table public.supplements enable row level security;
alter table public.meal_logs enable row level security;
alter table public.supplement_logs enable row level security;

create policy "athlete keeps targets" on public.nutrition_targets for all
  using (public.is_student(student_id)) with check (public.is_student(student_id));
create policy "athlete keeps meals" on public.meals for all
  using (public.is_student(student_id)) with check (public.is_student(student_id));
create policy "athlete keeps meal items" on public.meal_items for all
  using (public.is_student(public.meal_student(meal_id))) with check (public.is_student(public.meal_student(meal_id)));
create policy "athlete keeps supplements" on public.supplements for all
  using (public.is_student(student_id)) with check (public.is_student(student_id));
-- A log points only at the athlete's own meal or supplement.
create policy "athlete logs meals" on public.meal_logs for all
  using (public.is_student(student_id))
  with check (public.is_student(student_id) and (meal_id is null or public.meal_student(meal_id) = student_id));
create policy "athlete logs supplements" on public.supplement_logs for all
  using (public.is_student(student_id))
  with check (public.is_student(student_id) and (supplement_id is null or public.supplement_student(supplement_id) = student_id));

grant select, insert, update, delete on public.nutrition_targets, public.meals, public.meal_items,
  public.supplements, public.meal_logs, public.supplement_logs to authenticated;

/* ---------- replacing the plan in one go ---------- */

-- The imported plan's nutrition part, all or nothing: targets (or null to clear them), meals with
-- their items, supplements. The old meals and supplements go; the day logs stay (they carry
-- their own copies). p_meals: [{name, time, items: [{name, amount, calories, protein, carbs, fat}]}]
-- p_supplements: [{name, dose, times: [text]}]
create or replace function public.save_nutrition_plan(p_targets jsonb, p_meals jsonb, p_supplements jsonb) returns void
language plpgsql security invoker set search_path = public as $$
declare v_student uuid; m jsonb; i jsonb; s jsonb; v_meal uuid; mpos int := 0; ipos int;
begin
  select id into v_student from public.students where user_id = auth.uid() and active;
  if v_student is null then raise exception 'not an athlete' using errcode = '42501'; end if;
  if jsonb_typeof(coalesce(p_meals, '[]')) <> 'array' or jsonb_array_length(coalesce(p_meals, '[]')) > 12 then raise exception 'invalid meals'; end if;
  if jsonb_typeof(coalesce(p_supplements, '[]')) <> 'array' or jsonb_array_length(coalesce(p_supplements, '[]')) > 20 then raise exception 'invalid supplements'; end if;

  if p_targets is null or jsonb_typeof(p_targets) = 'null' then
    delete from public.nutrition_targets where student_id = v_student;
  else
    insert into public.nutrition_targets (student_id, calories, protein, carbs, fat)
    values (v_student, (p_targets ->> 'calories')::int, (p_targets ->> 'protein')::int, (p_targets ->> 'carbs')::int, (p_targets ->> 'fat')::int)
    on conflict (student_id) do update set calories = excluded.calories, protein = excluded.protein,
      carbs = excluded.carbs, fat = excluded.fat, updated_at = now();
  end if;

  delete from public.meals where student_id = v_student;
  for m in select * from jsonb_array_elements(coalesce(p_meals, '[]')) loop
    insert into public.meals (student_id, name, position, time, calories, protein, carbs, fat)
    values (v_student, trim(m ->> 'name'), mpos, nullif(m ->> 'time', ''),
      coalesce((select sum((x ->> 'calories')::numeric) from jsonb_array_elements(coalesce(m -> 'items', '[]')) x), 0),
      coalesce((select sum((x ->> 'protein')::numeric) from jsonb_array_elements(coalesce(m -> 'items', '[]')) x), 0),
      coalesce((select sum((x ->> 'carbs')::numeric) from jsonb_array_elements(coalesce(m -> 'items', '[]')) x), 0),
      coalesce((select sum((x ->> 'fat')::numeric) from jsonb_array_elements(coalesce(m -> 'items', '[]')) x), 0))
    returning id into v_meal;
    ipos := 0;
    for i in select * from jsonb_array_elements(coalesce(m -> 'items', '[]')) loop
      insert into public.meal_items (meal_id, name, amount, position, calories, protein, carbs, fat)
      values (v_meal, trim(i ->> 'name'), coalesce(i ->> 'amount', ''), ipos,
        coalesce((i ->> 'calories')::numeric, 0), coalesce((i ->> 'protein')::numeric, 0),
        coalesce((i ->> 'carbs')::numeric, 0), coalesce((i ->> 'fat')::numeric, 0));
      ipos := ipos + 1;
    end loop;
    mpos := mpos + 1;
  end loop;

  delete from public.supplements where student_id = v_student;
  mpos := 0;
  for s in select * from jsonb_array_elements(coalesce(p_supplements, '[]')) loop
    insert into public.supplements (student_id, name, dose, times, position)
    values (v_student, trim(s ->> 'name'), coalesce(s ->> 'dose', ''),
      coalesce((select array_agg(t) from jsonb_array_elements_text(coalesce(s -> 'times', '[]')) t), '{}'), mpos);
    mpos := mpos + 1;
  end loop;
end $$;
revoke execute on function public.save_nutrition_plan(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.save_nutrition_plan(jsonb, jsonb, jsonb) to authenticated;
