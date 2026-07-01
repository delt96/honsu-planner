import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { newDb } from 'pg-mem';
import { runMigrations } from '../server/migrations-runner.js';

function barePool() {
  const db = newDb();
  const { Pool } = db.adapters.createPg();
  return new Pool();
}

const sql001 = readFileSync(new URL('../migrations/001_init.sql', import.meta.url), 'utf8');

test('fresh DB: applies all migrations and records them', async () => {
  const pool = barePool();
  await runMigrations(pool);
  const { rows } = await pool.query('SELECT filename FROM schema_migrations ORDER BY filename');
  expect(rows.map((r) => r.filename)).toEqual([
    '001_init.sql',
    '002_rooms_placements.sql',
    '003_item_category.sql',
  ]);
  await pool.query('SELECT * FROM items');
  await pool.query('SELECT * FROM rooms');
});

test('re-running is an idempotent no-op', async () => {
  const pool = barePool();
  await runMigrations(pool);
  await runMigrations(pool); // must not throw
  const { rows } = await pool.query('SELECT filename FROM schema_migrations');
  expect(rows).toHaveLength(3);
});

test('pre-existing (pre-tracking) DB is back-filled, not re-run', async () => {
  const pool = barePool();
  // Simulate a Phase-1 database created before migration tracking: 001 applied directly,
  // no schema_migrations table.
  await pool.query(sql001);
  await runMigrations(pool); // must NOT throw "items already exists"
  const { rows } = await pool.query('SELECT filename FROM schema_migrations ORDER BY filename');
  expect(rows.map((r) => r.filename)).toEqual([
    '001_init.sql',
    '002_rooms_placements.sql',
    '003_item_category.sql',
  ]);
  await pool.query('SELECT * FROM rooms'); // 002 did run
});
