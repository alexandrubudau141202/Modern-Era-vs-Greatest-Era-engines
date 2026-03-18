export const v6Data = {
  id: 'v6',
  name: 'HONDA RA168E — 1.5L INLINE-4',
  sub: '1980s TURBO ERA · TURBOCHARGED',
  cornerId: '1.5L INLINE-4 TURBO · HONDA RA168E · 13,000 RPM',
  maxRPM: 13000,
  cyls: 4,
  firingOrder: [1, 3, 4, 2],
  hybrid: false,
  acoustic: 'TURBO WHISTLE · FLAT-PLANE · 1.5–2.5 kHz PEAK',
  notes:
    'The Honda RA168E powered Ayrton Senna and Alain Prost to dominance in 1988, ' +
    'winning 15 of 16 races. In qualifying trim it was rumoured to exceed 1,400 hp. ' +
    'A flat-plane inline-4 with a massive KKK turbocharger, it redefined what a ' +
    '1.5L engine could do — and ended an era when turbos were banned in 1989.',
  specs: [
    ['DISPLACEMENT', '1494 cc'],
    ['CYLINDERS',    '4 (inline)'],
    ['LAYOUT',       'Inline-4'],
    ['BORE',         '79.0 mm'],
    ['STROKE',       '76.4 mm'],
    ['COMPRESSION',  '7.5:1'],
    ['MAX RPM',      '13,000'],
    ['WEIGHT',       '~145 kg'],
    ['ERA',          '1983–1988'],
  ],

  geometry: {
    cylCount: 4,
    cylSpacing: 1.05,
    bankAngle: 0,           // inline — no V angle
    bore: 0.38,
    stroke: 0.32,
    cylHeight: 1.1,
  },

  // Inline-4 flat-plane crank: 0°, 180°, 180°, 0° (firing every 180°)
  crankPhases: [
    0,
    Math.PI,
    Math.PI,
    0,
  ],
};

/**
 * Compute live performance metrics for the Inline-4 turbo at a given RPM.
 * @param {number} rpm
 * @returns {{ power: number, torque: number, efficiency: number, exhaustTemp: number,
 *             mgukKw: number, mguhKw: number, boostBar: string,
 *             mgukPct: number, mguhPct: number, boostPct: number }}
 */
export function getV6Metrics(rpm) {
  const maxRPM = v6Data.maxRPM;
  const n      = rpm / maxRPM;

  // Power curve: turbos spool from ~4,000 RPM, peak ~11,000
  let power;
  if (rpm < 1500) {
    power = Math.round(rpm * 0.08);
  } else if (rpm < 4000) {
    power = Math.round(120 + (rpm - 1500) / 2500 * 180);
  } else if (rpm < 11000) {
    power = Math.round(300 + (rpm - 4000) / 7000 * 600);
  } else {
    power = Math.round(900 - (rpm - 11000) / 2000 * 120);
  }
  power = Math.max(0, power);

  const torque      = rpm > 300 ? Math.round(power * 9549 / rpm) : 0;
  const efficiency  = Math.round(28 + n * 10);
  const exhaustTemp = Math.round(320 + n * 180);

  // Reuse ERS fields to show turbo boost metrics
  const boostPct = rpm > 3500 ? Math.min(100, Math.round((rpm - 3500) / 7500 * 100)) : 0;
  const boostBar = (n * 5.5).toFixed(1);
  // MGU-K / MGU-H repurposed as charge-cooler and wastegate indicators
  const mgukPct  = boostPct;
  const mguhPct  = rpm > 6000 ? Math.min(100, Math.round((rpm - 6000) / 7000 * 100)) : 0;

  return {
    power, torque, efficiency, exhaustTemp,
    mgukKw:  Math.round(mgukPct * 2.2),
    mguhKw:  Math.round(mguhPct * 1.4),
    boostBar,
    mgukPct, mguhPct, boostPct,
  };
}