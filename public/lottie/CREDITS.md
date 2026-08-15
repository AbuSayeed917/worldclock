# Animation credits

## Characters — Open Peeps

The people in every scene are **[Open Peeps](https://www.openpeeps.com/)** by
Pablo Stanley, released under **CC0 1.0 (public domain)**. No attribution is
legally required; it is given here because the work deserves it.

The atoms are vendored in [`assets/peeps/`](../../assets/peeps) — full-body
poses, heads and faces, taken from the mirror at
[jenshor/open-peeps](https://github.com/jenshor/open-peeps) (MIT).

`scripts/svg-to-lottie.mjs` converts the SVG artwork into Lottie shape layers,
and `scripts/peeps.mjs` composes a pose, a head and a face into one animated
character. Colours are remapped at build time, so the same artwork produces a
cast with different skin, hair and clothing.

Walking uses the three `walking-1/2/3` stances cut between on a short interval,
which is a real gait rather than a rectangle rotating around a hip joint.

## Scenery — generated

Skies, suns, moons, clouds, birds, city skylines and star fields are generated
by [`scripts/build-lottie.mjs`](../../scripts/build-lottie.mjs). They are not
downloaded, because they have to match the palette the solar model produces —
downloaded artwork carries whatever palette its author drew against, and on this
site that means clashing with, or vanishing into, the current sky.

| File | Scene | Size | Duration |
|---|---|---|---|
| `dawn.json` | Someone waking, sun climbing, birds crossing | 720×420 | 8s |
| `midday.json` | Three people walking under a bright sky | 720×420 | 6s |
| `dusk.json` | People heading home, windows coming on | 720×420 | 8s |
| `night.json` | Someone still at a desk, moon and stars | 720×420 | 8s |
| `orbit.json` | A globe with an orbiting marker | 300×300 | 10s |

Around 13–33 KB each once gzipped, which is what the browser actually
downloads; the raw figures are much larger because bezier coordinate arrays
compress extremely well.

## Why the card scenes are not Lottie

The scene behind each city card is SVG built by
[`src/ui/cardsky.ts`](../../src/ui/cardsky.ts), not a Lottie file. Two reasons:

1. **It has to answer to live data.** The sun and moon sit at positions derived
   from that city's real solar elevation, stars fade in on the real twilight
   scale, and windows light up when it is genuinely dark there. A canned
   animation always shows the same thing.
2. **There can be twenty cards.** Twenty Lottie players means twenty render
   loops; one small SVG per card with CSS-driven motion costs almost nothing.

Each city's skyline is generated from a hash of its id, so Tokyo and Reykjavík
get different silhouettes and keep them between visits.

## Sourcing animations from the internet

`scripts/harvest-lottie.mjs` finds publicly hosted Lottie files by searching
GitHub for open-source projects that embed them, then downloads and inspects
each one. `scripts/rank-harvest.mjs` scores them against this site's subject
matter, and `scripts/preview-lottie.mjs` renders any Lottie to a PNG contact
sheet so it can be judged by looking rather than guessing.

That pipeline works — it collected several hundred usable animations. Two things
it taught us, worth knowing before adopting any of them:

- **Most carry a fixed palette.** A "world map" animation drawn for a light
  background is invisible on a dark one. Check it against your actual page, not
  a white preview.
- **Licensing is per-file.** LottieFiles free animations carry individual
  creator licences. Anything adopted from there needs its source URL and licence
  recorded here.

## Checks that catch silent failures

`preview-lottie.mjs` enforces these, and `build-lottie.mjs` validates its own
output:

- **Every layer needs an `op`.** A layer with no out-point is never active, so
  the file loads without any error and draws nothing at all. This project hit it.
- **No external image references.** `assets[]` entries with a `p` property and no
  `e` flag depend on PNGs that will not be there, and render as empty boxes.
- **Paint order is reversed from SVG.** SVG paints later elements on top; Lottie
  paints the *first* item in a shapes array on top. Getting this backwards buries
  the line art under the silhouette and every character becomes a flat blob.
