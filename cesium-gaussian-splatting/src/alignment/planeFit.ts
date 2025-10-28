// src/alignment/planeFit.ts
import { Vec3, PlaneAlignment } from "../types/alignment";

export function estimatePlaneNormal(points: Vec3[]): Vec3 {
  if (points.length < 3) throw new Error("Need at least 3 points for plane fitting");

  // Compute centroid
  const centroid: Vec3 = [0, 0, 0];
  for (const p of points) {
    centroid[0] += p[0];
    centroid[1] += p[1];
    centroid[2] += p[2];
  }
  centroid[0] /= points.length;
  centroid[1] /= points.length;
  centroid[2] /= points.length;

  // Center points and build covariance matrix
  const centered = points.map(p => [p[0] - centroid[0], p[1] - centroid[1], p[2] - centroid[2]] as Vec3);

  // 3x3 covariance matrix
  const cov = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0]
  ];

  for (const p of centered) {
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        cov[i][j] += p[i] * p[j];
      }
    }
  }

  // Scale by number of points
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      cov[i][j] /= points.length;
    }
  }

  // Find eigenvector with smallest eigenvalue using simplified power iteration
  // For plane fitting, we want the eigenvector corresponding to the smallest eigenvalue
  let normal: Vec3 = [0, 0, 1]; // Initial guess

  // Simple approach: the normal is approximately the direction with minimal variance
  // Use the cross product of two principal directions for robustness
  if (centered.length >= 2) {
    const v1 = centered[0];
    const v2 = centered[1];
    normal = crossProduct(v1, v2);
    normal = normalize(normal);
  }

  // Ensure normal points roughly upward (positive Z component)
  if (normal[2] < 0) {
    normal = [-normal[0], -normal[1], -normal[2]];
  }

  return normal;
}

export function quaternionBetween(a: Vec3, b: Vec3): [number, number, number, number] {
  const aNorm = normalize(a);
  const bNorm = normalize(b);

  const dot = aNorm[0] * bNorm[0] + aNorm[1] * bNorm[1] + aNorm[2] * bNorm[2];

  // Vectors are already aligned
  if (dot > 0.999999) {
    return [0, 0, 0, 1];
  }

  // Vectors are opposite
  if (dot < -0.999999) {
    // Find orthogonal vector
    let orthogonal: Vec3 = [1, 0, 0];
    if (Math.abs(aNorm[0]) > 0.9) {
      orthogonal = [0, 1, 0];
    }
    const cross = crossProduct(aNorm, orthogonal);
    const crossNorm = normalize(cross);
    return [crossNorm[0], crossNorm[1], crossNorm[2], 0];
  }

  const cross = crossProduct(aNorm, bNorm);
  const s = Math.sqrt((1 + dot) * 2);
  const invs = 1 / s;

  return [
    cross[0] * invs,
    cross[1] * invs,
    cross[2] * invs,
    s * 0.5
  ];
}

export function alignGroundToUp(points: Vec3[]): PlaneAlignment {
  const normal = estimatePlaneNormal(points);
  const up: Vec3 = [0, 0, 1];

  const quat = quaternionBetween(normal, up);

  // Extract pitch and roll from quaternion
  // For small angles, we can approximate
  const [x, y, z, w] = quat;

  // Convert quaternion to Euler angles (pitch around X, roll around Y)
  const pitchRad = Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y));
  const rollRad = Math.atan2(2 * (w * y - z * x), 1 - 2 * (y * y + z * z));

  // Convert quaternion to rotation matrix (R_align in ENU frame)
  const alignMatrix = quaternionToMatrix3(quat);

  return {
    quat,
    pitchRad,
    rollRad,
    alignMatrix: alignMatrix  // 3x3 matrix as flat array
  };
}

// Helper functions
function crossProduct(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function normalize(v: Vec3): Vec3 {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  if (len < 1e-10) return [0, 0, 1];
  return [v[0] / len, v[1] / len, v[2] / len];
}

function quaternionToMatrix3(quat: [number, number, number, number]): number[] {
  const [x, y, z, w] = quat;

  // Convert quaternion to 3x3 rotation matrix
  const xx = x * x, yy = y * y, zz = z * z;
  const xy = x * y, xz = x * z, yz = y * z;
  const wx = w * x, wy = w * y, wz = w * z;

  // Row-major 3x3 matrix as flat array
  return [
    1 - 2 * (yy + zz), 2 * (xy - wz),     2 * (xz + wy),
    2 * (xy + wz),     1 - 2 * (xx + zz), 2 * (yz - wx),
    2 * (xz - wy),     2 * (yz + wx),     1 - 2 * (xx + yy)
  ];
}