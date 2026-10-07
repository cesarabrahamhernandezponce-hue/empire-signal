#!/usr/bin/env node
// Verifies that the Supabase backend this app depends on is actually reachable,
// and names the piece that's broken when it isn't.
//
// Why this exists: when a Supabase project goes away, the app doesn't fail
// anywhere obvious. Auth surfaces the browser's raw "Failed to fetch", and the
// rate limiters fail closed — so the symptom is a login that won't work plus an
// app that blocks you, neither of which points at the real cause. This checks
// the three things that must hold, in the order they break.
//
// Run:
//   node --env-file=.env --env-file=.env.local scripts/check-backend.ts

import { lookup } from 'node:dns/promises';
import { Pool } from 'pg';
import { SUPABASE_ROOT_CA } from '../src/lib/db/supabase-ca.ts';

let failed = false;

function ok(label: string, detail?: string): void {
  console.log(`  OK    ${label}${detail ? ` — ${detail}` : ''}`);
}
function bad(label: string, detail?: string): void {
  failed = true;
  console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
}

// ── 1. Required env vars ────────────────────────────────────────────────────
console.log('\nEnvironment');
for (const name of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'DATABASE_URL']) {
  if (process.env[name]) ok(name, 'set');
  else bad(name, 'missing');
}

// ── 2. Supabase Auth ────────────────────────────────────────────────────────
// A deleted project stops resolving in DNS altogether, so separating "host
// doesn't exist" from "host answers but rejects us" is the difference between
// "the project is gone" and "the key is wrong".
console.log('\nSupabase Auth');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (supabaseUrl) {
  const host = new URL(supabaseUrl).hostname;
  try {
    await lookup(host);
    ok('DNS', host);
    try {
      const res = await fetch(`${supabaseUrl}/auth/v1/health`, {
        headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '' },
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) ok('health endpoint', `HTTP ${res.status}`);
      else bad('health endpoint', `HTTP ${res.status} — check the anon key and project status`);
    } catch (err) {
      bad('health endpoint', (err as Error).message);
    }
  } catch {
    bad('DNS', `${host} does not resolve — the Supabase project no longer exists`);
  }
}

// ── 3. Database ─────────────────────────────────────────────────────────────
// Goes through the pooler exactly as the app does, same TLS pinning, so a pass
// here means the app's own queries will work.
console.log('\nDatabase');
if (process.env.DATABASE_URL) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { ca: SUPABASE_ROOT_CA, rejectUnauthorized: true },
    connectionTimeoutMillis: 10_000,
    max: 1,
  });
  try {
    const { rows } = await pool.query<{ db: string }>('SELECT current_database() AS db');
    ok('connection', rows[0].db);
    // A reachable database with no tables is exactly the state a fresh project
    // is in before bootstrap.sql runs — worth catching separately, since every
    // app query would fail with a confusing "relation does not exist".
    const { rows: tables } = await pool.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
    );
    const names = tables.map((t) => t.tablename);
    const missing = ['users', 'search_records', 'search_events', 'rate_limit_events']
      .filter((t) => !names.includes(t));
    if (missing.length === 0) ok('schema', `${names.length} tables`);
    else bad('schema', `missing ${missing.join(', ')} — run prisma/bootstrap.sql in the SQL Editor`);
  } catch (err) {
    bad('connection', (err as Error).message);
  } finally {
    await pool.end();
  }
}

console.log(failed ? '\nBackend is NOT healthy.\n' : '\nBackend is healthy.\n');
process.exit(failed ? 1 : 0);
