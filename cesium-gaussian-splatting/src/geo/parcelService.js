/**
 * Parcel service for loading GeoJSON parcels and finding parcels by point-in-polygon
 */
import * as turf from "@turf/turf";

let _parcels = null;

/**
 * Create placeholder parcels for testing (centered around Burbank coordinates)
 */
function createPlaceholderParcels() {
  const center = [-118.28507075, 34.18991967];
  const offset = 0.0005; // ~50m

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [center[0] - offset, center[1] - offset],
            [center[0] + offset, center[1] - offset],
            [center[0] + offset, center[1] + offset],
            [center[0] - offset, center[1] + offset],
            [center[0] - offset, center[1] - offset]
          ]]
        },
        properties: {
          parcelId: 'TEST-001',
          address: '123 Test St, Burbank, CA',
          owner: 'Test Owner LLC',
          ordinances: ['Zoning-Commercial', 'Historic District']
        }
      },
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [center[0] - offset * 2, center[1] - offset],
            [center[0] - offset, center[1] - offset],
            [center[0] - offset, center[1] + offset],
            [center[0] - offset * 2, center[1] + offset],
            [center[0] - offset * 2, center[1] - offset]
          ]]
        },
        properties: {
          parcelId: 'TEST-002',
          address: '456 Demo Ave, Burbank, CA',
          owner: 'Demo Properties Inc',
          ordinances: ['Zoning-Residential']
        }
      }
    ]
  };
}

export async function loadParcels(url = "/parcels_lhh.geojson") {
  if (_parcels) return _parcels;

  try {
    console.log('📦 Loading parcels from', url);
    const resp = await fetch(url);

    if (!resp.ok) {
      console.warn('⚠️ Could not load parcels from', url);
      console.warn('ℹ️ Using placeholder data. Add a real parcels_lhh.geojson to /public/');
      _parcels = createPlaceholderParcels();
      return _parcels;
    }

    _parcels = await resp.json();

    if (!_parcels || !_parcels.features) {
      throw new Error('Invalid GeoJSON format');
    }

    console.log('✅ Loaded', _parcels.features.length, 'parcels');
    return _parcels;
  } catch (error) {
    console.error('❌ Error loading parcels:', error);
    console.log('ℹ️ Using placeholder data. Add a real parcels_lhh.geojson to /public/');
    _parcels = createPlaceholderParcels();
    return _parcels;
  }
}

export function findParcelAt(lon, lat) {
  if (!_parcels) {
    console.warn('⚠️ Parcels not loaded yet');
    return null;
  }

  const pt = turf.point([lon, lat]);
  for (const f of _parcels.features) {
    if (!f.geometry) continue;
    const type = f.geometry.type;
    if (type === "Polygon" || type === "MultiPolygon") {
      try {
        if (turf.booleanPointInPolygon(pt, f)) return f;
      } catch (error) {
        console.warn('⚠️ Error checking polygon:', error);
      }
    }
  }
  return null;
}

export function getParcels() {
  return _parcels;
}
