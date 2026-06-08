'use client';

import posthog from 'posthog-js';

if (typeof window !== 'undefined') {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? '';
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    person_profiles: 'never',
    capture_pageview: true,
    capture_pageleave: true,
    loaded: () => {
      console.log('[PostHog] initialized — key present:', key.length > 0);
    },
  });
}

export function track(event: string, properties?: Record<string, unknown>) {
  if (typeof window !== 'undefined') {
    console.log('[PostHog] capture:', event, properties);
    posthog.capture(event, properties);
  }
}
