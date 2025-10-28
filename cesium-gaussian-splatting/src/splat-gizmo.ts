import * as THREE from 'three';
import * as Cesium from 'cesium';
import { GaussianSplatLayer } from './gaussian-splat-layer';

export class SplatGizmo {
  private splatLayer: GaussianSplatLayer;
  private gizmoGroup: THREE.Group;
  private camera: THREE.Camera;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private selectedHandle: THREE.Object3D | null = null;
  private isDragging: boolean = false;
  private dragStartPosition: THREE.Vector3 = new THREE.Vector3();
  private lastMousePosition: THREE.Vector2 | null = null;
  private gizmoScale: number = 5; // Base scale for gizmo relative to splat

  // Gizmo components
  private translationArrows: THREE.Group;
  private rotationRings: THREE.Group;
  private scaleHandles: THREE.Group;
  private boundingBox: THREE.BoxHelper;

  // Colors
  private xColor = 0xff4444; // Red
  private yColor = 0x44ff44; // Green
  private zColor = 0x4444ff; // Blue
  private selectedColor = 0xffff00; // Yellow

  constructor(splatLayer: GaussianSplatLayer, camera: THREE.Camera) {
    this.splatLayer = splatLayer;
    this.camera = camera;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    console.log('Creating SplatGizmo for layer:', splatLayer);
    this.createGizmo();
    this.attachToSplat();
    this.setupEventListeners();
    console.log('SplatGizmo created and attached');
  }

  private createGizmo() {
    this.gizmoGroup = new THREE.Group();

    // Create bounding box
    this.createBoundingBox();

    // Create translation arrows
    this.createTranslationArrows();

    // Create rotation rings
    this.createRotationRings();

    // Create scale handles
    this.createScaleHandles();
  }

