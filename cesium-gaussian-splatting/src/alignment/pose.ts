/**
 * Pose persistence utilities for saving/loading splat transforms
 */

export interface SplatPose {
  version?: number;
  anchor: {
    lon: number;
    lat: number;
    alt: number;
  };
  modelMatrix?: number[]; // Legacy format
  modelMatrixColumnMajor?: number[]; // 16 floats, column-major (THREE.js standard)
  units?: string;
  handedness?: string;
  axis?: string;
  notes?: string;
  timestamp?: string;
}

export interface PoseValidationConfig {
  minAltitude: number;
  maxAltitude: number;
  minScale: number;
  maxScale: number;
  checkDeterminant: boolean;
}

export const DEFAULT_VALIDATION_CONFIG: PoseValidationConfig = {
  minAltitude: -500,
  maxAltitude: 6000,
  minScale: 1e-4,
  maxScale: 1e4,
  checkDeterminant: true
};

/**
 * Convert a THREE.Matrix4 to a flat array (column-major)
 */
export function toJSON(matrix: any): number[] {
  return matrix.elements.slice(); // THREE.js stores column-major
}

/**
 * Create a THREE.Matrix4 from a flat array
 */
export function fromJSON(elements: number[]): any {
  const THREE = (window as any).THREE;
  if (!THREE) throw new Error('THREE.js not available');

  const matrix = new THREE.Matrix4();
  matrix.fromArray(elements);
  return matrix;
}

/**
 * Validate pose data
 */
export function validatePose(
  pose: SplatPose,
  config: PoseValidationConfig = DEFAULT_VALIDATION_CONFIG
): { valid: boolean; reason?: string } {
  // Check anchor altitude
  if (pose.anchor.alt < config.minAltitude || pose.anchor.alt > config.maxAltitude) {
    return {
      valid: false,
      reason: `Anchor altitude ${pose.anchor.alt}m outside range [${config.minAltitude}, ${config.maxAltitude}]`
    };
  }

  // Get matrix elements (support both old and new format)
  const elements = pose.modelMatrixColumnMajor || pose.modelMatrix;
  if (!elements || elements.length !== 16) {
    return { valid: false, reason: 'Invalid matrix: must have 16 elements' };
  }

  // Check all elements are finite
  if (!elements.every(isFinite)) {
    return { valid: false, reason: 'Matrix contains non-finite values' };
  }

  // Extract scale from the matrix (length of basis vectors)
  const scaleX = Math.sqrt(elements[0] * elements[0] + elements[1] * elements[1] + elements[2] * elements[2]);
  const scaleY = Math.sqrt(elements[4] * elements[4] + elements[5] * elements[5] + elements[6] * elements[6]);
  const scaleZ = Math.sqrt(elements[8] * elements[8] + elements[9] * elements[9] + elements[10] * elements[10]);
  const avgScale = (scaleX + scaleY + scaleZ) / 3;

  if (avgScale < config.minScale || avgScale > config.maxScale) {
    return {
      valid: false,
      reason: `Matrix scale ${avgScale.toFixed(6)} outside range [${config.minScale}, ${config.maxScale}]`
    };
  }

  // Check determinant (should not be ~0)
  if (config.checkDeterminant) {
    const det = computeDeterminant3x3(elements);
    if (Math.abs(det) < 1e-10) {
      return { valid: false, reason: `Matrix determinant too close to zero: ${det}` };
    }
  }

  return { valid: true };
}

/**
 * Compute 3x3 determinant from 4x4 matrix (upper-left 3x3)
 */
function computeDeterminant3x3(m: number[]): number {
  return (
    m[0] * (m[5] * m[10] - m[6] * m[9]) -
    m[4] * (m[1] * m[10] - m[2] * m[9]) +
    m[8] * (m[1] * m[6] - m[2] * m[5])
  );
}

/**
 * Log matrix info for debugging
 */
