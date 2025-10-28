// src/adjustment-tracker.ts
import { EnuParams } from './types/alignment';

export interface AdjustmentLog {
  timestamp: number;
  type: 'scale' | 'yaw' | 'pitch' | 'roll' | 'position' | 'height';
  before: any;
  after: any;
  delta?: any;
}

export interface SplatAdjustments {
  initialParams: EnuParams;
  currentParams: EnuParams;
  logs: AdjustmentLog[];
  totalDeltas: {
    scale: number;
    yawRad: number;
    pitchRad: number;
    rollRad: number;
    tEast: number;
    tNorth: number;
    tUp: number;
  };
}

export class AdjustmentTracker {
  private adjustments: SplatAdjustments;
  private enabled: boolean = true;

  constructor(initialParams: EnuParams) {
    this.adjustments = {
      initialParams: { ...initialParams },
      currentParams: { ...initialParams },
      logs: [],
      totalDeltas: {
        scale: 0,
        yawRad: 0,
        pitchRad: 0,
        rollRad: 0,
        tEast: 0,
        tNorth: 0,
        tUp: 0
      }
    };

    console.log('📊 Adjustment Tracker initialized');
    console.log('Initial params:', this.adjustments.initialParams);
  }

  // Log a scale adjustment
  public logScaleAdjustment(before: number, after: number): void {
    if (!this.enabled) return;

    const factor = after / before;
    this.adjustments.totalDeltas.scale = after / this.adjustments.initialParams.scale;

    this.adjustments.logs.push({
      timestamp: Date.now(),
      type: 'scale',
      before,
      after,
      delta: factor
    });

    this.adjustments.currentParams.scale = after;
    console.log(`📊 Scale: ${before.toFixed(3)} → ${after.toFixed(3)} (factor: ${factor.toFixed(3)}, total from initial: ${this.adjustments.totalDeltas.scale.toFixed(3)}x)`);
  }

  // Log a yaw adjustment
  public logYawAdjustment(before: number, after: number): void {
    if (!this.enabled) return;

    const delta = after - before;
    this.adjustments.totalDeltas.yawRad = after - this.adjustments.initialParams.yawRad;

    this.adjustments.logs.push({
      timestamp: Date.now(),
      type: 'yaw',
      before,
      after,
      delta
    });

    this.adjustments.currentParams.yawRad = after;
    console.log(`📊 Yaw: ${(before * 180/Math.PI).toFixed(1)}° → ${(after * 180/Math.PI).toFixed(1)}° (Δ: ${(delta * 180/Math.PI).toFixed(1)}°, total: ${(this.adjustments.totalDeltas.yawRad * 180/Math.PI).toFixed(1)}°)`);
  }

  // Log a pitch adjustment
  public logPitchAdjustment(before: number, after: number): void {
    if (!this.enabled) return;

    const delta = after - before;
    this.adjustments.totalDeltas.pitchRad = after - this.adjustments.initialParams.pitchRad;

    this.adjustments.logs.push({
      timestamp: Date.now(),
      type: 'pitch',
      before,
      after,
      delta
    });

    this.adjustments.currentParams.pitchRad = after;
    console.log(`📊 Pitch: ${(before * 180/Math.PI).toFixed(1)}° → ${(after * 180/Math.PI).toFixed(1)}° (Δ: ${(delta * 180/Math.PI).toFixed(1)}°, total: ${(this.adjustments.totalDeltas.pitchRad * 180/Math.PI).toFixed(1)}°)`);
  }

  // Log a roll adjustment
  public logRollAdjustment(before: number, after: number): void {
    if (!this.enabled) return;

    const delta = after - before;
    this.adjustments.totalDeltas.rollRad = after - this.adjustments.initialParams.rollRad;

    this.adjustments.logs.push({
      timestamp: Date.now(),
      type: 'roll',
      before,
      after,
      delta
    });

    this.adjustments.currentParams.rollRad = after;
    console.log(`📊 Roll: ${(before * 180/Math.PI).toFixed(1)}° → ${(after * 180/Math.PI).toFixed(1)}° (Δ: ${(delta * 180/Math.PI).toFixed(1)}°, total: ${(this.adjustments.totalDeltas.rollRad * 180/Math.PI).toFixed(1)}°)`);
  }

  // Log a position adjustment
  public logPositionAdjustment(beforeE: number, beforeN: number, beforeU: number, afterE: number, afterN: number, afterU: number): void {
    if (!this.enabled) return;

    const deltaE = afterE - beforeE;
    const deltaN = afterN - beforeN;
    const deltaU = afterU - beforeU;

    this.adjustments.totalDeltas.tEast = afterE - this.adjustments.initialParams.tEast;
    this.adjustments.totalDeltas.tNorth = afterN - this.adjustments.initialParams.tNorth;
    this.adjustments.totalDeltas.tUp = afterU - this.adjustments.initialParams.tUp;

    this.adjustments.logs.push({
      timestamp: Date.now(),
      type: 'position',
      before: { E: beforeE, N: beforeN, U: beforeU },
      after: { E: afterE, N: afterN, U: afterU },
      delta: { E: deltaE, N: deltaN, U: deltaU }
    });

    this.adjustments.currentParams.tEast = afterE;
    this.adjustments.currentParams.tNorth = afterN;
    this.adjustments.currentParams.tUp = afterU;

    console.log(`📊 Position: [E:${beforeE.toFixed(3)}, N:${beforeN.toFixed(3)}, U:${beforeU.toFixed(3)}] → [E:${afterE.toFixed(3)}, N:${afterN.toFixed(3)}, U:${afterU.toFixed(3)}]`);
    console.log(`   Total from initial: E:${this.adjustments.totalDeltas.tEast.toFixed(3)}, N:${this.adjustments.totalDeltas.tNorth.toFixed(3)}, U:${this.adjustments.totalDeltas.tUp.toFixed(3)}`);
  }

