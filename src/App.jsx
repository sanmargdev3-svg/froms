import { Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Builder from './pages/Builder.jsx';
import Responses from './pages/Responses.jsx';
import PublicForm from './pages/PublicForm.jsx';

function Admin({ children }) {
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 antialiased">
      <Header />
      <main>{children}</main>
      <div className="h-12" />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Admin><Dashboard /></Admin>} />
      <Route path="/builder/:id?" element={<Admin><Builder /></Admin>} />
      <Route path="/responses/:id" element={<Admin><Responses /></Admin>} />
      <Route path="/f/:slug" element={<PublicForm />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
