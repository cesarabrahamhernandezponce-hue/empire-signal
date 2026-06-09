'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(false);

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

    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    setDone(true);
    setLoading(false);
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
          {done ? (
            <div className="text-center py-4">
              <p className="text-sm font-medium text-ink mb-2">Check your email</p>
              <p className="text-xs text-ink-muted leading-relaxed">
                We sent a confirmation link to <span className="text-ink">{email}</span>.
                Click it to activate your account.
              </p>
              <Link
                href="/auth/login"
                className="mt-6 inline-block text-xs text-accent hover:text-accent-hover transition-colors duration-150"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-base font-semibold text-ink mb-6">Create an account</h2>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1.5" htmlFor="email">
                    Email
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
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="w-full bg-bg border border-line rounded-lg px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint outline-none focus:border-accent transition-colors duration-150"
                  />
                </div>

                {error && (
                  <p className="text-xs" style={{ color: '#E53935' }}>{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading || !email || password.length < 8}
                  className="w-full py-2.5 rounded-lg text-sm font-medium text-white bg-accent hover:bg-accent-hover transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                      Creating account...
                    </span>
                  ) : 'Create account'}
                </button>
              </form>

              <p className="mt-5 text-center text-xs text-ink-faint">
                Already have an account?{' '}
                <Link href="/auth/login" className="text-accent hover:text-accent-hover transition-colors duration-150">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
