// src/alignment/qc/qcController.ts
import * as Cesium from 'cesium';
import * as THREE from 'three';
import { QCPointPair, QCStats, computeQCStats, exportCSV, serializeQCData, deserializeQCData, QCPersistData } from './qcStats';

export type QCMode = 'idle' | 'awaiting_truth' | 'awaiting_splat';

export class QCController {
  private cesiumViewer: Cesium.Viewer;
  private splatScene: THREE.Scene;
  private anchor: { lat: number; lon: number; height: number };
  private enuTransform: { ecefToEnu: Cesium.Matrix4; enuToEcef: Cesium.Matrix4 };

  private pairs: QCPointPair[] = [];
  private stats: QCStats | null = null;
  private mode: QCMode = 'idle';
  private pendingTruth: { ecef: Cesium.Cartesian3; enu: [number, number, number] } | null = null;

  private siteId: string;
  public showVectors: boolean = true;
  public onUpdate?: () => void;  // Callback for UI updates

  constructor(
    cesiumViewer: Cesium.Viewer,
    splatScene: THREE.Scene,
    anchor: { lat: number; lon: number; height: number },
    siteId: string = 'default'
  ) {
    this.cesiumViewer = cesiumViewer;
    this.splatScene = splatScene;
    this.anchor = anchor;
    this.siteId = siteId;

    // Compute ENU transform (same as alignment)
    const anchorECEF = Cesium.Cartesian3.fromDegrees(anchor.lon, anchor.lat, anchor.height);
    const ecefToEnu = Cesium.Transforms.eastNorthUpToFixedFrame(anchorECEF);
    const enuToEcef = Cesium.Matrix4.inverse(ecefToEnu, new Cesium.Matrix4());
    this.enuTransform = { ecefToEnu, enuToEcef };

    // Load from localStorage
    this.loadFromLocalStorage();
  }

  public getMode(): QCMode {
    return this.mode;
  }

  public getPairs(): QCPointPair[] {
    return this.pairs;
  }

  public getStats(): QCStats | null {
    return this.stats;
  }

  // Pick truth point (key 1)
  public pickTruthPoint(): void {
    this.mode = 'awaiting_truth';
    console.log('🎯 QC: Mode set to awaiting_truth. Click on globe to pick TRUTH point');
    if (this.onUpdate) this.onUpdate();
  }

  // Pick splat point (key 2)
  public pickSplatPoint(): void {
    if (!this.pendingTruth) {
      console.warn('⚠️ QC: Pick truth point first (press 1)');
      return;
    }
    this.mode = 'awaiting_splat';
    console.log('🎯 QC: Mode set to awaiting_splat. Click on SPLAT to pick splat point');
    if (this.onUpdate) this.onUpdate();
  }

  // Handle click events
  public handleClick(position: Cesium.Cartesian2): boolean {
    console.log('🖱️ QC: handleClick called, mode:', this.mode, 'position:', position);
    if (this.mode === 'idle') {
      console.log('⚠️ QC: Mode is idle, ignoring click');
      return false;
    }

    if (this.mode === 'awaiting_truth') {
      console.log('📍 QC: Handling truth click...');
      return this.handleTruthClick(position);
    } else if (this.mode === 'awaiting_splat') {
      console.log('📍 QC: Handling splat click...');
      return this.handleSplatClick(position);
    }
    return false;
  }

  private handleTruthClick(position: Cesium.Cartesian2): boolean {
    console.log('📍 QC: Getting pick ray from camera...');
    // Pick position on globe
    const ray = this.cesiumViewer.camera.getPickRay(position);
    if (!ray) {
      console.warn('⚠️ QC: Failed to get pick ray');
      this.mode = 'idle';
      return false;
    }

    console.log('📍 QC: Picking globe position...');
    const ecef = this.cesiumViewer.scene.globe.pick(ray, this.cesiumViewer.scene);
    if (!ecef) {
      console.warn('⚠️ QC: Failed to pick globe position (did you click on the globe?)');
      this.mode = 'idle';
      if (this.onUpdate) this.onUpdate();
      return false;
    }

    // Convert to ENU
    const enu = this.ecefToENU(ecef);

    this.pendingTruth = { ecef, enu };
    this.mode = 'idle';
    console.log(`✅ Truth point picked: ENU [${enu[0].toFixed(2)}, ${enu[1].toFixed(2)}, ${enu[2].toFixed(2)}]`);
    console.log('💡 QC: Now press 2 to pick the corresponding splat point');
    if (this.onUpdate) this.onUpdate();
    return true;
  }

