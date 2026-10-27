/* Vercel serverless API - same actions and JSON shapes as public/api/index.php.
   Data lives in Postgres (Neon), uploaded images and recordings in Vercel Blob. */
import crypto from 'node:crypto';
import Busboy from 'busboy';
import { put } from '@vercel/blob';
import { q } from '../server/db.js';
import { cleanFields, cleanSettings, formSettings, questionsOf, shortSlug } from '../server/settings.js';

const MAX_UPLOAD = 4 * 1024 * 1024;           // Vercel caps a request body at 4.5 MB
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[0-9 +()-]{6,20}$/;

class HttpError extends Error {
  constructor(status, message, extra = {}) { super(message); this.status = status; this.extra = extra; }
}

function send(res, code, data) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

function rawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** Multipart form -> { fields, files: { name: { filename, mimeType, buffer } } } */
function multipart(req, buf) {
  return new Promise((resolve, reject) => {
    const out = { fields: {}, files: {} };
    const bb = Busboy({ headers: req.headers, limits: { fileSize: MAX_UPLOAD } });
    bb.on('field', (name, val) => { out.fields[name] = val; });
    bb.on('file', (name, stream, info) => {
      const chunks = [];
      stream.on('data', c => chunks.push(c));
      stream.on('limit', () => { out.files[name] = { tooBig: true }; });
      stream.on('end', () => {
        if (!out.files[name]?.tooBig) out.files[name] = { filename: info.filename, mimeType: info.mimeType, buffer: Buffer.concat(chunks) };
      });
    });
    bb.on('finish', () => resolve(out));
    bb.on('error', reject);
    bb.end(buf);
  });
}

function cookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map(c => c.trim().split('=')).filter(p => p[0]));
}

/* Double-submit CSRF: the token lives in a SameSite=Strict cookie and must be
   echoed back in the X-CSRF header on every admin write. */
function requireCsrf(req) {
  const c = cookies(req).fc_csrf;
  const h = req.headers['x-csrf'];
  if (!c || !h || c.length !== h.length || !crypto.timingSafeEqual(Buffer.from(c), Buffer.from(h))) {
    throw new HttpError(403, 'Session expired, reload the page.');
  }
}

async function findForm(id) {
  const [form] = await q('SELECT * FROM forms WHERE id = $1', [parseInt(id, 10) || 0]);
  if (!form) throw new HttpError(404, 'Form not found.');
  return form;
}

const ts = d => (d instanceof Date ? d.toISOString() : String(d));
const dateStamp = () => new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15);

