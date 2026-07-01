import { vi, beforeEach, test, expect } from 'vitest';
import { api } from './api.js';

beforeEach(() => { global.fetch = vi.fn(); });

test('createItem posts to /api/items', async () => {
  global.fetch.mockResolvedValue({ ok: true, status: 201, json: async () => ({ id: 1, name: '냉장고' }) });
  const r = await api.createItem('냉장고');
  expect(global.fetch).toHaveBeenCalledWith(
    '/api/items',
    expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: '냉장고' }) })
  );
  expect(r).toEqual({ id: 1, name: '냉장고' });
});

test('req throws with server error message', async () => {
  global.fetch.mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: 'Name is required' }) });
  await expect(api.createItem('')).rejects.toThrow('Name is required');
});

test('deleteItem returns null on 204', async () => {
  global.fetch.mockResolvedValue({ ok: true, status: 204 });
  await expect(api.deleteItem(1)).resolves.toBeNull();
});

test('getLayout GETs /api/layout', async () => {
  global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ rooms: [], placements: [], palette: [], unplaceable: [] }) });
  const r = await api.getLayout();
  expect(global.fetch).toHaveBeenCalledWith('/api/layout', expect.objectContaining({}));
  expect(r).toEqual({ rooms: [], placements: [], palette: [], unplaceable: [] });
});

test('placeItem PUTs the placement body', async () => {
  global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ item_id: 1, x: 10, y: 10, rotation: 0 }) });
  await api.placeItem(1, { x: 10, y: 10, rotation: 0 });
  expect(global.fetch).toHaveBeenCalledWith('/api/items/1/placement', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ x: 10, y: 10, rotation: 0 }) }));
});

test('createRoom POSTs to /api/rooms', async () => {
  global.fetch.mockResolvedValue({ ok: true, status: 201, json: async () => ({ id: 1, name: '거실' }) });
  await api.createRoom({ name: '거실', width_cm: 400, depth_cm: 500 });
  expect(global.fetch).toHaveBeenCalledWith('/api/rooms', expect.objectContaining({ method: 'POST' }));
});

test('getHomeSettings GETs /api/home-settings', async () => {
  global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 1, door_width_cm: null }) });
  const r = await api.getHomeSettings();
  expect(global.fetch).toHaveBeenCalledWith('/api/home-settings', expect.objectContaining({}));
  expect(r).toEqual({ id: 1, door_width_cm: null });
});

test('saveHomeSettings PUTs the settings body', async () => {
  global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 1, door_width_cm: 90 }) });
  await api.saveHomeSettings({ door_width_cm: 90 });
  expect(global.fetch).toHaveBeenCalledWith(
    '/api/home-settings',
    expect.objectContaining({ method: 'PUT', body: JSON.stringify({ door_width_cm: 90 }) })
  );
});
