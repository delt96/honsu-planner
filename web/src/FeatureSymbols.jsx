import { cmToPx, wallSegment, doorArcPath } from './geometry.js';
import { featureChip } from './features.js';

// Single wall-attachment symbol: door = wall gap + swing arc, window = double
// line on the wall, outlet = dot. Reused by the placement ghost (Task 4).
export function FeatureSymbol({ room, feature: f, selected = false, onClick, onMouseDown }) {
  const seg = wallSegment(room, f.wall, Number(f.offset_cm), Number(f.width_cm ?? 0));
  const common = {
    className: `feat-sym feat-${f.kind}${selected ? ' selected' : ''}`,
    'data-testid': `feat-${f.id}`,
    onClick,
    onMouseDown,
  };
  if (f.kind === 'door') {
    return (
      <g {...common}>
        <line className="door-gap" x1={cmToPx(seg.x1)} y1={cmToPx(seg.y1)} x2={cmToPx(seg.x2)} y2={cmToPx(seg.y2)} />
        <path className="door-arc" d={doorArcPath(room, f)} />
      </g>
    );
  }
  if (f.kind === 'window') {
    const vertical = f.wall === 'E' || f.wall === 'W';
    const ox = vertical ? 2 : 0;
    const oy = vertical ? 0 : 2;
    return (
      <g {...common}>
        <line className="win-line" x1={cmToPx(seg.x1) - ox} y1={cmToPx(seg.y1) - oy} x2={cmToPx(seg.x2) - ox} y2={cmToPx(seg.y2) - oy} />
        <line className="win-line" x1={cmToPx(seg.x1) + ox} y1={cmToPx(seg.y1) + oy} x2={cmToPx(seg.x2) + ox} y2={cmToPx(seg.y2) + oy} />
      </g>
    );
  }
  return (
    <g {...common}>
      <circle className="outlet-dot" cx={cmToPx(seg.x1)} cy={cmToPx(seg.y1)} r={4} />
    </g>
  );
}

// A room's attachments plus the selected feature's info chip (chip is replaced
// by the property card in a later task).
export function FeatureSymbols({ room, selectedId = null, onSelect = () => {} }) {
  return (room.features ?? []).map((f) => {
    const seg = wallSegment(room, f.wall, Number(f.offset_cm), Number(f.width_cm ?? 0));
    const selected = selectedId === f.id;
    return (
      <g key={f.id}>
        <FeatureSymbol room={room} feature={f} selected={selected} onClick={() => onSelect(f.id)} />
        {selected && (
          <text className="feat-chip" x={cmToPx((seg.x1 + seg.x2) / 2)} y={cmToPx((seg.y1 + seg.y2) / 2) - 10} textAnchor="middle">
            {featureChip(f)}
          </text>
        )}
      </g>
    );
  });
}
