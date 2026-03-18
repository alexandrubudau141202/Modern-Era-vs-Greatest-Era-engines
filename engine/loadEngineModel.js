import * as THREE from 'three';
import { GLTFLoader } from 'https://esm.sh/three@0.128.0/examples/jsm/loaders/GLTFLoader.js';

// ────────────────────────────────────────────────────────────────────────────
//  GLB model loader
//  Usage: const { g, scene } = await loadGLBModel('./assets/models/engine.glb')
// ────────────────────────────────────────────────────────────────────────────
const _loader = new GLTFLoader();

/**
 * Load a GLB file and return a normalised engine object compatible with the
 * rest of the system (crankG, pistons, exhMeshes are empty — animate via
 * the GLTF's own AnimationMixer instead, or wire up manually by name).
 *
 * @param {string} path  e.g. './assets/models/engine.glb'
 * @returns {Promise<{ g: THREE.Group, crankG: THREE.Group, pistons: [], exhMeshes: [], mixer: THREE.AnimationMixer|null, maxRPM: number }>}
 */
export function loadGLBModel(path, maxRPM = 19000) {
  return new Promise((resolve, reject) => {
    _loader.load(
      path,
      (gltf) => {
        const g = gltf.scene;

        // Auto-scale: fit inside a ~4-unit bounding box
        const box3  = new THREE.Box3().setFromObject(g);
        const size  = new THREE.Vector3();
        box3.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 0) g.scale.setScalar(4 / maxDim);

        // Re-centre on origin
        box3.setFromObject(g);
        const centre = new THREE.Vector3();
        box3.getCenter(centre);
        g.position.sub(centre);

        // Enable shadows on every mesh
        g.traverse((child) => {
          if (child.isMesh) {
            child.castShadow    = true;
            child.receiveShadow = true;
          }
        });

        // AnimationMixer (plays embedded animations, if any)
        let mixer = null;
        if (gltf.animations && gltf.animations.length > 0) {
          mixer = new THREE.AnimationMixer(g);
          gltf.animations.forEach((clip) => mixer.clipAction(clip).play());
        }

        // Try to find a crankshaft node by common naming conventions
        const crankG = g.getObjectByName('Crankshaft')
                    || g.getObjectByName('crankshaft')
                    || g.getObjectByName('crank')
                    || new THREE.Group(); // fallback empty group

        resolve({
          g,
          crankG,
          pistons:   [],   // wire up manually if needed (see README)
          exhMeshes: [],   // wire up manually if needed
          mixer,
          maxRPM,
        });
      },
      undefined,
      (err) => reject(err),
    );
  });
}

// ────────────────────────────────────────────────────────────────────────────
//  Shared material factory
// ────────────────────────────────────────────────────────────────────────────
function mat(color, roughness, metalness, emissive = 0x000000, emI = 0) {
  return new THREE.MeshStandardMaterial({
    color, roughness, metalness, emissive, emissiveIntensity: emI,
  });
}

const M = {
  block:  mat(0x1a1a22, 0.52, 0.96),
  head:   mat(0x1e1e28, 0.48, 0.90),
  piston: mat(0x909090, 0.22, 0.98),
  crank:  mat(0x303038, 0.18, 1.00),
  intake: mat(0x202030, 0.55, 0.72),
  turbo:  mat(0x484848, 0.14, 1.00),
  red:    mat(0xe10600, 0.38, 0.55, 0xe10600, 0.50),
  cyan:   mat(0x00aacc, 0.35, 0.55, 0x00aacc, 0.45),
  oil:    mat(0x0c0c14, 0.85, 0.18),
  brass:  mat(0xc08820, 0.32, 0.88),
};

// Convenience mesh helper
function mkMesh(geo, material, cast = true) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow    = cast;
  m.receiveShadow = true;
  return m;
}
const box = (w, h, d, m)  => mkMesh(new THREE.BoxGeometry(w, h, d), m);
const cyl = (rt, rb, h, s, m) => mkMesh(new THREE.CylinderGeometry(rt, rb, h, s), m);
const sph = (r, s, m)      => mkMesh(new THREE.SphereGeometry(r, s, s), m);

// ────────────────────────────────────────────────────────────────────────────
//  Fresh exhaust material per call (emissive animated independently)
// ────────────────────────────────────────────────────────────────────────────
function exhMat() {
  return new THREE.MeshStandardMaterial({
    color: 0x503020, roughness: 0.40, metalness: 0.82,
    emissive: 0x000000, emissiveIntensity: 0,
  });
}

// ────────────────────────────────────────────────────────────────────────────
//  V10 builder
// ────────────────────────────────────────────────────────────────────────────
/**
 * Builds the V10 engine group from procedural Three.js geometry.
 * @param {import('../data/v10Data.js').v10Data} cfg
 * @returns {{ g: THREE.Group, crankG: THREE.Group, pistons: Array, exhMeshes: Array, maxRPM: number }}
 */
