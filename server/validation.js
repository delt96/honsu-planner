export function parseId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function validateItemName(name) {
  if (typeof name !== 'string' || name.trim() === '') return 'Name is required';
  if (name.trim().length > 100) return 'Name is too long';
  return null;
}

export const ITEM_CATEGORIES = ['appliance', 'furniture'];

// Returns the normalized category (string | null) or an Error message string.
// Accepts undefined/null/'' as null (uncategorized); otherwise must be a known category.
export function normalizeCategory(value) {
  if (value === undefined || value === null || value === '') return { value: null };
  if (typeof value !== 'string' || !ITEM_CATEGORIES.includes(value)) {
    return { error: `category must be one of ${ITEM_CATEGORIES.join(', ')}` };
  }
  return { value };
}

export function normalizeCandidate(body, { partial = false } = {}) {
  const out = {};
  const errors = [];

  if (!partial || body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim() === '') {
      errors.push('Name is required');
    } else {
      out.name = body.name.trim();
    }
  }

  if (body.price !== undefined) {
    if (body.price === null || body.price === '') {
      out.price = null;
    } else {
      const n = Number(body.price);
      if (!Number.isInteger(n) || n < 0) errors.push('Price must be a non-negative integer');
      else out.price = n;
    }
  }

  for (const key of ['brand', 'url', 'memo']) {
    if (body[key] !== undefined) out[key] = body[key] === '' ? null : String(body[key]);
  }

  for (const [key, label] of [['width_cm', 'Width'], ['depth_cm', 'Depth'], ['height_cm', 'Height']]) {
    if (body[key] !== undefined) {
      if (body[key] === null || body[key] === '') {
        out[key] = null;
      } else {
        const n = Number(body[key]);
        if (!(n > 0)) errors.push(`${label} must be a positive number`);
        else out[key] = n;
      }
    }
  }

  return { errors, value: out };
}

export function normalizeRoomInput(body, { partial = false } = {}) {
  const out = {};
  const errors = [];

  if (!partial || body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim() === '') errors.push('Name is required');
    else out.name = body.name.trim();
  }

  for (const [key, label] of [['width_cm', 'Width'], ['depth_cm', 'Depth']]) {
    if (!partial || body[key] !== undefined) {
      const n = Number(body[key]);
      if (!(n > 0)) errors.push(`${label} must be a positive number`);
      else out[key] = n;
    }
  }

  for (const key of ['x', 'y']) {
    if (body[key] !== undefined) {
      const n = Number(body[key]);
      if (!Number.isFinite(n)) errors.push(`${key} must be a number`);
      else out[key] = n;
    }
  }

  if (body.sort_order !== undefined) {
    const n = Number(body.sort_order);
    if (Number.isFinite(n)) out.sort_order = n;
    else errors.push('sort_order must be a number');
  }

  return { errors, value: out };
}

const HOME_SETTING_FIELDS = [
  'door_width_cm',
  'door_height_cm',
  'elevator_door_width_cm',
  'elevator_door_height_cm',
  'elevator_car_width_cm',
  'elevator_car_depth_cm',
  'elevator_car_height_cm',
];

export function normalizeHomeSettings(body) {
  const out = {};
  const errors = [];
  for (const key of HOME_SETTING_FIELDS) {
    if (body[key] !== undefined) {
      if (body[key] === null || body[key] === '') {
        out[key] = null;
      } else {
        const n = Number(body[key]);
        if (!(n > 0)) errors.push(`${key} must be a positive number`);
        else out[key] = n;
      }
    }
  }
  return { errors, value: out };
}

export function normalizePlacementInput(body) {
  const out = {};
  const errors = [];
  for (const key of ['x', 'y']) {
    const n = Number(body[key]);
    if (!Number.isFinite(n)) errors.push(`${key} must be a number`);
    else out[key] = n;
  }
  const rot = body.rotation === undefined ? 0 : Number(body.rotation);
  if (![0, 90, 180, 270].includes(rot)) errors.push('rotation must be 0, 90, 180, or 270');
  else out.rotation = rot;
  return { errors, value: out };
}
