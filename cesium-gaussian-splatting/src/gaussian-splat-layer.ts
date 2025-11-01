import * as Cesium from "cesium";
import * as THREE from "three";
import * as GaussianSplats3D from "@mkkellogg/gaussian-splats-3d";
import { savePose, loadPose, applyPose, createDefaultMatrix, type SplatPose } from "./alignment/pose";
import { alignGroundToUp, type Vec3 } from "./alignment/planeFit";

/**
 * Compute ENU (East-North-Up) to ECEF rotation for a given lat/lon
 * This aligns a local ENU coordinate system with ECEF at that location
 *
 * The resulting quaternion rotates from ENU frame to ECEF:
 * - ENU: X=East, Y=North, Z=Up
 * - ECEF: Origin at Earth center, Z through north pole
 *
 * @param lon Longitude in degrees
 * @param lat Latitude in degrees
 * @returns THREE.Quaternion that rotates from ENU to ECEF
 */
function computeENUToECEFRotation(lon: number, lat: number): THREE.Quaternion {
  const lonRad = Cesium.Math.toRadians(lon);
  const latRad = Cesium.Math.toRadians(lat);

  const cosLon = Math.cos(lonRad);
  const sinLon = Math.sin(lonRad);
  const cosLat = Math.cos(latRad);
  const sinLat = Math.sin(latRad);

  // ENU to ECEF rotation matrix
  // Columns represent where ENU axes point in ECEF
  // Column 1 (East): [-sin(lon), cos(lon), 0]
  // Column 2 (North): [-sin(lat)*cos(lon), -sin(lat)*sin(lon), cos(lat)]
  // Column 3 (Up): [cos(lat)*cos(lon), cos(lat)*sin(lon), sin(lat)]
  const rotMatrix = new THREE.Matrix4();
  rotMatrix.set(
    -sinLon,           -sinLat * cosLon,  cosLat * cosLon,  0,
     cosLon,           -sinLat * sinLon,  cosLat * sinLon,  0,
     0,                 cosLat,            sinLat,           0,
     0,                 0,                 0,                1
  );

  // Convert to quaternion for cleaner rotation composition
  const quat = new THREE.Quaternion();
  quat.setFromRotationMatrix(rotMatrix);

  return quat;
}

export class GaussianSplatLayer {
  public scene!: THREE.Scene;
  public splatViewer: GaussianSplats3D.Viewer;
  public ready: boolean;
  private model: string;
  public location: { lon: number; lat: number; height: number };
  private rotation: { x: number; y: number; z: number };
  public scale: number;
  private savedPose: SplatPose | null = null;
  private defaultAnchor: { lon: number; lat: number; height: number };
  private defaultScale: number;
  public onReady?: () => void;
  private cesiumViewer?: Cesium.Viewer;
  public hideWhenBelowTerrain: boolean = false; // Disabled by default - doesn't work reliably

  constructor(
    model: string,
    location: { lon: number; lat: number; height: number },
    rotation: { x: number; y: number; z: number },
    initialScale: number = 1,
    cesiumViewer?: Cesium.Viewer
  ) {
    this.ready = false;
    this.model = model;
    this.location = location;
    this.rotation = rotation;
    this.scale = initialScale;
    this.cesiumViewer = cesiumViewer;

    // Store defaults for reset functionality
    this.defaultAnchor = { ...location };
    this.defaultScale = initialScale;

    window.addEventListener("keydown", (event) => {
      this.adjustScene(event);
    });
  }

