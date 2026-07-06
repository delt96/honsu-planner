import { cmToPx, wallSegment } from './geometry.js';

// Live distance readout (cm) from a wall feature to both corners of its wall.
// Used by the placement ghost and by feature dragging.
export function DistanceLabels({ room, wall, offsetCm, widthCm = 0 }) {
  const wallLen = wall === 'N' || wall === 'S' ? Number(room.width_cm) : Number(room.depth_cm);
  const seg = wallSegment(room, wall, offsetCm, widthCm);
  const start = wallSegment(room, wall, 0, 0);
  const end = wallSegment(room, wall, wallLen, 0);
  const vertical = wall === 'E' || wall === 'W';
  const label = (a, b, text, key) => (
    <text key={key} className="dist-label"
      x={cmToPx((a[0] + b[0]) / 2) - (vertical ? 8 : 0)}
      y={cmToPx((a[1] + b[1]) / 2) - (vertical ? 0 : 6)}
      textAnchor="middle">{text}</text>
  );
  const left = Math.round(offsetCm);
  const right = Math.round(wallLen - offsetCm - widthCm);
  return (
    <g className="dist-labels">
      {left > 0 && label([start.x1, start.y1], [seg.x1, seg.y1], String(left), 'a')}
      {right > 0 && label([seg.x2, seg.y2], [end.x1, end.y1], String(right), 'b')}
    </g>
  );
}
