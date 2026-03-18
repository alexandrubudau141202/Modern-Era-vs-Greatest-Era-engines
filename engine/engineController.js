import * as THREE from 'three';
import { v10Data } from '../data/v10Data.js';
import { v6Data  } from '../data/v6Data.js';
import { buildV10, buildV6, loadGLBModel } from './loadEngineModel.js';
import { applyRenderMode } from './pistonAnimation.js';

// ── Map engine type → GLB path (set to null to use procedural geometry) ──────
const GLB_PATHS = {
  v10: './assets/models/engine.glb',
  v6:  './assets/models/v8_engine_internals.glb',
};

/**
 * EngineController owns the current engine mesh in the scene.
 * Tries GLB files first; falls back to procedural geometry if unavailable.
 */
export class EngineController {
  constructor(scene) {
    this.scene      = scene;
    this.current    = null;
    this.engineType = null;
    this.renderMode = 'solid';
    this._mixer     = null;
  }

  /**
   * Load (or swap) an engine. Async — awaits GLB if configured.
   * @param {'v10'|'v6'} type
   * @param {function} [onReady]
   */
  async load(type, onReady) {
    if (this.current) {
      this.scene.remove(this.current.g);
      this.current = null;
      this._mixer  = null;
    }

    this.engineType = type;
    const cfg     = type === 'v10' ? v10Data : v6Data;
    const glbPath = GLB_PATHS[type];
    let engine;

    if (glbPath) {
      try {
        engine = await loadGLBModel(glbPath, cfg.maxRPM);
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
    this._mixer  = engine.mixer || null;

    applyRenderMode(engine.g, this.renderMode);
    if (onReady) onReady(engine);
    return engine;
  }

  /** Advance GLB AnimationMixer — call every frame. */
  updateMixer(dt) {
    if (this._mixer) this._mixer.update(dt);
  }

  setRenderMode(mode) {
    this.renderMode = mode;
    if (this.current) applyRenderMode(this.current.g, mode);
  }

  get config()   { return this.engineType === 'v10' ? v10Data : v6Data; }
  get isHybrid() { return this.engineType === 'v6'; }
}
