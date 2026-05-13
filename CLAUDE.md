# ImagineAfrica — Repository Summary

## What This Repo Is

A static GitHub Pages deployment for **FullComposite | ImagineAfrica**, a Unity WebGL game served at `imagineafrica.site`. There is no backend, no build toolchain, and no package manager. The entire repo is a pre-compiled Unity WebGL export plus a hand-crafted HTML shell and a service worker.

## File Map

```
index.html          — sole HTML entry point; loading UI + Unity bootstrap
service-worker.js   — PWA caching (cache-first for Build/, network-first for HTML)
CNAME               — custom domain: imagineafrica.site
.nojekyll           — prevents GitHub Pages from mangling binary files (critical)
Build/
  WebGl.wasm        — 47 MB compiled game logic (WebAssembly)
  WebGl.data        — 39 MB game assets
  WebGl.framework.js — 456 KB Unity JS runtime
  WebGl.loader.js   — 28 KB bootstrap loader
TemplateData/
  webmemd-icon.png  — loading screen icon
.github/workflows/
  deploy.yml        — GitHub Pages deploy on push to main
```

## How It Works

1. A visitor hits `imagineafrica.site`; GitHub Pages serves `index.html`.
2. `index.html` shows an animated loading overlay, checks for WebGL2 support (aborts with a friendly error if missing), then calls `createUnityInstance(...)` pointing at the four `Build/` files.
3. Unity's loader downloads `WebGl.data` and `WebGl.wasm` (~87 MB total), compiles/instantiates the WASM, and starts the game. The progress bar reflects three stages: downloading (<40%), initialising (<90%), starting (≥90%).
4. The service worker caches `Build/*` assets permanently under cache key `fullcomposite-v1`. Returning visitors skip the 87 MB re-download.
5. On push to `main`, the GitHub Actions workflow verifies all four build files and `.nojekyll` exist, then deploys to GitHub Pages.

## Key Constraints for Changes

- **Never edit `Build/` files by hand.** They are Unity compiler output; replace the whole directory from a new Unity WebGL build.
- **Keep `.nojekyll` in the repo root.** Without it, GitHub Pages corrupts binary files.
- **Bump `CACHE_NAME` in `service-worker.js`** (e.g. `fullcomposite-v2`) whenever deploying new build artifacts, or users will get stale WASM from cache.
- **`index.html` is the only place** to change loading UI, metadata, error screens, or Unity config options (`productVersion`, `devicePixelRatio`, etc.).
- There are no tests, no linting, and no npm scripts — changes deploy directly on merge to `main`.
