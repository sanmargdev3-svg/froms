import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, shareUrl } from '../lib/api.js';
import { DEFAULT_SETTINGS, LAYOUTS, TYPES, rgbOf, uid } from '../lib/settings.js';
import Modal from '../components/Modal.jsx';
import CopyButton from '../components/CopyButton.jsx';
import QuestionCard from '../components/QuestionCard.jsx';
import DesignModal from '../components/DesignModal.jsx';

const NEW_FORM = { id: 0, title: 'Untitled form', description: '', status: 'draft', theme: 'indigo', slug: '' };

const STATUSES = [
  ['draft',     'Draft',     'Only you can see it',              'bi-pencil-square'],
  ['published', 'Published', 'Anyone with the link can fill it', 'bi-broadcast'],
  ['closed',    'Closed',    'Link works, answers are off',      'bi-lock'],
];

const inline = 'border-0 border-b-[1.5px] border-transparent rounded-none bg-transparent py-1 px-0 w-full hover:border-slate-200 focus:border-[var(--fc)] focus:outline-none';

function TypePicker({ open, onClose, onPick }) {
  const [q, setQ] = useState('');
  useEffect(() => { if (open) setQ(''); }, [open]);
  const groups = {};
  Object.entries(TYPES).forEach(([t, d]) => {
    if (q && !(d.label + ' ' + d.hint).toLowerCase().includes(q.toLowerCase())) return;
    (groups[d.group] = groups[d.group] || []).push(t);
  });
  return (
    <Modal open={open} onClose={onClose} size="lg">
      <div className="p-6">
        <div className="flex items-center justify-between mb-3">
          <h5 className="font-bold text-lg">Add a question</h5>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl"><i className="bi bi-x-lg" /></button>
        </div>
        <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search question types…"
               className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm mb-1" />
        {Object.keys(groups).length === 0 && <div className="text-center text-slate-400 text-sm py-6">No matching question type.</div>}
        {Object.entries(groups).map(([g, types]) => (
          <div key={g}>
            <div className="mt-4 mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">{g}</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {types.map(t => (
                <button key={t} onClick={() => onPick(t)}
                        className="h-full text-left border border-slate-200 rounded-xl p-3 bg-white hover:bg-[var(--fc-soft)] hover:text-[var(--fc)]">
                  <i className={`bi ${TYPES[t].icon} block mb-1 text-xl`} />
                  <span className="block font-semibold text-sm text-slate-800">{TYPES[t].label}</span>
                  <span className="block text-slate-400 text-[11px]">{TYPES[t].hint}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

export default function Builder() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [meta, setMeta] = useState(NEW_FORM);
  const [fields, setFields] = useState([]);
  const [S, setS] = useState(DEFAULT_SETTINGS);
  const [responseCount, setResponseCount] = useState(0);
  const [openKey, setOpenKey] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState(['All changes saved', 'text-slate-400']);
  const [modal, setModal] = useState(null);           // 'type' | 'share' | 'design'
  const [loadError, setLoadError] = useState('');
  const [drag, setDrag] = useState({ from: null, over: null });
  const descRef = useRef(null);

  /* latest state for the autosave timer and keyboard shortcut */
  const live = useRef();
  live.current = { meta, fields, S, dirty };

  /* ── load ───────────────────────────────────────── */
  useEffect(() => {
    document.title = 'Builder · FormCraft';
    if (!id) {
      if (live.current.meta.id) { setMeta(NEW_FORM); setFields([]); setS(DEFAULT_SETTINGS); setResponseCount(0); }
      return;
    }
    if (+id === live.current.meta.id) return;       // we just saved and moved to /builder/:id
    api.form(id).then(j => {
      const { fields: fl, settings, ...rest } = j.form;
      setMeta(rest);
      setFields(Array.isArray(fl) ? fl : []);
      setS({ ...DEFAULT_SETTINGS, ...settings });
      setResponseCount(j.responseCount);
      setDirty(false);
    }).catch(e => setLoadError(e.message));
  }, [id]);

  useEffect(() => {
    const d = descRef.current;
    if (d) { d.style.height = 'auto'; d.style.height = d.scrollHeight + 2 + 'px'; }
  }, [meta.description]);

  /* ── edits ──────────────────────────────────────── */
  const touch = () => { setDirty(true); setSaveState(['Unsaved changes', 'text-amber-600']); };
  const setMetaField = patch => { setMeta(m => ({ ...m, ...patch })); touch(); };
  const setDesign = patch => { setS(s => ({ ...s, ...patch })); touch(); };
  const updateField = (key, patch) => { setFields(fs => fs.map(f => (f.key === key ? { ...f, ...patch } : f))); touch(); };

  function addField(type) {
    const f = { key: uid(), type, label: '', help: '', required: false, placeholder: '' };
    if (TYPES[type].options) f.options = ['Option 1', 'Option 2'];
    if (type === 'rating') f.max = 5;
    if (type === 'section') { f.level = 2; f.newpage = false; }
    setFields(fs => [...fs, f]);
    setOpenKey(f.key);
    setModal(null);
    touch();
    setTimeout(() => document.querySelector(`[data-key="${f.key}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 60);
  }

  function duplicate(i) {
    const c = { ...structuredClone(fields[i]), key: uid() };
    setFields(fs => [...fs.slice(0, i + 1), c, ...fs.slice(i + 1)]);
    setOpenKey(c.key);
    touch();
  }

  function remove(key) {
    setFields(fs => fs.filter(f => f.key !== key));
    if (openKey === key) setOpenKey(null);
    touch();
  }

  function drop(toKey) {
    const from = fields.findIndex(f => f.key === drag.from);
    const to = fields.findIndex(f => f.key === toKey);
    setDrag({ from: null, over: null });
    if (from < 0 || to < 0 || from === to) return;
    const next = [...fields];
    next.splice(to, 0, next.splice(from, 1)[0]);
    setFields(next);
    touch();
  }

  /* ── save ───────────────────────────────────────── */
  const save = useCallback(async silent => {
    const { meta: m, fields: fl, S: s } = live.current;
    setSaveState(['Saving…', 'text-slate-400']);
    try {
      const j = await api.save({
        id: m.id, title: m.title.trim() || 'Untitled form', description: m.description.trim(),
        status: m.status, theme: m.theme, fields: fl, settings: s,
      });
      setMeta(x => ({ ...x, id: j.id, slug: j.slug }));
      live.current.meta = { ...live.current.meta, id: j.id };
      setDirty(false);
      setSaveState(['Saved ' + new Date().toLocaleTimeString(), 'text-emerald-600']);
      if (String(j.id) !== String(id)) navigate(`/builder/${j.id}`, { replace: true });
      return j;
    } catch (e) {
      setSaveState(['Not saved', 'text-rose-600']);
      if (!silent) alert(e.message || 'Save failed');
      return null;
    }
  }, [id, navigate]);

  useEffect(() => {
    const t = setInterval(() => { if (live.current.dirty) save(true); }, 15000);
    const onKey = ev => {
      if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 's') { ev.preventDefault(); save(false); }
    };
    const onUnload = ev => { if (live.current.dirty) { ev.preventDefault(); ev.returnValue = ''; } };
    document.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', onUnload);
    return () => { clearInterval(t); document.removeEventListener('keydown', onKey); window.removeEventListener('beforeunload', onUnload); };
  }, [save]);

  async function preview() {
    const j = await save(true);
    if (j) window.open(shareUrl(j.slug) + '?preview=1', '_blank');
  }
  async function share() {
    if (await save(true)) setModal('share');
  }

  if (loadError) return <div className="max-w-7xl mx-auto px-6 py-10 text-rose-600">{loadError}</div>;

  const grad = `linear-gradient(120deg,${S.primary},${S.secondary})`;
  const L = LAYOUTS[S.layout] || LAYOUTS.paged;
  const flags = [];
  if (S.coverImage) flags.push(['bi-image', 'Cover']);
  if (S.footerImage) flags.push(['bi-card-image', 'Footer art']);
  if (S.endTitle || S.endImage || S.endBtnLabel) flags.push(['bi-flag', 'Custom end']);
  if (!S.animate) flags.push(['bi-pause', 'No motion']);
  const link = meta.slug ? shareUrl(meta.slug) : '';
  const topBtn = 'inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-100';
  let qNum = 0;

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6"
         style={{ '--fc': S.primary, '--fc-soft': `rgba(${rgbOf(S.primary)},.12)` }}>

      {/* top bar */}
      <div className="bg-white rounded-2xl border border-slate-200 px-4 sm:px-5 py-3 mb-5 flex flex-wrap items-center gap-3">
        <Link to="/" className="w-9 h-9 grid place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 shrink-0">
          <i className="bi bi-arrow-left" />
        </Link>
        <div className="flex-1 min-w-[180px]">
          <input value={meta.title} onChange={e => setMetaField({ title: e.target.value })} placeholder="Untitled form"
                 className={`${inline} text-xl font-extrabold tracking-tight text-slate-900`} />
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-xs ${saveState[1]}`}>{saveState[0]}</span>
            {responseCount > 0 && (
              <>
                <span className="text-xs text-slate-300">•</span>
                <Link to={`/responses/${meta.id}`} className="text-xs font-semibold text-[var(--fc)] hover:underline">{responseCount} responses</Link>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 ms-auto">
          <button onClick={() => setModal('design')} className={topBtn}><i className="bi bi-palette" /><span className="hidden sm:inline">Design</span></button>
          <button onClick={preview} className={topBtn}><i className="bi bi-eye" /><span className="hidden sm:inline">Preview</span></button>
          <button onClick={share} className={topBtn}><i className="bi bi-share" /><span className="hidden sm:inline">Share</span></button>
          <button onClick={() => save(false)} className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg text-white bg-[var(--fc)] hover:opacity-90 shadow-sm">
            <i className="bi bi-check2" /> Save
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">
        {/* canvas */}
        <section>
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-4">
            <div className="h-2.5" style={{ background: grad }} />
            <div className="p-6">
              <input value={meta.title} onChange={e => setMetaField({ title: e.target.value })} placeholder="Form title"
                     className={`${inline} text-2xl font-extrabold tracking-tight text-slate-900 mb-1`} />
              <textarea ref={descRef} rows={1} value={meta.description} onChange={e => setMetaField({ description: e.target.value })}
                        placeholder="Add a short description so people know what this form is for…"
                        className={`${inline} text-[15px] text-slate-600 resize-none`} />
            </div>
          </div>

          <div className="space-y-3" onDragOver={e => e.preventDefault()}>
            {fields.map((f, i) => {
              if (f.type !== 'section') qNum++;
              return (
                <div key={f.key} data-key={f.key}>
                  <QuestionCard
                    f={f} num={qNum} open={openKey === f.key}
                    onOpen={() => setOpenKey(f.key)} onClose={() => setOpenKey(null)}
                    onChange={patch => updateField(f.key, patch)}
                    onDuplicate={() => duplicate(i)} onDelete={() => remove(f.key)}
                    drag={{
                      ghost: drag.from === f.key,
                      over: drag.over === f.key && drag.from !== f.key,
                      onDragStart: e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', f.key); setTimeout(() => setDrag({ from: f.key, over: null }), 0); },
                      onDragEnd: () => setDrag({ from: null, over: null }),
                      onDragOver: e => { e.preventDefault(); if (drag.over !== f.key) setDrag(d => ({ ...d, over: f.key })); },
                      onDrop: e => { e.preventDefault(); drop(f.key); },
                    }}
                  />
                </div>
              );
            })}
          </div>

          {fields.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-12 text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-[var(--fc-soft)] text-[var(--fc)] grid place-items-center text-2xl mb-3"><i className="bi bi-magic" /></div>
              <h3 className="font-bold text-slate-800">Add your first question</h3>
              <p className="text-slate-500 text-sm mt-1 mb-5">Pick a question type below, then click it to edit the wording.</p>
              <button onClick={() => setModal('type')} className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-[var(--fc)] px-5 py-2.5 rounded-xl">
                <i className="bi bi-plus-lg" /> Add question
              </button>
            </div>
          ) : (
            <button onClick={() => setModal('type')}
                    className="w-full mt-3 border-2 border-dashed border-slate-300 rounded-2xl py-4 text-sm font-semibold text-slate-500 hover:border-slate-400 hover:text-slate-700 hover:bg-white">
              <i className="bi bi-plus-lg" /> Add question
            </button>
          )}
        </section>

        {/* right rail */}
        <aside className="lg:sticky lg:top-20 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">Status</h2>
            <div className="space-y-1.5">
              {STATUSES.map(([v, lbl, sub, ic]) => {
                const on = meta.status === v;
                return (
                  <button key={v} onClick={() => setMetaField({ status: v })}
                          className={`w-full flex items-start gap-2.5 text-left px-3 py-2.5 rounded-xl border ${on ? 'border-slate-800 bg-slate-50' : 'border-slate-200 hover:border-slate-300'}`}>
                    <i className={`bi ${ic} mt-0.5`} />
                    <span className="flex-1">
                      <span className="block text-sm font-semibold text-slate-800">{lbl}</span>
                      <span className="block text-xs text-slate-500">{sub}</span>
                    </span>
                    <i className={`bi bi-check2 ${on ? '' : 'opacity-0'}`} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">Design</h2>
              <button onClick={() => setModal('design')} className="text-xs font-semibold text-[var(--fc)] hover:underline">Customise</button>
            </div>
            <button onClick={() => setModal('design')} className="w-full text-left">
              <div className="h-12 rounded-xl mb-3" style={{ background: grad }} />
              <div className="flex items-center gap-2 text-sm">
                <i className={`bi ${L.icon} text-[var(--fc)]`} />
                <span className="font-semibold text-slate-700">{L.label}</span>
                <span className="ms-auto text-xs text-slate-400">{S.surface === 'dark' ? 'Dark' : 'Light'}</span>
              </div>
            </button>
            {flags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {flags.map(([ic, txt]) => (
                  <span key={txt} className="text-[11px] font-semibold bg-[var(--fc-soft)] text-[var(--fc)] px-2 py-0.5 rounded-full"><i className={`bi ${ic}`} /> {txt}</span>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">Share link</h2>
            <div className="flex gap-2">
              <input readOnly value={link} className="flex-1 min-w-0 text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-600" />
              <CopyButton text={link} className="text-xs font-semibold px-3 rounded-lg bg-[var(--fc-soft)] text-[var(--fc)]" done={<i className="bi bi-check2" />}>
                <i className="bi bi-clipboard" />
              </CopyButton>
            </div>
            {!link && <p className="text-xs text-slate-400 mt-2">Save the form once to get its link.</p>}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">Tips</h2>
            <ul className="text-xs text-slate-500 space-y-1.5">
              <li><i className="bi bi-grip-vertical me-1" /> Drag a card by its handle to reorder.</li>
              <li><i className="bi bi-cursor me-1" /> Click a question to edit it inline.</li>
              <li><i className="bi bi-type-h2 me-1" /> Use a section title to split long forms.</li>
              <li><i className="bi bi-keyboard me-1" /> Ctrl + S saves. Changes autosave every 15 s.</li>
            </ul>
          </div>
        </aside>
      </div>

      <TypePicker open={modal === 'type'} onClose={() => setModal(null)} onPick={addField} />

      <Modal open={modal === 'share'} onClose={() => setModal(null)}>
        <div className="p-6 text-center">
          <div className="mx-auto mb-3 rounded-xl bg-[var(--fc-soft)] text-[var(--fc)] w-14 h-14 grid place-items-center text-2xl" style={{ '--fc': S.primary, '--fc-soft': `rgba(${rgbOf(S.primary)},.12)` }}>
            <i className="bi bi-send" />
          </div>
          <h5 className="font-bold text-lg mb-1">Your form is ready to share</h5>
          <p className="text-slate-500 text-sm mb-4">Anyone with this link can fill it in while the form is <strong>published</strong>.</p>
          <div className="flex mb-2">
            <input readOnly value={link} className="flex-1 min-w-0 border border-slate-300 rounded-l-lg px-3 py-2 text-sm" />
            <CopyButton text={link} className="bg-slate-900 text-white text-sm font-semibold px-4 rounded-r-lg" done="Copied!">Copy</CopyButton>
          </div>
          <a href={link} target="_blank" rel="noreferrer" className="block w-full border border-slate-300 rounded-lg py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Open the form
          </a>
        </div>
      </Modal>

      <DesignModal open={modal === 'design'} onClose={() => setModal(null)} S={S} set={setDesign} title={meta.title} onPreview={preview} />
    </div>
  );
}
