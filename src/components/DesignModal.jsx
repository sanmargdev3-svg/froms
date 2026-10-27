import { useRef, useState } from 'react';
import Modal from './Modal.jsx';
import Switch from './Switch.jsx';
import { api, mediaUrl } from '../lib/api.js';
import { PALETTES, RADII, isHex, rgbOf } from '../lib/settings.js';

const TABS = [
  ['layout', 'bi-layout-wtf', 'Layout'],
  ['theme', 'bi-palette', 'Theme'],
  ['media', 'bi-image', 'Graphics'],
  ['end', 'bi-flag', 'Thank you'],
];

const inS = 'w-full border border-slate-200 rounded-[10px] px-3 py-2 text-sm focus:outline-none focus:border-[var(--fc)] focus:ring-[3px] focus:ring-[var(--fc-soft)]';
const Lbl = ({ children }) => <label className="text-xs font-bold text-slate-500 block mb-1.5">{children}</label>;

function Choice({ on, onClick, className = '', children }) {
  return (
    <button type="button" onClick={onClick}
            className={`border-[1.5px] rounded-[14px] text-left bg-white transition hover:-translate-y-px ${className} ${
              on ? 'border-[var(--fc)] shadow-[0_0_0_3px_var(--fc-soft)]' : 'border-slate-200 hover:border-slate-300'}`}>
      {children}
    </button>
  );
}

function Art({ on, style, bars }) {
  return (
    <div className="h-[54px] rounded-lg bg-slate-100 grid gap-1 p-2 mb-2.5" style={style}>
      {bars.map((s, i) => <span key={i} className="block rounded-sm" style={{ background: on ? 'var(--fc)' : '#cbd5e1', opacity: on ? .55 : 1, ...s }} />)}
    </div>
  );
}

function ImagePreview({ src, h = 96 }) {
  return (
    <div className="rounded-[14px] overflow-hidden border border-slate-200 bg-slate-50" style={{ minHeight: h }}>
      {src
        ? <img src={mediaUrl(src)} alt="" className="w-full block object-cover" style={{ maxHeight: 150 }} />
        : <div className="text-slate-400 text-sm grid place-items-center" style={{ height: h }}>No image yet</div>}
    </div>
  );
}

function MiniPreview({ S, title }) {
  const dark = S.surface === 'dark';
  const r = RADII[S.corner];
  const bg = dark ? '#0a0e18' : '#f4f6fb', card = dark ? '#121a2b' : '#fff';
  const ink = dark ? '#e9eef7' : '#101828', line = dark ? '#233047' : '#e6e9f0';
  const grad = `linear-gradient(120deg,${S.primary},${S.secondary})`;
  return (
    <div className="rounded-[14px] overflow-hidden border border-slate-200">
      <div style={{ background: bg, padding: 14 }}>
        <div style={{ background: card, border: `1px solid ${line}`, borderRadius: r, overflow: 'hidden' }}>
          <div style={{ height: 5, background: grad }} />
          <div style={{ padding: '12px 14px' }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: ink }}>{title || 'Your form'}</div>
            <div style={{ height: 8, width: '70%', background: line, borderRadius: 4, marginTop: 8 }} />
          </div>
        </div>
        <div style={{ background: card, border: `1px solid ${line}`, borderRadius: r, padding: '12px 14px', marginTop: 8 }}>
          <div style={{ fontWeight: 650, fontSize: 12, color: ink }}>A question</div>
          <div style={{ border: `1.5px solid ${S.primary}`, borderRadius: `calc(${r} - 6px)`, height: 30, marginTop: 8,
                        boxShadow: `0 0 0 3px rgba(${rgbOf(S.primary)},.2)` }} />
        </div>
        <div style={{ marginTop: 10, display: 'inline-block', padding: '8px 18px', borderRadius: `calc(${r} - 6px)`,
                      background: grad, color: '#fff', fontWeight: 650, fontSize: 12 }}>
          {S.submitLabel || 'Submit'}
        </div>
      </div>
    </div>
  );
}

