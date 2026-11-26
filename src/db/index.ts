import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// Lazy pool singleton to avoid multiple connections in Next.js hot reload
const globalForDb = globalThis as unknown as { pool: Pool | undefined };

const connectionString = process.env.DATABASE_URL || 'postgresql://apple@localhost:5432/docmate';
const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

export const pool =
  globalForDb.pool ??
  new Pool({
    connectionString,
    max: isLocal ? 10 : 4,
    idleTimeoutMillis: 15000,
    connectionTimeoutMillis: 10000,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.pool = pool;
}

export const db = drizzle(pool, { schema });
