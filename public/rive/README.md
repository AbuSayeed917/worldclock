# Rive assets

Three animations, all MIT-licensed, plus the runtime wasm.

| File | Source | Size | Used for |
|---|---|---|---|
| `orbital.riv` | [George-RD/rive-rs-cli](https://github.com/George-RD/rive-rs-cli) `showcase/orbital_loader.riv` (MIT) | 1.7 KB | Planning section |
| `dial.riv` | [George-RD/rive-rs-cli](https://github.com/George-RD/rive-rs-cli) `showcase/radial_dashboard.riv` (MIT) | 2.4 KB | Terminator heading |
| `planet.riv` | [George-RD/rive-rs-cli](https://github.com/George-RD/rive-rs-cli) `showcase/rocket_launch.riv` (MIT) | 3.5 KB | Rail: where time comes from |
| `rive.wasm` | `@rive-app/canvas-lite` 2.40.1 | 767 KB (313 KB gzipped) | Runtime |

## Why canvas-lite

`@rive-app/canvas-lite` renders through the browser's own canvas rather than
Rive's bundled renderer. Measured gzipped:

| | js | wasm | total |
|---|---|---|---|
| `@rive-app/canvas` | 92 KB | 745 KB | 837 KB |
| `@rive-app/canvas-lite` | 85 KB | 313 KB | **398 KB** |

Every file here was rendered under both and they are visually identical. Lite
drops text rendering, which none of these use. Less than half the payload for no
visible difference is not a close call.

The runtime is still the dominant cost — the three `.riv` files together are
under 8 KB. It is fetched lazily, only when a stage approaches the viewport, so
a visitor who never scrolls past the hero never downloads it.

## sky.riv

Still unbuilt. See [the spec](../../docs/rive-sky-spec.md). When it exists, drop
it here and run `npm run rive:enable`; the card skies pick it up automatically
and the painted SVG sky steps aside. That file is the one that would justify the
runtime on its own, because it would be driven by live solar data rather than
looping.
