'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Footer() {
  const pathname = usePathname();
  if (pathname?.startsWith('/admin')) return null;

  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center justify-between gap-2 px-5 py-6 text-xs text-ink-muted sm:flex-row sm:px-8">
        <span>Empire Signal © 2026</span>
        <nav className="flex items-center gap-4">
          <Link href="/about" className="hover:text-accent transition-colors">
            About
          </Link>
          <Link href="/privacy" className="hover:text-accent transition-colors">
            Privacy
          </Link>
        </nav>
      </div>
    </footer>
  );
}
