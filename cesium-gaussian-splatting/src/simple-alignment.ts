import * as Cesium from 'cesium';
import * as THREE from 'three';
import { GaussianSplatLayer } from './gaussian-splat-layer';
import { AlignmentController } from './controllers/AlignmentController';

export class SimpleAlignment {
  private cesiumViewer: Cesium.Viewer;
  private alignmentController?: AlignmentController;

  constructor(cesiumViewer: Cesium.Viewer) {
    this.cesiumViewer = cesiumViewer;
  }

  private getOrCreateController(splatLayer: GaussianSplatLayer): AlignmentController {
    if (!this.alignmentController) {
      this.alignmentController = new AlignmentController(splatLayer, this.cesiumViewer);
    }
    return this.alignmentController;
  }

  public async performSimpleAlignment(splatLayer: GaussianSplatLayer): Promise<boolean> {
    console.log('🎯 Starting SAFE simple alignment...');
    console.log('📊 Initial splat state:', {
      location: splatLayer.location,
      rotation: splatLayer.rotation,
      scale: splatLayer.scale,
      ready: splatLayer.ready
    });

    // SAFE APPROACH: Only adjust scale and make minimal position changes
    // Don't move the splat drastically which can cause it to disappear

    try {
      // Step 1: Get current view bounds for scale calculation
      const bounds = this.getCurrentViewBounds();

      if (!bounds) {
        console.warn('⚠️ Cannot determine view bounds, applying default scale adjustment');
        // Just apply a reasonable scale without moving position
        const newScale = Math.max(0.5, Math.min(3.0, splatLayer.scale * 1.2));
        this.applySafeScaling(splatLayer, newScale);
        return true;
      }

      console.log('📍 Current view bounds:', bounds);

      // Step 2: Calculate conservative scale adjustment
      const currentScale = splatLayer.scale;
      const suggestedScale = this.calculateProperScale(bounds);

      // Very conservative scale change (max 1.5x change)
      const newScale = Math.max(currentScale * 0.7, Math.min(currentScale * 1.5, suggestedScale));

      console.log(`📏 SAFE Scale adjustment: current=${currentScale.toFixed(2)}, suggested=${suggestedScale.toFixed(2)}, final=${newScale.toFixed(2)}`);

      // Step 3: Apply ONLY scaling, keep position unchanged
      this.applySafeScaling(splatLayer, newScale);

      console.log('✅ Safe alignment completed - splat should remain visible');
      return true;

    } catch (error) {
      console.error('❌ Error in simple alignment:', error);
      console.log('🔄 Fallback: keeping original settings');
      return false;
    }
  }

  private getCurrentViewBounds(): any {
    const camera = this.cesiumViewer.camera;
    const canvas = this.cesiumViewer.scene.canvas;

    // Get corners of current view
    const topLeft = camera.pickEllipsoid(new Cesium.Cartesian2(0, 0), this.cesiumViewer.scene.globe.ellipsoid);
    const topRight = camera.pickEllipsoid(new Cesium.Cartesian2(canvas.clientWidth, 0), this.cesiumViewer.scene.globe.ellipsoid);
    const bottomLeft = camera.pickEllipsoid(new Cesium.Cartesian2(0, canvas.clientHeight), this.cesiumViewer.scene.globe.ellipsoid);
    const bottomRight = camera.pickEllipsoid(new Cesium.Cartesian2(canvas.clientWidth, canvas.clientHeight), this.cesiumViewer.scene.globe.ellipsoid);

    if (!topLeft || !topRight || !bottomLeft || !bottomRight) {
      console.warn('Could not determine view bounds');
      return null;
    }

    // Convert to geographic coordinates
    const topLeftGeo = Cesium.Cartographic.fromCartesian(topLeft);
    const topRightGeo = Cesium.Cartographic.fromCartesian(topRight);
    const bottomLeftGeo = Cesium.Cartographic.fromCartesian(bottomLeft);
    const bottomRightGeo = Cesium.Cartographic.fromCartesian(bottomRight);

    const bounds = {
      west: Math.min(topLeftGeo.longitude, bottomLeftGeo.longitude),
      east: Math.max(topRightGeo.longitude, bottomRightGeo.longitude),
      north: Math.max(topLeftGeo.latitude, topRightGeo.latitude),
      south: Math.min(bottomLeftGeo.latitude, bottomRightGeo.latitude)
    };

    // Calculate dimensions in meters
    const widthMeters = this.distanceInMeters(bounds.west, bounds.north, bounds.east, bounds.north);
    const heightMeters = this.distanceInMeters(bounds.west, bounds.north, bounds.west, bounds.south);

    return {
      ...bounds,
      widthMeters,
      heightMeters,
      centerLon: (bounds.west + bounds.east) / 2,
      centerLat: (bounds.north + bounds.south) / 2
    };
  }

