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

## Licensing — read before shipping commercially

**These carry LottieFiles' free licence, which is per-creator and generally
requires attribution to the individual author.** The JSON files do not record who
made them, and LottieFiles' site refuses automated requests, so the original
creator could not be identified from here.

What that means in practice:

- For a personal or portfolio project this is the normal way these assets get
  used, and the source URLs above make each one traceable.
- **Before any commercial use**, open each source URL, find the creator, and
  either credit them here or replace the file. LottieFiles' terms are at
  https://lottiefiles.com/page/license.
- If you would rather carry no third-party licence at all, delete this folder.
  `src/ui/weather.ts` is the only consumer for the sky set, and
  `src/ui/cardsky.ts` already paints its own sun and moon — removing the vendored
  icons makes that painted body reappear automatically, because the CSS hides it
  with `:has(.card-weather .stage.is-ready)`.

By contrast, the character artwork in `assets/peeps/` is **CC0 (public domain)**
and carries no such obligation. See [../CREDITS.md](../CREDITS.md).

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
