// 반입(carry-in) feasibility: compare a piece of furniture against our home's
// carry-in constraints (front door, elevator door, elevator car interior).
// Pure and framework-free so it can be unit-tested and reused across pages.

export const CLEARANCE_CM = 3; // fits, but with less room than this → "빠듯" (tight)

const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

const STATUS_LABEL = {
  ok: '반입 가능',
  tight: '빠듯',
  fail: '반입 불가',
  unknown: '판정 불가',
};

// A rigid box carried through a doorway lengthwise presents its two smallest
// dimensions as the cross-section. Returns [d1, d2, d3] ascending, or null if any
// of the three dimensions is missing/non-positive.
function sortedDims(dims) {
  const arr = [num(dims?.width_cm), num(dims?.depth_cm), num(dims?.height_cm)];
  if (arr.some((v) => v === null || !(v > 0))) return null;
  return arr.sort((a, b) => a - b);
}

// Does a cross-section [a, b] pass an opening (openW × openH)? Try both orientations.
function throughOpening([a, b], openW, openH) {
  const margins = [];
  if (a <= openW && b <= openH) margins.push(Math.min(openW - a, openH - b));
  if (b <= openW && a <= openH) margins.push(Math.min(openW - b, openH - a));
  if (margins.length === 0) return { pass: false };
  return { pass: true, tight: Math.max(...margins) < CLEARANCE_CM };
}

// Does the item fit inside the elevator car box (axis-aligned)? Diagonal/standing
// tricks are intentionally not modeled — a conservative check errs toward warning.
function insideCar(sorted, box) {
  const b = [...box].sort((x, y) => x - y);
  if (!(sorted[0] <= b[0] && sorted[1] <= b[1] && sorted[2] <= b[2])) return { pass: false };
  const margin = Math.min(b[0] - sorted[0], b[1] - sorted[1], b[2] - sorted[2]);
  return { pass: true, tight: margin < CLEARANCE_CM };
}

// dims: { width_cm, depth_cm, height_cm } — any may be null.
// settings: home_settings row — any dimension may be null.
// Returns { status, label, reason, checks:[{ name, pass, tight }] }.
export function evaluateCarryIn(dims, settings) {
  const s = settings ?? {};
  const sorted = sortedDims(dims);
  if (!sorted) {
    return { status: 'unknown', label: STATUS_LABEL.unknown, reason: '가구 치수 미입력', checks: [] };
  }
  const cross = [sorted[0], sorted[1]];
  const checks = [];

  const dw = num(s.door_width_cm);
  const dh = num(s.door_height_cm);
  if (dw && dh) checks.push({ name: '현관문', ...throughOpening(cross, dw, dh) });

  const edw = num(s.elevator_door_width_cm);
  const edh = num(s.elevator_door_height_cm);
  if (edw && edh) checks.push({ name: '엘리베이터 문', ...throughOpening(cross, edw, edh) });

  const cw = num(s.elevator_car_width_cm);
  const cd = num(s.elevator_car_depth_cm);
  const ch = num(s.elevator_car_height_cm);
  if (cw && cd && ch) checks.push({ name: '엘리베이터 내부', ...insideCar(sorted, [cw, cd, ch]) });

  if (checks.length === 0) {
    return { status: 'unknown', label: STATUS_LABEL.unknown, reason: '우리집 반입 정보 미입력', checks: [] };
  }

  const failed = checks.filter((c) => !c.pass);
  const tight = checks.filter((c) => c.pass && c.tight);
  let status = 'ok';
  if (failed.length) status = 'fail';
  else if (tight.length) status = 'tight';

  const reason =
    status === 'fail' ? failed.map((c) => `${c.name} 통과 불가`).join(', ')
    : status === 'tight' ? tight.map((c) => `${c.name} 빠듯`).join(', ')
    : '';

  return { status, label: STATUS_LABEL[status], reason, checks };
}
