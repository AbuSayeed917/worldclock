/**
 * Composes Open Peeps atoms into animated Lottie characters.
 *
 * Open Peeps ships headless bodies and separate heads, so a character is a
 * body + head + face stacked in a shared space. Two facts make that reliable:
 *
 *  - Every atom is normalised by its measured *ink* box, not its viewBox. The
 *    viewBox is loose padding from Sketch and differs per atom, so anchoring to
 *    it puts heads through shoulders.
 *  - Figures are anchored by their ground point (feet at y = 0, centred on x),
 *    which is the only anchor that stays put across poses of different heights.
 *
 * The artwork is two-tone — one black path, one white path — so remapping those
 * two colours is enough to give every character its own skin, hair and clothes.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { svgToLottieGroups } from './svg-to-lottie.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const METRICS = JSON.parse(readFileSync(join(ROOT, 'assets/peeps/metrics.json'), 'utf8'));

const cache = new Map();
function atom(kind, name) {
  const key = `${kind}/${name}`;
  if (!cache.has(key)) {
    cache.set(key, readFileSync(join(ROOT, 'assets/peeps', kind, `${name}.svg`), 'utf8'));
  }
  return cache.get(key);
}

function metrics(kind, name) {
  const m = METRICS[kind]?.[name];
  if (!m) throw new Error(`no measurements for ${kind}/${name} — run scripts/measure-peeps.mjs`);
  return m;
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

let layerIndex = 0;
export function resetLayerIndex(value = 0) {
  layerIndex = value;
}

function shapeLayer(shapes, { name, ks = {}, parent } = {}) {
  const layer = {
    ddd: 0,
    ind: ++layerIndex,
    ty: 4,
    nm: name,
    sr: 1,
    ks: {
      o: ks.o ?? still(100),
      r: ks.r ?? still(0),
      p: ks.p ?? still([0, 0, 0]),
      a: ks.a ?? still([0, 0, 0]),
      s: ks.s ?? still([100, 100, 100]),
    },
    ao: 0,
    shapes,
    ip: 0,
    st: 0,
    bm: 0,
  };
  if (parent !== undefined) layer.parent = parent;
  return layer;
}

/**
 * Build one character.
 *
 * `x` and `groundY` place the figure's feet. `height` is the body's ink height
 * in composition units; the head is scaled from the same ratio the artwork was
 * drawn at, so proportions stay native rather than guessed.
 */
