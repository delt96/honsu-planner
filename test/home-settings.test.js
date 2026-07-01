import { test, expect } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers/testApp.js';

test('GET returns the seeded row with all dimensions null', async () => {
  const { app } = createTestApp();
  const res = await request(app).get('/api/home-settings');
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({
    id: 1,
    door_width_cm: null,
    door_height_cm: null,
    elevator_door_width_cm: null,
    elevator_door_height_cm: null,
    elevator_car_width_cm: null,
    elevator_car_depth_cm: null,
    elevator_car_height_cm: null,
  });
});

test('PUT updates dimensions and persists them', async () => {
  const { app } = createTestApp();
  const res = await request(app).put('/api/home-settings').send({
    door_width_cm: 90,
    door_height_cm: 210,
    elevator_car_width_cm: 130,
  });
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ id: 1, door_width_cm: 90, door_height_cm: 210, elevator_car_width_cm: 130 });

  const again = await request(app).get('/api/home-settings');
  expect(again.body).toMatchObject({ door_width_cm: 90, door_height_cm: 210, elevator_car_width_cm: 130 });
});

test('PUT clears a value when given empty string', async () => {
  const { app } = createTestApp();
  await request(app).put('/api/home-settings').send({ door_width_cm: 90 });
  const res = await request(app).put('/api/home-settings').send({ door_width_cm: '' });
  expect(res.status).toBe(200);
  expect(res.body.door_width_cm).toBeNull();
});

test('PUT rejects a non-positive dimension', async () => {
  const { app } = createTestApp();
  const res = await request(app).put('/api/home-settings').send({ door_width_cm: -5 });
  expect(res.status).toBe(400);
  expect(res.body.error).toMatch(/door_width_cm/);
});