  private calculateProperScale(bounds: any): number {
    if (!bounds) return 1.0;

    // Typical Gaussian splat from drone footage covers about 100-500 meters
    // Burbank scene is likely around 200-300 meters wide based on drone altitude
    const estimatedSplatWidthMeters = 200;

    // Calculate scale needed to match view
    const scale = bounds.widthMeters / estimatedSplatWidthMeters;

    // Clamp to reasonable range
    return Math.max(0.1, Math.min(20.0, scale));
  }

  private distanceInMeters(lon1: number, lat1: number, lon2: number, lat2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private applySplatTransformation(
    splatLayer: GaussianSplatLayer,
    location: { lon: number; lat: number; height: number },
    rotation: number,
    scale: number
  ): void {
    console.log(`Applying transformation: scale=${scale.toFixed(2)}, rotation=${rotation.toFixed(2)}°`);
    console.log(`New location: lon=${location.lon.toFixed(6)}, lat=${location.lat.toFixed(6)}, height=${location.height.toFixed(1)}m`);

    // Update splat properties using the layer's own methods
    splatLayer.location = location;
    splatLayer.rotation.y = rotation;
    splatLayer.scale = scale;

    // Use the layer's built-in update methods instead of direct manipulation
    splatLayer.updatePosition();
    splatLayer.updateScale();

    // Apply rotation to the scene
    if (splatLayer.scene) {
      splatLayer.scene.rotation.y = rotation;
    }

    console.log(`✅ Transformation applied successfully`);
  }

  private applySafeScaling(splatLayer: GaussianSplatLayer, newScale: number): void {
    console.log(`🔄 Applying SAFE scale change: ${splatLayer.scale.toFixed(2)} -> ${newScale.toFixed(2)}`);

    // ONLY change the scale, don't touch position or rotation
    splatLayer.scale = newScale;

    // Use the layer's built-in update method for scaling
    splatLayer.updateScale();

    console.log(`✅ Scale applied safely - position unchanged`);
  }

  private async quickAlignmentCheck(splatLayer: GaussianSplatLayer, bounds: any): Promise<number> {
    // Simple heuristic: if the splat is visible in the current view and properly scaled, it's probably aligned

    // Check if splat position is within current view
    const splatInView = this.isSplatInView(splatLayer, bounds);

    // Check if scale seems reasonable (not too big or too small)
    const scaleReasonable = splatLayer.scale > 0.5 && splatLayer.scale < 10.0;

    // Check if height is reasonable
    const heightReasonable = splatLayer.location.height > 0 && splatLayer.location.height < 1000;

    let score = 0;
    if (splatInView) score += 0.4;
    if (scaleReasonable) score += 0.3;
    if (heightReasonable) score += 0.3;

    console.log(`Alignment check: inView=${splatInView}, scaleOK=${scaleReasonable}, heightOK=${heightReasonable}, score=${score}`);

    return score;
  }

  private isSplatInView(splatLayer: GaussianSplatLayer, bounds: any): boolean {
    if (!bounds) return false;

    const splatLon = splatLayer.location.lon;
    const splatLat = splatLayer.location.lat;

    return splatLon >= bounds.west && splatLon <= bounds.east &&
           splatLat >= bounds.south && splatLat <= bounds.north;
  }

  // Interactive alignment methods
  public incrementScale(splatLayer: GaussianSplatLayer, factor: number): void {
    // Always use legacy scaling for interactive adjustments to avoid disappearing splat
    const newScale = Math.max(0.1, Math.min(50.0, splatLayer.scale * factor));
    this.applySafeScaling(splatLayer, newScale);
    console.log(`Scale adjusted to: ${newScale.toFixed(2)}`);
  }

  public adjustRotation(splatLayer: GaussianSplatLayer, deltaRadians: number): void {
    // Always use legacy rotation for interactive adjustments
    const newRotation = splatLayer.rotation.y + deltaRadians;
    // SAFE: Only apply rotation, don't change position
    splatLayer.rotation.y = newRotation;
    if (splatLayer.scene) {
      splatLayer.scene.rotation.y = newRotation;
    }
    console.log(`Rotation (Yaw) adjusted to: ${(newRotation * 180 / Math.PI).toFixed(1)}°`);
  }

  public adjustPitch(splatLayer: GaussianSplatLayer, deltaRadians: number): void {
    // Adjust pitch (tilt forward/backward)
    const newPitch = splatLayer.rotation.x + deltaRadians;
    splatLayer.rotation.x = newPitch;
    if (splatLayer.scene) {
      splatLayer.scene.rotation.x = newPitch;
    }
    console.log(`Pitch adjusted to: ${(newPitch * 180 / Math.PI).toFixed(1)}°`);
  }

  public adjustRoll(splatLayer: GaussianSplatLayer, deltaRadians: number): void {
    // Adjust roll (tilt left/right)
    const newRoll = splatLayer.rotation.z + deltaRadians;
    splatLayer.rotation.z = newRoll;
    if (splatLayer.scene) {
      splatLayer.scene.rotation.z = newRoll;
    }
    console.log(`Roll adjusted to: ${(newRoll * 180 / Math.PI).toFixed(1)}°`);
  }

  public movePosition(splatLayer: GaussianSplatLayer, deltaLon: number, deltaLat: number): void {
    // Always use legacy position for interactive adjustments
    const newLocation = {
      lon: splatLayer.location.lon + deltaLon,
      lat: splatLayer.location.lat + deltaLat,
      height: splatLayer.location.height
    };
    // SAFE: Use small incremental changes
    splatLayer.location = newLocation;
    splatLayer.updatePosition();
    console.log(`Position adjusted to: ${newLocation.lon.toFixed(6)}, ${newLocation.lat.toFixed(6)}`);
  }

  public adjustHeight(splatLayer: GaussianSplatLayer, deltaHeight: number): void {
    // Always use legacy height for interactive adjustments
    const newLocation = {
      ...splatLayer.location,
      height: Math.max(0, splatLayer.location.height + deltaHeight)
    };
    // SAFE: Small height adjustments
    splatLayer.location = newLocation;
    splatLayer.updatePosition();
    console.log(`Height adjusted to: ${newLocation.height.toFixed(1)}m`);
  }

  // Auto-scale based on current view
  public autoScaleToView(splatLayer: GaussianSplatLayer): void {
    // Always use legacy auto-scale
    const bounds = this.getCurrentViewBounds();
    if (bounds) {
      const properScale = this.calculateProperScale(bounds);
      // SAFE: Only change scale
      this.applySafeScaling(splatLayer, properScale);
      console.log(`Auto-scaled to view: ${properScale.toFixed(2)}`);
    }
  }

  // Smart positioning to center of current view
  public centerToView(splatLayer: GaussianSplatLayer): void {
    console.log('⚠️ Center to view disabled - can cause splat to disappear');
    console.log('💡 Use arrow keys for small position adjustments instead');
    // This method is disabled because centering often moves the splat too far
    // and causes it to disappear outside the viewable coordinate range
  }
}