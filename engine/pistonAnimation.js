import { pistonOffset, angleToTDC, rpmToRps } from '../utils/mathHelpers.js';

/**
 * Advances the engine animation by one frame.
 *
 * @param {object}  eng           Return value of buildV10 / buildV6
 * @param {number}  rpm           Current target RPM
 * @param {number}  dt            Delta-time in seconds
 * @param {object}  lights        { exhaustLight, ersLight } from lighting.js
 * @param {boolean} isHybrid      True for V6 hybrid mode
 * @returns {number}              Updated crankshaft angle (radians)
 */
export function stepEngineAnimation(eng, rpm, dt, lights, isHybrid, crankAngle) {
  const nextAngle = crankAngle + rpmToRps(rpm) * dt;

  // ── Pistons ──────────────────────────────────────────────────────────
  eng.pistons.forEach((p) => {
    const offset       = pistonOffset(nextAngle, p.phase, p.stk);
    p.pist.position.y  = p.baseY + offset;
    p.rod.position.y   = p.baseY + offset * 0.45 - 0.08;
  });

  // ── Crankshaft ───────────────────────────────────────────────────────
  eng.crankG.rotation.z = nextAngle;

  // ── Turbo (V6 only) ──────────────────────────────────────────────────
  if (eng.turboG) {
    eng.turboG.rotation.x = nextAngle * 22;
  }

  // ── Exhaust heat glow ────────────────────────────────────────────────
  const n = rpm / eng.maxRPM;
  lights.exhaustLight.intensity = n * 5;

  eng.exhMeshes.forEach((m) => {
    if (!m.material) return;
    m.material.emissive.setRGB(n * 0.6, n * 0.12, 0);
    m.material.emissiveIntensity = n * 0.9;
  });

  // ── ERS glow (V6 only) ───────────────────────────────────────────────
  lights.ersLight.intensity = isHybrid ? n * 2.5 : 0;

  return nextAngle;
}

/**
 * Updates the cylinder firing LEDs in the DOM.
 * Highlights the LED of whichever cylinder is nearest its firing TDC.
 *
 * @param {object} eng          Engine object (has .pistons array)
 * @param {number} crankAngle   Current crank angle
 * @param {number} cylCount     Total cylinder count
 */
export function updateFiringLEDs(eng, crankAngle, cylCount) {
  eng.pistons.forEach((p, i) => {
    const dist = angleToTDC(crankAngle, p.phase);
    const el   = document.getElementById('led' + (i + 1));
    if (el) el.classList.toggle('fire', dist < 0.35);
  });
}

/**
 * Apply a render mode (solid / wireframe / xray) to every mesh in the engine group.
 *
 * @param {THREE.Group} group
 * @param {'solid'|'wire'|'xray'} mode
 */
export function applyRenderMode(group, mode) {
  group.traverse((child) => {
    if (!child.isMesh) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    mats.forEach((m) => {
      m.wireframe    = mode === 'wire';
      m.transparent  = mode === 'xray';
      m.opacity      = mode === 'xray' ? 0.3 : 1.0;
      if (mode !== 'xray') m.depthWrite = true;
    });
  });
}
