import { test, expect } from 'vitest';
import { featureSummary } from './features.js';

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
