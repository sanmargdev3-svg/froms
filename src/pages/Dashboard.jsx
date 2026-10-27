import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, exportUrl, shareUrl } from '../lib/api.js';
import CopyButton from '../components/CopyButton.jsx';

const META = {
  published: ['Published', 'bi-broadcast',     'bg-emerald-50 text-emerald-700'],
  draft:     ['Draft',     'bi-pencil-square', 'bg-slate-100 text-slate-600'],
  closed:    ['Closed',    'bi-lock',          'bg-rose-50 text-rose-700'],
};

const fmtDate = s => new Date(s.replace(' ', 'T')).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

function RowMenu({ form, onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = e => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const item = 'flex items-center gap-2 w-full text-left px-3 py-2 text-sm hover:bg-slate-50';
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
              className="w-8 h-8 rounded-lg grid place-items-center text-slate-400 hover:bg-slate-100 hover:text-slate-700">
        <i className="bi bi-three-dots-vertical" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-20">
          <a className={`${item} text-slate-700`} href={shareUrl(form.slug)} target="_blank" rel="noreferrer">
            <i className="bi bi-box-arrow-up-right" />Open form
          </a>
          <a className={`${item} text-slate-700`} href={exportUrl(form.id)}><i className="bi bi-download" />Export CSV</a>
          <hr className="my-1 border-slate-100" />
          <button className={`${item} text-rose-600`} onClick={() => { setOpen(false); onDelete(form); }}>
            <i className="bi bi-trash" />Delete
          </button>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [q, setQ] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = query => api.forms(query).then(setData).catch(e => setError(e.message));

  useEffect(() => {
    document.title = 'Dashboard · FormCraft';
    const t = setTimeout(() => load(q.trim()), q ? 250 : 0);
    return () => clearTimeout(t);
  }, [q]);

  async function remove(form) {
    if (!confirm('Delete this form and all its responses?')) return;
    try { await api.deleteForm(form.id); load(q.trim()); } catch (e) { alert(e.message); }
  }

  const forms = data?.forms || [];
  const stats = data?.stats || {};
  const groups = { published: [], draft: [], closed: [] };
  forms.forEach(f => groups[f.status]?.push(f));

  const tiles = [
    ['Total forms', stats.forms,     'bi-collection', 'text-indigo-600'],
    ['Published',   stats.live,      'bi-broadcast',  'text-emerald-600'],
    ['Responses',   stats.responses, 'bi-inbox-fill', 'text-violet-600'],
    ['Form views',  stats.views,     'bi-eye-fill',   'text-amber-600'],
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Your forms</h1>
          <p className="text-slate-500 mt-1">Build it, share the link, watch the answers roll in.</p>
        </div>
        <div className="relative">
          <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search forms"
                 className="pl-9 pr-3 py-2.5 w-64 rounded-lg border border-slate-300 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl p-4 mb-6">
          <strong>Could not load forms:</strong> {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {tiles.map(([label, val, icon, color]) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-5">
            <div className={`flex items-center gap-2 ${color} mb-2`}>
              <i className={`bi ${icon}`} />
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
            </div>
            <div className="text-2xl font-extrabold text-slate-900">{(val || 0).toLocaleString()}</div>
          </div>
        ))}
      </div>

      {data && !forms.length ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-16 text-center">
          <div className="text-4xl text-slate-300 mb-3"><i className="bi bi-file-earmark-plus" /></div>
          <h2 className="text-lg font-bold text-slate-800">{q ? 'Nothing matches that search' : 'No forms yet'}</h2>
          <p className="text-slate-500 text-sm mb-5">
            {q ? 'Try a different word, or start a new form.' : 'Create your first form — drag in questions, publish, share the link.'}
          </p>
          <Link to="/builder" className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-lg">
            <i className="bi bi-plus-lg" /> Create a form
          </Link>
        </div>
      ) : (
        Object.entries(groups).map(([status, rows]) => {
          if (!rows.length) return null;
          const [gLabel, gIcon, gBadge] = META[status];
          return (
            <section key={status} className="mb-9">
              <div className="flex items-center gap-2 mb-3">
                <i className={`bi ${gIcon} text-slate-400`} />
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">{gLabel}</h2>
                <span className="text-xs font-semibold text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">{rows.length}</span>
              </div>
              <div className="space-y-2">
                {rows.map(f => (
                  <div key={f.id} className="group bg-white rounded-xl border border-slate-200 flex items-stretch transition hover:border-slate-300 hover:shadow-[0_8px_22px_-18px_rgba(15,23,42,.5)]">
                    <span style={{ width: 5, background: f.accent }} className="shrink-0 rounded-l-xl" />
                    <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                      <Link to={`/builder/${f.id}`} className="min-w-0 flex-1 basis-[220px]">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 truncate group-hover:text-indigo-600">{f.title}</span>
                          <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${gBadge}`}>{gLabel}</span>
                        </div>
                        <div className="text-xs text-slate-500 truncate mt-0.5">{f.description || 'No description'}</div>
                      </Link>
                      <div className="flex items-center gap-4 text-xs text-slate-500 shrink-0">
                        <span title="Questions"><i className="bi bi-list-ul me-1" />{f.questions}</span>
                        <span title="Responses"><i className="bi bi-inbox me-1" />{f.responses}</span>
                        <span title="Views" className="hidden sm:inline"><i className="bi bi-eye me-1" />{f.views}</span>
                        <span className="hidden md:inline text-slate-400">{fmtDate(f.updated_at)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ms-auto">
                        <CopyButton text={shareUrl(f.slug)} title="Copy share link"
                                    className="w-8 h-8 rounded-lg grid place-items-center text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                          <i className="bi bi-link-45deg" />
                        </CopyButton>
                        <Link to={`/builder/${f.id}`} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">Edit</Link>
                        <Link to={`/results/${f.id}`} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">Results</Link>
                        <Link to={`/responses/${f.id}`} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800">Data</Link>
                        <RowMenu form={f} onDelete={remove} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
