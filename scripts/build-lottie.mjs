/**
 * Generates the site's Lottie animations as Bodymovin-compatible JSON.
 *
 * Written by hand rather than downloaded so the repository carries no
 * third-party asset licences. Output goes to public/lottie/ and is played by
 * lottie-web exactly like any downloaded animation would be.
 *
 * Style target: flat editorial vector illustration — the App Store Today card
 * look. Characters are built from circles and rounded rectangles, with limbs
 * animated by rotating groups about their joints.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public/lottie');
mkdirSync(OUT, { recursive: true });

const FPS = 60;

// ---------------------------------------------------------------- primitives

/** Lottie stores colour channels as 0-1 floats, not 0-255 bytes. */
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

/**
 * Animated property. `keys` is [[frame, value], ...]; values may be numbers or
 * arrays. Bezier easing on every segment keeps motion from looking robotic.
 */
function anim(keys, ease = [0.42, 0, 0.58, 1]) {
  const [ox, oy, ix, iy] = ease;
  const out = keys.map(([t, v], idx) => {
    const value = Array.isArray(v) ? v : [v];
    const frame = { t, s: value };
    if (idx < keys.length - 1) {
      frame.i = { x: [ix], y: [iy] };
      frame.o = { x: [ox], y: [oy] };
    }
    return frame;
  });
  return { a: 1, k: out };
}

const ellipse = (w, h, p = [0, 0]) => ({ ty: 'el', p: still(p), s: still([w, h]), nm: 'el' });

const rect = (w, h, r = 0, p = [0, 0]) => ({
  ty: 'rc',
  p: still(p),
  s: still([w, h]),
  r: still(r),
  nm: 'rc',
});

const fill = (hex, opacity = 100) => ({
  ty: 'fl',
  c: still(rgb(hex)),
  o: still(opacity),
  r: 1,
  nm: 'fill',
});

const stroke = (hex, width, opacity = 100) => ({
  ty: 'st',
  c: still(rgb(hex)),
  o: still(opacity),
  w: still(width),
  lc: 2,
  lj: 2,
  nm: 'stroke',
});

/** Free-form bezier path. `pts` are [x, y]; tangents default to straight lines. */
function path(pts, closed = false, tangents = null) {
  const i = tangents ? tangents.map((t) => t[0]) : pts.map(() => [0, 0]);
  const o = tangents ? tangents.map((t) => t[1]) : pts.map(() => [0, 0]);
  return { ty: 'sh', ks: still({ i, o, v: pts, c: closed }), nm: 'path' };
}

/** Group transform. Anchor doubles as the pivot for any rotation. */
const tr = ({ p = [0, 0], a = [0, 0], s = [100, 100], r = 0, o = 100 } = {}) => ({
  ty: 'tr',
  p: Array.isArray(p) ? still(p) : p,
  a: still(a),
  s: Array.isArray(s) ? still(s) : s,
  r: typeof r === 'number' ? still(r) : r,
  o: typeof o === 'number' ? still(o) : o,
  nm: 'transform',
});

const group = (items, transform = tr(), name = 'group') => ({
  ty: 'gr',
  it: [...items, transform],
  nm: name,
});

let layerIndex = 0;

function shapeLayer(shapes, { name = 'layer', ks = {}, ip = 0, op } = {}) {
  return {
    ddd: 0,
    ind: ++layerIndex,
    ty: 4,
    nm: name,
    sr: 1,
    ks: {
      o: ks.o !== undefined ? (typeof ks.o === 'number' ? still(ks.o) : ks.o) : still(100),
      r: ks.r !== undefined ? (typeof ks.r === 'number' ? still(ks.r) : ks.r) : still(0),
      p: ks.p ?? still([0, 0, 0]),
      a: ks.a ?? still([0, 0, 0]),
      s: ks.s ?? still([100, 100, 100]),
    },
    ao: 0,
    shapes,
    ip,
    op,
    st: 0,
    bm: 0,
  };
}

function comp({ name, w, h, duration, layers }) {
  const op = Math.round(duration * FPS);

  // Backfill each layer's out-point. A layer without `op` is never active, so
  // it loads without error and renders absolutely nothing — the quietest
  // possible failure mode in this format.
  for (const layer of layers) {
    if (layer.op === undefined) layer.op = op;
    if (layer.ip === undefined) layer.ip = 0;
  }

  return {
    v: '5.12.2',
    fr: FPS,
    ip: 0,
    op,
    w,
    h,
    nm: name,
    ddd: 0,
    assets: [],
    layers,
  };
}

