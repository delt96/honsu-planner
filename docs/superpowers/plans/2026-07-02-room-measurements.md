# 실측 단계 1+2 (방문 통과 + 방별 실측) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 반입 판정에 실내 방문 통과 체크를 추가하고(단계 1), 방별 천장 높이 + 벽 부착물(문·창문·콘센트)을 입력·평면도 렌더한다(단계 2).

**Architecture:** 스펙 `docs/superpowers/specs/2026-07-02-measurement-roadmap-design.md` 기준. 단계 1은 `home_settings` 컬럼 추가 + `carryin.js` 체크 하나. 단계 2는 벽 앵커 모델(`room_features`: 벽 N/E/S/W + 모서리 offset)로, 패널 방 카드의 ＋ 흐름으로 입력하고 SVG 평면도에 표준 도면 기호(문=개구부+부채꼴, 창=이중선, 콘센트=점)로 그린다. 천장 경고는 서버 파생 필드 `min_ceiling_height_cm`로 홈·품목 상세에 칩 표시.

**Tech Stack:** Node/Express + pg (서버), pg-mem + supertest (서버 테스트), React + Vite (프론트), vitest + @testing-library/react (프론트 테스트).

## Global Constraints

- ESM 프로젝트 (`"type": "module"`) — `import`/`export`만 사용.
- 치수는 전부 cm(소수 허용), DB 컬럼은 `numeric`. SQL은 pg-mem 호환 범위만 (CHECK 제약·enum 타입 금지 — 기존 마이그레이션과 동일 스타일).
- 새 검증 에러 메시지는 한글 (스펙 §9). 기존 영어 메시지는 건드리지 않는다.
- UI 문구는 한글. 카테고리 등 코드 값은 영문 그대로.
- **작업 트리에 이번 작업과 무관한 미커밋 변경(budget_limit 관련)이 있다.** 커밋 시 반드시 자기 태스크의 파일만 `git add <경로>`로 지정한다. `git add -A`, `git add .` 절대 금지.
- 테스트 실행: 단일 파일은 `npx vitest run <경로>`, 전체는 `npm test`.
- offset 0점 규약 (전 태스크 공통): N/S 벽 = 서쪽(왼쪽) 모서리, E/W 벽 = 북쪽(위) 모서리. 벽 길이는 N/S = `width_cm`, E/W = `depth_cm`.

---

### Task 1: 마이그레이션 007 + home_settings 방문 필드 (서버)

**Files:**
- Create: `migrations/007_room_door.sql`
- Modify: `server/queries/home-settings.js:3-12` (HOME_SETTING_COLS)
- Modify: `server/validation.js:99-108` (HOME_SETTING_FIELDS)
- Modify: `test/migrate.test.js` (마이그레이션 파일 목록 3곳)
- Test: `test/home-settings.test.js`

**Interfaces:**
- Produces: `home_settings` 행에 `room_door_width_cm`, `room_door_height_cm` (numeric|null) — GET/PUT `/api/home-settings`로 읽고 쓴다. Task 2·3이 이 필드명을 그대로 사용.

- [ ] **Step 1: 실패하는 테스트 작성**

`test/home-settings.test.js` 끝에 추가:

```js
test('PUT stores the room door (실내 문) dimensions', async () => {
  const { app } = createTestApp();
  const res = await request(app).put('/api/home-settings').send({ room_door_width_cm: 75, room_door_height_cm: 198 });
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ room_door_width_cm: 75, room_door_height_cm: 198 });
  const again = await request(app).get('/api/home-settings');
  expect(again.body).toMatchObject({ room_door_width_cm: 75, room_door_height_cm: 198 });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run test/home-settings.test.js`
Expected: FAIL — PUT 응답에 `room_door_width_cm`가 없음 (알 수 없는 필드는 무시되므로 null/undefined).

- [ ] **Step 3: 마이그레이션 작성**

`migrations/007_room_door.sql` 생성:

```sql
-- 실내에서 가장 좁은 문(대표값). 반입 판정의 '방문' 체크에 사용. Nullable.
-- 반입 경로(어느 방까지 가는지) 모델링은 하지 않고 최소 문 하나로 근사한다.
ALTER TABLE home_settings ADD COLUMN room_door_width_cm numeric;
ALTER TABLE home_settings ADD COLUMN room_door_height_cm numeric;
```

- [ ] **Step 4: 서버 필드 등록**

`server/queries/home-settings.js`의 `HOME_SETTING_COLS`에서 `'budget_limit'` 앞에 두 줄 추가:

```js
export const HOME_SETTING_COLS = [
  'door_width_cm',
  'door_height_cm',
  'room_door_width_cm',
  'room_door_height_cm',
  'elevator_door_width_cm',
  'elevator_door_height_cm',
  'elevator_car_width_cm',
  'elevator_car_depth_cm',
  'elevator_car_height_cm',
  'budget_limit',
];
```

`server/validation.js`의 `HOME_SETTING_FIELDS`에도 같은 위치(`'door_height_cm'` 다음)에 추가:

```js
const HOME_SETTING_FIELDS = [
  'door_width_cm',
  'door_height_cm',
  'room_door_width_cm',
  'room_door_height_cm',
  'elevator_door_width_cm',
  'elevator_door_height_cm',
  'elevator_car_width_cm',
  'elevator_car_depth_cm',
  'elevator_car_height_cm',
  'budget_limit',
];
```

- [ ] **Step 5: migrate.test.js의 파일 목록 갱신**

`test/migrate.test.js`에는 마이그레이션 파일명을 검증하는 곳이 3곳 있다. 두 `toEqual([...])` 배열 각각의 끝에 `'007_room_door.sql',` 추가, `expect(rows).toHaveLength(6)`을 `toHaveLength(7)`로 변경.

- [ ] **Step 6: 테스트 통과 확인**

Run: `npx vitest run test/home-settings.test.js test/migrate.test.js test/migrations.test.js`
Expected: 전부 PASS.

- [ ] **Step 7: Commit**

```bash
git add migrations/007_room_door.sql server/queries/home-settings.js server/validation.js test/home-settings.test.js test/migrate.test.js
git commit -m "feat: home_settings에 실내 방문(room door) 치수 추가"
```

---

### Task 2: carryin.js 방문 통과 체크

**Files:**
- Modify: `web/src/carryin.js:55-61` (현관문 체크 다음)
- Test: `web/src/carryin.test.js`

**Interfaces:**
- Consumes: Task 1의 `room_door_width_cm`, `room_door_height_cm` 필드명.
- Produces: `evaluateCarryIn(dims, settings)`의 `checks[]`에 `{ name: '방문', pass, tight }` 항목. 사유 문자열 "방문 통과 불가"/"방문 빠듯"은 기존 조합 로직에서 자동 생성 — `CarryInBadge`는 수정 불필요.

- [ ] **Step 1: 실패하는 테스트 작성**

`web/src/carryin.test.js` 끝에 추가:

```js
test('fail when the cross-section cannot pass the room door', () => {
  // 단면 75×80: 90×210 현관문은 통과하지만 폭 70cm 방문은 두 방향 모두 불가
  const r = evaluateCarryIn(
    { width_cm: 200, depth_cm: 80, height_cm: 75 },
    { door_width_cm: 90, door_height_cm: 210, room_door_width_cm: 70, room_door_height_cm: 198 }
  );
  expect(r.status).toBe('fail');
  expect(r.reason).toContain('방문');
});

test('room door check is skipped when its dimensions are not entered', () => {
  const r = evaluateCarryIn(
    { width_cm: 200, depth_cm: 80, height_cm: 75 },
    { door_width_cm: 90, door_height_cm: 210 }
  );
  expect(r.status).toBe('ok');
});

test('tight when the room door leaves less than the clearance margin', () => {
  // 단면 68×88 → 70×90 방문: 여유 2cm (< 3cm)
  const r = evaluateCarryIn(
    { width_cm: 300, depth_cm: 88, height_cm: 68 },
    { room_door_width_cm: 70, room_door_height_cm: 90 }
  );
  expect(r.status).toBe('tight');
  expect(r.reason).toContain('방문');
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run web/src/carryin.test.js`
Expected: 새 테스트 3개 FAIL (방문 체크가 없어 status가 'ok'로 나옴).

- [ ] **Step 3: 구현**

`web/src/carryin.js`의 현관문 체크 블록(`if (dw && dh) ...`) 바로 아래에 추가:

```js
  const rdw = num(s.room_door_width_cm);
  const rdh = num(s.room_door_height_cm);
  if (rdw && rdh) checks.push({ name: '방문', ...throughOpening(cross, rdw, rdh) });
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run web/src/carryin.test.js`
Expected: 전부 PASS (기존 테스트 포함).

- [ ] **Step 5: Commit**

```bash
git add web/src/carryin.js web/src/carryin.test.js
git commit -m "feat: 반입 판정에 실내 방문 통과 체크 추가"
```

---

### Task 3: CarryInPage 방문 입력 폼

**Files:**
- Modify: `web/src/pages/CarryInPage.jsx:5-9` (SETTING_FIELDS), `:41-45` (fieldset), `:63-66` (안내 문구)
- Test: `web/src/pages/CarryInPage.test.jsx`

**Interfaces:**
- Consumes: Task 1의 필드명. 기존 `api.saveHomeSettings` 그대로 사용.

- [ ] **Step 1: 실패하는 테스트 작성**

`web/src/pages/CarryInPage.test.jsx` 끝에 추가:

