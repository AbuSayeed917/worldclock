/**
 * Generates the site's Lottie scenes.
 *
 * Characters come from Open Peeps (CC0 hand-drawn artwork, vendored in
 * assets/peeps) and are composed into Lottie by scripts/peeps.mjs. Everything
 * around them — sky, sun, clouds, skyline, birds, stars — is built here, because
 * it has to match the site's palette rather than whatever palette an artist
 * happened to draw against.
 *
 * Run: node scripts/build-lottie.mjs
 * Then: node scripts/preview-lottie.mjs public/lottie/*.json
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { peep, walkCycle, resetLayerIndex } from './peeps.mjs';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public/lottie');
mkdirSync(OUT, { recursive: true });

const FPS = 60;

/* ------------------------------------------------------------- primitives */

function rgb(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
    1,
  ];
}

const still = (k) => ({ a: 0, k });

function anim(keys, ease = [0.42, 0, 0.58, 1]) {
  const [ox, oy, ix, iy] = ease;
  return {
    a: 1,
    k: keys.map(([t, v], idx) => {
      const frame = { t, s: Array.isArray(v) ? v : [v] };
      if (idx < keys.length - 1) {
        frame.i = { x: [ix], y: [iy] };
        frame.o = { x: [ox], y: [oy] };
      }
      return frame;
    }),
  };
}

const ellipse = (w, h, p = [0, 0]) => ({ ty: 'el', p: still(p), s: still([w, h]), nm: 'el' });
const rect = (w, h, r = 0, p = [0, 0]) => ({
  ty: 'rc', p: still(p), s: still([w, h]), r: still(r), nm: 'rc',
});
const fill = (hex, o = 100) => ({ ty: 'fl', c: still(rgb(hex)), o: still(o), r: 1, nm: 'fill' });
const stroke = (hex, w, o = 100) => ({
  ty: 'st', c: still(rgb(hex)), o: still(o), w: still(w), lc: 2, lj: 2, nm: 'stroke',
});

function path(pts, closed = false) {
  return {
    ty: 'sh',
    ks: still({ i: pts.map(() => [0, 0]), o: pts.map(() => [0, 0]), v: pts, c: closed }),
    nm: 'path',
  };
}

const tr = ({ p = [0, 0], a = [0, 0], s = [100, 100], r = 0, o = 100 } = {}) => ({
  ty: 'tr',
  p: Array.isArray(p) ? still(p) : p,
  a: still(a),
  s: Array.isArray(s) ? still(s) : s,
  r: typeof r === 'number' ? still(r) : r,
  o: typeof o === 'number' ? still(o) : o,
  nm: 'transform',
});

const group = (items, transform = tr(), nm = 'group') => ({ ty: 'gr', it: [...items, transform], nm });

function layer(shapes, { name = 'layer', ks = {} } = {}) {
  return {
    ddd: 0, ind: 0, ty: 4, nm: name, sr: 1,
    ks: {
      o: ks.o !== undefined ? (typeof ks.o === 'number' ? still(ks.o) : ks.o) : still(100),
      r: ks.r !== undefined ? (typeof ks.r === 'number' ? still(ks.r) : ks.r) : still(0),
      p: ks.p ?? still([0, 0, 0]),
      a: ks.a ?? still([0, 0, 0]),
      s: ks.s ?? still([100, 100, 100]),
    },
    ao: 0, shapes, ip: 0, st: 0, bm: 0,
  };
}

function comp({ name, w, h, duration, layers }) {
  const op = Math.round(duration * FPS);
  // Assign indices centrally. Characters and scenery are built by different
  // modules, each with its own counter, so uniqueness can only be guaranteed
  // once every layer is in one place.
  layers.forEach((l, i) => {
    l.ind = i + 1;
    if (l.op === undefined) l.op = op;
    if (l.ip === undefined) l.ip = 0;
  });
  return { v: '5.12.2', fr: FPS, ip: 0, op, w, h, nm: name, ddd: 0, assets: [], layers };
}

