import { useEffect, useState } from 'react';
import { api } from './api.js';
import { FEATURE_META } from './features.js';

const wallLenOf = (room, wall) => (wall === 'N' || wall === 'S' ? Number(room.width_cm) : Number(room.depth_cm));
const blurOnEnter = (e) => { if (e.key === 'Enter') e.target.blur(); };
const initForm = (f, wallLen, width) => ({
  left: String(Number(f.offset_cm)),
  right: String(wallLen - Number(f.offset_cm) - width),
  width_cm: f.width_cm ?? '',
  height_cm: f.height_cm ?? '',
  sill_height_cm: f.sill_height_cm ?? '',
  floor_height_cm: f.floor_height_cm ?? '',
});

// Floating property card for the selected wall feature. Numeric fields save on
// blur/Enter; swing toggles save immediately. Position can be entered from
// either wall corner (the other side is derived).
export function FeaturePropertyCard({ feature: f, room, anchor, onSaved, onClose }) {
  const wallLen = wallLenOf(room, f.wall);
  const width = Number(f.width_cm ?? 0);
  const [form, setForm] = useState(() => initForm(f, wallLen, width));
  const [error, setError] = useState(null);
  useEffect(() => { setForm(initForm(f, wallLen, width)); setError(null); }, [f]);

  async function save(patch) {
    try { setError(null); await api.updateFeature(f.id, patch); await onSaved(); }
    catch (e) { setError(e.message); setForm(initForm(f, wallLen, width)); }
  }
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const saveField = (k) => () => { if (String(f[k] ?? '') !== String(form[k])) save({ [k]: form[k] }); };
  function saveLeft() {
    const n = Number(form.left);
    if (Number.isFinite(n) && n !== Number(f.offset_cm)) save({ offset_cm: n });
  }
  function saveRight() {
    const n = Number(form.right);
    if (!Number.isFinite(n)) return;
    const off = wallLen - width - n;
    if (off !== Number(f.offset_cm)) save({ offset_cm: off });
  }
  async function remove() {
    try { await api.deleteFeature(f.id); await onSaved(); onClose(); }
    catch (e) { setError(e.message); }
  }
  const [dir, side] = (f.swing ?? 'in-left').split('-');

  return (
    <div className="feat-card" style={{ left: anchor.x, top: anchor.y }} data-testid={`feat-card-${f.id}`}>
      <div className="feat-card-head">
        <span>{FEATURE_META[f.kind].icon} {FEATURE_META[f.kind].label}</span>
        <button type="button" className="danger" onClick={remove}>삭제</button>
        <button type="button" aria-label="닫기" onClick={onClose}>✕</button>
      </div>
      {error && <p className="error">{error}</p>}
      <label>왼쪽 모서리에서(cm)
        <input aria-label="왼쪽 모서리에서" value={form.left} onChange={set('left')} onBlur={saveLeft} onKeyDown={blurOnEnter} />
      </label>
      <label>오른쪽 모서리에서(cm)
        <input aria-label="오른쪽 모서리에서" value={form.right} onChange={set('right')} onBlur={saveRight} onKeyDown={blurOnEnter} />
      </label>
      {f.kind !== 'outlet' && (
        <label>폭(cm)
          <input aria-label="폭" value={form.width_cm} onChange={set('width_cm')} onBlur={saveField('width_cm')} onKeyDown={blurOnEnter} />
        </label>
      )}
      {f.kind === 'door' && (
        <label>통과 높이(cm)
          <input aria-label="통과 높이" value={form.height_cm} onChange={set('height_cm')} onBlur={saveField('height_cm')} onKeyDown={blurOnEnter} />
        </label>
      )}
      {f.kind === 'door' && (
        <div className="swing-toggle" role="group" aria-label="열림 방향">
          <button type="button" aria-pressed={dir === 'in'} onClick={() => save({ swing: `in-${side}` })}>안</button>
          <button type="button" aria-pressed={dir === 'out'} onClick={() => save({ swing: `out-${side}` })}>밖</button>
          <button type="button" aria-pressed={side === 'left'} onClick={() => save({ swing: `${dir}-left` })}>좌</button>
          <button type="button" aria-pressed={side === 'right'} onClick={() => save({ swing: `${dir}-right` })}>우</button>
        </div>
      )}
      {f.kind === 'window' && (
        <label>창 높이(cm)
          <input aria-label="창 높이" value={form.height_cm} onChange={set('height_cm')} onBlur={saveField('height_cm')} onKeyDown={blurOnEnter} />
        </label>
      )}
      {f.kind === 'window' && (
        <label>턱 높이(cm)
          <input aria-label="창턱" value={form.sill_height_cm} onChange={set('sill_height_cm')} onBlur={saveField('sill_height_cm')} onKeyDown={blurOnEnter} />
        </label>
      )}
      {f.kind === 'outlet' && (
        <label>바닥에서(cm)
          <input aria-label="바닥에서" value={form.floor_height_cm} onChange={set('floor_height_cm')} onBlur={saveField('floor_height_cm')} onKeyDown={blurOnEnter} />
        </label>
      )}
    </div>
  );
}
