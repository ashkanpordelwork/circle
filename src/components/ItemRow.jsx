import { useState } from 'react'
import { fmtTarget } from '../lib/plan.js'
import Icon from './Icon.jsx'
import { Thumb, ExName, ExerciseDetails } from './ExerciseInfo.jsx'
import { IntField, RepsField, WeightField, TempoField } from './Wheel.jsx'
import { RULES, RULE_NAME, RULE_DESC } from '../lib/smart.js'

// One exercise of a day: a row that opens in place.
export default function ItemRow({ item, index, count, open, onToggle, onChange, onMove, onRemove }) {
  const [more, setMore] = useState(false)
  const set = (k, v) => onChange({ ...item, [k]: v })
  return <div className={'item-row' + (open ? ' open' : '')}>
    <button className="row pressable" style={{ '--sep-inset': '5.25rem' }} onClick={onToggle} aria-expanded={open}>
      <Thumb id={item.exercise_id} />
      <div className="content"><ExName id={item.exercise_id} /><div className="sub">{fmtTarget(item)}{item.note ? ' · ' + item.note : ''}</div></div>
      <Icon name={open ? 'expand_less' : 'expand_more'} style={{ color: 'var(--label-3)' }} />
    </button>
    {open && <div className="item-edit">
      <div className="inline-fields">
        <div className="field"><label>ست</label><IntField value={item.sets} onChange={v => set('sets', v)} title="تعداد ست" min={1} max={20} unit="ست" /></div>
        <div className="field"><label>تکرار</label><RepsField value={item.reps} onChange={v => set('reps', v)} /></div>
        <div className="field"><label>وزن (کیلو)</label><WeightField value={item.weight} onChange={v => set('weight', v)} title="وزن پیشنهادی" clearText="بدون وزنه" placeholder="—" /></div>
        <div className="field"><label>استراحت</label><IntField value={item.rest_sec} onChange={v => set('rest_sec', v)} title="استراحت" max={600} step={15} unit="ثانیه" suffix="ثانیه" fallback={90} clearText="بدون استراحت مشخص" placeholder="—" /></div>
      </div>
      {/* How the student's next weight is suggested, after each session they log. */}
      <div className="field mt"><label>پیشرفت خودکار</label>
        <div className="chips wrap-chips" data-no-drag role="radiogroup" aria-label="قانون پیشرفت">{RULES.map(r =>
          <button key={r} type="button" role="radio" aria-checked={(item.progression || 'linear') === r}
            className={'chip glass-lite pressable' + ((item.progression || 'linear') === r ? ' on' : '')} onClick={() => set('progression', r)}>{RULE_NAME[r]}</button>)}</div>
        <div className="caption rule-desc">{RULE_DESC[item.progression || 'linear']}</div>
      </div>
      {more ? <>
        <div className="field mt"><label>تمپو <span className="caption">(پایین · مکث · بالا · مکث، به ثانیه)</span></label>
          <TempoField value={item.tempo || ''} onChange={v => set('tempo', v)} /></div>
        <div className="field"><label>نکته برای شاگرد</label>
          <input className="input" placeholder="مثلاً آرام پایین بیا" value={item.note} onChange={e => set('note', e.target.value)} maxLength={500} /></div>
        <ExerciseDetails id={item.exercise_id} showEn={false} />
      </> : <button className="btn plain small pressable mt" onClick={() => setMore(true)}><Icon name="expand_more" />تمپو، نکته و روش اجرا</button>}
      <div className="item-actions">
        <button className="icon-btn glass interactive" disabled={index === 0} onClick={() => onMove(-1)} aria-label="بالاتر"><Icon name="arrow_upward" /></button>
        <button className="icon-btn glass interactive" disabled={index === count - 1} onClick={() => onMove(1)} aria-label="پایین‌تر"><Icon name="arrow_downward" /></button>
        <div className="grow" />
        <button className="btn glass interactive danger small" onClick={onRemove}><Icon name="delete" />حذف</button>
      </div>
    </div>}
  </div>
}

