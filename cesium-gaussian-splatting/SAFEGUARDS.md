# GeoSplat Safety Features & Debugging Tools

## Overview

This document describes the safety features and debugging tools added to prevent the splat from "disappearing" and to help diagnose alignment issues.

---

## 🛡️ Safe Pose Loading

### Validation Checks

When loading a pose from `splat-manifest.json`, the system performs automatic validation:

1. **Matrix Finiteness** - All 16 matrix elements must be finite (no NaN or Infinity)
2. **Determinant Check** - 3x3 upper-left determinant must not be ~0 (avoids singular matrices)
3. **Scale Validation** - Extracted scale must be within [1e-4, 1e4] range
4. **Altitude Bounds** - Anchor altitude must be within [-500m, 6000m] range

### Configuration

Default validation config in `src/alignment/pose.ts`:

```typescript
{
  minAltitude: -500,
  maxAltitude: 6000,
  minScale: 1e-4,
  maxScale: 1e4,
  checkDeterminant: true
}
```

### Behavior on Invalid Pose

If validation fails:
- Toast notification appears: "⚠️ Pose file invalid — loaded defaults (press S to overwrite)"
- System falls back to constructor default values
- Failure reason logged to console
- Splat remains visible with safe defaults

### Bypass Flag

For debugging, you can skip pose loading entirely:

```javascript
localStorage.setItem('GEOSPLAT_BYPASS_POSE', '1');
// Reload page to take effect
```

To re-enable pose loading:

```javascript
localStorage.removeItem('GEOSPLAT_BYPASS_POSE');
```

---

## 🔑 Safety Hotkeys

### R - Reset Pose

Resets splat to identity matrix with default scale and anchor position.

- Clears all rotations (sets to 0,0,0)
- Restores default scale from constructor
- Moves splat back to original anchor point
- Re-enables matrix auto-update
- Triggers visibility check after reset

**Use when**: Splat has been adjusted into an unusable state or is off-screen.

### F - Focus Camera

Automatically flies camera to optimal viewing position for the splat.

- Attempts to calculate bounding sphere from geometry
- Falls back to anchor + 200m altitude if bounding sphere unavailable
- Smooth 1.5 second camera transition
- Sets camera angle to -45° pitch for good overview

**Use when**: You've lost track of where the splat is or need to recenter view.

---

## 🔬 Debug HUD

### Location & Display

Small overlay in bottom-left corner showing real-time status indicators.

### Indicators

| Indicator | Meaning | Colors |
|-----------|---------|--------|
| **DTAT** | DepthTestAgainstTerrain | GREEN=on, RED=off |
| **PTD** | PickTranslucentDepth | GREEN=on, RED=off |
| **Splat** | Visibility status | GREEN=visible, ORANGE=loading, RED=error |

### Splat Visibility Check

Performed 2 seconds after scene load:
- Casts pick ray at screen center
- Checks if `pickPosition()` returns a valid point
- Updates HUD with result

**Possible States:**
- `VISIBLE` (green) - Splat is rendering and depth is available
- `NOT READY` (orange) - Splat hasn't finished loading
- `NO DEPTH` (orange) - Splat may be visible but not writing depth
- `ERROR` (red) - Exception occurred during check

---

## 🎛️ Debug Toggle Hotkeys

### D - Toggle pickTranslucentDepth

Toggles Cesium's `scene.pickTranslucentDepth` flag on/off.

- **ON** (default): Allows clicking through translucent surfaces to get depth
- **OFF**: Picks stop at first translucent surface

**Use for**: Debugging click-to-identify behavior with parcels

### Shift+O - Toggle depthTestAgainstTerrain

Toggles Cesium's `globe.depthTestAgainstTerrain` flag on/off.

*Note: Requires Shift to avoid conflict with 'o' height adjustment key*

- **ON** (default): Objects behind terrain are occluded properly
- **OFF**: Objects render on top of terrain regardless of depth

**Use for**: Diagnosing rendering issues with terrain occlusion

### HUD Updates

Both toggles immediately update the debug HUD indicators and log to console.

---

## 💾 Enhanced Pose Save Format

### New JSON Structure

When you press **S** to save pose, the manifest includes comprehensive metadata:

```json
{
  "version": 1,
  "anchor": {
    "lon": -118.28507075,
    "lat": 34.18991967,
    "alt": 327.7
  },
  "modelMatrixColumnMajor": [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ],
  "units": "meters",
  "handedness": "right",
  "axis": "Z-up",
  "notes": "Saved by user at 2025-10-14T20:30:00.000Z",
  "timestamp": "2025-10-14T20:30:00.000Z"
}
```

### Console Output on Save

When saving, the console displays:

```
💾 Pose saved to splat-manifest.json
📋 Place this file in /public/ to auto-load on next startup
📐 Matrix info:
  Row 0: 1.0000  0.0000  0.0000  1234.5678
  Row 1: 0.0000  1.0000  0.0000  5678.9012
  Row 2: 0.0000  0.0000  1.0000  9012.3456
  Scale: X=1.0000, Y=1.0000, Z=1.0000
  Uniform scale: 1.0000
```

This allows quick visual inspection of the transform matrix.

### Console Output on Load

When loading a pose, similar matrix info is logged for verification.

---

## 📍 Parcel Picking with Depth Priority

### Click Handler Logic

The parcel identification system uses a two-tier approach:

