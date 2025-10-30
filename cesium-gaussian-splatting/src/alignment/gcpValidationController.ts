// GCP Validation Controller - UI for measuring splat accuracy
import * as Cesium from "cesium";
import * as THREE from "three";
import {
  GCP,
  GCPValidationPair,
  parseGCPCSV,
  calculateValidationErrors,
  gcpToWorldPoint
} from "./gcpValidation";

export class GCPValidationController {
  private gcps: GCP[] = [];
  private pairs: GCPValidationPair[] = [];
  private currentGCPIndex: number = 0;
  private viewer: Cesium.Viewer;
  private splatScene: THREE.Scene;
  private pickingMode: 'idle' | 'picking' = 'idle';
  private currentErrors: {
    rmse: number;
    meanError: number;
    maxError: number;
    minError: number;
  } | null = null;

  constructor(viewer: Cesium.Viewer, splatScene: THREE.Scene) {
    this.viewer = viewer;
    this.splatScene = splatScene;

    // Try to load saved data
    this.loadFromStorage();
  }

  /**
   * Load GCP CSV file
   */
  public async loadGCPFile(): Promise<void> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.csv';

      input.onchange = async (e: Event) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) {
          reject(new Error('No file selected'));
          return;
        }

        const text = await file.text();

        try {
          this.gcps = parseGCPCSV(text);
          this.currentGCPIndex = 0;
          this.pairs = [];
          this.currentErrors = null;

          console.log(`✅ Loaded ${this.gcps.length} GCPs for validation`);
          console.log('📋 GCP names:', this.gcps.map(g => g.name).join(', '));

          // Save to localStorage
          this.saveToStorage();

          resolve();
        } catch (error) {
          reject(error);
        }
      };

      input.click();
    });
  }

  /**
   * Start picking mode for next GCP
   */
  public startPickingNextGCP(): void {
    if (this.gcps.length === 0) {
      console.error('❌ No GCPs loaded. Load CSV first with Shift+V');
      return;
    }

    if (this.currentGCPIndex >= this.gcps.length) {
      console.log('✅ All GCPs have been picked!');
      console.log(`📊 Total pairs: ${this.pairs.length}`);
      this.calculateErrors();
      return;
    }

    this.pickingMode = 'picking';
    const gcp = this.gcps[this.currentGCPIndex];

    console.log(`🎯 Pick GCP "${gcp.name}" in the splat`);
    console.log(`   Lat: ${gcp.latitude.toFixed(6)}, Lon: ${gcp.longitude.toFixed(6)}, Elev: ${gcp.elevation.toFixed(2)}m`);
    console.log(`   Progress: ${this.currentGCPIndex + 1} of ${this.gcps.length}`);
  }

  /**
   * Handle click event when in picking mode
   */
  public handleClick(clickPosition: Cesium.Cartesian2): boolean {
    if (this.pickingMode !== 'picking') {
      return false;
    }

    // Pick position in 3D
    const pickedPosition = this.viewer.scene.pickPosition(clickPosition);

    if (!pickedPosition) {
      console.warn('⚠️ Could not pick 3D position. Try clicking directly on the splat.');
      return true; // Consumed the click even if unsuccessful
    }

    // Convert picked position to splat local space
    const worldPos = new THREE.Vector3(pickedPosition.x, pickedPosition.y, pickedPosition.z);

    // Find the splat mesh
    let splatMesh: THREE.Object3D | null = null;
    this.splatScene.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.geometry) {
        splatMesh = obj;
      }
    });

    if (!splatMesh) {
      console.error('❌ Could not find splat mesh');
      return true;
    }

    // Transform to local space
    const localPos = worldPos.clone();
    splatMesh.worldToLocal(localPos);

    // Create validation pair
    const gcp = this.gcps[this.currentGCPIndex];
    const pair: GCPValidationPair = {
      gcp: gcp,
      splatPoint: localPos,
      worldPoint: gcpToWorldPoint(gcp)
    };

    this.pairs.push(pair);

    console.log(`✅ Paired GCP "${gcp.name}" with splat position`);
    console.log(`   Local: (${localPos.x.toFixed(3)}, ${localPos.y.toFixed(3)}, ${localPos.z.toFixed(3)})`);
    console.log(`   Progress: ${this.pairs.length}/${this.gcps.length}`);

    // Save to localStorage
    this.saveToStorage();

    // Move to next GCP
    this.currentGCPIndex++;
    this.pickingMode = 'idle';

    // Auto-start next pick if more GCPs remain
    if (this.currentGCPIndex < this.gcps.length) {
      setTimeout(() => this.startPickingNextGCP(), 500);
    } else {
      console.log('🎉 All GCPs picked! Calculating validation errors...');
      this.calculateErrors();
    }

    return true;
  }

  /**
   * Calculate and display validation errors
   */
  public calculateErrors(): void {
    if (this.pairs.length === 0) {
      console.warn('⚠️ No GCP pairs to validate');
      return;
    }

    const result = calculateValidationErrors(this.pairs, this.splatScene);

    this.currentErrors = {
      rmse: result.rmse,
      meanError: result.meanError,
      maxError: result.maxError,
      minError: result.minError
    };

    // Update pairs with error values
    this.pairs = result.pairs;

    console.log('\n' + '='.repeat(70));
    console.log('📊 GCP VALIDATION RESULTS');
    console.log('='.repeat(70));
    console.log(`Total pairs: ${this.pairs.length}`);
    console.log(`RMSE (Root Mean Square Error): ${result.rmse.toFixed(3)} meters`);
    console.log(`Mean Error: ${result.meanError.toFixed(3)} meters`);
    console.log(`Max Error: ${result.maxError.toFixed(3)} meters`);
    console.log(`Min Error: ${result.minError.toFixed(3)} meters`);
    console.log('='.repeat(70));
    console.log('\nIndividual errors:');

    for (const pair of this.pairs) {
      console.log(`  ${pair.gcp.name}: ${pair.error?.toFixed(3)} m`);
    }

    console.log('='.repeat(70) + '\n');
  }

  /**
   * Get current picking mode
   */
  public getMode(): 'idle' | 'picking' {
    return this.pickingMode;
  }

  /**
   * Get all validation pairs
   */
  public getPairs(): GCPValidationPair[] {
    return this.pairs;
  }

  /**
   * Get current errors
   */
  public getErrors() {
    return this.currentErrors;
  }

  /**
   * Clear all pairs and reset
   */
  public clearPairs(): void {
    this.pairs = [];
    this.currentGCPIndex = 0;
    this.pickingMode = 'idle';
    this.currentErrors = null;
    this.saveToStorage();
    console.log('🗑️ Cleared all GCP validation pairs');
  }

  /**
   * Export validation results to CSV
   */
  public exportValidationCSV(): void {
    if (this.pairs.length === 0) {
      console.error('❌ No validation pairs to export');
      return;
    }

    // Recalculate to ensure errors are current
    const result = calculateValidationErrors(this.pairs, this.splatScene);

    let csv = 'GCP Name,Longitude,Latitude,Elevation,Error (m)\n';

    for (const pair of result.pairs) {
      csv += `${pair.gcp.name},${pair.gcp.longitude},${pair.gcp.latitude},${pair.gcp.elevation},${pair.error?.toFixed(3) || 'N/A'}\n`;
    }

    csv += '\n';
    csv += `RMSE,${result.rmse.toFixed(3)}\n`;
    csv += `Mean Error,${result.meanError.toFixed(3)}\n`;
    csv += `Max Error,${result.maxError.toFixed(3)}\n`;
    csv += `Min Error,${result.minError.toFixed(3)}\n`;

    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gcp-validation-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    console.log('✅ Exported validation results to CSV');
  }

  /**
   * Save to localStorage
   */
  private saveToStorage(): void {
    if (this.gcps.length > 0) {
      localStorage.setItem('gcpValidation_gcps', JSON.stringify(this.gcps));
    }

    if (this.pairs.length > 0) {
      const pairsData = this.pairs.map(p => ({
        gcpName: p.gcp.name,
        splatPoint: [p.splatPoint.x, p.splatPoint.y, p.splatPoint.z],
        worldPoint: [p.worldPoint.x, p.worldPoint.y, p.worldPoint.z]
      }));
      localStorage.setItem('gcpValidation_pairs', JSON.stringify(pairsData));
      localStorage.setItem('gcpValidation_index', this.currentGCPIndex.toString());
    }
  }

  /**
   * Load from localStorage
   */
  private loadFromStorage(): void {
    const savedGCPs = localStorage.getItem('gcpValidation_gcps');
    const savedPairs = localStorage.getItem('gcpValidation_pairs');
    const savedIndex = localStorage.getItem('gcpValidation_index');

    if (!savedGCPs) {
      return;
    }

    try {
      this.gcps = JSON.parse(savedGCPs);

      if (savedPairs) {
        const pairsData = JSON.parse(savedPairs);
        this.pairs = pairsData.map((pd: any) => {
          const gcp = this.gcps.find(g => g.name === pd.gcpName);
          if (!gcp) throw new Error(`GCP ${pd.gcpName} not found`);

          return {
            gcp: gcp,
            splatPoint: new THREE.Vector3(pd.splatPoint[0], pd.splatPoint[1], pd.splatPoint[2]),
            worldPoint: new THREE.Vector3(pd.worldPoint[0], pd.worldPoint[1], pd.worldPoint[2])
          };
        });
      }

      if (savedIndex) {
        this.currentGCPIndex = parseInt(savedIndex);
      }

      console.log(`✅ Loaded ${this.gcps.length} saved GCPs for validation`);
      if (this.pairs.length > 0) {
        console.log(`✅ Loaded ${this.pairs.length} saved validation pairs`);
      }
    } catch (error) {
      console.error('❌ Failed to load saved validation data:', error);
    }
  }
}
