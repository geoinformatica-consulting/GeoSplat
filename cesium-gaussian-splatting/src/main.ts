import * as Cesium from "cesium";
import { GaussianSplatLayer } from "./gaussian-splat-layer";
import { Viewer } from "./viewer";
import { QCController } from "./alignment/qc/qcController";
import { QCOverlay } from "./alignment/qc/qcOverlay";
import { QCVectorVisualizer } from "./alignment/qc/qcVectorVisualizer";
import { GCPValidationController } from "./alignment/gcpValidationController";
import { loadParcels, findParcelAt } from "./geo/parcelService.js";
import { DebugHUD } from "./ui/debugHUD";
import "./ui/infoOverlay.css";

const viewer = new Viewer();
let splatLayer: GaussianSplatLayer;
let qcController: QCController | null = null;
let qcOverlay: QCOverlay | null = null;
let qcVisualizer: QCVectorVisualizer | null = null;
let gcpValidation: GCPValidationController | null = null;
let debugHUD: DebugHUD;

// Mode toggle: 'parcel' or 'qc'
let interactionMode: 'parcel' | 'qc' = 'parcel';

// Debug flags
let depthTestAgainstTerrain = true;
let pickTranslucentDepth = true;

// Starting values for tracking - PepperWood Preserve coordinates
// Rotation values calibrated for proper alignment with terrain
const INITIAL_VALUES = {
  lon: -122.69248000,
  lat: 38.57244750,
  height: 413.00,
  rotationX: -0.554940,
  rotationY: 0.252155,
  rotationZ: -0.559569,
  scale: 98.450
};

async function loadPepperWoodScene() {
  // Initialize debug HUD
  debugHUD = new DebugHUD();

  // PepperWood Preserve, California coordinates
  // Lat: 38.5701, Lon: -122.6895
  viewer.flyTo(INITIAL_VALUES.lon, INITIAL_VALUES.lat, 150, 0, -60, 2);

  splatLayer = new GaussianSplatLayer(
    "./splats/myscene/PepperWoodPreFireRealityScanClean.ply",
    { lon: INITIAL_VALUES.lon, lat: INITIAL_VALUES.lat, height: INITIAL_VALUES.height },
    { x: INITIAL_VALUES.rotationX, y: INITIAL_VALUES.rotationY, z: INITIAL_VALUES.rotationZ },
    INITIAL_VALUES.scale,
    viewer.cesium  // Pass Cesium viewer for terrain height checks
  );

  viewer.addGaussianSplatLayer(splatLayer);

  // Set up callback to update HUD when splat is truly ready
  splatLayer.onReady = () => {
    console.log('🎯 Splat onReady callback triggered');
    setTimeout(() => checkSplatVisibility(), 500);
  };

  // Improve picking through translucent surfaces
  viewer.cesium.scene.globe.depthTestAgainstTerrain = depthTestAgainstTerrain;
  (viewer.cesium.scene as any).pickTranslucentDepth = pickTranslucentDepth;

  // Update HUD
  debugHUD.set('DTAT', depthTestAgainstTerrain);
  debugHUD.set('PTD', pickTranslucentDepth);
  debugHUD.set('Splat', 'LOADING', '#f80');

  // Load parcels
  await loadParcels();

  // Initialize QC and GCP systems after splat is loaded
  setTimeout(() => {
    if (splatLayer.scene) {
      const anchor = {
        lat: INITIAL_VALUES.lat,
        lon: INITIAL_VALUES.lon,
        height: INITIAL_VALUES.height
      };

      qcController = new QCController(viewer.cesium, splatLayer.scene, anchor, 'PepperWoodPreFire');
      qcOverlay = new QCOverlay(qcController);
      qcVisualizer = new QCVectorVisualizer(viewer.cesium);

      // Update visualizer when controller updates
      qcController.onUpdate = () => {
        if (qcOverlay) qcOverlay['render']();
        if (qcVisualizer && qcController) {
          qcVisualizer.render(qcController.getPairs(), qcController.showVectors);
        }
      };

      // Initialize GCP Validation controller
      gcpValidation = new GCPValidationController(viewer.cesium, splatLayer.scene);

      console.log('✅ QC system initialized (press T to toggle panel)');
      console.log('✅ GCP Validation system initialized (press Shift+V to load CSV)');
    }
  }, 1000);
}