/**
 * Sanity check before writing. These are the invariants that separate a Lottie
 * that renders from one that silently does not.
 */
function validate(name, data) {
  const problems = [];
  if (!data.layers.length) problems.push('no layers');

  data.layers.forEach((layer, i) => {
    const where = `layer ${i} (${layer.nm})`;
    if (typeof layer.op !== 'number') problems.push(`${where}: missing op`);
    if (typeof layer.ip !== 'number') problems.push(`${where}: missing ip`);
    if (layer.op <= layer.ip) problems.push(`${where}: op <= ip`);
    if (typeof layer.ind !== 'number') problems.push(`${where}: missing ind`);
    if (!layer.ks?.p) problems.push(`${where}: missing transform position`);
    if (layer.ty === 4 && !layer.shapes?.length) problems.push(`${where}: no shapes`);
  });

  // External image references break on a static host and are the single most
  // common reason a downloaded Lottie renders as an empty box.
  if ((data.assets ?? []).some((asset) => asset.p)) {
    problems.push('references external images');
  }

  if (problems.length) {
    throw new Error(`${name} failed validation:\n  - ${problems.join('\n  - ')}`);
  }
}

// ------------------------------------------------------------------ palettes

const IVORY = '#F6EFE4';
const CLAY = '#E8825B';
const PLUM = '#6B4E8F';
const TEAL = '#2E8C8C';
const AMBER = '#F5A93F';
const NIGHT = '#2A2C52';
const SKIN_A = '#E8B08A';
const SKIN_B = '#9A5F44';
const SKIN_C = '#F0C9A8';

// ------------------------------------------------------------------- figures

/**
 * A standing figure. Limbs are groups anchored at shoulder and hip so a single
 * rotation property swings the whole limb naturally.
 */
function figure({
  x,
  y,
  scale = 100,
  skin = SKIN_A,
  top = CLAY,
  legs = NIGHT,
  hair = '#2B2140',
  armSwing = 0,
  legSwing = 0,
  bob = 0,
  period = 120,
}) {
  const swing = (amp, phase = 0) =>
    amp === 0
      ? 0
      : anim([
          [0, phase],
          [period / 2, phase + amp],
          [period, phase],
        ]);

  const bobY = bob
    ? anim([
        [0, [0, 0]],
        [period / 4, [0, -bob]],
        [period / 2, [0, 0]],
        [(period * 3) / 4, [0, -bob]],
        [period, [0, 0]],
      ])
    : still([0, 0]);

  // Order is front-to-back: Lottie paints the FIRST item in a group on top, the
  // same convention After Effects uses for its layer stack. Listing the body
  // bottom-up — the intuitive order — buries the arms behind the torso and the
  // head behind the shoulders.
  const parts = [
    // Front arm, nearest the viewer and swinging across the body.
    group(
      [rect(9, 40, 4.5, [0, 20]), fill(skin)],
      tr({ p: [17, -38], a: [0, 0], r: swing(armSwing, -armSwing / 2) }),
      'arm-front',
    ),
    group([ellipse(32, 22, [0, -74]), fill(hair)], tr(), 'hair'),
    group([ellipse(30, 32, [0, -66]), fill(skin)], tr(), 'head'),
    group([rect(9, 10, 4, [0, -46]), fill(skin)], tr(), 'neck'),
    // Torso sits behind the near arm but in front of the far one.
    group([rect(34, 46, 14, [0, -22]), fill(top)], tr(), 'torso'),
    group(
      [rect(11, 46, 5.5, [0, 23]), fill(legs)],
      tr({ p: [5, 0], a: [0, 0], r: swing(-legSwing, legSwing / 2) }),
      'leg-front',
    ),
    // Far side of the body, shaded down so the figure reads as having depth.
    group(
      [rect(9, 40, 4.5, [0, 20]), fill(top, 74)],
      tr({ p: [-17, -38], a: [0, 0], r: swing(-armSwing, armSwing / 2) }),
      'arm-back',
    ),
    group(
      [rect(11, 46, 5.5, [0, 23]), fill(legs, 76)],
      tr({ p: [-5, 0], a: [0, 0], r: swing(legSwing, -legSwing / 2) }),
      'leg-back',
    ),
  ];

  return shapeLayer([group(parts, tr({ p: bobY }), 'figure')], {
    name: 'figure',
    ks: { p: still([x, y, 0]), s: still([scale, scale, 100]) },
  });
}

