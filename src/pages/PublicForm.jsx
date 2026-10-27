import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { api, mediaUrl } from '../lib/api.js';
import { DEFAULT_SETTINGS, RADII, rgbOf } from '../lib/settings.js';
import './public.css';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[0-9 +()-]{6,20}$/;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function Shell({ icon, title, text }) {
  return (
    <div className="fcp-shell">
      <div className="b">
        <div className="ic"><i className={`bi ${icon}`} /></div>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
    </div>
  );
}

/** Client-side check; the server repeats it on submit. */
function check(f, value, file) {
  if (f.type === 'section') return '';
  const empty = f.type === 'file' || f.type === 'audio' ? !file : Array.isArray(value) ? value.length === 0 : String(value ?? '').trim() === '';
  if (empty) return f.required ? 'This question is required.' : '';
  const v = String(value).trim();
  if (f.type === 'email' && !EMAIL.test(v)) return 'Enter a valid email address.';
  if (f.type === 'number' && (v === '' || isNaN(Number(v)))) return 'Enter a number.';
  if (f.type === 'phone' && !PHONE.test(v)) return 'Enter a valid phone number.';
  return '';
}

const fmtClock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Records the respondent's voice in the browser and hands back a File. */
function AudioRecorder({ name, file, onFile }) {
  const [rec, setRec] = useState(null);       // { recorder, stream }
  const [secs, setSecs] = useState(0);
  const [err, setErr] = useState('');
  const url = useMemo(() => (file ? URL.createObjectURL(file) : ''), [file]);
  useEffect(() => () => url && URL.revokeObjectURL(url), [url]);
  useEffect(() => {
    if (!rec) return;
    const t = setInterval(() => setSecs(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [rec]);

  async function start() {
    setErr('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];
      recorder.ondataavailable = e => e.data.size && chunks.push(e.data);
      recorder.onstop = () => {
        const type = recorder.mimeType || 'audio/webm';
        const ext = type.includes('ogg') ? 'ogg' : type.includes('mp4') ? 'm4a' : 'webm';
        onFile(new File(chunks, `${name}.${ext}`, { type }));
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      setSecs(0);
      setRec({ recorder, stream });
    } catch {
      setErr('Microphone not available. Allow microphone access in the browser and try again.');
    }
  }
  function stop() { rec?.recorder.stop(); setRec(null); }

  return (
    <div className="rec">
      {rec ? (
        <button type="button" className="btn btn-p rec-on" onClick={stop}>
          <i className="bi bi-stop-fill" /> Stop recording · {fmtClock(secs)}
        </button>
      ) : (
        <button type="button" className="btn btn-g" onClick={start}>
          <i className="bi bi-mic-fill" /> {file ? 'Record again' : 'Start recording'}
        </button>
      )}
      {file && !rec && <audio controls src={url} className="rec-play" />}
      {err && <p className="q-err"><i className="bi bi-exclamation-circle" /> {err}</p>}
    </div>
  );
}

function Rating({ max, value, onChange }) {
  const [hover, setHover] = useState(0);
  const shown = hover || +value || 0;
  return (
    <>
      <div className="rate" onMouseLeave={() => setHover(0)}>
        {Array.from({ length: max }, (_, i) => i + 1).map(n => (
          <button type="button" key={n} aria-label={`${n} of ${max}`} className={n <= shown ? 'on' : ''}
                  onMouseEnter={() => setHover(n)} onClick={() => onChange(String(n))}>
            <i className="bi bi-star-fill" />
          </button>
        ))}
      </div>
      <div className="rate-val">{shown ? `${shown} of ${max}` : ''}</div>
    </>
  );
}

function Question({ f, i, value, file, error, onChange, onFile, tf, inputRef }) {
  const id = 'in_' + f.key;
  let body;
  switch (f.type) {
    case 'textarea':
      body = <textarea id={id} ref={inputRef} rows={4} className="in" placeholder={f.placeholder || ''}
                       value={value || ''} onChange={e => onChange(e.target.value)} />;
      break;
    case 'select':
      body = (
        <select id={id} ref={inputRef} className="in" value={value || ''} onChange={e => onChange(e.target.value)}>
          <option value="">Choose an option…</option>
          {(f.options || []).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
      break;
    case 'radio':
    case 'checkbox': {
      const radio = f.type === 'radio';
      const list = Array.isArray(value) ? value : [];
      body = (
        <div className="opts">
          {(f.options || []).map((o, oi) => {
            const on = radio ? value === o : list.includes(o);
            return (
              <label key={oi} className={`opt${on ? ' on' : ''}`} data-t={radio ? 'radio' : 'check'}>
                <input type={radio ? 'radio' : 'checkbox'} name={id} value={o} checked={on}
                       onChange={() => onChange(radio ? o : on ? list.filter(x => x !== o) : [...list, o], radio)} />
                <span className="box"><i className="bi bi-check-lg" /></span>
                <span className="txt">{o}</span>
                {tf && oi < 26 && <span className="kbd">{LETTERS[oi]}</span>}
              </label>
            );
          })}
        </div>
      );
      break;
    }
    case 'audio':
      body = (
        <>
          {f.passage && <div className="passage">{f.passage}</div>}
          <AudioRecorder name={f.key} file={file} onFile={onFile} />
        </>
      );
      break;
    case 'rating':
      body = <Rating max={+f.max || 5} value={value} onChange={onChange} />;
      break;
    case 'file':
      body = (
        <>
          <input type="file" id={id} ref={inputRef} className="in" onChange={e => onFile(e.target.files[0] || null)} />
          {file && <p className="q-help" style={{ color: '#10b981' }}><i className="bi bi-check2-circle" /> {file.name} attached</p>}
        </>
      );
      break;
    default: {
      const t = ['email', 'number', 'date', 'time'].includes(f.type) ? f.type : f.type === 'phone' ? 'tel' : 'text';
      body = <input type={t} id={id} ref={inputRef} className="in" placeholder={f.placeholder || ''}
                    value={value || ''} onChange={e => onChange(e.target.value)} />;
    }
  }

  return (
    <div className={`q${error ? ' err' : ''}`} style={{ '--i': i }}>
      <label className="q-label" htmlFor={id}>
        {f.label || 'Question'}{f.required && <span className="req">*</span>}
      </label>
      {f.help && <p className="q-help">{f.help}</p>}
      <div className="q-body">{body}</div>
      {error && <p className="q-err"><i className="bi bi-exclamation-circle" /> {error}</p>}
    </div>
  );
}

function Section({ f, i, tf }) {
  const Tag = { 2: 'h2', 3: 'h3', 4: 'h4' }[f.level] || 'h2';
  return (
    <div className="sec" style={{ '--i': i }}>
      <Tag>{f.label}</Tag>
      {f.help && <p>{f.help}</p>}
      {!tf && <hr />}
    </div>
  );
}

function Confetti({ colors }) {
  const bits = useMemo(() => Array.from({ length: 70 }, (_, n) => ({
    left: Math.random() * 100 + '%',
    background: colors[n % colors.length],
    '--rot': Math.random() * 900 - 450 + 'deg',
    animationDuration: 2.4 + Math.random() * 2.2 + 's',
    animationDelay: Math.random() * 1.1 + 's',
    opacity: 0.5 + Math.random() * 0.5,
  })), [colors]);
  const [gone, setGone] = useState(false);
  useEffect(() => { const t = setTimeout(() => setGone(true), 7000); return () => clearTimeout(t); }, []);
  if (gone) return null;
  return <div className="confetti">{bits.map((s, i) => <i key={i} style={s} />)}</div>;
}

function Runner({ form, preview, onAgain }) {
  const S = form.settings;
  const fields = form.fields;
  const layout = S.layout;
  const tf = layout === 'typeform';

  /* only the paged layout splits at a "new page" heading */
  const pages = useMemo(() => {
    if (layout !== 'paged') return [fields];
    const out = [[]];
    fields.forEach(f => {
      if (f.type === 'section' && f.newpage && out[out.length - 1].length) out.push([]);
      out[out.length - 1].push(f);
    });
    return out.filter(p => p.length).length ? out.filter(p => p.length) : [[]];
  }, [fields, layout]);

  const [answers, setAnswers] = useState({});
  const [files, setFiles] = useState({});
  const [errors, setErrors] = useState({});
  const [page, setPage] = useState(0);
  const [at, setAt] = useState(0);          // conversational slide
  const [back, setBack] = useState(false);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState('');
  const [done, setDone] = useState(false);
  const focusRef = useRef(null);
  const live = useRef({});

  /* time limit: a warning first, then a countdown that auto-submits */
  const limit = (+S.timeLimit || 0) * 60;
  const startKey = 'fc_start_' + form.slug + (preview ? '_p' : '');
  const [startAt, setStartAt] = useState(() => {
    try { return +sessionStorage.getItem(startKey) || 0; } catch { return 0; }
  });
  const [now, setNow] = useState(Date.now());
  const elapsed = startAt ? Math.floor((now - startAt) / 1000) : 0;
  const left = Math.max(0, limit - elapsed);
  const autoSent = useRef(false);
  function begin() {
    const t = Date.now();
    try { sessionStorage.setItem(startKey, String(t)); } catch { /* private mode */ }
    setStartAt(t); setNow(t);
  }
  useEffect(() => {
    if (!limit || !startAt || done) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [limit, startAt, done]);
  useEffect(() => {
    if (limit && startAt && !done && left === 0 && !autoSent.current) {
      autoSent.current = true;
      live.current.submit(true);
    }
  }, [left, limit, startAt, done]);

  const top = () => window.scrollTo({ top: 0, behavior: S.animate ? 'smooth' : 'auto' });
  const setAnswer = (key, v) => {
    setAnswers(a => ({ ...a, [key]: v }));
    setErrors(e => { const n = { ...e }; delete n[key]; return n; });
  };
  const setFile = (key, file) => {
    setFiles(fs => ({ ...fs, [key]: file }));
    setErrors(e => { const n = { ...e }; delete n[key]; return n; });
  };
  const errorsFor = list => {
    const out = {};
    list.forEach(f => { const m = check(f, answers[f.key], files[f.key]); if (m) out[f.key] = m; });
    return out;
  };
  const pageOf = key => Math.max(0, pages.findIndex(p => p.some(f => f.key === key)));
  const slideOf = key => Math.max(0, fields.findIndex(f => f.key === key));

  function showErrors(errs) {
    setErrors(errs);
    const first = fields.find(f => errs[f.key]);
    if (!first) return;
    if (tf) { setBack(true); setAt(slideOf(first.key)); }
    else { setPage(pageOf(first.key)); top(); }
  }

  async function submit(auto = false) {
    if (!auto) {
      const errs = errorsFor(fields);
      if (Object.keys(errs).length) return showErrors(errs);
    }

    const fd = new FormData();
    fd.append('slug', form.slug);
    if (preview) fd.append('preview', '1');
    fd.append('data', JSON.stringify(answers));
    if (auto) fd.append('auto', '1');
    if (startAt) fd.append('elapsed', String(Math.floor((Date.now() - startAt) / 1000)));
    Object.entries(files).forEach(([k, file]) => file && fd.append('file_' + k, file));

    setSending(true); setFailed('');
    try {
      await api.submit(fd);
      try { sessionStorage.removeItem(startKey); } catch { /* ignore */ }
      setDone(true);
      top();
    } catch (e) {
      if (e.data?.errors) showErrors(e.data.errors);
      else setFailed(e.message);
    }
    setSending(false);
  }

  /* paged / single */
  function next() {
    const errs = errorsFor(pages[page]);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setPage(p => p + 1); top();
  }

  /* conversational */
  function advance() {
    const f = fields[at];
    if (f) {
      const m = check(f, answers[f.key], files[f.key]);
      if (m) { setErrors(e => ({ ...e, [f.key]: m })); return; }
    }
    if (at >= fields.length - 1) { submit(); return; }
    setBack(false); setAt(at + 1);
  }
  const goBack = () => { if (at > 0) { setBack(true); setAt(at - 1); } };
  live.current = { advance, goBack, at, submit };

  useEffect(() => {
    if (!tf || done) return;
    const onKey = ev => {
      const t = ev.target;
      if (ev.key === 'Enter' && !ev.shiftKey) {
        if (t?.tagName === 'TEXTAREA' || t?.tagName === 'BUTTON' || t?.tagName === 'A') return;
        ev.preventDefault(); live.current.advance();
      } else if (ev.key === 'Escape') {
        live.current.goBack();
      } else if (/^[a-zA-Z]$/.test(ev.key) && !/INPUT|TEXTAREA|SELECT/.test(t?.tagName || '')) {
        const f = fields[live.current.at];
        const idx = ev.key.toUpperCase().charCodeAt(0) - 65;
        if (f && (f.type === 'radio' || f.type === 'checkbox') && f.options?.[idx] !== undefined) {
          document.querySelectorAll('.fcp .slide .opt input')[idx]?.click();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [tf, done, fields]);

  useEffect(() => {
    if (!tf) return;
    const el = focusRef.current;
    if (el && !/radio|checkbox|file/.test(el.type)) {
      const t = setTimeout(() => el.focus(), 260);
      return () => clearTimeout(t);
    }
  }, [at, tf]);

  const cover = mediaUrl(S.coverImage), foot = mediaUrl(S.footerImage), endImg = mediaUrl(S.endImage);
  const colors = useMemo(() => [S.primary, S.secondary, '#fbbf24', '#34d399'], [S.primary, S.secondary]);
  const errCount = Object.keys(errors).length;
  const pageCount = pages.length;
  const isLast = page >= pageCount - 1;
  const percent = pageCount > 1 ? Math.round(((page + 1) / pageCount) * 100) : 100;
  const qTotal = fields.filter(f => f.type !== 'section').length;

  const style = {
    '--p': S.primary, '--s': S.secondary, '--p-rgb': rgbOf(S.primary), '--s-rgb': rgbOf(S.secondary), '--r': RADII[S.corner],
  };
  const cls = `fcp${tf && !done ? ' tf' : ''}${S.animate ? '' : ' no-anim'}`;

  const previewBanner = preview && <div className="alert alert-i"><i className="bi bi-eye" /> Preview mode — nothing is saved.</div>;

  if (done) {
    return (
      <div className={cls} data-surface={S.surface} style={style}>
        <div className="wash" />
        <div className="wrap">
          {previewBanner}
          <div className="card end">
            {endImg ? <img className="art" src={endImg} alt="" /> : <div className="tick"><i className="bi bi-check2" /></div>}
            <h1>{S.endTitle || 'Thank you!'}</h1>
            <p className="msg">{S.endMessage || 'Your response has been recorded.'}</p>
            <div className="acts">
              {S.endBtnLabel && S.endBtnUrl && (
                <a className="btn btn-p" href={S.endBtnUrl} target="_blank" rel="noopener noreferrer">
                  {S.endBtnLabel} <i className="bi bi-arrow-right" />
                </a>
              )}
              {S.endAgain && (
                <button type="button" className="btn btn-g" onClick={onAgain}>
                  <i className="bi bi-arrow-repeat" /> Submit another response
                </button>
              )}
            </div>
            {foot && <img className="footer-art" src={foot} alt="" />}
          </div>
        </div>
        {S.endConfetti && S.animate && <Confetti colors={colors} />}
      </div>
    );
  }

  if (limit && !startAt) {
    return (
      <div className={`fcp${S.animate ? '' : ' no-anim'}`} data-surface={S.surface} style={style}>
        <div className="wash" />
        <div className="wrap">
          {previewBanner}
          <div className="card end">
            <div className="tick"><i className="bi bi-stopwatch" /></div>
            <h1>{form.title}</h1>
            {form.description && <p className="msg">{form.description}</p>}
            <div className="alert alert-i" style={{ marginTop: 26, textAlign: 'left' }}>
              <i className="bi bi-exclamation-triangle" />
              <span>You have a maximum of <b>{S.timeLimit} minutes</b>. The timer starts when you press Start and
                the form is <b>submitted automatically</b> when the time is up.</span>
            </div>
            <div className="acts">
              <button type="button" className="btn btn-p" onClick={begin}>
                Start ({S.timeLimit} min) <i className="bi bi-play-fill" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const timer = limit > 0 && (
    <div className={`timer${left <= 60 ? ' low' : ''}`} title="Time left">
      <i className="bi bi-stopwatch" /> {fmtClock(left)}
    </div>
  );

  const renderField = (f, i, isTf) => f.type === 'section'
    ? <Section key={f.key} f={f} i={i} tf={isTf} />
    : <Question key={f.key} f={f} i={i} tf={isTf} value={answers[f.key]} file={files[f.key]} error={errors[f.key]}
                inputRef={isTf ? focusRef : undefined}
                onChange={(v, isRadio) => { setAnswer(f.key, v); if (isTf && isRadio) setTimeout(() => live.current.advance(), 320); }}
                onFile={file => setFile(f.key, file)} />;

  /* ── conversational ───────────────────────── */
  if (tf) {
    const f = fields[at];
    const last = at >= fields.length - 1;
    const num = fields.slice(0, at + 1).filter(x => x.type !== 'section').length;
    return (
      <div className={cls} data-surface={S.surface} style={style}>
        <div className="wash" />
        {timer}
        {S.progress && <div className="prog"><i style={{ width: fields.length ? ((at + 1) / fields.length) * 100 + '%' : '100%' }} /></div>}
        <div className="wrap">
          {previewBanner}
          {failed && <div className="alert alert-e"><i className="bi bi-exclamation-triangle" /> {failed}</div>}
          {!f ? (
            <div className="card pad" style={{ textAlign: 'center', color: 'var(--muted)' }}>This form has no questions yet.</div>
          ) : (
            <div className={`slide${back ? ' back' : ''}`} key={f.key}>
              {f.type !== 'section' && <div className="counter"><i className="bi bi-arrow-right-short" /> {num} → {qTotal}</div>}
              {renderField(f, 0, true)}
            </div>
          )}
        </div>
        {f && (
          <div className="tf-bottom">
            <button type="button" className="btn btn-g" onClick={goBack} style={{ visibility: at === 0 ? 'hidden' : 'visible' }}>
              <i className="bi bi-arrow-up" />
            </button>
            <button type="button" className="btn btn-p" onClick={advance} disabled={sending}>
              {sending ? <><i className="bi bi-arrow-repeat" /> Sending…</>
                : last ? <>{S.submitLabel} <i className="bi bi-send" /></> : <>Next <i className="bi bi-arrow-right" /></>}
            </button>
            <span className="kbdhint muted" style={{ marginLeft: 6 }}>press <b>Enter</b> ↵</span>
          </div>
        )}
      </div>
    );
  }

  /* ── paged / single page ───────────────────── */
  return (
    <div className={cls} data-surface={S.surface} style={style}>
      <div className="wash" />
      {timer}
      {S.progress && pageCount > 1 && <div className="prog"><i style={{ width: percent + '%' }} /></div>}
      <div className="wrap">
        {previewBanner}

        {cover && S.coverStyle === 'cover' ? (
          <div className="hero">
            <img src={cover} alt="" />
            <div className="veil" />
            <div className="txt">
              <h1>{form.title}</h1>
              {form.description && <p>{form.description}</p>}
            </div>
          </div>
        ) : (
          <div className="card" style={{ marginBottom: 18 }}>
            {cover && S.coverStyle === 'banner' ? <img className="cover-banner" src={cover} alt="" />
              : S.coverStyle !== 'none' && <div className="accentbar" />}
            <div className="pad">
              {cover && S.coverStyle === 'logo' && <img className="cover-logo" src={cover} alt="" />}
              <h1 className="f-title">{form.title}</h1>
              {form.description && <p className="f-desc">{form.description}</p>}
            </div>
          </div>
        )}

        {pageCount > 1 && (
          <div className="steps" key={'s' + page}>
            <span>Step {page + 1} of {pageCount}</span>
            {pages.map((_, i) => <span key={i} className={`dot ${i === page ? 'on' : i < page ? 'done' : ''}`} />)}
            <span style={{ marginLeft: 'auto' }}>{percent}%</span>
          </div>
        )}

        {errCount > 0 && (
          <div className="alert alert-e">
            <i className="bi bi-exclamation-triangle" /> Please check {errCount} {errCount === 1 ? 'answer' : 'answers'} below.
          </div>
        )}
        {failed && <div className="alert alert-e"><i className="bi bi-exclamation-triangle" /> {failed}</div>}

        <form noValidate key={'p' + page} onSubmit={e => { e.preventDefault(); isLast ? submit() : next(); }}>
          {pages[page].map((f, i) => renderField(f, i + 1, false))}

          {!fields.length && (
            <div className="card pad" style={{ textAlign: 'center', color: 'var(--muted)' }}>This form has no questions yet.</div>
          )}

          <div className="nav">
            {page > 0 && (
              <button type="button" className="btn btn-g" onClick={() => { setPage(p => p - 1); top(); }}>
                <i className="bi bi-arrow-left" /> Back
              </button>
            )}
            <button type="submit" className="btn btn-p grow" disabled={sending}>
              {sending ? <><i className="bi bi-arrow-repeat" /> Sending…</>
                : isLast ? <>{S.submitLabel} <i className="bi bi-send" /></> : <>Next <i className="bi bi-arrow-right" /></>}
            </button>
          </div>

          <p className="hint">
            {pageCount > 1 ? 'Your answers are kept as you move between steps. ' : ''}Never submit passwords through this form.
          </p>
        </form>

        {foot && <img className="footer-art" src={foot} alt="" />}
      </div>
    </div>
  );
}

export default function PublicForm() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const preview = !!params.get('preview');
  const [state, setState] = useState({ loading: true });
  const [run, setRun] = useState(0);
  const counted = useRef(false);

  useEffect(() => {
    const count = !counted.current;
    counted.current = true;
    api.publicForm(slug, preview, count)
      .then(j => {
        const form = { ...j.form, settings: { ...DEFAULT_SETTINGS, ...j.form.settings } };
        setState({ form });
        document.title = form.title;
      })
      .catch(e => setState({ blocked: e.data?.state || 'error', message: e.message }));
  }, [slug, preview]);

  useEffect(() => {
    const bg = state.form ? (state.form.settings.surface === 'dark' ? '#0a0e18' : '#f4f6fb') : '#f1f5f9';
    document.body.style.background = bg;
    return () => { document.body.style.background = ''; };
  }, [state.form]);

  if (state.loading) return <div className="fcp-shell" />;
  if (state.blocked === 'missing') return <Shell icon="bi-question-circle" title="Form not found" text="This link is wrong or the form was deleted." />;
  if (state.blocked === 'closed') return <Shell icon="bi-lock" title="This form is closed" text="The owner has stopped collecting responses." />;
  if (state.blocked === 'draft') return <Shell icon="bi-hourglass-split" title="Not accepting responses yet" text="The owner has not published this form yet." />;
  if (state.blocked) return <Shell icon="bi-exclamation-triangle" title="Something went wrong" text={state.message} />;

  return <Runner key={run} form={state.form} preview={preview} onAgain={() => { setRun(r => r + 1); window.scrollTo(0, 0); }} />;
}
