import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { SUPABASE_ROOT_CA } from './supabase-ca';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Verify the Supabase pooler's TLS chain against its (self-signed) root CA
    // instead of trusting any certificate — closes the MITM window.
    ssl: { ca: SUPABASE_ROOT_CA, rejectUnauthorized: true },
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    connectionTimeoutMillis: 10000,
    // Stay under pgbouncer's server_idle_timeout (~60s) to avoid "connection terminated" errors
    idleTimeoutMillis: 30000,
    max: 2,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

globalForPrisma.prisma = prisma;