// Function to print final adjusted values
function printFinalValues() {
  if (!splatLayer) {
    console.error('❌ Splat layer not loaded yet');
    return;
  }

  console.log('\n' + '='.repeat(70));
  console.log('🎯 FINAL SPLAT POSITION - COPY THIS INTO main.ts');
  console.log('='.repeat(70));
  console.log('\nReplace the loadPepperWoodScene() function with:\n');
  console.log('function loadPepperWoodScene() {');
  console.log(`  viewer.flyTo(${INITIAL_VALUES.lon}, ${INITIAL_VALUES.lat}, 150, 0, -60, 2);`);
  console.log('');
  console.log('  const splatLayer = new GaussianSplatLayer(');
  console.log('    "./splats/myscene/PepperWoodPreFireRealityScanClean.ply",');
  console.log(`    { lon: ${splatLayer.location.lon.toFixed(8)}, lat: ${splatLayer.location.lat.toFixed(8)}, height: ${splatLayer.location.height.toFixed(2)} },`);
  console.log(`    { x: ${splatLayer.scene.rotation.x.toFixed(6)}, y: ${splatLayer.scene.rotation.y.toFixed(6)}, z: ${splatLayer.scene.rotation.z.toFixed(6)} },`);
  console.log(`    ${splatLayer.scale.toFixed(3)}`);
  console.log('  );');
  console.log('');
  console.log('  viewer.addGaussianSplatLayer(splatLayer);');
  console.log('}');
  console.log('\n' + '='.repeat(70));
  console.log('📊 Summary of changes from initial:');
  console.log('='.repeat(70));
  console.log(`Longitude:    ${INITIAL_VALUES.lon.toFixed(8)} → ${splatLayer.location.lon.toFixed(8)} (Δ ${(splatLayer.location.lon - INITIAL_VALUES.lon).toFixed(8)})`);
  console.log(`Latitude:     ${INITIAL_VALUES.lat.toFixed(8)} → ${splatLayer.location.lat.toFixed(8)} (Δ ${(splatLayer.location.lat - INITIAL_VALUES.lat).toFixed(8)})`);
  console.log(`Height:       ${INITIAL_VALUES.height.toFixed(2)}m → ${splatLayer.location.height.toFixed(2)}m (Δ ${(splatLayer.location.height - INITIAL_VALUES.height).toFixed(2)}m)`);
  console.log(`Rotation X:   ${INITIAL_VALUES.rotationX.toFixed(6)} → ${splatLayer.scene.rotation.x.toFixed(6)} (Δ ${(splatLayer.scene.rotation.x - INITIAL_VALUES.rotationX).toFixed(6)})`);
  console.log(`Rotation Y:   ${INITIAL_VALUES.rotationY.toFixed(6)} → ${splatLayer.scene.rotation.y.toFixed(6)} (Δ ${(splatLayer.scene.rotation.y - INITIAL_VALUES.rotationY).toFixed(6)})`);
  console.log(`Rotation Z:   ${INITIAL_VALUES.rotationZ.toFixed(6)} → ${splatLayer.scene.rotation.z.toFixed(6)} (Δ ${(splatLayer.scene.rotation.z - INITIAL_VALUES.rotationZ).toFixed(6)})`);
  console.log(`Scale:        ${INITIAL_VALUES.scale.toFixed(3)} → ${splatLayer.scale.toFixed(3)} (Δ ${(splatLayer.scale - INITIAL_VALUES.scale).toFixed(3)})`);
  console.log('='.repeat(70) + '\n');
}

// Check splat visibility
function checkSplatVisibility(): void {
  if (!splatLayer || !splatLayer.ready) {
    debugHUD.set('Splat', 'NOT READY', '#f80');
    return;
  }

  try {
    // Check if splat mesh exists and is in the scene
    const mesh = splatLayer.splatViewer.getSplatMesh();
    if (!mesh) {
      debugHUD.set('Splat', 'NO MESH', '#f00');
      console.log('❌ Splat visibility check: NO MESH');
      return;
    }

    // Check if scene has children
    const childCount = splatLayer.scene.children.length;
    console.log(`📊 Splat scene has ${childCount} children`);

    // The splat is rendering via its own WebGL context, not Cesium's
    // So pickPosition won't work - we just verify the mesh exists
    debugHUD.set('Splat', 'VISIBLE', '#0f0');
    console.log('✅ Splat visibility check: VISIBLE (mesh exists and added to scene)');
    console.log('ℹ️  Note: Splat uses separate WebGL context - pickPosition depth is expected behavior');
  } catch (error) {
    debugHUD.set('Splat', 'ERROR', '#f00');
    console.error('❌ Splat visibility check error:', error);
  }
}