export function peep({
  pose,
  head,
  face,
  x,
  groundY,
  height = 220,
  skin = '#F0C9A8',
  hair = '#2B2140',
  clothes = '#E8825B',
  ink = '#241C3A',
  flip = false,
  // Motion
  bob = 0,
  bobPeriod = 120,
  sway = 0,
  headTilt = 0,
  phase = 0,
  opacity = 100,
  name = 'peep',
}) {
  const poseM = metrics('pose', pose);
  const headM = metrics('head', head);
  const faceM = face ? metrics('face', face) : null;

  const poseInk = poseM.bbox;
  const headInk = headM.bbox;

  // Native proportion between head and body, preserved exactly.
  const headHeight = height * (headInk.h / poseInk.h);

  const poseGroups = svgToLottieGroups(atom('pose', pose), {
    targetHeight: height,
    inkBox: poseInk,
    palette: { '#FFFFFF': clothes, '#000000': ink },
  });

  const headGroups = svgToLottieGroups(atom('head', head), {
    targetHeight: headHeight,
    inkBox: headInk,
    palette: { '#FFFFFF': skin, '#000000': hair },
  });

  // Where the collar sits, in composition units relative to the ground point.
  const scale = height / poseInk.h;
  const collarBand = poseM.topBand ?? { min: poseInk.x, max: poseInk.x + poseInk.w };
  const collarCentreSvg = (collarBand.min + collarBand.max) / 2;
  const collarX = (collarCentreSvg - (poseInk.x + poseInk.w / 2)) * scale;
  const collarY = (poseInk.y + poseInk.h * 0.02 - (poseInk.y + poseInk.h)) * scale;

  // Tuck the head into the collar rather than resting it on top.
  const headX = x + (flip ? -collarX : collarX);
  const headY = groundY + collarY + headHeight * 0.13;

  const bobKeys = (amplitude, offset = 0) =>
    amplitude
      ? anim([
          [phase, [0, offset]],
          [phase + bobPeriod / 2, [0, offset - amplitude]],
          [phase + bobPeriod, [0, offset]],
        ])
      : null;

  const layers = [];

  // Body first in the array means body paints in front of the head, so the head
  // is added first — Lottie paints earlier layers on top.
  const headLayerShapes = [...headGroups];

  if (faceM) {
    // The face is drawn in its own small space; scale it against the head the
    // same way the head is scaled against the body.
    const faceHeight = headHeight * (faceM.bbox.h / headInk.h);
    const faceGroups = svgToLottieGroups(atom('face', face), {
      targetHeight: faceHeight,
      inkBox: faceM.bbox,
      palette: { '#FFFFFF': skin, '#000000': ink },
    });
    // Faces sit slightly above the head's ground line, roughly on the muzzle.
    for (const g of faceGroups) {
      g.it[g.it.length - 1].p = still([headHeight * 0.06, -headHeight * 0.26]);
    }
    headLayerShapes.unshift(...faceGroups);
  }

  const headLayer = shapeLayer(headLayerShapes, {
    name: `${name}-head`,
    ks: {
      p: still([headX, headY, 0]),
      s: still([flip ? -100 : 100, 100, 100]),
      r: headTilt
        ? anim([
            [phase, 0],
            [phase + bobPeriod * 0.5, headTilt],
            [phase + bobPeriod, 0],
          ])
        : still(0),
      o: still(opacity),
    },
  });

  const bodyKeys = bobKeys(bob);
  const bodyLayer = shapeLayer(poseGroups, {
    name: `${name}-body`,
    ks: {
      p: bodyKeys
        ? anim(
            bodyKeys.k.map((f) => [f.t, [x + (sway ? 0 : 0), groundY + f.s[1], 0]]),
          )
        : still([x, groundY, 0]),
      s: still([flip ? -100 : 100, 100, 100]),
      r: sway
        ? anim([
            [phase, -sway],
            [phase + bobPeriod / 2, sway],
            [phase + bobPeriod, -sway],
          ])
        : still(0),
      a: still([0, 0, 0]),
      o: still(opacity),
    },
  });

  // Keep the head riding on the body's bob by applying the same vertical offset.
  if (bodyKeys) {
    headLayer.ks.p = anim(bodyKeys.k.map((f) => [f.t, [headX, headY + f.s[1], 0]]));
  }

  layers.push(headLayer, bodyLayer);
  return layers;
}

/**
 * A walk cycle built from the three walking poses.
 *
 * Open Peeps draws walking-1/2/3 as distinct stances, so cross-cutting between
 * them on a short interval reads as a real gait — far better than rotating a
 * rectangle around a hip joint. Each frame is a full character whose opacity is
 * switched on for its slice of the cycle.
 */
export function walkCycle({
  x,
  groundY,
  height = 220,
  period = 36,
  phase = 0,
  ...rest
}) {
  const frames = ['walking-1', 'walking-2', 'walking-3'];
  const slice = period / frames.length;
  const layers = [];

  // The head is identical across the three stances, so it is built once and
  // left on screen. Duplicating it per frame tripled the hair geometry — the
  // single largest contributor to file size — for no visible difference.
  const [sharedHead] = peep({ ...rest, pose: frames[0], x, groundY, height, bob: 0, name: 'walk' });
  layers.push(sharedHead);

  frames.forEach((pose, index) => {
    const start = phase + index * slice;
    // Hold each stance for exactly its slice, using hold keyframes so the swap
    // is a cut. A dissolve between stances looks like a double exposure.
    const cycle = [];
    for (let repeat = 0; repeat < 24; repeat++) {
      const base = start + repeat * period;
      cycle.push([base, 100], [base + slice, 0]);
    }

    const built = peep({ ...rest, pose, x, groundY, height, bob: 0, name: `walk${index}` });
    const body = built[1];
    body.ks.o = { a: 1, k: cycle.map(([t, s]) => ({ t, s: [s], h: 1 })) };
    layers.push(body);
  });

  return layers;
}