  private adjustScene(event: KeyboardEvent) {
    // Skip if Shift is pressed (reserved for main.ts commands like Shift+S, Shift+L)
    if (event.shiftKey) {
      return;
    }

    switch (event.key) {
      case "q":
        this.rotation.y += 0.005;
        this.scene.rotateY(0.005);
        break;
      case "w":
        this.rotation.y -= 0.005;
        this.scene.rotateY(-0.005);
        break;
      case "a":
        this.rotation.x += 0.005;
        this.scene.rotateX(0.005);
        break;
      case "s":
        this.rotation.x -= 0.005;
        this.scene.rotateX(-0.005);
        break;
      case "z":
        this.rotation.z += 0.005;
        this.scene.rotateZ(0.005);
        break;
      case "x":
        this.rotation.z -= 0.005;
        this.scene.rotateZ(-0.005);
        break;
      case "y":
        this.location.lat += 0.0000025;
        this.updatePosition();
        break;
      case "h":
        this.location.lat -= 0.0000025;
        this.updatePosition();
        break;
      case "j":
        this.location.lon += 0.0000025;
        this.updatePosition();
        break;
      case "g":
        this.location.lon -= 0.0000025;
        this.updatePosition();
        break;
      case "o": // Height increment
        this.location.height += 1;
        this.updatePosition();
        break;
      case "l": // Height decrement
        this.location.height -= 1;
        this.updatePosition();
        break;
      case "m":
        this.scale += 0.05;
        this.updateScale();
        break;
      case "n":
        if (this.scale > 0.05) {
          this.scale -= 0.05;
          this.updateScale();
        }
        break;
      default:
        return; // Don't log if key not handled
    }

    console.log(
      "Model:",
      this.model,
      "\nRotation:",
      this.scene.rotation.x,
      this.scene.rotation.y,
      this.scene.rotation.z,
      "\nLoc:",
      `Lon: ${this.location.lon}, Lat: ${this.location.lat}, Height: ${this.location.height}`,
      "\nScale:",
      this.scale
    );

    // Simple tracking - log each adjustment
    console.log(`\n📊 ADJUSTMENT TRACKED:`);
    console.log(`  Key: ${event.key}`);
    console.log(`  Lon: ${this.location.lon.toFixed(8)}`);
    console.log(`  Lat: ${this.location.lat.toFixed(8)}`);
    console.log(`  Height: ${this.location.height.toFixed(2)}m`);
    console.log(`  Rotation: X=${this.scene.rotation.x.toFixed(4)}, Y=${this.scene.rotation.y.toFixed(4)}, Z=${this.scene.rotation.z.toFixed(4)}`);
    console.log(`  Scale: ${this.scale.toFixed(3)}\n`);
  }

  private updatePosition() {
    const position = Cesium.Cartesian3.fromDegrees(
      this.location.lon,
      this.location.lat,
      this.location.height
    );
    this.scene.position.set(position.x, position.y, position.z);

    // DON'T recalculate rotation when just moving position
    // The user has manually adjusted the rotation, keep it as-is
    // Only position changes, rotation stays the same

    // Check if below terrain and update visibility
    this.updateVisibilityBasedOnTerrain();
  }

  /**
   * Check if splat anchor is below terrain and hide if enabled
   */
  private updateVisibilityBasedOnTerrain() {
    if (!this.hideWhenBelowTerrain || !this.cesiumViewer || !this.ready) {
      this.scene.visible = true;
      return;
    }

    try {
      const cartographic = Cesium.Cartographic.fromDegrees(
        this.location.lon,
        this.location.lat
      );

      // Sample terrain height at this location
      const terrainProvider = this.cesiumViewer.terrainProvider;
      Cesium.sampleTerrainMostDetailed(terrainProvider, [cartographic]).then((samples) => {
        if (samples && samples.length > 0 && samples[0].height !== undefined) {
          const terrainHeight = samples[0].height;
          const isBelowTerrain = this.location.height < terrainHeight;

          // Hide splat if below terrain
          this.scene.visible = !isBelowTerrain;

          if (isBelowTerrain) {
            console.log(`⚠️ Splat anchor is below terrain! (Height: ${this.location.height.toFixed(2)}m, Terrain: ${terrainHeight.toFixed(2)}m)`);
          }
        }
      }).catch((error) => {
        console.warn('Failed to sample terrain height:', error);
      });
    } catch (error) {
      console.warn('Error checking terrain height:', error);
    }
  }

