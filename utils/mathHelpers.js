/**
 * Clamp a value between min and max.
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * Linear interpolation between a and b by t.
 * @param {number} a
 * @param {number} b
 * @param {number} t  0–1
 * @returns {number}
 */
export function lerp(a, b, t) {
  return a + (b - a) * clamp(t, 0, 1);
}

/**
 * Map a value from one range to another.
 * @param {number} val
 * @param {number} inMin
 * @param {number} inMax
 * @param {number} outMin
 * @param {number} outMax
 * @returns {number}
 */
export function mapRange(val, inMin, inMax, outMin, outMax) {
  const t = (val - inMin) / (inMax - inMin);
  return lerp(outMin, outMax, t);
}

/**
 * Normalise RPM to 0–1 relative to a given maxRPM.
 * @param {number} rpm
 * @param {number} maxRPM
 * @returns {number}
 */
export function normRPM(rpm, maxRPM) {
  return clamp((rpm - 800) / (maxRPM - 800), 0, 1);
}

/**
 * Convert RPM to radians per second.
 * @param {number} rpm
 * @returns {number}
 */
export function rpmToRps(rpm) {
  return (rpm / 60) * 2 * Math.PI;
}

/**
 * Piston position (0 = TDC, stroke = BDC) using slider-crank geometry.
 * @param {number} crankAngle  Current crank angle in radians
 * @param {number} phase       Cylinder phase offset in radians
 * @param {number} stroke      Full stroke length
 * @returns {number}  Offset from neutral position
 */
export function pistonOffset(crankAngle, phase, stroke) {
  return Math.sin(crankAngle + phase) * stroke;
}

/**
 * Angular distance to TDC (top dead centre) — used to determine firing.
 * @param {number} crankAngle
 * @param {number} phase
 * @returns {number}  0 = at TDC, up to π away
 */
export function angleToTDC(crankAngle, phase) {
  const a = ((crankAngle + phase) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  return Math.min(Math.abs(a - Math.PI * 0.5), 2 * Math.PI - Math.abs(a - Math.PI * 0.5));
}

/**
 * Smooth step easing (Ken Perlin).
 * @param {number} t  0–1
 * @returns {number}
 */
export function smoothstep(t) {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
}

/**
 * Format a number with thousand separators.
 * @param {number} n
 * @returns {string}
 */
export function fmtNum(n) {
  return Math.round(n).toLocaleString();
}
