import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, exportUrl } from '../lib/api.js';

const fmt = s => new Date(s.replace(' ', 'T')).toLocaleString('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});
const mmss = s => `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);

/**
 * Split the schema into what the results page needs:
 *  - info:   plain questions (name, email, …) shown as columns
 *  - groups: scored questions, grouped under the section heading above them
 *  - audio:  voice-reading questions
 */
function analyse(fields) {
  const info = [], audio = [], groups = [];
  let heading = 'Quiz';
  for (const f of fields) {
    if (f.type === 'section') { heading = f.label || 'Section'; continue; }
    if (f.type === 'audio') { audio.push(f); continue; }
    if (f.correct !== undefined) {
      let g = groups[groups.length - 1];
      if (!g || g.name !== heading) groups.push(g = { name: heading, questions: [] });
      g.questions.push(f);
      continue;
    }
    info.push(f);
  }
  return { info, audio, groups, total: groups.reduce((n, g) => n + g.questions.length, 0) };
}

function scoreRow(row, groups) {
  const per = groups.map(g => g.questions.filter(q => row.data[q.key]?.value === q.correct).length);
  return { per, total: per.reduce((a, b) => a + b, 0) };
}

function Bar({ value, color = 'bg-indigo-500' }) {
  return (
    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: value + '%' }} />
    </div>
  );
}

const tone = p => (p >= 70 ? 'text-emerald-600' : p >= 40 ? 'text-amber-600' : 'text-rose-600');
const toneBg = p => (p >= 70 ? 'bg-emerald-500' : p >= 40 ? 'bg-amber-500' : 'bg-rose-500');

export default function Results() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('score');

  useEffect(() => {
    api.results(id).then(j => { setData(j); document.title = 'Results · ' + j.form.title; })
      .catch(e => setError(e.message));
  }, [id]);

  const model = useMemo(() => (data ? analyse(data.fields) : null), [data]);

  const rows = useMemo(() => {
    if (!data) return [];
    const list = data.rows.map(r => ({ ...r, score: scoreRow(r, model.groups) }));
    const needle = q.trim().toLowerCase();
    const hit = r => !needle || model.info.some(f => String(r.data[f.key]?.value ?? '').toLowerCase().includes(needle));
    const sorted = list.filter(hit);
    if (sort === 'score') sorted.sort((a, b) => b.score.total - a.score.total || b.id - a.id);
    return sorted;
  }, [data, model, q, sort]);

  if (error) return <div className="max-w-7xl mx-auto px-6 py-10 text-rose-600">{error}</div>;
  if (!data) return <div className="max-w-7xl mx-auto px-6 py-10 text-slate-400">Loading…</div>;

  const { form } = data;
  const { info, audio, groups, total } = model;
  const all = data.rows.map(r => scoreRow(r, groups));
  const n = all.length;
  const avg = n ? all.reduce((s, x) => s + x.total, 0) / n : 0;
  const best = n ? Math.max(...all.map(x => x.total)) : 0;
  const autoCount = data.rows.filter(r => r.data._meta?.auto).length;
  const times = data.rows.map(r => r.data._meta?.elapsed).filter(Boolean);
  const avgTime = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

  /* answer distribution per field, for the field-wise section */
  const dist = f => {
    const counts = {};
    data.rows.forEach(r => {
      const v = r.data[f.key]?.value;
      (Array.isArray(v) ? v : [v]).forEach(x => { if (x !== undefined && x !== '') counts[x] = (counts[x] || 0) + 1; });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  };
  const infoForDist = info.filter(f => ['select', 'radio', 'checkbox', 'text'].includes(f.type) && /dep|desig/i.test(f.label + f.key));

  const tiles = [
    ['Candidates', n, 'bi-people-fill', 'text-indigo-600'],
    ['Average score', total ? `${avg.toFixed(1)} / ${total}` : '—', 'bi-graph-up', 'text-violet-600'],
    ['Top score', total ? `${best} / ${total}` : '—', 'bi-trophy-fill', 'text-amber-600'],
    ['Avg. time taken', avgTime ? mmss(avgTime) : '—', 'bi-stopwatch', 'text-sky-600'],
    ['Auto-submitted', autoCount, 'bi-alarm', 'text-rose-600'],
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Link to="/" className="text-slate-400 hover:text-slate-700 text-lg"><i className="bi bi-arrow-left" /></Link>
        <div className="flex-1 min-w-[200px]">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{form.title}</h1>
          <p className="text-sm text-slate-500">Results dashboard · {n} submissions · {form.views} views</p>
        </div>
        <Link to={`/responses/${form.id}`} className="text-sm font-semibold px-3.5 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700">
          <i className="bi bi-table" /> Raw responses
        </Link>
        <a href={exportUrl(form.id)} className="text-sm font-semibold px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800">
          <i className="bi bi-download" /> Export CSV
        </a>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {tiles.map(([label, val, icon, color]) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-5">
            <div className={`flex items-center gap-2 ${color} mb-2`}>
              <i className={`bi ${icon}`} />
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
            </div>
            <div className="text-2xl font-extrabold text-slate-900">{val}</div>
          </div>
        ))}
      </div>

      {!n ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-16 text-center">
          <div className="text-4xl text-slate-300 mb-3"><i className="bi bi-bar-chart" /></div>
          <h2 className="text-lg font-bold text-slate-800">No results yet</h2>
          <p className="text-slate-500 text-sm">Share the test link; scores show up here as candidates submit.</p>
        </div>
      ) : (
        <>
          {/* section averages */}
          {groups.length > 0 && (
            <div className="grid md:grid-cols-2 gap-4 mb-8">
              {groups.map((g, gi) => {
                const sum = all.reduce((s, x) => s + x.per[gi], 0);
                const p = pct(sum, n * g.questions.length);
                return (
                  <div key={g.name} className="bg-white rounded-2xl border border-slate-200 p-5">
                    <div className="flex items-center justify-between mb-1">
                      <h2 className="font-bold text-slate-900">{g.name}</h2>
                      <span className={`text-sm font-bold ${tone(p)}`}>{p}% avg</span>
                    </div>
                    <p className="text-xs text-slate-500 mb-4">{g.questions.length} questions · average {(sum / n).toFixed(1)} correct</p>
                    <div className="space-y-2.5">
                      {g.questions.map((qq, qi) => {
                        const right = data.rows.filter(r => r.data[qq.key]?.value === qq.correct).length;
                        const qp = pct(right, n);
                        return (
                          <div key={qq.key} title={qq.label}>
                            <div className="flex items-center justify-between text-xs mb-1 gap-3">
                              <span className="text-slate-600 truncate"><b className="text-slate-400">Q{qi + 1}</b> {qq.label}</span>
                              <span className={`font-semibold shrink-0 ${tone(qp)}`}>{right}/{n}</span>
                            </div>
                            <Bar value={qp} color={toneBg(qp)} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* field-wise breakdown (department, designation …) */}
          {infoForDist.length > 0 && (
            <div className="grid md:grid-cols-2 gap-4 mb-8">
              {infoForDist.map(f => {
                const d = dist(f);
                return (
                  <div key={f.key} className="bg-white rounded-2xl border border-slate-200 p-5">
                    <h2 className="font-bold text-slate-900 mb-3">By {f.label}</h2>
                    <div className="space-y-2">
                      {d.slice(0, 8).map(([v, c]) => {
                        const sc = data.rows.filter(r => String(r.data[f.key]?.value ?? '') === v).map(r => scoreRow(r, groups).total);
                        const a = sc.reduce((x, y) => x + y, 0) / (sc.length || 1);
                        return (
                          <div key={v}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-slate-600 truncate">{v}</span>
                              <span className="text-slate-500 shrink-0">{c} · avg {a.toFixed(1)}{total ? `/${total}` : ''}</span>
                            </div>
                            <Bar value={pct(c, n)} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* candidates */}
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 flex-1">Candidates</h2>
            <div className="relative">
              <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, email, dept…"
                     className="pl-9 pr-3 py-2 w-64 rounded-lg border border-slate-300 text-sm" />
            </div>
            <select value={sort} onChange={e => setSort(e.target.value)} className="py-2 px-3 rounded-lg border border-slate-300 text-sm">
              <option value="score">Highest score first</option>
              <option value="new">Newest first</option>
            </select>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto fc-scroll">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3" />
                    {info.map(f => <th key={f.key} className="text-left font-semibold text-slate-500 px-4 py-3 whitespace-nowrap">{f.label}</th>)}
                    {groups.map(g => <th key={g.name} className="text-left font-semibold text-slate-500 px-4 py-3 whitespace-nowrap">{g.name}</th>)}
                    {total > 0 && <th className="text-left font-semibold text-slate-500 px-4 py-3 whitespace-nowrap">Total</th>}
                    {audio.map(f => <th key={f.key} className="text-left font-semibold text-slate-500 px-4 py-3 whitespace-nowrap">{f.label}</th>)}
                    <th className="text-left font-semibold text-slate-500 px-4 py-3 whitespace-nowrap">Time</th>
                    <th className="text-left font-semibold text-slate-500 px-4 py-3 whitespace-nowrap">Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map(r => {
                    const tp = pct(r.score.total, total);
                    const meta = r.data._meta || {};
                    const isOpen = open === r.id;
                    return (
                      <Fragment key={r.id}>
                        <tr className="hover:bg-slate-50/70 align-middle cursor-pointer" onClick={() => setOpen(isOpen ? null : r.id)}>
                          <td className="px-4 py-3 text-slate-400"><i className={`bi ${isOpen ? 'bi-chevron-down' : 'bi-chevron-right'}`} /></td>
                          {info.map(f => (
                            <td key={f.key} className="px-4 py-3 text-slate-700 whitespace-nowrap max-w-[220px] truncate">
                              {String(r.data[f.key]?.value ?? '') || <span className="text-slate-300">—</span>}
                            </td>
                          ))}
                          {groups.map((g, gi) => (
                            <td key={g.name} className="px-4 py-3 whitespace-nowrap font-semibold text-slate-700">{r.score.per[gi]} / {g.questions.length}</td>
                          ))}
                          {total > 0 && (
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`font-extrabold ${tone(tp)}`}>{r.score.total} / {total}</span>
                              <span className="text-xs text-slate-400 ms-1">({tp}%)</span>
                            </td>
                          )}
                          {audio.map(f => {
                            const v = r.data[f.key]?.value;
                            return (
                              <td key={f.key} className="px-4 py-3" onClick={e => e.stopPropagation()}>
                                {v ? <audio controls preload="none" src={`uploads/${v}`} className="h-9 w-56" />
                                   : <span className="text-slate-300">No recording</span>}
                              </td>
                            );
                          })}
                          <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                            {meta.elapsed ? mmss(meta.elapsed) : '—'}
                            {meta.auto && <span className="ms-2 text-[10px] font-bold uppercase bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded">auto</span>}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-slate-500">{fmt(r.created_at)}</td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-slate-50/60">
                            <td colSpan={99} className="px-6 py-5">
                              <div className="grid md:grid-cols-2 gap-6">
                                {groups.map(g => (
                                  <div key={g.name}>
                                    <h3 className="font-bold text-slate-800 mb-2">{g.name}</h3>
                                    <ol className="space-y-1.5">
                                      {g.questions.map((qq, qi) => {
                                        const given = r.data[qq.key]?.value;
                                        const ok = given === qq.correct;
                                        return (
                                          <li key={qq.key} className="text-xs flex gap-2">
                                            <i className={`bi ${ok ? 'bi-check-circle-fill text-emerald-500' : given ? 'bi-x-circle-fill text-rose-500' : 'bi-dash-circle text-slate-300'} mt-0.5`} />
                                            <span className="text-slate-600">
                                              <b>Q{qi + 1}.</b> {qq.label}<br />
                                              <span className={ok ? 'text-emerald-700' : 'text-rose-600'}>{given || 'Not answered'}</span>
                                              {!ok && <span className="text-slate-400"> · correct: {qq.correct}</span>}
                                            </span>
                                          </li>
                                        );
                                      })}
                                    </ol>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
