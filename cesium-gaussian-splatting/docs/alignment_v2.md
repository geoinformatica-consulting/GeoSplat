# Alignment V2 Documentation

## Overview

Alignment V2 provides a unified, mathematically precise transformation system for Gaussian splats using East-North-Up (ENU) coordinates as the single source of truth.

## Matrix Chain

The transformation pipeline follows this sequence:

1. **Scale (S)**: Uniform scaling in splat local coordinates
2. **Rotation (R)**: Yaw → Pitch → Roll in ENU frame
3. **Translation (T)**: Position offset in ENU meters
4. **ENU to ECEF**: Convert from local ENU to Earth-Centered Earth-Fixed coordinates

### Mathematical Composition

```
M_world = enuToEcef * T * R * S * ecefToEnu
```

Where:
- `S = scale(sx, sy, sz)` - uniform scaling
- `R = Rz(yaw) * Rx(pitch) * Ry(roll)` - rotation about ENU axes
- `T = translate(tEast, tNorth, tUp)` - translation in ENU frame
- ENU frame is established at the anchor point (splat's geographic location)

### ENU Coordinate System

- **East (X)**: Positive eastward
- **North (Y)**: Positive northward
- **Up (Z)**: Positive upward (away from Earth center)

## Road-Width Calibration

### Usage

1. Identify a road of known width in your splat
2. Use the measurement tool to measure the road width in splat units
3. Look up the true road width from OSM data or estimate from lanes (3.6m per lane)
4. Apply calibration:

```typescript
const trueWidth = estimateRoadWidthMeters(highway, lanes);
const measuredWidth = /* measured in splat units */;
alignmentController.calibrateScaleFromRoadWidth(trueWidth, measuredWidth);
```

### Road Width Estimates

- **Motorway**: 24m (6-8 lanes)
- **Primary**: 16m (4 lanes)
- **Secondary**: 12m (3 lanes)
- **Residential**: 6m (1-2 lanes)
- **Service**: 4m (1 lane)

## Plane Fit (Lock Tilt)

Automatically removes pitch and roll by fitting a plane to ground points and aligning it with the ENU Up vector.

### Usage

```typescript
// Extract ground points from splat (implement based on your point cloud structure)
const groundPoints: Vec3[] = extractGroundPoints(splatData);
alignmentController.lockTilt(groundPoints);
```

### Algorithm

1. **PCA**: Compute covariance matrix of centered ground points
2. **Normal Estimation**: Find eigenvector with smallest eigenvalue
3. **Quaternion Calculation**: Compute rotation from estimated normal to ENU Up
4. **Euler Extraction**: Convert quaternion to pitch/roll angles
5. **Application**: Set pitch and roll, preserve yaw

## Controls

All existing keyboard controls are preserved and work through the ENU parameter system:

- **+/-**: Scale adjustment → `scale`
- **[ ]**: Rotation adjustment → `yawRad`
- **Arrow keys**: Position adjustment → `tEast`, `tNorth`
- **Page Up/Down**: Height adjustment → `tUp`
- **V**: Auto-scale to view

## Feature Flag

Set `ALIGNMENT_V2 = false` in `AlignmentController.ts` to revert to legacy behavior.

## Known Edge Cases

### No Roads Available
- Road-width calibration fails without identifiable roads
- Use EXIF/GSD calibration as fallback
- Manual scale adjustment may be required

### Bad EXIF Data
- Missing altitude, focal length, or pixel pitch
- Incorrect camera parameters
- Use road-width calibration instead

### Non-Planar Scenes
- Plane fitting assumes roughly flat ground
- Strong terrain variation affects normal estimation
- May need manual pitch/roll adjustment
- Consider segmenting planar regions

### Coordinate System Edge Cases
- Near poles: ENU becomes ill-defined
- Large translations: Curvature effects ignored
- High altitudes: Local flat-Earth approximation breaks down

## Debugging

Use `alignmentController.getEnuParams()` to inspect current transformation parameters:

```typescript
const params = alignmentController.getEnuParams();
console.log('ENU Parameters:', {
  scale: params.scale,
  yaw: params.yawRad * 180 / Math.PI,
  pitch: params.pitchRad * 180 / Math.PI,
  roll: params.rollRad * 180 / Math.PI,
  position: [params.tEast, params.tNorth, params.tUp]
});
```