```javascript
// 1. Try splat depth first
let cartesian = viewer.scene.pickPosition(click.position);

// 2. Fallback to globe if no splat depth
if (!cartesian) {
  const ray = viewer.camera.getPickRay(click.position);
  cartesian = viewer.scene.globe.pick(ray, viewer.scene);
}

// 3. Convert to lon/lat and query parcels
if (cartesian) {
  const carto = Cesium.Cartographic.fromCartesian(cartesian);
  const lon = Cesium.Math.toDegrees(carto.longitude);
  const lat = Cesium.Math.toDegrees(carto.latitude);
  const feature = findParcelAt(lon, lat);
}
```

### Benefits

- **Accurate on-splat picking**: When clicking directly on splat geometry, uses splat's actual 3D position
- **Graceful fallback**: When clicking off-splat (e.g., adjacent terrain), falls back to globe picking
- **Consistent UX**: Works whether splat is fully aligned or not

---

## 🔧 Implementation Details

### Files Modified

| File | Changes |
|------|---------|
| `src/alignment/pose.ts` | Added validation, enhanced save format, toast notifications |
| `src/gaussian-splat-layer.ts` | Added resetPose(), getBoundingSphere(), default value storage |
| `src/ui/debugHUD.ts` | New file - Debug HUD component |
| `src/main.ts` | New hotkeys (R/F/D/Shift+O), visibility check, focus function |
| `src/three-overlay.ts` | Depth buffer configuration |

### Validation Algorithm

**Matrix Scale Extraction:**

```typescript
// Extract scale from basis vectors
const scaleX = sqrt(m[0]² + m[1]² + m[2]²)  // First column magnitude
const scaleY = sqrt(m[4]² + m[5]² + m[6]²)  // Second column magnitude
const scaleZ = sqrt(m[8]² + m[9]² + m[10]²) // Third column magnitude
const avgScale = (scaleX + scaleY + scaleZ) / 3
```

**Determinant Calculation:**

```typescript
// Upper-left 3x3 determinant
det = m[0]*(m[5]*m[10] - m[6]*m[9])
    - m[4]*(m[1]*m[10] - m[2]*m[9])
    + m[8]*(m[1]*m[6]  - m[2]*m[5])
```

---

## 🎯 Typical Debugging Workflow

### Problem: "Splat disappeared after adjustment"

1. Check debug HUD - Is splat showing as VISIBLE?
2. If NO DEPTH - Press **D** to toggle depth picking, try again
3. If still lost - Press **R** to reset pose to safe defaults
4. Press **F** to focus camera on reset position
5. Readjust from known-good starting point

### Problem: "Pose file won't load"

1. Check browser console for validation error message
2. Common issues:
   - `alt` outside [-500, 6000] range
   - Matrix has NaN or Infinity values
   - Scale outside [1e-4, 1e4] range
   - Determinant near zero (degenerate transform)
3. Set `localStorage.GEOSPLAT_BYPASS_POSE = '1'` to test with defaults
4. Fix or regenerate manifest file
5. Clear bypass flag and reload

### Problem: "Clicks not registering on splat"

1. Check **PTD** indicator in HUD (should be green/ON)
2. Press **D** to toggle if needed
3. Check **DTAT** indicator (should be green/ON)
4. Press **Shift+O** to toggle if needed
5. Verify splat shows VISIBLE in HUD
6. Check console for any WebGL or rendering errors

---

## 🚀 Best Practices

### Before Saving a Pose

1. Verify splat is aligned using QC measurements (RMSE < few meters)
2. Check splat visibility indicator shows VISIBLE
3. Test parcel clicking in a few locations
4. Press **F** to ensure camera can auto-focus correctly
5. Press **S** to save, review console output matrix info

### During Development

- Keep debug HUD visible to monitor depth/terrain flags
- Use **R** (reset) liberally - it's non-destructive
- Set bypass flag when testing code changes to pose loader
- Check console logs for matrix info on every load

### Production Deployment

- Ensure `splat-manifest.json` passes all validation checks
- Test with bypass flag disabled
- Verify visibility check passes after load
- Document any custom validation config changes

---

## 📊 Error Messages Reference

| Message | Cause | Solution |
|---------|-------|----------|
| "Anchor altitude X outside range" | Alt not in [-500, 6000] | Adjust altitude in manifest |
| "Matrix contains non-finite values" | NaN or Infinity in matrix | Regenerate manifest from known-good state |
| "Matrix scale X outside range" | Scale too large/small | Check mesh scale, regenerate manifest |
| "Matrix determinant too close to zero" | Singular/degenerate matrix | Reset pose and readjust from scratch |
| "GEOSPLAT_BYPASS_POSE flag set" | Bypass flag active | Clear localStorage flag |

---

## 🔍 Console Commands

Quick reference for browser console:

```javascript
// Skip pose loading (requires page reload)
localStorage.setItem('GEOSPLAT_BYPASS_POSE', '1');

// Re-enable pose loading (requires page reload)
localStorage.removeItem('GEOSPLAT_BYPASS_POSE');

// Manually trigger visibility check
checkSplatVisibility();

// Get current mode
console.log('Mode:', interactionMode);

// Access splat layer
burbankLayer.resetPose();
burbankLayer.getBoundingSphere();
burbankLayer.getModelMatrix();
```

---

## 📝 Summary

All safety features are designed to:
- **Prevent data loss** - Invalid poses rejected, defaults used
- **Maintain visibility** - Reset and focus tools always available
- **Aid debugging** - HUD and console logs provide real-time feedback
- **Ensure reliability** - Validation catches common errors before they cause problems

The splat should never truly "disappear" - at worst, press **R** to reset and **F** to focus, and you'll be back to a known-good state.
