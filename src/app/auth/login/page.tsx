'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const LANG = {
  en: {
    heading:       'Sign in',
    emailLabel:    'Email',
    passwordLabel: 'Password',
    signingIn:     'Signing in...',
    submit:        'Sign in',
    noAccount:     'No account?',
    createOne:     'Create one',
  },
  es: {
    heading:       'Iniciar sesión',
    emailLabel:    'Email',
    passwordLabel: 'Contraseña',
    signingIn:     'Iniciando sesión...',
    submit:        'Iniciar sesión',
    noAccount:     '¿Sin cuenta?',
    createOne:     'Crear una',
  },
} as const;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  const uiLang = ((): 'en' | 'es' => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('language') as 'en' | 'es') ?? 'en';
    }
    return 'en';
  })();
  const l = LANG[uiLang];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    if (!supabase) {
      setError('Auth is not configured.');
      setLoading(false);
      return;
    }

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push('/');
    router.refresh();
  };

  return (
    <main className="min-h-screen bg-bg flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link
            href="/"
            className="text-[2rem] tracking-tight text-ink leading-none"
            style={{ fontFamily: 'var(--font-dm-serif)', fontStyle: 'italic' }}
          >
            Empire
          </Link>
        </div>

        <div className="bg-surface border border-line rounded-[12px] shadow-[0_4px_24px_rgba(0,0,0,0.06)] px-7 py-8">
          <h2 className="text-base font-semibold text-ink mb-6">{l.heading}</h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1.5" htmlFor="email">
                {l.emailLabel}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="w-full bg-bg border border-line rounded-lg px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint outline-none focus:border-accent transition-colors duration-150"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1.5" htmlFor="password">
                {l.passwordLabel}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full bg-bg border border-line rounded-lg px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint outline-none focus:border-accent transition-colors duration-150"
              />
            </div>

            {error && (
              <p className="text-xs" style={{ color: '#E53935' }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 bg-accent text-white enabled:hover:bg-accent-hover disabled:bg-[var(--surface-muted)] disabled:text-ink-faint disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-1.5">
                  <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                  {l.signingIn}
                </span>
              ) : l.submit}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-ink-faint">
            {l.noAccount}{' '}
            <Link href="/auth/signup" className="text-accent hover:text-accent-hover transition-colors duration-150">
              {l.createOne}
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
