// The coach's backup: plain CSV files that open in Excel or Google Sheets, one row per set.

const cell = v => {
  const s = v == null ? '' : String(v)
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

// A byte-order mark up front, or Excel reads the Persian as gibberish.
export const toCsv = (head, rows) => '﻿' + [head, ...rows].map(r => r.map(cell).join(',')).join('\r\n')

const faDate = iso => new Date(iso + 'T12:00:00').toLocaleDateString('fa-IR-u-nu-latn', { year: 'numeric', month: '2-digit', day: '2-digit' })

// workouts: [{ student_id, date, routine_name, note, workout_sets: [{ exercise_id, set_index, weight, reps }] }]
export function workoutsCsv(workouts, names, exerciseName) {
  const rows = []
  const sorted = [...workouts].sort((a, b) => b.date.localeCompare(a.date) || (names[a.student_id] || '').localeCompare(names[b.student_id] || '', 'fa'))
  for (const w of sorted) {
    const base = [names[w.student_id] || '', faDate(w.date), w.date, w.routine_name || '']
    const sets = [...(w.workout_sets || [])].sort((a, b) => a.exercise_id.localeCompare(b.exercise_id) || a.set_index - b.set_index)
    if (!sets.length) rows.push([...base, '', '', '', '', w.note || ''])
    sets.forEach((s, i) => rows.push([...base, exerciseName(s.exercise_id), s.set_index, s.weight ?? '', s.reps ?? '', i ? '' : w.note || '']))
  }
  return toCsv(['شاگرد', 'تاریخ', 'تاریخ میلادی', 'برنامه', 'حرکت', 'ست', 'وزنه (کیلو)', 'تکرار', 'یادداشت'], rows)
}

// weights: [{ student_id, date, weight }]
export const weightsCsv = (weights, names) => toCsv(['شاگرد', 'تاریخ', 'تاریخ میلادی', 'وزن (کیلو)'],
  [...weights].sort((a, b) => b.date.localeCompare(a.date)).map(w => [names[w.student_id] || '', faDate(w.date), w.date, w.weight]))

export function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.append(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
