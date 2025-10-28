import * as THREE from 'three';

export class AxisGizmo {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private rotation: THREE.Euler;
  private isDragging: boolean = false;
  private lastMouse: THREE.Vector2;
  private onRotationChange: (rotation: THREE.Euler) => void;

  // Axis colors
  private xColor = new THREE.Color(0xff4444); // Red
  private yColor = new THREE.Color(0x44ff44); // Green
  private zColor = new THREE.Color(0x4444ff); // Blue

  constructor(canvasId: string, onRotationChange: (rotation: THREE.Euler) => void) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    this.onRotationChange = onRotationChange;
    this.rotation = new THREE.Euler(0, 0, 0);
    this.lastMouse = new THREE.Vector2();

    this.init();
    this.setupEventListeners();
    this.render();
  }

  private init() {
    // Setup renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true
    });
    this.renderer.setSize(120, 120);
    this.renderer.setClearColor(0x000000, 0);

    // Setup scene
    this.scene = new THREE.Scene();

    // Setup camera
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    this.camera.position.set(0, 0, 3);

    // Create axis gizmo
    this.createAxisGizmo();
  }

  private createAxisGizmo() {
    const group = new THREE.Group();

    // Create axis lines
    const axisLength = 1.2;
    const lineWidth = 3;

    // X-axis (Red)
    const xGeometry = new THREE.CylinderGeometry(0.02, 0.02, axisLength, 8);
    const xMaterial = new THREE.MeshBasicMaterial({ color: this.xColor });
    const xAxis = new THREE.Mesh(xGeometry, xMaterial);
    xAxis.rotation.z = -Math.PI / 2;
    xAxis.position.x = axisLength / 2;
    group.add(xAxis);

    // X-axis arrow
    const xArrowGeometry = new THREE.ConeGeometry(0.08, 0.2, 8);
    const xArrow = new THREE.Mesh(xArrowGeometry, xMaterial);
    xArrow.rotation.z = -Math.PI / 2;
    xArrow.position.x = axisLength + 0.1;
    group.add(xArrow);

    // Y-axis (Green)
    const yGeometry = new THREE.CylinderGeometry(0.02, 0.02, axisLength, 8);
    const yMaterial = new THREE.MeshBasicMaterial({ color: this.yColor });
    const yAxis = new THREE.Mesh(yGeometry, yMaterial);
    yAxis.position.y = axisLength / 2;
    group.add(yAxis);

    // Y-axis arrow
    const yArrowGeometry = new THREE.ConeGeometry(0.08, 0.2, 8);
    const yArrow = new THREE.Mesh(yArrowGeometry, yMaterial);
    yArrow.position.y = axisLength + 0.1;
    group.add(yArrow);

    // Z-axis (Blue)
    const zGeometry = new THREE.CylinderGeometry(0.02, 0.02, axisLength, 8);
    const zMaterial = new THREE.MeshBasicMaterial({ color: this.zColor });
    const zAxis = new THREE.Mesh(zGeometry, zMaterial);
    zAxis.rotation.x = Math.PI / 2;
    zAxis.position.z = axisLength / 2;
    group.add(zAxis);

    // Z-axis arrow
    const zArrowGeometry = new THREE.ConeGeometry(0.08, 0.2, 8);
    const zArrow = new THREE.Mesh(zArrowGeometry, zMaterial);
    zArrow.rotation.x = Math.PI / 2;
    zArrow.position.z = axisLength + 0.1;
    group.add(zArrow);

    // Add rotation rings
    this.addRotationRings(group);

    // Add axis labels
    this.addAxisLabels(group);

    this.scene.add(group);
  }

  private addRotationRings(group: THREE.Group) {
    const ringRadius = 1.5;
    const ringSegments = 64;

    // X rotation ring (Red)
    const xRingGeometry = new THREE.TorusGeometry(ringRadius, 0.01, 4, ringSegments);
    const xRingMaterial = new THREE.MeshBasicMaterial({
      color: this.xColor,
      transparent: true,
      opacity: 0.6
    });
    const xRing = new THREE.Mesh(xRingGeometry, xRingMaterial);
    xRing.rotation.z = Math.PI / 2;
    xRing.userData = { axis: 'x' };
    group.add(xRing);

    // Y rotation ring (Green)
    const yRingGeometry = new THREE.TorusGeometry(ringRadius, 0.01, 4, ringSegments);
    const yRingMaterial = new THREE.MeshBasicMaterial({
      color: this.yColor,
      transparent: true,
      opacity: 0.6
    });
    const yRing = new THREE.Mesh(yRingGeometry, yRingMaterial);
    yRing.userData = { axis: 'y' };
    group.add(yRing);

    // Z rotation ring (Blue)
    const zRingGeometry = new THREE.TorusGeometry(ringRadius, 0.01, 4, ringSegments);
    const zRingMaterial = new THREE.MeshBasicMaterial({
      color: this.zColor,
      transparent: true,
      opacity: 0.6
    });
    const zRing = new THREE.Mesh(zRingGeometry, zRingMaterial);
    zRing.rotation.x = Math.PI / 2;
    zRing.userData = { axis: 'z' };
    group.add(zRing);
  }

  private addAxisLabels(group: THREE.Group) {
    // Simple sphere markers for now - could be replaced with text
    const sphereGeometry = new THREE.SphereGeometry(0.05, 8, 8);

    // X label
    const xLabel = new THREE.Mesh(sphereGeometry,
      new THREE.MeshBasicMaterial({ color: this.xColor }));
    xLabel.position.set(1.8, 0, 0);
    group.add(xLabel);

    // Y label
    const yLabel = new THREE.Mesh(sphereGeometry,
      new THREE.MeshBasicMaterial({ color: this.yColor }));
    yLabel.position.set(0, 1.8, 0);
    group.add(yLabel);

    // Z label
    const zLabel = new THREE.Mesh(sphereGeometry,
      new THREE.MeshBasicMaterial({ color: this.zColor }));
    zLabel.position.set(0, 0, 1.8);
    group.add(zLabel);
  }

  private setupEventListeners() {
    this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
    this.canvas.addEventListener('mouseleave', this.onMouseUp.bind(this));
  }

  private onMouseDown(event: MouseEvent) {
    this.isDragging = true;
    this.lastMouse.set(event.clientX, event.clientY);
  }

  private onMouseMove(event: MouseEvent) {
    if (!this.isDragging) return;

    const deltaX = event.clientX - this.lastMouse.x;
    const deltaY = event.clientY - this.lastMouse.y;

    // Convert mouse movement to rotation
    const rotationSpeed = 0.01;
    this.rotation.y += deltaX * rotationSpeed;
    this.rotation.x += deltaY * rotationSpeed;

    // Update the gizmo visualization
    this.scene.children[0].rotation.copy(this.rotation);

    // Notify parent of rotation change
    this.onRotationChange(this.rotation.clone());

    this.lastMouse.set(event.clientX, event.clientY);
    this.render();
  }

  private onMouseUp() {
    this.isDragging = false;
  }

  public setRotation(rotation: THREE.Euler) {
    this.rotation.copy(rotation);
    this.scene.children[0].rotation.copy(this.rotation);
    this.render();
  }

  public render() {
    this.renderer.render(this.scene, this.camera);
  }

  public dispose() {
    this.renderer.dispose();
  }
}