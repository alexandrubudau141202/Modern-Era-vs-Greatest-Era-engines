export const v10Data = {
  id: 'v10',
  name: 'FERRARI 050 — 3.0L V10',
  sub: 'EARLY 2000s ERA · NATURALLY ASPIRATED',
  cornerId: '3.0L V10 · FERRARI 050 · 19,000 RPM',
  maxRPM: 19000,
  cyls: 10,
  firingOrder: [1, 6, 5, 10, 2, 7, 3, 8, 4, 9],
  hybrid: false,
  acoustic: 'HIGH-FREQUENCY SCREAMER · 3–4 kHz PEAK',
  notes:
    'The naturally aspirated 3.0L V10 defined an era of pure mechanical theatre. ' +
    'Spinning to 19,000 RPM, it produced an ear-splitting shriek unlike anything heard ' +
    'in motorsport. No hybrid assist, no turbo lag — raw combustion translated directly ' +
    'into 900 hp of screaming fury.',
  specs: [
    ['DISPLACEMENT', '2998 cc'],
    ['CYLINDERS',    '10 (5+5)'],
    ['BANK ANGLE',   '90°'],
    ['BORE',         '95.0 mm'],
    ['STROKE',       '52.5 mm'],
    ['COMPRESSION',  '13.5:1'],
    ['MAX RPM',      '19,000'],
    ['WEIGHT',       '~95 kg'],
    ['ERA',          '2000–2005'],
  ],

  // Geometry constants used by the builder
  geometry: {
    cylCount: 5,        // per bank
    cylSpacing: 1.08,
    bankAngle: Math.PI / 4,
    bore: 0.35,
    stroke: 0.27,
    cylHeight: 1.0,
  },

  // Crankshaft phase offsets for 10 cylinders (90° V, 72° crank intervals)
  crankPhases: [
    0,
    Math.PI,
    Math.PI * 4 / 5,
    Math.PI * 9 / 5,
    Math.PI * 8 / 5,
    Math.PI * 3 / 5,
    Math.PI * 2 / 5,
    Math.PI * 7 / 5,
    Math.PI * 6 / 5,
    Math.PI * 1 / 5,
  ],
};

/**
 * Compute live performance metrics for the V10 at a given RPM.
 * @param {number} rpm
 * @returns {{ power: number, torque: number, efficiency: number, exhaustTemp: number }}
 */
export function getV10Metrics(rpm) {
  let power;
  if (rpm < 2000) {
    power = Math.round(rpm * 0.2);
  } else if (rpm < 16200) {
    power = Math.round(100 + (rpm - 2000) / 14200 * 800);
  } else {
    power = Math.round(900 - (rpm - 16200) / 2800 * 60);
  }
  power = Math.max(0, power);

  const torque      = rpm > 300 ? Math.round(power * 9549 / rpm) : 0;
  const n           = rpm / v10Data.maxRPM;
  const efficiency  = Math.round(22 + n * 8);
  const exhaustTemp = Math.round(260 + n * 170);

  return { power, torque, efficiency, exhaustTemp };
}
