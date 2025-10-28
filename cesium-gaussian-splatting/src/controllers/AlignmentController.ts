// src/controllers/AlignmentController.ts
import * as Cesium from 'cesium';
import * as THREE from 'three';
import { GaussianSplatLayer } from '../gaussian-splat-layer';
import { EnuParams } from '../types/alignment';
import { composeModelMatrixENU } from '../alignment/composeModelMatrix';
import { alignGroundToUp } from '../alignment/planeFit';
import { metersPerUnitFromRoadWidth, estimateRoadWidthMeters } from '../alignment/scaleCalibration';
import { AdjustmentTracker } from '../adjustment-tracker';

// Feature flag for Alignment V2
const ALIGNMENT_V2 = true; // Set to false to use legacy behavior

export class AlignmentController {
  private splatLayer: GaussianSplatLayer;
  private cesiumViewer: Cesium.Viewer;
  private enuParams: EnuParams;
  private anchor: { lat: number; lon: number; height: number };
  public tracker: AdjustmentTracker; // Public so we can access from main.ts

  constructor(splatLayer: GaussianSplatLayer, cesiumViewer: Cesium.Viewer) {
    this.splatLayer = splatLayer;
    this.cesiumViewer = cesiumViewer;

    // Initialize anchor at splat location
    this.anchor = {
      lat: splatLayer.location.lat,
      lon: splatLayer.location.lon,
      height: splatLayer.location.height
    };

    // Initialize ENU parameters
    this.enuParams = {
      scale: splatLayer.scale || 1.0,
      yawRad: splatLayer.rotation.y || 0,
      pitchRad: splatLayer.rotation.x || 0,
      rollRad: splatLayer.rotation.z || 0,
      tEast: 0,
      tNorth: 0,
      tUp: 0
    };

    // Initialize adjustment tracker
    this.tracker = new AdjustmentTracker(this.enuParams);

    // Disable auto-update for manual matrix control
    if (splatLayer.scene) {
      splatLayer.scene.matrixAutoUpdate = false;
    }
  }

  // Apply transformations using V2 or legacy method
  public applyTransformation(): void {
    if (ALIGNMENT_V2) {
      this.applyTransformationV2();
    } else {
      this.applyTransformationLegacy();
    }
  }

  private applyTransformationV2(): void {
    // Compose matrix in ENU and convert to ECEF (without scale - we apply scale to mesh instead)
    const paramsWithoutScale = { ...this.enuParams, scale: 1.0 };
    const worldMatrix = composeModelMatrixENU(this.anchor, paramsWithoutScale);

    // Apply to splat scene
    if (this.splatLayer.scene) {
      // Convert Cesium Matrix4 to THREE Matrix4
      const cesiumArray = Cesium.Matrix4.toArray(worldMatrix);
      const threeMatrix = new THREE.Matrix4();
      threeMatrix.fromArray(cesiumArray);

      this.splatLayer.scene.matrix.copy(threeMatrix);
      // CRITICAL: Disable auto-update to prevent interference
      this.splatLayer.scene.matrixAutoUpdate = false;
    }

    // Update layer properties for compatibility (but values might be different when tilt-locked)
    this.splatLayer.location = this.anchor;
    this.splatLayer.rotation = {
      x: this.enuParams.pitchRad,  // Will be 0 when tilt-locked
      y: this.enuParams.yawRad,
      z: this.enuParams.rollRad    // Will be 0 when tilt-locked
    };
    this.splatLayer.scale = this.enuParams.scale;

    // Apply scale to mesh only (not in matrix) to avoid double-scaling
    this.splatLayer.updateScale();
  }

  private applyTransformationLegacy(): void {
    // Use existing update methods
    this.splatLayer.location = this.anchor;
    this.splatLayer.rotation.x = this.enuParams.pitchRad;
    this.splatLayer.rotation.y = this.enuParams.yawRad;
    this.splatLayer.rotation.z = this.enuParams.rollRad;
    this.splatLayer.scale = this.enuParams.scale;

    this.splatLayer.updatePosition();
    this.splatLayer.updateScale();
  }

  // ENU parameter manipulation methods
  public adjustScale(factor: number): void {
    const before = this.enuParams.scale;
    this.enuParams.scale = Math.max(0.1, Math.min(50.0, this.enuParams.scale * factor));
    this.tracker.logScaleAdjustment(before, this.enuParams.scale);
    this.applyTransformation();
    console.log(`Scale adjusted to: ${this.enuParams.scale.toFixed(2)}`);
  }

  public adjustYaw(deltaRad: number): void {
    const before = this.enuParams.yawRad;
    this.enuParams.yawRad += deltaRad;
    this.tracker.logYawAdjustment(before, this.enuParams.yawRad);
    this.applyTransformation();
    console.log(`Yaw adjusted to: ${(this.enuParams.yawRad * 180 / Math.PI).toFixed(1)}°`);
  }

  public adjustPitch(deltaRad: number): void {
    if (this.enuParams.tiltLocked) {
      console.log(`⚠️ Pitch adjustment blocked: tilt is locked (plane-fitted)`);
      return;
    }
    const before = this.enuParams.pitchRad;
    this.enuParams.pitchRad += deltaRad;
    this.tracker.logPitchAdjustment(before, this.enuParams.pitchRad);
    this.applyTransformation();
    console.log(`Pitch adjusted to: ${(this.enuParams.pitchRad * 180 / Math.PI).toFixed(1)}°`);
  }

