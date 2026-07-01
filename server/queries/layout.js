import { listRooms } from './rooms.js';

export async function getLayout(pool) {
  const rooms = await listRooms(pool);
  const { rows } = await pool.query(
    `SELECT i.id AS item_id, i.name, i.category,
            c.width_cm, c.depth_cm,
            p.x, p.y, p.rotation
     FROM items i
     JOIN candidates c ON c.id = i.confirmed_candidate_id
     LEFT JOIN placements p ON p.item_id = i.id
     ORDER BY i.sort_order, i.id`
  );

  const placements = [];
  const palette = [];
  const unplaceable = [];

  for (const row of rows) {
    const w = row.width_cm === null ? null : Number(row.width_cm);
    const d = row.depth_cm === null ? null : Number(row.depth_cm);
    if (w === null || d === null) {
      unplaceable.push({ item_id: row.item_id, name: row.name, category: row.category ?? null });
    } else if (row.x !== null && row.x !== undefined) {
      placements.push({
        item_id: row.item_id,
        name: row.name,
        category: row.category ?? null,
        x: Number(row.x),
        y: Number(row.y),
        rotation: Number(row.rotation),
        width_cm: w,
        depth_cm: d,
      });
    } else {
      palette.push({
        item_id: row.item_id,
        name: row.name,
        category: row.category ?? null,
        width_cm: w,
        depth_cm: d,
      });
    }
  }

  return { rooms, placements, palette, unplaceable };
}
