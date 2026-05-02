# FullComposite — ImagineAfrica

An interactive WebGL experience built with Unity, hosted at **[imagineafrica.site](https://imagineafrica.site)**.

## Live

[imagineafrica.site](https://imagineafrica.site)

## Structure

```
Build/                  Unity WebGL build artifacts (wasm, data, framework, loader)
TemplateData/           Loading screen assets (icon)
index.html              Entry point — loading UI, WebGL guard, Unity bootstrap
service-worker.js       Cache-first SW for Build/ assets on repeat visits
.github/workflows/
  deploy.yml            Pushes main → GitHub Pages automatically
```

## Deployment

Pushes to `main` automatically deploy via `.github/workflows/deploy.yml`.  
The workflow verifies all required build artifacts exist and reports sizes before uploading.

## Updating the build

1. In Unity: **File → Build Settings → WebGL → Build**
2. Copy the output into `Build/` (replace all four files: `.wasm`, `.data`, `.framework.js`, `.loader.js`)
3. Increment `CACHE_NAME` in `service-worker.js` (e.g. `v1` → `v2`) so returning users discard the old cached build
4. Commit and push to `main`

> **Performance note:** Enable Brotli compression in Unity (**Player Settings → Publishing Settings → Compression Format → Brotli**) before building. This reduces the current ~87 MB download to ~25–30 MB and is the single highest-impact change for load time.

## Unity version

<!-- TODO: record the exact Unity version used to produce the current build -->

## License

MIT — see [LICENSE](LICENSE)