function validate(name, data) {
  const problems = [];
  if (!data.layers.length) problems.push('no layers');
  const seen = new Set();
  data.layers.forEach((l, i) => {
    const where = `layer ${i} (${l.nm})`;
    if (typeof l.op !== 'number') problems.push(`${where}: missing op`);
    if (l.op <= l.ip) problems.push(`${where}: op <= ip`);
    if (seen.has(l.ind)) problems.push(`${where}: duplicate ind ${l.ind}`);
    seen.add(l.ind);
    if (!l.ks?.p) problems.push(`${where}: missing position`);
    if (l.ty === 4 && !l.shapes?.length) problems.push(`${where}: no shapes`);
  });
  if ((data.assets ?? []).some((a) => a.p && !a.e)) problems.push('external image refs');
  if (problems.length) throw new Error(`${name}:\n  - ${problems.join('\n  - ')}`);
}

/* ---------------------------------------------------------------- palette */

const IVORY = '#F6EFE4';
const CLAY = '#E8825B';
const PLUM = '#6B4E8F';
const TEAL = '#2E8C8C';
const AMBER = '#F5A93F';
const INK = '#221B38';

/** A cast with varied skin, hair and clothing, reused across the scenes. */
const CAST = [
  { skin: '#F0C9A8', hair: '#4A2F1E', clothes: CLAY, head: 'Medium_Bangs', face: 'Smile' },
  { skin: '#9A5F44', hair: '#241C3A', clothes: TEAL, head: 'Afro', face: 'Calm' },
  { skin: '#E8B08A', hair: '#3A2A50', clothes: PLUM, head: 'Short_1', face: 'Cheeky' },
  { skin: '#C98A62', hair: '#2B2140', clothes: '#3E7BB5', head: 'Bun', face: 'Smile_Big' },
  { skin: '#F2D3B4', hair: '#5B3A2E', clothes: '#C4574F', head: 'Turban', face: 'Calm' },
  { skin: '#8B5A3C', hair: '#1F1830', clothes: '#4E9E7A', head: 'Hijab', face: 'Smile' },
];

/* --------------------------------------------------------------- scenery */

/** Radiating sun with a slowly turning ray ring. */
function sun({ x, y, r = 34, color = AMBER, rays = 12, spin = 600, rayLen = 16, position }) {
  const rayShapes = [];
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2;
    const inner = r + 10;
    const outer = inner + rayLen;
    rayShapes.push(
      group(
        [path([[Math.cos(a) * inner, Math.sin(a) * inner], [Math.cos(a) * outer, Math.sin(a) * outer]]),
         stroke(color, 5, 85)],
        tr(), `ray-${i}`,
      ),
    );
  }
  return [
    layer([group(rayShapes, tr(), 'rays')], {
      name: 'sun-rays',
      ks: { p: position ?? still([x, y, 0]), r: anim([[0, 0], [spin, 360]], [0, 0, 1, 1]) },
    }),
    layer([group([ellipse(r * 2, r * 2), fill(color)], tr(), 'disc')], {
      name: 'sun-disc',
      ks: {
        p: position ?? still([x, y, 0]),
        s: anim([[0, [100, 100]], [90, [105, 105]], [180, [100, 100]]]),
      },
    }),
  ];
}

/** Crescent moon: a lit disc with a shadow disc offset across it. */
function moon({ x, y, r = 34, shadow, period = 360 }) {
  return layer(
    [
      group([ellipse(r * 2, r * 2), fill('#FFF4D6')], tr(), 'moon'),
      group([ellipse(r * 1.72, r * 1.72, [r * 0.5, -r * 0.3]), fill(shadow)], tr(), 'shadow'),
    ],
    {
      name: 'moon',
      ks: {
        p: anim([
          [0, [x, y, 0]],
          [period / 2, [x, y - 6, 0]],
          [period, [x, y, 0]],
        ]),
      },
    },
  );
}

