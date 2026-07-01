import pg from 'pg';

export function createPool() {
  return new pg.Pool({ connectionString: process.env.DATABASE_URL });
}
