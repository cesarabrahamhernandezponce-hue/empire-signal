'use client';

import posthog from 'posthog-js';

export function track(event: string, properties?: Record<string, unknown>) {
  if (typeof window !== 'undefined') {
    console.log('tracking event:', event);
    posthog.capture(event, properties);
  }
}
