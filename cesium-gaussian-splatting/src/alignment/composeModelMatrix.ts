// src/alignment/composeModelMatrix.ts
import * as Cesium from "cesium";
import { EnuParams } from "../types/alignment";

// Cache for ENU transforms (keyed by "lat,lon,height")
const enuTransformCache = new Map<string, { ecefToEnu: Cesium.Matrix4; enuToEcef: Cesium.Matrix4 }>();

function getCachedEnuTransforms(anchor: { lat: number; lon: number; height: number }) {
  const key = `${anchor.lat.toFixed(8)},${anchor.lon.toFixed(8)},${anchor.height.toFixed(2)}`;

  if (!enuTransformCache.has(key)) {
    const anchorECEF = Cesium.Cartesian3.fromDegrees(anchor.lon, anchor.lat, anchor.height);
    const ecefToEnu = Cesium.Transforms.eastNorthUpToFixedFrame(anchorECEF);
    const enuToEcef = Cesium.Matrix4.inverse(ecefToEnu, new Cesium.Matrix4());

    enuTransformCache.set(key, { ecefToEnu, enuToEcef });
    console.log(`📍 Cached ENU transforms for anchor: ${key}`);
  }

  return enuTransformCache.get(key)!;
}

export function composeModelMatrixENU(
  anchor: { lat: number; lon: number; height: number },
  p: EnuParams
): Cesium.Matrix4 {
  // Use cached ENU transforms
  const { ecefToEnu, enuToEcef } = getCachedEnuTransforms(anchor);

  // Scale matrix
  const S = Cesium.Matrix4.fromScale(new Cesium.Cartesian3(p.scale, p.scale, p.scale));

  // V2 rotation: R_align * Rz_yaw only
  let R: Cesium.Matrix4;

  if (p.tiltLocked && p.alignRotation) {
    // Use cached alignment rotation + yaw only
    const alignMatrix = Cesium.Matrix3.fromArray(p.alignRotation);
    const yawMatrix = Cesium.Matrix3.fromRotationZ(p.yawRad);
    const finalRotation = Cesium.Matrix3.multiply(alignMatrix, yawMatrix, new Cesium.Matrix3());
    R = Cesium.Matrix4.fromRotation(finalRotation);
  } else {
    // Legacy: compose all three rotations
    const Rz = Cesium.Matrix3.fromRotationZ(p.yawRad);   // yaw about Up (Z)
    const Rx = Cesium.Matrix3.fromRotationX(p.pitchRad); // pitch about East (X)
    const Ry = Cesium.Matrix3.fromRotationY(p.rollRad);  // roll about North (Y)

    // Compose rotations: Rz * Rx * Ry
    let Rm = Cesium.Matrix3.multiply(Rz, Rx, new Cesium.Matrix3());
    Rm = Cesium.Matrix3.multiply(Rm, Ry, Rm);
    R = Cesium.Matrix4.fromRotation(Rm);
  }

  // Translation in ENU frame
  const T = Cesium.Matrix4.fromTranslation(new Cesium.Cartesian3(p.tEast, p.tNorth, p.tUp));

  // Compose in ENU: T * R * S
  const M_ENU = Cesium.Matrix4.multiply(
    T,
    Cesium.Matrix4.multiply(R, S, new Cesium.Matrix4()),
    new Cesium.Matrix4()
  );

  // Transform to ECEF: enuToEcef * M_ENU * ecefToEnu
  return Cesium.Matrix4.multiply(
    Cesium.Matrix4.multiply(enuToEcef, M_ENU, new Cesium.Matrix4()),
    ecefToEnu,
    new Cesium.Matrix4()
  );
}