/** Radiating sun with a slow rotation on the ray ring. */
function sun({ x, y, r = 34, color = AMBER, rays = 12, spin = 600, rayLen = 16 }) {
  const rayShapes = [];
  for (let i = 0; i < rays; i++) {
    const angle = (i / rays) * Math.PI * 2;
    const inner = r + 10;
    const outer = inner + rayLen;
    rayShapes.push(
      group(
        [
          path([
            [Math.cos(angle) * inner, Math.sin(angle) * inner],
            [Math.cos(angle) * outer, Math.sin(angle) * outer],
          ]),
          stroke(color, 5, 85),
        ],
        tr(),
        `ray-${i}`,
      ),
    );
  }

  return [
    shapeLayer([group(rayShapes, tr(), 'rays')], {
      name: 'sun-rays',
      ks: {
        p: still([x, y, 0]),
        r: anim(
          [
            [0, 0],
            [spin, 360],
          ],
          [0, 0, 1, 1],
        ),
      },
    }),
    shapeLayer([group([ellipse(r * 2, r * 2), fill(color)], tr(), 'disc')], {
      name: 'sun-disc',
      ks: {
        p: still([x, y, 0]),
        s: anim([
          [0, [100, 100]],
          [90, [106, 106]],
          [180, [100, 100]],
        ]),
      },
    }),
  ];
}

/** Twinkling star field. Each star gets its own phase so they never blink in unison. */
function stars({ count, w, h, color = IVORY, seed = 7 }) {
  let s = seed;
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };

  const layers = [];
  for (let i = 0; i < count; i++) {
    const x = rand() * w;
    const y = rand() * h * 0.62;
    const size = 2 + rand() * 3.4;
    const phase = Math.floor(rand() * 120);
    layers.push(
      shapeLayer([group([ellipse(size, size), fill(color)], tr(), 'star')], {
        name: `star-${i}`,
        ks: {
          p: still([x, y, 0]),
          o: anim([
            [phase, 22],
            [phase + 60, 96],
            [phase + 120, 22],
          ]),
        },
      }),
    );
  }
  return layers;
}

/** Drifting cloud built from overlapping discs. */
function cloud({ x, y, scale = 100, color = IVORY, opacity = 90, drift = 26, period = 480 }) {
  const puffs = [
    group([ellipse(58, 58, [-26, 4]), fill(color, opacity)], tr(), 'puff-a'),
    group([ellipse(76, 76, [8, -6]), fill(color, opacity)], tr(), 'puff-b'),
    group([ellipse(52, 52, [42, 6]), fill(color, opacity)], tr(), 'puff-c'),
    group([rect(110, 34, 17, [8, 16]), fill(color, opacity)], tr(), 'base'),
  ];

  return shapeLayer([group(puffs, tr(), 'cloud')], {
    name: 'cloud',
    ks: {
      s: still([scale, scale, 100]),
      p: anim([
        [0, [x, y, 0]],
        [period / 2, [x + drift, y - 5, 0]],
        [period, [x, y, 0]],
      ]),
    },
  });
}

// -------------------------------------------------------------------- scenes

