import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { cmToPx, rotatedFootprint, nextRotation } from '../geometry.js';

const MARGIN_CM = 50;

function canvasExtentCm(rooms, placements) {
  let maxX = 500;
  let maxY = 400;
  for (const r of rooms) {
    maxX = Math.max(maxX, r.x + r.width_cm);
    maxY = Math.max(maxY, r.y + r.depth_cm);
  }
  for (const p of placements) {
    const f = rotatedFootprint(p.width_cm, p.depth_cm, p.rotation);
    maxX = Math.max(maxX, p.x + f.w);
    maxY = Math.max(maxY, p.y + f.h);
  }
  return { w: maxX + MARGIN_CM, h: maxY + MARGIN_CM };
}

export function LayoutPage() {
  const [layout, setLayout] = useState(null);
  const [error, setError] = useState(null);
  const [room, setRoom] = useState({ name: '', width_cm: '', depth_cm: '' });

  async function load() {
    try { setLayout(await api.getLayout()); } catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, []);

  async function addRoom(e) {
    e.preventDefault();
    try { await api.createRoom(room); setRoom({ name: '', width_cm: '', depth_cm: '' }); await load(); }
    catch (e) { setError(e.message); }
  }
  async function removeRoom(id) {
    try { await api.deleteRoom(id); await load(); } catch (e) { setError(e.message); }
  }
  async function place(item) {
    try { await api.placeItem(item.item_id, { x: 10, y: 10, rotation: 0 }); await load(); }
    catch (e) { setError(e.message); }
  }
  async function rotate(p) {
    try { await api.placeItem(p.item_id, { x: p.x, y: p.y, rotation: nextRotation(p.rotation) }); await load(); }
    catch (e) { setError(e.message); }
  }
  async function unplace(itemId) {
    try { await api.unplaceItem(itemId); await load(); } catch (e) { setError(e.message); }
  }

  if (!layout) {
    return (
      <main className="container">
        <Link to="/">← 목록</Link>
        {error && <p className="error">{error}</p>}
      </main>
    );
  }

  const { rooms, placements, palette, unplaceable } = layout;
  const ext = canvasExtentCm(rooms, placements);

  return (
    <main className="container">
      <Link to="/">← 목록</Link>
      <h1>평면도 배치</h1>
      {error && <p className="error">{error}</p>}
      <div className="layout-grid">
        <svg
          className="canvas"
          width={cmToPx(ext.w)}
          height={cmToPx(ext.h)}
          viewBox={`0 0 ${cmToPx(ext.w)} ${cmToPx(ext.h)}`}
          role="img"
          aria-label="평면도"
        >
          {rooms.map((r) => (
            <g key={`room-${r.id}`}>
              <rect className="room" data-testid={`room-${r.id}`}
                x={cmToPx(r.x)} y={cmToPx(r.y)} width={cmToPx(r.width_cm)} height={cmToPx(r.depth_cm)} />
              <text x={cmToPx(r.x) + 4} y={cmToPx(r.y) + 14} className="room-label">
                {r.name} ({r.width_cm}×{r.depth_cm})
              </text>
            </g>
          ))}
          {placements.map((p) => {
            const f = rotatedFootprint(p.width_cm, p.depth_cm, p.rotation);
            return (
              <g key={`item-${p.item_id}`}>
                <rect className="furniture" data-testid={`furn-${p.item_id}`}
                  x={cmToPx(p.x)} y={cmToPx(p.y)} width={cmToPx(f.w)} height={cmToPx(f.h)} />
                <text x={cmToPx(p.x) + 4} y={cmToPx(p.y) + 14} className="furn-label">{p.name}</text>
              </g>
            );
          })}
        </svg>

        <aside className="panel">
          <section>
            <h2>새 방 추가</h2>
            <form onSubmit={addRoom} className="room-form">
              <input aria-label="방 이름" placeholder="예: 거실" value={room.name}
                onChange={(e) => setRoom({ ...room, name: e.target.value })} />
              <input aria-label="방 가로" placeholder="가로(cm)" value={room.width_cm}
                onChange={(e) => setRoom({ ...room, width_cm: e.target.value })} />
              <input aria-label="방 세로" placeholder="세로(cm)" value={room.depth_cm}
                onChange={(e) => setRoom({ ...room, depth_cm: e.target.value })} />
              <button type="submit">방 추가</button>
            </form>
            <ul className="mini-list">
              {rooms.map((r) => (
                <li key={r.id}>({r.width_cm}×{r.depth_cm}) <button className="danger" onClick={() => removeRoom(r.id)}>삭제</button></li>
              ))}
            </ul>
          </section>

          <section>
            <h2>배치 가능</h2>
            <ul className="mini-list">
              {palette.map((it) => (
                <li key={it.item_id}>{it.name} ({it.width_cm}×{it.depth_cm}) <button onClick={() => place(it)}>배치</button></li>
              ))}
              {palette.length === 0 && <li className="muted">없음</li>}
            </ul>
          </section>

          <section>
            <h2>배치됨</h2>
            <ul className="mini-list">
              {placements.map((p) => (
                <li key={p.item_id}>{p.name} ({p.width_cm}×{p.depth_cm}) <button onClick={() => rotate(p)}>회전</button> <button className="danger" onClick={() => unplace(p.item_id)}>제거</button></li>
              ))}
              {placements.length === 0 && <li className="muted">없음</li>}
            </ul>
          </section>

          <section>
            <h2>배치 불가 (치수 없음)</h2>
            <ul className="mini-list">
              {unplaceable.map((it) => (
                <li key={it.item_id}><Link to={`/items/${it.item_id}`}>{it.name} — 치수 입력</Link></li>
              ))}
              {unplaceable.length === 0 && <li className="muted">없음</li>}
            </ul>
          </section>
        </aside>
      </div>
    </main>
  );
}