  public adjustRoll(deltaRad: number): void {
    if (this.enuParams.tiltLocked) {
      console.log(`⚠️ Roll adjustment blocked: tilt is locked (plane-fitted)`);
      return;
    }
    const before = this.enuParams.rollRad;
    this.enuParams.rollRad += deltaRad;
    this.tracker.logRollAdjustment(before, this.enuParams.rollRad);
    this.applyTransformation();
    console.log(`Roll adjusted to: ${(this.enuParams.rollRad * 180 / Math.PI).toFixed(1)}°`);
  }

  public adjustPosition(deltaEast: number, deltaNorth: number, deltaUp: number = 0): void {
    const beforeE = this.enuParams.tEast;
    const beforeN = this.enuParams.tNorth;
    const beforeU = this.enuParams.tUp;

    this.enuParams.tEast += deltaEast;
    this.enuParams.tNorth += deltaNorth;
    this.enuParams.tUp += deltaUp;

    this.tracker.logPositionAdjustment(beforeE, beforeN, beforeU, this.enuParams.tEast, this.enuParams.tNorth, this.enuParams.tUp);
    this.applyTransformation();
    console.log(`Position adjusted: E=${this.enuParams.tEast.toFixed(3)}, N=${this.enuParams.tNorth.toFixed(3)}, U=${this.enuParams.tUp.toFixed(3)}`);
  }

  // Lock tilt using plane fitting
  public lockTilt(groundPoints?: Array<[number, number, number]>): void {
    if (!groundPoints || groundPoints.length < 3) {
      console.warn('Insufficient ground points for plane fitting');
      return;
    }

    try {
      const alignment = alignGroundToUp(groundPoints);

      // Cache the alignment rotation and lock tilt
      this.enuParams.alignRotation = alignment.alignMatrix;
      this.enuParams.tiltLocked = true;

      // Reset pitch/roll to zero (they're now baked into R_align)
      this.enuParams.pitchRad = 0;
      this.enuParams.rollRad = 0;

      this.applyTransformation();

      // Disable matrix auto-update to prevent interference
      if (this.splatLayer.scene) {
        this.splatLayer.scene.matrixAutoUpdate = false;
      }

      console.log(`✅ Tilt locked: alignment cached, pitch/roll zeroed, yaw preserved: ${(this.enuParams.yawRad * 180 / Math.PI).toFixed(1)}°`);

      // Verify alignment worked
      setTimeout(() => this.logResidualTilt(), 100);
    } catch (error) {
      console.error('Plane fitting failed:', error);
    }
  }

  // Road width calibration
  public calibrateScaleFromRoadWidth(trueWidthMeters: number, measuredWidthUnits: number): void {
    try {
      const newScale = metersPerUnitFromRoadWidth({ trueWidthMeters, measuredWidthUnits });
      this.enuParams.scale = newScale;
      this.applyTransformation();
      console.log(`Scale calibrated from road width: ${newScale.toFixed(3)} m/unit`);
    } catch (error) {
      console.error('Road width calibration failed:', error);
    }
  }

  // Get current ENU parameters (for debugging/inspection)
  public getEnuParams(): EnuParams {
    return { ...this.enuParams };
  }

  // Verify tilt alignment (debugging helper)
  public logResidualTilt(): void {
    if (!this.enuParams.tiltLocked || !this.enuParams.alignRotation) {
      console.log('🔍 Tilt verification: Not tilt-locked');
      return;
    }

    // Extract the final world matrix
    const worldMatrix = composeModelMatrixENU(this.anchor, this.enuParams);
    const array = Cesium.Matrix4.toArray(worldMatrix);

    // Extract rotation part (upper-left 3x3)
    const R = [
      array[0], array[1], array[2],
      array[4], array[5], array[6],
      array[8], array[9], array[10]
    ];

    // Check if Z-axis is close to [0,0,1] (pointing up)
    const zAxis = [R[2], R[5], R[8]];
    const upVector = [0, 0, 1];
    const dot = zAxis[0] * upVector[0] + zAxis[1] * upVector[1] + zAxis[2] * upVector[2];
    const tiltAngleDeg = Math.acos(Math.abs(dot)) * 180 / Math.PI;

    console.log(`🔍 Tilt verification:`, {
      tiltLocked: true,
      zAxis: zAxis.map(v => v.toFixed(4)),
      dotWithUp: dot.toFixed(4),
      residualTiltDeg: tiltAngleDeg.toFixed(2),
      yawDeg: (this.enuParams.yawRad * 180 / Math.PI).toFixed(1),
      isAligned: tiltAngleDeg < 5.0 ? '✅' : '❌'
    });
  }

  // Set ENU parameters directly
  public setEnuParams(params: Partial<EnuParams>): void {
    // Protect tilt lock from being overwritten
    if (this.enuParams.tiltLocked) {
      const { pitchRad, rollRad, alignRotation, tiltLocked, ...safeParams } = params;
      if (pitchRad !== undefined || rollRad !== undefined) {
        console.log(`⚠️ Pitch/Roll changes blocked: tilt is locked`);
      }
      Object.assign(this.enuParams, safeParams);
    } else {
      Object.assign(this.enuParams, params);
    }
    this.applyTransformation();
  }

  // Check if V2 is enabled
  public static isV2Enabled(): boolean {
    return ALIGNMENT_V2;
  }
}