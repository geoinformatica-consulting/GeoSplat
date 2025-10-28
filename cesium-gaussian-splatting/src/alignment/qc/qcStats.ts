// src/alignment/qc/qcStats.ts
import * as Cesium from 'cesium';

export type QCPointPair = {
  truthECEF: Cesium.Cartesian3;  // WGS84 ground truth point (ECEF)
  splatECEF: Cesium.Cartesian3;  // Splat point (ECEF)
  truthENU: [number, number, number];  // Truth in ENU (E, N, U)
  splatENU: [number, number, number];  // Splat in ENU (E, N, U)
  errorENU: [number, number, number];  // ΔE, ΔN, ΔU in meters
  error2D: number;  // sqrt(ΔE² + ΔN²) in meters
  error3D: number;  // sqrt(ΔE² + ΔN² + ΔU²) in meters
  timestamp: number;
};

export type QCStats = {
  count: number;
  mean2D: number;
  rmse2D: number;
  p50: number;
  p95: number;
  p99: number;
  max2D: number;
  mean3D: number;
  rmse3D: number;
};

export function computeQCStats(pairs: QCPointPair[]): QCStats | null {
  if (pairs.length === 0) {
    return null;
  }

  const errors2D = pairs.map(p => p.error2D).sort((a, b) => a - b);
  const errors3D = pairs.map(p => p.error3D);

  // 2D stats
  const mean2D = errors2D.reduce((sum, e) => sum + e, 0) / errors2D.length;
  const sumSq2D = errors2D.reduce((sum, e) => sum + e * e, 0);
  const rmse2D = Math.sqrt(sumSq2D / errors2D.length);

  // 3D stats
  const mean3D = errors3D.reduce((sum, e) => sum + e, 0) / errors3D.length;
  const sumSq3D = errors3D.reduce((sum, e) => sum + e * e, 0);
  const rmse3D = Math.sqrt(sumSq3D / errors3D.length);

  // Percentiles (from sorted 2D errors)
  const p50 = percentile(errors2D, 0.50);
  const p95 = percentile(errors2D, 0.95);
  const p99 = percentile(errors2D, 0.99);
  const max2D = errors2D[errors2D.length - 1];

  return {
    count: pairs.length,
    mean2D,
    rmse2D,
    p50,
    p95,
    p99,
    max2D,
    mean3D,
    rmse3D
  };
}

function percentile(sorted: number[], p: number): number {
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

export function exportCSV(pairs: QCPointPair[]): string {
  const header = 'Index,Truth_E,Truth_N,Truth_U,Splat_E,Splat_N,Splat_U,Error_E,Error_N,Error_U,Error_2D,Error_3D,Timestamp\n';
  const rows = pairs.map((p, i) => {
    return `${i + 1},${p.truthENU[0].toFixed(3)},${p.truthENU[1].toFixed(3)},${p.truthENU[2].toFixed(3)},${p.splatENU[0].toFixed(3)},${p.splatENU[1].toFixed(3)},${p.splatENU[2].toFixed(3)},${p.errorENU[0].toFixed(3)},${p.errorENU[1].toFixed(3)},${p.errorENU[2].toFixed(3)},${p.error2D.toFixed(3)},${p.error3D.toFixed(3)},${new Date(p.timestamp).toISOString()}`;
  }).join('\n');
  return header + rows;
}

export type QCPersistData = {
  pairs: Array<{
    truthECEF: { x: number; y: number; z: number };
    splatECEF: { x: number; y: number; z: number };
    truthENU: [number, number, number];
    splatENU: [number, number, number];
    errorENU: [number, number, number];
    error2D: number;
    error3D: number;
    timestamp: number;
  }>;
  stats: QCStats | null;
  computedAt: string;
};

export function serializeQCData(pairs: QCPointPair[], stats: QCStats | null): QCPersistData {
  return {
    pairs: pairs.map(p => ({
      truthECEF: { x: p.truthECEF.x, y: p.truthECEF.y, z: p.truthECEF.z },
      splatECEF: { x: p.splatECEF.x, y: p.splatECEF.y, z: p.splatECEF.z },
      truthENU: p.truthENU,
      splatENU: p.splatENU,
      errorENU: p.errorENU,
      error2D: p.error2D,
      error3D: p.error3D,
      timestamp: p.timestamp
    })),
    stats,
    computedAt: new Date().toISOString()
  };
}

export function deserializeQCData(data: QCPersistData): QCPointPair[] {
  return data.pairs.map(p => ({
    truthECEF: new Cesium.Cartesian3(p.truthECEF.x, p.truthECEF.y, p.truthECEF.z),
    splatECEF: new Cesium.Cartesian3(p.splatECEF.x, p.splatECEF.y, p.splatECEF.z),
    truthENU: p.truthENU,
    splatENU: p.splatENU,
    errorENU: p.errorENU,
    error2D: p.error2D,
    error3D: p.error3D,
    timestamp: p.timestamp
  }));
}
