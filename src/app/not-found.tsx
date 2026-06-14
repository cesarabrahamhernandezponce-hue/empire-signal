import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <p className="text-sm font-medium text-ink mb-1">Page not found</p>
        <p className="text-sm text-ink-muted mb-6">
          This page may have moved or never existed.
        </p>
        <Link
          href="/"
          className="text-sm text-accent hover:text-accent-hover transition-colors duration-150"
        >
          ← Back to Empire Signal
        </Link>
      </div>
    </div>
  );
}
