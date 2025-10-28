import * as Cesium from "cesium";
import * as THREE from "three";
import * as GaussianSplats3D from "@mkkellogg/gaussian-splats-3d";
import { savePose, loadPose, applyPose, createDefaultMatrix, type SplatPose } from "./alignment/pose";

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

  constructor(
    model: string,
    location: { lon: number; lat: number; height: number },
    rotation: { x: number; y: number; z: number },
    initialScale: number = 1
  ) {
    this.ready = false;
    this.model = model;
    this.location = location;
    this.rotation = rotation;
    this.scale = initialScale;

    // Store defaults for reset functionality
    this.defaultAnchor = { ...location };
    this.defaultScale = initialScale;

    window.addEventListener("keydown", (event) => {
      this.adjustScene(event);
    });
  }

  private adjustScene(event: KeyboardEvent) {
    switch (event.key) {
      case "q":
        this.scene.rotateY(0.005);
        break;
      case "w":
        this.scene.rotateY(-0.005);
        break;
      case "a":
        this.scene.rotateX(0.005);
        break;
      case "s":
        this.scene.rotateX(-0.005);
        break;
      case "z":
        this.scene.rotateZ(0.005);
        break;
      case "x":
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
      case "u": // Changed from 'g' to avoid conflict with mode toggle
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

    // Always use constructor params (pose loading disabled for now)
    this.scene.position.set(position.x, position.y, position.z);
    this.scene.rotation.set(this.rotation.x, this.rotation.y, this.rotation.z);

    console.log('📍 Using constructor rotation:', this.rotation);
    console.log('📦 Loading splat from:', this.model);

    this.splatViewer
      .addSplatScene(this.model, {
        showLoadingUI: false,
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

    // Reset rotation to identity
    this.scene.rotation.set(0, 0, 0);

    // Reset scale
    this.scale = this.defaultScale;
    if (this.splatViewer.getSplatMesh()) {
      const mesh = this.splatViewer.getSplatMesh();
      mesh.scale.set(this.scale, this.scale, this.scale);
    }

    // Update matrix
    this.scene.matrixAutoUpdate = true;
    this.scene.updateMatrix();

    console.log('✅ Pose reset complete');
    console.log(`  Anchor: ${this.location.lon.toFixed(8)}, ${this.location.lat.toFixed(8)}, ${this.location.height.toFixed(2)}m`);
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
}