export function buildV10(cfg) {
  const g = new THREE.Group();
  const pistons    = [];
  const exhMeshes  = [];

  const { cylCount: nc, cylSpacing: sp, bankAngle: bAng, bore, stroke: stk, cylHeight: cylH } = cfg.geometry;
  const phases = cfg.crankPhases;

  // Oil pan + lower block
  const oilPan   = box(nc * sp + 0.6, 0.40, 1.30, M.oil);   oilPan.position.y = -0.52;  g.add(oilPan);
  const lowerBlk = box(nc * sp + 0.4, 0.32, 1.18, M.block); lowerBlk.position.y = -0.20; g.add(lowerBlk);

  // ── Crankshaft ──
  const crankG = new THREE.Group();
  const jrn = cyl(0.075, 0.075, nc * sp + 0.3, 10, M.crank);
  jrn.rotation.z = Math.PI / 2;
  crankG.add(jrn);

  for (let i = 0; i < nc; i++) {
    const t = box(0.09, 0.27, 0.13, M.crank);
    t.position.set((i - 2) * sp, 0.12, 0);
    crankG.add(t);
    const pin = cyl(0.04, 0.04, 0.12, 8, M.crank);
    pin.rotation.z = Math.PI / 2;
    pin.position.set((i - 2) * sp, 0.24, 0);
    crankG.add(pin);
  }
  g.add(crankG);

  // ── Banks ──
  for (let bank = 0; bank < 2; bank++) {
    const s  = bank === 0 ? 1 : -1;
    const bg = new THREE.Group();
    bg.rotation.x = s * bAng;

    const rail = box(nc * sp + 0.22, 0.28, 0.90, M.block);
    rail.position.y = 0.22;
    bg.add(rail);

    for (let i = 0; i < nc; i++) {
      const cx = (i - 2) * sp;
      const cg = new THREE.Group();
      cg.position.x = cx;

      // Cylinder wall
      const boreM = cyl(bore, bore, cylH, 16, M.block);
      boreM.position.y = cylH / 2 + 0.36;
      cg.add(boreM);

      // Head
      const headM = cyl(bore + 0.065, bore + 0.065, 0.19, 16, M.head);
      headM.position.y = cylH + 0.46;
      cg.add(headM);

      // Valve cover
      const vc = box(0.58, 0.11, 0.58, M.head);
      vc.position.y = cylH + 0.62;
      cg.add(vc);

      // Spark plug
      const spk = cyl(0.03, 0.03, 0.12, 6, M.brass);
      spk.position.y = cylH + 0.75;
      cg.add(spk);

      // Cover fins
      for (let f = 0; f < 4; f++) {
        const fin = box(0.58, 0.015, 0.022, M.block);
        fin.position.set(0, cylH + 0.58, -0.15 + f * 0.1);
        cg.add(fin);
      }

      // Piston
      const pist   = cyl(bore - 0.04, bore - 0.04, 0.23, 16, M.piston);
      const baseY  = 0.46;
      pist.position.y = baseY;
      cg.add(pist);

      // Wrist pin
      const wp = cyl(0.025, 0.025, 0.38, 8, M.crank);
      wp.rotation.z = Math.PI / 2;
      wp.position.y = baseY + 0.04;
      cg.add(wp);

      // Con-rod
      const rod = box(0.04, 0.58, 0.07, M.crank);
      rod.position.y = 0.22;
      cg.add(rod);

      pistons.push({ pist, rod, baseY, stk, phase: phases[bank * nc + i] });
      bg.add(cg);
    }
    g.add(bg);
  }

  // ── Intake (classic trumpet stacks) ──
  const plen = box(nc * sp + 0.2, 0.25, 0.42, M.intake);
  plen.position.y = 1.82;
  g.add(plen);

  for (let i = 0; i < nc; i++) {
    const tr   = cyl(0.13, 0.08, 0.52, 10, M.intake);
    tr.position.set((i - 2) * sp, 2.14, 0);
    g.add(tr);

    const bell = cyl(0.18, 0.13, 0.10, 10, M.intake);
    bell.position.set((i - 2) * sp, 2.42, 0);
    g.add(bell);
  }

  // ── Exhaust headers ──
  for (let bank = 0; bank < 2; bank++) {
    const s = bank === 0 ? 1 : -1;
    for (let i = 0; i < nc; i++) {
      const em = mkMesh(new THREE.CylinderGeometry(0.07, 0.06, 0.72, 8), exhMat());
      em.position.set((i - 2) * sp, -0.50, s * 0.70);
      em.rotation.x = -s * 0.42;
      g.add(em);
      exhMeshes.push(em);
    }
    const col = mkMesh(new THREE.CylinderGeometry(0.11, 0.09, 0.50, 8), exhMat());
    col.position.set(0, -0.85, s * 0.90);
    col.rotation.x = -s * 0.50;
    g.add(col);
    exhMeshes.push(col);
  }

  return { g, crankG, pistons, exhMeshes, maxRPM: cfg.maxRPM };
}

