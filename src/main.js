import * as THREE from 'three';

import { v10Data } from '../data/v10Data.js';
import { v6Data  } from '../data/v6Data.js';

import { setupScene, resizeIfNeeded } from '../scene/setupScene.js';
import { createCamera               } from '../scene/camera.js';
import { addLights                  } from '../scene/lighting.js';

import { EngineController    } from '../engine/engineController.js';
import { stepEngineAnimation } from '../engine/pistonAnimation.js';
import { updateFiringLEDs    } from '../engine/pistonAnimation.js';

import {
  bindControls,
  syncRPMSlider,
  updateRPMDisplay,
  syncPlayButton,
  syncEngineTabs,
} from '../ui/controls.js';

import {
  buildComparisonPanel,
  buildSpecsTable,
  buildFireLEDs,
  buildRevBar,
  buildFreqBars,
  updateMetrics,
  syncERSBlock,
} from '../ui/comparisonPanel.js';

import { clamp, fmtNum } from '../utils/mathHelpers.js';

// ────────────────────────────────────────────────────────────────────────────
//  Bootstrap
// ────────────────────────────────────────────────────────────────────────────
const canvas = document.getElementById('ec');

const { renderer, scene    } = setupScene(canvas);
const { camera, resetCamera } = createCamera(canvas);
const { exhaustLight, ersLight } = addLights(scene);

const engineCtrl = new EngineController(scene);

// ── App state ──────────────────────────────────────────────────────────────
let eng      = null;
let rpm      = 8000;
let playing  = true;
let crankAng = 0;

// FPS bookkeeping
let frameCount = 0;
let fpsTimer   = 0;
let fpsSmooth  = 60;

// ── Internal helpers ───────────────────────────────────────────────────────
function setEngineUI(cfg) {
  const el = (id) => document.getElementById(id);
  if (el('engName'))    el('engName').textContent    = cfg.name;
  if (el('engSub'))     el('engSub').textContent     = cfg.sub;
  if (el('cornerId'))   el('cornerId').textContent   = cfg.cornerId;
  if (el('acousticDesc')) el('acousticDesc').textContent = cfg.acoustic;
  if (el('engNotes'))   el('engNotes').textContent   = cfg.notes;
  if (el('fireOrder'))  el('fireOrder').textContent  = 'ORDER: ' + cfg.firingOrder.join('-');
}

async function loadEngine(type) {
  eng       = await engineCtrl.load(type);
  crankAng  = 0;

  const cfg = engineCtrl.config;

  // Clamp & sync RPM to new engine's limit
  rpm = clamp(rpm, 800, cfg.maxRPM);
  syncRPMSlider(rpm, cfg.maxRPM);
  syncEngineTabs(type);
  syncERSBlock(engineCtrl.isHybrid);

  setEngineUI(cfg);
  buildFireLEDs(cfg.cyls);
  buildSpecsTable(cfg.specs);
  buildRevBar(cfg.maxRPM);
  buildComparisonPanel();
  buildFreqBars();
}

// ── Control callbacks ──────────────────────────────────────────────────────
bindControls({
  onEngineSwitch: (type) => loadEngine(type),

  onRPMChange: (val) => {
    rpm = clamp(val === Infinity ? engineCtrl.config.maxRPM : val, 800, engineCtrl.config.maxRPM);
    syncRPMSlider(rpm, engineCtrl.config.maxRPM);
  },

  onTogglePlay: () => {
    playing = !playing;
    syncPlayButton(playing);
  },

  onResetCamera: resetCamera,

  onViewMode: (mode) => engineCtrl.setRenderMode(mode),
});

// ── Render loop ────────────────────────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  resizeIfNeeded(renderer, camera);

  const dt = Math.min(clock.getDelta(), 0.05);

  // FPS counter
  frameCount++;
  fpsTimer += dt;
  if (fpsTimer >= 0.5) {
    fpsSmooth = Math.round(frameCount / fpsTimer);
    const fpsEl = document.getElementById('fpsLabel');
    if (fpsEl) fpsEl.textContent = fpsSmooth + ' FPS';
    frameCount = 0;
    fpsTimer   = 0;
  }

  // Engine animation
  if (playing && eng) {
    crankAng = stepEngineAnimation(eng, rpm, dt, { exhaustLight, ersLight }, engineCtrl.isHybrid, crankAng);
    engineCtrl.updateMixer(dt);  // advances GLB embedded animations

    // Firing LEDs (update every 4th frame for perf)
    if (Math.round(crankAng * 10) % 4 === 0) {
      updateFiringLEDs(eng, crankAng, engineCtrl.config.cyls);
    }
  }

  // Camera
  camera.update();

  // Data panel
  updateRPMDisplay(rpm, engineCtrl.config.maxRPM);
  updateMetrics(engineCtrl.engineType, rpm, engineCtrl.config.maxRPM);

  renderer.render(scene, camera);
}

// ── Init ───────────────────────────────────────────────────────────────────
loadEngine('v10');
animate();
