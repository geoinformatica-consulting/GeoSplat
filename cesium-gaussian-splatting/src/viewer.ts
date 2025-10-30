import * as Cesium from "cesium";

import { ThreeOverlay } from "./three-overlay";
import { GaussianSplatLayer } from "./gaussian-splat-layer";

export class Viewer {
  public cesium!: Cesium.Viewer;

  private threeOverlay!: ThreeOverlay;

  constructor() {
    this.createViewer();
    this.createOverlay();

    // call rendering on our three overlay after Cesium is done rendering
    this.cesium.scene.postRender.addEventListener(() => {
      this.threeOverlay.render();
    });
  }

  private async createViewer() {
    // Set Cesium Ion token FIRST before creating viewer
    Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJhY2QxODIxMy05YTg2LTQ1NWQtODE0NC1kMWRiZWUwYjgyY2UiLCJpZCI6MzE2Nzg3LCJpYXQiOjE3NTkwODAzMzJ9.uN7tc0tUNOVkYaD8sP8pWcwGPgBbliqvLktW-SBlgVU';

    this.cesium = new Cesium.Viewer("cesium", {
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      animation: false,
      timeline: false,
      navigationHelpButton: false,
      infoBox: false,
      terrain: Cesium.Terrain.fromWorldTerrain({
        requestVertexNormals: true,
        requestWaterMask: true,
      }),
    });

    this.cesium.scene.debugShowFramesPerSecond = true;

    // CRITICAL: Enable depth testing so terrain shows in 3D
    this.cesium.scene.globe.depthTestAgainstTerrain = true;

    // Enable lighting for better 3D effect
    this.cesium.scene.globe.enableLighting = true;

    // Better rendering quality
    this.cesium.scene.fxaa = true;
    this.cesium.scene.requestRenderMode = false;

    await this.addBaseLayer();
    this.addBuildingsLayer();

    console.log('✅ 3D Viewer initialized with terrain elevation');
  }

  private async addBaseLayer(): Promise<void> {
    try {
      // Use Cesium Ion's Bing Maps imagery (high-quality aerial imagery)
      // Asset ID 2 = Bing Maps Aerial with Labels
      const bingImagery = await Cesium.IonImageryProvider.fromAssetId(2);
      this.cesium.imageryLayers.addImageryProvider(bingImagery);
      console.log('✅ Bing Maps aerial imagery loaded (high-resolution via Cesium Ion)');
    } catch (error) {
      console.warn('Failed to load Bing imagery, falling back to OSM:', error);
      // Fallback to OSM if Ion imagery fails
      const osmProvider = new Cesium.OpenStreetMapImageryProvider({
        url: '/osm/',
        maximumLevel: 19
      });
      this.cesium.imageryLayers.addImageryProvider(osmProvider);
      console.log('✅ OpenStreetMap imagery loaded (fallback)');
    }
  }

  /**
   * Switch to blank/minimal imagery for testing splat without basemap dependency
   */
  public setBlankImagery(): void {
    const layers = this.cesium.imageryLayers;
    layers.removeAll();

    // Single 1x1 transparent pixel as basemap
    const blankProvider = new Cesium.SingleTileImageryProvider({
      url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgAAAAAgAB9HFkGQAAAABJRU5ErkJggg==',
    });

    layers.addImageryProvider(blankProvider);
    console.log('🖼️ Switched to blank imagery (minimal basemap)');
  }

  /**
   * Switch to OSM imagery (lower detail than Esri)
   */
  public setOSMImagery(): void {
    const layers = this.cesium.imageryLayers;
    layers.removeAll();

    const osmProvider = new Cesium.OpenStreetMapImageryProvider({
      url: '/osm/',
      maximumLevel: 19
    });
    layers.addImageryProvider(osmProvider);
    console.log('🗺️ Switched to OpenStreetMap imagery');
  }

  /**
   * Switch to Bing Maps aerial imagery (high-resolution, default)
   */
  public async setEsriImagery(): Promise<void> {
    const layers = this.cesium.imageryLayers;
    layers.removeAll();
    await this.addBaseLayer(); // Uses Bing Maps by default now
  }

  private async addBuildingsLayer(): Promise<void> {
    try {
      // Use Google 3D Tiles for buildings (works in California)
      const buildings = await Cesium.Cesium3DTileset.fromIonAssetId(96188);
      this.cesium.scene.primitives.add(buildings);
      console.log('Google 3D Buildings loaded');
    } catch (error) {
      console.warn('Failed to load 3D buildings:', error);
    }
  }

  private createOverlay() {
    this.threeOverlay = new ThreeOverlay(this.cesium!.camera, this.cesium);
  }

  public flyTo(
    x: number,
    y: number,
    z: number,
    heading: number,
    pitch: number,
    duration: number
  ): void {
    this.cesium.camera?.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(x, y, z),
      orientation: {
        heading: Cesium.Math.toRadians(heading),
        pitch: Cesium.Math.toRadians(pitch),
        roll: 0.0,
      },
      duration: duration,
    });
  }

  public addGaussianSplatLayer(layer: GaussianSplatLayer): void {
    this.threeOverlay.addGaussianSplatLayer(layer);
  }
}
