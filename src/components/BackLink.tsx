'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

// Static pages (About, Privacy) are linked from several places — the home page,
// the Footer on Lens, etc. A hardcoded `href="/"` back link always dumped the
// user on the home page, losing the page they actually came from (e.g. Lens).
// This returns to the real previous entry when there is one, and only falls back
// to `/` on a direct visit (no in-app history to go back to).
export default function BackLink({
  fallbackHref = '/',
  className,
  children,
}: {
  fallbackHref?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Only intercept plain left-clicks; let modifier/middle clicks open the
    // fallback href in a new tab as usual.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (window.history.length > 1) {
      e.preventDefault();
      router.back();
    }
  };

  return (
    <Link href={fallbackHref} onClick={handleClick} className={className}>
      {children}
    </Link>
  );
}
