/* Thin client for public/api/index.php. Paths are relative so the built app
   works from any sub-folder (e.g. public_html/form/). */
const ENDPOINT = 'api/index.php';
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
    throw Object.assign(new Error('Could not reach the server.'), { data: {} });
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

/** A stored image reference (uploads/x.png or https://...) as a usable src. */
export const mediaUrl = v => (!v ? '' : /^https?:/i.test(v) ? v : v.replace(/^\/+/, ''));