function cloud({ x, y, scale = 100, color = IVORY, opacity = 90, drift = 26, period = 480 }) {
  return layer(
    [
      group([
        group([ellipse(58, 58, [-26, 4]), fill(color, opacity)], tr(), 'a'),
        group([ellipse(76, 76, [8, -6]), fill(color, opacity)], tr(), 'b'),
        group([ellipse(52, 52, [42, 6]), fill(color, opacity)], tr(), 'c'),
        group([rect(110, 34, 17, [8, 16]), fill(color, opacity)], tr(), 'base'),
      ], tr(), 'cloud'),
    ],
    {
      name: 'cloud',
      ks: {
        s: still([scale, scale, 100]),
        p: anim([[0, [x, y, 0]], [period / 2, [x + drift, y - 5, 0]], [period, [x, y, 0]]]),
      },
    },
  );
}

function stars({ count, w, h, color = IVORY, seed = 7 }) {
  let s = seed;
  const rand = () => ((s = (s * 1664525 + 1013904223) % 4294967296), s / 4294967296);
  // Three twinkle phases is enough for the eye; one layer per star is not.
  const BUCKETS = 3;
  const buckets = Array.from({ length: BUCKETS }, () => []);
  for (let i = 0; i < count; i++) {
    const x = rand() * w;
    const y = rand() * h * 0.55;
    const size = 2 + rand() * 3.2;
    buckets[i % BUCKETS].push(group([ellipse(size, size, [x, y]), fill(color)], tr(), 'star'));
  }
  return buckets.map((bucket, i) =>
    layer([group(bucket, tr(), 'stars')], {
      name: `stars-${i}`,
      ks: {
        p: still([0, 0, 0]),
        o: anim([[i * 40, 22], [i * 40 + 60, 95], [i * 40 + 120, 22]]),
      },
    }),
  );
}

/**
 * A city skyline silhouette with windows that light up.
 *
 * Deterministic from a seed so the same skyline is generated every build — a
 * random one would churn the committed JSON on every run.
 */
function skyline({ y, w, color, windowColor, seed = 11, opacity = 100, scale = 1, lit = false }) {
  let s = seed;
  const rand = () => ((s = (s * 1103515245 + 12345) % 2147483648), s / 2147483648);

  const WINDOW_BUCKETS = 4;
  const buildings = [];
  const windows = Array.from({ length: WINDOW_BUCKETS }, () => []);
  let x = -20;

  while (x < w + 20) {
    const bw = (40 + rand() * 70) * scale;
    const bh = (44 + rand() * 96) * scale;
    buildings.push(group([rect(bw, bh, 2, [x + bw / 2, -bh / 2]), fill(color, opacity)], tr(), 'b'));

    if (lit) {
      const cols = Math.max(1, Math.floor(bw / 18));
      const rows = Math.max(1, Math.floor(bh / 26));
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if (rand() > 0.55) continue;
          const wx = x + 10 + c * 18;
          const wy = -bh + 18 + r * 26;
          // Windows go into one of a few phase buckets rather than each getting
          // its own layer. A hundred one-rect layers is most of the file size
          // and all of the render cost, for a flicker nobody can follow.
          windows[Math.floor(rand() * WINDOW_BUCKETS)].push(
            group([rect(6, 8, 1, [wx, wy]), fill(windowColor)], tr(), 'w'),
          );
        }
      }
    }
    x += bw + 6 * scale;
  }

  return [
    layer([group(buildings, tr(), 'skyline')], { name: 'skyline', ks: { p: still([0, y, 0]) } }),
    ...windows
      .filter((bucket) => bucket.length)
      .map((bucket, i) =>
        layer([group(bucket, tr(), 'windows')], {
          name: `windows-${i}`,
          ks: {
            p: still([0, y, 0]),
            o: anim([
              [i * 60, 34],
              [i * 60 + 120, 94],
              [i * 60 + 240, 34],
            ]),
          },
        }),
      ),
  ];
}

