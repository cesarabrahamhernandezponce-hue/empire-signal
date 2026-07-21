'use client';

import { useEffect } from 'react';

// global-error replaces the root layout, so it has no access to globals.css or
// the [data-theme] tokens. Mirror the system colour scheme via prefers-color-scheme
// (values match the --bg/--text tokens) so a crash never flashes a blinding white
// screen at a user who runs the app in dark mode.
const CRASH_STYLES = `
  .crash-root {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 16px;
    background: #FAFAF8;
    color: #1A1A1A;
    font-family: system-ui, -apple-system, sans-serif;
  }
  .crash-muted { color: #6B6B6B; }
  .crash-retry { color: #3A3D8F; }
  @media (prefers-color-scheme: dark) {
    .crash-root { background: #111111; color: #EEEEE9; }
    .crash-muted { color: #888884; }
    .crash-retry { color: #7B7EC8; }
  }
`;

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
      <body className="crash-root">
        <style>{CRASH_STYLES}</style>
        <div style={{ textAlign: 'center', maxWidth: 384 }}>
          <p style={{ fontSize: 14, fontWeight: 500, margin: '0 0 4px' }}>
            Something went wrong
          </p>
          <p className="crash-muted" style={{ fontSize: 14, margin: '0 0 24px' }}>
            An unexpected error occurred. Please try again.
          </p>
          <button
            onClick={() => unstable_retry()}
            className="crash-retry"
            style={{
              fontSize: 14,
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
