import * as THREE from 'three';
import { clamp } from '../utils/mathHelpers.js';

/**
 * Creates a perspective camera and attaches mouse/touch orbit controls
 * to the given canvas element.
 *
 * @param {HTMLCanvasElement} canvas
 * @returns {{ camera: THREE.PerspectiveCamera, resetCamera: () => void }}
 */
export function createCamera(canvas) {
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 100);
  const target = new THREE.Vector3(0, 0.4, 0);

  // Spherical orbit state
  let theta   = 0.75;   // azimuth  (horizontal angle)
  let phi     = 1.08;   // polar    (vertical angle)
  let radius  = 10;

  let dragging = false;
  let prevX    = 0;
  let prevY    = 0;

  // ── Helpers ────────────────────────────────────────────────────────────
  function applyCamera() {
    const sp = Math.sin(phi);
    const cp = Math.cos(phi);
    camera.position.set(
      target.x + radius * sp * Math.cos(theta),
      target.y + radius * cp,
      target.z + radius * sp * Math.sin(theta),
    );
    camera.lookAt(target);
  }

  function resetCamera() {
    theta  = 0.75;
    phi    = 1.08;
    radius = 10;
  }

  // ── Mouse events ──────────────────────────────────────────────────────
  canvas.addEventListener('mousedown', (e) => {
    dragging = true;
    prevX = e.clientX;
    prevY = e.clientY;
  });

  window.addEventListener('mouseup',   () => { dragging = false; });

  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    theta -= (e.clientX - prevX) * 0.007;
    phi    = clamp(phi + (e.clientY - prevY) * 0.007, 0.15, Math.PI - 0.15);
    prevX  = e.clientX;
    prevY  = e.clientY;
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    radius = clamp(radius + e.deltaY * 0.018, 4, 18);
  }, { passive: false });

  // ── Touch events ──────────────────────────────────────────────────────
  canvas.addEventListener('touchstart', (e) => {
    dragging = true;
    prevX = e.touches[0].clientX;
    prevY = e.touches[0].clientY;
  }, { passive: true });

  canvas.addEventListener('touchend',   () => { dragging = false; });

  canvas.addEventListener('touchmove', (e) => {
    if (!dragging || e.touches.length !== 1) return;
    theta -= (e.touches[0].clientX - prevX) * 0.007;
    phi    = clamp(phi + (e.touches[0].clientY - prevY) * 0.007, 0.15, Math.PI - 0.15);
    prevX  = e.touches[0].clientX;
    prevY  = e.touches[0].clientY;
  }, { passive: true });

  // ── Update hook — call once per frame ─────────────────────────────────
  camera.update = applyCamera;

  return { camera, resetCamera };
}
