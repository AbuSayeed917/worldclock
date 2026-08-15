/**
 * Converts SVG path artwork into Lottie shape groups.
 *
 * Open Peeps exports from Sketch use only absolute M, C, L and Z commands, which
 * maps onto Lottie's bezier format almost directly: Lottie stores each vertex
 * with its incoming and outgoing control points expressed *relative to that
 * vertex*, where SVG states control points in absolute coordinates.
 *
 * Subpaths matter. A single Open Peeps body is one `d` string containing up to
 * seventeen subpaths, and the holes (a collar opening, the gap inside an arm)
 * only render correctly if every subpath stays inside one group under a single
 * even-odd fill. Splitting them into separate filled shapes fills the holes in.
 */

/** Tokenise a path `d` string into commands with numeric arguments. */
export function parsePath(d) {
  const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? [];
  const commands = [];
  let i = 0;
  let current = null;

  while (i < tokens.length) {
    const token = tokens[i];
    if (/[A-Za-z]/.test(token)) {
      current = token;
      i++;
    }
    if (current === undefined || current === null) break;

    const take = (n) => {
      const out = tokens.slice(i, i + n).map(Number);
      i += n;
      return out;
    };

    switch (current) {
      case 'M': commands.push({ c: 'M', a: take(2) }); current = 'L'; break;
      case 'L': commands.push({ c: 'L', a: take(2) }); break;
      case 'H': commands.push({ c: 'H', a: take(1) }); break;
      case 'V': commands.push({ c: 'V', a: take(1) }); break;
      case 'C': commands.push({ c: 'C', a: take(6) }); break;
      case 'Z':
      case 'z': commands.push({ c: 'Z', a: [] }); break;
      default:
        // Anything else (relative forms, arcs, quadratics) is unsupported. The
        // Open Peeps corpus contains none of it; failing loudly beats emitting
        // silently wrong geometry.
        throw new Error(`unsupported path command: ${current}`);
    }
  }
  return commands;
}

/**
 * Convert one `d` string into an array of Lottie bezier shapes, one per subpath.
 * Coordinates are mapped through `transform(x, y)` so callers can normalise the
 * artwork into whatever space the composition uses.
 */
export function pathToLottieShapes(d, transform = (x, y) => [x, y]) {
  const commands = parsePath(d);
  const shapes = [];

  let v = [];
  let i = [];
  let o = [];
  let cursor = [0, 0];
  let start = [0, 0];

  const flush = (closed) => {
    if (v.length >= 2) {
      shapes.push({
        ty: 'sh',
        ks: { a: 0, k: { i: [...i], o: [...o], v: [...v], c: closed } },
        nm: 'path',
      });
    }
    v = [];
    i = [];
    o = [];
  };

  for (const cmd of commands) {
    switch (cmd.c) {
      case 'M': {
        flush(true);
        cursor = [cmd.a[0], cmd.a[1]];
        start = cursor;
        v.push(transform(cursor[0], cursor[1]));
        i.push([0, 0]);
        o.push([0, 0]);
        break;
      }
      case 'L': {
        cursor = [cmd.a[0], cmd.a[1]];
        v.push(transform(cursor[0], cursor[1]));
        i.push([0, 0]);
        o.push([0, 0]);
        break;
      }
      case 'H': {
        cursor = [cmd.a[0], cursor[1]];
        v.push(transform(cursor[0], cursor[1]));
        i.push([0, 0]);
        o.push([0, 0]);
        break;
      }
      case 'V': {
        cursor = [cursor[0], cmd.a[0]];
        v.push(transform(cursor[0], cursor[1]));
        i.push([0, 0]);
        o.push([0, 0]);
        break;
      }
      case 'C': {
        const [x1, y1, x2, y2, x, y] = cmd.a;
        // Outgoing handle belongs to the vertex we are leaving.
        const from = transform(cursor[0], cursor[1]);
        const c1 = transform(x1, y1);
        o[o.length - 1] = [c1[0] - from[0], c1[1] - from[1]];

        // Incoming handle belongs to the vertex we are arriving at.
        const to = transform(x, y);
        const c2 = transform(x2, y2);
        v.push(to);
        i.push([c2[0] - to[0], c2[1] - to[1]]);
        o.push([0, 0]);
        cursor = [x, y];
        break;
      }
      case 'Z': {
        // A closing segment that returns to the subpath start duplicates the
        // first vertex; drop it so the closed flag does the work instead.
        if (v.length > 1) {
          const first = v[0];
          const last = v[v.length - 1];
          if (Math.abs(first[0] - last[0]) < 1e-6 && Math.abs(first[1] - last[1]) < 1e-6) {
            i[0] = i[v.length - 1];
            v.pop();
            i.pop();
            o.pop();
          }
        }
        flush(true);
        cursor = start;
        break;
      }
    }
  }
  flush(true);
  return shapes;
}

/** Pull `<path d="…" fill="…">` entries out of an SVG source string. */
export function extractPaths(svg) {
  const out = [];
  for (const m of svg.matchAll(/<path\b([^>]*)\/?>/g)) {
    const attrs = m[1];
    const d = /\sd="([^"]+)"/.exec(attrs)?.[1];
    if (!d) continue;
    const fill = /\sfill="([^"]+)"/.exec(attrs)?.[1] ?? '#000000';
    if (fill === 'none') continue;
    out.push({ d, fill });
  }
  return out;
}

function hexToRgb(hex) {
  const h = hex.replace('#', '').trim();
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [
    parseInt(full.slice(0, 2), 16) / 255,
    parseInt(full.slice(2, 4), 16) / 255,
    parseInt(full.slice(4, 6), 16) / 255,
    1,
  ];
}

/**
 * Convert an entire SVG into Lottie shape groups, normalised so the artwork's
 * ink box maps to a target height and is centred on the origin horizontally with
 * its feet at y = 0. Every scene then places figures by their ground point,
 * which is the only anchor that stays stable across different poses.
 */
export function svgToLottieGroups(svg, { targetHeight, inkBox, palette = {} }) {
  const paths = extractPaths(svg);
  if (!paths.length) throw new Error('no filled paths in SVG');

  const scale = targetHeight / inkBox.h;
  // One decimal place is far below a pixel at these scales and roughly halves
  // the emitted JSON compared with two.
  const transform = (x, y) => [
    +((x - (inkBox.x + inkBox.w / 2)) * scale).toFixed(1),
    +((y - (inkBox.y + inkBox.h)) * scale).toFixed(1),
  ];

  // SVG paints later elements on top; Lottie paints the FIRST item in a shapes
  // array on top. Without this reversal the black line art ends up buried under
  // the white silhouette and every character renders as a flat colour blob.
  return paths.slice().reverse().map((p, index) => {
    const colour = palette[p.fill.toUpperCase()] ?? p.fill;
    return {
      ty: 'gr',
      nm: `svg-${index}`,
      it: [
        ...pathToLottieShapes(p.d, transform),
        {
          ty: 'fl',
          c: { a: 0, k: hexToRgb(colour) },
          o: { a: 0, k: 100 },
          // Even-odd, so subpath holes stay holes.
          r: 2,
          nm: 'fill',
        },
        {
          ty: 'tr',
          p: { a: 0, k: [0, 0] },
          a: { a: 0, k: [0, 0] },
          s: { a: 0, k: [100, 100] },
          r: { a: 0, k: 0 },
          o: { a: 0, k: 100 },
          nm: 'transform',
        },
      ],
    };
  });
}
