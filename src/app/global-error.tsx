'use client';

import { useEffect } from 'react';

export default function GlobalError({
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
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 16px',
          background: '#faf9f5',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          color: '#1a1a1a',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: 384 }}>
          <p style={{ fontSize: 14, fontWeight: 500, margin: '0 0 4px' }}>
            Something went wrong
          </p>
          <p style={{ fontSize: 14, color: '#6b6b6b', margin: '0 0 24px' }}>
            An unexpected error occurred. Please try again.
          </p>
          <button
            onClick={() => unstable_retry()}
            style={{
              fontSize: 14,
              color: '#3A3D8F',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
