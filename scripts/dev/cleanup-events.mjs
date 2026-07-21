import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const today = new Date(); today.setUTCHours(0, 0, 0, 0);
const del = await pool.query('DELETE FROM search_events WHERE "userId" IS NULL AND "createdAt" >= $1', [today]);
console.log(`\n[cleanup] Borrados ${del.rowCount} search_events anonimos de hoy (desbloquea localhost).`);
await pool.end();
