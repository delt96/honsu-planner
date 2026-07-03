// Warns with a '천장 초과' (ceiling exceeded) chip when a confirmed item's height
// is taller than the lowest entered room ceiling (min_ceiling_height_cm, a server
// derived field). Precise per-room comparison (placement based) is handled in stage 4.
export function CeilingBadge({ heightCm, settings }) {
  const min = Number(settings?.min_ceiling_height_cm);
  const h = heightCm === null || heightCm === undefined || heightCm === '' ? null : Number(heightCm);
  if (!(min > 0) || !(h > 0) || h <= min) return null;
  return (
    <span className="carry-badge carry-fail" title={`가구 높이 ${h}cm — 최저 천장 ${min}cm 초과`}>
      <span className="carry-ico">⚠</span>
      <span className="carry-text">천장 초과</span>
    </span>
  );
}