/** A flock of birds, each a simple two-stroke wing that flaps as it crosses. */
function birds({ count, x, y, w, color, period = 420, scale = 1, seed = 5 }) {
  let s = seed;
  const rand = () => ((s = (s * 1664525 + 1013904223) % 4294967296), s / 4294967296);
  const out = [];

  for (let i = 0; i < count; i++) {
    const dy = (rand() - 0.5) * 46;
    const delay = Math.floor(rand() * period);
    const size = (5 + rand() * 3) * scale;
    const flap = 22 + Math.floor(rand() * 14);

    // Two wings as separate rotating groups gives a flap without keyframing a path.
    const wingL = group([path([[0, 0], [-size, -size * 0.55]]), stroke(color, 2.2, 90)],
      tr({ r: anim([[0, -14], [flap, 12], [flap * 2, -14]]) }), 'wl');
    const wingR = group([path([[0, 0], [size, -size * 0.55]]), stroke(color, 2.2, 90)],
      tr({ r: anim([[0, 14], [flap, -12], [flap * 2, 14]]) }), 'wr');

    out.push(
      layer([group([wingL, wingR], tr(), 'bird')], {
        name: `bird-${i}`,
        ks: {
          p: anim([[delay, [x, y + dy, 0]], [delay + period, [x + w, y + dy - 30, 0]]], [0, 0, 1, 1]),
          o: anim([[delay, 0], [delay + 30, 90], [delay + period - 30, 90], [delay + period, 0]]),
        },
      }),
    );
  }
  return out;
}

/** Ground plane with a soft horizon edge. */
function ground({ y, w, h, color, opacity = 100 }) {
  return layer([group([rect(w * 1.4, h, 0, [0, h / 2]), fill(color, opacity)], tr(), 'g')], {
    name: 'ground',
    ks: { p: still([w / 2, y, 0]) },
  });
}

/* ---------------------------------------------------------------- scenes */

const W = 720;
const H = 420;

function sceneDawn() {
  resetLayerIndex(0);
  const DUR = 8;
  const P = DUR * FPS;
  const GROUND = H * 0.86;
  const layers = [];

  // Sun climbing out of the horizon across the whole loop.
  layers.push(
    ...sun({
      r: 34, color: AMBER, rays: 14, spin: P * 2, rayLen: 18,
      position: anim([[0, [W * 0.78, H * 0.62, 0]], [P, [W * 0.78, H * 0.26, 0]]]),
    }),
  );

  layers.push(cloud({ x: W * 0.24, y: H * 0.2, scale: 52, color: IVORY, opacity: 46, period: P }));
  layers.push(cloud({ x: W * 0.56, y: H * 0.13, scale: 38, color: IVORY, opacity: 34, drift: -20, period: P }));

  layers.push(...birds({ count: 4, x: -40, y: H * 0.24, w: W + 80, color: '#3B3357', period: P * 0.9, seed: 3 }));
  layers.push(...skyline({ y: GROUND, w: W, color: '#4B3F6B', windowColor: AMBER, seed: 17, opacity: 42, scale: 0.6 }));
  layers.push(ground({ y: GROUND, w: W, h: H, color: '#3A315A' }));

  // Someone up early with a coffee, and someone easing into the day.
  const a = CAST[0];
  const b = CAST[4];
  layers.push(...peep({
    pose: 'resting-1', head: a.head, face: 'Eyes_Closed',
    x: W * 0.29, groundY: GROUND + 8, height: 252,
    skin: a.skin, hair: a.hair, clothes: a.clothes, ink: INK,
    bob: 3, bobPeriod: P / 2, headTilt: 3,
  }));
  layers.push(...peep({
    pose: 'easing-1', head: b.head, face: b.face,
    x: W * 0.53, groundY: GROUND + 8, height: 236, flip: true,
    skin: b.skin, hair: b.hair, clothes: b.clothes, ink: INK,
    bob: 2, bobPeriod: P / 2, phase: 40,
  }));

  return comp({ name: 'Dawn', w: W, h: H, duration: DUR, layers });
}

