# 부착물 도면 직접 배치 & 방 자석 스냅 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 문·창·콘센트를 패널 폼 대신 도면 위에서 직접 배치(클릭 스탬프)·이동(벽 따라 드래그)·수정(떠 있는 속성 카드)하고, 방 드래그에 자석 스냅을 추가한다.

**Architecture:** API·DB 변경 없음 — 기존 `POST /rooms/:id/features`, `PATCH /features/:id`, `DELETE /features/:id`, `PATCH /rooms/:id`를 그대로 사용. 프론트 `web/src`만 수정한다. 기하 계산은 `geometry.js`의 순수 함수로 넣어 단위 테스트하고, LayoutPage가 배치 모드/유령/드래그 상태를 소유한다.

**Tech Stack:** React 18 + Vite, SVG 캔버스, vitest + @testing-library/react (jsdom). 스펙: `docs/superpowers/specs/2026-07-06-feature-placement-ux-design.md`

## Global Constraints

- 프론트 테스트는 `web/` 디렉토리에서 실행: `cd web && npx vitest run <파일>` (전체: `cd web && npm test`)
- 코드 주석은 영어, UI 문구는 한국어 (프로젝트 컨벤션)
- 좌표·치수는 전부 cm, 렌더 시 `PX_PER_CM = 0.6`으로 변환. jsdom에서 `getBoundingClientRect()`는 0을 반환하므로 테스트의 clientX/Y는 px→cm 변환만 고려하면 됨 (예: clientX 120 → 200cm)
- 스냅 상수: 부착물 offset 5cm, 방 그리드 10cm(기존 `snapCm` 기본), 자석 스냅 임계 15cm, 배치 유령 벽 탐지 30cm, 부착물 드래그 벽 탐지 80cm, 클릭/드래그 구분 3px
- 부착물 기본 치수: 문 `{ width_cm: 80, height_cm: 204, swing: 'in-left' }`, 창 `{ width_cm: 150, height_cm: 120, sill_height_cm: 90 }`, 콘센트 `{ floor_height_cm: 30 }`
- 서버 검증(`normalizeRoomFeature`)이 벽 길이 초과를 400으로 거부함 — 클라이언트는 유령 빨간 표시·클릭 무시로 선차단하되 서버 검증에 의존해도 안전
- CSS 변수는 기존 것만 사용: `--sans --num --ink --ink-2 --ink-3 --ink-4 --danger --surface --surface-soft --surface-soft2 --sh-xs --sh-sm --rose-soft` (`--sh-md`는 없음)

---

### Task 1: geometry — `nearestWallPoint` + `clampFeatureOffset`

**Files:**
- Modify: `web/src/geometry.js` (파일 끝에 추가)
- Test: `web/src/geometry.test.js`

**Interfaces:**
- Consumes: 기존 `wallSegment` 좌표 규약 (N/S 벽 offset 기준점 = 서쪽 모서리, E/W = 북쪽 모서리)
- Produces: `nearestWallPoint(rooms, cmX, cmY, thresholdCm = 30) → { roomId, wall, offsetCm } | null`, `clampFeatureOffset(room, wall, offsetCm, widthCm = 0) → number` — Task 4, 7이 사용

- [ ] **Step 1: 실패하는 테스트 작성**

`web/src/geometry.test.js` 끝에 추가:

```js
import { nearestWallPoint, clampFeatureOffset } from './geometry.js';
// (실제로는 파일 상단 기존 import 줄에 두 이름을 추가한다)

const NEAR_ROOM = { id: 1, x: 100, y: 50, width_cm: 400, depth_cm: 300 };

test('nearestWallPoint projects the cursor onto the closest wall', () => {
  expect(nearestWallPoint([NEAR_ROOM], 250, 60)).toEqual({ roomId: 1, wall: 'N', offsetCm: 150 });
  expect(nearestWallPoint([NEAR_ROOM], 110, 200)).toEqual({ roomId: 1, wall: 'W', offsetCm: 150 });
  expect(nearestWallPoint([NEAR_ROOM], 495, 200)).toEqual({ roomId: 1, wall: 'E', offsetCm: 150 });
  expect(nearestWallPoint([NEAR_ROOM], 250, 340)).toEqual({ roomId: 1, wall: 'S', offsetCm: 150 });
});

test('nearestWallPoint returns null beyond the threshold or outside the wall extent', () => {
  expect(nearestWallPoint([NEAR_ROOM], 250, 200, 30)).toBeNull(); // room center
  expect(nearestWallPoint([NEAR_ROOM], 250, 10, 30)).toBeNull();  // 40cm above N wall
  expect(nearestWallPoint([NEAR_ROOM], 600, 60, 30)).toBeNull();  // past the NE corner
  expect(nearestWallPoint([NEAR_ROOM], 250, 80, 30)).toEqual({ roomId: 1, wall: 'N', offsetCm: 150 }); // exactly 30cm
});

test('nearestWallPoint picks the closest wall across multiple rooms', () => {
  const other = { id: 2, x: 600, y: 50, width_cm: 200, depth_cm: 200 };
  expect(nearestWallPoint([NEAR_ROOM, other], 610, 150)).toEqual({ roomId: 2, wall: 'W', offsetCm: 100 });
});

test('clampFeatureOffset keeps the feature inside its wall', () => {
  const room = { width_cm: 400, depth_cm: 300 };
  expect(clampFeatureOffset(room, 'N', -10, 80)).toBe(0);
  expect(clampFeatureOffset(room, 'N', 350, 80)).toBe(320);
  expect(clampFeatureOffset(room, 'E', 280, 0)).toBe(280);
  expect(clampFeatureOffset(room, 'E', 310, 0)).toBe(300);
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd web && npx vitest run src/geometry.test.js`
Expected: FAIL — `nearestWallPoint is not a function` (또는 export 없음)

- [ ] **Step 3: 구현**

`web/src/geometry.js` 끝에 추가:

```js
// Project a cursor point (cm, canvas coords) onto the nearest wall among rooms.
// Only walls whose parallel extent contains the cursor count; returns null when
// every wall is farther than thresholdCm (perpendicular distance).
export function nearestWallPoint(rooms, cmX, cmY, thresholdCm = 30) {
  let best = null;
  for (const room of rooms) {
    const x = Number(room.x), y = Number(room.y);
    const w = Number(room.width_cm), d = Number(room.depth_cm);
    const candidates = [
      { wall: 'N', dist: Math.abs(cmY - y), offset: cmX - x, inRange: cmX >= x && cmX <= x + w },
      { wall: 'S', dist: Math.abs(cmY - (y + d)), offset: cmX - x, inRange: cmX >= x && cmX <= x + w },
      { wall: 'W', dist: Math.abs(cmX - x), offset: cmY - y, inRange: cmY >= y && cmY <= y + d },
      { wall: 'E', dist: Math.abs(cmX - (x + w)), offset: cmY - y, inRange: cmY >= y && cmY <= y + d },
    ];
    for (const c of candidates) {
      if (!c.inRange || c.dist > thresholdCm) continue;
      if (!best || c.dist < best.dist) best = { roomId: room.id, wall: c.wall, offsetCm: c.offset, dist: c.dist };
    }
  }
  return best ? { roomId: best.roomId, wall: best.wall, offsetCm: best.offsetCm } : null;
}

// Clamp a feature of widthCm so it stays fully on the wall: [0, wallLen - widthCm].
export function clampFeatureOffset(room, wall, offsetCm, widthCm = 0) {
  const wallLen = wall === 'N' || wall === 'S' ? Number(room.width_cm) : Number(room.depth_cm);
  return Math.min(Math.max(offsetCm, 0), Math.max(wallLen - widthCm, 0));
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd web && npx vitest run src/geometry.test.js`
Expected: PASS (기존 테스트 포함 전부)

