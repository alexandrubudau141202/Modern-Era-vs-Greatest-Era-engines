import { getV10Metrics } from '../data/v10Data.js';
import { getV6Metrics  } from '../data/v6Data.js';

// ── Static comparison data (V10 vs V6) ──────────────────────────────────────
const CMP_ROWS = [
  { lbl: 'MAX POWER',    v10: '900 HP',  v6: '1000+ HP', v10p: 90,  v6p: 100 },
  { lbl: 'MAX RPM',      v10: '19,000',  v6: '15,000',   v10p: 100, v6p: 79  },
  { lbl: 'EFFICIENCY',   v10: '~28%',    v6: '~52%',     v10p: 28,  v6p: 52  },
  { lbl: 'DISPLACEMENT', v10: '3.0L',    v6: '1.6L',     v10p: 100, v6p: 53  },
];

// ── One-time builders ────────────────────────────────────────────────────────

/** Render the era comparison bars (static, call once per engine switch). */
export function buildComparisonPanel() {
  const el = document.getElementById('cmpPanel');
  if (!el) return;
  el.innerHTML = CMP_ROWS.map((c) => `
    <div class="cmprow">
      <div class="cmplbl">${c.lbl}</div>
      <div class="cmpbar-wrap">
        <div class="cmpbar-bg">
          <div class="cmpbar-fill" style="background:var(--gold);width:${c.v10p}%"></div>
        </div>
        <div class="cmpval" style="color:var(--gold)">${c.v10}</div>
      </div>
      <div class="cmpbar-wrap">
        <div class="cmpbar-bg">
          <div class="cmpbar-fill" style="background:var(--bronze);width:${c.v6p}%"></div>
        </div>
        <div class="cmpval" style="color:var(--bronze)">${c.v6}</div>
      </div>
    </div>`).join('');
}

/** Render the specs table (call once per engine switch).
 * @param {Array<[string,string]>} specs
 */
export function buildSpecsTable(specs) {
  const el = document.getElementById('specsTable');
  if (!el) return;
  el.innerHTML = specs.map(([k, v]) =>
    `<div class="srow"><span class="sk">${k}</span><span class="sv">${v}</span></div>`
  ).join('');
}

/** Render the cylinder firing LED placeholders (call once per engine switch).
 * @param {number} cylCount
 */
export function buildFireLEDs(cylCount) {
  const el = document.getElementById('fireLEDs');
  if (!el) return;
  el.innerHTML = '';
  for (let i = 1; i <= cylCount; i++) {
    const d = document.createElement('div');
    d.className = 'cyl-led';
    d.id        = 'led' + i;
    d.textContent = i;
    el.appendChild(d);
  }
}

/** Render the rev-light strip (call once per engine switch).
 * @param {number} _maxRPM  (unused, reserved for future colour calibration)
 */
export function buildRevBar(_maxRPM) {
  const el = document.getElementById('revbar');
  if (!el) return;
  el.innerHTML = '';
  const n = 22;
  for (let i = 0; i < n; i++) {
    const p   = (i + 1) / n;
    const col = p < 0.65 ? '#e8e8e8' : p < 0.80 ? '#FFD600' : p < 0.93 ? '#E10600' : '#AA00FF';
    const seg = document.createElement('div');
    seg.className    = 'revseg';
    seg.style.background = col;
    seg.style.opacity    = '0.12';
    el.appendChild(seg);
  }
}

/** Render the frequency bars skeleton (call once per engine switch). */
export function buildFreqBars() {
  const el = document.getElementById('freqBars');
  if (!el) return;
  el.innerHTML = '';
  for (let i = 0; i < 20; i++) {
    const b = document.createElement('div');
    b.className  = 'fbar';
    b.id         = 'fb' + i;
    b.style.height = '10%';
    el.appendChild(b);
  }
}

// ── Per-frame updates ────────────────────────────────────────────────────────

/**
 * Update all live metric readouts. Call every frame.
 * @param {'v10'|'v6'} engineType
 * @param {number}     rpm
 * @param {number}     maxRPM
 */
export function updateMetrics(engineType, rpm, maxRPM) {
  const m = engineType === 'v10' ? getV10Metrics(rpm) : getV6Metrics(rpm);

  setText('mPow',  m.power);
  setText('mTorq', m.torque);
  setText('mEff',  m.efficiency);
  setText('mTemp', m.exhaustTemp);

  // ERS / turbo panel
  if (engineType === 'v6') {
    setBar('mgukFill',   m.mgukPct);
    setBar('mguhFill',   m.mguhPct);
    setBar('boostFill',  m.boostPct);
    setText('mgukVal',  m.mgukKw  + ' kW');
    setText('mguhVal',  m.mguhKw  + ' kW');
    setText('boostVal', m.boostBar + ' BAR');
  }

  updateFreqBars(engineType, rpm, maxRPM);
}

/** Dim / brighten the ERS block depending on hybrid mode.
 * @param {boolean} isHybrid
 */
export function syncERSBlock(isHybrid) {
  const el = document.getElementById('ersBlock');
  if (el) el.style.opacity = isHybrid ? '1' : '0.3';
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function setBar(id, pct) {
  const el = document.getElementById(id);
  if (el) el.style.width = pct + '%';
}

function updateFreqBars(type, rpm, maxRPM) {
  const n = rpm / maxRPM;
  for (let i = 0; i < 20; i++) {
    const b = document.getElementById('fb' + i);
    if (!b) continue;
    const noise = Math.random() * 0.35;
    let h;
    if (type === 'v10') {
      const pk = Math.exp(-0.5 * ((i - 14) / 3.2) ** 2);
      h = (pk * 0.7 + noise * 0.3) * n * 95;
      b.style.background = 'var(--gold)';
    } else {
      const pk = Math.exp(-0.5 * ((i - 7) / 3.8) ** 2);
      h = (pk * 0.7 + noise * 0.3) * n * 95;
      b.style.background = 'var(--bronze)';
    }
    b.style.height = Math.max(4, h) + '%';
  }
}