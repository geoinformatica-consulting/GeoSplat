# GeoSplat Feature Guide

## Overview
This Cesium-based Gaussian Splat viewer includes geospatial alignment tools, quality control (QC) measurement, and parcel identification features.

---

## 🎮 Keyboard Controls

### Splat Adjustment
- **Q/W** - Rotate Y-axis (left/right)
- **A/S** - Rotate X-axis (up/down)
- **Z/X** - Rotate Z-axis (roll)
- **Y/H** - Move North/South (latitude)
- **J/U** - Move East/West (longitude)
- **O/L** - Move Up/Down (height)
- **M/N** - Scale Up/Down

### Mode & System Controls
- **G** - Toggle between Parcel Identify and QC modes
- **P** - Print final splat values to console
- **S** - Save current pose to manifest file (downloads JSON)

### QC Mode Controls (when in QC mode)
- **T** - Toggle QC panel visibility
- **1** - Start picking truth point (ground truth location)
- **2** - Start picking splat point (corresponding point in splat)
- **E** - Export QC measurements to CSV
- **C** - Clear all QC point pairs
- **V** - Toggle vector visualization

---

## 📍 Parcel Identification System

### Features
- Click-based parcel lookup using point-in-polygon
- Displays parcel ID, address, owner, and ordinance flags
- Depth-aware picking (works on splat and terrain)
- Graceful fallback for missing parcel data

### Setup
1. Place your GeoJSON file at `/public/parcels_lhh.geojson`
2. GeoJSON must be in WGS84 (EPSG:4326) format
3. Properties should include:
   - `parcelId` - Unique identifier
   - `address` - Street address
   - `owner` - Property owner name
   - `ordinances` - Array of ordinance tags

### Example GeoJSON Structure
```json
{
  "type": "FeatureCollection",
  "features": [{
    "type": "Feature",
    "geometry": {
      "type": "Polygon",
      "coordinates": [[
        [-118.285, 34.189],
        [-118.284, 34.189],
        [-118.284, 34.190],
        [-118.285, 34.190],
        [-118.285, 34.189]
      ]]
    },
    "properties": {
      "parcelId": "APN-12345",
      "address": "123 Main St, Burbank, CA",
      "owner": "Property Owner LLC",
      "ordinances": ["Zoning-Commercial", "Historic"]
    }
  }]
}
```

### Usage
1. Press **G** to ensure you're in Parcel mode
2. Click anywhere on the splat or terrain
3. Parcel info appears in overlay if point is inside a parcel

---

## 🎯 Quality Control (QC) System

### Purpose
Measure alignment accuracy between the Gaussian splat and real-world coordinates by collecting ground truth point pairs.

### Workflow
1. Press **G** to switch to QC mode
2. Press **T** to open the QC panel
3. Identify a distinctive feature visible in both the splat and real world
4. Press **1** and click the known real-world location (truth point)
5. Press **2** and click where that same feature appears in the splat
6. Repeat for multiple points (5-10 recommended)
7. View real-time statistics: RMSE, mean error, std deviation
8. Press **E** to export measurements to CSV

### Statistics Provided
- **RMSE** (Root Mean Square Error) - Overall alignment accuracy
- **Mean Error** - Average distance between truth/splat points
- **Std Dev** - Consistency of errors across points
- **Min/Max Error** - Range of individual point errors
- **Per-point breakdown** - Individual distances for each pair

### CSV Export Format
```csv
name,truthX,truthY,truthZ,splatX,splatY,splatZ,distance
Pair-1,x1,y1,z1,x2,y2,z2,d
...
```

### Data Persistence
QC pairs are saved to browser localStorage per scene, so they persist across page reloads.

---

## 💾 Pose Persistence System

### Features
- Save current splat transform to JSON manifest
- Auto-load saved pose on startup
- Eliminates need for manual re-alignment after refresh

### Commands

#### Save Current Pose
1. Adjust splat to desired position using keyboard controls
2. Press **S** to save
3. Browser downloads `splat-manifest.json`
4. Move this file to `/public/splat-manifest.json`

#### Auto-Load Pose
- On startup, system checks for `/public/splat-manifest.json`
- If found, automatically applies saved transform
- If not found, uses default constructor values