- [ ] **Step 5: Commit**

```bash
git add web/src/geometry.js web/src/geometry.test.js
git commit -m "feat: nearestWallPoint + clampFeatureOffset geometry helpers"
```

---

### Task 2: geometry — `snapRoomPosition` (방 자석 스냅 계산)

**Files:**
- Modify: `web/src/geometry.js` (파일 끝에 추가)
- Test: `web/src/geometry.test.js`

**Interfaces:**
- Produces: `snapRoomPosition(room, otherRooms, proposedX, proposedY, thresholdCm = 15) → { x, y, snappedX, snappedY, guides }` — `guides`는 `{ axis: 'x'|'y', positionCm, fromCm, toCm }` 배열. Task 8이 사용.
  - `axis: 'x'` = `x = positionCm`에 세로선(`fromCm`~`toCm`는 y 범위), `axis: 'y'` = 가로선.

- [ ] **Step 1: 실패하는 테스트 작성**

`web/src/geometry.test.js` 끝에 추가 (import에 `snapRoomPosition` 추가):

```js
const ME = { id: 1, x: 0, y: 0, width_cm: 200, depth_cm: 200 };
const NEIGHBOR = { id: 2, x: 300, y: 0, width_cm: 400, depth_cm: 300 };

test('snapRoomPosition: right edge sticks flush to a neighbor left wall within 15cm', () => {
  const r = snapRoomPosition(ME, [NEIGHBOR], 92, 100); // my right edge 292 vs their left 300
  expect(r.x).toBe(100);
  expect(r.snappedX).toBe(true);
  expect(r.y).toBe(100);
  expect(r.snappedY).toBe(false);
  expect(r.guides).toEqual([{ axis: 'x', positionCm: 300, fromCm: 0, toCm: 300 }]);
});

test('snapRoomPosition: corners align on the perpendicular axis', () => {
  const r = snapRoomPosition(ME, [NEIGHBOR], 100, 12); // x flush + top edges 12cm apart
  expect(r.x).toBe(100);
  expect(r.y).toBe(0);
  expect(r.snappedY).toBe(true);
  expect(r.guides).toHaveLength(2);
});

test('snapRoomPosition: no snap beyond the threshold', () => {
  const r = snapRoomPosition(ME, [NEIGHBOR], 60, 100);
  expect(r).toMatchObject({ x: 60, y: 100, snappedX: false, snappedY: false, guides: [] });
});

test('snapRoomPosition: far-away rooms on the perpendicular axis do not grab', () => {
  const r = snapRoomPosition(ME, [NEIGHBOR], 92, 340); // y ranges 340~540 vs 0~300, gap > 15
  expect(r.snappedX).toBe(false);
  expect(r.x).toBe(92);
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd web && npx vitest run src/geometry.test.js`
Expected: FAIL — `snapRoomPosition is not a function`

- [ ] **Step 3: 구현**

`web/src/geometry.js` 끝에 추가:

```js
// Magnetic snap for room dragging: pull the proposed position flush against other
// rooms' walls and align matching corners. Each axis snaps independently, but only
// against neighbors whose extent on the perpendicular axis is within thresholdCm,
// so far-away rooms don't grab the drag. Guides describe the shared edge to draw.
export function snapRoomPosition(room, otherRooms, proposedX, proposedY, thresholdCm = 15) {
  const w = Number(room.width_cm), d = Number(room.depth_cm);
  let bestX = null, bestY = null;
  for (const o of otherRooms) {
    const ox = Number(o.x), oy = Number(o.y), ow = Number(o.width_cm), od = Number(o.depth_cm);
    const nearY = proposedY <= oy + od + thresholdCm && proposedY + d >= oy - thresholdCm;
    const nearX = proposedX <= ox + ow + thresholdCm && proposedX + w >= ox - thresholdCm;
    if (nearY) {
      // candidate x positions: flush right-to-left, flush left-to-right, left edges, right edges
      for (const c of [
        { x: ox - w, pos: ox },
        { x: ox + ow, pos: ox + ow },
        { x: ox, pos: ox },
        { x: ox + ow - w, pos: ox + ow },
      ]) {
        const delta = Math.abs(proposedX - c.x);
        if (delta <= thresholdCm && (!bestX || delta < bestX.delta)) bestX = { ...c, delta, o };
      }
    }
    if (nearX) {
      for (const c of [
        { y: oy - d, pos: oy },
        { y: oy + od, pos: oy + od },
        { y: oy, pos: oy },
        { y: oy + od - d, pos: oy + od },
      ]) {
        const delta = Math.abs(proposedY - c.y);
        if (delta <= thresholdCm && (!bestY || delta < bestY.delta)) bestY = { ...c, delta, o };
      }
    }
  }
  const x = bestX ? bestX.x : proposedX;
  const y = bestY ? bestY.y : proposedY;
  const guides = [];
  if (bestX) guides.push({
    axis: 'x', positionCm: bestX.pos,
    fromCm: Math.min(y, Number(bestX.o.y)),
    toCm: Math.max(y + d, Number(bestX.o.y) + Number(bestX.o.depth_cm)),
  });
  if (bestY) guides.push({
    axis: 'y', positionCm: bestY.pos,
    fromCm: Math.min(x, Number(bestY.o.x)),
    toCm: Math.max(x + w, Number(bestY.o.x) + Number(bestY.o.width_cm)),
  });
  return { x, y, snappedX: !!bestX, snappedY: !!bestY, guides };
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd web && npx vitest run src/geometry.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/geometry.js web/src/geometry.test.js
git commit -m "feat: snapRoomPosition magnetic room snapping"
```

---

### Task 3: `FeatureSymbol` 단일 렌더러 분리 + `DistanceLabels` 컴포넌트

**Files:**
- Modify: `web/src/FeatureSymbols.jsx` (순수 리팩터 — 렌더 결과 동일 유지)
- Create: `web/src/DistanceLabels.jsx`
- Create: `web/src/DistanceLabels.test.jsx`
- Modify: `web/src/styles.css` (`.dist-label` 추가)

**Interfaces:**
- Consumes: `wallSegment`, `doorArcPath`, `cmToPx` (geometry.js), `featureChip` (features.js)
- Produces:
  - `FeatureSymbol({ room, feature, selected = false, onClick, onMouseDown })` — 기호 1개 렌더. `data-testid={'feat-' + feature.id}`, className `feat-sym feat-<kind>[ selected]`. Task 4(유령), 7(드래그)이 사용.
  - `FeatureSymbols({ room, selectedId, onSelect })` — 기존과 동일한 시그니처·DOM 유지 (칩 포함). Task 5, 7에서 수정됨.
  - `DistanceLabels({ room, wall, offsetCm, widthCm = 0 })` — 부착물 양쪽 모서리까지 거리 텍스트(SVG). Task 4, 7이 사용.

- [ ] **Step 1: DistanceLabels 실패 테스트 작성**

`web/src/DistanceLabels.test.jsx` 생성:

