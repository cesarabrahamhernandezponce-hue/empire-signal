import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function isAdmin(): Promise<boolean> {
  // Single source of truth for "the owner": the same OWNER_EMAIL that gates the
  // rate-limit bypass in api-guard.ts. A second variable (ADMIN_EMAIL) would let
  // the two drift apart in the Vercel env and silently lock the admin panel.
  const adminEmail = process.env.OWNER_EMAIL;
  if (!adminEmail) return false;

  const supabase = await createClient();
  if (!supabase) return false;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return false;
    return user.email.toLowerCase() === adminEmail.toLowerCase();
  } catch (err) {
    // Never grant admin on an auth error — fail closed.
    console.error('[admin] getUser failed, denying admin access:', err);
    return false;
  }
}

// Defense-in-depth: call at the top of every admin server component so a page
// is never rendered for a non-admin even if the layout guard is bypassed.
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect('/');
}