function sceneMidday() {
  resetLayerIndex(0);
  const DUR = 6;
  const P = DUR * FPS;
  const GROUND = H * 0.88;
  const layers = [];

  layers.push(...sun({ x: W * 0.86, y: H * 0.16, r: 30, color: AMBER, rays: 12, spin: P * 2 }));
  layers.push(cloud({ x: W * 0.2, y: H * 0.16, scale: 62, opacity: 62, period: P }));
  layers.push(cloud({ x: W * 0.58, y: H * 0.26, scale: 44, opacity: 42, drift: -24, period: P }));
  layers.push(...birds({ count: 3, x: -40, y: H * 0.2, w: W + 80, color: '#2F4B6E', period: P, seed: 8 }));
  layers.push(...skyline({ y: GROUND, w: W, color: '#2E5C7A', windowColor: '#BFE4FF', seed: 23, opacity: 30, scale: 0.62 }));
  layers.push(ground({ y: GROUND, w: W, h: H, color: '#2B5470' }));

  // Three people out walking, each on its own gait phase so they never march.
  [
    { cast: CAST[1], x: W * 0.24, height: 224, period: 34, phase: 0 },
    { cast: CAST[2], x: W * 0.5, height: 258, period: 30, phase: 11 },
    { cast: CAST[5], x: W * 0.76, height: 236, period: 38, phase: 22, flip: true },
  ].forEach(({ cast, x, height, period, phase, flip }) => {
    layers.push(...walkCycle({
      x, groundY: GROUND + 6, height, period, phase, flip,
      head: cast.head, face: cast.face,
      skin: cast.skin, hair: cast.hair, clothes: cast.clothes, ink: INK,
    }));
  });

  return comp({ name: 'Midday', w: W, h: H, duration: DUR, layers });
}

function sceneDusk() {
  resetLayerIndex(0);
  const DUR = 8;
  const P = DUR * FPS;
  const GROUND = H * 0.87;
  const layers = [];

  // Sun sinking — the mirror of dawn.
  layers.push(
    ...sun({
      r: 36, color: '#F2793F', rays: 12, spin: P * 2, rayLen: 14,
      position: anim([[0, [W * 0.2, H * 0.3, 0]], [P, [W * 0.2, H * 0.66, 0]]]),
    }),
  );

  layers.push(cloud({ x: W * 0.62, y: H * 0.2, scale: 56, color: '#FFD9B0', opacity: 52, period: P }));
  layers.push(cloud({ x: W * 0.86, y: H * 0.3, scale: 40, color: '#FFC79A', opacity: 38, drift: -18, period: P }));
  layers.push(...birds({ count: 6, x: W + 40, y: H * 0.22, w: -(W + 80), color: '#4A2E52', period: P * 0.8, seed: 12 }));
  layers.push(...skyline({ y: GROUND, w: W, color: '#4A2C52', windowColor: '#FFC978', seed: 31, opacity: 58, scale: 0.66, lit: true }));
  layers.push(ground({ y: GROUND, w: W, h: H, color: '#3B2447' }));

  // Two people heading home, walking the same way at slightly different speeds.
  layers.push(...walkCycle({
    x: W * 0.44, groundY: GROUND + 8, height: 254, period: 40, phase: 0, flip: true,
    head: CAST[3].head, face: CAST[3].face,
    skin: CAST[3].skin, hair: CAST[3].hair, clothes: CAST[3].clothes, ink: INK,
  }));
  layers.push(...walkCycle({
    x: W * 0.68, groundY: GROUND + 8, height: 226, period: 44, phase: 15, flip: true,
    head: CAST[0].head, face: 'Calm',
    skin: CAST[0].skin, hair: CAST[0].hair, clothes: '#7A5CA8', ink: INK,
  }));

  return comp({ name: 'Dusk', w: W, h: H, duration: DUR, layers });
}

