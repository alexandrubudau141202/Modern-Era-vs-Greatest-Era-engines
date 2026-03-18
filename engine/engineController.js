import * as THREE from 'three';
import { v10Data } from '../data/v10Data.js';
import { v6Data  } from '../data/v6Data.js';
import { buildV10, buildV6, loadGLBModel } from './loadEngineModel.js';
import { applyRenderMode, stepMixer } from './pistonAnimation.js';

const GLB_PATHS = {
  v10: './assets/models/v8_engine_internals.glb',  // 378 separate meshes, geometry detection
  v6:  './assets/models/i4_engine.glb',            // named nodes + embedded animation clip
};

export class EngineController {
  constructor(scene) {
    this.scene      = scene;
    this.current    = null;
    this.engineType = null;
    this.renderMode = 'solid';
  }

  async load(type, onReady) {
    if (this.current) { this.scene.remove(this.current.g); this.current = null; }

    this.engineType = type;
    const cfg     = type === 'v10' ? v10Data : v6Data;
    const glbPath = GLB_PATHS[type];
    let engine;

    if (glbPath) {
      try {
        engine = await loadGLBModel(glbPath, cfg.maxRPM, cfg.cyls);
        console.info('[EngineController] Loaded GLB:', glbPath);
      } catch (err) {
        console.warn('[EngineController] GLB failed, using procedural fallback.', err);
        engine = null;
      }
    }

    if (!engine) {
      engine = type === 'v10' ? buildV10(cfg) : buildV6(cfg);
      console.info('[EngineController] Using procedural geometry for', type);
    }

    engine.g.position.y = 0.18;
    this.scene.add(engine.g);
    this.current = engine;

    applyRenderMode(engine.g, this.renderMode);
    if (onReady) onReady(engine);
    return engine;
  }

  /** Call every frame — advances AnimationMixer for GLBs that have one. */
  updateMixer(rpm, dt) {
    if (this.current) stepMixer(this.current.mixer, rpm, this.config.maxRPM, dt, this.current.animRootNode);
  }

  setRenderMode(mode) {
    this.renderMode = mode;
    if (this.current) applyRenderMode(this.current.g, mode);
  }

  get config()   { return this.engineType === 'v10' ? v10Data : v6Data; }
  get isHybrid() { return this.engineType === 'v6'; }
}