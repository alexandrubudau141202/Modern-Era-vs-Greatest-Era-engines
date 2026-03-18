export const v6Data = {
  id: 'v6',
  name: 'MERCEDES PU106A — 1.6L V6',
  sub: '2014+ ERA · TURBO HYBRID POWER UNIT',
  cornerId: '1.6L V6 TURBO · MERCEDES PU106A · 15,000 RPM',
  maxRPM: 15000,
  cyls: 6,
  firingOrder: [1, 4, 2, 5, 3, 6],
  hybrid: true,
  acoustic: 'TURBOCHARGED · LOWER TONE · 1–2 kHz PEAK',
  notes:
    'The hybrid power unit redefined F1 engineering. At over 50% thermal efficiency, ' +
    'it generates ~850 hp from the ICE alone, with 163 kW (218 hp) of electric boost via MGU-K. ' +
    'The MGU-H harvests exhaust energy to eliminate turbo lag — an engineering achievement ' +
    'without precedent in motorsport.',
  specs: [
    ['DISPLACEMENT', '1599 cc'],
    ['CYLINDERS',    '6 (3+3)'],
    ['BANK ANGLE',   '90°'],
    ['BORE',         '80.0 mm'],
    ['STROKE',       '53.0 mm'],
    ['COMPRESSION',  '12.0:1'],
    ['MAX RPM',      '15,000'],
    ['WEIGHT',       '~145 kg'],
    ['ERS POWER',    '163 kW'],
  ],

  // Geometry constants used by the builder
  geometry: {
    cylCount: 3,        // per bank
    cylSpacing: 1.14,
    bankAngle: Math.PI / 4,
    bore: 0.40,
    stroke: 0.30,
    cylHeight: 1.05,
  },

  // Crankshaft phase offsets for 6 cylinders (90° V, 120° crank intervals)
  crankPhases: [
    0,
    Math.PI * 2 / 3,
    Math.PI * 4 / 3,
    Math.PI / 3,
    Math.PI,
    Math.PI * 5 / 3,
  ],
};

/**
 * Compute live performance metrics for the V6 hybrid at a given RPM.
 * @param {number} rpm
 * @returns {{ power: number, torque: number, efficiency: number, exhaustTemp: number,
 *             mgukKw: number, mguhKw: number, boostBar: string,
 *             mgukPct: number, mguhPct: number, boostPct: number }}
 */
export function getV6Metrics(rpm) {
  const maxRPM = v6Data.maxRPM;
  const n      = rpm / maxRPM;

  let iceP;
  if (rpm < 2000) {
    iceP = Math.round(rpm * 0.15);
  } else if (rpm < 14000) {
    iceP = Math.round(60 + (rpm - 2000) / 12000 * 700);
  } else {
    iceP = Math.round(760 - (rpm - 14000) / 1000 * 50);
  }
  const ersP  = rpm > 3500 ? Math.round(218 * Math.min(1, (rpm - 3500) / 5000)) : 0;
  const power = Math.max(0, Math.round(iceP + ersP));
  const torque = rpm > 300 ? Math.round(power * 9549 / rpm) : 0;

  const efficiency  = Math.round(38 + n * 15);
  const exhaustTemp = Math.round(200 + n * 110);

  const mgukPct = rpm > 3500 ? Math.min(100, Math.round((rpm - 3500) / 5000 * 100)) : 0;
  const mguhPct = rpm > 8000 ? Math.min(100, Math.round((rpm - 8000) / 7000 * 100)) : 0;
  const boostPct = Math.round(n * 100);
  const boostBar = (n * 4.8).toFixed(1);

  return {
    power, torque, efficiency, exhaustTemp,
    mgukKw:  Math.round(mgukPct * 1.63),
    mguhKw:  Math.round(mguhPct * 0.9),
    boostBar,
    mgukPct, mguhPct, boostPct,
  };
}
