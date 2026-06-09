import { Link, Route, Routes } from 'react-router-dom';
import AuthGate from './components/AuthGate';
import CallDetailPage from './pages/CallDetailPage';
import DashboardPage from './pages/DashboardPage';

export default function App() {
  return (
    <AuthGate>
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border-subtle bg-surface-raised/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 no-underline group">
            <div className="w-8 h-8 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M2 4h12M2 8h8M2 12h10" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-text-primary group-hover:text-accent transition-colors">
                NovaTel QA
              </div>
              <div className="text-[11px] text-text-muted -mt-0.5">Call Quality Dashboard</div>
            </div>
          </Link>
          <div className="text-xs text-text-muted font-mono">Live analysis · MongoDB</div>
        </div>
      </header>

      <main className="flex-1">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/calls/:callId" element={<CallDetailPage />} />
        </Routes>
      </main>
    </div>
    </AuthGate>
  );
}
