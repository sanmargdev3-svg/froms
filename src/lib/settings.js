/* Form design settings - mirrors default_settings() in public/api/db.php. */
export const DEFAULT_SETTINGS = {
  layout: 'paged', primary: '#6366f1', secondary: '#8b5cf6', surface: 'light',
  corner: 'round', animate: true, progress: true, coverImage: '', coverStyle: 'banner',
  footerImage: '', submitLabel: 'Submit', endTitle: '', endMessage: '', endImage: '',
  endBtnLabel: '', endBtnUrl: '', endAgain: true, endConfetti: true, timeLimit: 0,
};

export const RADII = { round: '18px', soft: '10px', sharp: '3px' };

/** #rrggbb -> "r,g,b" */
export function rgbOf(hex) {
  const h = (hex || '#6366f1').replace('#', '');
  return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)).join(',');
}

export const isHex = v => /^#[0-9a-fA-F]{6}$/.test(v);

export const TYPES = {
  text:     { label: 'Short answer',    icon: 'bi-input-cursor-text', group: 'Text',   hint: 'A single line' },
  textarea: { label: 'Paragraph',       icon: 'bi-text-paragraph',    group: 'Text',   hint: 'Longer answers' },
  email:    { label: 'Email',           icon: 'bi-envelope',          group: 'Text',   hint: 'Checked for you' },
  phone:    { label: 'Phone',           icon: 'bi-telephone',         group: 'Text',   hint: 'Numbers only' },
  number:   { label: 'Number',          icon: 'bi-123',               group: 'Text',   hint: 'Quantities, age…' },
  radio:    { label: 'Multiple choice', icon: 'bi-record-circle',     group: 'Choice', hint: 'Pick one', options: true },
  checkbox: { label: 'Checkboxes',      icon: 'bi-check2-square',     group: 'Choice', hint: 'Pick many', options: true },
  select:   { label: 'Dropdown',        icon: 'bi-chevron-down',      group: 'Choice', hint: 'Long lists', options: true },
  rating:   { label: 'Star rating',     icon: 'bi-star',              group: 'Choice', hint: 'Score out of 5' },
  date:     { label: 'Date',            icon: 'bi-calendar-event',    group: 'Other',  hint: 'Date picker' },
  time:     { label: 'Time',            icon: 'bi-clock',             group: 'Other',  hint: 'Time picker' },
  file:     { label: 'File upload',     icon: 'bi-paperclip',         group: 'Other',  hint: 'Attachments' },
  audio:    { label: 'Voice reading',   icon: 'bi-mic',               group: 'Other',  hint: 'Read a passage aloud' },
  section:  { label: 'Section title',   icon: 'bi-type-h2',           group: 'Other',  hint: 'Heading / new page' },
};

export const PALETTES = [
  { name: 'Indigo',   p: '#6366f1', s: '#8b5cf6' },
  { name: 'Ocean',    p: '#0ea5e9', s: '#2563eb' },
  { name: 'Forest',   p: '#10b981', s: '#0d9488' },
  { name: 'Sunset',   p: '#f59e0b', s: '#f43f5e' },
  { name: 'Berry',    p: '#d946ef', s: '#7c3aed' },
  { name: 'Coral',    p: '#f43f5e', s: '#fb923c' },
  { name: 'Graphite', p: '#0f172a', s: '#475569' },
  { name: 'Mint',     p: '#14b8a6', s: '#84cc16' },
];

export const LAYOUTS = {
  paged:    { label: 'Paged',          icon: 'bi-layout-text-window-reverse' },
  single:   { label: 'One long page',  icon: 'bi-file-earmark-text' },
  typeform: { label: 'Conversational', icon: 'bi-chat-square-dots' },
  classic:  { label: 'Professional',   icon: 'bi-card-list' },
};

export const uid = () => 'f_' + Math.random().toString(36).slice(2, 9);
