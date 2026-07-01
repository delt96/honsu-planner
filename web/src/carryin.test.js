import { test, expect } from 'vitest';
import { evaluateCarryIn } from './carryin.js';

const FULL = {
  door_width_cm: 90, door_height_cm: 210,
  elevator_door_width_cm: 80, elevator_door_height_cm: 200,
  elevator_car_width_cm: 130, elevator_car_depth_cm: 150, elevator_car_height_cm: 220,
};

test('unknown when a furniture dimension is missing', () => {
  const r = evaluateCarryIn({ width_cm: 100, depth_cm: null, height_cm: 50 }, FULL);
  expect(r.status).toBe('unknown');
  expect(r.reason).toMatch(/가구 치수/);
});

test('unknown when no home settings are entered', () => {
  const r = evaluateCarryIn({ width_cm: 100, depth_cm: 60, height_cm: 50 }, {});
  expect(r.status).toBe('unknown');
  expect(r.reason).toMatch(/우리집/);
});

test('ok when the item fits everything comfortably', () => {
  expect(evaluateCarryIn({ width_cm: 60, depth_cm: 60, height_cm: 100 }, FULL).status).toBe('ok');
});

test('a long item is carried lengthwise — only its two smallest sides must fit the door', () => {
  // 200cm-long sofa, cross-section 85×60 fits a 90×210 door
  const r = evaluateCarryIn(
    { width_cm: 200, depth_cm: 85, height_cm: 60 },
    { door_width_cm: 90, door_height_cm: 210 }
  );
  expect(r.status).toBe('ok');
});

test('fail when the cross-section is too big for the door', () => {
  const r = evaluateCarryIn({ width_cm: 100, depth_cm: 120, height_cm: 250 }, FULL);
  expect(r.status).toBe('fail');
  expect(r.reason).toContain('현관문');
});

test('tight when it fits with less than the clearance margin', () => {
  // cross-section 88×88 through a 90×210 door → 2cm margin (< 3cm)
  const r = evaluateCarryIn(
    { width_cm: 88, depth_cm: 88, height_cm: 300 },
    { door_width_cm: 90, door_height_cm: 210 }
  );
  expect(r.status).toBe('tight');
});

test('fail when the item does not fit inside the elevator car', () => {
  // item sorted [100,160,210] vs car sorted [130,150,220] → 160 > 150
  const r = evaluateCarryIn(
    { width_cm: 210, depth_cm: 160, height_cm: 100 },
    { elevator_car_width_cm: 130, elevator_car_depth_cm: 150, elevator_car_height_cm: 220 }
  );
  expect(r.status).toBe('fail');
  expect(r.reason).toContain('엘리베이터 내부');
});