```js
test('shows and saves the room door fields', async () => {
  api.getHomeSettings.mockResolvedValue({ id: 1, room_door_width_cm: 75 });
  api.saveHomeSettings.mockResolvedValue({ id: 1, room_door_width_cm: 75, room_door_height_cm: 198 });
  render(<MemoryRouter><CarryInPage /></MemoryRouter>);
  await waitFor(() => expect(screen.getByLabelText('방문 폭')).toHaveValue('75'));
  await userEvent.type(screen.getByLabelText('방문 높이'), '198');
  await userEvent.click(screen.getByRole('button', { name: '저장' }));
  await waitFor(() =>
    expect(api.saveHomeSettings).toHaveBeenCalledWith(expect.objectContaining({ room_door_height_cm: '198' }))
  );
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run web/src/pages/CarryInPage.test.jsx`
Expected: FAIL — `방문 폭` 라벨의 입력이 없음.

- [ ] **Step 3: 구현**

`SETTING_FIELDS`에 두 키 추가 (`'door_height_cm'` 다음):

```js
const SETTING_FIELDS = [
  'door_width_cm', 'door_height_cm',
  'room_door_width_cm', 'room_door_height_cm',
  'elevator_door_width_cm', 'elevator_door_height_cm',
  'elevator_car_width_cm', 'elevator_car_depth_cm', 'elevator_car_height_cm',
];
```

현관문 fieldset 바로 다음에 추가:

```jsx
        <fieldset className="carry-group">
          <legend>방문 (실내에서 가장 좁은 문)</legend>
          <input aria-label="방문 폭" placeholder="폭(cm)" value={form.room_door_width_cm} onChange={set('room_door_width_cm')} />
          <input aria-label="방문 높이" placeholder="높이(cm)" value={form.room_door_height_cm} onChange={set('room_door_height_cm')} />
        </fieldset>
```

하단 `carry-hint` 문구를 다음으로 교체:

```jsx
      <p className="carry-hint">
        입력한 현관·방문·엘리베이터 치수를 확정 가구의 치수와 비교해, 목록·품목 화면에서 반입 가능/불가를 알려드려요.
        방문은 실내에서 가장 좁은 문 하나를 재면 됩니다. 비워 둔 항목은 판정에서 제외됩니다.
      </p>
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run web/src/pages/CarryInPage.test.jsx`
Expected: 전부 PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/pages/CarryInPage.jsx web/src/pages/CarryInPage.test.jsx
git commit -m "feat: 반입 정보 페이지에 방문(실내 문) 입력 추가"
```

---

### Task 4: 마이그레이션 008 + rooms 천장 높이 (서버)

**Files:**
- Create: `migrations/008_room_measurements.sql`
- Modify: `server/queries/rooms.js:1-9` (normalizeRoomRow), `:29-44` (updateRoom cols)
- Modify: `server/validation.js` (normalizeRoomInput)
- Modify: `test/migrate.test.js` (파일 목록 3곳)
- Test: `test/rooms.test.js`

**Interfaces:**
- Produces: `rooms` 행에 `ceiling_height_cm` (number|null) — PATCH `/api/rooms/:id`로 저장. `room_features` 테이블(스키마는 아래 SQL이 정본) — Task 5·6이 사용.

- [ ] **Step 1: 실패하는 테스트 작성**

`test/rooms.test.js` 끝에 추가:

```js
test('PATCH stores a per-room ceiling height and clears it with empty string', async () => {
  const { app } = createTestApp();
  const room = await request(app).post('/api/rooms').send({ name: '안방', width_cm: 350, depth_cm: 300 });
  const res = await request(app).patch(`/api/rooms/${room.body.id}`).send({ ceiling_height_cm: 235 });
  expect(res.status).toBe(200);
  expect(res.body.ceiling_height_cm).toBe(235);
  const cleared = await request(app).patch(`/api/rooms/${room.body.id}`).send({ ceiling_height_cm: '' });
  expect(cleared.body.ceiling_height_cm).toBeNull();
});

