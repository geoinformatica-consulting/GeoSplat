// src/types/alignment.ts
export type EnuParams = {
  scale: number;     // meters per splat unit (uniform for now)
  yawRad: number;    // about Up (Z_ENU)
  pitchRad: number;  // about East (X_ENU)
  rollRad: number;   // about North (Y_ENU)
  tEast: number;     // meters
  tNorth: number;    // meters
  tUp: number;       // meters
  tiltLocked?: boolean; // if true, only yaw allowed
  alignRotation?: number[]; // cached R_align matrix (3x3 flattened)
};

export type Vec3 = [number, number, number];

export type PlaneAlignment = {
  quat: [number, number, number, number]; // [x,y,z,w] quaternion
  pitchRad: number;
  rollRad: number;
  alignMatrix: number[]; // 3x3 rotation matrix as flat array
};