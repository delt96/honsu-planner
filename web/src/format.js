export function won(n) {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString('ko-KR') + '원';
}

// Strip everything but digits — the raw value we store/submit for a number field.
export function digitsOnly(v) {
  return String(v ?? '').replace(/\D/g, '');
}

// Format a digit string with thousands separators for display in an input.
export function commas(v) {
  const d = digitsOnly(v);
  return d ? Number(d).toLocaleString('ko-KR') : '';
}
