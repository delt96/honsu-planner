import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { cmToPx, pxToCm, snapCm, rotatedFootprint, nextRotation, nearestWallPoint, clampFeatureOffset, wallSegment, snapRoomPosition } from '../geometry.js';
import { catKey, catColor, CATEGORY_META } from '../categories.js';
import { CategoryIcon } from '../icons.jsx';
import { Tabs } from '../Tabs.jsx';
import { RoomCard } from '../RoomCard.jsx';
import { FeatureSymbols, FeatureSymbol } from '../FeatureSymbols.jsx';
import { FeatureToolbar } from '../FeatureToolbar.jsx';
import { DistanceLabels } from '../DistanceLabels.jsx';
import { FeaturePropertyCard } from '../FeaturePropertyCard.jsx';
import { FEATURE_DEFAULTS } from '../features.js';

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
  const [selectedFeature, setSelectedFeature] = useState(null);
  const selectFeature = (id) => setSelectedFeature((cur) => (cur === id ? null : id));

  const [mode, setMode] = useState(null); // null | 'door' | 'window' | 'outlet'
  const [ghost, setGhost] = useState(null); // { roomId, wall, offset_cm, fits } | null
  const [featDrag, setFeatDrag] = useState(null); // { id, roomId, startX, startY, wall, offset_cm, width, moved }
  const suppressClick = useRef(false); // swallow the synthetic click right after a feature mouseup

  function toggleMode(kind) {
    setMode((m) => (m === kind ? null : kind));
    setGhost(null);
    setSelectedFeature(null);
  }

  // Mouse event → canvas cm coordinates (viewBox is 1:1 with px).
  const canvasCm = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: pxToCm(e.clientX - rect.left), y: pxToCm(e.clientY - rect.top) };
  };

  function moveGhost(e) {
    const { x, y } = canvasCm(e);
    const hit = nearestWallPoint(layout.rooms, x, y, 30);
    if (!hit) return setGhost(null);
    const room = layout.rooms.find((r) => r.id === hit.roomId);
    const width = FEATURE_DEFAULTS[mode].width_cm ?? 0;
    const wallLen = hit.wall === 'N' || hit.wall === 'S' ? Number(room.width_cm) : Number(room.depth_cm);
    const offset = clampFeatureOffset(room, hit.wall, snapCm(hit.offsetCm - width / 2, 5), width);
    setGhost({ roomId: room.id, wall: hit.wall, offset_cm: offset, fits: width <= wallLen });
  }

  async function placeGhost() {
    if (!ghost || !ghost.fits) return;
    try {
      setError(null);
      const created = await api.createFeature(ghost.roomId, {
        kind: mode, wall: ghost.wall, offset_cm: ghost.offset_cm, ...FEATURE_DEFAULTS[mode],
      });
      await load();
      setSelectedFeature(created.id);
    } catch (err) { setError(err.message); }
  }

  function startFeatDrag(f, room, e) {
    if (mode) return;
    e.preventDefault();
    e.stopPropagation();
    setFeatDrag({
      id: f.id, roomId: room.id, startX: e.clientX, startY: e.clientY,
      wall: f.wall, offset_cm: Number(f.offset_cm), width: Number(f.width_cm ?? 0), moved: false,
    });
  }

  function moveFeatDrag(e) {
    const { x, y } = canvasCm(e);
    setFeatDrag((d) => {
      if (!d) return d;
      const moved = d.moved || Math.abs(e.clientX - d.startX) + Math.abs(e.clientY - d.startY) >= 3;
      const room = layout.rooms.find((r) => r.id === d.roomId);
      const hit = nearestWallPoint([room], x, y, 80);
      if (!hit) return { ...d, moved };
      const offset = clampFeatureOffset(room, hit.wall, snapCm(hit.offsetCm - d.width / 2, 5), d.width);
      return { ...d, moved, wall: hit.wall, offset_cm: offset };
    });
  }

  async function endFeatDrag() {
    const d = featDrag;
    setFeatDrag(null);
    if (!d) return;
    suppressClick.current = true;
    if (!d.moved) return selectFeature(d.id);
    try { setError(null); await api.updateFeature(d.id, { wall: d.wall, offset_cm: d.offset_cm }); await load(); }
    catch (err) { setError(err.message); }
  }

  function startDrag(kind, id, e) {
    if (mode) return; // placement mode owns the canvas
    e.preventDefault();
    setDrag({ kind, id, startX: e.clientX, startY: e.clientY, dxCm: 0, dyCm: 0 });
  }
  function moveDrag(e) {
    setDrag((d) => {
      if (!d) return d;
      const dxCm = pxToCm(e.clientX - d.startX);
      const dyCm = pxToCm(e.clientY - d.startY);
      if (d.kind !== 'room') return { ...d, dxCm, dyCm };
      const r = layout.rooms.find((rm) => rm.id === d.id);
      const others = layout.rooms.filter((o) => o.id !== d.id);
      const snap = snapRoomPosition(r, others, Number(r.x) + dxCm, Number(r.y) + dyCm);
      return { ...d, dxCm: snap.x - Number(r.x), dyCm: snap.y - Number(r.y), guides: snap.guides };
    });
  }
  async function endDrag(e) {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    try {
      if (d.kind === 'room') {
        const r = layout.rooms.find((rm) => rm.id === d.id);
        const others = layout.rooms.filter((o) => o.id !== d.id);
        const rawX = Number(r.x) + pxToCm(e.clientX - d.startX);
        const rawY = Number(r.y) + pxToCm(e.clientY - d.startY);
        const snap = snapRoomPosition(r, others, rawX, rawY);
        const x = snap.snappedX ? snap.x : Number(r.x) + snapCm(rawX - Number(r.x));
        const y = snap.snappedY ? snap.y : Number(r.y) + snapCm(rawY - Number(r.y));
        if (x === Number(r.x) && y === Number(r.y)) return;
        await api.updateRoom(d.id, { x, y });
      } else {
        const ddx = snapCm(pxToCm(e.clientX - d.startX));
        const ddy = snapCm(pxToCm(e.clientY - d.startY));
        if (ddx === 0 && ddy === 0) return;
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

  useEffect(() => {
    function onKey(e) {
      if (e.key !== 'Escape') return;
      if (selectedFeature !== null) return setSelectedFeature(null);
      setMode(null);
      setGhost(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedFeature]);

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
            <FeatureToolbar mode={mode} onToggle={toggleMode} hasRooms={rooms.length > 0} />
            <span className="legend-hint">{mode ? '' : '사각형을 드래그해 배치'}</span>
          </div>
          <div className="canvas-stage">
            <svg
              className="canvas"
              width={cw}
              height={ch}
              viewBox={`0 0 ${cw} ${ch}`}
              role="img"
              aria-label="평면도"
              onMouseMove={mode ? moveGhost : featDrag ? moveFeatDrag : moveDrag}
              onMouseUp={featDrag ? endFeatDrag : endDrag}
              onMouseLeave={mode ? () => setGhost(null) : undefined}
              onClick={mode ? placeGhost : () => {
                if (suppressClick.current) { suppressClick.current = false; return; }
                setSelectedFeature(null);
              }}
            >
              {rooms.map((r) => {
                const dr = featDrag && featDrag.roomId === r.id
                  ? { ...r, features: (r.features ?? []).map((f) =>
                      f.id === featDrag.id ? { ...f, wall: featDrag.wall, offset_cm: featDrag.offset_cm } : f) }
                  : r;
                const off = liveOffset('room', r.id);
                return (
                  <g key={`room-${r.id}`} transform={`translate(${off.dx} ${off.dy})`}>
                    <rect className="room" data-testid={`room-${r.id}`}
                      onMouseDown={(e) => startDrag('room', r.id, e)}
                      x={cmToPx(r.x)} y={cmToPx(r.y)} width={cmToPx(r.width_cm)} height={cmToPx(r.depth_cm)} />
                    <text x={cmToPx(r.x) + 6} y={cmToPx(r.y) + 16} className="room-label">
                      {r.name} ({r.width_cm}×{r.depth_cm})
                    </text>
                    <FeatureSymbols room={dr} selectedId={selectedFeature} onFeatureDown={startFeatDrag} />
                    {featDrag && featDrag.roomId === r.id && featDrag.moved && (
                      <DistanceLabels room={r} wall={featDrag.wall} offsetCm={featDrag.offset_cm} widthCm={featDrag.width} />
                    )}
                  </g>
                );
              })}
              {mode && ghost && (() => {
                const room = rooms.find((r) => r.id === ghost.roomId);
                const def = FEATURE_DEFAULTS[mode];
                const fake = {
                  id: 'ghost', kind: mode, wall: ghost.wall, offset_cm: ghost.offset_cm,
                  width_cm: def.width_cm ?? null, swing: def.swing ?? null,
                };
                return (
                  <g className={`feat-ghost${ghost.fits ? '' : ' invalid'}`}>
                    <FeatureSymbol room={room} feature={fake} />
                    <DistanceLabels room={room} wall={ghost.wall} offsetCm={ghost.offset_cm} widthCm={def.width_cm ?? 0} />
                  </g>
                );
              })()}
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

              {drag?.kind === 'room' && drag.guides?.map((g, i) => g.axis === 'x' ? (
                <line key={i} className="snap-guide"
                  x1={cmToPx(g.positionCm)} y1={cmToPx(g.fromCm)} x2={cmToPx(g.positionCm)} y2={cmToPx(g.toCm)} />
              ) : (
                <line key={i} className="snap-guide"
                  x1={cmToPx(g.fromCm)} y1={cmToPx(g.positionCm)} x2={cmToPx(g.toCm)} y2={cmToPx(g.positionCm)} />
              ))}

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
            {(() => {
              for (const r of rooms) {
                for (const f of r.features ?? []) {
                  if (f.id !== selectedFeature) continue;
                  const seg = wallSegment(r, f.wall, Number(f.offset_cm), Number(f.width_cm ?? 0));
                  const anchor = { x: cmToPx((seg.x1 + seg.x2) / 2) + 14, y: cmToPx((seg.y1 + seg.y2) / 2) + 14 };
                  return <FeaturePropertyCard key={f.id} feature={f} room={r} anchor={anchor}
                    onSaved={load} onClose={() => setSelectedFeature(null)} />;
                }
              }
              return null;
            })()}
          </div>
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
            <div data-testid="room-list">
              {rooms.map((r) => (
                <RoomCard key={r.id} room={r} onChanged={load} onDelete={() => removeRoom(r.id)}
                  selectedId={selectedFeature} onSelect={selectFeature} />
              ))}
              {rooms.length === 0 && <p className="mini-list muted">아직 방이 없어요</p>}
            </div>
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
