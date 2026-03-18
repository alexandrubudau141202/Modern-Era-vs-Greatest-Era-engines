import * as THREE from 'three';
import { GLTFLoader } from 'https://esm.sh/three@0.128.0/examples/jsm/loaders/GLTFLoader.js';

const _loader = new GLTFLoader();

// ─────────────────────────────────────────────────────────────────────────────
//  Strategy A — GLB with NAMED nodes + embedded animation
//  e.g. v8_engine.glb  (Piston1_42, FlyWheel_3, Animation clip)
//  We just play the AnimationMixer and scale timeScale by RPM.
// ─────────────────────────────────────────────────────────────────────────────
function setupNamedGLB(gltf, maxRPM) {
  const g = gltf.scene;

  // Scale to ~4-unit bounding box and centre
  fitAndCentre(g);

  g.traverse((c) => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });

  // AnimationMixer — play all clips, speed controlled externally via timeScale
  const mixer = new THREE.AnimationMixer(g);
  gltf.animations.forEach((clip) => {
    const action = mixer.clipAction(clip);
    action.play();
  });

  // Find piston nodes by name for firing-LED display only
  const pistons = [];
  g.traverse((child) => {
    if (/piston/i.test(child.name) && child.isMesh) {
      pistons.push({ pist: child, rod: null, phase: pistons.length / 8 * Math.PI * 2 });
    }
  });

  // Crankshaft / flywheel — not manually rotated (animation handles it)
  const crankG = new THREE.Group();

  // The animation clip drives V8_Engine_0's rotation, spinning the whole
  // engine around itself. Find that node so stepMixer can zero it each tick.
  let animRootNode = null;
  g.traverse((child) => {
    if (!child.isMesh && /V8_Engine|V8Engine/i.test(child.name)) {
      animRootNode = child;
    }
  });

  return { g, crankG, pistons, exhMeshes: [], mixer, animRootNode, maxRPM, isGLB: true, usesAnimationMixer: true };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Strategy B — GLB with NO named nodes, NO animation
//  e.g. v8_engine_internals.glb  (378 New_Game_Object meshes)
//  We detect parts geometrically and manually drive positions.
// ─────────────────────────────────────────────────────────────────────────────
function setupUnnamedGLB(gltf, maxRPM, cylCount) {
  const g = gltf.scene;
  fitAndCentre(g);
  g.traverse((c) => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });

  // Must update matrices BEFORE computing world bounding boxes —
  // g isn't in the scene yet so scale/position haven't propagated.
  g.updateMatrixWorld(true);

  const stats = collectMeshStats(g);
  const { crankObj, pistonObjs } = detectParts(stats, cylCount);

  console.info(`[GLB] crankshaft: ${crankObj?.name || '(unnamed)'} | pistons found: ${pistonObjs.length}`);

  const pistons = (crankObj && pistonObjs.length > 0)
    ? buildPistonDescriptors(pistonObjs, crankObj)
    : [];

  // ── Crankshaft pivot: re-parent mesh into a Group at its centre ──────────
  let crankG = new THREE.Group();
  if (crankObj) {
    const crankCtr = new THREE.Vector3();
    new THREE.Box3().setFromObject(crankObj).getCenter(crankCtr);
    crankG.position.copy(crankCtr);
    const oldParent = crankObj.parent;
    crankG.attach(crankObj);   // preserves world transform, local pos = world - pivot
    if (oldParent) oldParent.add(crankG);
  }

  return { g, crankG, pistons, exhMeshes: [], mixer: null, maxRPM, isGLB: true, usesAnimationMixer: false };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Public loader — picks strategy automatically