function sceneDawn() {
  layerIndex = 0;
  const W = 640;
  const H = 400;
  const DURATION = 6;
  const P = DURATION * FPS;

  const layers = [];

  // Sun climbing out of the horizon over the whole loop.
  const sunLayers = sun({ x: 0, y: 0, r: 38, color: AMBER, rays: 14, spin: P * 2, rayLen: 18 });
  for (const layer of sunLayers) {
    layer.ks.p = anim([
      [0, [W * 0.82, H * 0.62, 0]],
      [P, [W * 0.82, H * 0.24, 0]],
    ]);
  }
  layers.push(...sunLayers);

  layers.push(cloud({ x: W * 0.56, y: H * 0.2, scale: 54, color: IVORY, opacity: 48, period: P * 2 }));
  layers.push(cloud({ x: W * 0.88, y: H * 0.42, scale: 38, color: IVORY, opacity: 32, drift: -20, period: P * 2 }));

  // Figure stretching: arms sweep up, body lifts onto toes.
  const stretcher = figure({
    x: W * 0.62,
    y: H * 0.8,
    scale: 104,
    skin: SKIN_A,
    top: CLAY,
    legs: PLUM,
    period: P,
  });
  layers.push(stretcher);

  // Override the arms with a stretch rather than a walk swing. Parts are found
  // by name rather than index so reordering the figure cannot silently break it.
  const body = stretcher.shapes[0].it;
  const armBack = body.find((g) => g.nm === 'arm-back');
  const armFront = body.find((g) => g.nm === 'arm-front');
  if (!armBack || !armFront) throw new Error('figure() no longer exposes named arm groups');
  const stretchUp = (dir) =>
    anim([
      [0, 0],
      [P * 0.35, dir * 155],
      [P * 0.65, dir * 155],
      [P, 0],
    ]);
  armBack.it[armBack.it.length - 1].r = stretchUp(1);
  armFront.it[armFront.it.length - 1].r = stretchUp(-1);

  // A coffee cup on the ground, steaming.
  layers.push(
    shapeLayer(
      [
        group([rect(26, 30, 4, [0, 0]), fill(IVORY)], tr(), 'cup'),
        group([rect(30, 6, 3, [0, -16]), fill(CLAY)], tr(), 'lid'),
      ],
      { name: 'cup', ks: { p: still([W * 0.86, H * 0.78, 0]) } },
    ),
  );
  for (let i = 0; i < 3; i++) {
    layers.push(
      shapeLayer(
        [group([path([[0, 0], [4, -14], [-3, -28], [2, -42]]), stroke(IVORY, 3, 70)], tr(), 'wisp')],
        {
          name: `steam-${i}`,
          ks: {
            p: still([W * 0.86 - 6 + i * 6, H * 0.78 - 18, 0]),
            o: anim([
              [i * 40, 0],
              [i * 40 + 60, 70],
              [i * 40 + 140, 0],
            ]),
          },
        },
      ),
    );
  }

  return comp({ name: 'Dawn', w: W, h: H, duration: DURATION, layers });
}

function sceneMidday() {
  layerIndex = 0;
  const W = 640;
  const H = 400;
  const DURATION = 4;
  const P = DURATION * FPS;

  const layers = [];
  layers.push(...sun({ x: W * 0.88, y: H * 0.17, r: 28, color: AMBER, rays: 12, spin: P * 3 }));
  layers.push(cloud({ x: W * 0.55, y: H * 0.18, scale: 58, opacity: 60, period: P * 2 }));
  layers.push(cloud({ x: W * 0.78, y: H * 0.36, scale: 40, opacity: 40, drift: -24, period: P * 2 }));

  // Three walkers at different scales — depth without a perspective grid.
  layers.push(
    figure({
      x: W * 0.52,
      y: H * 0.81,
      scale: 88,
      skin: SKIN_B,
      top: TEAL,
      legs: NIGHT,
      armSwing: 34,
      legSwing: 30,
      bob: 4,
      period: P * 0.55,
    }),
  );
  layers.push(
    figure({
      x: W * 0.7,
      y: H * 0.84,
      scale: 106,
      skin: SKIN_C,
      top: CLAY,
      legs: PLUM,
      hair: '#5B3A2E',
      armSwing: 40,
      legSwing: 36,
      bob: 5,
      period: P * 0.62,
    }),
  );
  layers.push(
    figure({
      x: W * 0.87,
      y: H * 0.79,
      scale: 82,
      skin: SKIN_A,
      top: PLUM,
      legs: NIGHT,
      hair: '#22304A',
      armSwing: 30,
      legSwing: 27,
      bob: 4,
      period: P * 0.5,
    }),
  );

  return comp({ name: 'Midday', w: W, h: H, duration: DURATION, layers });
}

