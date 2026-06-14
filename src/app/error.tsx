'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <p className="text-sm font-medium text-ink mb-1">Something went wrong</p>
        <p className="text-sm text-ink-muted mb-6">
          An unexpected error occurred. Please try again.
        </p>
        <button
          onClick={() => unstable_retry()}
          className="text-sm text-accent hover:text-accent-hover transition-colors duration-150"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