  private updateScale() {
    if (this.splatViewer.getSplatMesh()) {
      const mesh = this.splatViewer.getSplatMesh();
      mesh.scale.set(this.scale, this.scale, this.scale);
    }
  }

  public async setup(camera: THREE.Camera, renderer: THREE.Renderer) {
    // DISABLED: Try to load saved pose first (causing splat to not appear)
    // this.savedPose = await loadPose();

    const position = Cesium.Cartesian3.fromDegrees(
      this.location.lon,
      this.location.lat,
      this.location.height
    );

    this.splatViewer = new GaussianSplats3D.Viewer({
      selfDrivenMode: false,
      gpuAcceleratedSort: true,
      sharedMemoryForWorkers: false,
      ignoreDevicePixelRatio: true,
      sceneRevealMode: GaussianSplats3D.SceneRevealMode.Always,
      useBuiltInControls: false,
      camera: camera,
      renderer: renderer,
    });

    // create parent scene and place at given position
    // placing the splat scene directly at a world location
    // results in jittering and inconsistent gaussian positions
    // due to too large numbers
    this.scene = new THREE.Scene();

    // Set position in ECEF
    this.scene.position.set(position.x, position.y, position.z);

    // Apply rotation directly (no ENU auto-alignment)
    // User has manually calibrated these exact rotation values
    this.scene.rotation.set(this.rotation.x, this.rotation.y, this.rotation.z);

    console.log('📍 Loading splat with calibrated values:');
    console.log(`   Location: Lon=${this.location.lon.toFixed(6)}, Lat=${this.location.lat.toFixed(6)}, Height=${this.location.height.toFixed(2)}m`);
    console.log(`   Rotation: X=${this.rotation.x.toFixed(6)}, Y=${this.rotation.y.toFixed(6)}, Z=${this.rotation.z.toFixed(6)}`);
    console.log(`   Scale: ${this.scale.toFixed(3)}`);
    console.log('📦 Loading splat from:', this.model);

    this.splatViewer
      .addSplatScene(this.model, {
        showLoadingUI: true,
        progressiveLoad: false,
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      })
      .then(() => {
        console.log('✅ Splat PLY loaded, waiting for mesh...');

        // Wait for mesh to be available (getSplatMesh might need a tick)
        const checkMesh = () => {
          const mesh = this.splatViewer.getSplatMesh();
          if (mesh) {
            console.log('✅ Mesh available, adding to scene...');
            mesh.scale.set(this.scale, this.scale, this.scale);
            this.scene.add(mesh);

            // Wait one frame for WebGL to settle
            requestAnimationFrame(() => {
              this.ready = true;
              console.log('✅ Splat READY - geometry uploaded to GPU');

              // Trigger callback if set
              if (this.onReady) {
                this.onReady();
              }
            });
          } else {
            console.log('⏳ Mesh not ready yet, retrying...');
            setTimeout(checkMesh, 100);
          }
        };

        checkMesh();
      })
      .catch((error) => {
        console.error('❌ Failed to load splat:', error);
      });
  }

  /**
   * Save current pose to manifest file
   */
  public savePoseToFile(notes?: string): void {
    // Update scene matrix before saving
    this.scene.updateMatrix();

    savePose(
      {
        lon: this.location.lon,
        lat: this.location.lat,
        alt: this.location.height
      },
      this.scene.matrix,
      notes
    );
  }

  /**
   * Get current model matrix for inspection
   */
  public getModelMatrix(): THREE.Matrix4 {
    this.scene.updateMatrix();
    return this.scene.matrix.clone();
  }