```jsx
import { render, screen } from '@testing-library/react';
import { test, expect } from 'vitest';
import { DistanceLabels } from './DistanceLabels.jsx';

const ROOM = { x: 0, y: 0, width_cm: 400, depth_cm: 300 };

test('shows distances from the feature to both wall corners', () => {
  render(<svg><DistanceLabels room={ROOM} wall="N" offsetCm={130} widthCm={60} /></svg>);
  expect(screen.getByText('130')).toBeInTheDocument();
  expect(screen.getByText('210')).toBeInTheDocument(); // 400 - 130 - 60
});

test('omits a zero-length side', () => {
  render(<svg><DistanceLabels room={ROOM} wall="N" offsetCm={0} widthCm={60} /></svg>);
  expect(screen.queryByText('0')).not.toBeInTheDocument();
  expect(screen.getByText('340')).toBeInTheDocument();
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd web && npx vitest run src/DistanceLabels.test.jsx`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: DistanceLabels 구현**

`web/src/DistanceLabels.jsx` 생성:

```jsx
import { cmToPx, wallSegment } from './geometry.js';

// Live distance readout (cm) from a wall feature to both corners of its wall.
// Used by the placement ghost and by feature dragging.
export function DistanceLabels({ room, wall, offsetCm, widthCm = 0 }) {
  const wallLen = wall === 'N' || wall === 'S' ? Number(room.width_cm) : Number(room.depth_cm);
  const seg = wallSegment(room, wall, offsetCm, widthCm);
  const start = wallSegment(room, wall, 0, 0);
  const end = wallSegment(room, wall, wallLen, 0);
  const vertical = wall === 'E' || wall === 'W';
  const label = (a, b, text, key) => (
    <text key={key} className="dist-label"
      x={cmToPx((a[0] + b[0]) / 2) - (vertical ? 8 : 0)}
      y={cmToPx((a[1] + b[1]) / 2) - (vertical ? 0 : 6)}
      textAnchor="middle">{text}</text>
  );
  const left = Math.round(offsetCm);
  const right = Math.round(wallLen - offsetCm - widthCm);
  return (
    <g className="dist-labels">
      {left > 0 && label([start.x1, start.y1], [seg.x1, seg.y1], String(left), 'a')}
      {right > 0 && label([seg.x2, seg.y2], [end.x1, end.y1], String(right), 'b')}
    </g>
  );
}
```

`web/src/styles.css`의 `.feat-chip` 규칙 아래에 추가:

```css
.dist-label { font: 600 10px var(--num); fill: var(--ink-3); paint-order: stroke; stroke: #fff; stroke-width: 3px; stroke-linejoin: round; }
```

- [ ] **Step 4: 통과 확인**

Run: `cd web && npx vitest run src/DistanceLabels.test.jsx`
Expected: PASS

- [ ] **Step 5: FeatureSymbols를 단일 렌더러 + 래퍼로 리팩터 (동작 불변)**

`web/src/FeatureSymbols.jsx` 전체를 다음으로 교체:

```jsx
import { cmToPx, wallSegment, doorArcPath } from './geometry.js';
import { featureChip } from './features.js';

// Single wall-attachment symbol: door = wall gap + swing arc, window = double
// line on the wall, outlet = dot. Reused by the placement ghost (Task 4).
export function FeatureSymbol({ room, feature: f, selected = false, onClick, onMouseDown }) {
  const seg = wallSegment(room, f.wall, Number(f.offset_cm), Number(f.width_cm ?? 0));
  const common = {
    className: `feat-sym feat-${f.kind}${selected ? ' selected' : ''}`,
    'data-testid': `feat-${f.id}`,
    onClick,
    onMouseDown,
  };
  if (f.kind === 'door') {
    return (
      <g {...common}>
        <line className="door-gap" x1={cmToPx(seg.x1)} y1={cmToPx(seg.y1)} x2={cmToPx(seg.x2)} y2={cmToPx(seg.y2)} />
        <path className="door-arc" d={doorArcPath(room, f)} />
      </g>
    );
  }
  if (f.kind === 'window') {
    const vertical = f.wall === 'E' || f.wall === 'W';
    const ox = vertical ? 2 : 0;
    const oy = vertical ? 0 : 2;
    return (
      <g {...common}>
        <line className="win-line" x1={cmToPx(seg.x1) - ox} y1={cmToPx(seg.y1) - oy} x2={cmToPx(seg.x2) - ox} y2={cmToPx(seg.y2) - oy} />
        <line className="win-line" x1={cmToPx(seg.x1) + ox} y1={cmToPx(seg.y1) + oy} x2={cmToPx(seg.x2) + ox} y2={cmToPx(seg.y2) + oy} />
      </g>
    );
  }
  return (
    <g {...common}>
      <circle className="outlet-dot" cx={cmToPx(seg.x1)} cy={cmToPx(seg.y1)} r={4} />
    </g>
  );
}

// A room's attachments plus the selected feature's info chip (chip is replaced
// by the property card in a later task).
export function FeatureSymbols({ room, selectedId = null, onSelect = () => {} }) {
  return (room.features ?? []).map((f) => {
    const seg = wallSegment(room, f.wall, Number(f.offset_cm), Number(f.width_cm ?? 0));
    const selected = selectedId === f.id;
    return (
      <g key={f.id}>
        <FeatureSymbol room={room} feature={f} selected={selected} onClick={() => onSelect(f.id)} />
        {selected && (
          <text className="feat-chip" x={cmToPx((seg.x1 + seg.x2) / 2)} y={cmToPx((seg.y1 + seg.y2) / 2) - 10} textAnchor="middle">
            {featureChip(f)}
          </text>
        )}
      </g>
    );
  });
}
```

- [ ] **Step 6: 회귀 없음 확인 (전체 프론트 테스트)**

Run: `cd web && npm test`
Expected: PASS — 특히 `LayoutPage.test.jsx`의 `renders wall feature symbols and toggles the info chip on click`이 그대로 통과

- [ ] **Step 7: Commit**

```bash
git add web/src/FeatureSymbols.jsx web/src/DistanceLabels.jsx web/src/DistanceLabels.test.jsx web/src/styles.css
git commit -m "refactor: extract FeatureSymbol renderer; add DistanceLabels"
```

---

### Task 4: 도구바 + 클릭 배치 모드 + 유령 미리보기 + 클릭 생성

**Files:**
- Modify: `web/src/features.js` (`FEATURE_DEFAULTS` 추가)
- Create: `web/src/FeatureToolbar.jsx`
- Modify: `web/src/pages/LayoutPage.jsx`
- Modify: `web/src/styles.css`
- Test: `web/src/pages/LayoutPage.test.jsx`

**Interfaces:**
- Consumes: `nearestWallPoint`, `clampFeatureOffset`, `snapCm` (Task 1), `FeatureSymbol`, `DistanceLabels` (Task 3), `api.createFeature(roomId, data)`
- Produces:
  - `FEATURE_DEFAULTS` (features.js): Global Constraints의 기본 치수 그대로
  - `FeatureToolbar({ mode, onToggle, hasRooms })` — 버튼 접근명은 `🚪 문`, `⊞ 창문`, `⚡ 콘센트`
  - LayoutPage state: `mode` (null|'door'|'window'|'outlet'), `ghost` ({ roomId, wall, offset_cm, fits } | null) — Task 5, 7이 이 구조를 이어받음

