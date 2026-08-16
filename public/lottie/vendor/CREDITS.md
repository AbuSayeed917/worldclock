# Vendored animations — provenance and licensing

These are professional Lottie animations downloaded from LottieFiles. They were
found by `scripts/harvest-lottie.mjs` (which searches open-source projects for
embedded Lottie URLs), ranked by `scripts/rank-harvest.mjs`, and each one was
rendered on this site's actual background by `scripts/audition.mjs` before being
adopted.

| File | Source URL | Comp name | Size | Used for |
|---|---|---|---|---|
| `sky-partly-cloudy.json` | https://lottie.host/28ac0eb5-bd18-4135-8b96-6740c2295855/uoGu3NA0XH.json | PartlyCloudyDay | 8 KB | Daytime card sky |
| `sky-storm.json` | https://lottie.host/134ddd03-fa28-4e3a-b615-e55a2657e1ea/RP2VqpQfBp.json | day_storm_showers | 33 KB | Tropical daytime card sky |
| `sky-snow.json` | https://lottie.host/6d1e51b7-7767-4e81-9579-3e4bf7668d93/GJdfgyjydj.json | Snow_sunny | 31 KB | High-latitude daytime card sky |
| `sky-rain.json` | https://assets10.lottiefiles.com/private_files/lf30_orqfuyox.json | rainy icon | 23 KB | Daytime card sky |
| `sky-moon.json` | https://assets6.lottiefiles.com/packages/lf20_btkj8xsi.json | moon | 28 KB | Night card sky |
| `world-people.json` | https://assets5.lottiefiles.com/packages/lf20_slipwrv0.json | Businessmen Handshake | 128 KB | Planning section artwork |
| `rail-earth.json` | https://lottie.host/7af41bf4-6c86-47b0-bb41-038a7938658d/A3FwSmmEWU.json | earth | 62 KB | Rail: one rotation |
| `rail-clock.json` | https://assets.lottiefiles.com/packages/lf20_nv5aXa.json | Clock | 3 KB | Rail: one reference |
| `rail-satellite.json` | https://assets2.lottiefiles.com/packages/lf20_s3PG4r.json | Space Lottie | 77 KB | Rail: where time comes from |
| `rail-alarm.json` | https://assets.lottiefiles.com/packages/lf20_iv0UOb.json | Live waiting Animation | 48 KB | Rail: right now |

## Licensing

Meridian is a personal project, which is exactly the use LottieFiles' free tier
is meant for. These animations carry that free licence; the source URL for each
is recorded above so any one of them stays traceable to its origin.

Two notes for the future, not blockers now:

- The free licence is **per-creator and generally expects attribution**. The JSON
  files do not record an author and LottieFiles refuses automated requests, so
  the creators could not be identified from here. If this ever becomes something
  commercial, open the source URLs, credit the authors, and update this table.
- Removing them cleanly is one step: delete this folder. `src/ui/weather.ts` is
  the only consumer of the sky set, and `src/ui/cardsky.ts` already paints its
  own sun and moon — the painted body reappears on its own, because the CSS only
  hides it with `:has(.card-weather .stage.is-ready)`.

The character artwork in `assets/peeps/` is **CC0 (public domain)** and carries
no obligation at all. See [../CREDITS.md](../CREDITS.md).

## Sizing

Each file carries its own padding inside its viewBox, so an identical CSS box
renders them at wildly different apparent sizes — the clock filled its frame
while the earth sat as a dot in the middle. `rail.ts` carries a per-entry
`artScale` to correct for that. It is a property of the source files, not a
design preference, which is why it lives beside the file references.

## How they are chosen


The animations are stock loops and know nothing on their own. `src/ui/weather.ts`
supplies the meaning:

- The **moon** shows only when that city's solar elevation says it is genuinely
  dark there — not on a clock threshold.
- The **daytime condition** is deterministic from the city's latitude and a hash
  of its id, so Tromsø tends to snow, Singapore tends to storm, and a given card
  keeps the same condition between visits.

This is a climate hint, not a forecast. There is no weather API behind it, and
labelling it as real conditions would be worse than showing nothing.
