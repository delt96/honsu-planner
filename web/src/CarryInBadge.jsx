import { evaluateCarryIn } from './carryin.js';

const ICON = { ok: '✓', tight: '⚠', fail: '✕', unknown: '?' };

// Renders a 반입(carry-in) verdict badge for a piece of furniture given the home
// settings. Pass hideUnknown to render nothing when it can't be judged yet.
export function CarryInBadge({ dims, settings, hideUnknown = false, showReason = false }) {
  const v = evaluateCarryIn(dims, settings);
  if (hideUnknown && v.status === 'unknown') return null;
  return (
    <span className={`carry-badge carry-${v.status}`} title={v.reason || v.label}>
      <span className="carry-ico">{ICON[v.status]}</span>
      <span className="carry-text">{v.label}</span>
      {showReason && v.reason && <span className="carry-reason">· {v.reason}</span>}
    </span>
  );
}
