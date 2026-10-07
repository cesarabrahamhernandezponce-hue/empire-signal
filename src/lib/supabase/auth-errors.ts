import { isAuthRetryableFetchError, type AuthError } from '@supabase/supabase-js';

// When Supabase is unreachable — project paused or deleted, DNS gone, offline
// client — supabase-js wraps the failed fetch in an AuthRetryableFetchError whose
// `message` is whatever the browser said ("Failed to fetch" in Chrome, "Load
// failed" in Safari, "NetworkError when attempting to fetch resource" in Firefox).
// Rendering that raw string tells the user nothing and reads like their password
// was wrong, so map it to a sentence that names the real cause. Every other auth
// error is genuinely about the credentials and is shown as Supabase worded it.
const NETWORK_MESSAGE = {
  en: "Couldn't reach the server. Check your connection and try again.",
  es: 'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
} as const;

export function authErrorMessage(error: AuthError, lang: 'en' | 'es'): string {
  return isAuthRetryableFetchError(error) ? NETWORK_MESSAGE[lang] : error.message;
}
