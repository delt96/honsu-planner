import { test, expect } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers/testApp.js';

async function setup(app) {
  const item = await request(app).post('/api/items').send({ name: '냉장고' });
  const cand = await request(app).post(`/api/items/${item.body.id}/candidates`)
    .send({ name: 'LG', price: 1200000 });
  return { itemId: item.body.id, candId: cand.body.id };
}

test('PUT confirm sets confirmed candidate', async () => {
  const { app } = createTestApp();
  const { itemId, candId } = await setup(app);
  const res = await request(app).put(`/api/items/${itemId}/confirm`).send({ candidate_id: candId });
  expect(res.status).toBe(200);
  expect(res.body.confirmed_candidate_id).toBe(candId);

  const list = await request(app).get('/api/items');
  expect(list.body[0].confirmed_price).toBe(1200000);
});

test('DELETE confirm clears it', async () => {
  const { app } = createTestApp();
  const { itemId, candId } = await setup(app);
  await request(app).put(`/api/items/${itemId}/confirm`).send({ candidate_id: candId });
  const res = await request(app).delete(`/api/items/${itemId}/confirm`);
  expect(res.status).toBe(200);
  expect(res.body.confirmed_candidate_id).toBeNull();
});

test('PUT confirm rejects candidate from another item', async () => {
  const { app } = createTestApp();
  const { candId } = await setup(app);
  const other = await request(app).post('/api/items').send({ name: '세탁기' });
  const res = await request(app).put(`/api/items/${other.body.id}/confirm`).send({ candidate_id: candId });
  expect(res.status).toBe(400);
});

test('PUT confirm 404 when item missing', async () => {
  const { app } = createTestApp();
  const res = await request(app).put('/api/items/999/confirm').send({ candidate_id: 1 });
  expect(res.status).toBe(404);
});

test('deleting confirmed candidate clears confirmation', async () => {
  const { app } = createTestApp();
  const { itemId, candId } = await setup(app);
  await request(app).put(`/api/items/${itemId}/confirm`).send({ candidate_id: candId });
  await request(app).delete(`/api/candidates/${candId}`);
  const item = await request(app).get(`/api/items/${itemId}`);
  expect(item.body.confirmed_candidate_id).toBeNull();
});
