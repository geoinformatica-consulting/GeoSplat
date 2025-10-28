import * as Cesium from 'cesium';
import * as THREE from 'three';
import { GaussianSplatLayer } from './gaussian-splat-layer';

export interface RoadFeature {
  points: THREE.Vector2[];
  direction: number;
  length: number;
  confidence: number;
}

export interface AlignmentResult {
  position: { lon: number; lat: number; height: number };
  rotation: { x: number; y: number; z: number };
  scale: number;
  confidence: number;
}

export class RoadAlignment {
  private cesiumViewer: Cesium.Viewer;
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;

  constructor(cesiumViewer: Cesium.Viewer) {
    this.cesiumViewer = cesiumViewer;
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1024;
    this.canvas.height = 1024;
    this.context = this.canvas.getContext('2d')!;
  }

  public async alignSplatToRoads(
    splatLayer: GaussianSplatLayer,
    searchRadius: number = 0.001 // degrees
  ): Promise<AlignmentResult> {
    console.log('Starting road-based alignment...');

    // Step 1: Capture current map imagery
    const mapImagery = await this.captureMapImagery(
      splatLayer.location.lon,
      splatLayer.location.lat,
      searchRadius
    );

    // Step 2: Extract road features from map
    const mapRoads = this.extractRoadFeatures(mapImagery, 'map');

    // Step 3: Extract road features from splat render
    const splatImagery = await this.captureSplatImagery(splatLayer);
    const splatRoads = this.extractRoadFeatures(splatImagery, 'splat');

    // Step 4: Create debug visualizations
    this.createDebugVisualization(mapImagery, mapRoads, 'map');
    this.createDebugVisualization(splatImagery, splatRoads, 'splat');

    // Step 5: Find best alignment
    const alignment = this.findBestAlignment(mapRoads, splatRoads, splatLayer);

    console.log('Alignment result:', alignment);
    console.log(`Map roads found: ${mapRoads.length}, Splat roads found: ${splatRoads.length}`);

    return alignment;
  }

  private createDebugVisualization(imageData: ImageData, roads: RoadFeature[], type: string) {
    // Create a debug canvas to show detected roads
    const debugCanvas = document.createElement('canvas');
    debugCanvas.width = imageData.width;
    debugCanvas.height = imageData.height;
    debugCanvas.style.position = 'absolute';
    debugCanvas.style.top = type === 'map' ? '10px' : '10px';
    debugCanvas.style.left = type === 'map' ? '10px' : '150px';
    debugCanvas.style.width = '128px';
    debugCanvas.style.height = '128px';
    debugCanvas.style.border = '2px solid ' + (type === 'map' ? '#00ff00' : '#ff0000');
    debugCanvas.style.zIndex = '1001';
    debugCanvas.title = `${type} roads detected: ${roads.length}`;

    const ctx = debugCanvas.getContext('2d')!;

    // Draw the original image
    ctx.putImageData(imageData, 0, 0);

    // Overlay detected roads
    ctx.strokeStyle = type === 'map' ? '#00ff00' : '#ff0000';
    ctx.lineWidth = 2;

    roads.forEach(road => {
      if (road.points.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(road.points[0].x, road.points[0].y);
        ctx.lineTo(road.points[1].x, road.points[1].y);
        ctx.stroke();
      }
    });

    // Add to page temporarily
    document.body.appendChild(debugCanvas);

    // Remove after 10 seconds
    setTimeout(() => {
      if (debugCanvas.parentNode) {
        debugCanvas.parentNode.removeChild(debugCanvas);
      }
    }, 10000);
  }

