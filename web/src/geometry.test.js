import { test, expect } from 'vitest';
import { cmToPx, pxToCm, snapCm, rotatedFootprint, nextRotation, PX_PER_CM, wallSegment, doorArcPath } from './geometry.js';

test('cmToPx / pxToCm are inverse', () => {
  expect(cmToPx(100)).toBe(100 * PX_PER_CM);
  expect(pxToCm(cmToPx(250))).toBeCloseTo(250);
});

test('snapCm snaps to 10cm grid', () => {
  expect(snapCm(13)).toBe(10);
  expect(snapCm(16)).toBe(20);
  expect(snapCm(-14)).toBe(-10);
});

test('rotatedFootprint swaps w/h for 90 and 270', () => {
  expect(rotatedFootprint(90, 60, 0)).toEqual({ w: 90, h: 60 });
  expect(rotatedFootprint(90, 60, 90)).toEqual({ w: 60, h: 90 });
  expect(rotatedFootprint(90, 60, 180)).toEqual({ w: 90, h: 60 });
  expect(rotatedFootprint(90, 60, 270)).toEqual({ w: 60, h: 90 });
});

test('nextRotation cycles through 90-degree steps', () => {
  expect(nextRotation(0)).toBe(90);
  expect(nextRotation(270)).toBe(0);
  expect(nextRotation(undefined)).toBe(90);
});

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
  // hinge (100,300), free (180,300), inward (-y) -> end (100,220); px = cm * 0.6
  expect(doorArcPath(room, f)).toBe('M 108 180 A 48 48 0 0 0 60 132 L 60 180');
});

test('doorArcPath: out-right flips both hinge and direction', () => {
  const room = { x: 0, y: 0, width_cm: 400, depth_cm: 300 };
  const f = { kind: 'door', wall: 'S', offset_cm: 100, width_cm: 80, swing: 'out-right' };
  // hinge (180,300), free (100,300), outward (+y) -> end (180,380)
  expect(doorArcPath(room, f)).toBe('M 60 180 A 48 48 0 0 0 108 228 L 108 180');
});
