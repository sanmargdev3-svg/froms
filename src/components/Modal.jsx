import { useEffect } from 'react';

export default function Modal({ open, onClose, size = 'md', children, className = '', style }) {
  useEffect(() => {
    if (!open) return;
    const onKey = e => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);

  if (!open) return null;
  const width = { md: 'max-w-md', lg: 'max-w-3xl' }[size];
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onMouseDown={onClose}>
      <div className={`w-full ${width} max-h-[90vh] overflow-y-auto fc-scroll bg-white rounded-2xl shadow-2xl ${className}`}
           style={style} onMouseDown={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
