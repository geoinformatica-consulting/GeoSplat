import * as Cesium from "cesium";
import { GaussianSplatLayer } from "./gaussian-splat-layer";
import { Viewer } from "./viewer";
import { QCController } from "./alignment/qc/qcController";
import { QCOverlay } from "./alignment/qc/qcOverlay";
import { QCVectorVisualizer } from "./alignment/qc/qcVectorVisualizer";
import { loadParcels, findParcelAt } from "./geo/parcelService.js";
import { DebugHUD } from "./ui/debugHUD";
import "./ui/infoOverlay.css";

const viewer = new Viewer();
let splatLayer: GaussianSplatLayer;
let qcController: QCController | null = null;
let qcOverlay: QCOverlay | null = null;
let qcVisualizer: QCVectorVisualizer | null = null;
let debugHUD: DebugHUD;

// Mode toggle: 'parcel' or 'qc'
let interactionMode: 'parcel' | 'qc' = 'parcel';

// Debug flags
let depthTestAgainstTerrain = true;
let pickTranslucentDepth = true;

// Starting values for tracking - PepperWood Preserve coordinates
const INITIAL_VALUES = {
  lon: -122.6895,
  lat: 38.5701,
  height: 400,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
  scale: 50.0
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
    INITIAL_VALUES.scale
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

  // Initialize QC system after splat is loaded
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

      console.log('✅ QC system initialized (press T to toggle panel)');
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

  // Press 'S' to save pose to manifest file
  if (e.key === 's' || e.key === 'S') {
    if (splatLayer) {
      console.log('💾 Saving current pose to manifest...');
      splatLayer.savePoseToFile('User-adjusted pose via keyboard');
    }
  }

  // Press 'G' to toggle between Parcel Identify and QC modes
  if (e.key === 'g' || e.key === 'G') {
    interactionMode = interactionMode === 'parcel' ? 'qc' : 'parcel';
    console.log(`🔄 Interaction mode: ${interactionMode.toUpperCase()}`);
    if (interactionMode === 'qc') {
      console.log('🎯 QC Mode: Press T to open QC panel, 1 to pick truth points, 2 to pick splat points');
    } else {
      console.log('📍 Parcel Mode: Click to identify parcels');
    }
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

  // QC controls (only if QC is initialized)
  if (qcController && qcOverlay) {
    if (e.key === 't' || e.key === 'T') {
      console.log('🔑 Key pressed: T (toggle QC panel)');
      qcOverlay.toggle();
    } else if (e.key === '1') {
      console.log('🔑 Key pressed: 1 (pick truth point)');
      qcController.pickTruthPoint();
    } else if (e.key === '2') {
      console.log('🔑 Key pressed: 2 (pick splat point)');
      qcController.pickSplatPoint();
    } else if (e.key === 'e' || e.key === 'E') {
      console.log('🔑 Key pressed: E (export CSV)');
      if (qcOverlay.isVisible()) {
        qcController.downloadCSV();
      } else {
        console.log('⚠️ QC panel must be visible to export CSV');
      }
    } else if (e.key === 'c' || e.key === 'C') {
      console.log('🔑 Key pressed: C (clear pairs)');
      if (qcOverlay.isVisible() && confirm('Clear all QC pairs?')) {
        qcController.clearPairs();
      }
    } else if (e.key === 'v' || e.key === 'V') {
      console.log('🔑 Key pressed: V (toggle vectors)');
      if (qcOverlay.isVisible()) {
        qcController.toggleVectors();
      } else {
        console.log('⚠️ QC panel must be visible to toggle vectors');
      }
    }
  }
});

if (viewer.cesium) {
  loadPepperWoodScene();

  console.log('💡 TIP: Adjust the splat using keyboard controls');
  console.log('💡 Press P to print final values, S to save pose to manifest');
  console.log('💡 Press R to reset pose, F to focus camera on splat');
  console.log('💡 Press G to toggle Parcel/QC mode, D to toggle depth picking');
  console.log('💡 Press I for blank imagery, Shift+I for Esri, Ctrl+I for OSM');
  console.log('💡 Press Shift+O to toggle depth test against terrain');
  console.log(`📍 Current mode: ${interactionMode.toUpperCase()}`);
  console.log('ℹ️  Set localStorage.GEOSPLAT_BYPASS_POSE = "1" to skip pose loading');

  // Add click handler for QC point picking and parcel lookup (after scene is set up)
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.cesium.scene.canvas);

  handler.setInputAction((movement: any) => {
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
