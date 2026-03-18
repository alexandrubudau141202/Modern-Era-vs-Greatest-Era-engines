import { fmtNum } from '../utils/mathHelpers.js';

/**
 * Wires up all interactive UI controls.
 *
 * @param {object} opts
 * @param {function(string): void}  opts.onEngineSwitch   Called with 'v10' or 'v6'
 * @param {function(number): void}  opts.onRPMChange      Called with new RPM value
 * @param {function(): void}        opts.onTogglePlay      Toggle play/pause
 * @param {function(): void}        opts.onResetCamera     Reset orbit camera
 * @param {function(string): void}  opts.onViewMode       Called with 'solid'|'wire'|'xray'
 * @param {number}                  opts.initialRPM
 */
export function bindControls(opts) {
  // ── Engine tabs ──────────────────────────────────────────────────────
  document.querySelectorAll('.etab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.engine;
      if (type) opts.onEngineSwitch(type);
    });
  });

  // ── RPM slider ────────────────────────────────────────────────────────
  const rpmSlider = document.getElementById('rpmSlider');
  if (rpmSlider) {
    rpmSlider.addEventListener('input', () => {
      opts.onRPMChange(parseInt(rpmSlider.value, 10));
    });
  }

  // ── RPM preset buttons ───────────────────────────────────────────────
  document.querySelectorAll('[data-rpm]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const v = btn.dataset.rpm;
      opts.onRPMChange(v === 'max' ? Infinity : parseInt(v, 10));
    });
  });

  // ── Play / Pause ──────────────────────────────────────────────────────
  const playBtn = document.getElementById('playBtn');
  if (playBtn) {
    playBtn.addEventListener('click', () => {
      opts.onTogglePlay();
    });
  }

  // ── Reset camera ──────────────────────────────────────────────────────
  const resetBtn = document.getElementById('resetCamBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => opts.onResetCamera());
  }

  // ── View mode ─────────────────────────────────────────────────────────
  document.querySelectorAll('[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-view]').forEach((b) => b.classList.remove('on'));
      btn.classList.add('on');
      opts.onViewMode(btn.dataset.view);
    });
  });
}

// ────────────────────────────────────────────────────────────────────────────
//  DOM update helpers — called from the render loop
// ────────────────────────────────────────────────────────────────────────────

/**
 * Sync the RPM slider range and label to the current engine's maxRPM.
 * @param {number} rpm
 * @param {number} maxRPM
 */
export function syncRPMSlider(rpm, maxRPM) {
  const sl = document.getElementById('rpmSlider');
  if (sl) { sl.max = maxRPM; sl.value = rpm; }

  const lbl = document.getElementById('rpmCtrlVal');
  if (lbl) lbl.textContent = fmtNum(rpm) + ' RPM';
}

/**
 * Update the large central RPM readout and rev-light strip.
 * @param {number} rpm
 * @param {number} maxRPM
 */
export function updateRPMDisplay(rpm, maxRPM) {
  const el = document.getElementById('rpmBig');
  if (el) el.textContent = fmtNum(rpm);

  const n    = (rpm - 800) / (maxRPM - 800);
  const segs = document.querySelectorAll('.revseg');
  segs.forEach((s, i) => {
    const t = (i + 1) / segs.length;
    s.style.opacity    = t <= n ? '1' : '0.1';
    s.style.boxShadow  = t <= n && t > 0.93 ? '0 0 6px #AA00FF'
                       : t <= n && t > 0.80 ? '0 0 5px #E10600'
                       : 'none';
  });
}

/**
 * Sync the play button label and active state.
 * @param {boolean} playing
 */
export function syncPlayButton(playing) {
  const btn = document.getElementById('playBtn');
  if (!btn) return;
  btn.textContent = playing ? '⏸ PAUSE' : '▶ PLAY';
  btn.classList.toggle('on', playing);
}

/**
 * Sync engine tab highlights.
 * @param {'v10'|'v6'} type
 */
export function syncEngineTabs(type) {
  document.querySelectorAll('.etab').forEach((btn) => {
    btn.classList.toggle('on', btn.dataset.engine === type);
  });
}
