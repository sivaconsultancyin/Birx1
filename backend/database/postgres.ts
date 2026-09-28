import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPostgresPool(): pg.Pool | null {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: url,
      max: Number(process.env.PG_POOL_MAX || 20),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined
    });
  }
  return pool;
}

export async function postgresHealth(): Promise<{ configured: boolean; reachable: boolean }> {
  const db = getPostgresPool();
  if (!db) return { configured: false, reachable: false };
  try {
    await db.query('select 1');
    return { configured: true, reachable: true };
  } catch {
    return { configured: true, reachable: false };
  }
}

export async function closePostgres(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
