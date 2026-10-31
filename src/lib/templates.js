// Ready-made routines to start from («یک روتین انتخاب کن»): a balanced week split and a full-body
// day. Taking one copies it into the athlete's own routines, to change as they like.
// Each item: [exercise id, sets, reps, rule]. Reps as a range climb by double progression.

const T = (key, name, desc, level, minutes, items) => ({ key, name, desc, level, minutes,
  items: items.map(([exercise_id, sets, reps, progression = 'linear']) => ({ exercise_id, sets, reps, weight: '', rest_sec: '', tempo: '', note: '', progression })) })

export const LEVEL_NAME = { beginner: 'مبتدی', intermediate: 'متوسط' }

export const TEMPLATES = [
  T('push', 'فشاری', 'سینه، سرشانه و پشت بازو؛ از پرس‌های سنگین تا حرکت‌های تک‌مفصلی.', 'intermediate', 55, [
    ['0025', 4, '5'],
    ['0314', 3, '8-12', 'double'],
    ['0405', 3, '8-12', 'double'],
    ['0334', 3, '12-15', 'double'],
    ['0201', 3, '10-15', 'double']]),
  T('pull', 'کششی', 'زیربغل از دو جهت، بعد پشت سرشانه و جلو بازو.', 'intermediate', 55, [
    ['0027', 4, '5'],
    ['0150', 3, '8-12', 'double'],
    ['0861', 3, '8-12', 'double'],
    ['0203', 3, '12-15', 'double'],
    ['0294', 3, '10-12', 'double']]),
  T('legs', 'پا', 'یک جلسه‌ی کامل پایین‌تنه: چهارسر، همسترینگ، سرینی و ساق.', 'intermediate', 60, [
    ['0043', 4, '5'],
    ['0085', 3, '8-10', 'double'],
    ['0739', 3, '10-12', 'double'],
    ['0586', 3, '10-12', 'double'],
    ['0605', 3, '12-15', 'double']]),
  T('upper', 'بالاتنه', 'سینه، پشت، سرشانه و بازوها، متعادل در یک جلسه.', 'intermediate', 60, [
    ['0025', 4, '6'],
    ['0027', 4, '6'],
    ['1457', 3, '8'],
    ['0150', 3, '8-12', 'double'],
    ['0031', 2, '10-12', 'double'],
    ['0060', 2, '10-12', 'double']]),
  T('lower', 'پایین‌تنه', 'ددلیفت و لانج، با پل باسن برای سرینی.', 'intermediate', 55, [
    ['0032', 3, '5'],
    ['0336', 3, '8-10', 'double'],
    ['1409', 3, '8-12', 'double'],
    ['0585', 3, '12-15', 'double'],
    ['0175', 3, '12-15', 'double']]),
  T('full', 'کل بدن', 'برای شروع: سه حرکت پایه و دو حرکت کمکی، هفته‌ای سه بار.', 'beginner', 45, [
    ['1760', 3, '8-12', 'double'],
    ['0289', 3, '8-12', 'double'],
    ['0292', 3, '8-12', 'double'],
    ['0085', 3, '10'],
    ['Plank', 3, '30']])
]