// Focus camera on splat
function focusSplat(): void {
  if (!splatLayer) {
    console.error('❌ No splat layer to focus on');
    return;
  }

  console.log('🎯 Focusing on splat...');

  const sphere = splatLayer.getBoundingSphere();

  if (sphere) {
    // Use bounding sphere to calculate camera position
    const distance = sphere.radius * 2.5;
    viewer.cesium.camera.flyToBoundingSphere(new Cesium.BoundingSphere(sphere.center, sphere.radius), {
      duration: 1.5,
      offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), distance)
    });
  } else {
    // Fallback: fly to anchor with sensible altitude
    const anchor = splatLayer.location;
    viewer.flyTo(anchor.lon, anchor.lat, 200, 0, -60, 1.5);
  }
}

// Parcel overlay helper
const overlay = document.getElementById("parcel-overlay");
function showParcelInfo(info: any) {
  if (!info) {
    overlay!.style.display = "none";
    overlay!.innerHTML = "";
    return;
  }
  overlay!.style.display = "block";

  // Handle "not found" case with better UX
  const isNotFound = info.parcelId === "—" && info.address === "No parcel found here";

  overlay!.innerHTML = `
    <h4>Parcel ${info.parcelId ?? "—"}</h4>
    <div class="muted">${info.address ?? "—"}</div>
    ${!isNotFound && info.owner ? `<div class="muted">Owner: ${info.owner}</div>` : ""}
    <div style="margin-top:8px;">
      ${
        (info.ordinances && info.ordinances.length)
        ? info.ordinances.map((o: string) => `<span class="pill">${o}</span>`).join("")
        : `<span class="muted">No ordinance flags</span>`
      }
    </div>
  `;
}

