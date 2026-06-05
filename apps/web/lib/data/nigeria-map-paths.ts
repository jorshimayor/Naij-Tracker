// Import the GeoJSON directly — Next/TS handles JSON modules natively. Bundled with the page
// at build time so it doesn't pay an fs.readFileSync hit per render and works in serverless.
import geojson from './nigeria-states.geojson.json';

/**
 * Server-side: read the Nigeria states GeoJSON and convert each feature into an SVG path
 * string with coordinates projected to fit in a fixed viewBox. Equirectangular projection
 * (linear lon→x, lat→y) is sufficient at this scale; spherical Web Mercator would distort
 * less than 1px over Nigeria's lat range.
 *
 * Output is fully precomputed so the client component renders <path d="…" /> directly.
 */

interface GeoFeature {
  type: 'Feature';
  properties: { shapeName: string; shapeISO: string };
  geometry:
    | { type: 'Polygon'; coordinates: number[][][] }
    | { type: 'MultiPolygon'; coordinates: number[][][][] };
}

interface FeatureCollection {
  type: 'FeatureCollection';
  features: GeoFeature[];
}

export interface StatePath {
  /** ISO 3166-2:NG 2-letter suffix, e.g. "LA". */
  code: string;
  name: string;
  /** SVG path "d" attribute. */
  d: string;
  /** Approximate centroid in viewBox units, for label placement. */
  centroid: { x: number; y: number };
}

export interface MapViewBox {
  width: number;
  height: number;
}

const VIEW: MapViewBox = { width: 800, height: 800 };
const PADDING = 16;

let cache: { viewBox: MapViewBox; paths: StatePath[] } | null = null;

export function getNigeriaMap(): { viewBox: MapViewBox; paths: StatePath[] } {
  if (cache) return cache;

  const fc = geojson as unknown as FeatureCollection;

  // Compute bounds across all features
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  const visitCoords = (coords: any): void => {
    if (typeof coords[0] === 'number') {
      const [lon, lat] = coords as [number, number];
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    } else {
      for (const c of coords) visitCoords(c);
    }
  };
  for (const f of fc.features) visitCoords(f.geometry.coordinates);

  const lonSpan = maxLon - minLon;
  const latSpan = maxLat - minLat;
  const availW = VIEW.width - PADDING * 2;
  const availH = VIEW.height - PADDING * 2;
  // Single uniform scale so the map isn't stretched. We pick the dimension that hits the
  // edge first and centre on the other.
  const scale = Math.min(availW / lonSpan, availH / latSpan);
  const renderedW = lonSpan * scale;
  const renderedH = latSpan * scale;
  const offsetX = PADDING + (availW - renderedW) / 2;
  const offsetY = PADDING + (availH - renderedH) / 2;

  const project = (lon: number, lat: number): [number, number] => {
    const x = offsetX + (lon - minLon) * scale;
    // Y is flipped — SVG Y grows downward, lat grows northward.
    const y = offsetY + (maxLat - lat) * scale;
    return [Math.round(x * 100) / 100, Math.round(y * 100) / 100];
  };

  const ringToPath = (ring: number[][]): string => {
    let d = '';
    for (let i = 0; i < ring.length; i++) {
      const [x, y] = project(ring[i][0], ring[i][1]);
      d += (i === 0 ? 'M' : 'L') + x + ' ' + y;
    }
    return d + 'Z';
  };

  const paths: StatePath[] = fc.features.map((f) => {
    const isoCode = (f.properties.shapeISO ?? '').replace(/^NG-/, '');
    const polys: number[][][][] =
      f.geometry.type === 'Polygon'
        ? [f.geometry.coordinates]
        : f.geometry.coordinates;

    let d = '';
    let sx = 0, sy = 0, count = 0;
    for (const poly of polys) {
      for (const ring of poly) {
        d += ringToPath(ring);
        // accumulate vertex centroid for label placement (good enough; not area-weighted)
        for (const [lon, lat] of ring) {
          const [x, y] = project(lon, lat);
          sx += x; sy += y; count++;
        }
      }
    }

    return {
      code: isoCode,
      name: f.properties.shapeName,
      d,
      centroid: {
        x: count > 0 ? Math.round(sx / count) : VIEW.width / 2,
        y: count > 0 ? Math.round(sy / count) : VIEW.height / 2,
      },
    };
  });

  cache = { viewBox: VIEW, paths };
  return cache;
}
