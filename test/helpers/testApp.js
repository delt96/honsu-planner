import { readFileSync } from 'node:fs';
import { newDb } from 'pg-mem';
import { createApp } from '../../server/app.js';

export function createTestApp() {
  const db = newDb();
  const sql = readFileSync(new URL('../../migrations/001_init.sql', import.meta.url), 'utf8');
  db.public.none(sql);
  const { Pool } = db.adapters.createPg();
  const pool = new Pool();
  const app = createApp(pool);
  return { app, pool };
}
