/* Form design settings + schema cleaning - the Node twin of public/api/db.php. */
import crypto from 'node:crypto';

export const DEFAULT_SETTINGS = {
  layout: 'paged', primary: '#6366f1', secondary: '#8b5cf6', surface: 'light', corner: 'round',
  animate: true, progress: true, coverImage: '', coverStyle: 'banner', footerImage: '',
  submitLabel: 'Submit', endTitle: '', endMessage: '', endImage: '', endBtnLabel: '', endBtnUrl: '',
  endAgain: true, endConfetti: true, timeLimit: 0,
};

const URL_RE = /^https?:\/\/[^\s"'<>]{4,500}$/i;
const cut = (v, n) => String(v ?? '').trim().slice(0, n);

function cleanHex(v, fallback) {
  v = String(v ?? '').trim();
  if (/^#[0-9a-f]{3}$/i.test(v)) return '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
  return /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : fallback;
}

function cleanMedia(v) {
  v = String(v ?? '').trim();
  if (/^uploads\/[A-Za-z0-9._-]{1,120}$/.test(v)) return v;
  return URL_RE.test(v) ? v : '';
}

export function cleanSettings(input = {}) {
  const d = DEFAULT_SETTINGS;
  const pick = (k, ok) => (ok.includes(input[k]) ? input[k] : d[k]);
  const bool = k => (k in input ? !!input[k] : d[k]);
  return {
    layout:      pick('layout', ['paged', 'single', 'typeform', 'classic']),
    primary:     cleanHex(input.primary, d.primary),
    secondary:   cleanHex(input.secondary, d.secondary),
    surface:     pick('surface', ['light', 'dark']),
    corner:      pick('corner', ['round', 'soft', 'sharp']),
    animate:     bool('animate'),
    progress:    bool('progress'),
    coverImage:  cleanMedia(input.coverImage),
    coverStyle:  pick('coverStyle', ['none', 'banner', 'cover', 'logo']),
    footerImage: cleanMedia(input.footerImage),
    submitLabel: cut(input.submitLabel ?? d.submitLabel, 40) || 'Submit',
    endTitle:    cut(input.endTitle, 160),
    endMessage:  cut(input.endMessage, 1000),
    endImage:    cleanMedia(input.endImage),
    endBtnLabel: cut(input.endBtnLabel, 40),
    endBtnUrl:   URL_RE.test(String(input.endBtnUrl ?? '').trim()) ? String(input.endBtnUrl).trim() : '',
    endAgain:    bool('endAgain'),
    endConfetti: bool('endConfetti'),
    timeLimit:   Math.max(0, Math.min(300, parseInt(input.timeLimit, 10) || 0)),
  };
}

const LEGACY = {
  indigo: ['#6366f1', '#8b5cf6'], violet: ['#8b5cf6', '#a855f7'], sky: ['#0ea5e9', '#2563eb'],
  emerald: ['#10b981', '#0d9488'], amber: ['#f59e0b', '#f43f5e'], rose: ['#f43f5e', '#fb923c'],
  slate: ['#0f172a', '#475569'],
};

/** Settings for a stored form, defaults filled in. */
export function formSettings(raw, theme) {
  raw = { ...(raw || {}) };
  if (!raw.primary && LEGACY[theme]) [raw.primary, raw.secondary] = LEGACY[theme];
  return cleanSettings(raw);
}

const TYPES = ['text', 'textarea', 'email', 'phone', 'number', 'date', 'time', 'select', 'radio',
  'checkbox', 'rating', 'file', 'audio', 'section'];

/** Force whatever the builder sent into a safe field list. */
export function cleanFields(list) {
  return (Array.isArray(list) ? list : []).map(f => {
    const type = TYPES.includes(f?.type) ? f.type : 'text';
    const row = {
      key:         String(f?.key ?? '').replace(/[^a-zA-Z0-9_]/g, '') || 'f_' + crypto.randomBytes(4).toString('hex'),
      type,
      label:       cut(f?.label, 500),
      help:        cut(f?.help, 500),
      placeholder: cut(f?.placeholder, 200),
      required:    !!f?.required && type !== 'section',
    };
    if (['select', 'radio', 'checkbox'].includes(type)) {
      const opts = (Array.isArray(f.options) ? f.options : []).map(o => cut(o, 200)).filter(Boolean);
      row.options = opts.length ? opts : ['Option 1'];
      if (type !== 'checkbox' && f.correct != null && row.options.includes(String(f.correct))) row.correct = String(f.correct);
    }
    if (type === 'audio') row.passage = cut(f.passage, 5000);
    if (type === 'rating') row.max = Math.max(3, Math.min(10, parseInt(f.max, 10) || 5));
    if (type === 'section') {
      row.level = [2, 3, 4].includes(+f.level) ? +f.level : 2;
      row.newpage = !!f.newpage;
    }
    return row;
  });
}

export const questionsOf = fields => (fields || []).filter(f => f.type !== 'section');

export function shortSlug(len = 8) {
  const a = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from(crypto.randomBytes(len), b => a[b % a.length]).join('');
}