// Add keyboard listener for saving final position and QC controls
document.addEventListener('keydown', (e) => {
  // Press 'P' to print final values
  if (e.key === 'p' || e.key === 'P') {
    printFinalValues();
  }

  // Press 'Shift+S' to save pose to manifest file (Shift to avoid conflict with rotation)
  if ((e.key === 'S' || e.key === 's') && e.shiftKey) {
    if (splatLayer) {
      console.log('💾 Saving current pose to manifest...');
      splatLayer.savePoseToFile('User-adjusted pose via keyboard');
      e.preventDefault(); // Prevent the rotation from also firing
    }
  }

  // Press ']' to toggle between Parcel Identify and QC modes
  if (e.key === ']') {
    interactionMode = interactionMode === 'parcel' ? 'qc' : 'parcel';
    console.log(`🔄 Interaction mode: ${interactionMode.toUpperCase()}`);
    if (interactionMode === 'qc') {
      console.log('🎯 QC Mode: Press T to open QC panel, 1 to pick truth points, 2 to pick splat points');
    } else {
      console.log('📍 Parcel Mode: Click to identify parcels');
    }
    e.preventDefault();
    return; // Don't process other handlers
  }

  // Press 'R' to reset pose
  if (e.key === 'r' || e.key === 'R') {
    if (splatLayer) {
      console.log('🔄 Resetting pose...');
      splatLayer.resetPose();
      setTimeout(() => checkSplatVisibility(), 500);
    }
  }

  // Press 'F' to focus on splat
  if (e.key === 'f' || e.key === 'F') {
    focusSplat();
  }

  // Press 'Shift+L' to auto-level splat (Shift to avoid conflict with height adjustment)
  if ((e.key === 'L' || e.key === 'l') && e.shiftKey) {
    if (splatLayer) {
      console.log('🔄 Auto-leveling splat...');
      splatLayer.autoLevel();
      e.preventDefault(); // Prevent the height adjustment from also firing
    }
  }

  // GCP VALIDATION CONTROLS
  // Press 'Shift+V' to load GCP CSV file
  if ((e.key === 'V' || e.key === 'v') && e.shiftKey) {
    if (gcpValidation) {
      console.log('📂 Loading GCP CSV file for validation...');
      gcpValidation.loadGCPFile()
        .then(() => {
          console.log('✅ GCP file loaded! Press B to start picking validation points');
        })
        .catch((error) => {
          console.error('❌ Failed to load GCP file:', error);
        });
      e.preventDefault();
    }
  }

  // Press 'B' to start picking next GCP validation point
  if (e.key === 'b' || e.key === 'B') {
    if (gcpValidation) {
      gcpValidation.startPickingNextGCP();
      e.preventDefault();
    }
  }

  // Press 'Shift+E' to calculate and show validation errors
  if ((e.key === 'E' || e.key === 'e') && e.shiftKey && !e.ctrlKey) {
    if (gcpValidation) {
      console.log('📊 Calculating validation errors...');
      gcpValidation.calculateErrors();
      e.preventDefault();
    }
  }

  // Press 'Shift+X' to export validation results to CSV
  if ((e.key === 'X' || e.key === 'x') && e.shiftKey) {
    if (gcpValidation) {
      gcpValidation.exportValidationCSV();
      e.preventDefault();
    }
  }

  // Press 'Shift+C' to clear validation pairs
  if ((e.key === 'C' || e.key === 'c') && e.shiftKey && e.ctrlKey) {
    if (gcpValidation && confirm('Clear all GCP validation pairs?')) {
      gcpValidation.clearPairs();
      e.preventDefault();
    }
  }

  // Press 'O' to toggle depthTestAgainstTerrain
  if (e.key === 'o' || e.key === 'O') {
    if (e.shiftKey) {
      // Shift+O to avoid conflict with height adjustment (lowercase o)
      depthTestAgainstTerrain = !depthTestAgainstTerrain;
      viewer.cesium.scene.globe.depthTestAgainstTerrain = depthTestAgainstTerrain;
      debugHUD.set('DTAT', depthTestAgainstTerrain);
      console.log(`🔧 depthTestAgainstTerrain: ${depthTestAgainstTerrain ? 'ON' : 'OFF'}`);
    }
  }

  // Press 'D' to toggle pickTranslucentDepth
  if (e.key === 'd' || e.key === 'D') {
    pickTranslucentDepth = !pickTranslucentDepth;
    (viewer.cesium.scene as any).pickTranslucentDepth = pickTranslucentDepth;
    debugHUD.set('PTD', pickTranslucentDepth);
    console.log(`🔧 pickTranslucentDepth: ${pickTranslucentDepth ? 'ON' : 'OFF'}`);
  }

  // Press 'K' to toggle terrain occlusion (hide splat when below terrain)
  if (e.key === 'k' || e.key === 'K') {
    if (splatLayer) {
      splatLayer.hideWhenBelowTerrain = !splatLayer.hideWhenBelowTerrain;
      console.log(`🌍 Terrain occlusion: ${splatLayer.hideWhenBelowTerrain ? 'ON (hides splat when below terrain)' : 'OFF (always visible)'}`);
      // Trigger immediate check
      if (splatLayer.hideWhenBelowTerrain) {
        (splatLayer as any).updateVisibilityBasedOnTerrain();
      } else {
        splatLayer.scene.visible = true;
      }
    }
  }

  // Press 'I' to cycle through imagery providers
  if (e.key === 'i' || e.key === 'I') {
    if (e.shiftKey) {
      // Shift+I: Esri World Imagery
      viewer.setEsriImagery();
    } else if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd+I: Back to OSM
      viewer.setOSMImagery();
    } else {
      // I: Blank/minimal imagery
      viewer.setBlankImagery();
    }
  }

  // QC controls (only active in QC mode or when panel is visible)
  if (qcController && qcOverlay) {
    // 'T' key always available to toggle QC panel
    if ((e.key === 't' || e.key === 'T') && !e.shiftKey && !e.ctrlKey) {
      console.log('🔑 Key pressed: T (toggle QC panel)');
      qcOverlay.toggle();
      e.preventDefault();
      return; // Prevent other handlers
    }

    // Other QC controls only work when QC panel is visible OR in QC mode
    if (qcOverlay.isVisible() || interactionMode === 'qc') {
      if (e.key === '1') {
        console.log('🔑 Key pressed: 1 (pick truth point)');
        qcController.pickTruthPoint();
        return;
      } else if (e.key === '2') {
        console.log('🔑 Key pressed: 2 (pick splat point)');
        qcController.pickSplatPoint();
        return;
      } else if ((e.key === 'e' || e.key === 'E') && !e.shiftKey) {
        console.log('🔑 Key pressed: E (export CSV)');
        if (qcOverlay.isVisible()) {
          qcController.downloadCSV();
        } else {
          console.log('⚠️ QC panel must be visible to export CSV');
        }
        return;
      } else if ((e.key === 'c' || e.key === 'C') && !e.shiftKey && !e.ctrlKey) {
        console.log('🔑 Key pressed: C (clear pairs)');
        if (qcOverlay.isVisible() && confirm('Clear all QC pairs?')) {
          qcController.clearPairs();
        }
        return;
      } else if ((e.key === 'v' || e.key === 'V') && !e.shiftKey) {
        console.log('🔑 Key pressed: V (toggle vectors)');
        if (qcOverlay.isVisible()) {
          qcController.toggleVectors();
        } else {
          console.log('⚠️ QC panel must be visible to toggle vectors');
        }
        return;
      }
    }
  }
});

