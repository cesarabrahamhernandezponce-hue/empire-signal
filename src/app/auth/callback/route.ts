import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  // Only allow same-origin relative paths. Reject protocol-relative (`//host`)
  // and backslash (`/\host`) tricks that browsers treat as absolute URLs —
  // otherwise `next` is an open-redirect into an attacker-controlled host.
  const rawNext = searchParams.get('next') ?? '/';
  const next = /^\/(?![/\\])/.test(rawNext) ? rawNext : '/';

  if (code) {
    const supabase = await createClient();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_failed`);
}