  private createBoundingBox() {
    // Create a wireframe box around the splat
    const geometry = new THREE.BoxGeometry(this.gizmoScale, this.gizmoScale, this.gizmoScale);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true,
      transparent: true,
      opacity: 0.5
    });
    const box = new THREE.Mesh(geometry, material);
    box.userData = { type: 'boundingBox' };
    this.gizmoGroup.add(box);
    console.log('Bounding box created with scale:', this.gizmoScale);
  }

  private createTranslationArrows() {
    this.translationArrows = new THREE.Group();

    // X-axis arrow (Red)
    const xArrow = this.createArrow(this.xColor, new THREE.Vector3(1, 0, 0));
    xArrow.userData = { type: 'translate', axis: 'x' };
    this.translationArrows.add(xArrow);

    // Y-axis arrow (Green)
    const yArrow = this.createArrow(this.yColor, new THREE.Vector3(0, 1, 0));
    yArrow.userData = { type: 'translate', axis: 'y' };
    this.translationArrows.add(yArrow);

    // Z-axis arrow (Blue)
    const zArrow = this.createArrow(this.zColor, new THREE.Vector3(0, 0, 1));
    zArrow.userData = { type: 'translate', axis: 'z' };
    this.translationArrows.add(zArrow);

    this.gizmoGroup.add(this.translationArrows);
  }

  private createArrow(color: number, direction: THREE.Vector3): THREE.Group {
    const arrow = new THREE.Group();

    // Arrow shaft
    const shaftGeometry = new THREE.CylinderGeometry(0.2, 0.2, this.gizmoScale * 0.8, 8);
    const shaftMaterial = new THREE.MeshBasicMaterial({ color });
    const shaft = new THREE.Mesh(shaftGeometry, shaftMaterial);

    // Arrow head
    const headGeometry = new THREE.ConeGeometry(0.6, this.gizmoScale * 0.2, 8);
    const headMaterial = new THREE.MeshBasicMaterial({ color });
    const head = new THREE.Mesh(headGeometry, headMaterial);

    // Position and orient the arrow
    if (direction.x !== 0) {
      // X-axis
      shaft.rotation.z = -Math.PI / 2;
      head.rotation.z = -Math.PI / 2;
      shaft.position.x = this.gizmoScale * 0.6;
      head.position.x = this.gizmoScale * 1.1;
    } else if (direction.y !== 0) {
      // Y-axis (default orientation)
      shaft.position.y = this.gizmoScale * 0.6;
      head.position.y = this.gizmoScale * 1.1;
    } else {
      // Z-axis
      shaft.rotation.x = Math.PI / 2;
      head.rotation.x = Math.PI / 2;
      shaft.position.z = this.gizmoScale * 0.6;
      head.position.z = this.gizmoScale * 1.1;
    }

    arrow.add(shaft);
    arrow.add(head);

    return arrow;
  }

  private createRotationRings() {
    this.rotationRings = new THREE.Group();

    // X rotation ring (Red)
    const xRing = this.createRing(this.xColor, new THREE.Vector3(0, 0, Math.PI / 2));
    xRing.userData = { type: 'rotate', axis: 'x' };
    this.rotationRings.add(xRing);

    // Y rotation ring (Green)
    const yRing = this.createRing(this.yColor, new THREE.Vector3(0, 0, 0));
    yRing.userData = { type: 'rotate', axis: 'y' };
    this.rotationRings.add(yRing);

    // Z rotation ring (Blue)
    const zRing = this.createRing(this.zColor, new THREE.Vector3(Math.PI / 2, 0, 0));
    zRing.userData = { type: 'rotate', axis: 'z' };
    this.rotationRings.add(zRing);

    this.gizmoGroup.add(this.rotationRings);
  }

  private createRing(color: number, rotation: THREE.Vector3): THREE.Mesh {
    const geometry = new THREE.TorusGeometry(this.gizmoScale * 0.8, 0.5, 8, 32);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.7
    });
    const ring = new THREE.Mesh(geometry, material);
    ring.rotation.set(rotation.x, rotation.y, rotation.z);
    return ring;
  }

  private createScaleHandles() {
    this.scaleHandles = new THREE.Group();

    const handleSize = 2;
    const distance = this.gizmoScale * 0.7;

    // Corner scale handles
    const positions = [
      new THREE.Vector3(distance, distance, distance),
      new THREE.Vector3(-distance, distance, distance),
      new THREE.Vector3(distance, -distance, distance),
      new THREE.Vector3(-distance, -distance, distance),
      new THREE.Vector3(distance, distance, -distance),
      new THREE.Vector3(-distance, distance, -distance),
      new THREE.Vector3(distance, -distance, -distance),
      new THREE.Vector3(-distance, -distance, -distance),
    ];

    positions.forEach((pos, index) => {
      const geometry = new THREE.BoxGeometry(handleSize, handleSize, handleSize);
      const material = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
      const handle = new THREE.Mesh(geometry, material);
      handle.position.copy(pos);
      handle.userData = { type: 'scale', index };
      this.scaleHandles.add(handle);
    });

    this.gizmoGroup.add(this.scaleHandles);
  }

  private attachToSplat() {
    // Position the gizmo at the center of the splat
    this.gizmoGroup.position.set(0, 0, 0);

    // Make sure the gizmo is visible and properly scaled
    this.gizmoGroup.visible = true;

    // Add the gizmo to the splat's scene
    this.splatLayer.scene.add(this.gizmoGroup);
    console.log('Gizmo attached to splat scene at position:', this.gizmoGroup.position);
  }

  private setupEventListeners() {
    // Get the Three.js canvas specifically
    const threeContainer = document.getElementById('three');
    const canvas = threeContainer?.querySelector('canvas');
    if (canvas) {
      canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
      canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
      canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
      canvas.addEventListener('mouseleave', this.onMouseUp.bind(this));
    } else {
      console.warn('Could not find Three.js canvas for gizmo event listeners');
    }
  }

  private onMouseDown(event: MouseEvent) {
    event.preventDefault();

    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Check for intersections with gizmo handles
    const intersects = this.raycaster.intersectObjects(this.gizmoGroup.children, true);
    console.log('Mouse down - intersects found:', intersects.length);

    if (intersects.length > 0) {
      console.log('Selected gizmo handle:', intersects[0].object.userData);
      this.selectedHandle = intersects[0].object;
      this.isDragging = true;
      this.dragStartPosition.copy(intersects[0].point);
      this.lastMousePosition = this.mouse.clone();

      // Set manipulation flag to prevent position override
      this.splatLayer.isBeingManipulated = true;

      // Highlight selected handle
      this.highlightHandle(this.selectedHandle, true);
    }
  }

  private onMouseMove(event: MouseEvent) {
    if (!this.isDragging || !this.selectedHandle) return;

    event.preventDefault();

    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Handle different types of transformations
    const userData = this.selectedHandle.userData;

    if (userData.type === 'translate') {
      this.handleTranslation(userData.axis);
    } else if (userData.type === 'rotate') {
      this.handleRotation(userData.axis);
    } else if (userData.type === 'scale') {
      this.handleScaling();
    }
  }

  private onMouseUp() {
    if (this.selectedHandle) {
      this.highlightHandle(this.selectedHandle, false);
    }

    this.selectedHandle = null;
    this.isDragging = false;
    this.lastMousePosition = null;

    // Clear manipulation flag
    this.splatLayer.isBeingManipulated = false;
  }

  private handleTranslation(axis: string) {
    // Get camera position for proper plane calculation
    const cameraPosition = this.camera.position.clone();

    // Create a plane perpendicular to the selected axis for dragging
    const plane = new THREE.Plane();
    const planeNormal = new THREE.Vector3();
    const currentSplatPos = this.splatLayer.scene.position.clone();

    // Set plane normal based on axis - use camera direction for better interaction
    if (axis === 'x') {
      planeNormal.set(0, 0, 1); // YZ plane for X movement
    } else if (axis === 'y') {
      planeNormal.set(1, 0, 0); // XZ plane for Y movement
    } else if (axis === 'z') {
      planeNormal.set(0, 1, 0); // XY plane for Z movement
    }

    plane.setFromNormalAndCoplanarPoint(planeNormal, currentSplatPos);

    const intersectPoint = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(plane, intersectPoint);

    if (intersectPoint) {
      const delta = intersectPoint.clone().sub(this.dragStartPosition);

      // Convert world coordinates to geographic coordinates with proper scaling
      // Cesium world coordinates are in meters, need to convert to degrees
      const earthRadius = 6378137; // Earth radius in meters
      const degreeScale = 180 / (Math.PI * earthRadius);

      if (axis === 'x') {
        // X axis corresponds to longitude changes
        const lonDelta = delta.x * degreeScale / Math.cos(Cesium.Math.toRadians(this.splatLayer.location.lat));
        this.splatLayer.location.lon += lonDelta;
      } else if (axis === 'y') {
        // Y axis corresponds to latitude changes
        const latDelta = delta.y * degreeScale;
        this.splatLayer.location.lat += latDelta;
      } else if (axis === 'z') {
        // Z axis corresponds to height changes (already in meters)
        this.splatLayer.location.height += delta.z;
      }

      this.updateSplatPosition();
      this.dragStartPosition.copy(intersectPoint);
    }
  }

  private handleRotation(axis: string) {
    const currentMouse = new THREE.Vector2(this.mouse.x, this.mouse.y);
    const lastMouse = this.lastMousePosition || currentMouse.clone();
    const delta = currentMouse.clone().sub(lastMouse);
    const rotationSpeed = 0.02;

    if (axis === 'x') {
      this.splatLayer.scene.rotation.x += delta.y * rotationSpeed;
      this.splatLayer.rotation.x = this.splatLayer.scene.rotation.x;
    } else if (axis === 'y') {
      this.splatLayer.scene.rotation.y += delta.x * rotationSpeed;
      this.splatLayer.rotation.y = this.splatLayer.scene.rotation.y;
    } else if (axis === 'z') {
      this.splatLayer.scene.rotation.z += delta.x * rotationSpeed;
      this.splatLayer.rotation.z = this.splatLayer.scene.rotation.z;
    }

    this.lastMousePosition = currentMouse.clone();
  }

  private handleScaling() {
    const delta = this.mouse.y * 0.1;
    const newScale = Math.max(0.1, this.splatLayer.scale + delta);

    if (this.splatLayer.splatViewer && this.splatLayer.splatViewer.getSplatMesh()) {
      const mesh = this.splatLayer.splatViewer.getSplatMesh();
      mesh.scale.set(newScale, newScale, newScale);
      this.splatLayer.scale = newScale;
    }
  }

  private updateSplatPosition() {
    const position = Cesium.Cartesian3.fromDegrees(
      this.splatLayer.location.lon,
      this.splatLayer.location.lat,
      this.splatLayer.location.height
    );
    this.splatLayer.scene.position.set(position.x, position.y, position.z);
  }

  private highlightHandle(handle: THREE.Object3D, highlight: boolean) {
    if (handle instanceof THREE.Mesh) {
      const material = handle.material as THREE.MeshBasicMaterial;
      if (highlight) {
        material.color.setHex(this.selectedColor);
      } else {
        // Restore original color based on handle type
        const userData = handle.userData;
        if (userData.axis === 'x') material.color.setHex(this.xColor);
        else if (userData.axis === 'y') material.color.setHex(this.yColor);
        else if (userData.axis === 'z') material.color.setHex(this.zColor);
        else material.color.setHex(0xffaa00); // Scale handles
      }
    }
  }

  public setVisible(visible: boolean) {
    this.gizmoGroup.visible = visible;
  }

  public updateGizmoScale() {
    // Dynamically scale gizmo based on distance from camera for better visibility
    const distance = this.camera.position.distanceTo(this.splatLayer.scene.position);
    const scale = Math.max(0.1, distance * 0.001);
    this.gizmoGroup.scale.setScalar(scale);
  }

  public update() {
    // Update gizmo scale and visibility based on camera distance
    this.updateGizmoScale();
  }

  public dispose() {
    this.splatLayer.scene.remove(this.gizmoGroup);
  }
}