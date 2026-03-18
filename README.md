# Engine Atelier — Precision Powertrain Visualizer

An interactive 3D visualizer for historical motorsport engines. Drag, zoom and inspect real GLB engine models with live telemetry, RPM-driven animation, and a carbon + gold editorial UI.

---

## Getting Started

No build step required. Serve the project root with any static file server:

```bash
# Node
npx serve .

# Python
python -m http.server 3000
```

Then open `http://localhost:3000` in a modern browser (Chrome / Edge recommended — best WebGL performance).

> **Do not open `index.html` directly as a `file://` URL.** ES modules and GLB loading require an HTTP server.

---

## Project Structure

```
├── index.html              Entry point — all markup, CSS, and snapshot logic
├── src/
│   └── main.js             App entry — wires all modules, owns the render loop
├── assets/
│   └── models/
│       ├── v8_engine.glb         V8 engine (rigged, named nodes, embedded animation)
│       └── i4_engine.glb         Inline-4 turbo (rigged, ArmatureAction clip)
├── data/
│   ├── v10Data.js          Ford Cosworth DFV V8 — specs, power curve, crank phases
│   └── v6Data.js           Honda RA168E Inline-4 — specs, turbo power curve
├── engine/
│   ├── engineController.js  Loads/swaps engines, owns AnimationMixer lifecycle
│   ├── loadEngineModel.js   GLB loader (named + unnamed strategies), procedural builders
│   └── pistonAnimation.js   Per-frame animation, mixer speed scaling, render modes
├── scene/
│   ├── setupScene.js        Renderer, scene, ground, resize handler
│   ├── camera.js            Orbit camera with mouse + touch controls
│   └── lighting.js          Key, fill, rim, exhaust glow, ERS glow lights
├── ui/
│   ├── controls.js          RPM slider, play/pause, view mode, tab bindings
│   └── comparisonPanel.js   Live metrics, ERS bars, comparison chart, freq display
└── utils/
    └── mathHelpers.js       clamp, lerp, rpmToRps, pistonOffset, angleToTDC, fmtNum
```

---

## Features

**3D Viewer**
- Orbit with drag, zoom with scroll or pinch
- Solid / Wireframe / X-Ray render modes
- Gold corner bracket framing, carbon-weave canvas background

**Engine Animation**
- GLB models with embedded rigs play via Three.js `AnimationMixer`
- Animation speed scales linearly with the RPM slider
- Root-node rotation (engine spinning around itself) automatically neutralised post-tick

**Live Telemetry**
- Power, torque, thermal efficiency, exhaust temperature — all RPM-derived
- Cylinder firing LEDs sequenced to the correct firing order
- Rev light strip with green → yellow → red → purple segments

**Snapshot**
- Click **CAPTURE** in the header to download a full-resolution PNG
- Composites the WebGL framebuffer + panel silhouettes + gold watermark
- Requires `preserveDrawingBuffer: true` (already set in `setupScene.js`)

---

## Adding a New Engine

1. Drop the `.glb` file into `assets/models/`
2. Duplicate `data/v10Data.js` or `data/v6Data.js` and fill in the specs, power curve, and `crankPhases`
3. In `engine/engineController.js` update `GLB_PATHS` to point to your file
4. Add a tab button in `index.html` with `data-engine="yourId"` and wire it in `src/main.js`

**GLB requirements:**
- Rigged models with an embedded animation clip load automatically via `AnimationMixer` (Strategy A — preferred)
- Unrigged models fall back to geometric piston detection (Strategy B — less accurate)
- Name your nodes anything containing `piston`, `crank`, `shaft`, `biel`, or `cig` for automatic detection

---

## Tech Stack

| Layer | Library |
|---|---|
| 3D rendering | Three.js r128 (CDN) |
| Model loading | `GLTFLoader` (Three.js JSM) |
| Fonts | Syne, Space Mono, DM Sans (Google Fonts) |
| Build | None — vanilla ES modules with an importmap |

---

## Browser Support

Chrome 89+, Edge 89+, Firefox 90+, Safari 15.4+. Requires WebGL 2 and ES module support.