  private handleSplatClick(position: Cesium.Cartesian2): boolean {
    console.log('📍 QC: Getting pick ray from camera...');
    // Pick position on splat
    const ray = this.cesiumViewer.camera.getPickRay(position);
    if (!ray) {
      console.warn('⚠️ QC: Failed to get pick ray');
      this.mode = 'idle';
      if (this.onUpdate) this.onUpdate();
      return false;
    }

    // First try picking the splat mesh
    console.log('📍 QC: Trying to pick object in scene...');
    const pickedObject = this.cesiumViewer.scene.pick(position);
    console.log('📍 QC: Picked object:', pickedObject);

    // If we didn't hit anything, try scene.pickPosition
    let ecef: Cesium.Cartesian3 | undefined;

    if (pickedObject && pickedObject.primitive) {
      console.log('📍 QC: Object picked, getting position...');
      // We hit something - use pickPosition
      ecef = this.cesiumViewer.scene.pickPosition(position);
      console.log('📍 QC: pickPosition result:', ecef);
    }

    if (!ecef) {
      console.warn('⚠️ QC: Failed to pick splat position (make sure to click directly on the splat mesh)');
      this.mode = 'idle';
      if (this.onUpdate) this.onUpdate();
      return false;
    }

    // Convert to ENU
    const splatENU = this.ecefToENU(ecef);

    // Create pair
    console.log('📍 QC: Creating point pair...');
    const pair = this.createPair(this.pendingTruth!.ecef, this.pendingTruth!.enu, ecef, splatENU);
    this.pairs.push(pair);

    // Recompute stats
    this.stats = computeQCStats(this.pairs);

    // Reset state
    this.pendingTruth = null;
    this.mode = 'idle';

    console.log(`✅ Pair added (${this.pairs.length}): error = ${pair.error2D.toFixed(3)} m (2D), ${pair.error3D.toFixed(3)} m (3D)`);

    // Notify UI
    if (this.onUpdate) this.onUpdate();

    // Save to localStorage
    this.saveToLocalStorage();

    return true;
  }

  private createPair(
    truthECEF: Cesium.Cartesian3,
    truthENU: [number, number, number],
    splatECEF: Cesium.Cartesian3,
    splatENU: [number, number, number]
  ): QCPointPair {
    const errorENU: [number, number, number] = [
      splatENU[0] - truthENU[0],
      splatENU[1] - truthENU[1],
      splatENU[2] - truthENU[2]
    ];

    const error2D = Math.sqrt(errorENU[0] ** 2 + errorENU[1] ** 2);
    const error3D = Math.sqrt(errorENU[0] ** 2 + errorENU[1] ** 2 + errorENU[2] ** 2);

    return {
      truthECEF,
      splatECEF,
      truthENU,
      splatENU,
      errorENU,
      error2D,
      error3D,
      timestamp: Date.now()
    };
  }

  private ecefToENU(ecef: Cesium.Cartesian3): [number, number, number] {
    const enuVec = Cesium.Matrix4.multiplyByPoint(
      this.enuTransform.ecefToEnu,
      ecef,
      new Cesium.Cartesian3()
    );
    return [enuVec.x, enuVec.y, enuVec.z];
  }

  private enuToECEF(enu: [number, number, number]): Cesium.Cartesian3 {
    const enuVec = new Cesium.Cartesian3(enu[0], enu[1], enu[2]);
    return Cesium.Matrix4.multiplyByPoint(
      this.enuTransform.enuToEcef,
      enuVec,
      new Cesium.Cartesian3()
    );
  }

  // Clear all pairs
  public clearPairs(): void {
    this.pairs = [];
    this.stats = null;
    this.pendingTruth = null;
    this.mode = 'idle';

    if (this.onUpdate) this.onUpdate();
    this.saveToLocalStorage();

    console.log('🗑️ QC: All pairs cleared');
  }

  // Export CSV
  public exportToCSV(): string {
    return exportCSV(this.pairs);
  }

  // Download CSV
  public downloadCSV(): void {
    const csv = this.exportToCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qc_${this.siteId}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    console.log(`📥 CSV exported: ${this.pairs.length} pairs`);
  }

  // Persistence
  private saveToLocalStorage(): void {
    const data = serializeQCData(this.pairs, this.stats);
    localStorage.setItem(`qc:${this.siteId}`, JSON.stringify(data));
  }

  private loadFromLocalStorage(): void {
    const stored = localStorage.getItem(`qc:${this.siteId}`);
    if (stored) {
      try {
        const data: QCPersistData = JSON.parse(stored);
        this.pairs = deserializeQCData(data);
        this.stats = computeQCStats(this.pairs);
        console.log(`📂 QC: Loaded ${this.pairs.length} pairs from localStorage`);
      } catch (e) {
        console.warn('⚠️ QC: Failed to load from localStorage', e);
      }
    }
  }

  public async saveToFile(): Promise<void> {
    const data = serializeQCData(this.pairs, this.stats);
    const json = JSON.stringify(data, null, 2);

    // Save to public/alignments/<SITE_ID>/qc.json
    const dirPath = `public/alignments/${this.siteId}`;
    const filePath = `${dirPath}/qc.json`;

    try {
      // Create directory if needed (browser can't do this, log instruction)
      console.log(`📁 QC: To persist, save this JSON to ${filePath}:`);
      console.log(json);

      // Also trigger download
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qc_${this.siteId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('⚠️ QC: Failed to save file', e);
    }
  }

  public toggleVectors(): void {
    this.showVectors = !this.showVectors;
    console.log(`🔄 QC: Vectors ${this.showVectors ? 'shown' : 'hidden'}`);
    if (this.onUpdate) this.onUpdate();
  }
}
