# Rive evaluation

Rive was evaluated as a replacement for the Lottie animations. The runtime works,
the tooling is in `scripts/preview-rive.mjs`, and on-theme `.riv` files do exist.
Two measured findings argue against adopting it here.

## 1. The runtime costs about eleven times as much

Gzipped, which is what the browser actually downloads:

| | js | wasm | total |
|---|---|---|---|
| Rive (`@rive-app/canvas` 2.40.1) | 92 KB | 745 KB | **837 KB** |
| Lottie (`lottie-web` 5.12) | 77 KB | — | **77 KB** |

For scale, the entire animation payload of the site today — eleven Lottie files
plus the runtime — is 252 KB. Adding Rive's runtime alone would more than
quadruple that, and the wasm cannot be deferred: nothing draws until it lands.

## 2. The available files cannot be driven by data

Rive's real advantage over Lottie is the state machine: a running animation whose
inputs can be set from application state. That is the one thing that would earn
the payload back on this site, because everything here is a function of the sun.

Every candidate was inspected for drivable inputs. None has any:

| File | Artboard | State machine | Drivable inputs |
|---|---|---|---|
| `day_night_toggle.riv` | DayNightToggle | DayNightMachine | none |
| `watch.riv` | New Artboard | Time, Loop | none |
| `orbital_loader.riv` | Orbital Loader | — | none |
| `radial_dashboard.riv` | Radial Dashboard Gauge | — | none |
| `rocket_launch.riv` | Rocket Launch | — | none |
| `pulse_button.riv` | InteractivePulseButton | PulseButtonMachine | none |
| `control_panel.riv` | Control Panel | Panel | none |

They are playback-only loops. Dropped into this page they would behave exactly
like the Lottie files already there, for eleven times the runtime cost.

## Why authoring our own is not an option

`.riv` is a closed binary format produced by the Rive editor, a GUI application.
No published library writes one — `rive-file-writer`, `riv-encoder`,
`@rive-app/file-builder` and `rive-format` are all unpublished on npm. Lottie is
documented JSON, which is why `scripts/build-lottie.mjs` can generate scenes that
match this site's palette and respond to its data. Nothing equivalent exists for
Rive.

## Where the on-theme files are, if this is revisited

`George-RD/rive-rs-cli` (MIT) has a `showcase/` directory of small, well-made
files: `day_night_toggle` (4 KB), `orbital_loader` (2 KB), `radial_dashboard`
(2 KB), `rocket_launch` (3 KB). `rive-app/rive-android` has `watch_v1.riv` (4 KB).

`scripts/preview-rive.mjs <dir>` renders any directory of `.riv` files to a
contact sheet and reports their artboards, animations and state machines. It
serves them over HTTP because Rive fetches its wasm at load time and an
`about:blank` origin has those requests blocked.

## What would change the answer

- A `.riv` built for this site with a numeric input for solar elevation. Then one
  file could replace the sky, sun position and star fade at once, and the state
  machine would be doing work no Lottie file can.
- Rive shipping a materially smaller wasm build.
