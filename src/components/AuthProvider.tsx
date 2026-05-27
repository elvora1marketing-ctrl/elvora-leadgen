'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { usePathname } from 'next/navigation';

interface AuthContextType {
  authenticated: boolean;
  loading: boolean;
  username: string;
  fullName: string;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  authenticated: false,
  loading: true,
  username: '',
  fullName: '',
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const PUBLIC_PATHS = ['/audit', '/proposal', '/client', '/invoice', '/roi-rechner', '/booking', '/tracking', '/account-portal'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [authenticated, setAuthenticated] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');

  const [loginUsername, setLoginUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Welcome animation
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeName, setWelcomeName] = useState('');

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/auth');
      const data = await res.json();
      setAuthenticated(data.authenticated);
      setNeedsSetup(data.needsSetup || false);
      if (data.authenticated) {
        setUsername(data.username || '');
        setFullName(data.fullName || '');
      }
    } catch {
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const logout = useCallback(async () => {
    await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    });
    setAuthenticated(false);
    setUsername('');
    setFullName('');
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password }),
      });
      const data = await res.json();

      if (res.ok) {
        setUsername(data.username || '');
        setFullName(data.fullName || '');
        setWelcomeName(data.fullName || data.username || '');
        setShowWelcome(true);
        setPassword('');
        setLoginUsername('');
        setTimeout(() => {
          setShowWelcome(false);
          setAuthenticated(true);
        }, 2500);
      } else if (data.needsSetup) {
        setNeedsSetup(true);
      } else {
        setError(data.error || 'Login fehlgeschlagen');
      }
    } catch {
      setError('Netzwerkfehler');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Passwort muss mindestens 8 Zeichen lang sein');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwörter stimmen nicht überein');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, action: 'setup' }),
      });

      if (res.ok) {
        setAuthenticated(true);
        setNeedsSetup(false);
        setPassword('');
        setConfirmPassword('');
      } else {
        const data = await res.json();
        setError(data.error || 'Fehler beim Einrichten');
      }
    } catch {
      setError('Netzwerkfehler');
    } finally {
      setSubmitting(false);
    }
  }

  if (isPublicPath(pathname || '')) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-elvora-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <img src="/elvora-icon.svg" alt="Elvora" width={48} height={48} />
          <div className="w-5 h-5 border-2 border-elvora-purple border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // Welcome animation after login
  if (showWelcome) {
    return (
      <div className="min-h-screen bg-elvora-bg flex items-center justify-center p-4">
        <div className="flex flex-col items-center animate-fade-in">
          <div className="animate-logo-pulse mb-8">
            <img src="/elvora-icon.svg" alt="Elvora" width={72} height={72} />
          </div>
          <div className="overflow-hidden">
            <h1 className="text-2xl font-light text-white animate-slide-up">
              Willkommen,
            </h1>
          </div>
          <div className="overflow-hidden mt-1">
            <p className="text-3xl font-bold text-white animate-slide-up-delay">
              {welcomeName}
            </p>
          </div>
          <div className="mt-6 w-12 h-0.5 bg-elvora-purple rounded-full animate-width-expand" />
        </div>

        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideUp {
            from { transform: translateY(100%); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          @keyframes logoPulse {
            0% { transform: scale(0.5); opacity: 0; }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); opacity: 1; }
          }
          @keyframes widthExpand {
            from { width: 0; }
            to { width: 3rem; }
          }
          .animate-fade-in { animation: fadeIn 0.6s ease-out; }
          .animate-slide-up { animation: slideUp 0.6s ease-out 0.3s both; }
          .animate-slide-up-delay { animation: slideUp 0.6s ease-out 0.5s both; }
          .animate-logo-pulse { animation: logoPulse 0.8s ease-out; }
          .animate-width-expand { animation: widthExpand 0.8s ease-out 0.8s both; }
        `}</style>
      </div>
    );
  }

  if (authenticated) {
    return (
      <AuthContext.Provider value={{ authenticated, loading, username, fullName, logout }}>
        {children}
      </AuthContext.Provider>
    );
  }

  if (needsSetup) {
    return (
      <div className="min-h-screen bg-elvora-bg flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8">
            <img src="/elvora-logo.svg" alt="Elvora" className="h-10 mb-3" />
            <p className="text-sm text-elvora-text-dim text-center mt-1">Lege dein Passwort fest, um dein Panel zu schützen.</p>
          </div>

          <form onSubmit={handleSetup} className="card rounded-xl p-5 space-y-4">
            <div>
              <label className="block text-xs text-elvora-text-dim mb-1.5">Passwort</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 Zeichen"
                className="w-full px-3 py-2.5 rounded-lg bg-elvora-bg-alt border border-elvora-border text-elvora-text text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-purple/50 transition-colors"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs text-elvora-text-dim mb-1.5">Passwort bestätigen</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nochmal eingeben"
                className="w-full px-3 py-2.5 rounded-lg bg-elvora-bg-alt border border-elvora-border text-elvora-text text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-purple/50 transition-colors"
              />
            </div>
            {error && (
              <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full px-5 py-2.5 rounded-lg bg-elvora-primary text-white text-sm font-medium hover:bg-elvora-primary-dark transition-colors disabled:opacity-50"
            >
              {submitting ? 'Einrichten...' : 'Passwort festlegen'}
            </button>
            <div className="flex items-start gap-2 pt-1">
              <svg className="w-4 h-4 text-elvora-success flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <p className="text-[11px] text-elvora-text-dim">
                Passwort wird verschlüsselt gespeichert (PBKDF2-SHA512, 100k Iterationen). Übertragung via HTTPS/TLS.
              </p>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Login screen
  return (
    <div className="min-h-screen bg-elvora-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src="/elvora-icon.svg" alt="Elvora" width={56} height={56} className="mb-4" />
          <img src="/elvora-logo.svg" alt="Elvora" className="h-8 mb-2" />
          <p className="text-sm text-elvora-text-dim">Melde dich an, um fortzufahren.</p>
        </div>

        <form onSubmit={handleLogin} className="card rounded-xl p-5 space-y-4">
          <div>
            <label className="block text-xs text-elvora-text-dim mb-1.5">Benutzername</label>
            <input
              type="text"
              value={loginUsername}
              onChange={(e) => setLoginUsername(e.target.value)}
              placeholder="Benutzername"
              className="w-full px-3 py-2.5 rounded-lg bg-elvora-bg-alt border border-elvora-border text-elvora-text text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-purple/50 transition-colors"
              autoFocus
              autoComplete="username"
            />
          </div>
          <div>
            <label className="block text-xs text-elvora-text-dim mb-1.5">Passwort</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Dein Passwort"
              className="w-full px-3 py-2.5 rounded-lg bg-elvora-bg-alt border border-elvora-border text-elvora-text text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-purple/50 transition-colors"
              autoComplete="current-password"
            />
          </div>
          {error && (
            <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={submitting || !loginUsername.trim() || !password}
            className="w-full px-5 py-2.5 rounded-lg bg-elvora-gradient text-white text-sm font-semibold hover:shadow-lg hover:shadow-elvora-purple/20 transition-all disabled:opacity-50"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Anmelden...
              </span>
            ) : 'Anmelden'}
          </button>
        </form>
      </div>
    </div>
  );
}