  /**
   * Reset pose to identity matrix with default scale
   */
  public resetPose(): void {
    console.log('🔄 Resetting pose to defaults...');

    // Reset to default anchor
    this.location = { ...this.defaultAnchor };
    const position = Cesium.Cartesian3.fromDegrees(
      this.location.lon,
      this.location.lat,
      this.location.height
    );
    this.scene.position.set(position.x, position.y, position.z);

    // Reset rotation to ENU alignment only (no manual offsets)
    const enuQuat = computeENUToECEFRotation(this.location.lon, this.location.lat);
    this.scene.quaternion.copy(enuQuat);

    // Reset internal rotation offsets
    this.rotation = { x: 0, y: 0, z: 0 };

    // Reset scale
    this.scale = this.defaultScale;
    if (this.splatViewer.getSplatMesh()) {
      const mesh = this.splatViewer.getSplatMesh();
      mesh.scale.set(this.scale, this.scale, this.scale);
    }

    // Update matrix
    this.scene.matrixAutoUpdate = true;
    this.scene.updateMatrix();

    const finalEuler = new THREE.Euler();
    finalEuler.setFromQuaternion(enuQuat, 'XYZ');

    console.log('✅ Pose reset complete (with ENU alignment)');
    console.log(`  Anchor: ${this.location.lon.toFixed(8)}, ${this.location.lat.toFixed(8)}, ${this.location.height.toFixed(2)}m`);
    console.log(`  ENU Rotation (Euler): X=${finalEuler.x.toFixed(4)}, Y=${finalEuler.y.toFixed(4)}, Z=${finalEuler.z.toFixed(4)}`);
    console.log(`  Scale: ${this.scale}`);
  }

  /**
   * Get bounding sphere for the splat (if available)
   */
  public getBoundingSphere(): { center: THREE.Vector3; radius: number } | null {
    if (!this.ready || !this.splatViewer.getSplatMesh()) {
      return null;
    }

    const mesh = this.splatViewer.getSplatMesh();

    // Try to compute bounding sphere from geometry
    if (mesh.geometry && mesh.geometry.boundingSphere) {
      return {
        center: mesh.geometry.boundingSphere.center.clone(),
        radius: mesh.geometry.boundingSphere.radius
      };
    }

    // Fallback: estimate from position
    return {
      center: this.scene.position.clone(),
      radius: 100 // Rough estimate
    };
  }

  /**
   * Auto-level the splat by sampling ground points and aligning to horizontal plane
   *
   * NOTE: This function may not work reliably with Gaussian splats because:
   * 1. Gaussian splat geometry uses custom formats (not standard THREE.js BufferGeometry)
   * 2. Position attributes may not be accessible in the expected way
   * 3. With ENU auto-alignment enabled, this function should rarely be needed
   *
   * If you're seeing "not enough ground points" errors, this is a known limitation.
   * Instead, use manual rotation controls (Q/W/A/S/Z/X) to fine-tune alignment.
   */
  public autoLevel(): void {
    if (!this.ready || !this.splatViewer.getSplatMesh()) {
      console.error('❌ Cannot auto-level: splat not ready');
      return;
    }

    console.log('🔄 Starting auto-level...');
    console.warn('⚠️  Auto-level may not work with Gaussian splat geometry. Use manual rotation (Q/W/A/S/Z/X) if this fails.');

    // Sample points from the splat
    const groundPoints = this.sampleGroundPoints();

    if (groundPoints.length < 10) {
      console.error('❌ Not enough ground points sampled. Need at least 10, got', groundPoints.length);
      return;
    }

    console.log(`✅ Sampled ${groundPoints.length} ground points`);

    // Use plane fitting algorithm to find alignment
    const alignment = alignGroundToUp(groundPoints);

    // Apply the rotation to level the splat
    const currentRotation = this.scene.rotation.clone();

    // The alignment gives us pitch and roll corrections
    // We preserve the current yaw (rotation around vertical axis)
    this.scene.rotation.set(
      currentRotation.x + alignment.pitchRad,
      currentRotation.y,  // Preserve yaw
      currentRotation.z + alignment.rollRad
    );

    // Update internal rotation tracking
    this.rotation.x = this.scene.rotation.x;
    this.rotation.y = this.scene.rotation.y;
    this.rotation.z = this.scene.rotation.z;

    console.log('✅ Auto-level complete');
    console.log(`  Pitch correction: ${(alignment.pitchRad * 180 / Math.PI).toFixed(2)}°`);
    console.log(`  Roll correction: ${(alignment.rollRad * 180 / Math.PI).toFixed(2)}°`);
    console.log(`  Final rotation: X=${this.scene.rotation.x.toFixed(4)}, Y=${this.scene.rotation.y.toFixed(4)}, Z=${this.scene.rotation.z.toFixed(4)}`);
  }

