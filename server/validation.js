export function parseId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function validateItemName(name) {
  if (typeof name !== 'string' || name.trim() === '') return 'Name is required';
  if (name.trim().length > 100) return 'Name is too long';
  return null;
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

  for (const key of ['url', 'memo']) {
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
