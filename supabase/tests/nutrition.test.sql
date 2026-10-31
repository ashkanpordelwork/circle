-- Nutrition and supplements: the athlete's alone; replacing the plan keeps what days logged.
\set ON_ERROR_STOP 1
begin;
set local role authenticated;
select public.t_as('00000000-0000-0000-0000-0000000000a1');   -- Ali (student aa)
select public.save_nutrition_plan('{"calories":2800,"protein":180,"carbs":320,"fat":80}',
  '[{"name":"صبحانه","time":"08:00","items":[{"name":"تخم‌مرغ","amount":"۴ عدد","calories":280,"protein":24,"carbs":2,"fat":20},{"name":"نان","amount":"۲ کف دست","calories":200,"protein":6,"carbs":40,"fat":2}]},
    {"name":"ناهار","items":[{"name":"مرغ","amount":"۲۰۰ گرم","calories":330,"protein":62,"carbs":0,"fat":7}]}]',
  '[{"name":"کراتین","dose":"۵ گرم","times":["بعد از تمرین"]},{"name":"ویتامین D","dose":"۱۰۰۰ واحد","times":["08:00","22:00"]}]');
select public.t_check((select calories = 2800 and protein = 180 from public.nutrition_targets), 'targets saved');
select public.t_check((select count(*) = 2 from public.meals), 'meals saved');
select public.t_check((select calories = 480 and protein = 30 and time = '08:00' from public.meals where name = 'صبحانه'), 'a meal adds up its items');
select public.t_check((select count(*) = 3 from public.meal_items), 'items saved');
select public.t_check((select times = '{08:00,22:00}' from public.supplements where name = 'ویتامین D'), 'supplement times saved');
-- Today: breakfast ticked, a quick snack, one dose.
insert into public.meal_logs (student_id, meal_id, name, calories, protein, carbs, fat)
  select student_id, id, name, calories, protein, carbs, fat from public.meals where name = 'صبحانه';
insert into public.meal_logs (student_id, name, calories, protein, carbs) values ('00000000-0000-0000-0000-0000000000aa', 'شیک پروتئین', 150, 25, 5);
select public.t_fails($$insert into public.meal_logs (student_id, meal_id, name) select student_id, id, name from public.meals where name = 'صبحانه'$$, 'the same meal twice a day');
insert into public.supplement_logs (student_id, supplement_id, name, time)
  select student_id, id, name, 'بعد از تمرین' from public.supplements where name = 'کراتین';
select public.t_fails($$insert into public.meal_items (meal_id, name) values ('00000000-0000-0000-0000-00000000ffff', 'x')$$, 'an item in a meal that is not there');
select public.t_fails($$select public.save_nutrition_plan('{"calories":-5,"protein":1,"carbs":1,"fat":1}', '[]', '[]')$$, 'a negative target');
-- A new plan: the old meals and supplements go, the day's logs stay with their numbers.
select public.save_nutrition_plan(null, '[{"name":"شام","items":[]}]', '[]');
select public.t_check((select count(*) = 0 from public.nutrition_targets), 'null clears the targets');
select public.t_check((select count(*) = 1 from public.meals), 'old meals replaced');
select public.t_check((select count(*) = 0 from public.supplements), 'old supplements replaced');
select public.t_check((select count(*) = 2 and sum(protein) = 55 from public.meal_logs), 'logged meals keep their macros');
select public.t_check((select count(*) = 1 and bool_and(supplement_id is null and name = 'کراتین') from public.supplement_logs), 'logged doses keep their name');
commit;

begin;
set local role authenticated;
select public.t_as('00000000-0000-0000-0000-0000000000c1');   -- Ali's coach
select public.t_check((select count(*) = 0 from public.meals), 'the coach sees no meals');
select public.t_check((select count(*) = 0 from public.meal_logs), 'nor what was eaten');
select public.t_check((select count(*) = 0 from public.supplement_logs), 'nor the supplements taken');
select public.t_fails($$insert into public.meals (student_id, name) values ('00000000-0000-0000-0000-0000000000aa', 'x')$$, 'the coach writing a meal');
select public.t_fails($$select public.save_nutrition_plan(null, '[]', '[]')$$, 'a coach saving a plan for themselves');
commit;

-- Another athlete: sees nothing, and cannot log against Ali's meal.
select id as ali_meal from public.meals limit 1 \gset
begin;
set local role authenticated;
select public.t_as('00000000-0000-0000-0000-0000000000f2');
select public.t_check((select count(*) = 0 from public.meals), 'another athlete sees no meals');
select public.t_fails(format('insert into public.meal_logs (student_id, meal_id, name) select id, %L, ''x'' from public.students where user_id = ''00000000-0000-0000-0000-0000000000f2''', :'ali_meal'), 'logging someone else''s meal');
commit;
\echo ALL NUTRITION TESTS PASSED
