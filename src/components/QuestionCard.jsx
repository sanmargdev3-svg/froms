import Switch from './Switch.jsx';
import { TYPES } from '../lib/settings.js';

const HSIZE = { 2: 'text-lg', 3: 'text-base', 4: 'text-sm' };
const NO_PLACEHOLDER = ['section', 'radio', 'checkbox', 'select', 'rating', 'file', 'audio', 'date', 'time'];
const accentSoft = 'bg-[var(--fc-soft)] text-[var(--fc)]';

/** The read-only look of a question, as the respondent will roughly see it. */
function Preview({ f }) {
  const box = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-400';
  switch (f.type) {
    case 'section':  return f.newpage ? null : <hr className="border-slate-200 my-1" />;
    case 'textarea': return <div className={box} style={{ height: 62 }}>{f.placeholder || 'Long answer text'}</div>;
    case 'select':   return <div className={`${box} flex justify-between`}>{f.placeholder || 'Choose an option…'}<i className="bi bi-chevron-down" /></div>;
    case 'radio':
    case 'checkbox': {
      const opts = f.options || [];
      return (
        <>
          {opts.slice(0, 4).map((o, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-slate-500 py-0.5">
              <span className={`w-4 h-4 border border-slate-300 inline-block ${f.type === 'radio' ? 'rounded-full' : 'rounded'}`} />{o}
              {f.correct === o && <i className="bi bi-check-circle-fill text-emerald-500" title="Correct answer" />}
            </div>
          ))}
          {opts.length > 4 && <div className="text-xs text-slate-400 ps-6">+ {opts.length - 4} more</div>}
        </>
      );
    }
    case 'rating':   return <div>{Array.from({ length: f.max || 5 }, (_, i) => <i key={i} className="bi bi-star text-amber-400 me-1" />)}</div>;
    case 'file':     return <div className={box}><i className="bi bi-upload me-1" />Choose a file…</div>;
    case 'audio':    return (
      <>
        {f.passage && <div className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3 mb-2 line-clamp-3 whitespace-pre-line">{f.passage}</div>}
        <div className={box}><i className="bi bi-mic me-1" />Record voice…</div>
      </>
    );
    case 'date':     return <div className={`${box} flex justify-between`}>dd / mm / yyyy<i className="bi bi-calendar-event" /></div>;
    case 'time':     return <div className={`${box} flex justify-between`}>--:--<i className="bi bi-clock" /></div>;
    default:         return <div className={box}>{f.placeholder || 'Short answer text'}</div>;
  }
}

const inline = 'border-0 border-b-[1.5px] border-transparent rounded-none bg-transparent py-1 px-0 w-full hover:border-slate-200 focus:border-[var(--fc)] focus:outline-none';

export default function QuestionCard({ f, num, open, onOpen, onClose, onChange, onDuplicate, onDelete, drag }) {
  const t = TYPES[f.type] || TYPES.text;
  const isSection = f.type === 'section';
  const set = patch => onChange(patch);

  const handle = (
    <span className={`cursor-grab text-slate-300 ${open ? 'pt-2' : 'pt-1'}`} draggable title="Drag to reorder"
          onDragStart={drag.onDragStart} onDragEnd={drag.onDragEnd}>
      <i className="bi bi-grip-vertical" />
    </span>
  );
  const cardCls = `relative bg-white rounded-2xl border p-5 transition-all ${drag.ghost ? 'fc-drag-ghost' : ''} ${
    open ? 'border-[var(--fc)] shadow-[0_10px_30px_-18px_rgba(15,23,42,.45)]' : 'border-slate-200 hover:border-slate-300 cursor-pointer'}`;
  const strip = <span className="absolute left-0 top-3.5 bottom-3.5 w-1 rounded-r" style={{ background: open ? 'var(--fc)' : 'transparent' }} />;

  if (!open) {
    return (
      <div className={cardCls} style={{ marginTop: drag.over ? 18 : undefined }}
           onDragOver={drag.onDragOver} onDrop={drag.onDrop}
           onClick={e => { if (!e.target.closest('button,input,select,textarea')) onOpen(); }}>
        {strip}
        <div className="flex items-start gap-3">
          {handle}
          <div className="flex-1 min-w-0">
            {isSection ? (
              <>
                <div className="flex items-center gap-2 mb-1 text-[11px]">
                  <span className="font-bold uppercase tracking-wide text-slate-400">Heading H{f.level || 2}</span>
                  {f.newpage && <span className={`font-semibold px-2 py-0.5 rounded-full ${accentSoft}`}><i className="bi bi-file-earmark-break" /> Starts a new page</span>}
                </div>
                <div className={`font-bold text-slate-900 ${HSIZE[f.level || 2]}`}>
                  {f.label || <span className="text-slate-300">Untitled heading</span>}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-1 text-[11px]">
                  <span className="font-bold text-slate-400">Q{num}</span>
                  <span className={`font-semibold px-2 py-0.5 rounded-full ${accentSoft}`}><i className={`bi ${t.icon}`} /> {t.label}</span>
                  {f.required && <span className="font-semibold text-rose-600">Required</span>}
                </div>
                <div className="font-semibold text-slate-800">{f.label || <span className="text-slate-300">Untitled question</span>}</div>
              </>
            )}
            {f.help && <div className="text-xs text-slate-500 mt-0.5">{f.help}</div>}
            <div className="mt-3"><Preview f={f} /></div>
          </div>
          <div className="flex items-center gap-1 text-slate-300">
            <button onClick={onDuplicate} className="w-8 h-8 rounded-lg grid place-items-center hover:bg-slate-100 hover:text-slate-600" title="Duplicate"><i className="bi bi-copy" /></button>
            <button onClick={onDelete} className="w-8 h-8 rounded-lg grid place-items-center hover:bg-rose-50 hover:text-rose-600" title="Delete"><i className="bi bi-trash" /></button>
          </div>
        </div>
      </div>
    );
  }

  const changeType = type => {
    const patch = { type };
    if (TYPES[type].options && !f.options) patch.options = ['Option 1', 'Option 2'];
    if (type === 'rating' && !f.max) patch.max = 5;
    set(patch);
  };

  return (
    <div className={cardCls} style={{ marginTop: drag.over ? 18 : undefined }} onDragOver={drag.onDragOver} onDrop={drag.onDrop}>
      {strip}
      <div className="flex items-start gap-3">
        {handle}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-start gap-3 mb-3">
            <input autoFocus value={f.label} onChange={e => set({ label: e.target.value })}
                   placeholder={isSection ? 'Section title' : 'Type your question'}
                   className={`${inline} flex-1 min-w-[180px] text-slate-900 ${isSection ? 'text-lg font-bold' : 'text-[15px] font-semibold'}`} />
            {!isSection && (
              <select value={f.type} onChange={e => changeType(e.target.value)}
                      className="text-xs rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-slate-600">
                {Object.keys(TYPES).filter(k => k !== 'section').map(k => <option key={k} value={k}>{TYPES[k].label}</option>)}
              </select>
            )}
          </div>

          <input value={f.help || ''} onChange={e => set({ help: e.target.value })} placeholder="Helper text (optional)"
                 className={`${inline} text-sm text-slate-500 mb-4`} />

          {!NO_PLACEHOLDER.includes(f.type) && (
            <input value={f.placeholder || ''} onChange={e => set({ placeholder: e.target.value })}
                   placeholder="Placeholder shown inside the box (optional)" className={`${inline} text-sm text-slate-500 mb-4`} />
          )}

          {t.options && (
            <div className="mb-4 space-y-2">
              {(f.options || []).map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-slate-300">
                    {f.type === 'checkbox' ? <i className="bi bi-square" /> : f.type === 'radio' ? <i className="bi bi-circle" /> : `${i + 1}.`}
                  </span>
                  <input value={o} placeholder={`Option ${i + 1}`}
                         onChange={e => set({ options: f.options.map((x, j) => (j === i ? e.target.value : x)),
                                              ...(f.correct === o ? { correct: e.target.value } : {}) })}
                         className={`${inline} flex-1 text-sm text-slate-700`} />
                  {f.type !== 'checkbox' && (
                    <button title={f.correct === o ? 'Correct answer (click to clear)' : 'Mark as the correct answer'}
                            className={`px-1 ${f.correct === o ? 'text-emerald-500' : 'text-slate-300 hover:text-emerald-500'}`}
                            onClick={() => set({ correct: f.correct === o ? undefined : o })}>
                      <i className={`bi ${f.correct === o ? 'bi-check-circle-fill' : 'bi-check-circle'}`} />
                    </button>
                  )}
                  <button title="Remove" className="text-slate-300 hover:text-rose-600 px-1"
                          onClick={() => f.options.length > 1 && set({ options: f.options.filter((_, j) => j !== i), correct: f.correct === o ? undefined : f.correct })}>
                    <i className="bi bi-x-lg" />
                  </button>
                </div>
              ))}
              <button className="text-sm font-semibold text-[var(--fc)] hover:underline mt-1"
                      onClick={() => set({ options: [...(f.options || []), `Option ${(f.options || []).length + 1}`] })}>
                <i className="bi bi-plus-lg" /> Add option
              </button>
            </div>
          )}

          {f.type !== 'checkbox' && t.options && (
            <p className="text-xs text-slate-400 -mt-2 mb-4">
              <i className="bi bi-check-circle" /> Tick an option to make this a scored quiz question.
            </p>
          )}

          {f.type === 'audio' && (
            <div className="mb-4">
              <label className="text-xs font-bold text-slate-500 block mb-1.5">Passage to read aloud</label>
              <textarea rows={6} value={f.passage || ''} onChange={e => set({ passage: e.target.value })}
                        placeholder="Paste the text the person should read while recording…"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[var(--fc)]" />
              <p className="text-xs text-slate-400 mt-1">
                {(f.passage || '').trim().split(/\s+/).filter(Boolean).length} words
              </p>
            </div>
          )}

          {f.type === 'rating' && (
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-slate-600">Out of</span>
              <input type="number" min="3" max="10" value={f.max || 5}
                     onChange={e => set({ max: Math.max(3, Math.min(10, parseInt(e.target.value, 10) || 5)) })}
                     className="w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
              <span className="text-sm text-slate-600">stars</span>
            </div>
          )}

          {isSection && (
            <>
              <div className="flex flex-wrap items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600">Size</span>
                  <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                    {[2, 3, 4].map(l => (
                      <button key={l} onClick={() => set({ level: l })}
                              className={`px-3 py-1.5 text-xs font-bold ${(f.level || 2) === l ? 'text-white bg-[var(--fc)]' : 'text-slate-500 hover:bg-slate-50'}`}>
                        H{l}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600">Start a new page here</span>
                  <Switch on={f.newpage} onChange={v => set({ newpage: v })} />
                </div>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                Everything below this heading moves to the next page, with Back / Next buttons for the person filling the form.
              </p>
            </>
          )}

          {!t.options && f.type !== 'rating' && !isSection && <div className="mb-4"><Preview f={f} /></div>}

          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            {!isSection && (
              <>
                <span className="text-sm text-slate-600">Required</span>
                <Switch on={f.required} onChange={v => set({ required: v })} />
                <span className="w-px h-5 bg-slate-200 mx-1" />
              </>
            )}
            <button onClick={onDuplicate} className="text-sm text-slate-500 hover:text-slate-800 px-2 py-1 rounded-lg hover:bg-slate-100"><i className="bi bi-copy" /> Duplicate</button>
            <button onClick={onDelete} className="text-sm text-rose-600 hover:bg-rose-50 px-2 py-1 rounded-lg"><i className="bi bi-trash" /> Delete</button>
            <button onClick={onClose} className="ms-auto text-sm font-semibold text-white bg-[var(--fc)] px-4 py-1.5 rounded-lg">Done</button>
          </div>
        </div>
      </div>
    </div>
  );
}
