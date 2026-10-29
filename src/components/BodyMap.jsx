import { MUSCLES } from '../lib/exercises.js'

// Muscle balance on a figure, front and back: each muscle lit by how many sets it got, the most
// worked in full lime. A schematic, not anatomy — it shows where the work went at a glance; the
// exact numbers are in the list under it.

// Muscle → shapes on a 120 × 240 figure: [cx, cy, rx, ry] ellipses, mirrored when `pair`.
const FRONT = {
  neck: [[60, 45, 6, 4]],
  shoulders: [[37, 58, 9, 7, true]],
  chest: [[50, 70, 10, 8, true]],
  biceps: [[30, 86, 5, 11, true]],
  forearms: [[25, 114, 4.5, 13, true]],
  abdominals: [[60, 98, 9, 19]],
  abductors: [[42, 132, 4, 9, true]],
  adductors: [[55, 146, 3.5, 12, true]],
  quadriceps: [[48, 158, 7.5, 21, true]],
  calves: [[48, 200, 5, 15, true]]
}
const BACK = {
  traps: [[60, 54, 13, 8]],
  shoulders: [[37, 58, 9, 7, true]],
  lats: [[45, 84, 8, 15, true]],
  'middle back': [[60, 80, 6, 11]],
  'lower back': [[60, 106, 9, 8]],
  triceps: [[30, 86, 5, 11, true]],
  forearms: [[25, 114, 4.5, 13, true]],
  glutes: [[51, 128, 9, 9, true]],
  hamstrings: [[49, 161, 7, 20, true]],
  calves: [[49, 199, 5.5, 15, true]]
}

// The figure itself, behind the muscles.
function Silhouette() {
  return <g className="body-shape">
    <circle cx="60" cy="24" r="12" />
    <rect x="38" y="48" width="44" height="76" rx="16" />
    <rect x="22" y="54" width="14" height="78" rx="7" transform="rotate(6 29 54)" />
    <rect x="84" y="54" width="14" height="78" rx="7" transform="rotate(-6 91 54)" />
    <rect x="40" y="116" width="19" height="110" rx="9" />
    <rect x="61" y="116" width="19" height="110" rx="9" />
  </g>
}

function Figure({ shapes, level, label }) {
  return <figure className="body-fig">
    <svg viewBox="0 0 120 240" role="img" aria-label={label}>
      <Silhouette />
      {Object.entries(shapes).flatMap(([m, list]) => list.flatMap(([cx, cy, rx, ry, pair], i) => {
        const l = level(m)
        const one = x => <ellipse key={m + i + x} cx={x} cy={cy} rx={rx} ry={ry} className={'muscle l' + l}><title>{MUSCLES[m]}</title></ellipse>
        return pair ? [one(cx), one(120 - cx)] : [one(cx)]
      }))}
    </svg>
    <figcaption className="caption">{label}</figcaption>
  </figure>
}

// counts: { muscle: sets }
export default function BodyMap({ counts }) {
  const max = Math.max(1, ...Object.values(counts))
  const level = m => (!counts[m] ? 0 : Math.min(4, Math.ceil((counts[m] / max) * 4)))
  return <div className="body-map">
    <Figure shapes={FRONT} level={level} label="جلو" />
    <Figure shapes={BACK} level={level} label="پشت" />
  </div>
}
