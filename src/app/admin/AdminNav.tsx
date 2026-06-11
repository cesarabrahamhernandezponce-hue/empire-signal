'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { label: 'Users',       href: '/admin/users' },
  { label: 'Words',       href: '/admin/words' },
  { label: 'Rate limits', href: '/admin/rate-limits' },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="w-48 shrink-0 border-r border-line bg-surface px-4 py-6 flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`px-3 py-2 rounded-md text-sm transition-colors ${
              active
                ? 'bg-bg text-ink font-medium'
                : 'text-ink-muted hover:bg-bg hover:text-ink'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