test('PATCH rejects a non-positive ceiling height', async () => {
  const { app } = createTestApp();
  const room = await request(app).post('/api/rooms').send({ name: '안방', width_cm: 350, depth_cm: 300 });
  const res = await request(app).patch(`/api/rooms/${room.body.id}`).send({ ceiling_height_cm: 0 });
  expect(res.status).toBe(400);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run test/rooms.test.js`
Expected: 새 테스트 2개 FAIL.

- [ ] **Step 3: 마이그레이션 작성**

`migrations/008_room_measurements.sql` 생성:

```sql
-- 방별 실측: 천장 높이(방마다 다를 수 있음) + 벽 부착물(문·창문·콘센트).
-- 부착물은 벽 앵커 방식: 어느 벽(N/E/S/W) + 그 벽 시작 모서리에서 거리(cm).
-- offset 0점 규약 — N/S 벽: 서쪽(왼쪽) 모서리, E/W 벽: 북쪽(위) 모서리.
ALTER TABLE rooms ADD COLUMN ceiling_height_cm numeric;

CREATE TABLE room_features (
  id serial PRIMARY KEY,
  room_id int NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  kind text NOT NULL,
  wall text NOT NULL,
  offset_cm numeric NOT NULL,
  width_cm numeric,
  height_cm numeric,
  sill_height_cm numeric,
  floor_height_cm numeric,
  swing text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_room_features_room ON room_features(room_id);
```

- [ ] **Step 4: rooms 서버 코드 수정**

`server/queries/rooms.js`의 `normalizeRoomRow`:

```js
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
```

`updateRoom`의 `cols` 배열에 `'ceiling_height_cm'` 추가:

```js
  const cols = ['name', 'width_cm', 'depth_cm', 'x', 'y', 'sort_order', 'ceiling_height_cm'];
```

`server/validation.js`의 `normalizeRoomInput`에서 `sort_order` 블록 앞에 추가:

```js
  if (body.ceiling_height_cm !== undefined) {
    if (body.ceiling_height_cm === null || body.ceiling_height_cm === '') {
      out.ceiling_height_cm = null;
    } else {
      const n = Number(body.ceiling_height_cm);
      if (!(n > 0)) errors.push('ceiling_height_cm must be a positive number');
      else out.ceiling_height_cm = n;
    }
  }
```

- [ ] **Step 5: migrate.test.js의 파일 목록 갱신**

두 `toEqual([...])` 배열 끝에 `'008_room_measurements.sql',` 추가, `toHaveLength(7)`을 `toHaveLength(8)`로 변경.

- [ ] **Step 6: 테스트 통과 확인**

Run: `npx vitest run test/rooms.test.js test/migrate.test.js test/layout.test.js`
Expected: 전부 PASS. (layout.test.js의 기존 `toEqual` 단언은 rooms에 새 필드가 생겨도 `rooms`는 `toHaveLength`로만 검사하므로 영향 없음.)

- [ ] **Step 7: Commit**

```bash
git add migrations/008_room_measurements.sql server/queries/rooms.js server/validation.js test/rooms.test.js test/migrate.test.js
git commit -m "feat: 방별 천장 높이 + room_features 테이블"
```

---

### Task 5: normalizeRoomFeature 검증 함수

**Files:**
- Modify: `server/validation.js` (파일 끝에 추가)
- Test: `test/room-feature-validation.test.js` (새 파일)

**Interfaces:**
- Consumes: Task 4의 `room_features` 컬럼명.
- Produces: `normalizeRoomFeature(body, room) → { errors: string[], value }` — **전체 검증만** 제공. PATCH의 부분 수정은 라우트(Task 6)에서 기존 행 위에 body를 병합한 뒤 이 함수를 호출한다. `FEATURE_KINDS`, `FEATURE_WALLS`, `DOOR_SWINGS` 상수도 export.

- [ ] **Step 1: 실패하는 테스트 작성**

`test/room-feature-validation.test.js` 생성:

```js
import { test, expect } from 'vitest';
import { normalizeRoomFeature } from '../server/validation.js';

const ROOM = { width_cm: 400, depth_cm: 300 };

test('accepts a valid door and nulls irrelevant fields', () => {
  const { errors, value } = normalizeRoomFeature(
    { kind: 'door', wall: 'S', offset_cm: 30, width_cm: 80, height_cm: 204, swing: 'in-left', floor_height_cm: 30 },
    ROOM
  );
  expect(errors).toEqual([]);
  expect(value).toMatchObject({ kind: 'door', wall: 'S', offset_cm: 30, width_cm: 80, height_cm: 204, swing: 'in-left' });
  expect(value.floor_height_cm).toBeNull(); // 문에는 무관한 필드 → null
  expect(value.sill_height_cm).toBeNull();
});

test('rejects an unknown kind and wall', () => {
  const { errors } = normalizeRoomFeature({ kind: 'desk', wall: 'X', offset_cm: 0 }, ROOM);
  expect(errors.join(' ')).toMatch(/kind/);
  expect(errors.join(' ')).toMatch(/wall/);
});

test('door and window require a width', () => {
  const { errors } = normalizeRoomFeature({ kind: 'window', wall: 'N', offset_cm: 10 }, ROOM);
  expect(errors.join(' ')).toMatch(/폭/);
});

test('offset is required — empty string is not silently 0', () => {
  const { errors } = normalizeRoomFeature({ kind: 'outlet', wall: 'E', offset_cm: '' }, ROOM);
  expect(errors.join(' ')).toMatch(/offset_cm/);
});

test('outlet needs no width and drops one if sent', () => {
  const { errors, value } = normalizeRoomFeature(
    { kind: 'outlet', wall: 'E', offset_cm: 150, floor_height_cm: 30, width_cm: 50 },
    ROOM
  );
  expect(errors).toEqual([]);
  expect(value.width_cm).toBeNull();
  expect(value.floor_height_cm).toBe(30);
});

test('rejects a feature extending past the wall — N/S walls use width_cm', () => {
  // S벽 길이 = room.width_cm = 400
  const ok = normalizeRoomFeature({ kind: 'window', wall: 'S', offset_cm: 320, width_cm: 80 }, ROOM);
  expect(ok.errors).toEqual([]);
  const bad = normalizeRoomFeature({ kind: 'window', wall: 'S', offset_cm: 321, width_cm: 80 }, ROOM);
  expect(bad.errors.join(' ')).toMatch(/벽 길이/);
});

test('E/W walls use depth_cm as the wall length', () => {
  const bad = normalizeRoomFeature({ kind: 'outlet', wall: 'E', offset_cm: 301 }, ROOM);
  expect(bad.errors.join(' ')).toMatch(/벽 길이/);
});

test('rejects a negative offset and an unknown swing', () => {
  const { errors } = normalizeRoomFeature(
    { kind: 'door', wall: 'N', offset_cm: -1, width_cm: 80, swing: 'sideways' },
    ROOM
  );
  expect(errors.join(' ')).toMatch(/offset_cm/);
  expect(errors.join(' ')).toMatch(/swing/);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run test/room-feature-validation.test.js`
Expected: FAIL — `normalizeRoomFeature` export 없음.

- [ ] **Step 3: 구현**

`server/validation.js` 끝에 추가:

```js
export const FEATURE_KINDS = ['door', 'window', 'outlet'];
export const FEATURE_WALLS = ['N', 'E', 'S', 'W'];
export const DOOR_SWINGS = ['in-left', 'in-right', 'out-left', 'out-right'];

// 방 부착물(문·창문·콘센트) 전체 검증. room은 벽 길이 검증용 { width_cm, depth_cm }.
// 부분 수정(PATCH)은 라우트에서 기존 행 위에 body를 병합한 뒤 이 함수를 호출한다.
// kind에 무관한 치수 필드는 에러 대신 null로 정리해 예측 가능하게 만든다.
export function normalizeRoomFeature(body, room) {
  const errors = [];
  const out = {};

  if (!FEATURE_KINDS.includes(body.kind)) errors.push(`kind는 ${FEATURE_KINDS.join(', ')} 중 하나여야 합니다`);
  else out.kind = body.kind;

  if (!FEATURE_WALLS.includes(body.wall)) errors.push('wall은 N, E, S, W 중 하나여야 합니다');
  else out.wall = body.wall;

  const rawOff = body.offset_cm;
  const off = rawOff === '' || rawOff === null || rawOff === undefined ? NaN : Number(rawOff);
  if (!(Number.isFinite(off) && off >= 0)) errors.push('offset_cm은 0 이상의 숫자여야 합니다');
  else out.offset_cm = off;

  for (const key of ['width_cm', 'height_cm', 'sill_height_cm', 'floor_height_cm']) {
    const v = body[key];
    if (v === undefined || v === null || v === '') { out[key] = null; continue; }
    const n = Number(v);
    if (!(n > 0)) errors.push(`${key}은 양수여야 합니다`);
    else out[key] = n;
  }

  if (body.swing === undefined || body.swing === null || body.swing === '') out.swing = null;
  else if (!DOOR_SWINGS.includes(body.swing)) errors.push(`swing은 ${DOOR_SWINGS.join(', ')} 중 하나여야 합니다`);
  else out.swing = body.swing;

  if (out.kind === 'door' || out.kind === 'window') {
    if (out.width_cm === null) errors.push('문/창문은 폭(width_cm)이 필요합니다');
  }
  if (out.kind === 'door') { out.sill_height_cm = null; out.floor_height_cm = null; }
  if (out.kind === 'window') { out.swing = null; out.floor_height_cm = null; }
  if (out.kind === 'outlet') { out.width_cm = null; out.height_cm = null; out.sill_height_cm = null; out.swing = null; }

  if (errors.length === 0 && room) {
    const wallLen = out.wall === 'N' || out.wall === 'S' ? Number(room.width_cm) : Number(room.depth_cm);
    if (out.offset_cm + (out.width_cm ?? 0) > wallLen) {
      errors.push(`벽 길이(${wallLen}cm)를 벗어납니다`);
    }
  }

  return { errors, value: out };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run test/room-feature-validation.test.js`
Expected: 전부 PASS.

- [ ] **Step 5: Commit**

```bash
git add server/validation.js test/room-feature-validation.test.js
git commit -m "feat: room_features 검증 함수 (벽 앵커 + 벽 길이 체크)"
```

---

### Task 6: room_features 쿼리·라우트·앱 등록

**Files:**
- Create: `server/queries/room-features.js`
- Create: `server/routes/room-features.js`
- Modify: `server/app.js` (라우터 등록)
- Test: `test/room-features.test.js` (새 파일)

**Interfaces:**
- Consumes: Task 5의 `normalizeRoomFeature(body, room)`, `server/queries/rooms.js`의 `getRoom(pool, id)`.
- Produces: REST — `POST /api/rooms/:id/features`(201), `PATCH /api/features/:id`(200), `DELETE /api/features/:id`(204). 쿼리 함수 `listFeatures(pool)`(전체, room_id·sort_order·id 순) — Task 7이 사용. feature 행 형태: `{ id, room_id, kind, wall, offset_cm, width_cm, height_cm, sill_height_cm, floor_height_cm, swing, sort_order, created_at }` (치수류는 number|null).

- [ ] **Step 1: 실패하는 테스트 작성**

`test/room-features.test.js` 생성:

```js
import { test, expect } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers/testApp.js';

async function makeRoom(app) {
  const res = await request(app).post('/api/rooms').send({ name: '거실', width_cm: 400, depth_cm: 300 });
  return res.body;
}

test('POST creates a door on a wall', async () => {
  const { app } = createTestApp();
  const room = await makeRoom(app);
  const res = await request(app).post(`/api/rooms/${room.id}/features`)
    .send({ kind: 'door', wall: 'S', offset_cm: 30, width_cm: 80, height_cm: 204, swing: 'in-left' });
  expect(res.status).toBe(201);
  expect(res.body).toMatchObject({
    room_id: room.id, kind: 'door', wall: 'S', offset_cm: 30, width_cm: 80, height_cm: 204,
    swing: 'in-left', sill_height_cm: null, floor_height_cm: null,
  });
});

test('POST 404s for a missing room', async () => {
  const { app } = createTestApp();
  const res = await request(app).post('/api/rooms/999/features').send({ kind: 'outlet', wall: 'E', offset_cm: 10 });
  expect(res.status).toBe(404);
});

test('POST rejects a bad wall and a feature past the wall end', async () => {
  const { app } = createTestApp();
  const room = await makeRoom(app);
  const badWall = await request(app).post(`/api/rooms/${room.id}/features`)
    .send({ kind: 'outlet', wall: 'X', offset_cm: 10 });
  expect(badWall.status).toBe(400);
  // S벽 길이 = width_cm 400 < 350 + 80
  const past = await request(app).post(`/api/rooms/${room.id}/features`)
    .send({ kind: 'window', wall: 'S', offset_cm: 350, width_cm: 80 });
  expect(past.status).toBe(400);
  expect(past.body.error).toMatch(/벽 길이/);
});

test('PATCH merges over the existing row and re-validates', async () => {
  const { app } = createTestApp();
  const room = await makeRoom(app);
  const f = (await request(app).post(`/api/rooms/${room.id}/features`)
    .send({ kind: 'window', wall: 'N', offset_cm: 90, width_cm: 180, height_cm: 120, sill_height_cm: 90 })).body;
  const res = await request(app).patch(`/api/features/${f.id}`).send({ offset_cm: 100 });
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ offset_cm: 100, width_cm: 180, sill_height_cm: 90 }); // 나머지 유지
  const tooFar = await request(app).patch(`/api/features/${f.id}`).send({ offset_cm: 250 });
  expect(tooFar.status).toBe(400); // 250 + 180 > 400
});

test('DELETE removes a feature', async () => {
  const { app } = createTestApp();
  const room = await makeRoom(app);
  const f = (await request(app).post(`/api/rooms/${room.id}/features`)
    .send({ kind: 'outlet', wall: 'E', offset_cm: 150, floor_height_cm: 30 })).body;
  expect((await request(app).delete(`/api/features/${f.id}`)).status).toBe(204);
  expect((await request(app).delete(`/api/features/${f.id}`)).status).toBe(404);
});

test('deleting a room cascades to its features', async () => {
  const { app } = createTestApp();
  const room = await makeRoom(app);
  const f = (await request(app).post(`/api/rooms/${room.id}/features`)
    .send({ kind: 'outlet', wall: 'W', offset_cm: 10 })).body;
  await request(app).delete(`/api/rooms/${room.id}`);
  expect((await request(app).patch(`/api/features/${f.id}`).send({ offset_cm: 20 })).status).toBe(404);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run test/room-features.test.js`
Expected: FAIL — 라우트 없음 (404 대신 SPA fallback/미등록 경로 응답).

- [ ] **Step 3: 쿼리 구현**

`server/queries/room-features.js` 생성:

```js
// 방 부착물(문·창문·콘센트). 벽 앵커: wall(N/E/S/W) + offset_cm(모서리에서 거리).

const NUM_COLS = ['offset_cm', 'width_cm', 'height_cm', 'sill_height_cm', 'floor_height_cm'];

export function normalizeFeatureRow(r) {
  const out = { ...r };
  for (const c of NUM_COLS) out[c] = r[c] === null || r[c] === undefined ? null : Number(r[c]);
  return out;
}

export async function listFeatures(pool) {
  const { rows } = await pool.query('SELECT * FROM room_features ORDER BY room_id, sort_order, id');
  return rows.map(normalizeFeatureRow);
}

export async function getFeature(pool, id) {
  const { rows } = await pool.query('SELECT * FROM room_features WHERE id = $1', [id]);
  return rows[0] ? normalizeFeatureRow(rows[0]) : null;
}

export async function createFeature(pool, roomId, f) {
  const { rows } = await pool.query(
    `INSERT INTO room_features (room_id, kind, wall, offset_cm, width_cm, height_cm, sill_height_cm, floor_height_cm, swing)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [roomId, f.kind, f.wall, f.offset_cm, f.width_cm, f.height_cm, f.sill_height_cm, f.floor_height_cm, f.swing]
  );
  return normalizeFeatureRow(rows[0]);
}

// 라우트가 병합+전체검증을 하므로 항상 전체 행을 덮어쓴다.
export async function updateFeature(pool, id, f) {
  const { rows } = await pool.query(
    `UPDATE room_features
     SET kind = $1, wall = $2, offset_cm = $3, width_cm = $4, height_cm = $5,
         sill_height_cm = $6, floor_height_cm = $7, swing = $8
     WHERE id = $9 RETURNING *`,
    [f.kind, f.wall, f.offset_cm, f.width_cm, f.height_cm, f.sill_height_cm, f.floor_height_cm, f.swing, id]
  );
  return rows[0] ? normalizeFeatureRow(rows[0]) : null;
}

export async function deleteFeature(pool, id) {
  const { rowCount } = await pool.query('DELETE FROM room_features WHERE id = $1', [id]);
  return rowCount > 0;
}
```

- [ ] **Step 4: 라우트 구현 + 앱 등록**

`server/routes/room-features.js` 생성:

```js
import express from 'express';
import * as features from '../queries/room-features.js';
import { getRoom } from '../queries/rooms.js';
import { normalizeRoomFeature, parseId } from '../validation.js';

export function roomFeaturesRouter(pool) {
  const r = express.Router();

  r.post('/rooms/:id/features', async (req, res, next) => {
    try {
      const roomId = parseId(req.params.id);
      if (roomId === null) return res.status(404).json({ error: 'Not found' });
      const room = await getRoom(pool, roomId);
      if (!room) return res.status(404).json({ error: 'Room not found' });
      const { errors, value } = normalizeRoomFeature(req.body ?? {}, room);
      if (errors.length) return res.status(400).json({ error: errors.join(', ') });
      res.status(201).json(await features.createFeature(pool, roomId, value));
    } catch (e) { next(e); }
  });

  r.patch('/features/:id', async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      if (id === null) return res.status(404).json({ error: 'Not found' });
      const existing = await features.getFeature(pool, id);
      if (!existing) return res.status(404).json({ error: 'Feature not found' });
      const room = await getRoom(pool, existing.room_id);
      // 부분 수정: 기존 행 위에 body를 병합한 뒤 전체 검증
      const { errors, value } = normalizeRoomFeature({ ...existing, ...req.body }, room);
      if (errors.length) return res.status(400).json({ error: errors.join(', ') });
      res.json(await features.updateFeature(pool, id, value));
    } catch (e) { next(e); }
  });

  r.delete('/features/:id', async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      if (id === null) return res.status(404).json({ error: 'Not found' });
      const ok = await features.deleteFeature(pool, id);
      if (!ok) return res.status(404).json({ error: 'Feature not found' });
      res.status(204).end();
    } catch (e) { next(e); }
  });

  return r;
}
```

`server/app.js`: import 목록에 `import { roomFeaturesRouter } from './routes/room-features.js';` 추가하고, `app.use('/api', homeSettingsRouter(pool));` 아래에 `app.use('/api', roomFeaturesRouter(pool));` 추가.

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run test/room-features.test.js`
Expected: 전부 PASS.

- [ ] **Step 6: Commit**

```bash
git add server/queries/room-features.js server/routes/room-features.js server/app.js test/room-features.test.js
git commit -m "feat: room_features CRUD API (POST/PATCH/DELETE)"
```

---

### Task 7: layout 응답에 방별 features 포함

**Files:**
- Modify: `server/queries/layout.js`
- Test: `test/layout.test.js`

**Interfaces:**
- Consumes: Task 6의 `listFeatures(pool)`.
- Produces: `GET /api/layout`의 각 room 객체에 `features: []` (그 방의 부착물 배열, feature 행 형태는 Task 6과 동일) + `ceiling_height_cm`. 프론트(Task 11·12)가 `room.features`를 그대로 사용.

- [ ] **Step 1: 실패하는 테스트 작성**

`test/layout.test.js` 끝에 추가:

```js
test('layout rooms include ceiling height and wall features', async () => {
  const { app } = createTestApp();
  const room = (await request(app).post('/api/rooms').send({ name: '안방', width_cm: 350, depth_cm: 300 })).body;
  await request(app).patch(`/api/rooms/${room.id}`).send({ ceiling_height_cm: 235 });
  await request(app).post(`/api/rooms/${room.id}/features`)
    .send({ kind: 'door', wall: 'S', offset_cm: 30, width_cm: 80, height_cm: 204, swing: 'in-left' });
  const res = await request(app).get('/api/layout');
  expect(res.body.rooms[0].ceiling_height_cm).toBe(235);
  expect(res.body.rooms[0].features).toEqual([
    expect.objectContaining({ kind: 'door', wall: 'S', offset_cm: 30, width_cm: 80 }),
  ]);
});
```

그리고 기존 `test('empty layout', ...)`의 단언은 rooms가 빈 배열이라 그대로 통과한다 — 수정 불필요.

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run test/layout.test.js`
Expected: 새 테스트 FAIL (`features`가 undefined).

- [ ] **Step 3: 구현**

`server/queries/layout.js` 상단 import에 추가:

```js
import { listFeatures } from './room-features.js';
```

`getLayout` 첫 부분을 다음으로 교체 (rooms 조회 + features 부착):

```js
export async function getLayout(pool) {
  const [roomRows, features] = await Promise.all([listRooms(pool), listFeatures(pool)]);
  const byRoom = new Map(roomRows.map((r) => [r.id, []]));
  for (const f of features) byRoom.get(f.room_id)?.push(f);
  const rooms = roomRows.map((r) => ({ ...r, features: byRoom.get(r.id) }));
```

(이후 `const { rows } = await pool.query(...)` 부분과 반환 `{ rooms, placements, palette, unplaceable }`은 그대로.)

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run test/layout.test.js`
Expected: 전부 PASS.

- [ ] **Step 5: Commit**

```bash
git add server/queries/layout.js test/layout.test.js
git commit -m "feat: layout 응답에 방별 천장·부착물 포함"
```

---

### Task 8: home-settings에 min_ceiling_height_cm 파생 필드

**Files:**
- Modify: `server/queries/home-settings.js` (getHomeSettings, saveHomeSettings)
- Test: `test/home-settings.test.js`

**Interfaces:**
- Produces: `GET/PUT /api/home-settings` 응답에 `min_ceiling_height_cm` (number|null) — 입력된 방 천장 중 최저값. **파생 필드라 저장은 불가** (`HOME_SETTING_FIELDS`에 넣지 않음). Task 13의 `CeilingBadge`가 사용.

- [ ] **Step 1: 실패하는 테스트 작성**

`test/home-settings.test.js` 끝에 추가:

```js
test('GET exposes the lowest room ceiling as min_ceiling_height_cm', async () => {
  const { app } = createTestApp();
  expect((await request(app).get('/api/home-settings')).body.min_ceiling_height_cm).toBeNull();
  const a = (await request(app).post('/api/rooms').send({ name: '거실', width_cm: 400, depth_cm: 300 })).body;
  const b = (await request(app).post('/api/rooms').send({ name: '안방', width_cm: 350, depth_cm: 300 })).body;
  await request(app).patch(`/api/rooms/${a.id}`).send({ ceiling_height_cm: 240 });
  await request(app).patch(`/api/rooms/${b.id}`).send({ ceiling_height_cm: 232 });
  const res = await request(app).get('/api/home-settings');
  expect(res.body.min_ceiling_height_cm).toBe(232);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run test/home-settings.test.js`
Expected: 새 테스트 FAIL (`min_ceiling_height_cm`가 undefined — `toBeNull()`에서 실패).

- [ ] **Step 3: 구현**

`server/queries/home-settings.js`의 `getHomeSettings`와 `saveHomeSettings`를 다음으로 교체:

```js
export async function getHomeSettings(pool) {
  const [settings, ceiling] = await Promise.all([
    pool.query('SELECT * FROM home_settings WHERE id = 1'),
    pool.query('SELECT MIN(ceiling_height_cm) AS min_ceiling FROM rooms'),
  ]);
  if (!settings.rows[0]) return null;
  const out = normalizeHomeSettingsRow(settings.rows[0]);
  // 파생 필드: 입력된 방 천장 중 최저값. 키 큰 가구의 '세울 수 있나' 경고에 쓴다.
  const min = ceiling.rows[0]?.min_ceiling;
  out.min_ceiling_height_cm = min === null || min === undefined ? null : Number(min);
  return out;
}

export async function saveHomeSettings(pool, value) {
  const sets = [];
  const vals = [];
  let i = 1;
  for (const c of HOME_SETTING_COLS) {
    if (c in value) { sets.push(`${c} = $${i++}`); vals.push(value[c]); }
  }
  sets.push('updated_at = now()');
  vals.push(1);
  const { rows } = await pool.query(
    `UPDATE home_settings SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    vals
  );
  return rows[0] ? getHomeSettings(pool) : null; // 파생 필드 포함해 동일한 형태로 반환
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run test/home-settings.test.js`
Expected: 전부 PASS.

- [ ] **Step 5: Commit**

```bash
git add server/queries/home-settings.js test/home-settings.test.js
git commit -m "feat: home-settings 응답에 최저 천장 파생 필드"
```

---

### Task 9: features.js 프론트 헬퍼 (메타·요약·칩)

**Files:**
- Create: `web/src/features.js`
- Test: `web/src/features.test.js` (새 파일)

**Interfaces:**
- Produces: `WALLS`, `WALL_LABEL`, `SWINGS`, `SWING_LABEL`, `FEATURE_META` (kind → `{ label, icon }`), `featureSummary(f)` (패널 한 줄 요약), `featureChip(f)` (평면도 클릭 칩 텍스트). Task 11·12가 사용.

- [ ] **Step 1: 실패하는 테스트 작성**

`web/src/features.test.js` 생성:

```js
import { test, expect } from 'vitest';
import { featureSummary, featureChip } from './features.js';

test('door summary includes wall, offset, size, and swing', () => {
  expect(featureSummary({ kind: 'door', wall: 'S', offset_cm: 30, width_cm: 80, height_cm: 204, swing: 'in-left' }))
    .toBe('남쪽 · 모서리 30cm · 폭80 · 높이204 · 안·좌');
});

test('window summary includes the sill height', () => {
  expect(featureSummary({ kind: 'window', wall: 'N', offset_cm: 90, width_cm: 180, height_cm: 120, sill_height_cm: 90 }))
    .toBe('북쪽 · 모서리 90cm · 폭180 · 높이120 · 턱90');
});

test('outlet summary skips size fields', () => {
  expect(featureSummary({ kind: 'outlet', wall: 'E', offset_cm: 150, width_cm: null, height_cm: null, floor_height_cm: 30 }))
    .toBe('동쪽 · 모서리 150cm · 바닥 30cm');
});

test('window chip shows W·H·턱', () => {
  expect(featureChip({ kind: 'window', wall: 'N', offset_cm: 90, width_cm: 180, height_cm: 120, sill_height_cm: 90 }))
    .toBe('W180 · H120 · 턱90');
});

test('outlet chip shows floor height', () => {
  expect(featureChip({ kind: 'outlet', wall: 'E', offset_cm: 150, floor_height_cm: 30 })).toBe('바닥 30cm');
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run web/src/features.test.js`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 구현**

`web/src/features.js` 생성:

```js
// 방 부착물(문·창문·콘센트) 표시용 메타/문자열 헬퍼. 프레임워크 무관.

export const WALLS = ['N', 'E', 'S', 'W'];
export const WALL_LABEL = { N: '북쪽', E: '동쪽', S: '남쪽', W: '서쪽' };

export const SWINGS = ['in-left', 'in-right', 'out-left', 'out-right'];
export const SWING_LABEL = { 'in-left': '안·좌', 'in-right': '안·우', 'out-left': '밖·좌', 'out-right': '밖·우' };

export const FEATURE_META = {
  door: { label: '문', icon: '🚪' },
  window: { label: '창문', icon: '⊞' },
  outlet: { label: '콘센트', icon: '⚡' },
};

// 패널 한 줄 요약: "남쪽 · 모서리 30cm · 폭80 · 높이204 · 안·좌"
export function featureSummary(f) {
  const parts = [WALL_LABEL[f.wall], `모서리 ${f.offset_cm}cm`];
  if (f.width_cm != null) parts.push(`폭${f.width_cm}`);
  if (f.height_cm != null) parts.push(`높이${f.height_cm}`);
  if (f.kind === 'door' && f.swing) parts.push(SWING_LABEL[f.swing]);
  if (f.kind === 'window' && f.sill_height_cm != null) parts.push(`턱${f.sill_height_cm}`);
  if (f.kind === 'outlet' && f.floor_height_cm != null) parts.push(`바닥 ${f.floor_height_cm}cm`);
  return parts.join(' · ');
}

// 평면도 기호 클릭 칩. 수직(높이) 정보는 위에서 본 도면에 못 그리므로 여기로 분리한다.
export function featureChip(f) {
  const parts = [];
  if (f.width_cm != null) parts.push(`W${f.width_cm}`);
  if (f.height_cm != null) parts.push(`H${f.height_cm}`);
  if (f.kind === 'window' && f.sill_height_cm != null) parts.push(`턱${f.sill_height_cm}`);
  if (f.kind === 'door' && f.swing) parts.push(SWING_LABEL[f.swing]);
  if (f.kind === 'outlet') parts.push(f.floor_height_cm != null ? `바닥 ${f.floor_height_cm}cm` : '콘센트');
  return parts.join(' · ');
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run web/src/features.test.js`
Expected: 전부 PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/features.js web/src/features.test.js
git commit -m "feat: 방 부착물 표시 헬퍼 (요약·칩 문자열)"
```

---

### Task 10: geometry.js 벽 앵커 기하 (wallSegment, doorArcPath)

**Files:**
- Modify: `web/src/geometry.js` (끝에 추가)
- Test: `web/src/geometry.test.js` (기존 파일 끝에 추가)

**Interfaces:**
- Consumes: 기존 `cmToPx`, `PX_PER_CM`(0.6).
- Produces: `wallSegment(room, wall, offsetCm, lenCm=0) → { x1, y1, x2, y2 }` (cm, 캔버스 좌표계; len 0이면 점), `doorArcPath(room, f) → string` (SVG path, **px**). Task 12가 사용.

- [ ] **Step 1: 실패하는 테스트 작성**

`web/src/geometry.test.js` 끝에 추가 (파일 상단 import에 `wallSegment, doorArcPath` 추가):

```js
const ROOM = { x: 100, y: 50, width_cm: 400, depth_cm: 300 };

test('wallSegment: N/S walls run from the west corner', () => {
  expect(wallSegment(ROOM, 'N', 90, 180)).toEqual({ x1: 190, y1: 50, x2: 370, y2: 50 });
  expect(wallSegment(ROOM, 'S', 0, 80)).toEqual({ x1: 100, y1: 350, x2: 180, y2: 350 });
});

test('wallSegment: E/W walls run from the north corner; len 0 is a point', () => {
  expect(wallSegment(ROOM, 'W', 10, 20)).toEqual({ x1: 100, y1: 60, x2: 100, y2: 80 });
  expect(wallSegment(ROOM, 'E', 150, 0)).toEqual({ x1: 500, y1: 200, x2: 500, y2: 200 });
});

test('doorArcPath: in-left door on the S wall sweeps into the room', () => {
  const room = { x: 0, y: 0, width_cm: 400, depth_cm: 300 };
  const f = { kind: 'door', wall: 'S', offset_cm: 100, width_cm: 80, swing: 'in-left' };
  // 경첩 (100,300), free (180,300), 안쪽(-y) → end (100,220); px = cm × 0.6
  expect(doorArcPath(room, f)).toBe('M 108 180 A 48 48 0 0 0 60 132 L 60 180');
});

test('doorArcPath: out-right flips both hinge and direction', () => {
  const room = { x: 0, y: 0, width_cm: 400, depth_cm: 300 };
  const f = { kind: 'door', wall: 'S', offset_cm: 100, width_cm: 80, swing: 'out-right' };
  // 경첩 (180,300), free (100,300), 바깥(+y) → end (180,380)
  expect(doorArcPath(room, f)).toBe('M 60 180 A 48 48 0 0 0 108 228 L 108 180');
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run web/src/geometry.test.js`
Expected: 새 테스트 FAIL — export 없음.

- [ ] **Step 3: 구현**

`web/src/geometry.js` 끝에 추가:

```js
// ---- 벽 앵커(방 부착물) 기하 ----
// offset 0점 규약 — N/S 벽: 서쪽(왼쪽) 모서리, E/W 벽: 북쪽(위) 모서리.

// 벽 위 offset에서 len만큼의 선분(cm, 캔버스 좌표계). len 0이면 점(콘센트).
export function wallSegment(room, wall, offsetCm, lenCm = 0) {
  const x = Number(room.x), y = Number(room.y);
  const w = Number(room.width_cm), d = Number(room.depth_cm);
  switch (wall) {
    case 'N': return { x1: x + offsetCm, y1: y, x2: x + offsetCm + lenCm, y2: y };
    case 'S': return { x1: x + offsetCm, y1: y + d, x2: x + offsetCm + lenCm, y2: y + d };
    case 'W': return { x1: x, y1: y + offsetCm, x2: x, y2: y + offsetCm + lenCm };
    case 'E': return { x1: x + w, y1: y + offsetCm, x2: x + w, y2: y + offsetCm + lenCm };
    default: return null;
  }
}

const INWARD = { N: [0, 1], S: [0, -1], W: [1, 0], E: [-1, 0] };

// 문 열림 기호(부채꼴 호 + 문짝)의 SVG path(px). swing의 좌/우는 offset 0점 쪽 끝이
// 경첩이면 'left', 반대쪽 끝이면 'right'. 안/밖은 방 안쪽/바깥쪽으로 열림.
export function doorArcPath(room, f) {
  const seg = wallSegment(room, f.wall, f.offset_cm, f.width_cm);
  const swing = f.swing ?? 'in-left';
  const hingeAtStart = swing.endsWith('left');
  const h = hingeAtStart ? [seg.x1, seg.y1] : [seg.x2, seg.y2];
  const free = hingeAtStart ? [seg.x2, seg.y2] : [seg.x1, seg.y1];
  const dir = swing.startsWith('out') ? -1 : 1;
  const [nx, ny] = INWARD[f.wall];
  const end = [h[0] + nx * dir * f.width_cm, h[1] + ny * dir * f.width_cm];
  // free → end 회전 방향(SVG sweep 플래그)은 외적 부호로 결정
  const cross = (free[0] - h[0]) * (end[1] - h[1]) - (free[1] - h[1]) * (end[0] - h[0]);
  const sweep = cross > 0 ? 1 : 0;
  const r = cmToPx(f.width_cm);
  return `M ${cmToPx(free[0])} ${cmToPx(free[1])} A ${r} ${r} 0 0 ${sweep} ${cmToPx(end[0])} ${cmToPx(end[1])} L ${cmToPx(h[0])} ${cmToPx(h[1])}`;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run web/src/geometry.test.js`
Expected: 전부 PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/geometry.js web/src/geometry.test.js
git commit -m "feat: 벽 앵커 기하 — wallSegment·doorArcPath"
```

---

### Task 11: api.js 확장 + RoomCard 패널 컴포넌트 + LayoutPage 통합

**Files:**
- Modify: `web/src/api.js` (3개 메서드 추가)
- Create: `web/src/RoomCard.jsx`
- Modify: `web/src/pages/LayoutPage.jsx` (방 목록을 RoomCard로 교체, 선택 상태 추가)
- Modify: `web/src/styles.css` (끝에 패널 CSS 추가)
- Test: `web/src/RoomCard.test.jsx` (새 파일), `web/src/pages/LayoutPage.test.jsx`

**Interfaces:**
- Consumes: Task 6·7의 API, Task 9의 `FEATURE_META, WALLS, WALL_LABEL, SWINGS, SWING_LABEL, featureSummary`.
- Produces: `api.createFeature(roomId, data)`, `api.updateFeature(id, data)`, `api.deleteFeature(id)`. `RoomCard({ room, onChanged, onDelete, selectedId?, onSelect? })` — Task 12가 selectedId/onSelect를 캔버스와 연결. LayoutPage에 `selectedFeature` 상태와 토글 함수 `selectFeature(id)`.

- [ ] **Step 1: api.js 메서드 추가**

`web/src/api.js`의 `saveHomeSettings` 줄 다음에 추가:

```js
  createFeature: (roomId, data) => req(`/rooms/${roomId}/features`, { method: 'POST', body: JSON.stringify(data) }),
  updateFeature: (id, data) => req(`/features/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteFeature: (id) => req(`/features/${id}`, { method: 'DELETE' }),
```

- [ ] **Step 2: 실패하는 테스트 작성**

`web/src/RoomCard.test.jsx` 생성:

```jsx
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, test, expect, beforeEach } from 'vitest';
import { RoomCard } from './RoomCard.jsx';
import { api } from './api.js';

vi.mock('./api.js', () => ({
  api: { createFeature: vi.fn(), updateFeature: vi.fn(), deleteFeature: vi.fn(), updateRoom: vi.fn() },
}));

beforeEach(() => { vi.clearAllMocks(); });

const ROOM = {
  id: 1, name: '거실', x: 0, y: 0, width_cm: 400, depth_cm: 300, ceiling_height_cm: null,
  features: [
    { id: 11, kind: 'door', wall: 'S', offset_cm: 30, width_cm: 80, height_cm: 204, sill_height_cm: null, floor_height_cm: null, swing: 'in-left' },
  ],
};

test('lists existing features with a one-line summary', () => {
  render(<RoomCard room={ROOM} onChanged={vi.fn()} onDelete={vi.fn()} />);
  expect(screen.getByText('남쪽 · 모서리 30cm · 폭80 · 높이204 · 안·좌')).toBeInTheDocument();
});

test('＋문 opens a door form and submits kind + fields', async () => {
  api.createFeature.mockResolvedValue({});
  const onChanged = vi.fn();
  render(<RoomCard room={ROOM} onChanged={onChanged} onDelete={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: '＋ 문' }));
  await userEvent.selectOptions(screen.getByLabelText('벽'), 'S');
  await userEvent.type(screen.getByLabelText('모서리에서'), '30');
  await userEvent.type(screen.getByLabelText('폭'), '80');
  await userEvent.selectOptions(screen.getByLabelText('열림'), 'in-left');
  await userEvent.click(screen.getByRole('button', { name: '저장' }));
  await waitFor(() => expect(api.createFeature).toHaveBeenCalledWith(1,
    expect.objectContaining({ kind: 'door', wall: 'S', offset_cm: '30', width_cm: '80', swing: 'in-left' })));
  expect(onChanged).toHaveBeenCalled();
});

test('콘센트 form has no width field but has a floor-height field', async () => {
  render(<RoomCard room={ROOM} onChanged={vi.fn()} onDelete={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: '＋ 콘센트' }));
  expect(screen.queryByLabelText('폭')).not.toBeInTheDocument();
  expect(screen.getByLabelText('바닥에서')).toBeInTheDocument();
});

test('ceiling blur saves via updateRoom', async () => {
  api.updateRoom.mockResolvedValue({});
  render(<RoomCard room={ROOM} onChanged={vi.fn()} onDelete={vi.fn()} />);
  const inp = screen.getByLabelText('거실 천장 높이');
  await userEvent.type(inp, '235');
  fireEvent.blur(inp);
  await waitFor(() => expect(api.updateRoom).toHaveBeenCalledWith(1, { ceiling_height_cm: '235' }));
});

test('수정 opens a pre-filled form and PATCHes', async () => {
  api.updateFeature.mockResolvedValue({});
  render(<RoomCard room={ROOM} onChanged={vi.fn()} onDelete={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: '수정' }));
  const off = screen.getByLabelText('모서리에서');
  expect(off).toHaveValue('30');
  await userEvent.clear(off);
  await userEvent.type(off, '40');
  await userEvent.click(screen.getByRole('button', { name: '저장' }));
  await waitFor(() => expect(api.updateFeature).toHaveBeenCalledWith(11, expect.objectContaining({ offset_cm: '40' })));
});

test('삭제 calls deleteFeature', async () => {
  api.deleteFeature.mockResolvedValue(null);
  const onChanged = vi.fn();
  render(<RoomCard room={ROOM} onChanged={onChanged} onDelete={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: '부착물 삭제 11' }));
  await waitFor(() => expect(api.deleteFeature).toHaveBeenCalledWith(11));
});
```

주의: 화면 텍스트 `'삭제'` 버튼은 feature 행과 방 헤더에 모두 있어 모호하다. 그래서 구현(Step 4)에서 feature 삭제 버튼에 `aria-label={\`부착물 삭제 ${f.id}\`}`, 방 삭제 버튼에 `aria-label={\`방 삭제 ${room.name}\`}`을 붙이고 테스트는 aria-label로 조회한다.

- [ ] **Step 3: 테스트 실패 확인**

Run: `npx vitest run web/src/RoomCard.test.jsx`
Expected: FAIL — 모듈 없음.

- [ ] **Step 4: RoomCard 구현**

`web/src/RoomCard.jsx` 생성:

```jsx
import { useState } from 'react';
import { api } from './api.js';
import { FEATURE_META, WALLS, WALL_LABEL, SWINGS, SWING_LABEL, featureSummary } from './features.js';

const EMPTY = { wall: 'N', offset_cm: '', width_cm: '', height_cm: '', sill_height_cm: '', floor_height_cm: '', swing: '' };

const editValues = (f) => ({
  wall: f.wall,
  offset_cm: f.offset_cm ?? '',
  width_cm: f.width_cm ?? '',
  height_cm: f.height_cm ?? '',
  sill_height_cm: f.sill_height_cm ?? '',
  floor_height_cm: f.floor_height_cm ?? '',
  swing: f.swing ?? '',
});

// 패널의 방 카드: 방별 천장 높이 + 벽 부착물(문·창문·콘센트) 목록과 ＋ 추가/수정 폼.
export function RoomCard({ room, onChanged, onDelete, selectedId = null, onSelect = () => {} }) {
  const features = room.features ?? [];
  const [adding, setAdding] = useState(null); // null | 'door' | 'window' | 'outlet'
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [ceiling, setCeiling] = useState(room.ceiling_height_cm ?? '');
  const [error, setError] = useState(null);

  const setField = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const editingFeature = features.find((f) => f.id === editingId);

  async function saveCeiling() {
    if (String(room.ceiling_height_cm ?? '') === String(ceiling)) return;
    try { setError(null); await api.updateRoom(room.id, { ceiling_height_cm: ceiling }); await onChanged(); }
    catch (e) { setError(e.message); }
  }

  async function submitAdd(e) {
    e.preventDefault();
    try { setError(null); await api.createFeature(room.id, { kind: adding, ...form }); setAdding(null); setForm(EMPTY); await onChanged(); }
    catch (e2) { setError(e2.message); }
  }

  async function submitEdit(e) {
    e.preventDefault();
    try { setError(null); await api.updateFeature(editingId, form); setEditingId(null); setForm(EMPTY); await onChanged(); }
    catch (e2) { setError(e2.message); }
  }

  async function removeFeature(id) {
    try { setError(null); await api.deleteFeature(id); await onChanged(); }
    catch (e2) { setError(e2.message); }
  }

  function startAdd(kind) { setAdding(kind); setEditingId(null); setForm(EMPTY); }
  function startEdit(f) { setEditingId(f.id); setAdding(null); setForm(editValues(f)); }
  function cancel() { setAdding(null); setEditingId(null); setForm(EMPTY); }

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

      {features.length > 0 && (
        <ul className="feat-list">
          {features.map((f) => (
            <li key={f.id} className={selectedId === f.id ? 'feat-selected' : ''}>
              <button type="button" className="feat-main" onClick={() => onSelect(f.id)}>
                <span className="feat-ico">{FEATURE_META[f.kind].icon}</span>
                <span className="feat-kind">{FEATURE_META[f.kind].label}</span>
                <span className="feat-sum">{featureSummary(f)}</span>
              </button>
              <button type="button" onClick={() => startEdit(f)}>수정</button>
              <button type="button" className="danger" aria-label={`부착물 삭제 ${f.id}`} onClick={() => removeFeature(f.id)}>삭제</button>
            </li>
          ))}
        </ul>
      )}

      {adding === null && editingId === null && (
        <div className="feat-add">
          {Object.entries(FEATURE_META).map(([kind, m]) => (
            <button key={kind} type="button" onClick={() => startAdd(kind)}>＋ {m.label}</button>
          ))}
        </div>
      )}

      {adding !== null && <FeatureForm kind={adding} form={form} setField={setField} onSubmit={submitAdd} onCancel={cancel} />}
      {editingFeature && <FeatureForm kind={editingFeature.kind} form={form} setField={setField} onSubmit={submitEdit} onCancel={cancel} />}
    </div>
  );
}

// 종류별 인라인 폼. 공통 필드(벽·모서리 offset)가 앞, kind별 필드가 뒤.
function FeatureForm({ kind, form, setField, onSubmit, onCancel }) {
  return (
    <form onSubmit={onSubmit} className="feat-form">
      <select aria-label="벽" value={form.wall} onChange={setField('wall')}>
        {WALLS.map((w) => <option key={w} value={w}>{WALL_LABEL[w]} 벽</option>)}
      </select>
      <input aria-label="모서리에서" placeholder="모서리에서(cm)" value={form.offset_cm} onChange={setField('offset_cm')} />
      {kind !== 'outlet' && <input aria-label="폭" placeholder="폭(cm)" value={form.width_cm} onChange={setField('width_cm')} />}
      {kind === 'door' && <input aria-label="통과 높이" placeholder="통과 높이(cm)" value={form.height_cm} onChange={setField('height_cm')} />}
      {kind === 'door' && (
        <select aria-label="열림" value={form.swing} onChange={setField('swing')}>
          <option value="">열림 방향</option>
          {SWINGS.map((s) => <option key={s} value={s}>{SWING_LABEL[s]}</option>)}
        </select>
      )}
      {kind === 'window' && <input aria-label="창 높이" placeholder="창 높이(cm)" value={form.height_cm} onChange={setField('height_cm')} />}
      {kind === 'window' && <input aria-label="창턱" placeholder="턱 높이(cm)" value={form.sill_height_cm} onChange={setField('sill_height_cm')} />}
      {kind === 'outlet' && <input aria-label="바닥에서" placeholder="바닥에서(cm)" value={form.floor_height_cm} onChange={setField('floor_height_cm')} />}
      <div className="feat-form-actions">
        <button type="submit">저장</button>
        <button type="button" className="btn-ghost" onClick={onCancel}>취소</button>
      </div>
    </form>
  );
}
```

- [ ] **Step 5: LayoutPage 통합**

`web/src/pages/LayoutPage.jsx`:

1. import 추가: `import { RoomCard } from '../RoomCard.jsx';`
2. 상태 추가 (`const [drag, setDrag] = useState(null);` 아래):

```jsx
  const [selectedFeature, setSelectedFeature] = useState(null);
  const selectFeature = (id) => setSelectedFeature((cur) => (cur === id ? null : id));
```

3. "새 방 추가" 섹션의 `<ul className="mini-list" data-testid="room-list">…</ul>` 전체를 다음으로 교체:

```jsx
            <div data-testid="room-list">
              {rooms.map((r) => (
                <RoomCard key={r.id} room={r} onChanged={load} onDelete={() => removeRoom(r.id)}
                  selectedId={selectedFeature} onSelect={selectFeature} />
              ))}
              {rooms.length === 0 && <p className="mini-list muted">아직 방이 없어요</p>}
            </div>
```

- [ ] **Step 6: LayoutPage 테스트 갱신**

`web/src/pages/LayoutPage.test.jsx`의 `vi.mock`에 `createFeature: vi.fn(), updateFeature: vi.fn(), deleteFeature: vi.fn(),` 추가. 파일 끝에 테스트 추가:

```jsx
test('room card lists features and saves ceiling height', async () => {
  api.getLayout.mockResolvedValue({
    rooms: [{ id: 1, name: '거실', x: 0, y: 0, width_cm: 400, depth_cm: 500, ceiling_height_cm: null, features: [
      { id: 11, kind: 'outlet', wall: 'E', offset_cm: 150, width_cm: null, height_cm: null, sill_height_cm: null, floor_height_cm: 30, swing: null },
    ] }],
    placements: [], palette: [], unplaceable: [],
  });
  api.updateRoom.mockResolvedValue({});
  render(<MemoryRouter><LayoutPage /></MemoryRouter>);
  expect(await screen.findByText('동쪽 · 모서리 150cm · 바닥 30cm')).toBeInTheDocument();
  const inp = screen.getByLabelText('거실 천장 높이');
  await userEvent.type(inp, '240');
  await userEvent.tab();
  await waitFor(() => expect(api.updateRoom).toHaveBeenCalledWith(1, { ceiling_height_cm: '240' }));
});
```

- [ ] **Step 7: 패널 CSS 추가**

`web/src/styles.css` 끝에 추가:

```css
/* ---------- room measurement card (패널 방 카드) ---------- */
.room-card { padding: 8px 4px; border-bottom: 1px solid var(--line); display: flex; flex-direction: column; gap: 6px; }
.room-card:last-of-type { border-bottom: 0; }
.room-card-head { display: flex; align-items: center; gap: 8px; font: 500 12.5px var(--sans); color: var(--ink); }
.room-card-head .danger { margin-left: auto; flex: none; font: 600 11px var(--sans); min-height: 0; padding: 4px 8px; border-radius: 7px; background: transparent; color: var(--danger); }
.ceiling-input { display: inline-flex; align-items: center; gap: 4px; font: 500 11.5px var(--sans); color: var(--ink-3); }
.ceiling-input input { width: 52px; min-height: 0; padding: 4px 6px; border-radius: 7px; background: var(--surface-soft); font: 500 12px var(--num); }
.feat-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.feat-list li { display: flex; align-items: center; gap: 6px; padding: 4px 2px; border-radius: var(--r-xs); font: 500 12px var(--sans); }
.feat-list li.feat-selected { background: var(--rose-soft); }
.feat-list .feat-main { display: flex; align-items: center; gap: 6px; flex: 1 1 auto; min-width: 0; background: transparent; border: 0; padding: 0; text-align: left; font: inherit; color: inherit; cursor: pointer; min-height: 0; }
.feat-list .feat-sum { color: var(--ink-3); font-size: 11.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.feat-list li > button { flex: none; font: 600 11px var(--sans); min-height: 0; padding: 3px 8px; border-radius: 7px; background: var(--surface-soft2); color: var(--ink-2); }
.feat-list li > button.danger { background: transparent; color: var(--danger); }
.feat-add { display: flex; gap: 6px; flex-wrap: wrap; }
.feat-add button { font: 600 11.5px var(--sans); min-height: 0; padding: 5px 10px; border-radius: 8px; background: var(--surface-soft2); color: var(--ink-2); }
.feat-add button:hover { background: var(--chip); }
.feat-form { display: flex; flex-direction: column; gap: 6px; }
.feat-form input, .feat-form select { min-height: 34px; padding: 6px 9px; border-radius: 8px; background: var(--surface-soft); font: 500 12px var(--sans); }
.feat-form-actions { display: flex; gap: 6px; }
.feat-form-actions button { min-height: 34px; padding: 6px 12px; border-radius: 8px; font: 600 12px var(--sans); }
```

- [ ] **Step 8: 테스트 통과 확인**

Run: `npx vitest run web/src/RoomCard.test.jsx web/src/pages/LayoutPage.test.jsx`
Expected: 전부 PASS (기존 LayoutPage 테스트 포함 — `room-list` testid와 `거실 (400×500)` 텍스트는 RoomCard가 그대로 렌더).

- [ ] **Step 9: Commit**

```bash
git add web/src/api.js web/src/RoomCard.jsx web/src/RoomCard.test.jsx web/src/pages/LayoutPage.jsx web/src/pages/LayoutPage.test.jsx web/src/styles.css
git commit -m "feat: 패널 방 카드 — 천장 입력 + 부착물 ＋ 추가/수정/삭제"
```

---

### Task 12: FeatureSymbols 캔버스 렌더 + 클릭 칩 + 하이라이트

**Files:**
- Create: `web/src/FeatureSymbols.jsx`
- Modify: `web/src/pages/LayoutPage.jsx` (방 `<g>` 안에 심볼 렌더)
- Modify: `web/src/styles.css` (끝에 기호 CSS 추가)
- Test: `web/src/pages/LayoutPage.test.jsx`

**Interfaces:**
- Consumes: Task 10의 `wallSegment`, `doorArcPath`, `cmToPx`; Task 9의 `featureChip`; Task 11의 `selectedFeature`/`selectFeature`.
- Produces: `FeatureSymbols({ room, selectedId?, onSelect? })` — SVG `<g>` 목록 반환, 각 기호 `data-testid={feat-<id>}`. 방 `<g>` 내부에 렌더하므로 방 드래그 시 자동으로 따라온다.

- [ ] **Step 1: 실패하는 테스트 작성**

`web/src/pages/LayoutPage.test.jsx` 끝에 추가:

```jsx
test('renders wall feature symbols and toggles the info chip on click', async () => {
  api.getLayout.mockResolvedValue({
    rooms: [{ id: 1, name: '거실', x: 0, y: 0, width_cm: 400, depth_cm: 500, ceiling_height_cm: null, features: [
      { id: 11, kind: 'window', wall: 'N', offset_cm: 90, width_cm: 180, height_cm: 120, sill_height_cm: 90, floor_height_cm: null, swing: null },
      { id: 12, kind: 'door', wall: 'S', offset_cm: 30, width_cm: 80, height_cm: 204, sill_height_cm: null, floor_height_cm: null, swing: 'in-left' },
      { id: 13, kind: 'outlet', wall: 'E', offset_cm: 150, width_cm: null, height_cm: null, sill_height_cm: null, floor_height_cm: 30, swing: null },
    ] }],
    placements: [], palette: [], unplaceable: [],
  });
  render(<MemoryRouter><LayoutPage /></MemoryRouter>);
  const win = await screen.findByTestId('feat-11');
  expect(screen.getByTestId('feat-12')).toBeInTheDocument();
  expect(screen.getByTestId('feat-13')).toBeInTheDocument();
  expect(screen.queryByText('W180 · H120 · 턱90')).not.toBeInTheDocument();
  fireEvent.click(win);
  expect(screen.getByText('W180 · H120 · 턱90')).toBeInTheDocument();
  fireEvent.click(win); // 다시 클릭하면 칩 닫힘
  expect(screen.queryByText('W180 · H120 · 턱90')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run web/src/pages/LayoutPage.test.jsx`
Expected: 새 테스트 FAIL (`feat-11` testid 없음).

- [ ] **Step 3: FeatureSymbols 구현**

`web/src/FeatureSymbols.jsx` 생성:

```jsx
import { cmToPx, wallSegment, doorArcPath } from './geometry.js';
import { featureChip } from './features.js';

// 평면도 SVG에 방 부착물을 표준 도면 기호로 그린다.
// 문 = 벽 개구부(틈) + 열림 부채꼴 호, 창문 = 벽 위 이중선, 콘센트 = 벽 위 점.
// 수직(높이) 정보는 위에서 본 도면에 못 그리므로 클릭 시 칩으로 보여준다.
export function FeatureSymbols({ room, selectedId = null, onSelect = () => {} }) {
  return (room.features ?? []).map((f) => {
    const seg = wallSegment(room, f.wall, f.offset_cm, f.width_cm ?? 0);
    const selected = selectedId === f.id;
    const common = {
      className: `feat-sym feat-${f.kind}${selected ? ' selected' : ''}`,
      'data-testid': `feat-${f.id}`,
      onClick: () => onSelect(f.id),
    };
    const midX = cmToPx((seg.x1 + seg.x2) / 2);
    const midY = cmToPx((seg.y1 + seg.y2) / 2);
    const chip = selected && (
      <text className="feat-chip" x={midX} y={midY - 10} textAnchor="middle">{featureChip(f)}</text>
    );

    if (f.kind === 'door') {
      return (
        <g key={f.id} {...common}>
          <line className="door-gap" x1={cmToPx(seg.x1)} y1={cmToPx(seg.y1)} x2={cmToPx(seg.x2)} y2={cmToPx(seg.y2)} />
          <path className="door-arc" d={doorArcPath(room, f)} />
          {chip}
        </g>
      );
    }
    if (f.kind === 'window') {
      const vertical = f.wall === 'E' || f.wall === 'W';
      const ox = vertical ? 2 : 0;
      const oy = vertical ? 0 : 2;
      return (
        <g key={f.id} {...common}>
          <line className="win-line" x1={cmToPx(seg.x1) - ox} y1={cmToPx(seg.y1) - oy} x2={cmToPx(seg.x2) - ox} y2={cmToPx(seg.y2) - oy} />
          <line className="win-line" x1={cmToPx(seg.x1) + ox} y1={cmToPx(seg.y1) + oy} x2={cmToPx(seg.x2) + ox} y2={cmToPx(seg.y2) + oy} />
          {chip}
        </g>
      );
    }
    return (
      <g key={f.id} {...common}>
        <circle className="outlet-dot" cx={cmToPx(seg.x1)} cy={cmToPx(seg.y1)} r={4} />
        {chip}
      </g>
    );
  });
}
```

- [ ] **Step 4: LayoutPage에 심볼 렌더**

`web/src/pages/LayoutPage.jsx`:

1. import 추가: `import { FeatureSymbols } from '../FeatureSymbols.jsx';`
2. 방 렌더 `<g>` 안, `<text …room-label…>` 다음에 추가:

```jsx
                  <FeatureSymbols room={r} selectedId={selectedFeature} onSelect={selectFeature} />
```

- [ ] **Step 5: 기호 CSS 추가**

`web/src/styles.css` 끝에 추가:

```css
/* ---------- floor plan wall features (문·창·콘센트 기호) ---------- */
.feat-sym { cursor: pointer; }
.feat-sym .door-gap { stroke: #fbfafe; stroke-width: 4; }
.feat-sym .door-arc { fill: none; stroke: var(--amber-2); stroke-width: 1.3; stroke-dasharray: 4 3; }
.feat-sym .win-line { stroke: #5a8fd6; stroke-width: 2; }
.feat-sym .outlet-dot { fill: var(--amber); stroke: #fff; stroke-width: 1; }
.feat-sym.selected .door-arc, .feat-sym.selected .win-line { stroke-width: 3; }
.feat-sym.selected .outlet-dot { stroke: var(--ink); stroke-width: 2; }
.feat-chip { font: 600 11px var(--num); fill: var(--ink); paint-order: stroke; stroke: #fff; stroke-width: 3px; stroke-linejoin: round; }
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npx vitest run web/src/pages/LayoutPage.test.jsx`
Expected: 전부 PASS.

- [ ] **Step 7: Commit**

```bash
git add web/src/FeatureSymbols.jsx web/src/pages/LayoutPage.jsx web/src/pages/LayoutPage.test.jsx web/src/styles.css
git commit -m "feat: 평면도에 문·창·콘센트 도면 기호 + 클릭 칩"
```

---

### Task 13: CeilingBadge + 홈·품목 상세 통합 + 전체 검증

**Files:**
- Create: `web/src/CeilingBadge.jsx`
- Modify: `web/src/pages/HomePage.jsx` (확정 행), `web/src/pages/ItemDetailPage.jsx` (확정 후보 chip-row)
- Test: `web/src/CeilingBadge.test.jsx` (새 파일), `web/src/pages/HomePage.test.jsx`

**Interfaces:**
- Consumes: Task 8의 `settings.min_ceiling_height_cm`.
- Produces: `CeilingBadge({ heightCm, settings })` — 초과 시에만 `천장 초과` 경고 칩, 아니면 null.

- [ ] **Step 1: 실패하는 테스트 작성**

`web/src/CeilingBadge.test.jsx` 생성:

```jsx
import { render, screen } from '@testing-library/react';
import { test, expect } from 'vitest';
import { CeilingBadge } from './CeilingBadge.jsx';

test('warns when the item is taller than the lowest ceiling', () => {
  render(<CeilingBadge heightCm={250} settings={{ min_ceiling_height_cm: 235 }} />);
  expect(screen.getByText('천장 초과')).toBeInTheDocument();
});

test('renders nothing when it fits or data is missing', () => {
  const { container: a } = render(<CeilingBadge heightCm={200} settings={{ min_ceiling_height_cm: 235 }} />);
  expect(a).toBeEmptyDOMElement();
  const { container: b } = render(<CeilingBadge heightCm={250} settings={{ min_ceiling_height_cm: null }} />);
  expect(b).toBeEmptyDOMElement();
  const { container: c } = render(<CeilingBadge heightCm={null} settings={{ min_ceiling_height_cm: 235 }} />);
  expect(c).toBeEmptyDOMElement();
});
```

`web/src/pages/HomePage.test.jsx` 끝에 추가:

```jsx
test('shows 천장 초과 when a confirmed item is taller than the lowest ceiling', async () => {
  api.getSummary.mockResolvedValue({ confirmed_total: 500000, unconfirmed_count: 0 });
  api.getHomeSettings.mockResolvedValue({ id: 1, budget_limit: null, min_ceiling_height_cm: 235 });
  api.listItems.mockResolvedValue([
    { id: 1, name: '장롱', category: 'furniture', confirmed_candidate_id: 9, confirmed_name: '한샘',
      confirmed_price: 500000, confirmed_height_cm: 250, candidate_count: 1 },
  ]);
  render(<MemoryRouter><HomePage /></MemoryRouter>);
  expect(await screen.findByText('천장 초과')).toBeInTheDocument();
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run web/src/CeilingBadge.test.jsx web/src/pages/HomePage.test.jsx`
Expected: FAIL — 모듈 없음 / `천장 초과` 텍스트 없음.

- [ ] **Step 3: 구현**

`web/src/CeilingBadge.jsx` 생성:

```jsx
// 확정 후보의 높이가 입력된 방 천장 최저값(min_ceiling_height_cm, 서버 파생 필드)보다
// 높으면 '천장 초과' 경고 칩. 방별 정밀 비교(배치 기반)는 단계 4에서 다룬다.
export function CeilingBadge({ heightCm, settings }) {
  const min = Number(settings?.min_ceiling_height_cm);
  const h = heightCm === null || heightCm === undefined || heightCm === '' ? null : Number(heightCm);
  if (!(min > 0) || !(h > 0) || h <= min) return null;
  return (
    <span className="carry-badge carry-fail" title={`가구 높이 ${h}cm — 최저 천장 ${min}cm 초과`}>
      <span className="carry-ico">⚠</span>
      <span className="carry-text">천장 초과</span>
    </span>
  );
}
```

`web/src/pages/HomePage.jsx`: import 추가 `import { CeilingBadge } from '../CeilingBadge.jsx';` 후 확정 행의 `<CarryInBadge …/>` 바로 다음에:

```jsx
                <CeilingBadge heightCm={it.confirmed_height_cm} settings={settings} />
```

`web/src/pages/ItemDetailPage.jsx`: import 추가 `import { CeilingBadge } from '../CeilingBadge.jsx';` 후 확정 후보 chip-row를 다음으로 교체:

```jsx
              {isConfirmed && (
                <div className="chip-row">
                  <CarryInBadge dims={c} settings={settings} showReason />
                  <CeilingBadge heightCm={c.height_cm} settings={settings} />
                </div>
              )}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run web/src/CeilingBadge.test.jsx web/src/pages/HomePage.test.jsx web/src/pages/ItemDetailPage.test.jsx`
Expected: 전부 PASS.

- [ ] **Step 5: 전체 테스트**

Run: `npm test`
Expected: 전체 스위트 PASS. 실패가 있으면 원인을 고치고 나서 커밋.

- [ ] **Step 6: Commit**

```bash
git add web/src/CeilingBadge.jsx web/src/CeilingBadge.test.jsx web/src/pages/HomePage.jsx web/src/pages/HomePage.test.jsx web/src/pages/ItemDetailPage.jsx
git commit -m "feat: 천장 초과 경고 칩 (홈·품목 상세)"
```
