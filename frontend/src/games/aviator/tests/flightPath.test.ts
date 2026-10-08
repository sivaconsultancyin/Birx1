import { describe, expect, it } from 'vitest';
import { FlightPath } from '../utils/FlightPath.js';

describe('Aviator FlightPath', () => {
  it('maps multiplier to monotonically increasing flight time', () => {
    const path = new FlightPath(390, 280);
    const t1 = path.multiplierToFlightTime(1.1, 8);
    const t2 = path.multiplierToFlightTime(2, 8);
    const t3 = path.multiplierToFlightTime(5, 8);
    expect(t1).toBeGreaterThanOrEqual(0);
    expect(t2).toBeGreaterThan(t1);
    expect(t3).toBeGreaterThan(t2);
  });

  it('keeps the crash multiplier at the terminal flight position', () => {
    const path = new FlightPath(390, 280);
    const crashTime = path.multiplierToFlightTime(8, 8);
    const position = path.getPlanePosition(crashTime, 8);
    expect(position.x).toBeGreaterThan(0);
    expect(Number.isFinite(position.y)).toBe(true);
    expect(Number.isFinite(position.angle)).toBe(true);
  });
});
