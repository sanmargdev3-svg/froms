import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, exportUrl, fileUrl, shareUrl } from '../lib/api.js';

/** One stored answer as plain text. */
function answerText(a) {
  if (a == null || typeof a !== 'object') return a == null ? '' : String(a);
  const v = a.value ?? '';
  if (Array.isArray(v)) return v.join(', ');
  if ((a.type === 'file' || a.type === 'audio') && v !== '') return String(a.original || v);
  return String(v);
}

const fmt = s => new Date(s.replace(' ', 'T')).toLocaleString('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

export default function Responses() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const page = +(params.get('page') || 1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = () => api.responses(id, page).then(j => {
    setData(j);
    document.title = 'Responses · ' + j.form.title;
  }).catch(e => setError(e.message));

  useEffect(() => { load(); }, [id, page]);

  async function remove(rid) {
    if (!confirm('Delete this response?')) return;
    try { await api.deleteResponse(+id, rid); load(); } catch (e) { alert(e.message); }
  }

  if (error) return <div className="max-w-7xl mx-auto px-6 py-10 text-rose-600">{error}</div>;
  if (!data) return <div className="max-w-7xl mx-auto px-6 py-10 text-slate-400">Loading…</div>;

  const { form, fields, rows, total, pages } = data;
  const btn = 'text-sm font-semibold px-3.5 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 inline-flex items-center gap-1.5';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Link to="/" className="text-slate-400 hover:text-slate-700 text-lg"><i className="bi bi-arrow-left" /></Link>
        <div className="flex-1 min-w-[200px]">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{form.title}</h1>
          <p className="text-sm text-slate-500">{total.toLocaleString()} responses · {form.views.toLocaleString()} views</p>
        </div>
        <Link to={`/results/${form.id}`} className={`${btn} text-slate-700`}><i className="bi bi-bar-chart" /> Results</Link>
        <Link to={`/builder/${form.id}`} className={`${btn} text-slate-700`}><i className="bi bi-pencil" /> Edit form</Link>
        <a href={shareUrl(form.slug)} target="_blank" rel="noreferrer" className={`${btn} text-slate-700`}><i className="bi bi-box-arrow-up-right" /> Open</a>
        <a href={exportUrl(form.id)} className="text-sm font-semibold px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 inline-flex items-center gap-1.5">
          <i className="bi bi-download" /> Export CSV
        </a>
      </div>

      {!rows.length ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-16 text-center">
          <div className="text-4xl text-slate-300 mb-3"><i className="bi bi-inbox" /></div>
          <h2 className="text-lg font-bold text-slate-800">No responses yet</h2>
          <p className="text-slate-500 text-sm">Share the link and answers will show up here.</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto fc-scroll">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left font-semibold text-slate-500 px-4 py-3 whitespace-nowrap">#</th>
                    <th className="text-left font-semibold text-slate-500 px-4 py-3 whitespace-nowrap">Submitted</th>
                    {fields.map(f => (
                      <th key={f.key} className="text-left font-semibold text-slate-500 px-4 py-3 whitespace-nowrap">{f.label}</th>
                    ))}
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50/70 align-top">
                      <td className="px-4 py-3 text-slate-400">{r.id}</td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{fmt(r.created_at)}</td>
                      {fields.map(f => {
                        const a = r.data[f.key];
                        const txt = a ? answerText(a) : '';
                        return (
                          <td key={f.key} className="px-4 py-3 text-slate-700 max-w-[260px]">
                            {a && a.type === 'audio' && a.value ? (
                              <audio controls preload="none" src={fileUrl(a.value)} className="h-9 w-56" />
                            ) : a && a.type === 'file' && a.value ? (
                              <a href={fileUrl(a.value)} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                                <i className="bi bi-paperclip" /> {txt}
                              </a>
                            ) : (
                              <span className="line-clamp-3">{txt === '' ? <span className="text-slate-300">—</span> : txt}</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button onClick={() => remove(r.id)} className="text-slate-300 hover:text-rose-600" title="Delete response">
                          <i className="bi bi-trash" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-center gap-1 mt-6 flex-wrap">
              {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setParams({ page: p })}
                        className={`px-3.5 py-2 rounded-lg text-sm font-semibold ${p === data.page
                          ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  {p}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
