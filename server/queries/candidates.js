import { normalizeCandidateRow } from './items.js';

const COLS = ['name', 'brand', 'price', 'url', 'memo', 'width_cm', 'depth_cm', 'height_cm'];

export async function getCandidate(pool, id) {
  const { rows } = await pool.query('SELECT * FROM candidates WHERE id = $1', [id]);
  return rows[0] ? normalizeCandidateRow(rows[0]) : null;
}

export async function createCandidate(pool, itemId, value) {
  const { rows } = await pool.query(
    `INSERT INTO candidates (item_id, name, brand, price, url, memo, width_cm, depth_cm, height_cm)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [
      itemId, value.name, value.brand ?? null, value.price ?? null, value.url ?? null, value.memo ?? null,
      value.width_cm ?? null, value.depth_cm ?? null, value.height_cm ?? null,
    ]
  );
  return normalizeCandidateRow(rows[0]);
}

export async function updateCandidate(pool, id, value) {
  const sets = [];
  const vals = [];
  let i = 1;
  for (const c of COLS) {
    if (c in value) { sets.push(`${c} = $${i++}`); vals.push(value[c]); }
  }
  if (sets.length === 0) return getCandidate(pool, id);
  vals.push(id);
  const { rows } = await pool.query(
    `UPDATE candidates SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    vals
  );
  return rows[0] ? normalizeCandidateRow(rows[0]) : null;
}

export async function deleteCandidate(pool, id) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE items SET confirmed_candidate_id = NULL WHERE confirmed_candidate_id = $1', [id]);
    const { rowCount } = await client.query('DELETE FROM candidates WHERE id = $1', [id]);
    await client.query('COMMIT');
    return rowCount > 0;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