/** Colour picker + hex box. The hex box keeps its own text while it is not a full colour yet. */
function ColorField({ value, onChange }) {
  const [draft, setDraft] = useState(null);
  return (
    <div className="flex gap-2 mb-3">
      <input type="color" value={value} onChange={e => onChange(e.target.value.toLowerCase())}
             className="w-11 h-[38px] p-0 border border-slate-200 rounded-[10px] bg-transparent cursor-pointer" />
      <input className={inS} maxLength={7} spellCheck={false} value={draft ?? value}
             onChange={e => { setDraft(e.target.value); if (isHex(e.target.value)) onChange(e.target.value.toLowerCase()); }}
             onBlur={() => setDraft(null)} />
    </div>
  );
}

export default function DesignModal({ open, onClose, S, set, title, onPreview }) {
  const [tab, setTab] = useState('layout');
  const [uploading, setUploading] = useState(null);
  const fileRef = useRef(null);
  const target = useRef(null);

  const pick = key => { target.current = key; fileRef.current.value = ''; fileRef.current.click(); };
  async function upload(e) {
    const file = e.target.files[0];
    const key = target.current;
    if (!file || !key) return;
    setUploading(key);
    try { set({ [key]: (await api.upload(file)).path }); } catch (err) { alert(err.message || 'Upload failed'); }
    setUploading(null);
  }

  const Drop = ({ k, icon = 'bi-cloud-arrow-up', sub }) => (
    <div onClick={() => pick(k)}
         className="border-[1.5px] border-dashed border-slate-300 rounded-xl p-3.5 text-center cursor-pointer transition hover:border-[var(--fc)] hover:bg-[var(--fc-soft)]">
      {uploading === k ? (
        <div className="text-sm font-semibold text-slate-500"><i className="bi bi-arrow-repeat" /> Uploading…</div>
      ) : (
        <>
          <i className={`bi ${icon} text-2xl text-slate-400`} />
          <div className="text-sm font-semibold text-slate-700">Upload an image</div>
          {sub && <div className="text-slate-400 text-[11px]">{sub}</div>}
        </>
      )}
    </div>
  );
  const Remove = ({ k }) => (
    <button className="text-sm text-rose-600 hover:underline mt-2" onClick={() => set({ [k]: '' })}>Remove image</button>
  );

  return (
    <Modal open={open} onClose={onClose} size="lg"
           style={{ '--fc': S.primary, '--fc-soft': `rgba(${rgbOf(S.primary)},.12)` }}>
      <div className="flex items-start justify-between px-6 pt-6">
        <div>
          <h5 className="font-bold text-lg text-slate-900">Design</h5>
          <p className="text-slate-500 text-sm">How the form looks and feels to the person filling it.</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl"><i className="bi bi-x-lg" /></button>
      </div>

      <div className="p-6">
        <div className="flex flex-wrap gap-1 mb-5 text-sm font-semibold">
          {TABS.map(([k, icon, label]) => (
            <button key={k} onClick={() => setTab(k)}
                    className={`px-3 py-2 rounded-lg ${tab === k ? 'bg-[var(--fc)] text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
              <i className={`bi ${icon}`} /> {label}
            </button>
          ))}
        </div>

        {tab === 'layout' && (
          <>
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
              <Choice on={S.layout === 'paged'} onClick={() => set({ layout: 'paged' })} className="p-3.5">
                <Art on={S.layout === 'paged'} style={{ gridTemplateRows: '6px 1fr 8px' }} bars={[{}, {}, { width: '40%', justifySelf: 'end' }]} />
                <div className="font-bold text-sm text-slate-800">Paged</div>
                <div className="text-slate-400 text-[11.5px]">A few questions per step, with Back / Next. Split it with a section heading.</div>
              </Choice>
              <Choice on={S.layout === 'single'} onClick={() => set({ layout: 'single' })} className="p-3.5">
                <Art on={S.layout === 'single'} style={{ gridTemplateRows: 'repeat(4,1fr)' }} bars={[{}, {}, {}, {}]} />
                <div className="font-bold text-sm text-slate-800">One long page</div>
                <div className="text-slate-400 text-[11.5px]">Everything on a single scroll. Fastest for short forms.</div>
              </Choice>
              <Choice on={S.layout === 'typeform'} onClick={() => set({ layout: 'typeform' })} className="p-3.5">
                <Art on={S.layout === 'typeform'} style={{ placeContent: 'center' }} bars={[{ height: 9, width: '70%' }, { height: 20 }]} />
                <div className="font-bold text-sm text-slate-800">Conversational</div>
                <div className="text-slate-400 text-[11.5px]">One question at a time, full screen, Enter to move on.</div>
              </Choice>
              <Choice on={S.layout === 'classic'} onClick={() => set({ layout: 'classic' })} className="p-3.5">
                <Art on={S.layout === 'classic'} style={{ gridTemplateRows: '10px repeat(3,1fr)' }} bars={[{}, { width: '80%' }, { width: '80%' }, { width: '80%' }]} />
                <div className="font-bold text-sm text-slate-800">Professional</div>
                <div className="text-slate-400 text-[11.5px]">One linear page: numbered sections, sticky progress bar and timer.</div>
              </Choice>
            </div>
            <div className="flex flex-wrap items-center gap-6 mt-5 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2"><span className="text-sm text-slate-600">Progress bar</span>
                <Switch on={S.progress} onChange={v => set({ progress: v })} /></div>
              <div className="flex items-center gap-2"><span className="text-sm text-slate-600">Animations</span>
                <Switch on={S.animate} onChange={v => set({ animate: v })} /></div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-600"><i className="bi bi-stopwatch" /> Time limit</label>
                <input type="number" min={0} max={300} className={inS} style={{ width: 80 }} value={S.timeLimit || 0}
                       onChange={e => set({ timeLimit: Math.max(0, Math.min(300, parseInt(e.target.value, 10) || 0)) })} />
                <span className="text-sm text-slate-400">min (0 = none)</span>
              </div>
              <div className="flex items-center gap-2 ms-auto">
                <label className="text-sm text-slate-600">Submit button</label>
                <input className={inS} style={{ width: 170 }} maxLength={40} placeholder="Submit"
                       value={S.submitLabel} onChange={e => set({ submitLabel: e.target.value })} />
              </div>
            </div>
          </>
        )}

        {tab === 'theme' && (
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <Lbl>Primary colour</Lbl>
              <ColorField value={S.primary} onChange={v => set({ primary: v })} />
              <Lbl>Secondary colour</Lbl>
              <ColorField value={S.secondary} onChange={v => set({ secondary: v })} />
              <Lbl>Palettes</Lbl>
              <div className="grid grid-cols-2 gap-2">
                {PALETTES.map(t => (
                  <button key={t.name} title={t.name} onClick={() => set({ primary: t.p, secondary: t.s })}
                          className={`w-full h-[30px] rounded-[9px] border-2 ${S.primary === t.p && S.secondary === t.s ? 'border-slate-900' : 'border-transparent'}`}
                          style={{ background: `linear-gradient(120deg,${t.p},${t.s})` }} />
                ))}
              </div>
            </div>
            <div>
              <Lbl>Background</Lbl>
              <div className="flex gap-2 mb-3">
                <Choice on={S.surface === 'light'} onClick={() => set({ surface: 'light' })} className="py-2 px-3 w-auto">
                  <span className="text-sm font-semibold"><i className="bi bi-sun" /> Light</span></Choice>
                <Choice on={S.surface === 'dark'} onClick={() => set({ surface: 'dark' })} className="py-2 px-3 w-auto">
                  <span className="text-sm font-semibold"><i className="bi bi-moon-stars" /> Dark</span></Choice>
              </div>
              <Lbl>Corners</Lbl>
              <div className="flex gap-2 mb-3">
                {[['round', 'Rounded'], ['soft', 'Soft'], ['sharp', 'Sharp']].map(([v, l]) => (
                  <Choice key={v} on={S.corner === v} onClick={() => set({ corner: v })} className="py-2 px-3 w-auto">
                    <span className="text-sm font-semibold">{l}</span></Choice>
                ))}
              </div>
              <Lbl>Preview</Lbl>
              <MiniPreview S={S} title={title} />
            </div>
          </div>
        )}

        {tab === 'media' && (
          <>
            <Lbl>Cover graphic — shown at the top</Lbl>
            <div className="grid md:grid-cols-2 gap-3 mb-2">
              <div>
                <Drop k="coverImage" sub="PNG, JPG, WEBP, GIF or SVG · up to 4 MB" />
                <input className={`${inS} mt-2`} placeholder="…or paste an image URL" value={S.coverImage}
                       onChange={e => set({ coverImage: e.target.value })} />
              </div>
              <div>
                <div className="mb-2"><ImagePreview src={S.coverImage} /></div>
                <div className="flex flex-wrap gap-2">
                  {[['none', 'Colour bar'], ['banner', 'Banner'], ['cover', 'Full hero'], ['logo', 'Small logo']].map(([v, l]) => (
                    <Choice key={v} on={S.coverStyle === v} onClick={() => set({ coverStyle: v })} className="py-2 px-3 w-auto">
                      <span className="text-sm font-semibold">{l}</span></Choice>
                  ))}
                </div>
                <Remove k="coverImage" />
              </div>
            </div>
            <hr className="my-5 border-slate-100" />
            <Lbl>Footer graphic — shown under the questions</Lbl>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <Drop k="footerImage" sub="A logo, a badge, a sign-off illustration…" />
                <input className={`${inS} mt-2`} placeholder="…or paste an image URL" value={S.footerImage}
                       onChange={e => set({ footerImage: e.target.value })} />
              </div>
              <div>
                <ImagePreview src={S.footerImage} />
                <Remove k="footerImage" />
              </div>
            </div>
          </>
        )}

        {tab === 'end' && (
          <>
            <p className="text-slate-500 text-sm mb-3">What people see the moment they hit submit.</p>
            <div className="grid md:grid-cols-[7fr_5fr] gap-4">
              <div>
                <Lbl>Headline</Lbl>
                <input className={`${inS} mb-3`} maxLength={160} placeholder="Thank you!" value={S.endTitle}
                       onChange={e => set({ endTitle: e.target.value })} />
                <Lbl>Message</Lbl>
                <textarea className={`${inS} mb-3`} rows={4} maxLength={1000} placeholder="Your response has been recorded."
                          value={S.endMessage} onChange={e => set({ endMessage: e.target.value })} />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Lbl>Button label</Lbl>
                    <input className={inS} maxLength={40} placeholder="Visit our site" value={S.endBtnLabel}
                           onChange={e => set({ endBtnLabel: e.target.value })} />
                  </div>
                  <div>
                    <Lbl>Button link</Lbl>
                    <input className={inS} placeholder="https://…" value={S.endBtnUrl}
                           onChange={e => set({ endBtnUrl: e.target.value })} />
                  </div>
                </div>
              </div>
              <div>
                <Lbl>Graphic</Lbl>
                <Drop k="endImage" icon="bi-emoji-smile" />
                <input className={`${inS} mt-2`} placeholder="…or paste an image URL" value={S.endImage}
                       onChange={e => set({ endImage: e.target.value })} />
                <div className="mt-2"><ImagePreview src={S.endImage} h={80} /></div>
                <Remove k="endImage" />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-6 mt-5 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2"><span className="text-sm text-slate-600">Offer “submit another response”</span>
                <Switch on={S.endAgain} onChange={v => set({ endAgain: v })} /></div>
              <div className="flex items-center gap-2"><span className="text-sm text-slate-600">Confetti</span>
                <Switch on={S.endConfetti} onChange={v => set({ endConfetti: v })} /></div>
            </div>
          </>
        )}
      </div>

      <div className="flex justify-end gap-2 px-6 pb-6">
        <button onClick={onPreview} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50">
          <i className="bi bi-eye" /> Preview form
        </button>
        <button onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold">Done</button>
      </div>
      <input type="file" ref={fileRef} accept="image/*" className="hidden" onChange={upload} />
    </Modal>
  );
}
