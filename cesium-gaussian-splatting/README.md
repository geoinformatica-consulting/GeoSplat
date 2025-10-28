# GeoSplat

A **Cesium + Three.js hybrid viewer** for displaying Gaussian splats (3D reconstructions) aligned to real-world geographic coordinates.

GeoSplat enables precise georeferencing of 3D Gaussian splat reconstructions within a Cesium globe environment, supporting manual alignment workflows with keyboard controls and transformation gizmos. Originally based on [tebben/cesium-gaussian-splatting](https://github.com/tebben/cesium-gaussian-splatting), this version has been heavily modified for **Firescore AI's** geospatial alignment workflow.

> **Note:** Manual alignment currently works. AI-driven alignment features (scaling/tilting automation) have been temporarily removed and are being redesigned for future releases.

---

## Current Capabilities

- **Manual Splat Transformation**
  - Scale, rotate, and translate Gaussian splats using keyboard controls
  - Fine-tuning via interactive transformation gizmos
  - Real-time preview of alignment adjustments

- **Geographic Integration**
  - Cesium 3D globe for accurate real-world coordinate context
  - OpenStreetMap or Cesium Ion imagery as base layers
  - Terrain visualization support (requires Cesium Ion token)

- **Automatic Splat Loading**
  - Loads `.ply` files automatically from `/public/splats/myscene/`
  - Compatible with Gaussian splat exports from Postshot or SIBR
  - Supports multiple splats per scene

- **Developer-Friendly Controls**
  - Keyboard shortcuts for transformation operations
  - Visual axis gizmos for orientation reference
  - Layer visibility toggles

---

## Project Structure

```
cesium-gaussian-splatting/
├── src/
│   ├── main.ts                      # Application entry point
│   ├── viewer.ts                    # Cesium viewer initialization
│   ├── gaussian-splat-layer.ts      # Three.js splat rendering layer
│   ├── ai-alignment.ts              # AI alignment logic (WIP)
│   ├── real-ai-alignment.ts         # Enhanced AI alignment (WIP)
│   ├── road-alignment.ts            # Road-based alignment (WIP)
│   ├── simple-alignment.ts          # Basic alignment utilities
│   ├── adjustment-tracker.ts        # Transformation state management
│   ├── axis-gizmo.ts                # Visual axis indicators
│   ├── splat-gizmo.ts               # Splat transformation gizmo
│   ├── road-data-provider.ts        # OpenStreetMap road data fetching
│   ├── road-overlay.ts              # Road visualization layer
│   ├── controllers/
│   │   └── AlignmentController.ts   # Alignment orchestration
│   ├── alignment/
│   │   ├── composeModelMatrix.ts    # Matrix composition utilities
│   │   ├── planeFit.ts              # Plane fitting algorithms
│   │   └── scaleCalibration.ts      # Scale calibration logic
│   └── types/
│       └── alignment.ts             # TypeScript type definitions
├── public/
│   └── splats/
│       └── myscene/                 # Place .ply files here
├── docs/
│   ├── adjustment-tracking.md       # Transformation system docs
│   └── alignment_v2.md              # Alignment v2 design notes
├── .env.local                       # Environment config (gitignored)
├── index.html                       # Main HTML entry
└── package.json                     # Dependencies
```

### Key Configuration Files

- **`.env.local`**: Contains `VITE_CESIUM_ION_TOKEN` for Cesium Ion access (excluded from Git)
- **`vite.config.ts`**: Build and dev server configuration
- **`tsconfig.json`**: TypeScript compiler settings

---

## Dependencies & Tooling

### Core Frameworks
- **[CesiumJS](https://cesium.com/platform/cesiumjs/)** - 3D globe and terrain rendering
- **[Three.js](https://threejs.org/)** - WebGL rendering for Gaussian splats
- **[TypeScript](https://www.typescriptlang.org/)** - Type-safe development
- **[Vite](https://vitejs.dev/)** - Build tool and dev server

### Optional Services
- **Cesium Ion** - High-resolution terrain and imagery (requires API token)
- **OpenStreetMap** - Fallback imagery layer (works without token)

---

## Getting Started

### Prerequisites
- Node.js 16+ and npm

### Installation

```bash
# Install dependencies
npm install
```

### Configuration

1. Create a `.env.local` file in the root directory:
   ```env
   VITE_CESIUM_ION_TOKEN=your_cesium_ion_token_here
   ```

   > **Optional:** If no token is provided, the viewer falls back to OpenStreetMap imagery

2. Place your `.ply` Gaussian splat files in:
   ```
   public/splats/myscene/
   ```

### Running the Development Server

```bash
npm run dev
```

Open your browser to `http://localhost:5173`

### Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

---

## Manual Alignment Controls

### Keyboard Shortcuts

**Translation:**
- Arrow keys: Move splat horizontally
- `Page Up/Down`: Move splat vertically

**Rotation:**
- `Q/E`: Rotate around Z-axis
- `W/S`: Rotate around X-axis
- `A/D`: Rotate around Y-axis

**Scaling:**
- `+/-`: Uniform scale up/down
- `Shift + Arrow Keys`: Scale along specific axes

**View Controls:**
- `G`: Toggle axis gizmo visibility
- `R`: Reset transformations

---

## Development Context

This version of GeoSplat was developed collaboratively using **Claude Code** and **ChatGPT** as an experimental testbed for integrating geospatial rendering with AI-assisted alignment pipelines.

### Current Development Focus

- **AI-Driven Alignment** (In Progress): Automated tilt, rotation, and scaling based on road/building feature detection
- **OpenStreetMap Integration**: Road and building data extraction for alignment reference
- **GPS Coordinate Mapping**: Load splats at specific lat/lon positions automatically

### Known Limitations

- AI alignment features are temporarily disabled pending refactor
- Terrain alignment precision depends on Cesium Ion terrain resolution
- Large splat files (>100MB) may impact performance

---

## Future Goals

### Alignment v3 Roadmap

1. **AI-Driven Transformation**
   - Automatic tilt and rotation detection from road geometries
   - Scale calibration using building footprints
   - Machine learning-based feature matching

2. **Enhanced Georeferencing**
   - GPS coordinate-based splat positioning
   - Multi-source fusion (roads + buildings + terrain)
   - Precision vegetation mapping workflows

3. **Measurement & Validation**
   - Error margin visualization tools
   - Terrain-to-splat surface comparison
   - Alignment confidence scoring

4. **Workflow Improvements**
   - Batch processing for multiple splats
   - Alignment preset templates
   - Export aligned splats with geotags

---

## AI Development Context

### For Claude Code & Future AI Assistants

**GeoSplat** is a continuously evolving testbed for integrating:
- Cesium-based geographic rendering
- Gaussian splat 3D reconstructions
- AI-assisted alignment pipelines for FireScore AI

#### Development Guidelines

When modifying this codebase:

1. **Respect the Cesium Coordinate Framework**
   - All transformations must account for Cesium's Earth-Centered Earth-Fixed (ECEF) coordinate system
   - Use `Cesium.Transforms.eastNorthUpToFixedFrame()` for local transformations
   - Never hardcode lat/lon conversions without proper Cartesian3 handling

2. **Maintain Manual Alignment Mode**
   - The keyboard control system in `viewer.ts` and `gaussian-splat-layer.ts` must remain functional
   - Any new alignment features should be additive, not destructive
   - Preserve backward compatibility with existing `.ply` loading logic

3. **AI Alignment Architecture**
   - New alignment algorithms should extend `AlignmentController.ts`
   - Keep road-based (`road-alignment.ts`) and building-based alignment separate
   - Use `adjustment-tracker.ts` for state management to enable undo/redo

4. **Code Organization**
   - Place alignment algorithms in `/src/alignment/`
   - Data providers (OSM, terrain) go in `/src/*-data-provider.ts`
   - UI controllers belong in `/src/controllers/`
   - Type definitions must be in `/src/types/`

5. **Testing & Validation**
   - Always test with real `.ply` files in `/public/splats/myscene/`
   - Verify transformations don't break at different lat/lon coordinates
   - Ensure Cesium terrain and OSM data load correctly

6. **Documentation**
   - Update `/docs/` markdown files for architectural changes
   - Add inline comments for complex coordinate transformations
   - Keep this README synchronized with new features

#### Current State (as of 2025-10-04)

- ✅ Manual alignment fully functional
- ✅ Cesium + Three.js rendering pipeline stable
- ✅ OSM road data fetching implemented
- ⏳ AI scaling/tilting algorithms disabled (refactoring)
- ⏳ GPS-based auto-positioning not yet implemented
- ⏳ Building footprint alignment in development

---

## Contributing

This is a private FireScore AI project. External contributions are not currently accepted.

For internal development questions, refer to:
- `/docs/alignment_v2.md` - Alignment system design
- `/docs/adjustment-tracking.md` - Transformation state architecture

---

## License

Proprietary - FireScore AI © 2025

---

## Acknowledgments

- Original codebase: [tebben/cesium-gaussian-splatting](https://github.com/tebben/cesium-gaussian-splatting)
- Built with [CesiumJS](https://cesium.com/) and [Three.js](https://threejs.org/)
- Developed with assistance from Claude Code and ChatGPT
