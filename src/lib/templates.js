// Ready-made routines to start from («یک روتین انتخاب کن»): a balanced week split and a full-body
// day. Taking one copies it into the athlete's own routines, to change as they like.
// Each item: [exercise id, sets, reps, rule]. Reps as a range climb by double progression.

const T = (key, name, desc, level, minutes, items) => ({ key, name, desc, level, minutes,
  items: items.map(([exercise_id, sets, reps, progression = 'linear']) => ({ exercise_id, sets, reps, weight: '', rest_sec: '', tempo: '', note: '', progression })) })

export const LEVEL_NAME = { beginner: 'مبتدی', intermediate: 'متوسط' }

export const TEMPLATES = [
  T('push', 'فشاری', 'سینه، سرشانه و پشت بازو؛ از پرس‌های سنگین تا حرکت‌های تک‌مفصلی.', 'intermediate', 55, [
    ['Barbell_Bench_Press_-_Medium_Grip', 4, '5'],
    ['Incline_Dumbbell_Press', 3, '8-12', 'double'],
    ['Seated_Dumbbell_Press', 3, '8-12', 'double'],
    ['Side_Lateral_Raise', 3, '12-15', 'double'],
    ['Triceps_Pushdown', 3, '10-15', 'double']]),
  T('pull', 'کششی', 'زیربغل از دو جهت، بعد پشت سرشانه و جلو بازو.', 'intermediate', 55, [
    ['Bent_Over_Barbell_Row', 4, '5'],
    ['Wide-Grip_Lat_Pulldown', 3, '8-12', 'double'],
    ['Seated_Cable_Rows', 3, '8-12', 'double'],
    ['Face_Pull', 3, '12-15', 'double'],
    ['Dumbbell_Bicep_Curl', 3, '10-12', 'double']]),
  T('legs', 'پا', 'یک جلسه‌ی کامل پایین‌تنه: چهارسر، همسترینگ، سرینی و ساق.', 'intermediate', 60, [
    ['Barbell_Squat', 4, '5'],
    ['Romanian_Deadlift', 3, '8-10', 'double'],
    ['Leg_Press', 3, '10-12', 'double'],
    ['Lying_Leg_Curls', 3, '10-12', 'double'],
    ['Standing_Calf_Raises', 3, '12-15', 'double']]),
  T('upper', 'بالاتنه', 'سینه، پشت، سرشانه و بازوها، متعادل در یک جلسه.', 'intermediate', 60, [
    ['Barbell_Bench_Press_-_Medium_Grip', 4, '6'],
    ['Bent_Over_Barbell_Row', 4, '6'],
    ['Standing_Military_Press', 3, '8'],
    ['Wide-Grip_Lat_Pulldown', 3, '8-12', 'double'],
    ['Barbell_Curl', 2, '10-12', 'double'],
    ['Lying_Triceps_Press', 2, '10-12', 'double']]),
  T('lower', 'پایین‌تنه', 'ددلیفت و لانج، با هیپ تراست برای سرینی.', 'intermediate', 55, [
    ['Barbell_Deadlift', 3, '5'],
    ['Dumbbell_Lunges', 3, '8-10', 'double'],
    ['Barbell_Hip_Thrust', 3, '8-12', 'double'],
    ['Leg_Extensions', 3, '12-15', 'double'],
    ['Cable_Crunch', 3, '12-15', 'double']]),
  T('full', 'کل بدن', 'برای شروع: سه حرکت پایه و دو حرکت کمکی، هفته‌ای سه بار.', 'beginner', 45, [
    ['Goblet_Squat', 3, '8-12', 'double'],
    ['Dumbbell_Bench_Press', 3, '8-12', 'double'],
    ['One-Arm_Dumbbell_Row', 3, '8-12', 'double'],
    ['Romanian_Deadlift', 3, '10'],
    ['Plank', 3, '30']])
]
