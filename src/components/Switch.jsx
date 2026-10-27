export default function Switch({ on, onChange }) {
  return (
    <button type="button" role="switch" aria-checked={!!on} onClick={() => onChange(!on)}
            className="relative w-[38px] h-[22px] rounded-full transition-colors shrink-0"
            style={{ background: on ? 'var(--fc, #6366f1)' : '#cbd5e1' }}>
      <span className="absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white transition-transform"
            style={{ transform: on ? 'translateX(16px)' : 'none' }} />
    </button>
  );
}
