// GCP Validation - Compare splat alignment against ground truth points
import * as Cesium from "cesium";
import * as THREE from "three";

export interface GCP {
  name: string;
  longitude: number;
  latitude: number;
  elevation: number;
}

export interface GCPValidationPair {
  gcp: GCP;
  splatPoint: THREE.Vector3; // Position in splat local space
  worldPoint: THREE.Vector3; // GCP position in ECEF
  error?: number; // Distance error in meters
}

/**
 * Parse GCP CSV file (Emlid Reach format)
 */
export function parseGCPCSV(csvText: string): GCP[] {
  const lines = csvText.trim().split('\n');

  if (lines.length < 2) {
    throw new Error('CSV file is empty or has no data rows');
  }

  // Parse header to find column indices
  const header = lines[0].split(',');
  const nameIdx = header.indexOf('Name');
  const lonIdx = header.indexOf('Longitude');
  const latIdx = header.indexOf('Latitude');
  const elevIdx = header.indexOf('Elevation');

  if (nameIdx === -1 || lonIdx === -1 || latIdx === -1 || elevIdx === -1) {
    throw new Error('CSV missing required columns: Name, Longitude, Latitude, Elevation');
  }

  const gcps: GCP[] = [];

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split(',');

    const gcp: GCP = {
      name: cols[nameIdx],
      longitude: parseFloat(cols[lonIdx]),
      latitude: parseFloat(cols[latIdx]),
      elevation: parseFloat(cols[elevIdx])
    };

    // Validate
    if (isNaN(gcp.longitude) || isNaN(gcp.latitude) || isNaN(gcp.elevation)) {
      console.warn(`⚠️ Skipping invalid GCP at line ${i + 1}:`, line);
      continue;
    }

    gcps.push(gcp);
  }

  console.log(`✅ Parsed ${gcps.length} GCPs from CSV`);
  return gcps;
}

/**
 * Calculate validation errors for GCP pairs
 * This does NOT modify the splat - only measures accuracy
 */
export function calculateValidationErrors(
  pairs: GCPValidationPair[],
  splatScene: THREE.Scene
): {
  pairs: GCPValidationPair[];
  rmse: number;
  meanError: number;
  maxError: number;
  minError: number;
} {
  if (pairs.length === 0) {
    return { pairs: [], rmse: 0, meanError: 0, maxError: 0, minError: 0 };
  }

  // Update world matrix for the scene
  splatScene.updateMatrixWorld(true);

  // Find splat mesh to get its transform
  let splatMesh: THREE.Object3D | null = null;
  splatScene.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj.geometry) {
      splatMesh = obj;
    }
  });

  if (!splatMesh) {
    console.error('❌ Could not find splat mesh for validation');
    return { pairs: [], rmse: 0, meanError: 0, maxError: 0, minError: 0 };
  }

  let sumSquaredError = 0;
  let sumError = 0;
  let maxError = 0;
  let minError = Infinity;

  const updatedPairs: GCPValidationPair[] = [];

  for (const pair of pairs) {
    // Transform splat point to world space
    const splatWorld = pair.splatPoint.clone();
    splatMesh.localToWorld(splatWorld);

    // GCP world position (already computed and stored)
    const gcpWorld = pair.worldPoint;

    // Calculate error (distance in meters)
    const error = splatWorld.distanceTo(gcpWorld);

    updatedPairs.push({
      ...pair,
      error: error
    });

    sumSquaredError += error * error;
    sumError += error;
    maxError = Math.max(maxError, error);
    minError = Math.min(minError, error);
  }

  const rmse = Math.sqrt(sumSquaredError / pairs.length);
  const meanError = sumError / pairs.length;

  return {
    pairs: updatedPairs,
    rmse,
    meanError,
    maxError,
    minError
  };
}

/**
 * Convert GCP to ECEF (Earth-Centered Earth-Fixed) world coordinates
 */
export function gcpToWorldPoint(gcp: GCP): THREE.Vector3 {
  const cartesian = Cesium.Cartesian3.fromDegrees(
    gcp.longitude,
    gcp.latitude,
    gcp.elevation
  );
  return new THREE.Vector3(cartesian.x, cartesian.y, cartesian.z);
}
