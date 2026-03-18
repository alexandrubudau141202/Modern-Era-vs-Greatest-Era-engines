import * as THREE from 'three';

/**
 * Adds all lights to the scene and returns handles to dynamic lights
 * that the engine animation updates each frame.
 *
 * @param {THREE.Scene} scene
 * @returns {{ exhaustLight: THREE.PointLight, ersLight: THREE.PointLight }}
 */
export function addLights(scene) {
  // ── Ambient ───────────────────────────────────────────────────────────
  scene.add(new THREE.AmbientLight(0x10101c, 4));

  // ── Key light (top-right-front) ───────────────────────────────────────
  const keyLight = new THREE.DirectionalLight(0xffffff, 5);
  keyLight.position.set(7, 12, 7);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near   = 0.5;
  keyLight.shadow.camera.far    = 40;
  keyLight.shadow.camera.left   = -8;
  keyLight.shadow.camera.right  =  8;
  keyLight.shadow.camera.top    =  8;
  keyLight.shadow.camera.bottom = -8;
  scene.add(keyLight);

  // ── Fill light (top-left-back) ────────────────────────────────────────
  const fillLight = new THREE.DirectionalLight(0x223366, 1.8);
  fillLight.position.set(-7, 3, -6);
  scene.add(fillLight);

  // ── Rim light (back-low) ──────────────────────────────────────────────
  const rimLight = new THREE.DirectionalLight(0x445566, 2.2);
  rimLight.position.set(0, -4, 9);
  scene.add(rimLight);

  // ── Dynamic: exhaust heat glow ────────────────────────────────────────
  const exhaustLight = new THREE.PointLight(0xff2000, 0, 14);
  exhaustLight.position.set(0, -1.8, 0);
  scene.add(exhaustLight);

  // ── Dynamic: ERS glow (V6 only) ───────────────────────────────────────
  const ersLight = new THREE.PointLight(0x00d4ff, 0, 10);
  ersLight.position.set(-2, 1, 0);
  scene.add(ersLight);

  return { exhaustLight, ersLight };
}
