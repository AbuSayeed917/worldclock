/**
 * The hero starfield.
 *
 * Canvas rather than DOM: a few hundred twinkling nodes as elements would mean a
 * few hundred style recalculations per frame. On canvas it is one clear and a
 * few hundred arcs, which stays comfortably inside a frame budget even on a
 * phone. The whole layer fades out via --star-opacity as the sun comes up, so it
 * costs nothing visually during the day.
 */

interface Star {
  x: number; // 0-1, resolution independent
  y: number;
  radius: number;
  phase: number;
  speed: number;
}

interface Meteor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

export interface StarField {
  destroy(): void;
}

export function createStarField(canvas: HTMLCanvasElement, count = 220): StarField {
  const context = canvas.getContext('2d');
  if (!context) return { destroy: () => {} };

  let stars: Star[] = [];
  let meteors: Meteor[] = [];
  let width = 0;
  let height = 0;
  let raf = 0;
  let running = true;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function seed(): void {
    stars = Array.from({ length: count }, () => ({
      x: Math.random(),
      // Bias upward — stars near the horizon would sit behind the headline.
      y: Math.random() ** 1.6,
      radius: 0.35 + Math.random() * 1.15,
      phase: Math.random() * Math.PI * 2,
      speed: 0.4 + Math.random() * 1.1,
    }));
  }

  function resize(): void {
    const rect = canvas.getBoundingClientRect();
    // Cap the backing store at 2x. Beyond that the extra pixels are invisible
    // and the fill cost is real, especially on high-density phones.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context!.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw(time: number): void {
    if (!running) return;
    const ctx = context!;
    ctx.clearRect(0, 0, width, height);

    const t = time / 1000;
    for (const star of stars) {
      const twinkle = reducedMotion.matches
        ? 0.7
        : 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * star.speed + star.phase));
      ctx.globalAlpha = twinkle;
      ctx.beginPath();
      ctx.arc(star.x * width, star.y * height, star.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }

    if (!reducedMotion.matches) {
      // A meteor roughly every eight seconds, never more than two at once.
      if (meteors.length < 2 && Math.random() < 0.002) {
        meteors.push({
          x: Math.random() * width * 0.8,
          y: Math.random() * height * 0.4,
          vx: 220 + Math.random() * 160,
          vy: 90 + Math.random() * 70,
          life: 1,
        });
      }

      meteors = meteors.filter((m) => m.life > 0);
      for (const m of meteors) {
        m.life -= 0.014;
        m.x += m.vx / 60;
        m.y += m.vy / 60;

        const tailX = m.x - m.vx * 0.16;
        const tailY = m.y - m.vy * 0.16;
        const gradient = ctx.createLinearGradient(m.x, m.y, tailX, tailY);
        gradient.addColorStop(0, `rgba(255,255,255,${Math.max(0, m.life)})`);
        gradient.addColorStop(1, 'rgba(255,255,255,0)');

        ctx.globalAlpha = 1;
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();
      }
    }

    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(draw);
  }

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  // Pause when the tab is hidden. rAF already throttles, but stopping outright
  // means a backgrounded tab does no work at all.
  function onVisibility(): void {
    if (document.hidden) {
      running = false;
      cancelAnimationFrame(raf);
    } else if (!running) {
      running = true;
      raf = requestAnimationFrame(draw);
    }
  }

  document.addEventListener('visibilitychange', onVisibility);

  seed();
  resize();
  raf = requestAnimationFrame(draw);

  return {
    destroy(): void {
      running = false;
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    },
  };
}
