import { useState } from 'react';
import { api } from './api.js';
import { FEATURE_META, WALLS, WALL_LABEL, SWINGS, SWING_LABEL, featureSummary } from './features.js';

const EMPTY = { wall: 'N', offset_cm: '', width_cm: '', height_cm: '', sill_height_cm: '', floor_height_cm: '', swing: '' };

const editValues = (f) => ({
  wall: f.wall,
  offset_cm: f.offset_cm ?? '',
  width_cm: f.width_cm ?? '',
  height_cm: f.height_cm ?? '',
  sill_height_cm: f.sill_height_cm ?? '',
  floor_height_cm: f.floor_height_cm ?? '',
  swing: f.swing ?? '',
});

// Panel room card: per-room ceiling height + wall feature (door/window/outlet) list with ＋ add/edit form.
export function RoomCard({ room, onChanged, onDelete, selectedId = null, onSelect = () => {} }) {
  const features = room.features ?? [];
  const [adding, setAdding] = useState(null); // null | 'door' | 'window' | 'outlet'
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [ceiling, setCeiling] = useState(room.ceiling_height_cm ?? '');
  const [error, setError] = useState(null);

  const setField = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const editingFeature = features.find((f) => f.id === editingId);

  async function saveCeiling() {
    if (String(room.ceiling_height_cm ?? '') === String(ceiling)) return;
    try { setError(null); await api.updateRoom(room.id, { ceiling_height_cm: ceiling }); await onChanged(); }
    catch (e) { setError(e.message); }
  }

  async function submitAdd(e) {
    e.preventDefault();
    try { setError(null); await api.createFeature(room.id, { kind: adding, ...form }); setAdding(null); setForm(EMPTY); await onChanged(); }
    catch (e2) { setError(e2.message); }
  }

  async function submitEdit(e) {
    e.preventDefault();
    try { setError(null); await api.updateFeature(editingId, form); setEditingId(null); setForm(EMPTY); await onChanged(); }
    catch (e2) { setError(e2.message); }
  }

  async function removeFeature(id) {
    try { setError(null); await api.deleteFeature(id); await onChanged(); }
    catch (e2) { setError(e2.message); }
  }

  function startAdd(kind) { setAdding(kind); setEditingId(null); setForm(EMPTY); }
  function startEdit(f) { setEditingId(f.id); setAdding(null); setForm(editValues(f)); }
  function cancel() { setAdding(null); setEditingId(null); setForm(EMPTY); }

  return (
    <div className="room-card" data-testid={`room-card-${room.id}`}>
      <div className="room-card-head">
        <span className="mini-name">{room.name} ({room.width_cm}×{room.depth_cm})</span>
        <label className="ceiling-input">
          천장
          <input aria-label={`${room.name} 천장 높이`} placeholder="cm" value={ceiling}
            onChange={(e) => setCeiling(e.target.value)} onBlur={saveCeiling} />
          cm
        </label>
        <button type="button" className="danger" aria-label={`방 삭제 ${room.name}`} onClick={onDelete}>삭제</button>
      </div>

      {error && <p className="error">{error}</p>}

      {features.length > 0 && (
        <ul className="feat-list">
          {features.map((f) => (
            <li key={f.id} className={selectedId === f.id ? 'feat-selected' : ''}>
              <button type="button" className="feat-main" onClick={() => onSelect(f.id)}>
                <span className="feat-ico">{FEATURE_META[f.kind].icon}</span>
                <span className="feat-kind">{FEATURE_META[f.kind].label}</span>
                <span className="feat-sum">{featureSummary(f)}</span>
              </button>
              <button type="button" onClick={() => startEdit(f)}>수정</button>
              <button type="button" className="danger" aria-label={`부착물 삭제 ${f.id}`} onClick={() => removeFeature(f.id)}>삭제</button>
            </li>
          ))}
        </ul>
      )}

      {adding === null && editingId === null && (
        <div className="feat-add">
          {Object.entries(FEATURE_META).map(([kind, m]) => (
            <button key={kind} type="button" onClick={() => startAdd(kind)}>＋ {m.label}</button>
          ))}
        </div>
      )}

      {adding !== null && <FeatureForm kind={adding} form={form} setField={setField} onSubmit={submitAdd} onCancel={cancel} />}
      {editingFeature && <FeatureForm kind={editingFeature.kind} form={form} setField={setField} onSubmit={submitEdit} onCancel={cancel} />}
    </div>
  );
}

// Inline form per kind: shared fields (wall · corner offset) first, then kind-specific fields.
function FeatureForm({ kind, form, setField, onSubmit, onCancel }) {
  return (
    <form onSubmit={onSubmit} className="feat-form">
      <select aria-label="벽" value={form.wall} onChange={setField('wall')}>
        {WALLS.map((w) => <option key={w} value={w}>{WALL_LABEL[w]} 벽</option>)}
      </select>
      <input aria-label="모서리에서" placeholder="모서리에서(cm)" value={form.offset_cm} onChange={setField('offset_cm')} />
      {kind !== 'outlet' && <input aria-label="폭" placeholder="폭(cm)" value={form.width_cm} onChange={setField('width_cm')} />}
      {kind === 'door' && <input aria-label="통과 높이" placeholder="통과 높이(cm)" value={form.height_cm} onChange={setField('height_cm')} />}
      {kind === 'door' && (
        <select aria-label="열림" value={form.swing} onChange={setField('swing')}>
          <option value="">열림 방향</option>
          {SWINGS.map((s) => <option key={s} value={s}>{SWING_LABEL[s]}</option>)}
        </select>
      )}
      {kind === 'window' && <input aria-label="창 높이" placeholder="창 높이(cm)" value={form.height_cm} onChange={setField('height_cm')} />}
      {kind === 'window' && <input aria-label="창턱" placeholder="턱 높이(cm)" value={form.sill_height_cm} onChange={setField('sill_height_cm')} />}
      {kind === 'outlet' && <input aria-label="바닥에서" placeholder="바닥에서(cm)" value={form.floor_height_cm} onChange={setField('floor_height_cm')} />}
      <div className="feat-form-actions">
        <button type="submit">저장</button>
        <button type="button" className="btn-ghost" onClick={onCancel}>취소</button>
      </div>
    </form>
  );
}