if (viewer.cesium) {
  loadPepperWoodScene();

  console.log('');
  console.log('🎮 KEYBOARD CONTROLS');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('📍 SPLAT POSITION (always available):');
  console.log('   Y/H - Move North/South (latitude)');
  console.log('   J/G - Move East/West (longitude)');
  console.log('   O/L - Move Up/Down (height)');
  console.log('   Q/W - Rotate around Y axis (yaw)');
  console.log('   A/S - Rotate around X axis (pitch)');
  console.log('   Z/X - Rotate around Z axis (roll)');
  console.log('   M/N - Scale increase/decrease');
  console.log('');
  console.log('💾 SPLAT MANAGEMENT:');
  console.log('   P - Print final position values');
  console.log('   Shift+S - Save pose to manifest file');
  console.log('   R - Reset to initial pose');
  console.log('   F - Focus camera on splat');
  console.log('   Shift+L - Auto-level splat (may not work with all splats)');
  console.log('');
  console.log('🎯 QC MODE (press T to toggle panel, then use these):');
  console.log('   T - Toggle QC panel');
  console.log('   1 - Pick truth point (when QC panel open)');
  console.log('   2 - Pick splat point (when QC panel open)');
  console.log('   E - Export CSV (when QC panel open)');
  console.log('   C - Clear pairs (when QC panel open)');
  console.log('   V - Toggle vectors (when QC panel open)');
  console.log('');
  console.log('📊 GCP VALIDATION:');
  console.log('   Shift+V - Load GCP CSV file');
  console.log('   B - Start picking next GCP point in splat');
  console.log('   Shift+E - Calculate and show validation errors');
  console.log('   Shift+X - Export validation results to CSV');
  console.log('   Ctrl+Shift+C - Clear all validation pairs');
  console.log('');
  console.log('🗺️  VIEWER SETTINGS:');
  console.log('   ] - Toggle Parcel/QC interaction mode');
  console.log('   I - Blank imagery');
  console.log('   Shift+I - Bing aerial imagery (default)');
  console.log('   Ctrl+I - OpenStreetMap imagery');
  console.log('   D - Toggle depth picking');
  console.log('   K - Toggle terrain occlusion (hide splat when below terrain)');
  console.log('   Shift+O - Toggle depth test against terrain');
  console.log('');
  console.log(`📍 Current mode: ${interactionMode.toUpperCase()}`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  // Add click handler for QC point picking and parcel lookup (after scene is set up)
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.cesium.scene.canvas);

  handler.setInputAction((movement: any) => {
    // GCP Validation mode: handle GCP point picking (highest priority)
    if (gcpValidation && gcpValidation.getMode() === 'picking') {
      const consumed = gcpValidation.handleClick(movement.position);
      if (consumed) return;
    }

    // QC mode: handle QC point picking
    if (interactionMode === 'qc') {
      if (qcController && qcController.getMode() !== 'idle') {
        const consumed = qcController.handleClick(movement.position);
        console.log('🖱️ Click handler triggered, mode:', qcController.getMode(), 'consumed:', consumed);
        return;
      }
      // In QC mode but idle - don't do parcel lookup
      return;
    }

    // Parcel Identify mode
    // Note: Splat uses separate WebGL context, so pickPosition typically won't hit it
    // This is expected behavior - we rely on globe/terrain picking for parcels
    let cartesian = viewer.cesium.scene.pickPosition(movement.position);

    // Fallback to globe picking (primary method for this use case)
    if (!cartesian) {
      const ray = viewer.cesium.camera.getPickRay(movement.position);
      if (ray) {
        cartesian = viewer.cesium.scene.globe.pick(ray, viewer.cesium.scene);
      }
      if (!cartesian) {
        showParcelInfo({ parcelId: "—", address: "No parcel found here", ordinances: [] });
        return;
      }
    }

    const carto = Cesium.Cartographic.fromCartesian(cartesian);
    const lon = Cesium.Math.toDegrees(carto.longitude);
    const lat = Cesium.Math.toDegrees(carto.latitude);

    const feature = findParcelAt(lon, lat);
    if (!feature) {
      showParcelInfo({ parcelId: "—", address: "No parcel found here", ordinances: [] });
      return;
    }
    const p = feature.properties || {};
    showParcelInfo({
      parcelId: p.parcelId || "—",
      owner: p.owner,
      address: p.address,
      ordinances: p.ordinances || []
    });
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}
