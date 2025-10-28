import * as Cesium from 'cesium';

export interface OSMRoad {
  id: string;
  geometry: { lat: number; lon: number }[];
  tags: {
    highway?: string;
    name?: string;
    width?: string;
    surface?: string;
    lanes?: string;
  };
  type: 'primary' | 'secondary' | 'tertiary' | 'residential' | 'service' | 'other';
  width: number; // estimated width in meters
}

export interface OSMIntersection {
  lat: number;
  lon: number;
  roads: string[]; // IDs of connected roads
  type: string;
}

export interface RoadDataBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export class RoadDataProvider {
  private overpassUrl = 'https://overpass-api.de/api/interpreter';
  private cache: Map<string, { roads: OSMRoad[]; intersections: OSMIntersection[]; timestamp: number }> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  public async getRoadData(bounds: RoadDataBounds): Promise<{ roads: OSMRoad[]; intersections: OSMIntersection[] }> {
    console.log('🛣️ Fetching road data from OpenStreetMap...', bounds);

    // Check cache first
    const cacheKey = `${bounds.north},${bounds.south},${bounds.east},${bounds.west}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      console.log('📋 Using cached road data');
      return { roads: cached.roads, intersections: cached.intersections };
    }

    try {
      // Build Overpass query for roads
      const query = this.buildOverpassQuery(bounds);
      console.log('🔍 Overpass query:', query);

      const response = await fetch(this.overpassUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `data=${encodeURIComponent(query)}`
      });

      if (!response.ok) {
        throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('📊 Raw OSM data received:', data.elements?.length || 0, 'elements');

      // Process the data
      const processed = this.processOSMData(data);

      // Cache the result
      this.cache.set(cacheKey, {
        roads: processed.roads,
        intersections: processed.intersections,
        timestamp: Date.now()
      });

      console.log(`✅ Processed ${processed.roads.length} roads and ${processed.intersections.length} intersections`);

      return processed;

    } catch (error) {
      console.error('❌ Failed to fetch road data:', error);

      // Return fallback data based on bounds
      return this.generateFallbackRoadData(bounds);
    }
  }

  private buildOverpassQuery(bounds: RoadDataBounds): string {
    return `
      [out:json][timeout:25];
      (
        way["highway"~"^(primary|secondary|tertiary|residential|unclassified|service|trunk|motorway)$"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
      );
      out geom;
    `;
  }

  private processOSMData(data: any): { roads: OSMRoad[]; intersections: OSMIntersection[] } {
    const roads: OSMRoad[] = [];
    const nodeConnections: Map<string, string[]> = new Map();

    // Process ways (roads)
    for (const element of data.elements || []) {
      if (element.type === 'way' && element.geometry) {
        const road = this.processRoadElement(element);
        if (road) {
          roads.push(road);

          // Track node connections for intersection detection
          for (const node of element.geometry) {
            const nodeId = `${node.lat.toFixed(6)},${node.lon.toFixed(6)}`;
            if (!nodeConnections.has(nodeId)) {
              nodeConnections.set(nodeId, []);
            }
            nodeConnections.get(nodeId)!.push(element.id.toString());
          }
        }
      }
    }

    // Find intersections (nodes connected to multiple roads)
    const intersections: OSMIntersection[] = [];
    for (const [nodeId, roadIds] of nodeConnections.entries()) {
      if (roadIds.length >= 2) {
        const [lat, lon] = nodeId.split(',').map(Number);
        intersections.push({
          lat,
          lon,
          roads: roadIds,
          type: roadIds.length >= 3 ? 'major' : 'minor'
        });
      }
    }

    return { roads, intersections };
  }

  private processRoadElement(element: any): OSMRoad | null {
    if (!element.geometry || element.geometry.length < 2) {
      return null;
    }

    const tags = element.tags || {};
    const highway = tags.highway || 'unknown';

    // Classify road type and estimate width
    const { type, width } = this.classifyRoad(highway, tags);

    return {
      id: element.id.toString(),
      geometry: element.geometry.map((node: any) => ({
        lat: node.lat,
        lon: node.lon
      })),
      tags,
      type,
      width
    };
  }

  private classifyRoad(highway: string, tags: any): { type: OSMRoad['type']; width: number } {
    // Estimate road width based on type
    const roadTypes: Record<string, { type: OSMRoad['type']; width: number }> = {
      'motorway': { type: 'primary', width: 24 },
      'trunk': { type: 'primary', width: 20 },
      'primary': { type: 'primary', width: 16 },
      'secondary': { type: 'secondary', width: 12 },
      'tertiary': { type: 'tertiary', width: 10 },
      'unclassified': { type: 'tertiary', width: 8 },
      'residential': { type: 'residential', width: 6 },
      'service': { type: 'service', width: 4 },
      'living_street': { type: 'residential', width: 5 },
      'pedestrian': { type: 'service', width: 3 }
    };

    const classification = roadTypes[highway] || { type: 'other', width: 6 };

    // Adjust width based on lanes if available
    if (tags.lanes) {
      const lanes = parseInt(tags.lanes);
      if (!isNaN(lanes) && lanes > 0) {
        classification.width = lanes * 3.5; // ~3.5m per lane
      }
    }

    // Adjust width based on explicit width tag
    if (tags.width) {
      const width = parseFloat(tags.width);
      if (!isNaN(width) && width > 0) {
        classification.width = width;
      }
    }

    return classification;
  }

  private generateFallbackRoadData(bounds: RoadDataBounds): { roads: OSMRoad[]; intersections: OSMIntersection[] } {
    console.log('🔄 Generating fallback road data for Burbank area...');

    const roads: OSMRoad[] = [];
    const intersections: OSMIntersection[] = [];

    // Generate a realistic road grid for Burbank based on known street patterns
    const centerLat = (bounds.north + bounds.south) / 2;
    const centerLon = (bounds.east + bounds.west) / 2;

    // Main arterial roads (N-S and E-W)
    const arterials = [
      // North-South arterials
      { name: 'Buena Vista St', offset: -0.003, direction: 'ns', type: 'primary' as const },
      { name: 'Hollywood Way', offset: -0.001, direction: 'ns', type: 'primary' as const },
      { name: 'San Fernando Blvd', offset: 0.001, direction: 'ns', type: 'primary' as const },
      { name: 'Victory Blvd', offset: 0.003, direction: 'ns', type: 'primary' as const },

      // East-West arterials
      { name: 'Burbank Blvd', offset: -0.002, direction: 'ew', type: 'primary' as const },
      { name: 'Olive Ave', offset: 0, direction: 'ew', type: 'secondary' as const },
      { name: 'Alameda Ave', offset: 0.002, direction: 'ew', type: 'secondary' as const }
    ];

    // Generate arterial roads
    for (const arterial of arterials) {
      if (arterial.direction === 'ns') {
        const lon = centerLon + arterial.offset;
        roads.push({
          id: `arterial_${arterial.name}`,
          geometry: [
            { lat: bounds.south, lon },
            { lat: bounds.north, lon }
          ],
          tags: { highway: arterial.type, name: arterial.name },
          type: arterial.type,
          width: arterial.type === 'primary' ? 16 : 12
        });
      } else {
        const lat = centerLat + arterial.offset;
        roads.push({
          id: `arterial_${arterial.name}`,
          geometry: [
            { lat, lon: bounds.west },
            { lat, lon: bounds.east }
          ],
          tags: { highway: arterial.type, name: arterial.name },
          type: arterial.type,
          width: arterial.type === 'primary' ? 16 : 12
        });
      }
    }

    // Generate residential grid
    const residentialSpacing = 0.0008; // ~70m between streets
    let streetId = 1;

    for (let lat = bounds.south + residentialSpacing; lat < bounds.north; lat += residentialSpacing) {
      roads.push({
        id: `residential_ew_${streetId++}`,
        geometry: [
          { lat, lon: bounds.west },
          { lat, lon: bounds.east }
        ],
        tags: { highway: 'residential' },
        type: 'residential',
        width: 6
      });
    }

    for (let lon = bounds.west + residentialSpacing; lon < bounds.east; lon += residentialSpacing) {
      roads.push({
        id: `residential_ns_${streetId++}`,
        geometry: [
          { lat: bounds.south, lon },
          { lat: bounds.north, lon }
        ],
        tags: { highway: 'residential' },
        type: 'residential',
        width: 6
      });
    }

    // Generate intersections at grid crossings
    let intersectionId = 1;
    for (let lat = bounds.south; lat <= bounds.north; lat += residentialSpacing) {
      for (let lon = bounds.west; lon <= bounds.east; lon += residentialSpacing) {
        if (lat > bounds.south && lat < bounds.north && lon > bounds.west && lon < bounds.east) {
          intersections.push({
            lat,
            lon,
            roads: [`road_${intersectionId}_1`, `road_${intersectionId}_2`],
            type: 'minor'
          });
          intersectionId++;
        }
      }
    }

    console.log(`✅ Generated ${roads.length} fallback roads and ${intersections.length} intersections`);

    return { roads, intersections };
  }

  public static boundsFromCesiumView(viewer: Cesium.Viewer, radiusMeters: number = 1000): RoadDataBounds {
    const camera = viewer.camera;
    const canvas = viewer.scene.canvas;

    // Get center point
    const center = camera.pickEllipsoid(
      new Cesium.Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2),
      viewer.scene.globe.ellipsoid
    );

    if (!center) {
      // Fallback to Burbank coordinates
      return {
        north: 34.1950,
        south: 34.1850,
        east: -118.2800,
        west: -118.2900
      };
    }

    const centerGeo = Cesium.Cartographic.fromCartesian(center);
    const centerLon = Cesium.Math.toDegrees(centerGeo.longitude);
    const centerLat = Cesium.Math.toDegrees(centerGeo.latitude);

    // Convert radius to degrees (rough approximation)
    const radiusDegrees = radiusMeters / 111000; // ~111km per degree

    return {
      north: centerLat + radiusDegrees,
      south: centerLat - radiusDegrees,
      east: centerLon + radiusDegrees,
      west: centerLon - radiusDegrees
    };
  }
}