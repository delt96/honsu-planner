import { useState } from 'react';
import { api } from './api.js';
import { FEATURE_META, featureSummary } from './features.js';

// Panel room card: per-room ceiling height + read-only feature list.
// Creating/editing features happens on the plan (toolbar + property card);
// clicking a row selects the symbol there via onSelect.
export function RoomCard({ room, onChanged, onDelete, selectedId = null, onSelect = () => {} }) {
  const features = room.features ?? [];
  const [ceiling, setCeiling] = useState(room.ceiling_height_cm ?? '');
  const [error, setError] = useState(null);

  async function saveCeiling() {
    if (String(room.ceiling_height_cm ?? '') === String(ceiling)) return;
    try { setError(null); await api.updateRoom(room.id, { ceiling_height_cm: ceiling }); await onChanged(); }
    catch (e) { setError(e.message); }
  }

  async function removeFeature(id) {
    try { setError(null); await api.deleteFeature(id); await onChanged(); }
    catch (e) { setError(e.message); }
  }

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

      {features.length > 0 ? (
        <ul className="feat-list">
          {features.map((f) => (
            <li key={f.id} className={selectedId === f.id ? 'feat-selected' : ''}>
              <button type="button" className="feat-main" onClick={() => onSelect(f.id)}>
                <span className="feat-ico">{FEATURE_META[f.kind].icon}</span>
                <span className="feat-kind">{FEATURE_META[f.kind].label}</span>
                <span className="feat-sum">{featureSummary(f)}</span>
              </button>
              <button type="button" className="danger" aria-label={`부착물 삭제 ${f.id}`} onClick={() => removeFeature(f.id)}>삭제</button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted feat-empty">도면 위 도구로 문·창문·콘센트를 배치하세요</p>
      )}
    </div>
  );
}
