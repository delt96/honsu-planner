// Display metadata/string helpers for room features (door/window/outlet). Framework-agnostic.

export const WALLS = ['N', 'E', 'S', 'W'];
export const WALL_LABEL = { N: '북쪽', E: '동쪽', S: '남쪽', W: '서쪽' };

export const SWINGS = ['in-left', 'in-right', 'out-left', 'out-right'];
export const SWING_LABEL = { 'in-left': '안·좌', 'in-right': '안·우', 'out-left': '밖·좌', 'out-right': '밖·우' };

export const FEATURE_META = {
  door: { label: '문', icon: '🚪' },
  window: { label: '창문', icon: '⊞' },
  outlet: { label: '콘센트', icon: '⚡' },
};

// Default dimensions when stamping a new feature on the plan (typical KR sizes).
export const FEATURE_DEFAULTS = {
  door: { width_cm: 80, height_cm: 204, swing: 'in-left' },
  window: { width_cm: 150, height_cm: 120, sill_height_cm: 90 },
  outlet: { floor_height_cm: 30 },
};

// One-line panel summary: "남쪽 · 모서리 30cm · 폭80 · 높이204 · 안·좌"
export function featureSummary(f) {
  const parts = [WALL_LABEL[f.wall], `모서리 ${f.offset_cm}cm`];
  if (f.width_cm != null) parts.push(`폭${f.width_cm}`);
  if (f.height_cm != null) parts.push(`높이${f.height_cm}`);
  if (f.kind === 'door' && f.swing) parts.push(SWING_LABEL[f.swing]);
  if (f.kind === 'window' && f.sill_height_cm != null) parts.push(`턱${f.sill_height_cm}`);
  if (f.kind === 'outlet' && f.floor_height_cm != null) parts.push(`바닥 ${f.floor_height_cm}cm`);
  return parts.join(' · ');
}
