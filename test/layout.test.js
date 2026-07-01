import { test, expect } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers/testApp.js';

async function confirmItem(app, name, dims, category) {
  const item = await request(app).post('/api/items').send({ name, category });
  const cand = await request(app).post(`/api/items/${item.body.id}/candidates`).send({ name: 'c', price: 100, ...dims });
  await request(app).put(`/api/items/${item.body.id}/confirm`).send({ candidate_id: cand.body.id });
  return item.body.id;
}

test('empty layout', async () => {
  const { app } = createTestApp();
  const res = await request(app).get('/api/layout');
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ rooms: [], placements: [], palette: [], unplaceable: [] });
});

test('categorizes rooms, palette, placements, unplaceable', async () => {
  const { app } = createTestApp();
  await request(app).post('/api/rooms').send({ name: '거실', width_cm: 400, depth_cm: 500 });

  const placedId = await confirmItem(app, '소파', { width_cm: 200, depth_cm: 90 }, 'furniture');
  await request(app).put(`/api/items/${placedId}/placement`).send({ x: 10, y: 20, rotation: 90 });

  await confirmItem(app, '식탁', { width_cm: 120, depth_cm: 80 }, 'furniture'); // palette (dims, not placed)
  await confirmItem(app, '스탠드', {}); // unplaceable (no dims, no category)
  await request(app).post('/api/items').send({ name: '미확정' }); // not confirmed → nowhere

  const res = await request(app).get('/api/layout');
  expect(res.body.rooms).toHaveLength(1);
  expect(res.body.placements).toEqual([
    { item_id: placedId, name: '소파', category: 'furniture', x: 10, y: 20, rotation: 90, width_cm: 200, depth_cm: 90 },
  ]);
  expect(res.body.palette).toEqual([
    { item_id: expect.any(Number), name: '식탁', category: 'furniture', width_cm: 120, depth_cm: 80 },
  ]);
  expect(res.body.unplaceable).toEqual([
    { item_id: expect.any(Number), name: '스탠드', category: null },
  ]);
});
