import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { cmToPx, pxToCm, snapCm, rotatedFootprint, nextRotation } from '../geometry.js';
import { catKey, catColor, CATEGORY_META } from '../categories.js';
import { CategoryIcon } from '../icons.jsx';
import { Tabs } from '../Tabs.jsx';

const MARGIN_CM = 60;

function canvasExtentCm(rooms, placements) {
  let maxX = 620;
  let maxY = 440;
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
  const [drag, setDrag] = useState(null); // { kind:'room'|'item', id, startX, startY, dxCm, dyCm }

  function startDrag(kind, id, e) {
    e.preventDefault();
    setDrag({ kind, id, startX: e.clientX, startY: e.clientY, dxCm: 0, dyCm: 0 });
  }
  function moveDrag(e) {
    setDrag((d) => (d ? { ...d, dxCm: pxToCm(e.clientX - d.startX), dyCm: pxToCm(e.clientY - d.startY) } : d));
  }
  async function endDrag(e) {
    if (!drag) return;
    const ddx = snapCm(pxToCm(e.clientX - drag.startX));
    const ddy = snapCm(pxToCm(e.clientY - drag.startY));
    const d = drag;
    setDrag(null);
    if (ddx === 0 && ddy === 0) return;
    try {
      if (d.kind === 'room') {
        const r = layout.rooms.find((r) => r.id === d.id);
        await api.updateRoom(d.id, { x: r.x + ddx, y: r.y + ddy });
      } else {
        const p = layout.placements.find((p) => p.item_id === d.id);
        await api.placeItem(d.id, { x: p.x + ddx, y: p.y + ddy, rotation: p.rotation });
      }
      await load();
    } catch (err) { setError(err.message); }
  }
  const liveOffset = (kind, id) =>
    drag && drag.kind === kind && drag.id === id
      ? { dx: cmToPx(drag.dxCm), dy: cmToPx(drag.dyCm) }
      : { dx: 0, dy: 0 };

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
        <Tabs />
        {error && <p className="error">{error}</p>}
      </main>
    );
  }

  const { rooms, placements, palette, unplaceable } = layout;
  const ext = canvasExtentCm(rooms, placements);
  const cw = cmToPx(ext.w);
  const ch = cmToPx(ext.h);
  const isEmpty = rooms.length === 0 && placements.length === 0;

  return (
    <main className="container">
      <Tabs />
      <header className="page-head">
        <p className="eyebrow">우리 집 도면</p>
        <h1 className="display">평면도 배치</h1>
      </header>
      {error && <p className="error">{error}</p>}

      <div className="layout-grid">
        <div className="canvas-wrap">
          <div className="legend">
            <span className="legend-item" style={{ color: CATEGORY_META.appliance.color }}>
              <CategoryIcon category="appliance" size={15} /> 가전
            </span>
            <span className="legend-item" style={{ color: CATEGORY_META.furniture.color }}>
              <CategoryIcon category="furniture" size={15} /> 가구
            </span>
            <span className="legend-hint">사각형을 드래그해 배치</span>
          </div>
          <svg
            className="canvas"
            width={cw}
            height={ch}
            viewBox={`0 0 ${cw} ${ch}`}
            role="img"
            aria-label="평면도"
            onMouseMove={moveDrag}
            onMouseUp={endDrag}
          >
            {rooms.map((r) => {
              const off = liveOffset('room', r.id);
              return (
                <g key={`room-${r.id}`} transform={`translate(${off.dx} ${off.dy})`}>
                  <rect className="room" data-testid={`room-${r.id}`}
                    onMouseDown={(e) => startDrag('room', r.id, e)}
                    x={cmToPx(r.x)} y={cmToPx(r.y)} width={cmToPx(r.width_cm)} height={cmToPx(r.depth_cm)} />
                  <text x={cmToPx(r.x) + 6} y={cmToPx(r.y) + 16} className="room-label">
                    {r.name} ({r.width_cm}×{r.depth_cm})
                  </text>
                </g>
              );
            })}
            {placements.map((p) => {
              const f = rotatedFootprint(p.width_cm, p.depth_cm, p.rotation);
              const off = liveOffset('item', p.item_id);
              return (
                <g key={`item-${p.item_id}`} transform={`translate(${off.dx} ${off.dy})`}>
                  <rect className="furniture" data-cat={catKey(p.category)} data-testid={`furn-${p.item_id}`}
                    onMouseDown={(e) => startDrag('item', p.item_id, e)}
                    x={cmToPx(p.x)} y={cmToPx(p.y)} width={cmToPx(f.w)} height={cmToPx(f.h)} />
                  <text x={cmToPx(p.x) + 6} y={cmToPx(p.y) + 16} className="furn-label">{p.name}</text>
                </g>
              );
            })}

            {/* scale bar — architectural drawing signature */}
            <g className="scalebar" transform={`translate(14 ${ch - 16})`}>
              <line x1="0" y1="0" x2={cmToPx(100)} y2="0" />
              <line x1="0" y1="-4" x2="0" y2="4" />
              <line x1={cmToPx(100)} y1="-4" x2={cmToPx(100)} y2="4" />
              <text x={cmToPx(50)} y="-6" textAnchor="middle">1 m</text>
            </g>

            {isEmpty && (
              <text className="canvas-empty" x={cw / 2} y={ch / 2} textAnchor="middle">
                방을 추가해 평면도를 시작하세요
              </text>
            )}
          </svg>
        </div>

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
            <ul className="mini-list" data-testid="room-list">
              {rooms.map((r) => (
                <li key={r.id}>
                  <span className="mini-name">{r.name} ({r.width_cm}×{r.depth_cm})</span>
                  <button className="danger" onClick={() => removeRoom(r.id)}>삭제</button>
                </li>
              ))}
              {rooms.length === 0 && <li className="muted">아직 방이 없어요</li>}
            </ul>
          </section>

          <section>
            <h2>배치 가능</h2>
            <ul className="mini-list">
              {palette.map((it) => (
                <li key={it.item_id}>
                  <span className="cat-mark" style={{ color: catColor(it.category) }}>
                    <CategoryIcon category={catKey(it.category)} size={15} />
                  </span>
                  <span className="mini-name">{it.name} ({it.width_cm}×{it.depth_cm})</span>
                  <button onClick={() => place(it)}>배치</button>
                </li>
              ))}
              {palette.length === 0 && <li className="muted">없음</li>}
            </ul>
          </section>

          <section>
            <h2>배치됨</h2>
            <ul className="mini-list">
              {placements.map((p) => (
                <li key={p.item_id}>
                  <span className="cat-mark" style={{ color: catColor(p.category) }}>
                    <CategoryIcon category={catKey(p.category)} size={15} />
                  </span>
                  <span className="mini-name">{p.name} ({p.width_cm}×{p.depth_cm})</span>
                  <button onClick={() => rotate(p)}>회전</button>
                  <button className="danger" onClick={() => unplace(p.item_id)}>제거</button>
                </li>
              ))}
              {placements.length === 0 && <li className="muted">없음</li>}
            </ul>
          </section>

          <section>
            <h2>배치 불가 (치수 없음)</h2>
            <ul className="mini-list">
              {unplaceable.map((it) => (
                <li key={it.item_id}>
                  <span className="cat-mark" style={{ color: catColor(it.category) }}>
                    <CategoryIcon category={catKey(it.category)} size={15} />
                  </span>
                  <Link to={`/items/${it.item_id}`}>{it.name} — 치수 입력</Link>
                </li>
              ))}
              {unplaceable.length === 0 && <li className="muted">없음</li>}
            </ul>
          </section>
        </aside>
      </div>
    </main>
  );
}
