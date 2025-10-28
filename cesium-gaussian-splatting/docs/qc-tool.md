# Quality Control (QC) Tool

A minimal tool for measuring alignment accuracy between Gaussian splats and real-world ground truth.

## Features

- **Point Pairing**: Pick ground truth points on the globe and corresponding points on the splat
- **Error Metrics**: Compute 2D/3D error vectors (ΔE, ΔN, ΔU) in meters
- **Statistics**: Live count, mean, RMSE, P50, P95, P99, max error
- **Visualization**: Colored arrows from truth→splat with error labels
- **Export**: CSV export with all pairs and error metrics
- **Persistence**: Auto-save to localStorage and manual JSON export

## Keyboard Controls

| Key | Action |
|-----|--------|
| **T** | Toggle QC panel on/off |
| **1** | Pick truth point (click on globe) |
| **2** | Pick splat point (click on splat) |
| **E** | Export CSV (when panel is visible) |
| **C** | Clear all pairs (when panel is visible) |
| **V** | Toggle vector visualization (when panel is visible) |

## Workflow

1. **Enable QC Mode**: Press `T` to show the QC panel
2. **Pick Truth Point**: Press `1`, then click on the globe where the ground truth location is
3. **Pick Splat Point**: Press `2`, then click on the corresponding point on the splat
4. **View Stats**: After ≥3 pairs, statistics (RMSE, P95, P99) are displayed
5. **Export Data**: Press `E` to download a CSV file with all pairs and errors
6. **Toggle Vectors**: Press `V` to show/hide error arrows on the scene

## Coordinate System

- All measurements use the same **ENU (East-North-Up)** anchor as the alignment system
- Both truth and splat points are converted to ENU before computing errors
- **2D error**: `sqrt(ΔE² + ΔN²)` in meters
- **3D error**: `sqrt(ΔE² + ΔN² + ΔU²)` in meters

## Arrow Colors

Error vectors are color-coded by 2D magnitude:
- **Green** (Lime): < 0.5 m
- **Yellow**: 0.5-1.0 m
- **Orange**: 1.0-2.0 m
- **Red**: > 2.0 m

## Data Persistence

- **localStorage**: Auto-saved as `qc:<SITE_ID>`
- **JSON Export**: Download `qc_<SITE_ID>.json` with pairs + stats
- **CSV Export**: Download `qc_<SITE_ID>_<timestamp>.csv` with all measurements

### CSV Format

```csv
Index,Truth_E,Truth_N,Truth_U,Splat_E,Splat_N,Splat_U,Error_E,Error_N,Error_U,Error_2D,Error_3D,Timestamp
1,12.345,67.890,3.210,12.400,67.950,3.150,0.055,0.060,-0.060,0.082,0.103,2025-10-05T12:34:56.789Z
```

## Integration

The QC system is initialized automatically after the splat loads:

```typescript
// In main.ts
qcController = new QCController(viewer.cesium, burbankLayer.scene, anchor, 'Burbank1');
qcOverlay = new QCOverlay(qcController);
qcVisualizer = new QCVectorVisualizer(viewer.cesium);
```

## File Structure

```
src/alignment/qc/
├── qcController.ts       # Point pairing and state management
├── qcStats.ts           # Statistics calculation and data structures
├── qcOverlay.ts         # UI panel overlay
└── qcVectorVisualizer.ts # Cesium arrow/label rendering
```

## No Regressions

- **QC mode is opt-in**: Press `T` to activate (no automatic interference)
- **Existing hotkeys preserved**: Changed QC toggle from `Q` → `T` to avoid conflict with splat rotation
- **Manual alignment unchanged**: QC only measures alignment, does not modify it
- **Minimal UI footprint**: Panel only shows when toggled on

## Technical Notes

- Uses the **same ENU anchor** as AlignmentController for consistency
- ENU transforms are cached for performance
- Splat picking uses `viewer.scene.pickPosition()` for 3D coordinates
- Globe picking uses `viewer.scene.globe.pick()` for terrain
- Final rotation is yaw-only (as per alignment constraints)