  // Log a height adjustment
  public logHeightAdjustment(before: number, after: number): void {
    if (!this.enabled) return;

    const delta = after - before;
    this.adjustments.totalDeltas.tUp = after - this.adjustments.initialParams.tUp;

    this.adjustments.logs.push({
      timestamp: Date.now(),
      type: 'height',
      before,
      after,
      delta
    });

    this.adjustments.currentParams.tUp = after;
    console.log(`📊 Height: ${before.toFixed(2)}m → ${after.toFixed(2)}m (Δ: ${delta.toFixed(2)}m, total: ${this.adjustments.totalDeltas.tUp.toFixed(2)}m)`);
  }

  // Get summary of all adjustments
  public getSummary(): string {
    const lines = [
      '═══════════════════════════════════════════════════',
      '📊 ADJUSTMENT SUMMARY',
      '═══════════════════════════════════════════════════',
      '',
      '📍 INITIAL PARAMETERS:',
      `  Scale:    ${this.adjustments.initialParams.scale.toFixed(3)}`,
      `  Yaw:      ${(this.adjustments.initialParams.yawRad * 180/Math.PI).toFixed(2)}°`,
      `  Pitch:    ${(this.adjustments.initialParams.pitchRad * 180/Math.PI).toFixed(2)}°`,
      `  Roll:     ${(this.adjustments.initialParams.rollRad * 180/Math.PI).toFixed(2)}°`,
      `  Position: E:${this.adjustments.initialParams.tEast.toFixed(3)}, N:${this.adjustments.initialParams.tNorth.toFixed(3)}, U:${this.adjustments.initialParams.tUp.toFixed(3)}`,
      '',
      '📍 CURRENT PARAMETERS:',
      `  Scale:    ${this.adjustments.currentParams.scale.toFixed(3)}`,
      `  Yaw:      ${(this.adjustments.currentParams.yawRad * 180/Math.PI).toFixed(2)}°`,
      `  Pitch:    ${(this.adjustments.currentParams.pitchRad * 180/Math.PI).toFixed(2)}°`,
      `  Roll:     ${(this.adjustments.currentParams.rollRad * 180/Math.PI).toFixed(2)}°`,
      `  Position: E:${this.adjustments.currentParams.tEast.toFixed(3)}, N:${this.adjustments.currentParams.tNorth.toFixed(3)}, U:${this.adjustments.currentParams.tUp.toFixed(3)}`,
      '',
      '🔄 TOTAL CHANGES FROM INITIAL:',
      `  Scale:    ${this.adjustments.totalDeltas.scale.toFixed(3)}x`,
      `  Yaw:      ${(this.adjustments.totalDeltas.yawRad * 180/Math.PI).toFixed(2)}°`,
      `  Pitch:    ${(this.adjustments.totalDeltas.pitchRad * 180/Math.PI).toFixed(2)}°`,
      `  Roll:     ${(this.adjustments.totalDeltas.rollRad * 180/Math.PI).toFixed(2)}°`,
      `  Position: E:${this.adjustments.totalDeltas.tEast.toFixed(3)}, N:${this.adjustments.totalDeltas.tNorth.toFixed(3)}, U:${this.adjustments.totalDeltas.tUp.toFixed(3)}`,
      '',
      `📝 Total adjustments made: ${this.adjustments.logs.length}`,
      '═══════════════════════════════════════════════════',
    ];

    return lines.join('\n');
  }

  // Get code snippet to apply these adjustments as defaults
  public getCodeSnippet(): string {
    const params = this.adjustments.currentParams;
    return `
// Updated default parameters for Burbank splat (from manual adjustments):
burbankLayer = new GaussianSplatLayer(
  "./splats/myscene/Burbank1Clean.ply",
  {
    lon: -118.28507075,
    lat: 34.18991967,
    height: 327 + ${params.tUp.toFixed(2)} // Adjusted height
  },
  {
    x: ${params.pitchRad.toFixed(4)}, // pitch
    y: ${params.yawRad.toFixed(4)},   // yaw
    z: ${params.rollRad.toFixed(4)}   // roll
  },
  ${params.scale.toFixed(3)} // scale
);

// Or apply directly to alignment controller:
alignmentController.setEnuParams({
  scale: ${params.scale.toFixed(3)},
  yawRad: ${params.yawRad.toFixed(4)},
  pitchRad: ${params.pitchRad.toFixed(4)},
  rollRad: ${params.rollRad.toFixed(4)},
  tEast: ${params.tEast.toFixed(3)},
  tNorth: ${params.tNorth.toFixed(3)},
  tUp: ${params.tUp.toFixed(3)}
});`;
  }

  // Get current params
  public getCurrentParams(): EnuParams {
    return { ...this.adjustments.currentParams };
  }

  // Reset tracking
  public reset(newInitialParams: EnuParams): void {
    this.adjustments = {
      initialParams: { ...newInitialParams },
      currentParams: { ...newInitialParams },
      logs: [],
      totalDeltas: {
        scale: 0,
        yawRad: 0,
        pitchRad: 0,
        rollRad: 0,
        tEast: 0,
        tNorth: 0,
        tUp: 0
      }
    };
    console.log('📊 Adjustment Tracker reset with new initial params');
  }

  // Enable/disable tracking
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    console.log(`📊 Adjustment Tracker ${enabled ? 'enabled' : 'disabled'}`);
  }

  // Export data as JSON
  public exportJSON(): string {
    return JSON.stringify(this.adjustments, null, 2);
  }
}
