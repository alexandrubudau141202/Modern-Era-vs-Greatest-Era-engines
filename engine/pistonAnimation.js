import { pistonOffset, angleToTDC, rpmToRps } from '../utils/mathHelpers.js';

/**
 * Advance the engine animation by one frame.
 *
 * Handles three piston descriptor formats:
 *   1. Procedural  — { pist, rod, baseY, stk, phase }
 *   2. GLB unnamed — { pist, baseWorldPos, worldBankAxis, stk, phase }
 *   3. GLB named   — { pist, phase }  (AnimationMixer drives actual movement)
 */
export function stepEngineAnimation(eng, rpm, dt, lights, isHybrid, crankAngle) {
  const nextAngle = crankAngle + rpmToRps(rpm) * dt;

  // ── Pistons ──────────────────────────────────────────────────────────────
  if (!eng.usesAnimationMixer) {
    eng.pistons.forEach((p) => {
      const offset = pistonOffset(nextAngle, p.phase, p.stk ?? 0);

      if (p.baseLocalPos && p.localAxis) {
        // GLB unnamed: axis and base position are already in parent-local space —
        // just add the offset directly. No coordinate conversion needed.
        p.pist.position
          .copy(p.baseLocalPos)
          .addScaledVector(p.localAxis, offset);
      } else if (p.baseY !== undefined) {
        // Procedural
        p.pist.position.y = p.baseY + offset;
        if (p.rod) p.rod.position.y = p.baseY + offset * 0.45 - 0.08;
      }
      // GLB named (no baseY / baseWorldPos): AnimationMixer handles movement, skip.
    });
  }

  // ── Crankshaft ───────────────────────────────────────────────────────────
  // For AnimationMixer GLBs the clip already rotates the crank — don't double-rotate.
  if (!eng.usesAnimationMixer && eng.crankG) {
    eng.crankG.rotation.z = nextAngle;
  }

  // ── Turbo (procedural V6) ─────────────────────────────────────────────────
  if (eng.turboG) eng.turboG.rotation.x = nextAngle * 22;

  // ── Exhaust heat glow ────────────────────────────────────────────────────
  const n = rpm / eng.maxRPM;
  lights.exhaustLight.intensity = n * 5;
  eng.exhMeshes.forEach((m) => {
    if (!m.material) return;
    m.material.emissive.setRGB(n * 0.6, n * 0.12, 0);
    m.material.emissiveIntensity = n * 0.9;
  });

  // ── ERS glow ─────────────────────────────────────────────────────────────
  lights.ersLight.intensity = isHybrid ? n * 2.5 : 0;

  return nextAngle;
}

/**
 * Update the AnimationMixer speed based on current RPM.
 * Call every frame for GLBs that use embedded animations.
 *
 * @param {THREE.AnimationMixer} mixer
 * @param {number} rpm
 * @param {number} maxRPM
 * @param {number} dt
 */
export function stepMixer(mixer, rpm, maxRPM, dt, animRootNode) {
  if (!mixer) return;
  mixer.timeScale = (rpm / maxRPM) * 4;
  mixer.update(dt);
  // The GLB animation drives the root node's rotation, spinning the whole
  // engine around itself. Zero it out after every tick to lock it in place.
  if (animRootNode) {
    animRootNode.rotation.set(0, 0, 0);
    animRootNode.quaternion.identity();
  }
}

/**
 * Light up cylinder firing LEDs.
 */
export function updateFiringLEDs(eng, crankAngle, cylCount) {
  eng.pistons.forEach((p, i) => {
    const dist = angleToTDC(crankAngle, p.phase);
    const el = document.getElementById('led' + (i + 1));
    if (el) el.classList.toggle('fire', dist < 0.35);
  });
}

/**
 * Apply render mode to every mesh in the engine group.
 */
export function applyRenderMode(group, mode) {
  group.traverse((child) => {
    if (!child.isMesh) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    mats.forEach((m) => {
      m.wireframe   = mode === 'wire';
      m.transparent = mode === 'xray';
      m.opacity     = mode === 'xray' ? 0.3 : 1.0;
      if (mode !== 'xray') m.depthWrite = true;
    });
  });
}