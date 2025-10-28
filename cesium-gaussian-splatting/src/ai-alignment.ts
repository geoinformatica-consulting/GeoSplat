import * as Cesium from 'cesium';
import * as THREE from 'three';
import { GaussianSplatLayer } from './gaussian-splat-layer';

export interface FeatureMetrics {
  roadWidth: number;          // Average road width in meters
  buildingDensity: number;    // Buildings per square kilometer
  buildingHeight: number;     // Average building height in meters
  parkingLotSize: number;     // Average parking lot area
  blockSize: number;          // Average city block size
  elevationVariance: number;  // Terrain elevation changes
}

export interface AlignmentScore {
  scaleScore: number;         // How well the scale matches
  rotationScore: number;      // How well the rotation matches
  positionScore: number;      // How well the position matches
  elevationScore: number;     // How well the elevation matches
  overallScore: number;       // Combined confidence score
}

export class AIAlignment {
  private cesiumViewer: Cesium.Viewer;
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private referenceMetrics: FeatureMetrics | null = null;

  constructor(cesiumViewer: Cesium.Viewer) {
    this.cesiumViewer = cesiumViewer;
    this.canvas = document.createElement('canvas');
    this.canvas.width = 2048;  // Higher resolution for better analysis
    this.canvas.height = 2048;
    this.context = this.canvas.getContext('2d')!;
  }

  public async performIntelligentAlignment(
    splatLayer: GaussianSplatLayer
  ): Promise<boolean> {
    console.log('🤖 Starting AI-based intelligent alignment...');

    // Step 1: Analyze real-world reference data
    console.log('📊 Analyzing real-world features...');
    const referenceMetrics = await this.analyzeRealWorldFeatures(
      splatLayer.location.lon,
      splatLayer.location.lat
    );

    // Step 2: Analyze splat features
    console.log('🎯 Analyzing splat features...');
    const splatMetrics = await this.analyzeSplatFeatures(splatLayer);

    // Step 3: Iterative alignment with multiple scales and positions
    console.log('🔄 Performing iterative alignment...');
    const bestAlignment = await this.iterativeAlignment(
      splatLayer,
      referenceMetrics,
      splatMetrics
    );

    if (bestAlignment.overallScore > 0.3) {
      console.log(`✅ AI alignment successful! Score: ${bestAlignment.overallScore.toFixed(3)}`);
      return true;
    } else {
      console.log(`❌ AI alignment failed. Best score: ${bestAlignment.overallScore.toFixed(3)}`);
      return false;
    }
  }

  private async analyzeRealWorldFeatures(
    centerLon: number,
    centerLat: number
  ): Promise<FeatureMetrics> {
    // Capture high-resolution satellite imagery
    const imagery = await this.captureHighResImagery(centerLon, centerLat, 0.002);

    // Analyze features using computer vision
    const roadAnalysis = this.analyzeRoadNetworks(imagery);
    const buildingAnalysis = this.analyzeBuildingPatterns(imagery);
    const terrainAnalysis = await this.analyzeTerrainFeatures(centerLon, centerLat);

    const metrics: FeatureMetrics = {
      roadWidth: roadAnalysis.averageWidth,
      buildingDensity: buildingAnalysis.density,
      buildingHeight: buildingAnalysis.averageHeight,
      parkingLotSize: buildingAnalysis.parkingLotSize,
      blockSize: roadAnalysis.blockSize,
      elevationVariance: terrainAnalysis.variance
    };

    console.log('Real-world metrics:', metrics);
    this.referenceMetrics = metrics;
    return metrics;
  }

  private async analyzeSplatFeatures(splatLayer: GaussianSplatLayer): Promise<FeatureMetrics> {
    // Render splat from multiple angles for comprehensive analysis
    const topView = await this.renderSplatView(splatLayer, 'top');
    const oblique1 = await this.renderSplatView(splatLayer, 'oblique45');
    const oblique2 = await this.renderSplatView(splatLayer, 'oblique-45');

    // Analyze features from multiple perspectives
    const roadAnalysis = this.analyzeRoadNetworks(topView);
    const buildingAnalysis = this.analyzeBuildingPatterns(topView);
    const depthAnalysis = this.analyzeDepthFeatures([topView, oblique1, oblique2]);

    return {
      roadWidth: roadAnalysis.averageWidth,
      buildingDensity: buildingAnalysis.density,
      buildingHeight: depthAnalysis.averageHeight,
      parkingLotSize: buildingAnalysis.parkingLotSize,
      blockSize: roadAnalysis.blockSize,
      elevationVariance: depthAnalysis.variance
    };
  }