function sceneNight() {
  resetLayerIndex(0);
  const DUR = 8;
  const P = DUR * FPS;
  const GROUND = H * 0.88;
  const layers = [];

  layers.push(...stars({ count: 30, w: W, h: H, color: IVORY, seed: 19 }));
  layers.push(moon({ x: W * 0.84, y: H * 0.2, r: 34, shadow: '#0E1226', period: P }));
  layers.push(...skyline({ y: GROUND, w: W, color: '#241C42', windowColor: AMBER, seed: 41, opacity: 78, scale: 0.72, lit: true }));
  layers.push(ground({ y: GROUND, w: W, h: H, color: '#1C1636' }));

  // Someone still up, sitting with a laptop.
  const deskY = GROUND - 4;
  const c = CAST[2];
  layers.push(...peep({
    pose: 'sit-mid-1', head: c.head, face: 'Calm',
    x: W * 0.34, groundY: deskY, height: 214,
    skin: c.skin, hair: c.hair, clothes: c.clothes, ink: INK,
    bob: 2, bobPeriod: P / 2, headTilt: -2,
  }));

  layers.push(
    layer(
      [
        group([rect(250, 11, 5), fill('#463B72')], tr(), 'top'),
        group([rect(11, 66, 4, [-112, 38]), fill('#3B3162')], tr(), 'leg-l'),
        group([rect(11, 66, 4, [112, 38]), fill('#3B3162')], tr(), 'leg-r'),
      ],
      { name: 'desk', ks: { p: still([W * 0.6, deskY - 60, 0]) } },
    ),
  );
  layers.push(
    layer(
      [
        group([rect(64, 42, 4, [0, -21]), fill('#544A85')], tr(), 'lid'),
        group([rect(56, 33, 2, [0, -21]), fill(AMBER, 90)], tr(), 'screen'),
        group([rect(76, 7, 3, [0, 3]), fill('#645898')], tr(), 'base'),
      ],
      {
        name: 'laptop',
        ks: {
          p: still([W * 0.58, deskY - 66, 0]),
          o: anim([[0, 100], [P * 0.5, 88], [P, 100]]),
        },
      },
    ),
  );
  layers.push(
    layer([group([rect(20, 24, 4), fill(CLAY)], tr(), 'mug')], {
      name: 'mug',
      ks: { p: still([W * 0.72, deskY - 78, 0]) },
    }),
  );

  return comp({ name: 'Night', w: W, h: H, duration: DUR, layers });
}

/** Small ambient loop: a globe with an orbiting marker. */
function sceneOrbit() {
  resetLayerIndex(0);
  const DUR = 10;
  const P = DUR * FPS;
  const layers = [
    layer([group([ellipse(150, 150), stroke(TEAL, 4, 60)], tr(), 'globe')], {
      name: 'globe', ks: { p: still([150, 150, 0]) },
    }),
    layer([group([ellipse(150, 56), stroke(TEAL, 3, 34)], tr(), 'equator')], {
      name: 'equator', ks: { p: still([150, 150, 0]) },
    }),
    layer([group([ellipse(56, 150), stroke(TEAL, 3, 34)], tr(), 'meridian')], {
      name: 'meridian', ks: { p: still([150, 150, 0]) },
    }),
    layer([group([ellipse(18, 18), fill(AMBER)], tr(), 'satellite')], {
      name: 'satellite',
      ks: {
        p: still([150, 150, 0]),
        a: anim([[0, [-92, 0, 0]], [P, [-92, 0, 0]]], [0, 0, 1, 1]),
        r: anim([[0, 0], [P, 360]], [0, 0, 1, 1]),
      },
    }),
  ];
  return comp({ name: 'Orbit', w: 300, h: 300, duration: DUR, layers });
}

/* ----------------------------------------------------------------- write */

const scenes = {
  'dawn.json': sceneDawn(),
  'midday.json': sceneMidday(),
  'dusk.json': sceneDusk(),
  'night.json': sceneNight(),
  'orbit.json': sceneOrbit(),
};

for (const [file, data] of Object.entries(scenes)) {
  validate(file, data);
  const json = JSON.stringify(data);
  writeFileSync(join(OUT, file), json);
  console.log(
    file.padEnd(13),
    `${data.w}x${data.h}`.padEnd(10),
    `${(data.op / data.fr).toFixed(1)}s`.padEnd(6),
    `${data.layers.length} layers`.padEnd(12),
    `${(json.length / 1024).toFixed(0)} KB`,
  );
}
