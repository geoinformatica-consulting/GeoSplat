// src/alignment/scaleCalibration.ts

// Road width calibration
export function metersPerUnitFromRoadWidth({
  trueWidthMeters,     // from OSM width or lanes*3.6
  measuredWidthUnits   // picked from splat overlay
}: { trueWidthMeters: number; measuredWidthUnits: number }): number {
  if (measuredWidthUnits <= 0) throw new Error("Invalid measured width");
  return trueWidthMeters / measuredWidthUnits;
}

// EXIF/GSD calibration (fallback if available)
export function metersPerPixelFromExif({
  altitudeAGL_m,
  focalLength_mm,
  pixelPitch_um
}: { altitudeAGL_m: number; focalLength_mm: number; pixelPitch_um: number }): number {
  // GSD ≈ (altitude * pixel_pitch) / focal_length (convert units)
  const pixelPitch_m = pixelPitch_um * 1e-6;
  const focalLength_m = focalLength_mm * 1e-3;
  return (altitudeAGL_m * pixelPitch_m) / focalLength_m;
}

// Helper to estimate road width from OSM data
export function estimateRoadWidthMeters(highway: string, lanes?: number): number {
  const laneWidth = 3.6; // Standard lane width in meters

  if (lanes && lanes > 0) {
    return lanes * laneWidth;
  }

  // Fallback based on road type
  const roadWidths: Record<string, number> = {
    'motorway': 24,
    'trunk': 20,
    'primary': 16,
    'secondary': 12,
    'tertiary': 10,
    'unclassified': 8,
    'residential': 6,
    'service': 4,
    'living_street': 5,
    'pedestrian': 3
  };

  return roadWidths[highway] || 8; // Default 8m width
}