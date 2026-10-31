-- ⚠️ Deletes EVERY account and everything anyone has entered. It cannot be undone.
--
-- A one-off for Circle v2 (stage 2): the coach-era users and their data go, so the app starts
-- clean. Run it once in Supabase → SQL Editor, AFTER 0012_profiles.sql.
-- Not a migration: never run it on a database with users you want to keep.
--
-- What stays: the tables themselves, their rules and functions (the migrations).

begin;

-- Everything people entered, coach era included.
truncate table
  public.supplement_logs, public.meal_logs, public.meal_items, public.meals, public.supplements, public.nutrition_targets,
  public.workout_comments, public.workout_sets, public.workouts, public.routine_items, public.routines, public.programs,
  public.readiness_checks, public.body_measurements, public.body_weights, public.water_logs,
  public.intakes, public.profiles, public.students,
  public.coach_applications, public.coaches, public.coach_emails, public.coach_phones,
  public.admin_phones, public.admin_log
cascade;

-- The accounts (phone sign-ins and any email ones).
delete from auth.users;

commit;

-- Check: every count should be 0.
select (select count(*) from auth.users) as accounts, (select count(*) from public.students) as users,
       (select count(*) from public.workouts) as workouts;