  /**
   * Sample ground points from the splat for plane fitting
   * Strategy: Sample points from the lower percentile of Z values in local space
   */
  private sampleGroundPoints(): Vec3[] {
    const mesh = this.splatViewer.getSplatMesh();
    if (!mesh) {
      console.error('❌ No mesh available');
      return [];
    }

    console.log('🔍 Mesh info:', {
      hasGeometry: !!mesh.geometry,
      geometryType: mesh.geometry?.type,
      children: mesh.children.length
    });

    if (!mesh.geometry) {
      console.error('❌ No geometry on mesh');

      // Try to access splat data differently
      console.log('🔍 Checking mesh properties:', Object.keys(mesh));
      console.log('🔍 Viewer properties:', Object.keys(this.splatViewer));

      return [];
    }

    const geometry = mesh.geometry;
    console.log('🔍 Geometry attributes:', Object.keys(geometry.attributes || {}));

    const positionAttr = geometry.getAttribute('position');

    if (!positionAttr) {
      console.error('❌ No position attribute in geometry');
      console.error('Available attributes:', Object.keys(geometry.attributes || {}));
      return [];
    }

    const positions = positionAttr.array;
    const vertexCount = positions.length / 3;
    console.log(`📊 Total vertices: ${vertexCount}`);
    console.log(`📊 Position array length: ${positions.length}`);
    console.log(`📊 Position array type:`, positions.constructor.name);

    if (vertexCount === 0) {
      console.error('❌ No vertices in position array');
      return [];
    }

    // Sample points (max 1000 for performance)
    const maxSamples = Math.min(1000, vertexCount);
    const sampleStep = Math.max(1, Math.floor(vertexCount / maxSamples));

    console.log(`📊 Sample step: ${sampleStep}, will sample ~${Math.floor(vertexCount / sampleStep)} points`);

    const tempPositions: { pos: THREE.Vector3; z: number }[] = [];
    const localPos = new THREE.Vector3();
    const worldPos = new THREE.Vector3();

    // Sample positions from geometry
    for (let i = 0; i < vertexCount; i += sampleStep) {
      const idx = i * 3;

      // Bounds check
      if (idx + 2 >= positions.length) {
        console.warn(`⚠️ Index out of bounds: ${idx} >= ${positions.length}`);
        break;
      }

      // Get local position
      localPos.set(
        positions[idx],
        positions[idx + 1],
        positions[idx + 2]
      );

      // Transform to world space
      worldPos.copy(localPos);
      mesh.localToWorld(worldPos);

      // Store with local Z for sorting (local Z determines "ground")
      tempPositions.push({
        pos: worldPos.clone(),
        z: localPos.z  // Use local Z for ground detection
      });
    }

    console.log(`✅ Sampled ${tempPositions.length} points`);

    if (tempPositions.length === 0) {
      console.error('❌ No points were sampled');
      return [];
    }

    // Sort by local Z value and take the lowest 30% (ground points)
    tempPositions.sort((a, b) => a.z - b.z);
    const groundCount = Math.floor(tempPositions.length * 0.3);

    console.log(`📊 Using bottom ${groundCount} points (30% of ${tempPositions.length}) as ground`);
    console.log(`📊 Z range: ${tempPositions[0].z.toFixed(3)} to ${tempPositions[tempPositions.length - 1].z.toFixed(3)}`);

    const points: Vec3[] = [];
    for (let i = 0; i < groundCount; i++) {
      const p = tempPositions[i].pos;
      points.push([p.x, p.y, p.z]);
    }

    return points;
  }

}