- [ ] **Step 1: 실패하는 테스트 작성**

`web/src/pages/LayoutPage.test.jsx` 끝에 추가:

```jsx
test('클릭 배치: 도구 선택 → 유령 표시 → 벽 클릭 → 기본치수로 생성', async () => {
  api.getLayout.mockResolvedValue(LAYOUT);
  api.createFeature.mockResolvedValue({ id: 42 });
  render(<MemoryRouter><LayoutPage /></MemoryRouter>);
  await screen.findByTestId('room-1');
  await userEvent.click(screen.getByRole('button', { name: '🚪 문' }));
  const svg = screen.getByRole('img', { name: '평면도' });
  // cursor at cm (200, 5): near room-1's N wall → ghost centered → offset 200-40=160
  fireEvent.mouseMove(svg, { clientX: 120, clientY: 3 });
  expect(screen.getByTestId('feat-ghost')).toBeInTheDocument();
  expect(screen.getAllByText('160')).toHaveLength(2); // corner distances on both sides
  fireEvent.click(svg, { clientX: 120, clientY: 3 });
  await waitFor(() => expect(api.createFeature).toHaveBeenCalledWith(1, {
    kind: 'door', wall: 'N', offset_cm: 160, width_cm: 80, height_cm: 204, swing: 'in-left',
  }));
});

test('벽에서 먼 곳에서는 유령이 없고 클릭해도 생성되지 않는다', async () => {
  api.getLayout.mockResolvedValue(LAYOUT);
  render(<MemoryRouter><LayoutPage /></MemoryRouter>);
  await screen.findByTestId('room-1');
  await userEvent.click(screen.getByRole('button', { name: '⚡ 콘센트' }));
  const svg = screen.getByRole('img', { name: '평면도' });
  fireEvent.mouseMove(svg, { clientX: 120, clientY: 150 }); // cm (200, 250): room center
  expect(screen.queryByTestId('feat-ghost')).not.toBeInTheDocument();
  fireEvent.click(svg, { clientX: 120, clientY: 150 });
  expect(api.createFeature).not.toHaveBeenCalled();
});

test('ESC가 배치 모드를 종료한다', async () => {
  api.getLayout.mockResolvedValue(LAYOUT);
  render(<MemoryRouter><LayoutPage /></MemoryRouter>);
  await screen.findByTestId('room-1');
  await userEvent.click(screen.getByRole('button', { name: '🚪 문' }));
  const svg = screen.getByRole('img', { name: '평면도' });
  fireEvent.mouseMove(svg, { clientX: 120, clientY: 3 });
  expect(screen.getByTestId('feat-ghost')).toBeInTheDocument();
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.queryByTestId('feat-ghost')).not.toBeInTheDocument();
  fireEvent.click(svg, { clientX: 120, clientY: 3 });
  expect(api.createFeature).not.toHaveBeenCalled();
});

test('벽보다 넓은 부착물 유령은 invalid로 표시되고 클릭이 무시된다', async () => {
  api.getLayout.mockResolvedValue({
    rooms: [{ id: 3, name: '팬트리', x: 0, y: 0, width_cm: 60, depth_cm: 60 }],
    placements: [], palette: [], unplaceable: [],
  });
  render(<MemoryRouter><LayoutPage /></MemoryRouter>);
  await screen.findByTestId('room-3');
  await userEvent.click(screen.getByRole('button', { name: '🚪 문' })); // door 80 > wall 60
  const svg = screen.getByRole('img', { name: '평면도' });
  fireEvent.mouseMove(svg, { clientX: 18, clientY: 3 }); // cm (30, 5): N wall
  expect(screen.getByTestId('feat-ghost').closest('g.feat-ghost')).toHaveClass('invalid');
  fireEvent.click(svg, { clientX: 18, clientY: 3 });
  expect(api.createFeature).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd web && npx vitest run src/pages/LayoutPage.test.jsx`
Expected: FAIL — `🚪 문` 버튼 없음

- [ ] **Step 3: `FEATURE_DEFAULTS` 추가**

`web/src/features.js`의 `FEATURE_META` 아래에 추가:

```js
// Default dimensions when stamping a new feature on the plan (typical KR sizes).
export const FEATURE_DEFAULTS = {
  door: { width_cm: 80, height_cm: 204, swing: 'in-left' },
  window: { width_cm: 150, height_cm: 120, sill_height_cm: 90 },
  outlet: { floor_height_cm: 30 },
};
```

- [ ] **Step 4: `FeatureToolbar` 생성**

`web/src/FeatureToolbar.jsx` 생성:

