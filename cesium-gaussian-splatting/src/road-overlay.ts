import * as Cesium from 'cesium';
import { OSMRoad, OSMIntersection } from './road-data-provider';

export class RoadOverlay {
  private cesiumViewer: Cesium.Viewer;
  private roadEntities: Cesium.Entity[] = [];
  private intersectionEntities: Cesium.Entity[] = [];

  constructor(cesiumViewer: Cesium.Viewer) {
    this.cesiumViewer = cesiumViewer;
  }

  public showRoads(roads: OSMRoad[], intersections: OSMIntersection[]): void {
    console.log('🗺️ Displaying road overlay on Cesium viewer...');

    // Clear existing overlays
    this.clearOverlay();

    // Add road polylines
    for (const road of roads) {
      if (road.geometry.length < 2) continue;

      const positions = road.geometry.map(point =>
        Cesium.Cartesian3.fromDegrees(point.lon, point.lat, 2) // 2m above ground
      );

      const roadEntity = this.cesiumViewer.entities.add({
        name: `Road: ${road.tags.name || 'Unnamed'} (${road.type})`,
        polyline: {
          positions,
          width: this.getRoadDisplayWidth(road.type),
          material: this.getRoadColor(road.type),
          clampToGround: true,
          outline: true,
          outlineColor: Cesium.Color.DARKSLATEGRAY.withAlpha(0.8)
        }
      });

      this.roadEntities.push(roadEntity);
    }

    // Add intersection points
    for (const intersection of intersections) {
      const intersectionEntity = this.cesiumViewer.entities.add({
        name: `Intersection: ${intersection.roads.length} roads`,
        position: Cesium.Cartesian3.fromDegrees(intersection.lon, intersection.lat, 5),
        point: {
          pixelSize: intersection.type === 'major' ? 12 : 8,
          color: intersection.type === 'major' ? Cesium.Color.RED : Cesium.Color.ORANGE,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
        },
        label: {
          text: `${intersection.roads.length}`,
          font: '12pt sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -30),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
        }
      });

      this.intersectionEntities.push(intersectionEntity);
    }

    console.log(`✅ Displayed ${roads.length} roads and ${intersections.length} intersections`);
  }

  public clearOverlay(): void {
    // Remove all road entities
    for (const entity of this.roadEntities) {
      this.cesiumViewer.entities.remove(entity);
    }
    this.roadEntities = [];

    // Remove all intersection entities
    for (const entity of this.intersectionEntities) {
      this.cesiumViewer.entities.remove(entity);
    }
    this.intersectionEntities = [];
  }

  public toggleVisibility(visible: boolean): void {
    for (const entity of this.roadEntities) {
      entity.show = visible;
    }
    for (const entity of this.intersectionEntities) {
      entity.show = visible;
    }
  }

  private getRoadDisplayWidth(roadType: string): number {
    const widths: Record<string, number> = {
      'primary': 8,
      'secondary': 6,
      'tertiary': 4,
      'residential': 3,
      'service': 2,
      'other': 2
    };

    return widths[roadType] || 3;
  }

  private getRoadColor(roadType: string): Cesium.Color {
    const colors: Record<string, Cesium.Color> = {
      'primary': Cesium.Color.YELLOW.withAlpha(0.8),
      'secondary': Cesium.Color.ORANGE.withAlpha(0.7),
      'tertiary': Cesium.Color.LIGHTBLUE.withAlpha(0.6),
      'residential': Cesium.Color.WHITE.withAlpha(0.5),
      'service': Cesium.Color.LIGHTGRAY.withAlpha(0.4),
      'other': Cesium.Color.GRAY.withAlpha(0.4)
    };

    return colors[roadType] || Cesium.Color.WHITE.withAlpha(0.5);
  }
}