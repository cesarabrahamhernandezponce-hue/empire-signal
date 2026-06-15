import type { NextConfig } from "next";

// Content-Security-Policy.
// `script-src`/`style-src` keep 'unsafe-inline' because the app ships an inline
// theme-bootstrap script (layout.tsx) and Next.js injects inline bootstrap data;
// a nonce-based policy would require threading a nonce through the modified Next
// fork and is deferred. Even so, the policy is meaningful: it whitelists the only
// external origins allowed to load/connect (Supabase, PostHog, Google Fonts) and
// locks down framing, base-uri, plugins and form targets — which is what stops
// clickjacking and injection from doing real damage.
// React's dev build uses eval() for debugging (callstack reconstruction); it
// never does in production. Allow 'unsafe-eval' only in dev so the production
// policy stays strict.
const devEval = process.env.NODE_ENV === 'production' ? '' : " 'unsafe-eval'";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${devEval} https://us.i.posthog.com https://*.posthog.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob:",
  "font-src 'self' https://fonts.gstatic.com data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://us.i.posthog.com https://*.posthog.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