```jsx
import { FEATURE_META } from './features.js';

// Placement-mode toggle buttons for stamping doors/windows/outlets on the plan.
export function FeatureToolbar({ mode, onToggle, hasRooms }) {
  return (
    <div className="feat-toolbar" role="toolbar" aria-label="부착물 도구">
      {Object.entries(FEATURE_META).map(([kind, m]) => (
        <button key={kind} type="button" className={mode === kind ? 'active' : ''}
          aria-pressed={mode === kind} onClick={() => onToggle(kind)}>
          {m.icon} {m.label}
        </button>
      ))}
      {mode && (
        <span className="feat-toolbar-hint">
          {hasRooms ? '벽을 클릭해 배치 · ESC 취소' : '방을 먼저 추가하세요'}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 5: LayoutPage에 배치 모드 통합**

`web/src/pages/LayoutPage.jsx` 수정:

import 블록을 다음으로 갱신:

```jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { cmToPx, pxToCm, snapCm, rotatedFootprint, nextRotation, nearestWallPoint, clampFeatureOffset } from '../geometry.js';
import { catKey, catColor, CATEGORY_META } from '../categories.js';
import { CategoryIcon } from '../icons.jsx';
import { Tabs } from '../Tabs.jsx';
import { RoomCard } from '../RoomCard.jsx';
import { FeatureSymbols, FeatureSymbol } from '../FeatureSymbols.jsx';
import { FeatureToolbar } from '../FeatureToolbar.jsx';
import { DistanceLabels } from '../DistanceLabels.jsx';
import { FEATURE_DEFAULTS } from '../features.js';
```

컴포넌트 상단 state에 추가 (`selectedFeature` 아래):

```jsx
const [mode, setMode] = useState(null); // null | 'door' | 'window' | 'outlet'
const [ghost, setGhost] = useState(null); // { roomId, wall, offset_cm, fits } | null

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
```

ESC 처리 useEffect 추가 (`useEffect(() => { load(); }, [])` 아래) — 카드(선택)가 열려 있으면 먼저 닫고, 다음 ESC에서 모드 종료:

```jsx
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
```

`startDrag` 첫 줄에 모드 가드 추가:

```jsx
function startDrag(kind, id, e) {
  if (mode) return; // placement mode owns the canvas
  e.preventDefault();
  setDrag({ kind, id, startX: e.clientX, startY: e.clientY, dxCm: 0, dyCm: 0 });
}
```

legend div를 다음으로 교체 (도구바 삽입):

```jsx
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
```

svg 태그의 이벤트 핸들러를 다음으로 교체:

```jsx
onMouseMove={mode ? moveGhost : moveDrag}
onMouseUp={endDrag}
onMouseLeave={mode ? () => setGhost(null) : undefined}
onClick={mode ? placeGhost : undefined}
```

svg 안, `{placements.map(...)}` 바로 위에 유령 렌더 추가:

```jsx
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
```

- [ ] **Step 6: CSS 추가**

`web/src/styles.css`의 `.dist-label` 아래에 추가:

```css
.feat-toolbar { display: flex; gap: 6px; align-items: center; }
.feat-toolbar button { font: 600 11.5px var(--sans); min-height: 0; padding: 5px 10px; border-radius: 8px; background: var(--surface-soft2); color: var(--ink-2); }
.feat-toolbar button:hover { background: var(--chip); }
.feat-toolbar button.active { background: var(--ink); color: #fff; }
.feat-toolbar-hint { font: 500 11px var(--sans); color: var(--ink-4); }

.feat-ghost { opacity: 0.55; pointer-events: none; }
.feat-ghost.invalid .door-arc, .feat-ghost.invalid .win-line { stroke: var(--danger); }
.feat-ghost.invalid .outlet-dot { fill: var(--danger); }
```

(`--chip` 변수가 없으면 해당 hover 줄은 `background: var(--surface-soft)`로 대체 — `styles.css` 상단 `:root`에서 확인.)

- [ ] **Step 7: 통과 확인 + 전체 회귀**

Run: `cd web && npx vitest run src/pages/LayoutPage.test.jsx`
Expected: PASS (신규 4개 + 기존 전부)

Run: `cd web && npm test`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add web/src/features.js web/src/FeatureToolbar.jsx web/src/pages/LayoutPage.jsx web/src/styles.css web/src/pages/LayoutPage.test.jsx
git commit -m "feat: click-to-place mode with wall-snapped ghost and corner distances"
```

---

### Task 5: 떠 있는 속성 카드 (칩 대체)

**Files:**
- Create: `web/src/FeaturePropertyCard.jsx`
- Modify: `web/src/FeatureSymbols.jsx` (칩 제거)
- Modify: `web/src/features.js` (`featureChip` 삭제)
- Modify: `web/src/features.test.js` (featureChip 테스트 2개 삭제)
- Modify: `web/src/pages/LayoutPage.jsx` (카드 통합 + `canvas-stage` 래퍼)
- Modify: `web/src/styles.css`
- Test: `web/src/pages/LayoutPage.test.jsx`

**Interfaces:**
- Consumes: `api.updateFeature(id, data)`, `api.deleteFeature(id)`, `wallSegment`, `cmToPx`, `FEATURE_META`, LayoutPage의 `selectedFeature` state
- Produces: `FeaturePropertyCard({ feature, room, anchor, onSaved, onClose })` — `anchor`는 `{ x, y }` px. `data-testid={'feat-card-' + feature.id}`. 입력 접근명: `왼쪽 모서리에서`, `오른쪽 모서리에서`, `폭`, `통과 높이`, `창 높이`, `창턱`, `바닥에서`. 토글 버튼명: `안` `밖` `좌` `우`.

- [ ] **Step 1: 실패하는 테스트 작성**

`web/src/pages/LayoutPage.test.jsx`에서 기존 테스트 `renders wall feature symbols and toggles the info chip on click`을 **삭제**하고, 파일 끝에 추가:

```jsx
const FEAT_LAYOUT = {
  rooms: [{ id: 1, name: '거실', x: 0, y: 0, width_cm: 400, depth_cm: 500, ceiling_height_cm: null, features: [
    { id: 11, kind: 'window', wall: 'N', offset_cm: 90, width_cm: 180, height_cm: 120, sill_height_cm: 90, floor_height_cm: null, swing: null },
    { id: 12, kind: 'door', wall: 'S', offset_cm: 30, width_cm: 80, height_cm: 204, sill_height_cm: null, floor_height_cm: null, swing: 'in-left' },
  ] }],
  placements: [], palette: [], unplaceable: [],
};

test('기호 클릭 → 속성 카드: 오른쪽 모서리 입력이 offset으로 환산 저장된다', async () => {
  api.getLayout.mockResolvedValue(FEAT_LAYOUT);
  api.updateFeature.mockResolvedValue({});
  render(<MemoryRouter><LayoutPage /></MemoryRouter>);
  fireEvent.click(await screen.findByTestId('feat-11'));
  const card = screen.getByTestId('feat-card-11');
  const right = within(card).getByLabelText('오른쪽 모서리에서');
  expect(right).toHaveValue('130'); // 400 - 90 - 180
  await userEvent.clear(right);
  await userEvent.type(right, '100');
  await userEvent.tab();
  await waitFor(() => expect(api.updateFeature).toHaveBeenCalledWith(11, { offset_cm: 120 })); // 400 - 180 - 100
});

test('문 열림 토글은 즉시 저장된다', async () => {
  api.getLayout.mockResolvedValue(FEAT_LAYOUT);
  api.updateFeature.mockResolvedValue({});
  render(<MemoryRouter><LayoutPage /></MemoryRouter>);
  fireEvent.click(await screen.findByTestId('feat-12'));
  await userEvent.click(within(screen.getByTestId('feat-card-12')).getByRole('button', { name: '밖' }));
  await waitFor(() => expect(api.updateFeature).toHaveBeenCalledWith(12, { swing: 'out-left' }));
});

test('카드의 삭제 버튼이 deleteFeature를 호출하고 카드를 닫는다', async () => {
  api.getLayout.mockResolvedValue(FEAT_LAYOUT);
  api.deleteFeature.mockResolvedValue(null);
  render(<MemoryRouter><LayoutPage /></MemoryRouter>);
  fireEvent.click(await screen.findByTestId('feat-11'));
  await userEvent.click(within(screen.getByTestId('feat-card-11')).getByRole('button', { name: '삭제' }));
  await waitFor(() => expect(api.deleteFeature).toHaveBeenCalledWith(11));
  expect(screen.queryByTestId('feat-card-11')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd web && npx vitest run src/pages/LayoutPage.test.jsx`
Expected: FAIL — `feat-card-11` 없음

- [ ] **Step 3: FeaturePropertyCard 구현**

`web/src/FeaturePropertyCard.jsx` 생성:

```jsx
import { useEffect, useState } from 'react';
import { api } from './api.js';
import { FEATURE_META } from './features.js';

const wallLenOf = (room, wall) => (wall === 'N' || wall === 'S' ? Number(room.width_cm) : Number(room.depth_cm));
const blurOnEnter = (e) => { if (e.key === 'Enter') e.target.blur(); };
const initForm = (f, wallLen, width) => ({
  left: String(Number(f.offset_cm)),
  right: String(wallLen - Number(f.offset_cm) - width),
  width_cm: f.width_cm ?? '',
  height_cm: f.height_cm ?? '',
  sill_height_cm: f.sill_height_cm ?? '',
  floor_height_cm: f.floor_height_cm ?? '',
});

// Floating property card for the selected wall feature. Numeric fields save on
// blur/Enter; swing toggles save immediately. Position can be entered from
// either wall corner (the other side is derived).
export function FeaturePropertyCard({ feature: f, room, anchor, onSaved, onClose }) {
  const wallLen = wallLenOf(room, f.wall);
  const width = Number(f.width_cm ?? 0);
  const [form, setForm] = useState(() => initForm(f, wallLen, width));
  const [error, setError] = useState(null);
  useEffect(() => { setForm(initForm(f, wallLen, width)); setError(null); }, [f]);

  async function save(patch) {
    try { setError(null); await api.updateFeature(f.id, patch); await onSaved(); }
    catch (e) { setError(e.message); setForm(initForm(f, wallLen, width)); }
  }
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const saveField = (k) => () => { if (String(f[k] ?? '') !== String(form[k])) save({ [k]: form[k] }); };
  function saveLeft() {
    const n = Number(form.left);
    if (Number.isFinite(n) && n !== Number(f.offset_cm)) save({ offset_cm: n });
  }
  function saveRight() {
    const n = Number(form.right);
    if (!Number.isFinite(n)) return;
    const off = wallLen - width - n;
    if (off !== Number(f.offset_cm)) save({ offset_cm: off });
  }
  async function remove() {
    try { await api.deleteFeature(f.id); await onSaved(); onClose(); }
    catch (e) { setError(e.message); }
  }
  const [dir, side] = (f.swing ?? 'in-left').split('-');

  return (
    <div className="feat-card" style={{ left: anchor.x, top: anchor.y }} data-testid={`feat-card-${f.id}`}>
      <div className="feat-card-head">
        <span>{FEATURE_META[f.kind].icon} {FEATURE_META[f.kind].label}</span>
        <button type="button" className="danger" onClick={remove}>삭제</button>
        <button type="button" aria-label="닫기" onClick={onClose}>✕</button>
      </div>
      {error && <p className="error">{error}</p>}
      <label>왼쪽 모서리에서(cm)
        <input aria-label="왼쪽 모서리에서" value={form.left} onChange={set('left')} onBlur={saveLeft} onKeyDown={blurOnEnter} />
      </label>
      <label>오른쪽 모서리에서(cm)
        <input aria-label="오른쪽 모서리에서" value={form.right} onChange={set('right')} onBlur={saveRight} onKeyDown={blurOnEnter} />
      </label>
      {f.kind !== 'outlet' && (
        <label>폭(cm)
          <input aria-label="폭" value={form.width_cm} onChange={set('width_cm')} onBlur={saveField('width_cm')} onKeyDown={blurOnEnter} />
        </label>
      )}
      {f.kind === 'door' && (
        <label>통과 높이(cm)
          <input aria-label="통과 높이" value={form.height_cm} onChange={set('height_cm')} onBlur={saveField('height_cm')} onKeyDown={blurOnEnter} />
        </label>
      )}
      {f.kind === 'door' && (
        <div className="swing-toggle" role="group" aria-label="열림 방향">
          <button type="button" aria-pressed={dir === 'in'} onClick={() => save({ swing: `in-${side}` })}>안</button>
          <button type="button" aria-pressed={dir === 'out'} onClick={() => save({ swing: `out-${side}` })}>밖</button>
          <button type="button" aria-pressed={side === 'left'} onClick={() => save({ swing: `${dir}-left` })}>좌</button>
          <button type="button" aria-pressed={side === 'right'} onClick={() => save({ swing: `${dir}-right` })}>우</button>
        </div>
      )}
      {f.kind === 'window' && (
        <label>창 높이(cm)
          <input aria-label="창 높이" value={form.height_cm} onChange={set('height_cm')} onBlur={saveField('height_cm')} onKeyDown={blurOnEnter} />
        </label>
      )}
      {f.kind === 'window' && (
        <label>턱 높이(cm)
          <input aria-label="창턱" value={form.sill_height_cm} onChange={set('sill_height_cm')} onBlur={saveField('sill_height_cm')} onKeyDown={blurOnEnter} />
        </label>
      )}
      {f.kind === 'outlet' && (
        <label>바닥에서(cm)
          <input aria-label="바닥에서" value={form.floor_height_cm} onChange={set('floor_height_cm')} onBlur={saveField('floor_height_cm')} onKeyDown={blurOnEnter} />
        </label>
      )}
    </div>
  );
}
```

- [ ] **Step 4: FeatureSymbols에서 칩 제거 + featureChip 삭제**

`web/src/FeatureSymbols.jsx`에서 `import { featureChip } from './features.js';` 줄을 삭제하고 (geometry import는 `FeatureSymbol`이 그대로 사용하므로 유지), `FeatureSymbols`를 다음으로 교체:

```jsx
// A room's attachments. Selection/click handling is owned by LayoutPage.
export function FeatureSymbols({ room, selectedId = null, onSelect = () => {} }) {
  return (room.features ?? []).map((f) => (
    <FeatureSymbol key={f.id} room={room} feature={f} selected={selectedId === f.id}
      onClick={(e) => { e.stopPropagation(); onSelect(f.id); }} />
  ));
}
```

`web/src/features.js`에서 `featureChip` 함수와 그 위 주석을 삭제.
`web/src/features.test.js`에서 `featureChip` import와 테스트 2개(`window chip shows W·H·턱`, `outlet chip shows floor height`)를 삭제.
`web/src/styles.css`에서 `.feat-chip` 규칙 삭제.

- [ ] **Step 5: LayoutPage에 카드 통합**

`web/src/pages/LayoutPage.jsx` 수정:

import에 추가: `FeaturePropertyCard`, 그리고 geometry import에 `wallSegment` 추가.

```jsx
import { FeaturePropertyCard } from '../FeaturePropertyCard.jsx';
// geometry import 줄에 wallSegment 추가
```

svg의 `onClick`을 교체 (모드가 아니면 빈 곳 클릭 = 선택 해제):

```jsx
onClick={mode ? placeGhost : () => setSelectedFeature(null)}
```

svg를 `canvas-stage` div로 감싸고 카드를 형제로 렌더 — 기존 `<svg ...>...</svg>`를 다음 구조로:

```jsx
<div className="canvas-stage">
  <svg ...기존 그대로...>
    ...기존 내용 그대로...
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
```

- [ ] **Step 6: CSS 추가**

`web/src/styles.css`에 추가 (`.feat-ghost` 아래):

```css
.canvas-stage { position: relative; }

.feat-card { position: absolute; z-index: 5; width: 210px; background: var(--surface); border-radius: 12px; box-shadow: var(--sh-sm); padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; font: 500 12px var(--sans); }
.feat-card-head { display: flex; align-items: center; gap: 6px; font-weight: 700; }
.feat-card-head button { margin-left: auto; flex: none; font: 600 11px var(--sans); min-height: 0; padding: 3px 8px; border-radius: 7px; background: var(--surface-soft2); color: var(--ink-2); }
.feat-card-head button.danger { background: transparent; color: var(--danger); }
.feat-card-head button.danger + button { margin-left: 0; }
.feat-card label { display: flex; align-items: center; justify-content: space-between; gap: 6px; color: var(--ink-3); }
.feat-card input { width: 70px; min-height: 30px; padding: 4px 8px; border-radius: 7px; background: var(--surface-soft); font: 500 12px var(--num); }
.swing-toggle { display: flex; gap: 4px; }
.swing-toggle button { flex: 1; min-height: 30px; border-radius: 7px; background: var(--surface-soft2); font: 600 11.5px var(--sans); color: var(--ink-2); }
.swing-toggle button[aria-pressed="true"] { background: var(--ink); color: #fff; }
```

- [ ] **Step 7: 통과 확인 + 전체 회귀**

Run: `cd web && npm test`
Expected: PASS — features.test.js는 featureSummary 3개만 남아 통과

- [ ] **Step 8: Commit**

```bash
git add web/src/FeaturePropertyCard.jsx web/src/FeatureSymbols.jsx web/src/features.js web/src/features.test.js web/src/pages/LayoutPage.jsx web/src/styles.css web/src/pages/LayoutPage.test.jsx
git commit -m "feat: floating property card replaces the info chip"
```

---

### Task 6: RoomCard 정리 — 폼 제거, 목록 클릭 = 도면 선택

**Files:**
- Modify: `web/src/RoomCard.jsx`
- Test: `web/src/RoomCard.test.jsx`

**Interfaces:**
- Consumes: `featureSummary`, `FEATURE_META` (features.js), `api.updateRoom`, `api.deleteFeature`, LayoutPage가 넘기는 `selectedId`/`onSelect`
- Produces: 시그니처 불변 — `RoomCard({ room, onChanged, onDelete, selectedId, onSelect })`. `FeatureForm`·`＋ 추가`·`수정` 버튼은 사라짐.

- [ ] **Step 1: 테스트 갱신 (실패하도록)**

`web/src/RoomCard.test.jsx`에서 폼 관련 테스트 3개를 **삭제**: `＋문 opens a door form and submits kind + fields`, `콘센트 form has no width field but has a floor-height field`, `수정 opens a pre-filled form and PATCHes`. 유지: summary/ceiling/삭제 테스트. 끝에 추가:

```jsx
test('부착물 행 클릭은 onSelect로 도면 선택을 위임한다', async () => {
  const onSelect = vi.fn();
  render(<RoomCard room={ROOM} onChanged={vi.fn()} onDelete={vi.fn()} onSelect={onSelect} />);
  await userEvent.click(screen.getByText('남쪽 · 모서리 30cm · 폭80 · 높이204 · 안·좌'));
  expect(onSelect).toHaveBeenCalledWith(11);
});

test('추가/수정 폼은 더 이상 없다', () => {
  render(<RoomCard room={ROOM} onChanged={vi.fn()} onDelete={vi.fn()} />);
  expect(screen.queryByRole('button', { name: '＋ 문' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '수정' })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd web && npx vitest run src/RoomCard.test.jsx`
Expected: FAIL — `추가/수정 폼은 더 이상 없다`가 실패 (버튼이 아직 존재)

- [ ] **Step 3: RoomCard 축소**

`web/src/RoomCard.jsx` 전체를 다음으로 교체:

```jsx
import { useState } from 'react';
import { api } from './api.js';
import { FEATURE_META, featureSummary } from './features.js';

// Panel room card: per-room ceiling height + read-only feature list.
// Creating/editing features happens on the plan (toolbar + property card);
// clicking a row selects the symbol there via onSelect.
export function RoomCard({ room, onChanged, onDelete, selectedId = null, onSelect = () => {} }) {
  const features = room.features ?? [];
  const [ceiling, setCeiling] = useState(room.ceiling_height_cm ?? '');
  const [error, setError] = useState(null);

  async function saveCeiling() {
    if (String(room.ceiling_height_cm ?? '') === String(ceiling)) return;
    try { setError(null); await api.updateRoom(room.id, { ceiling_height_cm: ceiling }); await onChanged(); }
    catch (e) { setError(e.message); }
  }

  async function removeFeature(id) {
    try { setError(null); await api.deleteFeature(id); await onChanged(); }
    catch (e) { setError(e.message); }
  }

  return (
    <div className="room-card" data-testid={`room-card-${room.id}`}>
      <div className="room-card-head">
        <span className="mini-name">{room.name} ({room.width_cm}×{room.depth_cm})</span>
        <label className="ceiling-input">
          천장
          <input aria-label={`${room.name} 천장 높이`} placeholder="cm" value={ceiling}
            onChange={(e) => setCeiling(e.target.value)} onBlur={saveCeiling} />
          cm
        </label>
        <button type="button" className="danger" aria-label={`방 삭제 ${room.name}`} onClick={onDelete}>삭제</button>
      </div>

      {error && <p className="error">{error}</p>}

      {features.length > 0 ? (
        <ul className="feat-list">
          {features.map((f) => (
            <li key={f.id} className={selectedId === f.id ? 'feat-selected' : ''}>
              <button type="button" className="feat-main" onClick={() => onSelect(f.id)}>
                <span className="feat-ico">{FEATURE_META[f.kind].icon}</span>
                <span className="feat-kind">{FEATURE_META[f.kind].label}</span>
                <span className="feat-sum">{featureSummary(f)}</span>
              </button>
              <button type="button" className="danger" aria-label={`부착물 삭제 ${f.id}`} onClick={() => removeFeature(f.id)}>삭제</button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted feat-empty">도면 위 도구로 문·창문·콘센트를 배치하세요</p>
      )}
    </div>
  );
}
```

`web/src/styles.css`에 추가:

```css
.feat-empty { font: 500 11.5px var(--sans); margin: 0; }
```

- [ ] **Step 4: 통과 확인 + 전체 회귀**

Run: `cd web && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/RoomCard.jsx web/src/RoomCard.test.jsx web/src/styles.css
git commit -m "refactor: room card feature list is read-only; forms replaced by plan tools"
```

---

### Task 7: 부착물 벽 따라 드래그

**Files:**
- Modify: `web/src/pages/LayoutPage.jsx`
- Modify: `web/src/FeatureSymbols.jsx` (onClick → onMouseDown 전달)
- Test: `web/src/pages/LayoutPage.test.jsx`

**Interfaces:**
- Consumes: `nearestWallPoint`, `clampFeatureOffset`, `snapCm`, `DistanceLabels`, `api.updateFeature`
- Produces: LayoutPage state `featDrag` = `{ id, roomId, startX, startY, wall, offset_cm, width, moved }`. `FeatureSymbols` 시그니처 변경: `{ room, selectedId, onFeatureDown(feature, room, event) }` (onSelect 제거). 선택은 mouseup에서 결정 (3px 미만 이동 = 클릭 토글).

- [ ] **Step 1: 테스트 갱신 + 신규 테스트 (실패하도록)**

`web/src/pages/LayoutPage.test.jsx`에서 Task 5의 카드 테스트 3개 — `기호 클릭 → 속성 카드...`(feat-11), `문 열림 토글...`(feat-12), `카드의 삭제 버튼...`(feat-11) — 에 있는 `fireEvent.click(await screen.findByTestId('feat-XX'))` 한 줄을 각각 다음 mousedown+mouseup 쌍으로 교체 (Task 7부터 심볼 클릭은 mouseup에서 판정되므로):

```jsx
const sym = await screen.findByTestId('feat-11'); // 각 테스트의 대상 id 사용 (11 또는 12)
fireEvent.mouseDown(sym, { clientX: 0, clientY: 0 });
fireEvent.mouseUp(sym, { clientX: 0, clientY: 0 });
```

파일 끝에 추가:

```jsx
test('기호 드래그: 벽을 따라 이동하고 스냅된 offset이 저장된다', async () => {
  api.getLayout.mockResolvedValue(FEAT_LAYOUT);
  api.updateFeature.mockResolvedValue({});
  render(<MemoryRouter><LayoutPage /></MemoryRouter>);
  const sym = await screen.findByTestId('feat-11'); // window: N wall, offset 90, width 180
  const svg = screen.getByRole('img', { name: '평면도' });
  fireEvent.mouseDown(sym, { clientX: 108, clientY: 0 });
  fireEvent.mouseMove(svg, { clientX: 150, clientY: 3 }); // cm (250,5) → centered offset 250-90=160
  fireEvent.mouseUp(svg, { clientX: 150, clientY: 3 });
  await waitFor(() => expect(api.updateFeature).toHaveBeenCalledWith(11, { wall: 'N', offset_cm: 160 }));
});

test('3px 미만 이동은 드래그가 아니라 선택 토글이다', async () => {
  api.getLayout.mockResolvedValue(FEAT_LAYOUT);
  render(<MemoryRouter><LayoutPage /></MemoryRouter>);
  const sym = await screen.findByTestId('feat-11');
  fireEvent.mouseDown(sym, { clientX: 100, clientY: 0 });
  fireEvent.mouseUp(sym, { clientX: 101, clientY: 0 });
  expect(screen.getByTestId('feat-card-11')).toBeInTheDocument();
  expect(api.updateFeature).not.toHaveBeenCalled();
  // second tiny click toggles the selection off
  fireEvent.mouseDown(sym, { clientX: 100, clientY: 0 });
  fireEvent.mouseUp(sym, { clientX: 100, clientY: 0 });
  expect(screen.queryByTestId('feat-card-11')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd web && npx vitest run src/pages/LayoutPage.test.jsx`
Expected: FAIL — mousedown/mouseup으로 카드가 열리지 않음

- [ ] **Step 3: FeatureSymbols 시그니처 변경**

`web/src/FeatureSymbols.jsx`의 `FeatureSymbols`를 교체:

```jsx
// A room's attachments. Selection and dragging are decided by LayoutPage on
// mouseup (tiny move = click), so symbols only report mousedown.
export function FeatureSymbols({ room, selectedId = null, onFeatureDown = () => {} }) {
  return (room.features ?? []).map((f) => (
    <FeatureSymbol key={f.id} room={room} feature={f} selected={selectedId === f.id}
      onMouseDown={(e) => onFeatureDown(f, room, e)} />
  ));
}
```

- [ ] **Step 4: LayoutPage에 featDrag 통합**

`web/src/pages/LayoutPage.jsx` 수정:

state 추가 (`ghost` 아래):

```jsx
const [featDrag, setFeatDrag] = useState(null); // { id, roomId, startX, startY, wall, offset_cm, width, moved }
const suppressClick = useRef(false); // swallow the synthetic click right after a feature mouseup
```

(`useRef`를 react import에 추가: `import { useEffect, useRef, useState } from 'react';`)

핸들러 추가 (`placeGhost` 아래):

```jsx
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
```

svg 이벤트 핸들러 교체:

```jsx
onMouseMove={mode ? moveGhost : featDrag ? moveFeatDrag : moveDrag}
onMouseUp={featDrag ? endFeatDrag : endDrag}
onMouseLeave={mode ? () => setGhost(null) : undefined}
onClick={mode ? placeGhost : () => {
  if (suppressClick.current) { suppressClick.current = false; return; }
  setSelectedFeature(null);
}}
```

방 렌더 루프에서 드래그 중인 부착물을 라이브 위치로 표시 — `rooms.map((r) => {` 본문 첫 줄에 추가하고 `FeatureSymbols`/거리 라벨을 교체:

```jsx
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
```

- [ ] **Step 5: 통과 확인 + 전체 회귀**

Run: `cd web && npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add web/src/pages/LayoutPage.jsx web/src/FeatureSymbols.jsx web/src/pages/LayoutPage.test.jsx
git commit -m "feat: drag features along walls with live corner distances"
```

---

### Task 8: 방 자석 스냅 + 가이드라인

**Files:**
- Modify: `web/src/pages/LayoutPage.jsx`
- Modify: `web/src/styles.css` (`.snap-guide`)
- Test: `web/src/pages/LayoutPage.test.jsx`

**Interfaces:**
- Consumes: `snapRoomPosition` (Task 2), 기존 `drag` state/`liveOffset`/`endDrag`
- Produces: 방 드래그 중 `drag.guides` 렌더 (class `snap-guide`), 드롭 시 자석 스냅 우선·아니면 기존 10cm 그리드

- [ ] **Step 1: 실패하는 테스트 작성**

`web/src/pages/LayoutPage.test.jsx` 끝에 추가:

```jsx
test('방 드래그: 이웃 방에 자석 스냅되고 가이드라인이 보인다', async () => {
  api.getLayout.mockResolvedValue({
    rooms: [
      { id: 1, name: '거실', x: 0, y: 0, width_cm: 400, depth_cm: 500 },
      { id: 2, name: '침실', x: 600, y: 0, width_cm: 300, depth_cm: 300 },
    ],
    placements: [], palette: [], unplaceable: [],
  });
  api.updateRoom.mockResolvedValue({});
  const { container } = render(<MemoryRouter><LayoutPage /></MemoryRouter>);
  const rect = await screen.findByTestId('room-2');
  const svg = screen.getByRole('img', { name: '평면도' });
  fireEvent.mouseDown(rect, { clientX: 0, clientY: 0 });
  fireEvent.mouseMove(svg, { clientX: -117, clientY: 0 }); // proposed x = 600-195 = 405 → magnet 400
  expect(container.querySelectorAll('.snap-guide').length).toBeGreaterThan(0);
  fireEvent.mouseUp(svg, { clientX: -117, clientY: 0 });
  await waitFor(() => expect(api.updateRoom).toHaveBeenCalledWith(2, { x: 400, y: 0 }));
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd web && npx vitest run src/pages/LayoutPage.test.jsx`
Expected: FAIL — `.snap-guide` 없음 / updateRoom이 `{ x: 400, y: 0 }`이 아님 (그리드 스냅으로 410)

- [ ] **Step 3: 구현**

`web/src/pages/LayoutPage.jsx` 수정:

geometry import에 `snapRoomPosition` 추가.

`moveDrag`를 교체 (방 드래그일 때만 자석 스냅을 라이브 적용):

```jsx
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
```

`endDrag`의 room 분기를 교체 (자석 스냅 축은 그 값, 아니면 기존 그리드 스냅):

```jsx
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
```

svg 안, scalebar 위에 가이드라인 렌더 추가:

```jsx
{drag?.kind === 'room' && drag.guides?.map((g, i) => g.axis === 'x' ? (
  <line key={i} className="snap-guide"
    x1={cmToPx(g.positionCm)} y1={cmToPx(g.fromCm)} x2={cmToPx(g.positionCm)} y2={cmToPx(g.toCm)} />
) : (
  <line key={i} className="snap-guide"
    x1={cmToPx(g.fromCm)} y1={cmToPx(g.positionCm)} x2={cmToPx(g.toCm)} y2={cmToPx(g.positionCm)} />
))}
```

`web/src/styles.css`에 추가:

```css
.snap-guide { stroke: #3b82f6; stroke-width: 1.5; stroke-dasharray: 5 4; }
```

- [ ] **Step 4: 통과 확인 + 전체 회귀 + 빌드**

Run: `cd web && npm test`
Expected: PASS — 기존 `dragging a room persists the snapped new position`(단일 방 → 그리드 스냅 경로)도 통과

Run: `cd web && npm run build`
Expected: 빌드 성공

- [ ] **Step 5: Commit**

```bash
git add web/src/pages/LayoutPage.jsx web/src/styles.css web/src/pages/LayoutPage.test.jsx
git commit -m "feat: magnetic room snapping with alignment guides"
```
