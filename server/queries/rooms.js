export function normalizeRoomRow(r) {
  return {
    ...r,
    x: Number(r.x),
    y: Number(r.y),
    width_cm: Number(r.width_cm),
    depth_cm: Number(r.depth_cm),
    ceiling_height_cm:
      r.ceiling_height_cm === null || r.ceiling_height_cm === undefined ? null : Number(r.ceiling_height_cm),
  };
}

export async function listRooms(pool) {
  const { rows } = await pool.query('SELECT * FROM rooms ORDER BY sort_order, id');
  return rows.map(normalizeRoomRow);
}

export async function getRoom(pool, id) {
  const { rows } = await pool.query('SELECT * FROM rooms WHERE id = $1', [id]);
  return rows[0] ? normalizeRoomRow(rows[0]) : null;
}

export async function createRoom(pool, { name, width_cm, depth_cm, x, y }) {
  const { rows } = await pool.query(
    'INSERT INTO rooms (name, width_cm, depth_cm, x, y) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [name, width_cm, depth_cm, x ?? 0, y ?? 0]
  );
  return normalizeRoomRow(rows[0]);
}

export async function updateRoom(pool, id, data) {
  const cols = ['name', 'width_cm', 'depth_cm', 'x', 'y', 'sort_order', 'ceiling_height_cm'];
  const sets = [];
  const vals = [];
  let i = 1;
  for (const c of cols) {
    if (c in data) { sets.push(`${c} = $${i++}`); vals.push(data[c]); }
  }
  if (sets.length === 0) return getRoom(pool, id);
  vals.push(id);
  const { rows } = await pool.query(
    `UPDATE rooms SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    vals
  );
  return rows[0] ? normalizeRoomRow(rows[0]) : null;
}

export async function deleteRoom(pool, id) {
  const { rowCount } = await pool.query('DELETE FROM rooms WHERE id = $1', [id]);
  return rowCount > 0;
}
