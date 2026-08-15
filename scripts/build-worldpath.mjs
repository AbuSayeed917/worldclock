/**
 * Converts Natural Earth 110m land polygons into a single SVG path string in
 * equirectangular projection, sized to a 360x180 viewBox (1 unit = 1 degree).
 * Run once; the output is vendored so the site has no runtime map dependency.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = process.argv[2] ?? '/tmp/ne_land.geojson';

const geo = JSON.parse(readFileSync(SOURCE, 'utf8'));

// Equirectangular: longitude maps straight to x, latitude flips to y.
const px = (lon) => (lon + 180);
const py = (lat) => (90 - lat);

/** Ramer-Douglas-Peucker, so the vendored path stays small without visible loss. */
function simplify(points, tolerance) {
  if (points.length < 3) return points;
  let maxDist = 0;
  let index = 0;
  const [ax, ay] = points[0];
  const [bx, by] = points[points.length - 1];
  const dx = bx - ax;
  const dy = by - ay;
  const denom = Math.hypot(dx, dy) || 1;

  for (let i = 1; i < points.length - 1; i++) {
    const [cx, cy] = points[i];
    const dist = Math.abs(dy * cx - dx * cy + bx * ay - by * ax) / denom;
    if (dist > maxDist) {
      maxDist = dist;
      index = i;
    }
  }

  if (maxDist > tolerance) {
    return [
      ...simplify(points.slice(0, index + 1), tolerance).slice(0, -1),
      ...simplify(points.slice(index), tolerance),
    ];
  }
  return [points[0], points[points.length - 1]];
}

const TOLERANCE = 0.35; // degrees
const MIN_AREA = 1.2; // drop specks smaller than this many square degrees

function ringArea(points) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area / 2);
}

const commands = [];
let ringsKept = 0;
let ringsDropped = 0;

function addRing(ring) {
  const projected = ring.map(([lon, lat]) => [px(lon), py(lat)]);

  // GeoJSON rings close by repeating the first vertex. Left in place, RDP's
  // baseline from first to last is a zero-length segment, every perpendicular
  // distance evaluates to 0, and the whole ring collapses to two points.
  const first = projected[0];
  const last = projected[projected.length - 1];
  if (projected.length > 1 && first[0] === last[0] && first[1] === last[1]) {
    projected.pop();
  }

  if (ringArea(projected) < MIN_AREA) {
    ringsDropped++;
    return;
  }
  const reduced = simplify(projected, TOLERANCE);
  if (reduced.length < 3) {
    ringsDropped++;
    return;
  }
  ringsKept++;
  const parts = reduced.map(
    ([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`,
  );
  commands.push(parts.join('') + 'Z');
}

for (const feature of geo.features) {
  const { type, coordinates } = feature.geometry;
  if (type === 'Polygon') {
    // Only the outer ring — interior holes (lakes) are noise at this scale.
    addRing(coordinates[0]);
  } else if (type === 'MultiPolygon') {
    for (const polygon of coordinates) addRing(polygon[0]);
  }
}

const path = commands.join('');

const out = `/**
 * World coastlines as a single SVG path, equirectangular, 360x180 viewBox
 * (one unit per degree, x = longitude + 180, y = 90 - latitude).
 *
 * Source: Natural Earth 1:110m land polygons — public domain (CC0).
 * https://www.naturalearthdata.com/
 *
 * Generated, then simplified with Ramer-Douglas-Peucker at 0.35 degrees.
 * Do not hand-edit.
 */

export const WORLD_PATH =
  '${path}';
`;

writeFileSync(join(ROOT, 'src/data/worldpath.ts'), out);

console.log('rings kept    :', ringsKept);
console.log('rings dropped :', ringsDropped);
console.log('path length   :', path.length.toLocaleString(), 'chars');
