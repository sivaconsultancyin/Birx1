/**
 * European Roulette Authoritative Deterministic Coordinate Mapping System
 * 
 * WHEEL SPECIFICATION:
 * - Single green zero (0)
 * - Clockwise European wheel order:
 *   0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
 * - Exactly 37 pockets
 * 
 * COORDINATE SYSTEM:
 * - Screen coordinates: positive X is right, positive Y is down
 * - Origin: (centerX, centerY) at center of the wheel
 * - Pointer alignment: Top center (12 o'clock) at angle 270° (or -90°)
 * - All dimensions scale proportionally based on rendered wheel dimensions
 */

export const EUROPEAN_WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
] as const;

export const POCKET_COUNT = 37;
export const ANGULAR_SPACING = 360 / POCKET_COUNT; // 9.72972972972973 degrees

/**
 * Visual reference pointer angle in screen coordinates.
 * 270 degrees corresponds to 12 o'clock (straight up, where x = centerX, y = centerY - R).
 */
export const POINTER_ANGLE = 270;

/**
 * Base startAngle such that index 0 (pocket 0) is perfectly aligned with the pointer at 270 degrees.
 */
export const START_ANGLE = 270;

/**
 * Standardized proportional radius ratios relative to outer wheel radius R.
 * Enables 100% responsive rendering without fixed pixel constraints.
 */
export const WHEEL_RATIOS = {
  rimOuter: 0.98,
  brassBezel: 0.92,
  ballTrack: 0.85,
  deflectorTrack: 0.85,
  pocketOuter: 0.74,
  pocketCenter: 0.61, // Rp: Pocket center radius where number label & ball settle
  pocketInner: 0.47,
  innerBrassRim: 0.47,
  turretHub: 0.37,
  centerCap: 0.12,
} as const;

export const RED_NUMBERS_LIST = [
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36
] as const;
export const RED_NUMBERS_SET: ReadonlySet<number> = new Set(RED_NUMBERS_LIST);

export const BLACK_NUMBERS_LIST = [
  2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35
] as const;
export const BLACK_NUMBERS_SET: ReadonlySet<number> = new Set(BLACK_NUMBERS_LIST);

/**
 * Authoritative bi-directional mappings:
 * number -> wheelIndex (0-36)
 * wheelIndex -> number
 */
export const NUMBER_TO_WHEEL_INDEX: Record<number, number> = Object.freeze(
  EUROPEAN_WHEEL_ORDER.reduce((acc, num, idx) => {
    acc[num] = idx;
    return acc;
  }, {} as Record<number, number>)
);

export const WHEEL_INDEX_TO_NUMBER: Record<number, number> = Object.freeze(
  EUROPEAN_WHEEL_ORDER.reduce((acc, num, idx) => {
    acc[idx] = num;
    return acc;
  }, {} as Record<number, number>)
);

/**
 * Convert angle in degrees to radians.
 */
export function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Convert angle in radians to degrees.
 */
