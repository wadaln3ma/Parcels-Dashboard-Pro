// lib/db.ts
import { Pool } from 'pg';

const hasUrl = !!process.env.DATABASE_URL;

export const pool = hasUrl
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL ? { rejectUnauthorized: false } : undefined,
    })
  : new Pool({
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT || 5432),
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'postgres',
      database: process.env.PGDATABASE || 'parcels',
      ssl: process.env.PGSSL ? { rejectUnauthorized: false } : undefined,
    });
