/* Thin client for the API. On Vercel it is the Node function at /api/app;
   anywhere else it is public/api/index.php, addressed relatively so the
   built app works from any sub-folder (e.g. public_html/form/). */
/* global __API__ */
const ENDPOINT = __API__;
let token = null;

async function csrf() {
  if (!token) token = (await request('csrf')).token;
  return token;
}

async function request(action, { params = {}, method = 'GET', json, form } = {}) {
  const qs = new URLSearchParams({ action, ...params });
  const opts = { method, credentials: 'same-origin', headers: {} };
  if (json !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(json);
  } else if (form) {
    opts.body = form;
  }
  if (method === 'POST' && action !== 'submit') opts.headers['X-CSRF'] = await csrf();

  let res, j;
  try {
    res = await fetch(`${ENDPOINT}?${qs}`, opts);
    j = await res.json();
  } catch {
    const hint = location.protocol === 'file:'
      ? ' The app was opened as a file — open it through Apache instead, e.g. http://localhost/form/'
      : ` No API answered at ${new URL(ENDPOINT, location.href).href} — check that Apache and MySQL are running in XAMPP and that the api/ folder sits next to index.html.`;
    throw Object.assign(new Error('Could not reach the server.' + hint), { data: {} });
  }
  if (!j.ok) throw Object.assign(new Error(j.error || 'Request failed'), { data: j, status: res.status });
  return j;
}

export const api = {
  forms:          q => request('forms', { params: q ? { q } : {} }),
  form:           id => request('form', { params: { id } }),
  save:           payload => request('save', { method: 'POST', json: payload }),
  upload:         file => {
    const fd = new FormData();
    fd.append('file', file);
    return request('upload', { method: 'POST', form: fd });
  },
  deleteForm:     id => request('delete_form', { method: 'POST', json: { id } }),
  deleteResponse: (id, response) => request('delete_response', { method: 'POST', json: { id, response } }),
  responses:      (id, page) => request('responses', { params: { id, page } }),
  results:        id => request('results', { params: { id } }),
  publicForm:     (slug, preview, count) =>
    request('public', { params: { slug, preview: preview ? 1 : '', count: count ? 1 : '' } }),
  submit:         form => request('submit', { method: 'POST', form }),
};

export const exportUrl = id => `${ENDPOINT}?action=export&id=${id}`;

/** Public share link for a slug, based on where the app is served. */
export const shareUrl = slug => `${location.origin}${location.pathname}#/f/${slug}`;

/** An uploaded answer file: a Blob URL on Vercel, a name in uploads/ on PHP hosting. */
export const fileUrl = v => (/^https?:/i.test(v) ? v : `uploads/${v}`);

/** A stored image reference (uploads/x.png or https://...) as a usable src. */
export const mediaUrl = v => (!v ? '' : /^https?:/i.test(v) ? v : v.replace(/^\/+/, ''));