### Manifest File Format
```json
{
  "anchor": {
    "lon": -118.28507075,
    "lat": 34.18991967,
    "alt": 327.7
  },
  "modelMatrix": [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ],
  "notes": "User-adjusted pose via keyboard",
  "timestamp": "2025-10-14T20:30:00.000Z"
}
```

The `modelMatrix` is stored as 16 floats in column-major order (THREE.js standard).

---

## 🔧 Technical Details

### Depth Writing
- THREE.js renderer configured with depth buffer enabled
- Splat fragments write to depth buffer for accurate picking
- `pickPosition()` works on splat surface
- Globe fallback for clicks outside splat

### Coordinate Systems
- **WGS84 (EPSG:4326)** for lat/lon/alt
- **Cartesian3** for Cesium world coordinates
- **THREE.Matrix4** for splat transforms
- All conversions handled automatically

### Point-in-Polygon
- Uses Turf.js `booleanPointInPolygon`
- Supports both Polygon and MultiPolygon geometries
- Efficient linear search (suitable for <10k parcels)

---

## 🚀 Quick Start

### First-Time Setup
1. Start dev server: `npm run dev`
2. Open http://localhost:3001/cesium-gaussian-splatting/
3. Wait for splat to load
4. Press **G** to toggle modes and explore features

### Typical Workflow
1. Load scene (automatic)
2. Adjust splat position with keyboard controls
3. Switch to QC mode (**G**) and collect alignment measurements
4. Review RMSE and adjust if needed
5. Save final pose (**S**) when satisfied
6. Place manifest in `/public/` for future auto-load
7. Switch to Parcel mode (**G**) and test parcel identification

---

## 📊 Best Practices

### QC Measurements
- Collect 8-12 point pairs for reliable statistics
- Distribute points across the splat area
- Choose distinctive features (corners, edges, unique objects)
- Aim for RMSE < 2-3 meters for urban scenes

### Pose Adjustment
- Start with coarse adjustments (scale, major rotations)
- Refine with fine position tweaks (lat/lon/alt)
- Use QC measurements to guide adjustments
- Save frequently to avoid losing good alignments

### Parcel Data
- Ensure GeoJSON covers the area of your splat
- Validate GeoJSON with tools like geojson.io
- Keep property schema consistent across features
- Test with a small dataset first

---

## 🐛 Troubleshooting

### "No parcel found here"
- Check that `parcels_lhh.geojson` exists in `/public/`
- Verify GeoJSON is valid and in WGS84
- Ensure polygons cover the clicked location
- Check browser console for loading errors

### Depth picking not working
- Verify splat has loaded (`ready` flag in console)
- Check that depth buffer is enabled in renderer
- Try clicking directly on visible splat geometry
- Falls back to globe picking if needed

### Pose not loading
- Confirm `splat-manifest.json` is in `/public/` (not Downloads)
- Check JSON is valid (use JSONLint)
- Look for console messages during startup
- Verify `modelMatrix` has 16 numbers

---

## 📝 File Locations

- `/src/alignment/pose.ts` - Pose persistence utilities
- `/src/geo/parcelService.js` - Parcel loading and point-in-polygon
- `/src/alignment/qc/` - QC system components
- `/src/main.ts` - Mode toggle and keyboard handlers
- `/public/parcels_lhh.geojson` - Parcel data
- `/public/splat-manifest.json` - Saved pose (user-created)

---

## 🔑 Key Bindings Summary

| Key | Action |
|-----|--------|
| G | Toggle Parcel/QC mode |
| P | Print final values |
| S | Save pose to manifest |
| T | Toggle QC panel |
| 1 | Pick truth point (QC) |
| 2 | Pick splat point (QC) |
| E | Export QC CSV |
| C | Clear QC pairs |
| V | Toggle QC vectors |
| Q/W | Rotate Y |
| A/S | Rotate X |
| Z/X | Rotate Z |
| Y/H | Move Lat |
| J/U | Move Lon |
| O/L | Move Alt |
| M/N | Scale |

---

## 📚 Dependencies

- **Cesium** - Globe and terrain rendering
- **THREE.js** - 3D transforms and rendering
- **@mkkellogg/gaussian-splats-3d** - Gaussian splat viewer
- **@turf/turf** - Geospatial analysis (point-in-polygon)

---

For more information or to report issues, please consult the main project documentation.