function sceneNight() {
  layerIndex = 0;
  const W = 640;
  const H = 400;
  const DURATION = 6;
  const P = DURATION * FPS;

  const layers = [];
  layers.push(...stars({ count: 26, w: W, h: H, color: IVORY, seed: 19 }));

  // Crescent moon: a bright disc with a shadow disc nudged over it.
  layers.push(
    shapeLayer(
      [
        group([ellipse(72, 72), fill('#FFF4D6')], tr(), 'moon'),
        group([ellipse(60, 60, [18, -10]), fill('#0E1226')], tr(), 'shadow'),
      ],
      {
        name: 'moon',
        ks: {
          p: anim([
            [0, [W * 0.86, H * 0.2, 0]],
            [P / 2, [W * 0.86, H * 0.16, 0]],
            [P, [W * 0.86, H * 0.2, 0]],
          ]),
        },
      },
    ),
  );

  // Desk, laptop, seated figure.
  const deskY = H * 0.76;
  layers.push(
    shapeLayer(
      [
        group([rect(300, 12, 6), fill('#3C3560')], tr(), 'desktop'),
        group([rect(12, 70, 4, [-120, 41]), fill('#332C55')], tr(), 'leg-l'),
        group([rect(12, 70, 4, [120, 41]), fill('#332C55')], tr(), 'leg-r'),
      ],
      { name: 'desk', ks: { p: still([W * 0.68, deskY, 0]) } },
    ),
  );

  // Seated figure behind the desk. Legs are hidden, so only the torso shows.
  layers.push(
    shapeLayer(
      [
        group([rect(38, 54, 16, [0, -27]), fill(TEAL)], tr(), 'torso'),
        group([rect(9, 10, 4, [0, -54]), fill(SKIN_C)], tr(), 'neck'),
        group([ellipse(32, 34, [0, -74]), fill(SKIN_C)], tr(), 'head'),
        group([ellipse(34, 24, [0, -83]), fill('#241C3A')], tr(), 'hair'),
      ],
      {
        name: 'seated',
        ks: {
          p: still([W * 0.56, deskY, 0]),
          // A small nod, as if reading.
          r: anim([
            [0, 0],
            [P * 0.3, -3],
            [P * 0.6, 1],
            [P, 0],
          ]),
          a: still([0, -40, 0]),
        },
      },
    ),
  );

  // Laptop with a screen that pulses like it is refreshing.
  layers.push(
    shapeLayer(
      [
        group([rect(74, 46, 4, [0, -23]), fill('#4A4276')], tr(), 'lid'),
        group([rect(64, 36, 2, [0, -23]), fill(AMBER, 88)], tr(), 'screen'),
        group([rect(86, 8, 4, [0, 4]), fill('#5A5188')], tr(), 'base'),
      ],
      {
        name: 'laptop',
        ks: {
          p: still([W * 0.72, deskY, 0]),
          o: anim([
            [0, 100],
            [P * 0.5, 88],
            [P, 100],
          ]),
        },
      },
    ),
  );

  // A mug beside the laptop.
  layers.push(
    shapeLayer([group([rect(22, 26, 4), fill(CLAY)], tr(), 'mug')], {
      name: 'mug',
      ks: { p: still([W * 0.86, deskY - 13, 0]) },
    }),
  );

  return comp({ name: 'Night', w: W, h: H, duration: DURATION, layers });
}

/** Small ambient loop used as a section accent — a globe with an orbiting dot. */
function sceneOrbit() {
  layerIndex = 0;
  const W = 300;
  const H = 300;
  const DURATION = 8;
  const P = DURATION * FPS;
  const layers = [];

  layers.push(
    shapeLayer([group([ellipse(150, 150), stroke(TEAL, 4, 60)], tr(), 'globe')], {
      name: 'globe',
      ks: { p: still([150, 150, 0]) },
    }),
  );
  layers.push(
    shapeLayer([group([ellipse(150, 56), stroke(TEAL, 3, 38)], tr(), 'equator')], {
      name: 'equator',
      ks: { p: still([150, 150, 0]) },
    }),
  );
  layers.push(
    shapeLayer([group([ellipse(56, 150), stroke(TEAL, 3, 38)], tr(), 'meridian')], {
      name: 'meridian',
      ks: { p: still([150, 150, 0]) },
    }),
  );
  layers.push(
    shapeLayer([group([ellipse(18, 18), fill(AMBER)], tr(), 'satellite')], {
      name: 'satellite',
      ks: {
        p: still([150, 150, 0]),
        a: anim(
          [
            [0, [-92, 0, 0]],
            [P, [-92, 0, 0]],
          ],
          [0, 0, 1, 1],
        ),
        r: anim(
          [
            [0, 0],
            [P, 360],
          ],
          [0, 0, 1, 1],
        ),
      },
    }),
  );

  return comp({ name: 'Orbit', w: W, h: H, duration: DURATION, layers });
}

// --------------------------------------------------------------------- write

const scenes = {
  'dawn.json': sceneDawn(),
  'midday.json': sceneMidday(),
  'night.json': sceneNight(),
  'orbit.json': sceneOrbit(),
};

for (const [file, data] of Object.entries(scenes)) {
  validate(file, data);
  const json = JSON.stringify(data);
  writeFileSync(`${OUT}/${file}`, json);
  console.log(
    file.padEnd(14),
    `${data.w}x${data.h}`.padEnd(10),
    `${(data.op / data.fr).toFixed(1)}s`.padEnd(6),
    `${data.layers.length} layers`.padEnd(12),
    `${(json.length / 1024).toFixed(1)} KB`,
  );
}
