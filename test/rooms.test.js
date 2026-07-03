import { test, expect } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers/testApp.js';

test('POST /api/rooms creates a room', async () => {
  const { app } = createTestApp();
  const res = await request(app).post('/api/rooms').send({ name: '거실', width_cm: 400, depth_cm: 500 });
  expect(res.status).toBe(201);
  expect(res.body).toMatchObject({ name: '거실', width_cm: 400, depth_cm: 500, x: 0, y: 0 });
});

test('POST /api/rooms rejects missing/invalid dimensions', async () => {
  const { app } = createTestApp();
  const noDim = await request(app).post('/api/rooms').send({ name: '거실' });
  expect(noDim.status).toBe(400);
  const zero = await request(app).post('/api/rooms').send({ name: '거실', width_cm: 0, depth_cm: 100 });
  expect(zero.status).toBe(400);
});

test('POST /api/rooms rejects empty name', async () => {
  const { app } = createTestApp();
  const res = await request(app).post('/api/rooms').send({ width_cm: 100, depth_cm: 100 });
  expect(res.status).toBe(400);
});

test('GET /api/rooms lists rooms', async () => {
  const { app } = createTestApp();
  await request(app).post('/api/rooms').send({ name: '거실', width_cm: 400, depth_cm: 500 });
  await request(app).post('/api/rooms').send({ name: '침실', width_cm: 300, depth_cm: 400 });
  const res = await request(app).get('/api/rooms');
  expect(res.status).toBe(200);
  expect(res.body).toHaveLength(2);
});

test('PATCH /api/rooms/:id updates position', async () => {
  const { app } = createTestApp();
  const c = await request(app).post('/api/rooms').send({ name: '거실', width_cm: 400, depth_cm: 500 });
  const res = await request(app).patch(`/api/rooms/${c.body.id}`).send({ x: 120, y: 60 });
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ x: 120, y: 60 });
});

test('DELETE /api/rooms/:id removes it', async () => {
  const { app } = createTestApp();
  const c = await request(app).post('/api/rooms').send({ name: '거실', width_cm: 400, depth_cm: 500 });
  const del = await request(app).delete(`/api/rooms/${c.body.id}`);
  expect(del.status).toBe(204);
  const list = await request(app).get('/api/rooms');
  expect(list.body).toHaveLength(0);
});

test('non-numeric room id → 404', async () => {
  const { app } = createTestApp();
  const res = await request(app).delete('/api/rooms/abc');
  expect(res.status).toBe(404);
});

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
