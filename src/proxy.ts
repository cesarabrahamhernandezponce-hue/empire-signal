import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Run session refresh only on UI routes. API routes do their own auth, and the
  // metadata image generators (icon/og/twitter) never need a session — excluding
  // them avoids a Supabase getUser() round-trip on every such request.
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|icon|apple-icon|opengraph-image|twitter-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
