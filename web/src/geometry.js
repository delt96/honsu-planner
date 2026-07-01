export const PX_PER_CM = 0.6;
export const GRID_CM = 10;

export const cmToPx = (cm) => cm * PX_PER_CM;
export const pxToCm = (px) => px / PX_PER_CM;
export const snapCm = (cm, grid = GRID_CM) => Math.round(cm / grid) * grid;

export function rotatedFootprint(width_cm, depth_cm, rotation) {
  const r = ((rotation % 360) + 360) % 360;
  return r === 90 || r === 270 ? { w: depth_cm, h: width_cm } : { w: width_cm, h: depth_cm };
}

export const nextRotation = (rotation) => (((rotation ?? 0) + 90) % 360);
