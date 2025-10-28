// src/alignment/qc/qcVectorVisualizer.ts
import * as Cesium from 'cesium';
import { QCPointPair } from './qcStats';

export class QCVectorVisualizer {
  private cesiumViewer: Cesium.Viewer;
  private entities: Cesium.Entity[] = [];

  constructor(cesiumViewer: Cesium.Viewer) {
    this.cesiumViewer = cesiumViewer;
  }

  public render(pairs: QCPointPair[], showVectors: boolean): void {
    // Clear existing entities
    this.clear();

    if (!showVectors || pairs.length === 0) {
      return;
    }

    // Create arrow + label for each pair
    pairs.forEach((pair, index) => {
      // Arrow from truth to splat
      const arrowEntity = this.cesiumViewer.entities.add({
        polyline: {
          positions: [pair.truthECEF, pair.splatECEF],
          width: 3,
          material: new Cesium.PolylineArrowMaterialProperty(
            this.getColorByError(pair.error2D)
          ),
          clampToGround: false
        }
      });

      // Label at splat point
      const labelEntity = this.cesiumViewer.entities.add({
        position: pair.splatECEF,
        label: {
          text: `${pair.error2D.toFixed(2)} m`,
          font: '14px monospace',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -10),
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
      });

      this.entities.push(arrowEntity, labelEntity);
    });

    console.log(`📍 QC: Rendered ${pairs.length} vector(s)`);
  }

  private getColorByError(error2D: number): Cesium.Color {
    // Color gradient: green (good) -> yellow -> orange -> red (bad)
    if (error2D < 0.5) {
      return Cesium.Color.LIME;
    } else if (error2D < 1.0) {
      return Cesium.Color.YELLOW;
    } else if (error2D < 2.0) {
      return Cesium.Color.ORANGE;
    } else {
      return Cesium.Color.RED;
    }
  }

  public clear(): void {
    this.entities.forEach(entity => {
      this.cesiumViewer.entities.remove(entity);
    });
    this.entities = [];
  }

  public destroy(): void {
    this.clear();
  }
}
