# Rive assets

Empty by design. The page reads `manifest.json`; while `sky` is `false` no Rive
runtime is downloaded at all.

To enable, once `sky.riv` has been built to [the spec](../../docs/rive-sky-spec.md):

```
cp <built file> public/rive/sky.riv
npm run rive:enable          # copies the wasm, flips the manifest
node scripts/preview-rive.mjs public/rive   # confirm inputs are drivable
npm run build
```

The page validates the file against the contract at runtime. If the artboard,
state machine or inputs do not match, it logs what is wrong and keeps the SVG
sky rather than showing something that looks right but ignores the sun.

`rive.wasm` is copied out of `node_modules` by the enable script and is
gitignored; `sky.riv` should be committed.