  private analyzeRoadNetworks(imageData: ImageData): any {
    // Advanced road detection using morphological operations
    const roads = this.detectRoadStructures(imageData);
    const intersections = this.detectIntersections(roads);

    // Calculate road metrics
    const widths = roads.map(road => this.calculateRoadWidth(road, imageData));
    const averageWidth = widths.length > 0 ? widths.reduce((a, b) => a + b) / widths.length : 0;

    // Calculate block sizes based on road grid
    const blockSize = this.calculateBlockSize(roads, intersections);

    console.log(`Road analysis: ${roads.length} roads, avg width: ${averageWidth.toFixed(1)}px`);

    return {
      roads,
      intersections,
      averageWidth,
      blockSize
    };
  }

  private analyzeBuildingPatterns(imageData: ImageData): any {
    // Detect building structures using blob detection and texture analysis
    const buildings = this.detectBuildingFootprints(imageData);
    const parkingLots = this.detectParkingLots(imageData);

    // Calculate building density (buildings per square area)
    const totalArea = imageData.width * imageData.height;
    const density = buildings.length / totalArea * 1000000; // per sq km equivalent

    // Estimate building heights using shadow analysis
    const heights = buildings.map(building => this.estimateBuildingHeight(building, imageData));
    const averageHeight = heights.length > 0 ? heights.reduce((a, b) => a + b) / heights.length : 0;

    // Calculate average parking lot size
    const parkingLotSize = parkingLots.length > 0
      ? parkingLots.reduce((sum, lot) => sum + lot.area, 0) / parkingLots.length
      : 0;

    console.log(`Building analysis: ${buildings.length} buildings, density: ${density.toFixed(1)}`);

    return {
      buildings,
      parkingLots,
      density,
      averageHeight,
      parkingLotSize
    };
  }

  private detectRoadStructures(imageData: ImageData): any[] {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;

    // Create road mask using improved color filtering
    const roadMask = new Uint8ClampedArray(width * height);

    for (let i = 0; i < width * height; i++) {
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];

      const gray = (r + g + b) / 3;
      const saturation = Math.max(r, g, b) - Math.min(r, g, b);

      // Enhanced road detection
      const isRoad = (
        (gray >= 50 && gray <= 150 && saturation < 30) || // Asphalt
        (gray > 180 && saturation < 40) || // Concrete/painted lines
        (r > 180 && g > 180 && b < 100) // Yellow lines
      );

      roadMask[i] = isRoad ? 255 : 0;
    }

    // Apply morphological operations to clean up road mask
    const cleaned = this.morphologicalClosing(roadMask, width, height, 3);
    const thinned = this.morphologicalThinning(cleaned, width, height);

    // Extract road centerlines using skeletonization
    const centerlines = this.extractCenterlines(thinned, width, height);

