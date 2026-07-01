import { test, expect } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers/testApp.js';

test('POST /api/items creates an item', async () => {
  const { app } = createTestApp();
  const res = await request(app).post('/api/items').send({ name: '  냉장고  ' });
  expect(res.status).toBe(201);
  expect(res.body).toMatchObject({ name: '냉장고', confirmed_candidate_id: null });
  expect(res.body.id).toBeGreaterThan(0);
});

test('POST /api/items rejects empty name', async () => {
  const { app } = createTestApp();
  const res = await request(app).post('/api/items').send({ name: '   ' });
  expect(res.status).toBe(400);
  expect(res.body.error).toBeTruthy();
});

test('GET /api/items lists items with confirmed info', async () => {
  const { app } = createTestApp();
  await request(app).post('/api/items').send({ name: '냉장고' });
  await request(app).post('/api/items').send({ name: '세탁기' });
  const res = await request(app).get('/api/items');
  expect(res.status).toBe(200);
  expect(res.body).toHaveLength(2);
  expect(res.body[0]).toHaveProperty('confirmed_price', null);
});

test('GET /api/items/:id returns 404 when missing', async () => {
  const { app } = createTestApp();
  const res = await request(app).get('/api/items/999');
  expect(res.status).toBe(404);
});

test('PATCH /api/items/:id updates name', async () => {
  const { app } = createTestApp();
  const created = await request(app).post('/api/items').send({ name: '냉장고' });
  const res = await request(app).patch(`/api/items/${created.body.id}`).send({ name: '김치냉장고' });
  expect(res.status).toBe(200);
  expect(res.body.name).toBe('김치냉장고');
});

test('DELETE /api/items/:id removes it', async () => {
  const { app } = createTestApp();
  const created = await request(app).post('/api/items').send({ name: '냉장고' });
  const del = await request(app).delete(`/api/items/${created.body.id}`);
  expect(del.status).toBe(204);
  const res = await request(app).get(`/api/items/${created.body.id}`);
  expect(res.status).toBe(404);
});

test('GET /api/items/abc returns 404 for non-numeric id', async () => {
  const { app } = createTestApp();
  const res = await request(app).get('/api/items/abc');
  expect(res.status).toBe(404);
});

test('DELETE /api/items/abc returns 404 for non-numeric id', async () => {
  const { app } = createTestApp();
  const res = await request(app).delete('/api/items/abc');
  expect(res.status).toBe(404);
});