  private async captureMapImagery(
    centerLon: number,
    centerLat: number,
    radius: number
  ): Promise<ImageData> {
    console.log(`Capturing map imagery at ${centerLon}, ${centerLat} with radius ${radius}`);

    // Create a temporary canvas to capture Cesium imagery
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.canvas.width;
    tempCanvas.height = this.canvas.height;
    const tempContext = tempCanvas.getContext('2d')!;

    // Store current camera state
    const originalPosition = this.cesiumViewer.camera.position.clone();
    const originalOrientation = {
      heading: this.cesiumViewer.camera.heading,
      pitch: this.cesiumViewer.camera.pitch,
      roll: this.cesiumViewer.camera.roll
    };

    try {
      // Set camera to orthographic view of the area
      const height = 2000; // meters above ground
      const center = Cesium.Cartesian3.fromDegrees(centerLon, centerLat, height);

      this.cesiumViewer.camera.setView({
        destination: center,
        orientation: {
          heading: 0,
          pitch: Cesium.Math.toRadians(-90), // Top-down view
          roll: 0
        }
      });

      // Wait for tiles to load and render
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Force a render
      this.cesiumViewer.scene.requestRender();

      // Capture the scene
      const cesiumCanvas = this.cesiumViewer.scene.canvas;
      tempContext.drawImage(cesiumCanvas, 0, 0, tempCanvas.width, tempCanvas.height);

      console.log('Map imagery captured successfully');
      return tempContext.getImageData(0, 0, tempCanvas.width, tempCanvas.height);

    } finally {
      // Restore original camera position
      this.cesiumViewer.camera.setView({
        destination: originalPosition,
        orientation: originalOrientation
      });
    }
  }