async function storeFile(prefix, file) {
  const ext = (file.filename.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
  const blob = await put(`uploads/${prefix}${dateStamp()}_${shortSlug(6)}${ext ? '.' + ext : ''}`, file.buffer, {
    access: 'public', contentType: file.mimeType || 'application/octet-stream',
  });
  return blob.url;
}

const csvCell = v => {
  const s = String(v ?? '');
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://x');
  const action = url.searchParams.get('action') || '';
  const get = k => url.searchParams.get(k) || '';
  const post = req.method === 'POST';
  const needPost = () => { if (!post) throw new HttpError(405, 'Use POST.'); };

  try {
    const buf = post ? await rawBody(req) : Buffer.alloc(0);
    const isMultipart = /multipart\/form-data/i.test(req.headers['content-type'] || '');
    const json = () => { try { return JSON.parse(buf.toString('utf8') || '{}'); } catch { return {}; } };

    switch (action) {
      case 'csrf': {
        let token = cookies(req).fc_csrf;
        if (!token || !/^[a-f0-9]{32}$/.test(token)) {
          token = crypto.randomBytes(16).toString('hex');
          res.setHeader('Set-Cookie', `fc_csrf=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`);
        }
        return send(res, 200, { ok: true, token });
      }

      case 'forms': {
        const term = get('q').trim();
        const rows = await q(`SELECT f.*, (SELECT COUNT(*) FROM responses r WHERE r.form_id = f.id)::int AS response_count
                              FROM forms f ${term ? 'WHERE f.title ILIKE $1' : ''} ORDER BY f.updated_at DESC`,
                             term ? ['%' + term + '%'] : []);
        const [stats] = await q(`SELECT (SELECT COUNT(*) FROM forms)::int AS forms,
            (SELECT COUNT(*) FROM forms WHERE status = 'published')::int AS live,
            (SELECT COUNT(*) FROM responses)::int AS responses,
            (SELECT COALESCE(SUM(views), 0) FROM forms)::int AS views`);
        return send(res, 200, {
          ok: true, stats,
          forms: rows.map(f => ({
            id: +f.id, slug: f.slug, title: f.title, description: f.description || '', status: f.status,
            views: +f.views, responses: f.response_count, questions: questionsOf(f.schema_json).length,
            accent: formSettings(f.settings_json, f.theme).primary, updated_at: ts(f.updated_at),
          })),
        });
      }

      case 'form': {
        const f = await findForm(get('id'));
        const [{ n }] = await q('SELECT COUNT(*)::int AS n FROM responses WHERE form_id = $1', [f.id]);
        return send(res, 200, {
          ok: true, responseCount: n,
          form: { id: +f.id, title: f.title, description: f.description || '', status: f.status, theme: f.theme,
                  slug: f.slug, fields: f.schema_json || [], settings: formSettings(f.settings_json, f.theme) },
        });
      }

      case 'save': {
        needPost(); requireCsrf(req);
        const input = json();
        const fields = cleanFields(input.fields);
        const title = String(input.title ?? '').trim().slice(0, 255) || 'Untitled form';
        const desc = String(input.description ?? '').trim().slice(0, 2000);
        const status = ['draft', 'published', 'closed'].includes(input.status) ? input.status : 'draft';
        const theme = ['indigo', 'violet', 'sky', 'emerald', 'amber', 'rose', 'slate'].includes(input.theme) ? input.theme : 'indigo';
        const settings = cleanSettings(input.settings || {});
        let id = parseInt(input.id, 10) || 0;
        let slug;
        if (id > 0) {
          const rows = await q(`UPDATE forms SET title=$1, description=$2, schema_json=$3, settings_json=$4, theme=$5,
                                status=$6, updated_at=now() WHERE id=$7 RETURNING slug`,
                               [title, desc, JSON.stringify(fields), JSON.stringify(settings), theme, status, id]);
          if (!rows.length) throw new HttpError(404, 'Form no longer exists.');
          slug = rows[0].slug;
        } else {
          for (;;) {
            slug = shortSlug();
            if (!(await q('SELECT 1 FROM forms WHERE slug = $1', [slug])).length) break;
          }
          const [row] = await q(`INSERT INTO forms (slug, title, description, schema_json, settings_json, theme, status)
                                 VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
                                [slug, title, desc, JSON.stringify(fields), JSON.stringify(settings), theme, status]);
          id = +row.id;
        }
        return send(res, 200, { ok: true, id, slug, fields: fields.length });
      }

      case 'upload': {
        needPost(); requireCsrf(req);
        if (!isMultipart) throw new HttpError(400, 'Nothing was uploaded.');
        const { files } = await multipart(req, buf);
        const file = files.file;
        if (!file) throw new HttpError(400, 'Nothing was uploaded (or the file is too large).');
        if (file.tooBig) throw new HttpError(400, 'Keep images under 4 MB.');
        if (!/^image\/(png|jpeg|webp|gif|svg\+xml)$/.test(file.mimeType)) throw new HttpError(400, 'Use a PNG, JPG, WEBP, GIF or SVG image.');
        return send(res, 200, { ok: true, path: await storeFile('img_', file) });
      }

      case 'delete_form': {
        needPost(); requireCsrf(req);
        await q('DELETE FROM forms WHERE id = $1', [parseInt(json().id, 10) || 0]);
        return send(res, 200, { ok: true });
      }

      case 'delete_response': {
        needPost(); requireCsrf(req);
        const input = json();
        await q('DELETE FROM responses WHERE id = $1 AND form_id = $2', [parseInt(input.response, 10) || 0, parseInt(input.id, 10) || 0]);
        return send(res, 200, { ok: true });
      }

      case 'responses': {
        const f = await findForm(get('id'));
        const perPage = 25;
        const [{ n: total }] = await q('SELECT COUNT(*)::int AS n FROM responses WHERE form_id = $1', [f.id]);
        const pages = Math.max(1, Math.ceil(total / perPage));
        const page = Math.min(Math.max(1, parseInt(get('page'), 10) || 1), pages);
        const rows = await q('SELECT id, data_json, created_at FROM responses WHERE form_id = $1 ORDER BY id DESC LIMIT $2 OFFSET $3',
                             [f.id, perPage, (page - 1) * perPage]);
        return send(res, 200, {
          ok: true, total, page, pages,
          form: { id: +f.id, title: f.title, slug: f.slug, views: +f.views },
          fields: questionsOf(f.schema_json),
          rows: rows.map(r => ({ id: +r.id, created_at: ts(r.created_at), data: r.data_json || {} })),
        });
      }

      case 'results': {
        const f = await findForm(get('id'));
        const rows = await q('SELECT id, data_json, created_at FROM responses WHERE form_id = $1 ORDER BY id DESC', [f.id]);
        return send(res, 200, {
          ok: true,
          form: { id: +f.id, title: f.title, slug: f.slug, views: +f.views },
          fields: f.schema_json || [],
          rows: rows.map(r => ({ id: +r.id, created_at: ts(r.created_at), data: r.data_json || {} })),
        });
      }

      case 'export': {
        const f = await findForm(get('id'));
        const fields = questionsOf(f.schema_json);
        const rows = await q('SELECT * FROM responses WHERE form_id = $1 ORDER BY id ASC', [f.id]);
        const lines = [['#', 'Submitted at', ...fields.map(x => x.label || x.key)]];
        for (const r of rows) {
          const data = r.data_json || {};
          lines.push([r.id, ts(r.created_at), ...fields.map(x => {
            const a = data[x.key];
            if (!a) return '';
            return Array.isArray(a.value) ? a.value.join(' | ') : a.value ?? '';
          })]);
        }
        const name = f.title.replace(/[^a-zA-Z0-9]+/g, '-') + '-' + dateStamp().slice(0, 13) + '.csv';
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
        return res.end('﻿' + lines.map(l => l.map(csvCell).join(',')).join('\r\n'));
      }

      case 'public': {
        const slug = get('slug').replace(/[^a-zA-Z0-9]/g, '');
        const preview = !!get('preview');
        const [f] = await q('SELECT * FROM forms WHERE slug = $1', [slug]);
        if (!f) return send(res, 404, { ok: false, state: 'missing' });
        if (!preview && f.status !== 'published') return send(res, 200, { ok: false, state: f.status, title: f.title });
        if (!preview && get('count')) await q('UPDATE forms SET views = views + 1 WHERE id = $1', [f.id]);
        // the answer key never leaves the server
        const fields = (f.schema_json || []).map(({ correct, ...rest }) => rest);
        return send(res, 200, { ok: true, form: {
          slug: f.slug, title: f.title, description: f.description || '', fields,
          settings: formSettings(f.settings_json, f.theme),
        } });
      }

      case 'submit': {
        needPost();
        if (!isMultipart) throw new HttpError(400, 'Bad request.');
        const { fields: body, files } = await multipart(req, buf);
        const slug = String(body.slug || '').replace(/[^a-zA-Z0-9]/g, '');
        const preview = !!body.preview;
        const [form] = await q('SELECT * FROM forms WHERE slug = $1', [slug]);
        if (!form) throw new HttpError(404, 'Form not found.');
        if (!preview && form.status !== 'published') throw new HttpError(403, 'This form is not accepting responses.');

        let posted = {};
        try { posted = JSON.parse(body.data || '{}') || {}; } catch { /* empty */ }
        const auto = !!body.auto;
        const answers = {}, errors = {};

        for (const f of questionsOf(form.schema_json)) {
          const key = f.key, label = f.label || key;
          if (f.type === 'file' || f.type === 'audio') {
            const up = files['file_' + key];
            if (!up) {
              answers[key] = { label, type: f.type, value: '' };
              if (f.required && !auto) errors[key] = 'This question is required.';
              continue;
            }
            if (up.tooBig) { errors[key] = 'File is too large (max 4 MB).'; continue; }
            answers[key] = { label, type: f.type, value: preview ? '' : await storeFile('', up), original: up.filename.slice(0, 255) };
            continue;
          }

          let val = posted[key] ?? (f.type === 'checkbox' ? [] : '');
          let empty;
          if (f.type === 'checkbox') {
            val = (Array.isArray(val) ? val : [val]).map(v => String(v).trim().slice(0, 2000));
            empty = val.length === 0;
          } else {
            val = Array.isArray(val) ? '' : String(val).trim().slice(0, 5000);
            empty = val === '';
          }
          answers[key] = { label, type: f.type, value: val };
          if (f.correct !== undefined) answers[key].correct = !empty && val === f.correct;

          if (auto) continue;
          if (f.required && empty) errors[key] = 'This question is required.';
          else if (!empty && f.type === 'email' && !EMAIL.test(val)) errors[key] = 'Enter a valid email address.';
          else if (!empty && f.type === 'number' && isNaN(Number(val))) errors[key] = 'Enter a number.';
          else if (!empty && f.type === 'phone' && !PHONE.test(val)) errors[key] = 'Enter a valid phone number.';
        }

        if (Object.keys(errors).length) return send(res, 422, { ok: false, errors });

        answers._meta = { auto, elapsed: Math.max(0, parseInt(body.elapsed, 10) || 0) };
        if (!preview) {
          const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim().slice(0, 45) || null;
          await q('INSERT INTO responses (form_id, data_json, ip, user_agent) VALUES ($1, $2, $3, $4)',
                  [form.id, JSON.stringify(answers), ip, String(req.headers['user-agent'] || '').slice(0, 255)]);
        }
        return send(res, 200, { ok: true });
      }

      default:
        throw new HttpError(400, 'Unknown action.');
    }
  } catch (e) {
    if (e instanceof HttpError) return send(res, e.status, { ok: false, error: e.message, ...e.extra });
    console.error(e);
    return send(res, e.status || 500, { ok: false, error: 'Server error: ' + e.message });
  }
}
