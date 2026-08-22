/**
 * Optional Rive-backed sky.
 *
 * The custom `sky.riv` specified in docs/rive-sky-spec.md does not exist yet, so
 * this module is built to be inert until it does. Nothing here downloads unless
 * the file is actually present:
 *
 *  - The runtime is dynamically imported, so it stays in its own chunk and is
 *    never fetched otherwise. Rive's wasm alone is 745 KB gzipped, roughly three
 *    times the site's entire animation payload, so it must not load on spec.
 *  - The file is probed before the runtime is touched.
 *
 * If the file is present but does not honour the naming contract, this rejects
 * it and the caller keeps the SVG sky. A file that loads but exposes no drivable
 * inputs is worse than no file: it would look right while silently ignoring the
 * sun, which is the entire point of the page.
 */

import type { SolarSnapshot } from '../core/solar';

/** Must match docs/rive-sky-spec.md exactly. */
const CONTRACT = {
  manifest: 'rive/manifest.json',
  file: 'rive/sky.riv',
  wasm: 'rive/rive.wasm',
  artboard: 'Sky',
  stateMachine: 'SkyMachine',
  inputs: { elevation: 'solarElevation', arc: 'sunArc', polar: 'isPolar' },
} as const;

export interface RiveSky {
  el: HTMLCanvasElement;
  update(sun: SolarSnapshot, instant: Date): void;
  destroy(): void;
}

type NumberInput = { value: number };
type BoolInput = { value: boolean };

/** Resolved once per page load, not once per card. */
let availability: Promise<boolean> | null = null;

/**
 * The file itself, fetched once and shared.
 *
 * Each card builds its own Rive instance, but they can all be constructed from
 * one ArrayBuffer. Passing `src` instead made every card issue its own request.
 */
let sharedFile: Promise<ArrayBuffer | null> | null = null;

function loadFile(): Promise<ArrayBuffer | null> {
  if (!sharedFile) {
    sharedFile = fetch(new URL(CONTRACT.file, document.baseURI))
      .then((res) => (res.ok ? res.arrayBuffer() : null))
      .catch(() => null);
  }
  return sharedFile;
}

/**
 * Is the file there?
 *
 * A tiny manifest is read rather than probing sky.riv directly. Probing would
 * log a 404 on every page load for as long as the file does not exist, which is
 * noise in the network panel and in any automated check that treats a failed
 * request as a failure. The manifest always resolves.
 */
export function riveSkyAvailable(): Promise<boolean> {
  if (!availability) {
    availability = fetch(new URL(CONTRACT.manifest, document.baseURI))
      .then((res) => (res.ok ? res.json() : null))
      .then((m: { sky?: unknown } | null) => m?.sky === true)
      .catch(() => false);
  }
  return availability;
}

export async function createRiveSky(): Promise<RiveSky | null> {
  if (!(await riveSkyAvailable())) return null;

  let rive: typeof import('@rive-app/canvas');
  try {
    rive = await import('@rive-app/canvas');
  } catch {
    return null;
  }

  // Self-hosted so the page has no third-party runtime dependency. Run
  // `npm run rive:enable` to place the wasm alongside the .riv.
  rive.RuntimeLoader.setWasmUrl(new URL(CONTRACT.wasm, document.baseURI).href);

  const buffer = await loadFile();
  if (!buffer) {
    warnOnce(`could not fetch ${CONTRACT.file}`);
    return null;
  }

  const el = document.createElement('canvas');
  el.className = 'sky sky-rive';
  el.setAttribute('aria-hidden', 'true');

  const instance = await new Promise<InstanceType<typeof rive.Rive> | null>((resolve) => {
    const timer = setTimeout(() => resolve(null), 10_000);
    const r = new rive.Rive({
      canvas: el,
      // A copy per instance: Rive takes ownership of the buffer it is given.
      buffer: buffer.slice(0),
      artboard: CONTRACT.artboard,
      stateMachines: CONTRACT.stateMachine,
      autoplay: true,
      onLoad: () => {
        clearTimeout(timer);
        r.resizeDrawingSurfaceToCanvas();
        resolve(r);
      },
      onLoadError: () => {
        clearTimeout(timer);
        resolve(null);
      },
    });
  });

  if (!instance) {
    // Overwhelmingly this means the artboard or state machine is not named as
    // the contract requires. Saying so beats failing silently, which is the
    // trap the spec exists to avoid.
    warnOnce(
      `loaded but could not start. Expected artboard "${CONTRACT.artboard}" and ` +
        `state machine "${CONTRACT.stateMachine}". Check the names against ` +
        `docs/rive-sky-spec.md, then run: node scripts/preview-rive.mjs public/rive`,
    );
    return null;
  }

  const found = instance.stateMachineInputs(CONTRACT.stateMachine) ?? [];
  const byName = (name: string) => found.find((i) => i.name === name);

  const elevation = byName(CONTRACT.inputs.elevation) as NumberInput | undefined;
  const arc = byName(CONTRACT.inputs.arc) as NumberInput | undefined;
  const polar = byName(CONTRACT.inputs.polar) as BoolInput | undefined;

  // Reject rather than degrade. Acceptance check 1 in the spec.
  if (!elevation || !arc || !polar) {
    const missing = Object.values(CONTRACT.inputs).filter((n) => !byName(n));
    warnOnce(
      `state machine "${CONTRACT.stateMachine}" exposes no drivable input(s): ` +
        `${missing.join(', ')}. The file would play back while ignoring the sun, ` +
        `which defeats the point. See docs/rive-sky-spec.md.`,
    );
    instance.cleanup();
    return null;
  }

  let observer: ResizeObserver | null = new ResizeObserver(() =>
    instance.resizeDrawingSurfaceToCanvas(),
  );
  observer.observe(el);

  return {
    el,
    update(sun: SolarSnapshot, instant: Date): void {
      elevation.value = sun.elevation;

      const isPolar = !sun.sunrise || !sun.sunset;
      polar.value = isPolar;

      if (isPolar) {
        // With no sunrise there is nothing to measure a fraction against;
        // the spec has the file park the disc mid-arc and ignore this.
        arc.value = 0.5;
        return;
      }

      const rise = sun.sunrise!.getTime();
      const set = sun.sunset!.getTime();
      const span = set - rise;
      arc.value = span > 0 ? clamp01((instant.getTime() - rise) / span) : 0.5;
    },
    destroy(): void {
      observer?.disconnect();
      observer = null;
      instance.cleanup();
    },
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** One message per page load, not one per card. */
let warned = false;
function warnOnce(reason: string): void {
  if (warned) return;
  warned = true;
  console.warn(`[sky.riv] ignored — ${reason} Falling back to the SVG sky.`);
}
