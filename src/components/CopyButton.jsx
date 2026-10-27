import { useState } from 'react';

export default function CopyButton({ text, className, title, children, done = <i className="bi bi-check2 text-emerald-600" /> }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" title={title} className={className} onClick={() => {
      navigator.clipboard?.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }}>
      {copied ? done : children}
    </button>
  );
}