export function radToDeg(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * Normalize an angle into [0, 360) range.
 */
export function normalizeAngle(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/**
 * Convert winning number to wheel index (0 to 36).
 * Throws an error if invalid roulette number is provided.
 */
export function getWheelIndex(num: number): number {
  const idx = NUMBER_TO_WHEEL_INDEX[num];
  if (idx === undefined) {
    throw new Error(`Invalid European roulette number: ${num}. Must be an integer between 0 and 36.`);
  }
  return idx;
}

/**
 * Convert wheel index (0 to 36) to pocket number.
 */
export function getNumberForIndex(idx: number): number {
  const normIdx = ((idx % POCKET_COUNT) + POCKET_COUNT) % POCKET_COUNT;
  return WHEEL_INDEX_TO_NUMBER[normIdx];
}

/**
 * Deterministic pocket angle for a given wheel index in unrotated wheel coordinates:
 * angle(index) = startAngle + index * (360 / 37)
 */
export function getPocketAngle(index: number): number {
  return (START_ANGLE + index * ANGULAR_SPACING) % 360;
}

/**
 * Deterministic pocket angle for a given roulette number in unrotated wheel coordinates.
 */
export function getPocketAngleForNumber(num: number): number {
  const idx = getWheelIndex(num);
  return getPocketAngle(idx);
}

export interface CartesianCoordinate {
  x: number;
  y: number;
}

/**
 * Authoritative Cartesian coordinate calculation:
 * For a point at angle θ and radius R:
 * x = centerX + R * cos(θ)
 * y = centerY + R * sin(θ)
 */
export function calculateCartesianCoordinate(
  centerX: number,
  centerY: number,
  radius: number,
  angleDeg: number
): CartesianCoordinate {
  const rad = degToRad(angleDeg);
  const x = centerX + radius * Math.cos(rad);
  const y = centerY + radius * Math.sin(rad);

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(
      `Invalid non-finite coordinate computed: x=${x}, y=${y} for centerX=${centerX}, centerY=${centerY}, radius=${radius}, angleDeg=${angleDeg}`
    );
  }

  return { x, y };
}

/**
 * Calculate pocket center coordinate (Rp) for a given pocket angle.
 */
export function getPocketCenterCoordinate(
  centerX: number,
  centerY: number,
  pocketRadius: number,
  angleDeg: number
): CartesianCoordinate {
  return calculateCartesianCoordinate(centerX, centerY, pocketRadius, angleDeg);
}

/**
 * Calculate ball track coordinate (Rb) for a given angle.
 */
export function getBallTrackCoordinate(
  centerX: number,
  centerY: number,
  ballTrackRadius: number,
  angleDeg: number
): CartesianCoordinate {
  return calculateCartesianCoordinate(centerX, centerY, ballTrackRadius, angleDeg);
}

/**
 * Generate SVG Path for a wedge pocket between rInner and rOuter from startAngle to endAngle.
 */
export function getPocketWedgePath(
  centerX: number,
  centerY: number,
  rInner: number,
  rOuter: number,
  startAngleDeg: number,
  endAngleDeg: number
): string {
  const p1 = calculateCartesianCoordinate(centerX, centerY, rOuter, startAngleDeg);
  const p2 = calculateCartesianCoordinate(centerX, centerY, rOuter, endAngleDeg);
  const p3 = calculateCartesianCoordinate(centerX, centerY, rInner, endAngleDeg);
  const p4 = calculateCartesianCoordinate(centerX, centerY, rInner, startAngleDeg);

  // Since angular spacing is ~9.73 degrees (< 180), largeArcFlag is always 0
  return `M ${p1.x} ${p1.y} A ${rOuter} ${rOuter} 0 0 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${rInner} ${rInner} 0 0 0 ${p4.x} ${p4.y} Z`;
}

/**
 * Calculate responsive wheel metrics from rendered element dimensions.
 */
export function deriveWheelDimensions(width: number, height: number) {
  const size = Math.min(width, height);
  const centerX = width / 2;
  const centerY = height / 2;
  const wheelRadius = (size / 2) * 0.98;

  return {
    width,
    height,
    centerX,
    centerY,
    wheelRadius,
    rRimOuter: wheelRadius * WHEEL_RATIOS.rimOuter,
    rBrassBezel: wheelRadius * WHEEL_RATIOS.brassBezel,
    rBallTrack: wheelRadius * WHEEL_RATIOS.ballTrack,
    rDeflector: wheelRadius * WHEEL_RATIOS.deflectorTrack,
    rPocketOuter: wheelRadius * WHEEL_RATIOS.pocketOuter,
    rPocketCenter: wheelRadius * WHEEL_RATIOS.pocketCenter, // Rp
    rPocketInner: wheelRadius * WHEEL_RATIOS.pocketInner,
    rInnerBrass: wheelRadius * WHEEL_RATIOS.innerBrassRim,
    rTurretHub: wheelRadius * WHEEL_RATIOS.turretHub,
    rCenterCap: wheelRadius * WHEEL_RATIOS.centerCap,
  };
}

export interface TargetWheelRotationResult {
  targetRotation: number;
  deltaRotation: number;
  targetModulo: number;
  winnerIndex: number;
  screenAngleAtPointer: number;
}

/**
 * Deterministic forward wheel rotation calculation with angle-wrapping protection.
 * 
 * Rules:
 * 1. Start from currentRotation.
 * 2. Rotate strictly FORWARD (clockwise, delta > 0).
 * 3. Never rotate backward (e.g. from 359° to 2°, delta is +3°, not -357°).
 * 4. Add minFullTurns full rotations (e.g. 5 full turns = 1800°).
 * 5. Guarantees that at targetRotation, pocket for winningNumber aligns exactly with POINTER_ANGLE (270°).
 */
export function calculateTargetWheelRotation(
  currentRotation: number,
  winningNumber: number,
  minFullTurns: number = 5
): TargetWheelRotationResult {
  const winnerIndex = getWheelIndex(winningNumber);

  // In unrotated coordinates, pocket is at: (START_ANGLE + winnerIndex * ANGULAR_SPACING)
  // When wheel rotates by W, pocket is at screen angle: (START_ANGLE + winnerIndex * ANGULAR_SPACING + W) % 360
  // We want this screen angle to equal POINTER_ANGLE (270):
  // (270 + winnerIndex * ANGULAR_SPACING + W) % 360 = 270
  // => (winnerIndex * ANGULAR_SPACING + W) % 360 = 0
  // => W % 360 = (360 - ((winnerIndex * ANGULAR_SPACING) % 360)) % 360
  const pocketOffset = (winnerIndex * ANGULAR_SPACING) % 360;
  const targetModulo = (360 - pocketOffset) % 360;

  // Current wheel modulo angle normalized to [0, 360)
  const currentModulo = normalizeAngle(currentRotation);

  // Calculate forward step in degrees to reach targetModulo
  let forwardDelta = targetModulo - currentModulo;
  if (forwardDelta <= 0) {
    forwardDelta += 360;
  }

  // Add full rotations
  const totalDelta = forwardDelta + Math.max(1, minFullTurns) * 360;
  const targetRotation = currentRotation + totalDelta;

  // Verification of screen angle at pointer
  const screenAngleAtPointer = normalizeAngle(START_ANGLE + winnerIndex * ANGULAR_SPACING + targetRotation);

  return {
    targetRotation,
    deltaRotation: totalDelta,
    targetModulo,
    winnerIndex,
    screenAngleAtPointer
  };
}

/**
 * Validation Suite for European Roulette Wheel Coordinates.
 * Run in development to assert mathematical precision and alignment.
 */
export interface ValidationResult {
  passed: boolean;
  errors: string[];
  testCases: {
    number: number;
    wheelIndex: number;
    pocketAngle: number;
    targetModulo: number;
    finalPocketScreenAngle: number;
    isAlignedWithPointer: boolean;
    centerCoordinate: CartesianCoordinate;
  }[];
}

export function validateRouletteCoordinates(): ValidationResult {
  const errors: string[] = [];

  // 1. Assert wheel array length === 37
  if (EUROPEAN_WHEEL_ORDER.length !== 37) {
    errors.push(`Wheel order array length is ${EUROPEAN_WHEEL_ORDER.length}, expected 37.`);
  }

  // 2. Assert all numbers 0-36 exist exactly once
  const numSet = new Set<number>(EUROPEAN_WHEEL_ORDER);
  if (numSet.size !== 37) {
    errors.push(`Wheel has ${numSet.size} unique numbers, expected 37.`);
  }
  for (let i = 0; i <= 36; i++) {
    if (!numSet.has(i)) {
      errors.push(`Number ${i} is missing from the wheel.`);
    }
  }

  // 3. Assert angle spacing is exactly 360 / 37
  const expectedSpacing = 360 / 37;
  if (Math.abs(ANGULAR_SPACING - expectedSpacing) > 1e-9) {
    errors.push(`ANGULAR_SPACING ${ANGULAR_SPACING} does not match 360/37 (${expectedSpacing}).`);
  }

  // 4. Assert number -> index mapping is reversible
  for (let i = 0; i <= 36; i++) {
    const idx = getWheelIndex(i);
    const num = getNumberForIndex(idx);
    if (num !== i) {
      errors.push(`Reversibility failed for number ${i}: index ${idx} maps back to ${num}.`);
    }
  }

  // 5. Test minimum required numbers: 0, 1, 17, 32, 36
  const testNumbers = [0, 1, 17, 32, 36];
  const testCases: ValidationResult['testCases'] = [];

  const mockCenterX = 200;
  const mockCenterY = 200;
  const mockRp = 120;

  for (const num of testNumbers) {
    const idx = getWheelIndex(num);
    const pAngle = getPocketAngle(idx);

    // Test rotation from arbitrary angle (e.g. 359 to test angle wrapping)
    const rot = calculateTargetWheelRotation(359, num, 5);

    // Final screen angle of pocket
    const finalAngle = normalizeAngle(pAngle + rot.targetRotation);
    const isAligned = Math.abs(finalAngle - POINTER_ANGLE) < 1e-4;

    // Coordinate check
    const coord = getPocketCenterCoordinate(mockCenterX, mockCenterY, mockRp, finalAngle);
    if (!Number.isFinite(coord.x) || !Number.isFinite(coord.y)) {
      errors.push(`Calculated coordinates for ${num} are non-finite: (${coord.x}, ${coord.y})`);
    }

    // Since POINTER_ANGLE is 270 (12 o'clock), coordinate must have x ≈ mockCenterX and y ≈ mockCenterY - mockRp
    const expectedX = mockCenterX;
    const expectedY = mockCenterY - mockRp;
    if (Math.abs(coord.x - expectedX) > 0.01 || Math.abs(coord.y - expectedY) > 0.01) {
      errors.push(
        `Pocket ${num} coordinate mismatch at pointer. Got (${coord.x.toFixed(2)}, ${coord.y.toFixed(2)}), expected (${expectedX}, ${expectedY})`
      );
    }

    testCases.push({
      number: num,
      wheelIndex: idx,
      pocketAngle: pAngle,
      targetModulo: rot.targetModulo,
      finalPocketScreenAngle: finalAngle,
      isAlignedWithPointer: isAligned,
      centerCoordinate: coord,
    });
  }

  // 6. Test forward rotation angle wrapping (e.g. current = 359, targetModulo = 2)
  const wrapTest = calculateTargetWheelRotation(359, 0, 5);
  if (wrapTest.deltaRotation <= 0) {
    errors.push(`Angle wrapping test failed: deltaRotation is ${wrapTest.deltaRotation}, must be > 0.`);
  }

  const passed = errors.length === 0;
  return { passed, errors, testCases };
}

// Automatically execute development assertion upon module loading
if (process.env.NODE_ENV !== 'production') {
  const report = validateRouletteCoordinates();
  if (!report.passed) {
    console.error('European Roulette coordinate validation failed:', report.errors);
  } else {
    console.log(
      'European Roulette coordinate mapping validated successfully. All 37 pockets and test cases (0, 1, 17, 32, 36) verified.'
    );
  }
}