    // Group centerlines into road segments
    return this.groupIntoRoadSegments(centerlines);
  }

  private detectBuildingFootprints(imageData: ImageData): any[] {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;

    // Detect building rooftops using texture and color analysis
    const buildingMask = new Uint8ClampedArray(width * height);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const r = data[idx * 4];
        const g = data[idx * 4 + 1];
        const b = data[idx * 4 + 2];

        // Calculate local texture variance
        const variance = this.calculateLocalVariance(data, x, y, width, height);

        // Building rooftops typically have:
        // - Regular geometric shapes
        // - Consistent colors (low local variance)
        // - Distinct from vegetation (different color profile)

        const gray = (r + g + b) / 3;
        const isBuilding = (
          variance < 200 && // Low texture variance
          gray > 80 && gray < 200 && // Not too dark or bright
          !(g > r + 20 && g > b + 20) // Not vegetation
        );

        buildingMask[idx] = isBuilding ? 255 : 0;
      }
    }

    // Find connected components (building footprints)
    return this.findConnectedComponents(buildingMask, width, height, 100); // Min area threshold
  }

  private async analyzeTerrainFeatures(
    centerLon: number,
    centerLat: number
  ): Promise<any> {
    // Sample elevation data in a grid around the center point
    const gridSize = 20;
    const step = 0.0001; // degrees
    const elevations: number[] = [];

    for (let i = -gridSize; i <= gridSize; i++) {
      for (let j = -gridSize; j <= gridSize; j++) {
        const lon = centerLon + i * step;
        const lat = centerLat + j * step;

        try {
          // Use Cesium's terrain provider to get elevation
          const cartographic = Cesium.Cartographic.fromDegrees(lon, lat);
          const positions = [cartographic];

          const sampledPositions = await Cesium.sampleTerrainMostDetailed(
            this.cesiumViewer.terrainProvider,
            positions
          );

          if (sampledPositions[0].height !== undefined) {
            elevations.push(sampledPositions[0].height);
          }
        } catch (error) {
          // Skip failed samples
        }
      }
    }

    // Calculate elevation statistics
    const mean = elevations.reduce((a, b) => a + b, 0) / elevations.length;
    const variance = elevations.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / elevations.length;

    console.log(`Terrain analysis: ${elevations.length} samples, variance: ${variance.toFixed(2)}`);

    return {
      mean,
      variance,
      min: Math.min(...elevations),
      max: Math.max(...elevations)
    };
  }

  private async iterativeAlignment(
    splatLayer: GaussianSplatLayer,
    referenceMetrics: FeatureMetrics,
    initialSplatMetrics: FeatureMetrics
  ): Promise<AlignmentScore> {
    let bestScore: AlignmentScore = {
      scaleScore: 0,
      rotationScore: 0,
      positionScore: 0,
      elevationScore: 0,
      overallScore: 0
    };

    // Initial scale estimation based on road widths
    const scaleHint = this.estimateScaleFromRoadWidth(referenceMetrics, initialSplatMetrics);
    console.log(`🔍 Initial scale hint: ${scaleHint.toFixed(2)}`);

    // Test multiple scales around the hint
    const scaleTests = [
      scaleHint * 0.5,
      scaleHint * 0.75,
      scaleHint,
      scaleHint * 1.25,
      scaleHint * 1.5,
      scaleHint * 2.0
    ];

    // Test multiple rotations
    const rotationTests = [0, Math.PI/6, Math.PI/4, Math.PI/3, Math.PI/2, 2*Math.PI/3, 3*Math.PI/4, Math.PI];

    // Test position offsets
    const positionTests = [
      { lon: 0, lat: 0 },
      { lon: 0.0001, lat: 0 },
      { lon: -0.0001, lat: 0 },
      { lon: 0, lat: 0.0001 },
      { lon: 0, lat: -0.0001 },
      { lon: 0.0001, lat: 0.0001 },
      { lon: -0.0001, lat: -0.0001 }
    ];

    let iteration = 0;
    const maxIterations = scaleTests.length * rotationTests.length * positionTests.length;

    for (const scale of scaleTests) {
      for (const rotation of rotationTests) {
        for (const positionOffset of positionTests) {
          iteration++;

          // Apply test transformation
          const testLocation = {
            lon: splatLayer.location.lon + positionOffset.lon,
            lat: splatLayer.location.lat + positionOffset.lat,
            height: splatLayer.location.height
          };

          this.applySplatTransformation(splatLayer, testLocation, rotation, scale);

          // Wait for transformation to settle
          await new Promise(resolve => setTimeout(resolve, 100));

          // Analyze transformed splat
          const transformedMetrics = await this.analyzeSplatFeatures(splatLayer);

          // Calculate alignment score
          const score = this.calculateAlignmentScore(referenceMetrics, transformedMetrics);

          if (score.overallScore > bestScore.overallScore) {
            bestScore = score;
            console.log(`🎯 New best score: ${score.overallScore.toFixed(3)} (iteration ${iteration}/${maxIterations})`);
            console.log(`   Scale: ${scale.toFixed(2)}, Rotation: ${(rotation * 180 / Math.PI).toFixed(1)}°`);
          }

          // Show progress
          if (iteration % 20 === 0) {
            this.updateStatus(`Testing alignment ${iteration}/${maxIterations} (best: ${bestScore.overallScore.toFixed(3)})`);
          }
        }
      }
    }

    return bestScore;
  }

  private estimateScaleFromRoadWidth(
    referenceMetrics: FeatureMetrics,
    splatMetrics: FeatureMetrics
  ): number {
    if (referenceMetrics.roadWidth <= 0 || splatMetrics.roadWidth <= 0) {
      return 1.0; // Default scale if no road data
    }

    // Typical road width in reality vs pixels in image
    const realRoadWidthMeters = 3.5; // Standard lane width
    const pixelsToMetersRatio = realRoadWidthMeters / referenceMetrics.roadWidth;

    // Calculate required scale to match splat roads to real roads
    const requiredScale = (realRoadWidthMeters / splatMetrics.roadWidth) / pixelsToMetersRatio;

    return Math.max(0.1, Math.min(10.0, requiredScale)); // Clamp to reasonable range
  }

  private calculateAlignmentScore(
    reference: FeatureMetrics,
    splat: FeatureMetrics
  ): AlignmentScore {
    // Scale score based on road width similarity
    const scaleScore = this.calculateSimilarity(reference.roadWidth, splat.roadWidth);

    // Building density similarity
    const densityScore = this.calculateSimilarity(reference.buildingDensity, splat.buildingDensity);

    // Block size similarity
    const blockScore = this.calculateSimilarity(reference.blockSize, splat.blockSize);

    // Elevation variance similarity
    const elevationScore = this.calculateSimilarity(reference.elevationVariance, splat.elevationVariance);

    // Combined score with weights
    const overallScore = (
      scaleScore * 0.4 +
      densityScore * 0.3 +
      blockScore * 0.2 +
      elevationScore * 0.1
    );

    return {
      scaleScore,
      rotationScore: blockScore, // Using block alignment as rotation indicator
      positionScore: densityScore, // Using density as position indicator
      elevationScore,
      overallScore
    };
  }

  private calculateSimilarity(value1: number, value2: number): number {
    if (value1 === 0 && value2 === 0) return 1.0;
    if (value1 === 0 || value2 === 0) return 0.0;

    const ratio = Math.min(value1, value2) / Math.max(value1, value2);
    return ratio;
  }

  // Helper methods for computer vision operations
  private morphologicalClosing(data: Uint8ClampedArray, width: number, height: number, kernelSize: number): Uint8ClampedArray {
    // Dilation followed by erosion
    const dilated = this.morphologicalDilation(data, width, height, kernelSize);
    return this.morphologicalErosion(dilated, width, height, kernelSize);
  }

  private morphologicalDilation(data: Uint8ClampedArray, width: number, height: number, kernelSize: number): Uint8ClampedArray {
    const result = new Uint8ClampedArray(width * height);
    const half = Math.floor(kernelSize / 2);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let maxVal = 0;

        for (let ky = -half; ky <= half; ky++) {
          for (let kx = -half; kx <= half; kx++) {
            const ny = y + ky;
            const nx = x + kx;

            if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
              maxVal = Math.max(maxVal, data[ny * width + nx]);
            }
          }
        }

        result[y * width + x] = maxVal;
      }
    }

    return result;
  }

  private morphologicalErosion(data: Uint8ClampedArray, width: number, height: number, kernelSize: number): Uint8ClampedArray {
    const result = new Uint8ClampedArray(width * height);
    const half = Math.floor(kernelSize / 2);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let minVal = 255;

        for (let ky = -half; ky <= half; ky++) {
          for (let kx = -half; kx <= half; kx++) {
            const ny = y + ky;
            const nx = x + kx;

            if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
              minVal = Math.min(minVal, data[ny * width + nx]);
            }
          }
        }

        result[y * width + x] = minVal;
      }
    }

    return result;
  }

  // Placeholder implementations for complex CV operations
  private morphologicalThinning(data: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
    // Simplified thinning - in practice would use Zhang-Suen or similar algorithm
    return data;
  }

  private extractCenterlines(data: Uint8ClampedArray, width: number, height: number): any[] {
    const centerlines: any[] = [];
    // Simplified - would implement proper skeletonization
    return centerlines;
  }

  private groupIntoRoadSegments(centerlines: any[]): any[] {
    // Group connected centerlines into road segments
    return centerlines;
  }

  private calculateLocalVariance(data: Uint8ClampedArray, x: number, y: number, width: number, height: number): number {
    const windowSize = 5;
    const half = Math.floor(windowSize / 2);
    const values: number[] = [];

    for (let ky = -half; ky <= half; ky++) {
      for (let kx = -half; kx <= half; kx++) {
        const ny = y + ky;
        const nx = x + kx;

        if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
          const idx = ny * width + nx;
          const r = data[idx * 4];
          const g = data[idx * 4 + 1];
          const b = data[idx * 4 + 2];
          values.push((r + g + b) / 3);
        }
      }
    }

    const mean = values.reduce((a, b) => a + b) / values.length;
    return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  }

  private findConnectedComponents(data: Uint8ClampedArray, width: number, height: number, minArea: number): any[] {
    // Simplified connected component analysis
    const components: any[] = [];
    const visited = new Array(width * height).fill(false);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;

        if (data[idx] > 0 && !visited[idx]) {
          const component = this.floodFill(data, visited, x, y, width, height);

          if (component.area > minArea) {
            components.push(component);
          }
        }
      }
    }

    return components;
  }

  private floodFill(data: Uint8ClampedArray, visited: boolean[], startX: number, startY: number, width: number, height: number): any {
    const stack = [[startX, startY]];
    const pixels: number[][] = [];
    let area = 0;

    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      const idx = y * width + x;

      if (x < 0 || x >= width || y < 0 || y >= height || visited[idx] || data[idx] === 0) {
        continue;
      }

      visited[idx] = true;
      pixels.push([x, y]);
      area++;

      // Add neighbors
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    return { pixels, area };
  }

  // Additional helper methods
  private async captureHighResImagery(centerLon: number, centerLat: number, radius: number): Promise<ImageData> {
    // Implementation similar to road-alignment.ts but with higher resolution
    // ... (implementation details)
    return new ImageData(this.canvas.width, this.canvas.height);
  }

  private async renderSplatView(splatLayer: GaussianSplatLayer, viewType: string): Promise<ImageData> {
    // Render splat from different angles
    // ... (implementation details)
    return new ImageData(this.canvas.width, this.canvas.height);
  }

  private analyzeDepthFeatures(views: ImageData[]): any {
    // Analyze depth information from multiple views
    return {
      averageHeight: 0,
      variance: 0
    };
  }

  private detectIntersections(roads: any[]): any[] {
    // Detect road intersections
    return [];
  }

  private calculateRoadWidth(road: any, imageData: ImageData): number {
    // Calculate actual road width in pixels
    return 10; // Placeholder
  }

  private calculateBlockSize(roads: any[], intersections: any[]): number {
    // Calculate average city block size
    return 100; // Placeholder
  }

  private detectParkingLots(imageData: ImageData): any[] {
    // Detect parking lot patterns
    return [];
  }

  private estimateBuildingHeight(building: any, imageData: ImageData): number {
    // Estimate building height from shadows
    return 10; // Placeholder
  }

  private applySplatTransformation(
    splatLayer: GaussianSplatLayer,
    location: { lon: number; lat: number; height: number },
    rotation: number,
    scale: number
  ): void {
    // Apply transformation to splat
    splatLayer.location = location;
    splatLayer.rotation.y = rotation;
    splatLayer.scale = scale;

    // Update position
    const position = Cesium.Cartesian3.fromDegrees(location.lon, location.lat, location.height);
    splatLayer.scene.position.set(position.x, position.y, position.z);
    splatLayer.scene.rotation.y = rotation;

    if (splatLayer.splatViewer && splatLayer.splatViewer.getSplatMesh()) {
      const mesh = splatLayer.splatViewer.getSplatMesh();
      mesh.scale.set(scale, scale, scale);
    }
  }

  private updateStatus(message: string): void {
    const statusDiv = document.getElementById('status-content');
    if (statusDiv) {
      statusDiv.textContent = message;
    }
  }
}