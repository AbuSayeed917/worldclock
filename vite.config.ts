import { defineConfig } from 'vite';

// The site is served from https://<user>.github.io/worldclock/, so every asset
// URL has to be prefixed with that path. Without this, the built CSS/JS 404s on
// Pages while working perfectly in local dev — the classic Pages subpath trap.
export default defineConfig({
  base: process.env.PAGES_BASE ?? '/worldclock/',
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
  },
});