  private async captureSplatImagery(splatLayer: GaussianSplatLayer): Promise<ImageData> {
    console.log('Capturing splat imagery...');

    // Create a temporary renderer for the splat
    const tempRenderer = new THREE.WebGLRenderer({
      preserveDrawingBuffer: true,
      antialias: true
    });
    tempRenderer.setSize(this.canvas.width, this.canvas.height);
    tempRenderer.setClearColor(0x000000, 1);

    // Create an orthographic camera for top-down view
    const viewSize = 200; // Adjust based on your splat scale
    const camera = new THREE.OrthographicCamera(
      -viewSize, viewSize, viewSize, -viewSize, 0.1, 2000
    );
    camera.position.set(0, 500, 0); // Higher up to see more of the splat
    camera.lookAt(0, 0, 0);

    // Make sure the splat is visible
    if (!splatLayer.scene || !splatLayer.ready) {
      console.warn('Splat scene not ready for capture');
      tempRenderer.dispose();
      // Return empty image data
      const emptyImageData = new ImageData(this.canvas.width, this.canvas.height);
      return emptyImageData;
    }

    console.log('Rendering splat scene...');

    // Render the splat scene
    tempRenderer.render(splatLayer.scene, camera);

    // Get image data
    const tempCanvas = tempRenderer.domElement;
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.context.drawImage(tempCanvas, 0, 0);

    tempRenderer.dispose();

    console.log('Splat imagery captured successfully');
    return this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);
  }

  private extractRoadFeatures(imageData: ImageData, type: string): RoadFeature[] {
    console.log(`Extracting road features from ${type}...`);

    // Convert to grayscale and apply edge detection
    const edges = this.detectEdges(imageData);

    // Find line segments using Hough transform
    const lines = this.houghLineTransform(edges);

    // Convert lines to road features
    const roadFeatures: RoadFeature[] = lines.map(line => ({
      points: [
        new THREE.Vector2(line.x1, line.y1),
        new THREE.Vector2(line.x2, line.y2)
      ],
      direction: Math.atan2(line.y2 - line.y1, line.x2 - line.x1),
      length: Math.sqrt((line.x2 - line.x1) ** 2 + (line.y2 - line.y1) ** 2),
      confidence: line.strength
    }));

    console.log(`Found ${roadFeatures.length} road features in ${type}`);
    return roadFeatures;
  }

  private detectEdges(imageData: ImageData): Uint8ClampedArray {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;

    // First, enhance road contrast using color-based road detection
    const roadMask = this.createRoadMask(imageData);

    // Apply Gaussian blur for noise reduction
    const blurred = this.gaussianBlur(roadMask, width, height, 2);

    // Enhanced edge detection with multiple kernels
    const edges = new Uint8ClampedArray(width * height);

    // Enhanced Sobel kernels for better road detection
    const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

    // Scharr operator for better edge detection
    const scharrX = [-3, 0, 3, -10, 0, 10, -3, 0, 3];
    const scharrY = [-3, -10, -3, 0, 0, 0, 3, 10, 3];

    for (let y = 2; y < height - 2; y++) {
      for (let x = 2; x < width - 2; x++) {
        let gxSobel = 0, gySobel = 0;
        let gxScharr = 0, gyScharr = 0;

        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = (y + ky) * width + (x + kx);
            const gray = blurred[idx];
            const kernelIdx = (ky + 1) * 3 + (kx + 1);

            gxSobel += gray * sobelX[kernelIdx];
            gySobel += gray * sobelY[kernelIdx];
            gxScharr += gray * scharrX[kernelIdx];
            gyScharr += gray * scharrY[kernelIdx];
          }
        }

        const sobelMagnitude = Math.sqrt(gxSobel * gxSobel + gySobel * gySobel);
        const scharrMagnitude = Math.sqrt(gxScharr * gxScharr + gyScharr * gyScharr) / 16;

        // Combine both edge detectors
        const magnitude = Math.max(sobelMagnitude, scharrMagnitude);
        edges[y * width + x] = Math.min(255, magnitude);
      }
    }

    // Apply non-maximum suppression to thin edges
    return this.nonMaximumSuppression(edges, width, height);
  }

  private createRoadMask(imageData: ImageData): Uint8ClampedArray {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    const mask = new Uint8ClampedArray(width * height);

    for (let i = 0; i < width * height; i++) {
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];

      // Enhanced road detection for satellite imagery with labels
      const gray = (r + g + b) / 3;
      const saturation = Math.max(r, g, b) - Math.min(r, g, b);

      // Roads are typically gray/dark with low saturation
      const isRoadColor = gray >= 60 && gray <= 140 && saturation < 40;

      // White/light colored roads and road markings
      const isLightRoad = gray > 180 && saturation < 60;

      // Detect asphalt (dark gray with slight variations)
      const isAsphalt = gray >= 40 && gray <= 100 && saturation < 30;

      // Detect road labels and markings (often have specific color patterns)
      const isRoadLabel = (
        // Yellow road lines/labels
        (r > 180 && g > 180 && b < 100) ||
        // White road markings
        (r > 200 && g > 200 && b > 200 && saturation < 20) ||
        // Dark text on roads
        (gray < 50 && saturation < 20)
      );

      // Detect concrete roads (lighter gray with low saturation)
      const isConcrete = gray >= 120 && gray <= 180 && saturation < 25;

      if (isRoadColor || isLightRoad || isAsphalt || isRoadLabel || isConcrete) {
        // Use higher values for road labels and markings
        if (isRoadLabel) {
          mask[i] = Math.min(255, gray + 50);
        } else {
          mask[i] = gray;
        }
      } else {
        // Suppress non-road pixels
        mask[i] = 0;
      }
    }

    return mask;
  }

  private gaussianBlur(data: Uint8ClampedArray, width: number, height: number, radius: number): Uint8ClampedArray {
    const result = new Uint8ClampedArray(width * height);
    const kernel = this.createGaussianKernel(radius);
    const kernelSize = kernel.length;
    const half = Math.floor(kernelSize / 2);

    for (let y = half; y < height - half; y++) {
      for (let x = half; x < width - half; x++) {
        let sum = 0;
        let weightSum = 0;

        for (let ky = -half; ky <= half; ky++) {
          for (let kx = -half; kx <= half; kx++) {
            const weight = kernel[ky + half][kx + half];
            const value = data[(y + ky) * width + (x + kx)];
            sum += value * weight;
            weightSum += weight;
          }
        }

        result[y * width + x] = sum / weightSum;
      }
    }

    return result;
  }

  private createGaussianKernel(radius: number): number[][] {
    const size = radius * 2 + 1;
    const kernel: number[][] = [];
    const sigma = radius / 3;
    let sum = 0;

    for (let y = 0; y < size; y++) {
      kernel[y] = [];
      for (let x = 0; x < size; x++) {
        const distance = Math.sqrt((x - radius) ** 2 + (y - radius) ** 2);
        const value = Math.exp(-(distance ** 2) / (2 * sigma ** 2));
        kernel[y][x] = value;
        sum += value;
      }
    }

    // Normalize
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        kernel[y][x] /= sum;
      }
    }

    return kernel;
  }

  private nonMaximumSuppression(edges: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
    const result = new Uint8ClampedArray(width * height);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const current = edges[idx];

        if (current === 0) continue;

        // Check 8-connected neighbors
        const neighbors = [
          edges[(y-1) * width + (x-1)], edges[(y-1) * width + x], edges[(y-1) * width + (x+1)],
          edges[y * width + (x-1)],                                edges[y * width + (x+1)],
          edges[(y+1) * width + (x-1)], edges[(y+1) * width + x], edges[(y+1) * width + (x+1)]
        ];

        // Keep edge only if it's a local maximum
        if (current >= Math.max(...neighbors)) {
          result[idx] = current;
        }
      }
    }

    return result;
  }

  private houghLineTransform(edges: Uint8ClampedArray): any[] {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const lines: any[] = [];

    // Enhanced Hough transform parameters
    const maxDistance = Math.sqrt(width * width + height * height);
    const angleSteps = 180;
    const rhoSteps = Math.ceil(maxDistance * 2);
    const threshold = Math.max(50, Math.min(width, height) * 0.1); // Adaptive threshold

    // Accumulator array
    const accumulator: number[][] = Array(rhoSteps).fill(null).map(() => Array(angleSteps).fill(0));

    // Vote for lines
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (edges[y * width + x] > 100) { // Edge threshold
          for (let theta = 0; theta < angleSteps; theta++) {
            const angle = (theta * Math.PI) / 180;
            const rho = x * Math.cos(angle) + y * Math.sin(angle);
            const rhoIndex = Math.floor(rho + maxDistance);

            if (rhoIndex >= 0 && rhoIndex < rhoSteps) {
              accumulator[rhoIndex][theta]++;
            }
          }
        }
      }
    }

    // Find peaks in accumulator
    for (let rho = 0; rho < rhoSteps; rho++) {
      for (let theta = 0; theta < angleSteps; theta++) {
        if (accumulator[rho][theta] > threshold) {
          // Convert back to line parameters
          const angle = (theta * Math.PI) / 180;
          const rhoValue = rho - maxDistance;

          // Calculate line endpoints
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);

          let x1, y1, x2, y2;

          if (Math.abs(cos) > 0.0001) {
            // Non-vertical line
            y1 = 0;
            x1 = (rhoValue - y1 * sin) / cos;
            y2 = height - 1;
            x2 = (rhoValue - y2 * sin) / cos;
          } else {
            // Vertical line
            x1 = rhoValue / sin;
            y1 = 0;
            x2 = x1;
            y2 = height - 1;
          }

          // Clip to image bounds
          const clipped = this.clipLine(x1, y1, x2, y2, width, height);
          if (clipped) {
            lines.push({
              x1: clipped.x1,
              y1: clipped.y1,
              x2: clipped.x2,
              y2: clipped.y2,
              strength: accumulator[rho][theta],
              angle: angle,
              rho: rhoValue
            });
          }
        }
      }
    }

    // Filter and merge similar lines
    return this.filterSimilarLines(lines);
  }

  private clipLine(x1: number, y1: number, x2: number, y2: number, width: number, height: number): any {
    // Cohen-Sutherland line clipping algorithm
    const INSIDE = 0; // 0000
    const LEFT = 1;   // 0001
    const RIGHT = 2;  // 0010
    const BOTTOM = 4; // 0100
    const TOP = 8;    // 1000

    const computeOutCode = (x: number, y: number): number => {
      let code = INSIDE;
      if (x < 0) code |= LEFT;
      else if (x >= width) code |= RIGHT;
      if (y < 0) code |= BOTTOM;
      else if (y >= height) code |= TOP;
      return code;
    };

    let outcode1 = computeOutCode(x1, y1);
    let outcode2 = computeOutCode(x2, y2);
    let accept = false;

    while (true) {
      if (!(outcode1 | outcode2)) {
        // Both points inside
        accept = true;
        break;
      } else if (outcode1 & outcode2) {
        // Both points outside same region
        break;
      } else {
        // Calculate intersection
        const outcodeOut = outcode1 ? outcode1 : outcode2;
        let x = 0, y = 0;

        if (outcodeOut & TOP) {
          x = x1 + (x2 - x1) * (height - 1 - y1) / (y2 - y1);
          y = height - 1;
        } else if (outcodeOut & BOTTOM) {
          x = x1 + (x2 - x1) * (0 - y1) / (y2 - y1);
          y = 0;
        } else if (outcodeOut & RIGHT) {
          y = y1 + (y2 - y1) * (width - 1 - x1) / (x2 - x1);
          x = width - 1;
        } else if (outcodeOut & LEFT) {
          y = y1 + (y2 - y1) * (0 - x1) / (x2 - x1);
          x = 0;
        }

        if (outcodeOut === outcode1) {
          x1 = x;
          y1 = y;
          outcode1 = computeOutCode(x1, y1);
        } else {
          x2 = x;
          y2 = y;
          outcode2 = computeOutCode(x2, y2);
        }
      }
    }

    return accept ? { x1, y1, x2, y2 } : null;
  }

  private filterSimilarLines(lines: any[]): any[] {
    const filtered: any[] = [];
    const angleThreshold = 0.1; // radians
    const distanceThreshold = 20; // pixels

    for (const line of lines) {
      let similar = false;

      for (const existing of filtered) {
        const angleDiff = Math.abs(line.angle - existing.angle);
        const distanceDiff = Math.abs(line.rho - existing.rho);

        if (angleDiff < angleThreshold && distanceDiff < distanceThreshold) {
          // Merge with stronger line
          if (line.strength > existing.strength) {
            existing.x1 = line.x1;
            existing.y1 = line.y1;
            existing.x2 = line.x2;
            existing.y2 = line.y2;
            existing.strength = line.strength;
          }
          similar = true;
          break;
        }
      }

      if (!similar) {
        filtered.push(line);
      }
    }

    // Sort by strength and keep top lines
    return filtered.sort((a, b) => b.strength - a.strength).slice(0, 20);
  }

  private findHorizontalLine(edges: Uint8ClampedArray, startX: number, y: number, width: number, height: number): any {
    let start = startX;
    let end = startX;
    const threshold = 30;

    // Extend line to the right
    for (let x = startX; x < width; x++) {
      if (edges[y * width + x] > threshold) {
        end = x;
      } else {
        break;
      }
    }

    // Extend line to the left
    for (let x = startX; x >= 0; x--) {
      if (edges[y * width + x] > threshold) {
        start = x;
      } else {
        break;
      }
    }

    return { start, end, length: end - start };
  }

  private findVerticalLine(edges: Uint8ClampedArray, x: number, startY: number, width: number, height: number): any {
    let start = startY;
    let end = startY;
    const threshold = 30;

    // Extend line downward
    for (let y = startY; y < height; y++) {
      if (edges[y * width + x] > threshold) {
        end = y;
      } else {
        break;
      }
    }

    // Extend line upward
    for (let y = startY; y >= 0; y--) {
      if (edges[y * width + x] > threshold) {
        start = y;
      } else {
        break;
      }
    }

    return { start, end, length: end - start };
  }

  private findBestAlignment(
    mapRoads: RoadFeature[],
    splatRoads: RoadFeature[],
    currentLayer: GaussianSplatLayer
  ): AlignmentResult {
    let bestAlignment: AlignmentResult = {
      position: currentLayer.location,
      rotation: currentLayer.rotation,
      scale: currentLayer.scale,
      confidence: 0
    };

    // Test different transformations
    const positionSteps = 10;
    const rotationSteps = 8;
    const scaleSteps = 5;

    const positionRange = 0.0005; // degrees
    const rotationRange = Math.PI / 4; // 45 degrees
    const scaleRange = 2; // 0.5x to 2x

    for (let pStep = 0; pStep < positionSteps; pStep++) {
      for (let rStep = 0; rStep < rotationSteps; rStep++) {
        for (let sStep = 0; sStep < scaleSteps; sStep++) {
          const testAlignment: AlignmentResult = {
            position: {
              lon: currentLayer.location.lon + (pStep - positionSteps/2) * positionRange / positionSteps,
              lat: currentLayer.location.lat + (pStep - positionSteps/2) * positionRange / positionSteps,
              height: currentLayer.location.height
            },
            rotation: {
              x: currentLayer.rotation.x,
              y: currentLayer.rotation.y + (rStep - rotationSteps/2) * rotationRange / rotationSteps,
              z: currentLayer.rotation.z
            },
            scale: currentLayer.scale * (0.5 + sStep * scaleRange / scaleSteps),
            confidence: 0
          };

          // Calculate alignment score
          const score = this.calculateAlignmentScore(mapRoads, splatRoads, testAlignment);

          if (score > bestAlignment.confidence) {
            bestAlignment = { ...testAlignment, confidence: score };
          }
        }
      }
    }

    return bestAlignment;
  }

  private calculateAlignmentScore(
    mapRoads: RoadFeature[],
    splatRoads: RoadFeature[],
    alignment: AlignmentResult
  ): number {
    let totalScore = 0;
    let matchCount = 0;

    // Transform splat roads according to alignment
    const transformedSplatRoads = this.transformRoadFeatures(splatRoads, alignment);

    // Find matches between map and transformed splat roads
    for (const mapRoad of mapRoads) {
      let bestMatch = 0;

      for (const splatRoad of transformedSplatRoads) {
        const score = this.compareRoadFeatures(mapRoad, splatRoad);
        bestMatch = Math.max(bestMatch, score);
      }

      if (bestMatch > 0.3) { // Threshold for considering a match
        totalScore += bestMatch;
        matchCount++;
      }
    }

    return matchCount > 0 ? totalScore / matchCount : 0;
  }

  private transformRoadFeatures(roads: RoadFeature[], alignment: AlignmentResult): RoadFeature[] {
    // Apply scale, rotation, and translation to road features
    // This is a simplified version - in practice you'd need proper coordinate transformations
    return roads.map(road => ({
      ...road,
      points: road.points.map(point => {
        // Apply scale
        let x = point.x * alignment.scale;
        let y = point.y * alignment.scale;

        // Apply rotation (simplified 2D rotation)
        const cos = Math.cos(alignment.rotation.y);
        const sin = Math.sin(alignment.rotation.y);
        const rotX = x * cos - y * sin;
        const rotY = x * sin + y * cos;

        return new THREE.Vector2(rotX, rotY);
      })
    }));
  }

  private compareRoadFeatures(road1: RoadFeature, road2: RoadFeature): number {
    // Compare direction similarity
    const directionDiff = Math.abs(road1.direction - road2.direction);
    const directionScore = 1 - Math.min(directionDiff, Math.PI - directionDiff) / (Math.PI / 2);

    // Compare length similarity
    const lengthRatio = Math.min(road1.length, road2.length) / Math.max(road1.length, road2.length);

    // Compare position proximity (simplified)
    const distance = road1.points[0].distanceTo(road2.points[0]);
    const distanceScore = Math.exp(-distance / 100); // Exponential decay

    return (directionScore * 0.4 + lengthRatio * 0.3 + distanceScore * 0.3);
  }

  public async applySmoothAlignment(
    splatLayer: GaussianSplatLayer,
    targetAlignment: AlignmentResult,
    duration: number = 2000
  ): Promise<void> {
    const startTime = Date.now();
    const startPosition = { ...splatLayer.location };
    const startRotation = { ...splatLayer.rotation };
    const startScale = splatLayer.scale;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Smooth easing function
      const eased = 1 - Math.pow(1 - progress, 3);

      // Interpolate position
      splatLayer.location.lon = startPosition.lon + (targetAlignment.position.lon - startPosition.lon) * eased;
      splatLayer.location.lat = startPosition.lat + (targetAlignment.position.lat - startPosition.lat) * eased;
      splatLayer.location.height = startPosition.height + (targetAlignment.position.height - startPosition.height) * eased;

      // Interpolate rotation
      splatLayer.rotation.x = startRotation.x + (targetAlignment.rotation.x - startRotation.x) * eased;
      splatLayer.rotation.y = startRotation.y + (targetAlignment.rotation.y - startRotation.y) * eased;
      splatLayer.rotation.z = startRotation.z + (targetAlignment.rotation.z - startRotation.z) * eased;

      // Interpolate scale
      const newScale = startScale + (targetAlignment.scale - startScale) * eased;
      splatLayer.scale = newScale;

      // Apply transformations
      const position = Cesium.Cartesian3.fromDegrees(
        splatLayer.location.lon,
        splatLayer.location.lat,
        splatLayer.location.height
      );
      splatLayer.scene.position.set(position.x, position.y, position.z);
      splatLayer.scene.rotation.set(splatLayer.rotation.x, splatLayer.rotation.y, splatLayer.rotation.z);

      if (splatLayer.splatViewer && splatLayer.splatViewer.getSplatMesh()) {
        const mesh = splatLayer.splatViewer.getSplatMesh();
        mesh.scale.set(newScale, newScale, newScale);
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }
}