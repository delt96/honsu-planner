const BASE = '/api';

async function req(path, options) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let msg = 'Request failed';
    try { const b = await res.json(); if (b?.error) msg = b.error; } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  getSummary: () => req('/summary'),
  listItems: () => req('/items'),
  getItem: (id) => req(`/items/${id}`),
  createItem: (name, category) =>
    req('/items', { method: 'POST', body: JSON.stringify({ name, category }) }),
  updateItem: (id, data) => req(`/items/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteItem: (id) => req(`/items/${id}`, { method: 'DELETE' }),
  addCandidate: (itemId, data) =>
    req(`/items/${itemId}/candidates`, { method: 'POST', body: JSON.stringify(data) }),
  updateCandidate: (id, data) =>
    req(`/candidates/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCandidate: (id) => req(`/candidates/${id}`, { method: 'DELETE' }),
  confirm: (itemId, candidateId) =>
    req(`/items/${itemId}/confirm`, { method: 'PUT', body: JSON.stringify({ candidate_id: candidateId }) }),
  unconfirm: (itemId) => req(`/items/${itemId}/confirm`, { method: 'DELETE' }),
  getLayout: () => req('/layout'),
  createRoom: (data) => req('/rooms', { method: 'POST', body: JSON.stringify(data) }),
  updateRoom: (id, data) => req(`/rooms/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteRoom: (id) => req(`/rooms/${id}`, { method: 'DELETE' }),
  placeItem: (itemId, data) => req(`/items/${itemId}/placement`, { method: 'PUT', body: JSON.stringify(data) }),
  unplaceItem: (itemId) => req(`/items/${itemId}/placement`, { method: 'DELETE' }),
  getHomeSettings: () => req('/home-settings'),
  saveHomeSettings: (data) => req('/home-settings', { method: 'PUT', body: JSON.stringify(data) }),
  createFeature: (roomId, data) => req(`/rooms/${roomId}/features`, { method: 'POST', body: JSON.stringify(data) }),
  updateFeature: (id, data) => req(`/features/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteFeature: (id) => req(`/features/${id}`, { method: 'DELETE' }),
};
