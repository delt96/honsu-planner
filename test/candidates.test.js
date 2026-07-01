import { test, expect } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers/testApp.js';

async function makeItem(app, name = '냉장고') {
  const res = await request(app).post('/api/items').send({ name });
  return res.body.id;
}

test('POST candidate with full fields', async () => {
  const { app } = createTestApp();
  const id = await makeItem(app);
  const res = await request(app).post(`/api/items/${id}/candidates`).send({
    name: 'LG 냉장고', price: 1200000, url: 'http://x', memo: '4도어',
    width_cm: 91.2, depth_cm: 70, height_cm: 179,
  });
  expect(res.status).toBe(201);
  expect(res.body).toMatchObject({ name: 'LG 냉장고', price: 1200000, width_cm: 91.2 });
});

test('POST candidate allows optional fields to be omitted', async () => {
  const { app } = createTestApp();
  const id = await makeItem(app);
  const res = await request(app).post(`/api/items/${id}/candidates`).send({ name: '이름만' });
  expect(res.status).toBe(201);
  expect(res.body).toMatchObject({ name: '이름만', price: null, width_cm: null });
});

test('POST candidate rejects negative price', async () => {
  const { app } = createTestApp();
  const id = await makeItem(app);
  const res = await request(app).post(`/api/items/${id}/candidates`).send({ name: 'x', price: -5 });
  expect(res.status).toBe(400);
});

test('POST candidate rejects missing name', async () => {
  const { app } = createTestApp();
  const id = await makeItem(app);
  const res = await request(app).post(`/api/items/${id}/candidates`).send({ price: 100 });
  expect(res.status).toBe(400);
});

test('PATCH candidate updates price', async () => {
  const { app } = createTestApp();
  const id = await makeItem(app);
  const c = await request(app).post(`/api/items/${id}/candidates`).send({ name: 'x', price: 100 });
  const res = await request(app).patch(`/api/candidates/${c.body.id}`).send({ price: 200 });
  expect(res.status).toBe(200);
  expect(res.body.price).toBe(200);
});

test('DELETE candidate removes it', async () => {
  const { app } = createTestApp();
  const id = await makeItem(app);
  const c = await request(app).post(`/api/items/${id}/candidates`).send({ name: 'x' });
  const del = await request(app).delete(`/api/candidates/${c.body.id}`);
  expect(del.status).toBe(204);
  const item = await request(app).get(`/api/items/${id}`);
  expect(item.body.candidates).toHaveLength(0);
});

test('POST /api/items/abc/candidates returns 404 for non-numeric id', async () => {
  const { app } = createTestApp();
  const res = await request(app).post('/api/items/abc/candidates').send({ name: 'x' });
  expect(res.status).toBe(404);
});

test('DELETE /api/candidates/abc returns 404 for non-numeric id', async () => {
  const { app } = createTestApp();
  const res = await request(app).delete('/api/candidates/abc');
  expect(res.status).toBe(404);
});
