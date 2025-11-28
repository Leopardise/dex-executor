import { Pool } from 'pg';

const db = new Pool({
  host: process.env.PG_HOST,
  port: Number(process.env.PG_PORT || 5432),
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD || undefined,
  database: process.env.PG_DATABASE,
  max: 10, // max clients
  idleTimeoutMillis: 30000,
});

// Named exports for both styles
export { db };
export const pool = db;

// Default export if someone does `import db from '../db/pool'`
export default db;
