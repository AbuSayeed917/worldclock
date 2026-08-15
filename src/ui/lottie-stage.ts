/**
 * Lottie mounting, done defensively.
 *
 * Three things this guards against, in order of how often they actually bite:
 *
 *  1. Cost — the player is ~250KB, so it is dynamically imported and only when
 *     an animation actually scrolls into view. A visitor who never reaches the
 *     rail never downloads it.
 *  2. Failure — if the import or the JSON fetch fails, the stage keeps its CSS
 *     fallback illustration instead of collapsing to an empty box.
 *  3. Motion sensitivity — `prefers-reduced-motion` holds the animation on a
 *     representative frame rather than playing it.
 */

export interface StageOptions {
  /** Path to the animation JSON, relative to the site base. */
  src: string;
  /** Accessible description; the stage is decorative if omitted. */
  label?: string;
  /** Frame to hold when motion is reduced. */
  posterFrame?: number;
  /**
   * SVG preserveAspectRatio for the rendered animation. The default letterboxes;
   * `xMidYMax slice` fills the box and crops, anchored to the bottom, which is
   * what a ground-level scene wants inside a wide banner.
   */
  fit?: string;
}

export interface Stage {
  el: HTMLElement;
  /** Swap in a different animation, reusing the same container. */
  setSource(src: string, label?: string): void;
  destroy(): void;
}

type LottieAnimation = { destroy(): void; goToAndStop(v: number, isFrame?: boolean): void };

const prefersReducedMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createStage({
  src,
  label,
  posterFrame = 0,
  fit = 'xMidYMid meet',
}: StageOptions): Stage {
  let source = src;
  const el = document.createElement('div');
  el.className = 'stage is-pending';

  if (label) {
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', label);
  } else {
    el.setAttribute('aria-hidden', 'true');
  }

  // The fallback lives in the DOM from the start and is hidden by CSS once the
  // animation reports success. Building it the other way round — inserting a
  // fallback on error — leaves an empty hole during the load.
  const fallback = document.createElement('div');
  fallback.className = 'stage-fallback';
  fallback.innerHTML = FALLBACK_MARKUP;
  el.append(fallback);

  let animation: LottieAnimation | null = null;
  let destroyed = false;
  let started = false;
  /**
   * Guards against two mounts racing. `setSource` can be called before the
   * observer has fired, and without this token both paths would each load a
   * player into the same container, leaving two stacked SVGs.
   */
  let mountToken = 0;

  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      if (started) return;
      void mount();
    },
    { rootMargin: '200px' },
  );
  observer.observe(el);

  async function mount(): Promise<void> {
    if (destroyed) return;
    started = true;
    const token = ++mountToken;
    try {
      const { default: lottie } = await import('lottie-web');
      // A newer mount superseded this one while the import was in flight.
      if (destroyed || token !== mountToken) return;

      const reduced = prefersReducedMotion();
      animation = lottie.loadAnimation({
        container: el,
        renderer: 'svg',
        loop: !reduced,
        autoplay: !reduced,
        path: new URL(source, document.baseURI).href,
        rendererSettings: {
          preserveAspectRatio: fit,
          progressiveLoad: true,
        },
      }) as unknown as LottieAnimation;

      const player = animation as unknown as {
        addEventListener(name: string, cb: () => void): void;
      };

      player.addEventListener('DOMLoaded', () => {
        if (destroyed) return;
        el.classList.remove('is-pending');
        el.classList.add('is-ready');
        if (reduced) animation?.goToAndStop(posterFrame, true);
      });

      player.addEventListener('data_failed', () => {
        el.classList.remove('is-pending');
        el.classList.add('is-failed');
      });
    } catch {
      // Import failed — offline, blocked, or a bad build. The fallback stays.
      el.classList.remove('is-pending');
      el.classList.add('is-failed');
    }
  }

  /**
   * Replace the animation in place. Used by the hero, which swaps between the
   * dawn, midday and night scenes as the sun crosses a phase boundary — or as
   * the terminator strip is scrubbed across one.
   */
  function setSource(next: string, nextLabel?: string): void {
    if (next === source) return;
    source = next;
    if (nextLabel) el.setAttribute('aria-label', nextLabel);

    // Not mounted yet: just record the new source and let the observer load it.
    // Mounting here instead would defeat the lazy loading entirely.
    if (!started) return;

    animation?.destroy();
    animation = null;

    // Clear the player's SVG but keep the fallback element intact.
    for (const child of [...el.children]) {
      if (child !== fallback) child.remove();
    }

    el.classList.remove('is-ready', 'is-failed');
    el.classList.add('is-pending');
    void mount();
  }

  function destroy(): void {
    destroyed = true;
    observer.disconnect();
    animation?.destroy();
    animation = null;
  }

  return { el, setSource, destroy };
}

/**
 * The CSS-only stand-in: a sun, a horizon and a drifting cloud built from
 * gradients. Not a replica of the Lottie scene, just something composed enough
 * that a failed load still looks deliberate.
 */
const FALLBACK_MARKUP = `
  <div class="fb-sky" aria-hidden="true">
    <div class="fb-orb"></div>
    <div class="fb-cloud fb-cloud-a"></div>
    <div class="fb-cloud fb-cloud-b"></div>
    <div class="fb-horizon"></div>
  </div>
`;
