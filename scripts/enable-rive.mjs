/**
 * Copies the Rive wasm into public/rive/ so the runtime is self-hosted.
 *
 * Run this once, after dropping sky.riv into public/rive/. It is deliberately
 * not part of the build: the wasm is 1.8 MB and there is no reason for it to sit
 * in the repository, or in dist/, while no .riv file uses it.
 */
import { copyFileSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const dest = join(ROOT, 'public/rive');
const riv = join(dest, 'sky.riv');
const wasmSrc = join(ROOT, 'node_modules/@rive-app/canvas/rive.wasm');

if (!existsSync(riv)) {
  console.error('public/rive/sky.riv not found.');
  console.error('Build it first — see docs/rive-sky-spec.md — then re-run this.');
  process.exit(1);
}
if (!existsSync(wasmSrc)) {
  console.error('@rive-app/canvas is not installed. Run: npm i @rive-app/canvas');
  process.exit(1);
}

mkdirSync(dest, { recursive: true });
copyFileSync(wasmSrc, join(dest, 'rive.wasm'));

// The page reads this rather than probing sky.riv, so that a missing file is a
// declared absence instead of a 404 on every page load.
writeFileSync(
  join(dest, 'manifest.json'),
  JSON.stringify({ sky: true, note: 'Enabled by scripts/enable-rive.mjs.' }, null, 2) + '\n',
);

const kb = (p) => Math.round(statSync(p).size / 1024);
console.log(`sky.riv        ${kb(riv)} KB`);
console.log(`rive.wasm      ${kb(join(dest, 'rive.wasm'))} KB  (copied)`);
console.log('manifest.json  sky: true');
console.log('\nRive sky enabled. Verify with:');
console.log('  node scripts/preview-rive.mjs public/rive');
