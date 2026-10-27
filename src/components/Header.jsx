import { Link } from 'react-router-dom';
import logo from '../assets/logo.png';

export default function Header() {
  return (
    <nav className="sticky top-0 z-40 bg-white/85 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="flex items-center">
          <Link to="/" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100">
            <i className="bi bi-grid" /><span className="hidden sm:inline">Forms</span>
          </Link>
        </div>
        <Link to="/" className="justify-self-center flex items-center gap-2.5" aria-label="FormCraft home">
          <img src={logo} alt="Logo" className="h-9 sm:h-11 w-auto max-w-[220px] object-contain" />
        </Link>
        <div className="flex items-center justify-end">
          <Link to="/builder" className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm">
            <i className="bi bi-plus-lg" /><span className="hidden sm:inline">New form</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
