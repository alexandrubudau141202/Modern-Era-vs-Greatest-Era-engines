import * as THREE from 'three';

/**
 * Creates and configures the Three.js renderer, scene, and ground plane.
 * @param {HTMLCanvasElement} canvas
 * @returns {{ renderer: THREE.WebGLRenderer, scene: THREE.Scene }}
 */
export function setupScene(canvas) {
  // ── Renderer ──────────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
  renderer.toneMapping          = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure  = 1.05;

  // ── Scene ─────────────────────────────────────────────────────────────
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x04040a, 0.06);

  // ── Ground plane ──────────────────────────────────────────────────────
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(28, 28),
    new THREE.MeshStandardMaterial({ color: 0x080810, roughness: 0.92, metalness: 0.05 }),
  );
  ground.rotation.x    = -Math.PI / 2;
  ground.position.y    = -1.6;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(24, 24, 0x181826, 0x0e0e1c);
  grid.position.y = -1.59;
  scene.add(grid);

  return { renderer, scene };
}

/**
 * Resize the renderer to match its parent element.
 * Mutates renderer and camera in place; safe to call every frame.
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.PerspectiveCamera} camera
 */
export function resizeIfNeeded(renderer, camera) {
  const canvas = renderer.domElement;
  const parent = canvas.parentElement;
  if (!parent) return;

  const w = parent.clientWidth;
  const h = parent.clientHeight;

  if (canvas.width === w && canvas.height === h) return;

  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