export function logMatrixInfo(matrix: number[]): void {
  console.log('📐 Matrix info:');
  console.log('  Row 0:', matrix[0].toFixed(4), matrix[4].toFixed(4), matrix[8].toFixed(4), matrix[12].toFixed(4));
  console.log('  Row 1:', matrix[1].toFixed(4), matrix[5].toFixed(4), matrix[9].toFixed(4), matrix[13].toFixed(4));
  console.log('  Row 2:', matrix[2].toFixed(4), matrix[6].toFixed(4), matrix[10].toFixed(4), matrix[14].toFixed(4));

  const scaleX = Math.sqrt(matrix[0] * matrix[0] + matrix[1] * matrix[1] + matrix[2] * matrix[2]);
  const scaleY = Math.sqrt(matrix[4] * matrix[4] + matrix[5] * matrix[5] + matrix[6] * matrix[6]);
  const scaleZ = Math.sqrt(matrix[8] * matrix[8] + matrix[9] * matrix[9] + matrix[10] * matrix[10]);
  const uniformScale = (scaleX + scaleY + scaleZ) / 3;

  console.log(`  Scale: X=${scaleX.toFixed(4)}, Y=${scaleY.toFixed(4)}, Z=${scaleZ.toFixed(4)}`);
  console.log(`  Uniform scale: ${uniformScale.toFixed(4)}`);
}

/**
 * Save pose to manifest file with enhanced metadata
 */
export async function savePose(
  anchor: { lon: number; lat: number; alt: number },
  modelMatrix: any,
  notes?: string
): Promise<void> {
  const matrixArray = toJSON(modelMatrix);
  const pose: SplatPose = {
    version: 1,
    anchor,
    modelMatrixColumnMajor: matrixArray,
    units: 'meters',
    handedness: 'right',
    axis: 'Z-up',
    notes: notes || `Saved by user at ${new Date().toISOString()}`,
    timestamp: new Date().toISOString()
  };

  const json = JSON.stringify(pose, null, 2);

  // Download as file (browser can't write to public/ directly)
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'splat-manifest.json';
  a.click();
  URL.revokeObjectURL(url);

  console.log('💾 Pose saved to splat-manifest.json');
  console.log('📋 Place this file in /public/ to auto-load on next startup');
  logMatrixInfo(matrixArray);
}

/**
 * Load and validate pose from manifest file
 */
export async function loadPose(
  url = '/splat-manifest.json',
  config: PoseValidationConfig = DEFAULT_VALIDATION_CONFIG
): Promise<SplatPose | null> {
  // Check for bypass flag
  if (localStorage.getItem('GEOSPLAT_BYPASS_POSE') === '1') {
    console.log('⚠️ GEOSPLAT_BYPASS_POSE flag set - skipping pose load');
    return null;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.log('ℹ️ No saved pose found at', url);
      return null;
    }

    const pose: SplatPose = await response.json();
    console.log('✅ Loaded saved pose from', url);
    console.log('📍 Anchor:', pose.anchor);
    console.log('📝 Notes:', pose.notes);

    // Validate the pose
    const validation = validatePose(pose, config);
    if (!validation.valid) {
      console.error('❌ Pose validation failed:', validation.reason);
      showToast(`⚠️ Pose file invalid — loaded defaults (press S to overwrite)\nReason: ${validation.reason}`);
      return null;
    }

    // Log matrix info
    const matrix = pose.modelMatrixColumnMajor || pose.modelMatrix;
    if (matrix) {
      logMatrixInfo(matrix);
    }

    console.log('✅ Pose validation passed');
    return pose;
  } catch (error) {
    console.error('❌ Could not load pose:', error);
    showToast('⚠️ Pose file invalid — loaded defaults (press S to overwrite)');
    return null;
  }
}

/**
 * Show a toast notification
 */
function showToast(message: string, duration: number = 5000): void {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: rgba(0, 0, 0, 0.85);
    color: white;
    padding: 16px 20px;
    border-radius: 8px;
    font-family: monospace;
    font-size: 13px;
    z-index: 10000;
    max-width: 400px;
    white-space: pre-wrap;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  `;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s';
    toast.style.opacity = '0';
    setTimeout(() => document.body.removeChild(toast), 300);
  }, duration);
}

/**
 * Apply a pose to a scene (THREE.js object)
 */
export function applyPose(scene: any, pose: SplatPose): void {
  const elements = pose.modelMatrixColumnMajor || pose.modelMatrix;
  if (!elements) {
    console.error('❌ No matrix data in pose');
    return;
  }
  const matrix = fromJSON(elements);
  scene.matrix.copy(matrix);
  scene.matrixAutoUpdate = false;
  console.log('✅ Applied saved pose to scene');
}

/**
 * Create an identity matrix with default scale
 */
export function createDefaultMatrix(scale: number = 1): any {
  const THREE = (window as any).THREE;
  if (!THREE) throw new Error('THREE.js not available');

  const matrix = new THREE.Matrix4();
  matrix.identity();
  matrix.scale(new THREE.Vector3(scale, scale, scale));
  return matrix;
}
