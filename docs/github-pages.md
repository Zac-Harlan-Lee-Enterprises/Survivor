# GitHub Pages deployment

GitHub Pages is a static host: no Node, no server rendering, no API routes, no rewrite rules. This app is designed for that from the first commit.

## How the build adapts to the subpath

- `vite.config.ts` sets `base` from `VITE_BASE_PATH`, otherwise from `GITHUB_REPOSITORY` (`owner/Survivor` → `/Survivor/`, `owner/owner.github.io` → `/`). `build/basePath.ts` is unit-tested.
- Every asset URL in the built `index.html` is emitted under that base (for example `/Survivor/assets/...`). Runtime asset paths (headshots) use `import.meta.env.BASE_URL` via `AppConfig.basePath`.
- `build/githubPagesPlugin.ts` emits:
  - `404.html` with the base baked in — Pages serves it (HTTP 404) for any path that is not a file; it rewrites `/<base>/leaderboard?x=1` to `/<base>/?x=1#/leaderboard`.
  - `.nojekyll` so Pages serves every file verbatim.
- Routing is **hash-based** (`react-router` `HashRouter`), so refreshing `/Survivor/#/players/maya-israel` requests `/Survivor/` — always a real file.

## Local verification identical to Pages

```bash
npm run build:e2e                       # builds with --base=/Survivor/ into dist-e2e
node scripts/serve-static.mjs --dir dist-e2e --base /Survivor/ --port 5892
```

`serve-static.mjs` behaves like Pages: files only under the base, `301` from `/Survivor` to `/Survivor/`, real `404` with `404.html` for anything else, **no SPA fallback**. `npm run test:e2e` builds and serves this way automatically; `tests/e2e/pages.spec.ts` asserts zero 404s on boot, nested-route refresh, clean-URL rewrite and the in-app Not Found page.

## The workflow

`.github/workflows/deploy-pages.yml` runs on pushes to `main` (and manual dispatch, pinned to `refs/heads/main`), validates, builds and deploys with `actions/deploy-pages`. Enable it once: **Settings → Pages → Source: GitHub Actions**. CI (`ci.yml`) runs on pull requests too; its job name `build-and-test` is the branch-protection required check.

Connected-mode configuration is passed as repository **variables** (not secrets) — every `VITE_*` value is public by construction.

## Cognito callback URLs

With hash routing the OIDC redirect URI is the base URL itself: `https://<owner>.github.io/<repo>/`. `oidc-client-ts` consumes `?code=&state=` on load (before the router mounts) and restores the hash the user started from. Register that URL (and `http://localhost:5891/` for development) in the Cognito app client — `infra/template.yaml` does so from `SiteOrigin` + `SiteBasePath`.
