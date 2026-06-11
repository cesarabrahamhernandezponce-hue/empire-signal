import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/admin';
import AdminNav from './AdminNav';

async function signOut() {
  'use server';
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  redirect('/');
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await isAdmin();
  if (!admin) redirect('/');

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <header className="sticky top-0 z-20 bg-surface border-b border-line px-6 py-3 flex items-center justify-between">
        <span className="font-dm-serif italic text-xl text-ink">Empire Admin</span>
        <form action={signOut}>
          <button
            type="submit"
            className="text-sm text-ink-muted hover:text-ink transition-colors"
          >
            Sign out
          </button>
        </form>
      </header>

      <div className="flex flex-1">
        <AdminNav />

        <main className="flex-1 px-8 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