// ────────────────────────────────────────────────────────────────────────────
//  V6 Turbo Hybrid builder
// ────────────────────────────────────────────────────────────────────────────
/**
 * Builds the V6 turbo hybrid engine group from procedural Three.js geometry.
 * @param {import('../data/v6Data.js').v6Data} cfg
 * @returns {{ g: THREE.Group, crankG: THREE.Group, pistons: Array, exhMeshes: Array,
 *             turboG: THREE.Group, maxRPM: number }}
 */
export function buildV6(cfg) {
  const g = new THREE.Group();
  const pistons   = [];
  const exhMeshes = [];

  const { cylCount: nc, cylSpacing: sp, bankAngle: bAng, bore, stroke: stk, cylHeight: cylH } = cfg.geometry;
  const phases = cfg.crankPhases;

  // Oil pan + lower block
  const oilPan   = box(nc * sp + 0.8, 0.44, 1.44, M.oil);   oilPan.position.y   = -0.58; g.add(oilPan);
  const lowerBlk = box(nc * sp + 0.6, 0.36, 1.32, M.block); lowerBlk.position.y = -0.22; g.add(lowerBlk);

  // ── Crankshaft ──
  const crankG = new THREE.Group();
  const jrn = cyl(0.09, 0.09, nc * sp + 0.45, 10, M.crank);
  jrn.rotation.z = Math.PI / 2;
  crankG.add(jrn);

  for (let i = 0; i < nc; i++) {
    const t = box(0.11, 0.30, 0.15, M.crank);
    t.position.set((i - 1) * sp, 0.13, 0);
    crankG.add(t);
    const pin = cyl(0.05, 0.05, 0.14, 8, M.crank);
    pin.rotation.z = Math.PI / 2;
    pin.position.set((i - 1) * sp, 0.26, 0);
    crankG.add(pin);
  }
  g.add(crankG);

  // ── Banks ──
  for (let bank = 0; bank < 2; bank++) {
    const s  = bank === 0 ? 1 : -1;
    const bg = new THREE.Group();
    bg.rotation.x = s * bAng;

    const rail = box(nc * sp + 0.32, 0.32, 0.95, M.block);
    rail.position.y = 0.26;
    bg.add(rail);

    for (let i = 0; i < nc; i++) {
      const cx = (i - 1) * sp;
      const cg = new THREE.Group();
      cg.position.x = cx;

      const boreM = cyl(bore, bore, cylH, 16, M.block);
      boreM.position.y = cylH / 2 + 0.38;
      cg.add(boreM);

      const headM = cyl(bore + 0.08, bore + 0.08, 0.22, 16, M.head);
      headM.position.y = cylH + 0.50;
      cg.add(headM);

      const vc = box(0.70, 0.14, 0.70, M.head);
      vc.position.y = cylH + 0.68;
      cg.add(vc);

      const coil = cyl(0.065, 0.055, 0.18, 8, M.block);
      coil.position.y = cylH + 0.82;
      cg.add(coil);

      const inj = cyl(0.022, 0.022, 0.14, 6, M.brass);
      inj.position.set(0.20, cylH + 0.62, 0.12);
      cg.add(inj);

      const pist  = cyl(bore - 0.04, bore - 0.04, 0.26, 16, M.piston);
      const baseY = 0.50;
      pist.position.y = baseY;
      cg.add(pist);

      const wp = cyl(0.028, 0.028, 0.40, 8, M.crank);
      wp.rotation.z = Math.PI / 2;
      wp.position.y = baseY + 0.04;
      cg.add(wp);

      const rod = box(0.05, 0.62, 0.09, M.crank);
      rod.position.y = 0.24;
      cg.add(rod);

      pistons.push({ pist, rod, baseY, stk, phase: phases[bank * nc + i] });
      bg.add(cg);
    }
    g.add(bg);
  }

  // ── Intake / intercooler ──
  const plen = box(nc * sp + 0.1, 0.32, 0.45, M.intake);
  plen.position.y = 1.88;
  g.add(plen);

  for (let i = 0; i < nc; i++) {
    const runner = box(0.20, 0.70, 0.20, M.intake);
    runner.position.set((i - 1) * sp, 1.50, 0);
    g.add(runner);
  }

  const ic = box(nc * sp + 0.1, 0.48, 0.90, M.intake);
  ic.position.set(0, 2.10, 0);
  g.add(ic);

  for (let f = 0; f < 7; f++) {
    const fin = box(nc * sp + 0.1, 0.48, 0.018, M.block);
    fin.position.set(0, 2.10, -0.42 + f * 0.14);
    g.add(fin);
  }

  const icPort = box(0.22, 0.48, 0.12, M.turbo);
  icPort.position.set(nc * sp / 2 + 0.30, 2.10, 0);
  g.add(icPort);

  // ── Turbocharger ──
  const turboG = new THREE.Group();
  turboG.position.set(2.4, 0.15, 0);

  const tHousing  = cyl(0.38, 0.38, 0.24, 22, M.turbo); tHousing.rotation.z  = Math.PI / 2; turboG.add(tHousing);
  const tShroud   = cyl(0.42, 0.38, 0.06, 22, M.turbo); tShroud.rotation.z   = Math.PI / 2; tShroud.position.x = -0.10; turboG.add(tShroud);
  const cHousing  = cyl(0.30, 0.30, 0.20, 22, M.turbo); cHousing.rotation.z  = Math.PI / 2; cHousing.position.x =  0.24; turboG.add(cHousing);
  const cShroud   = cyl(0.34, 0.30, 0.05, 22, M.turbo); cShroud.rotation.z   = Math.PI / 2; cShroud.position.x  =  0.36; turboG.add(cShroud);
  const ctrBrg    = cyl(0.12, 0.12, 0.36, 10, M.crank); ctrBrg.rotation.z    = Math.PI / 2; turboG.add(ctrBrg);
  const tWheel    = cyl(0.32, 0.32, 0.06, 16, M.crank); tWheel.rotation.z    = Math.PI / 2; tWheel.position.x   = -0.04; turboG.add(tWheel);
  const cWheel    = cyl(0.26, 0.26, 0.05, 16, M.piston); cWheel.rotation.z   = Math.PI / 2; cWheel.position.x   =  0.22; turboG.add(cWheel);

  const wgStem    = cyl(0.04, 0.04, 0.20, 8, M.turbo); wgStem.position.set(0.15, 0.50, 0); turboG.add(wgStem);
  const wgAct     = sph(0.07, 8, M.turbo); wgAct.position.set(0.15, 0.62, 0); turboG.add(wgAct);

  const tOut      = cyl(0.10, 0.10, 0.65, 8, M.turbo); tOut.rotation.x = Math.PI / 2; tOut.position.set(0.30, 0.80, 0); turboG.add(tOut);
  g.add(turboG);

  // ── MGU-H (hot side, on turbo shaft) ──
  const mguHG  = new THREE.Group(); mguHG.position.set(2.4, 0.15, 0.55);
  const mguHb  = cyl(0.115, 0.115, 0.28, 8, M.red); mguHb.rotation.z = Math.PI / 2; mguHG.add(mguHb);
  const mguHcp = cyl(0.120, 0.120, 0.04, 8, M.block); mguHcp.rotation.z = Math.PI / 2; mguHcp.position.x = 0.16; mguHG.add(mguHcp);
  g.add(mguHG);

  // ── MGU-K (crank end) ──
  const mguKG  = new THREE.Group(); mguKG.position.set(-1.95, -0.08, 0);
  const mguKb  = box(0.32, 0.38, 0.38, M.cyan); mguKG.add(mguKb);
  const mguKtp = box(0.28, 0.06, 0.34, M.block); mguKtp.position.y = 0.22; mguKG.add(mguKtp);
  g.add(mguKG);

  // ── HV wiring ──
  const hvMats = [M.cyan, M.cyan, M.red];
  for (let w = 0; w < 3; w++) {
    const wire = cyl(0.012, 0.012, 0.80, 4, hvMats[w % 2]);
    wire.rotation.z = Math.PI / 2;
    wire.position.set(-1.50 + w * 0.12, -0.20, w * 0.08 - 0.08);
    g.add(wire);
  }

  // ── Exhaust manifolds ──
  for (let bank = 0; bank < 2; bank++) {
    const s = bank === 0 ? 1 : -1;
    for (let i = 0; i < nc; i++) {
      const em = mkMesh(new THREE.CylinderGeometry(0.078, 0.067, 0.65, 8), exhMat());
      em.position.set((i - 1) * sp, -0.42, s * 0.74);
      em.rotation.x = -s * 0.48;
      g.add(em);
      exhMeshes.push(em);
    }
    const col = mkMesh(
      new THREE.CylinderGeometry(0.12, 0.10, 0.55, 8),
      exhMat(),
    );
    col.position.set(0.6, -0.80, s * 0.92);
    col.rotation.z =  Math.PI / 5 * s;
    col.rotation.x = -s * 0.45;
    g.add(col);
    exhMeshes.push(col);
  }

  return { g, crankG, pistons, exhMeshes, turboG, maxRPM: cfg.maxRPM };
}