// ─────────────────────────────────────────────────────────────────────────────
export function loadGLBModel(path, maxRPM = 19000, cylCount = 8) {
  return new Promise((resolve, reject) => {
    _loader.load(path, (gltf) => {
      const hasAnimation  = gltf.animations?.length > 0;
      const hasNamedNodes = gltf.scene.getObjectByName !== undefined &&
        (() => { let found = false; gltf.scene.traverse(c => { if (/piston|crank|shaft|pist|biel|cig/i.test(c.name)) found = true; }); return found; })();

      const result = (hasAnimation && hasNamedNodes)
        ? setupNamedGLB(gltf, maxRPM)
        : setupUnnamedGLB(gltf, maxRPM, cylCount);

      resolve(result);
    }, undefined, reject);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────
function fitAndCentre(g) {
  const box  = new THREE.Box3().setFromObject(g);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim > 0) g.scale.setScalar(4 / maxDim);
  box.setFromObject(g);
  const centre = new THREE.Vector3();
  box.getCenter(centre);
  g.position.sub(centre);
}

function collectMeshStats(root) {
  const out = [];
  root.traverse((child) => {
    if (!child.isMesh) return;
    const box    = new THREE.Box3().setFromObject(child);
    const size   = new THREE.Vector3();
    const centre = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(centre);
    out.push({ obj: child, size, centre, vol: size.x * size.y * size.z });
  });
  return out.sort((a, b) => b.vol - a.vol);
}

function detectParts(stats, cylCount) {
  // Crankshaft = highest elongation ratio in top-30 meshes
  let crankObj = null, bestE = 0;
  for (const s of stats.slice(0, 30)) {
    const { x, y, z } = s.size;
    const e = Math.max(x, y, z) / (Math.min(x, y, z) + 0.001);
    if (e > bestE) { bestE = e; crankObj = s.obj; }
  }

  // Pistons = cylCount meshes of similar compact volume
  const pool = stats.filter((s) => {
    const e = Math.max(s.size.x, s.size.y, s.size.z) / (Math.min(s.size.x, s.size.y, s.size.z) + 0.001);
    return e < 3 && s.obj !== crankObj;
  });

  let bestGroup = [];
  const seen = new Set();
  for (const a of pool) {
    if (seen.has(a)) continue;
    const g = pool.filter((b) => !seen.has(b) && Math.abs(b.vol - a.vol) / a.vol < 0.20);
    if (g.length >= cylCount && g.length > bestGroup.length) bestGroup = g;
  }

  const pistonObjs = bestGroup
    .sort((a, b) => a.centre.z - b.centre.z)
    .slice(0, cylCount)
    .map((s) => s.obj);

  return { crankObj, pistonObjs };
}

/**
 * Build piston descriptors in LOCAL space.
 *
 * Stores the rest local position and the travel axis as a LOCAL-space direction
 * (not a world position) so pistonAnimation.js can do a simple:
 *   pist.position = baseLocalPos + localAxis * offset
 * with no coordinate-system conversion needed at runtime.
 */
function buildPistonDescriptors(pistonObjs, crankObj) {
  const crankCtr = new THREE.Vector3();
  new THREE.Box3().setFromObject(crankObj).getCenter(crankCtr);

  const byBank = { left: [], right: [] };
  pistonObjs.forEach((mesh) => {
    const wpos = new THREE.Vector3();
    mesh.getWorldPosition(wpos);
    (wpos.x <= crankCtr.x ? byBank.left : byBank.right).push({ mesh, wpos });
  });

  byBank.left.sort( (a, b) => a.wpos.z - b.wpos.z);
  byBank.right.sort((a, b) => a.wpos.z - b.wpos.z);

  const leftPhases  = [0,              Math.PI,       Math.PI * 0.5, Math.PI * 1.5];
  const rightPhases = [Math.PI * 0.25, Math.PI * 1.25, Math.PI * 0.75, Math.PI * 1.75];

  const descriptors = [];
  const addBank = (bank, phases) => {
    bank.forEach(({ mesh, wpos }, idx) => {
      // Rest position in parent-LOCAL space (original GLB units, large numbers e.g. ±20)
      const baseLocalPos = mesh.position.clone();

      // Convert the crank centre from world space into the same parent-local space.
      // worldToLocal is correct for POINTS — gives us a local-space crank centre.
      const crankLocalCtr = new THREE.Vector3();
      if (mesh.parent) {
        mesh.parent.updateMatrixWorld(true);
        mesh.parent.worldToLocal(crankLocalCtr.copy(crankCtr));
      } else {
        crankLocalCtr.copy(crankCtr);
      }

      // Travel axis in LOCAL space: radially outward from crank on XY plane.
      // Everything is now in the same (local) coordinate system.
      const localAxis = new THREE.Vector3(
        baseLocalPos.x - crankLocalCtr.x,
        baseLocalPos.y - crankLocalCtr.y,
        0,
      ).normalize();

      // Stroke in LOCAL space units: 15% of radial distance (also local).
      const localRadialDist = new THREE.Vector3(
        baseLocalPos.x - crankLocalCtr.x,
        baseLocalPos.y - crankLocalCtr.y,
        0,
      ).length();
      const stk = localRadialDist * 0.15;

      descriptors.push({
        pist: mesh,
        rod:  null,
        baseLocalPos,
        localAxis,
        stk,
        phase: phases[idx] ?? (idx / bank.length) * Math.PI * 2,
      });
    });
  };
  addBank(byBank.left,  leftPhases);
  addBank(byBank.right, rightPhases);
  return descriptors;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Shared material factory
// ─────────────────────────────────────────────────────────────────────────────
function mat(color, roughness, metalness, emissive = 0x000000, emI = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity: emI });
}
const M = {
  block:  mat(0x1a1a22, 0.52, 0.96), head:   mat(0x1e1e28, 0.48, 0.90),
  piston: mat(0x909090, 0.22, 0.98), crank:  mat(0x303038, 0.18, 1.00),
  intake: mat(0x202030, 0.55, 0.72), turbo:  mat(0x484848, 0.14, 1.00),
  red:    mat(0xe10600, 0.38, 0.55, 0xe10600, 0.50),
  cyan:   mat(0x00aacc, 0.35, 0.55, 0x00aacc, 0.45),
  oil:    mat(0x0c0c14, 0.85, 0.18), brass:  mat(0xc08820, 0.32, 0.88),
};
function mkMesh(geo, m, cast = true) { const o = new THREE.Mesh(geo, m); o.castShadow = cast; o.receiveShadow = true; return o; }
const box = (w,h,d,m)      => mkMesh(new THREE.BoxGeometry(w,h,d), m);
const cyl = (rt,rb,h,s,m)  => mkMesh(new THREE.CylinderGeometry(rt,rb,h,s), m);
const sph = (r,s,m)        => mkMesh(new THREE.SphereGeometry(r,s,s), m);
function exhMat() { return new THREE.MeshStandardMaterial({ color:0x503020, roughness:0.40, metalness:0.82, emissive:0x000000, emissiveIntensity:0 }); }

// ─────────────────────────────────────────────────────────────────────────────
//  V10 procedural builder
// ─────────────────────────────────────────────────────────────────────────────
export function buildV10(cfg) {
  const g = new THREE.Group(), pistons = [], exhMeshes = [];
  const { cylCount: nc, cylSpacing: sp, bankAngle: bAng, bore, stroke: stk, cylHeight: cylH } = cfg.geometry;
  const phases = cfg.crankPhases;

  box(nc*sp+0.6,0.40,1.30,M.oil).position.y=-0.52;   g.add(g.children[g.children.length] || (() => { const m=box(nc*sp+0.6,0.40,1.30,M.oil); m.position.y=-0.52; g.add(m); return m; })());
  // (using direct adds below for clarity)
  g.children.length = 0;
  const op=box(nc*sp+0.6,0.40,1.30,M.oil);   op.position.y=-0.52; g.add(op);
  const lb=box(nc*sp+0.4,0.32,1.18,M.block); lb.position.y=-0.20; g.add(lb);

  const crankG=new THREE.Group();
  const jrn=cyl(0.075,0.075,nc*sp+0.3,10,M.crank); jrn.rotation.z=Math.PI/2; crankG.add(jrn);
  for(let i=0;i<nc;i++){
    const t=box(0.09,0.27,0.13,M.crank); t.position.set((i-2)*sp,0.12,0); crankG.add(t);
    const p=cyl(0.04,0.04,0.12,8,M.crank); p.rotation.z=Math.PI/2; p.position.set((i-2)*sp,0.24,0); crankG.add(p);
  }
  g.add(crankG);

  for(let bank=0;bank<2;bank++){
    const s=bank===0?1:-1, bg=new THREE.Group(); bg.rotation.x=s*bAng;
    const rail=box(nc*sp+0.22,0.28,0.90,M.block); rail.position.y=0.22; bg.add(rail);
    for(let i=0;i<nc;i++){
      const cx=(i-2)*sp, cg=new THREE.Group(); cg.position.x=cx;
      const bm=cyl(bore,bore,cylH,16,M.block); bm.position.y=cylH/2+0.36; cg.add(bm);
      const hm=cyl(bore+0.065,bore+0.065,0.19,16,M.head); hm.position.y=cylH+0.46; cg.add(hm);
      const vc=box(0.58,0.11,0.58,M.head); vc.position.y=cylH+0.62; cg.add(vc);
      const sp2=cyl(0.03,0.03,0.12,6,M.brass); sp2.position.y=cylH+0.75; cg.add(sp2);
      for(let f=0;f<4;f++){const fin=box(0.58,0.015,0.022,M.block); fin.position.set(0,cylH+0.58,-0.15+f*0.1); cg.add(fin);}
      const pist=cyl(bore-0.04,bore-0.04,0.23,16,M.piston); const baseY=0.46; pist.position.y=baseY; cg.add(pist);
      const wp=cyl(0.025,0.025,0.38,8,M.crank); wp.rotation.z=Math.PI/2; wp.position.y=baseY+0.04; cg.add(wp);
      const rod=box(0.04,0.58,0.07,M.crank); rod.position.y=0.22; cg.add(rod);
      pistons.push({pist,rod,baseY,stk,phase:phases[bank*nc+i]});
      bg.add(cg);
    }
    g.add(bg);
  }
  const plen=box(nc*sp+0.2,0.25,0.42,M.intake); plen.position.y=1.82; g.add(plen);
  for(let i=0;i<nc;i++){
    const tr=cyl(0.13,0.08,0.52,10,M.intake); tr.position.set((i-2)*sp,2.14,0); g.add(tr);
    const bell=cyl(0.18,0.13,0.10,10,M.intake); bell.position.set((i-2)*sp,2.42,0); g.add(bell);
  }
  for(let bank=0;bank<2;bank++){
    const s=bank===0?1:-1;
    for(let i=0;i<nc;i++){
      const em=mkMesh(new THREE.CylinderGeometry(0.07,0.06,0.72,8),exhMat()); em.position.set((i-2)*sp,-0.50,s*0.70); em.rotation.x=-s*0.42; g.add(em); exhMeshes.push(em);
    }
    const col=mkMesh(new THREE.CylinderGeometry(0.11,0.09,0.50,8),exhMat()); col.position.set(0,-0.85,s*0.90); col.rotation.x=-s*0.50; g.add(col); exhMeshes.push(col);
  }
  return {g,crankG,pistons,exhMeshes,maxRPM:cfg.maxRPM};
}

// ─────────────────────────────────────────────────────────────────────────────
//  V6 Turbo Hybrid procedural builder
// ─────────────────────────────────────────────────────────────────────────────
export function buildV6(cfg) {
  const g=new THREE.Group(), pistons=[], exhMeshes=[];
  const {cylCount:nc,cylSpacing:sp,bankAngle:bAng,bore,stroke:stk,cylHeight:cylH}=cfg.geometry;
  const phases=cfg.crankPhases;
  const op=box(nc*sp+0.8,0.44,1.44,M.oil); op.position.y=-0.58; g.add(op);
  const lb=box(nc*sp+0.6,0.36,1.32,M.block); lb.position.y=-0.22; g.add(lb);
  const crankG=new THREE.Group();
  const jrn=cyl(0.09,0.09,nc*sp+0.45,10,M.crank); jrn.rotation.z=Math.PI/2; crankG.add(jrn);
  for(let i=0;i<nc;i++){
    const t=box(0.11,0.30,0.15,M.crank); t.position.set((i-1)*sp,0.13,0); crankG.add(t);
    const p=cyl(0.05,0.05,0.14,8,M.crank); p.rotation.z=Math.PI/2; p.position.set((i-1)*sp,0.26,0); crankG.add(p);
  }
  g.add(crankG);
  for(let bank=0;bank<2;bank++){
    const s=bank===0?1:-1,bg=new THREE.Group(); bg.rotation.x=s*bAng;
    const rail=box(nc*sp+0.32,0.32,0.95,M.block); rail.position.y=0.26; bg.add(rail);
    for(let i=0;i<nc;i++){
      const cx=(i-1)*sp,cg=new THREE.Group(); cg.position.x=cx;
      const bm=cyl(bore,bore,cylH,16,M.block); bm.position.y=cylH/2+0.38; cg.add(bm);
      const hm=cyl(bore+0.08,bore+0.08,0.22,16,M.head); hm.position.y=cylH+0.50; cg.add(hm);
      const vc=box(0.70,0.14,0.70,M.head); vc.position.y=cylH+0.68; cg.add(vc);
      const coil=cyl(0.065,0.055,0.18,8,M.block); coil.position.y=cylH+0.82; cg.add(coil);
      const inj=cyl(0.022,0.022,0.14,6,M.brass); inj.position.set(0.20,cylH+0.62,0.12); cg.add(inj);
      const pist=cyl(bore-0.04,bore-0.04,0.26,16,M.piston); const baseY=0.50; pist.position.y=baseY; cg.add(pist);
      const wp=cyl(0.028,0.028,0.40,8,M.crank); wp.rotation.z=Math.PI/2; wp.position.y=baseY+0.04; cg.add(wp);
      const rod=box(0.05,0.62,0.09,M.crank); rod.position.y=0.24; cg.add(rod);
      pistons.push({pist,rod,baseY,stk,phase:phases[bank*nc+i]});
      bg.add(cg);
    }
    g.add(bg);
  }
  const plen=box(nc*sp+0.1,0.32,0.45,M.intake); plen.position.y=1.88; g.add(plen);
  for(let i=0;i<nc;i++){const runner=box(0.20,0.70,0.20,M.intake); runner.position.set((i-1)*sp,1.50,0); g.add(runner);}
  const ic=box(nc*sp+0.1,0.48,0.90,M.intake); ic.position.set(0,2.10,0); g.add(ic);
  for(let f=0;f<7;f++){const fin=box(nc*sp+0.1,0.48,0.018,M.block); fin.position.set(0,2.10,-0.42+f*0.14); g.add(fin);}
  const icPort=box(0.22,0.48,0.12,M.turbo); icPort.position.set(nc*sp/2+0.30,2.10,0); g.add(icPort);
  const turboG=new THREE.Group(); turboG.position.set(2.4,0.15,0);
  [[cyl(0.38,0.38,0.24,22,M.turbo),0,0],[cyl(0.42,0.38,0.06,22,M.turbo),-0.10,0],[cyl(0.30,0.30,0.20,22,M.turbo),0.24,0],[cyl(0.34,0.30,0.05,22,M.turbo),0.36,0],[cyl(0.12,0.12,0.36,10,M.crank),0,0],[cyl(0.32,0.32,0.06,16,M.crank),-0.04,0],[cyl(0.26,0.26,0.05,16,M.piston),0.22,0]].forEach(([m,x])=>{m.rotation.z=Math.PI/2;m.position.x=x;turboG.add(m);});
  const wgS=cyl(0.04,0.04,0.20,8,M.turbo); wgS.position.set(0.15,0.50,0); turboG.add(wgS);
  turboG.add(sph(0.07,8,M.turbo)).position.set(0.15,0.62,0);
  const tOut=cyl(0.10,0.10,0.65,8,M.turbo); tOut.rotation.x=Math.PI/2; tOut.position.set(0.30,0.80,0); turboG.add(tOut);
  g.add(turboG);
  const mguHG=new THREE.Group(); mguHG.position.set(2.4,0.15,0.55);
  const mguHb=cyl(0.115,0.115,0.28,8,M.red); mguHb.rotation.z=Math.PI/2; mguHG.add(mguHb);
  const mguHcp=cyl(0.120,0.120,0.04,8,M.block); mguHcp.rotation.z=Math.PI/2; mguHcp.position.x=0.16; mguHG.add(mguHcp);
  g.add(mguHG);
  const mguKG=new THREE.Group(); mguKG.position.set(-1.95,-0.08,0);
  mguKG.add(box(0.32,0.38,0.38,M.cyan));
  const mguKtp=box(0.28,0.06,0.34,M.block); mguKtp.position.y=0.22; mguKG.add(mguKtp);
  g.add(mguKG);
  for(let w=0;w<3;w++){const wire=cyl(0.012,0.012,0.80,4,[M.cyan,M.cyan,M.red][w%2]); wire.rotation.z=Math.PI/2; wire.position.set(-1.50+w*0.12,-0.20,w*0.08-0.08); g.add(wire);}
  for(let bank=0;bank<2;bank++){
    const s=bank===0?1:-1;
    for(let i=0;i<nc;i++){const em=mkMesh(new THREE.CylinderGeometry(0.078,0.067,0.65,8),exhMat()); em.position.set((i-1)*sp,-0.42,s*0.74); em.rotation.x=-s*0.48; g.add(em); exhMeshes.push(em);}
    const col=mkMesh(new THREE.CylinderGeometry(0.12,0.10,0.55,8),exhMat()); col.position.set(0.6,-0.80,s*0.92); col.rotation.z=Math.PI/5*s; col.rotation.x=-s*0.45; g.add(col); exhMeshes.push(col);
  }
  return {g,crankG,pistons,exhMeshes,turboG,maxRPM:cfg.maxRPM};
}