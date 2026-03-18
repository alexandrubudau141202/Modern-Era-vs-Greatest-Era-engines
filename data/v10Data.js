export const v10Data = {
  id: 'v10',
  name: 'FORD COSWORTH DFV — 3.0L V8',
  sub: 'GOLDEN ERA · NATURALLY ASPIRATED',
  cornerId: '3.0L V8 · FORD COSWORTH DFV · 11,000 RPM',
  maxRPM: 11000,
  cyls: 8,
  firingOrder: [1, 5, 4, 2, 6, 3, 7, 8],
  hybrid: false,
  acoustic: 'FLAT-PLANE V8 · CLASSIC BARK · 2–3 kHz PEAK',
  notes:
    'The Cosworth DFV is the most successful F1 engine in history — 155 Grand Prix wins ' +
    'across 12 seasons. A 90° V8 with a flat-plane crankshaft, it was revolutionary in ' +
    '1967 for being a fully stressed member of the chassis. Light, powerful, and ' +
    'extraordinarily reliable, it democratised F1 by being sold to any team.',
  specs: [
    ['DISPLACEMENT', '2993 cc'],
    ['CYLINDERS',    '8 (4+4)'],
    ['BANK ANGLE',   '90°'],
    ['BORE',         '85.7 mm'],
    ['STROKE',       '64.8 mm'],
    ['COMPRESSION',  '12.0:1'],
    ['MAX RPM',      '11,000'],
    ['WEIGHT',       '~168 kg'],
    ['ERA',          '1967–1983'],
  ],

  geometry: {
    cylCount: 4,        // per bank
    cylSpacing: 1.05,
    bankAngle: Math.PI / 4,
    bore: 0.38,
    stroke: 0.29,
    cylHeight: 1.0,
  },

  // Flat-plane V8 crank: alternating 0° / 180° per bank, banks offset 90°
  crankPhases: [
    0,                   // L1
    Math.PI,             // L2
    Math.PI * 0.5,       // L3
    Math.PI * 1.5,       // L4
    Math.PI * 0.25,      // R1
    Math.PI * 1.25,      // R2
    Math.PI * 0.75,      // R3
    Math.PI * 1.75,      // R4
  ],
};

/**
 * Compute live performance metrics for the V8 at a given RPM.
 * @param {number} rpm
 * @returns {{ power: number, torque: number, efficiency: number, exhaustTemp: number }}
 */
export function getV10Metrics(rpm) {
  const maxRPM = v10Data.maxRPM;

  let power;
  if (rpm < 1500) {
    power = Math.round(rpm * 0.12);
  } else if (rpm < 9500) {
    power = Math.round(80 + (rpm - 1500) / 8000 * 400);
  } else if (rpm < 10500) {
    power = Math.round(480 + (rpm - 9500) / 1000 * 20);
  } else {
    power = Math.round(500 - (rpm - 10500) / 500 * 30);
  }
  power = Math.max(0, power);

  const torque      = rpm > 300 ? Math.round(power * 9549 / rpm) : 0;
  const n           = rpm / maxRPM;
  const efficiency  = Math.round(28 + n * 6);
  const exhaustTemp = Math.round(350 + n * 200);

  return { power, torque, efficiency, exhaustTemp };
}