// Clamps a number into a fixed range.
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// Interpolates between two numbers.
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Produces a smooth 0..1 transition between two edges.
export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / ((edge1 - edge0) || 1), 0, 1);
  return t * t * (3 - 2 * t);
}

// Measures the closest distance from a point to a segment.
export function distanceToSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const lenSq = vx * vx + vy * vy || 1;
  const t = clamp((wx * vx + wy * vy) / lenSq, 0, 1);
  const dx = px - (ax + vx * t);
  const dy = py - (ay + vy * t);
  return { distance: Math.sqrt(dx * dx + dy * dy), along: t };
}

// Generates a stable pseudo-random value from a number.
export function hash01(value) {
  const n = Math.sin(value * 12.9898) * 43758.5453123;
  return n - Math.floor(n);
}
