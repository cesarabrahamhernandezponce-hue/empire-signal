import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/admin';

async function signOut() {
  'use server';
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  redirect('/');
}

const NAV_ITEMS = [
  { label: 'Users',       href: '/admin/users' },
  { label: 'Words',       href: '/admin/words' },
  { label: 'Rate limits', href: '/admin/rate-limits' },
];

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
        <nav className="w-48 shrink-0 border-r border-line bg-surface px-4 py-6 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="px-3 py-2 rounded-md text-sm text-ink-muted hover:bg-bg hover:text-ink transition-colors"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <main className="flex-1 px-8 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
