/**
 * Mounts a Rive animation, lazily.
 *
 * Deliberately mirrors lottie-stage's shape so the two are interchangeable at a
 * call site, but the cost profile is different and drives the design:
 *
 *  - The runtime is ~397 KB gzipped (`canvas-lite`, less than half the full
 *    build and visually identical for these files). That is paid once for the
 *    whole page, so the module resolves it exactly once and shares it.
 *  - Every mount waits for the element to approach the viewport, so a visitor
 *    who never scrolls past the hero never pays for it at all.
 *  - `.riv` files are fetched once each and shared as buffers, even when the
 *    same file is mounted in several places.
 */

const WASM_URL = 'rive/rive.wasm';

export interface RiveStageOptions {
  /** Path to the .riv, relative to the site base. */
  src: string;
  /** Accessible description; the stage is decorative if omitted. */
  label?: string;
  /** Artboard to show. Defaults to the file's first. */
  artboard?: string;
  /** Animation or state machine to run. Defaults to the first animation. */
  animation?: string;
  stateMachine?: string;
  /** How the artboard fits its box. */
  fit?: 'contain' | 'cover' | 'fill';
}

export interface RiveStage {
  el: HTMLElement;
  destroy(): void;
}

type RiveModule = typeof import('@rive-app/canvas-lite');

/** One runtime for the whole page, resolved on first use. */
let runtime: Promise<RiveModule | null> | null = null;

function loadRuntime(): Promise<RiveModule | null> {
  if (!runtime) {
    runtime = import('@rive-app/canvas-lite')
      .then((mod) => {
        // Self-hosted: no third-party CDN in the critical path.
        mod.RuntimeLoader.setWasmUrl(new URL(WASM_URL, document.baseURI).href);
        return mod;
      })
      .catch(() => null);
  }
  return runtime;
}

/** Each .riv fetched once, however many places mount it. */
const files = new Map<string, Promise<ArrayBuffer | null>>();

function loadFile(src: string): Promise<ArrayBuffer | null> {
  let pending = files.get(src);
  if (!pending) {
    pending = fetch(new URL(src, document.baseURI))
      .then((res) => (res.ok ? res.arrayBuffer() : null))
      .catch(() => null);
    files.set(src, pending);
  }
  return pending;
}

export function createRiveStage(options: RiveStageOptions): RiveStage {
  const el = document.createElement('div');
  el.className = 'stage rive-stage is-pending';

  if (options.label) {
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', options.label);
  } else {
    el.setAttribute('aria-hidden', 'true');
  }

  const canvas = document.createElement('canvas');
  el.append(canvas);

  let instance: { cleanup(): void; resizeDrawingSurfaceToCanvas(): void } | null = null;
  let resize: ResizeObserver | null = null;
  let destroyed = false;
  let started = false;

  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting) || started) return;
      started = true;
      observer.disconnect();
      void mount();
    },
    { rootMargin: '250px' },
  );
  observer.observe(el);

  async function mount(): Promise<void> {
    const [rive, buffer] = await Promise.all([loadRuntime(), loadFile(options.src)]);
    if (destroyed || !rive || !buffer) {
      el.classList.remove('is-pending');
      el.classList.add('is-failed');
      return;
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const r = new rive.Rive({
      canvas,
      // Rive takes ownership of the buffer it is handed, so each mount gets
      // its own copy of the shared bytes.
      buffer: buffer.slice(0),
      artboard: options.artboard,
      animations: options.animation,
      stateMachines: options.stateMachine,
      autoplay: !reduced,
      layout: new rive.Layout({
        fit: (rive.Fit[options.fit === 'cover' ? 'Cover' : options.fit === 'fill' ? 'Fill' : 'Contain']),
        alignment: rive.Alignment.Center,
      }),
      onLoad: () => {
        if (destroyed) {
          r.cleanup();
          return;
        }
        instance = r;
        r.resizeDrawingSurfaceToCanvas();
        el.classList.remove('is-pending');
        el.classList.add('is-ready');

        // The canvas backing store must track its CSS box or the art renders
        // at the wrong resolution and looks soft.
        resize = new ResizeObserver(() => r.resizeDrawingSurfaceToCanvas());
        resize.observe(el);
      },
      onLoadError: () => {
        el.classList.remove('is-pending');
        el.classList.add('is-failed');
      },
    });
  }

  return {
    el,
    destroy(): void {
      destroyed = true;
      observer.disconnect();
      resize?.disconnect();
      resize = null;
      instance?.cleanup();
      instance = null;
    },
  };
}
