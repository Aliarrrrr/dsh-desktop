# Changelog

> **English** | [中文](CHANGELOG.md)

## [0.1.0] - 2026-08-14

First public release.

### Added

- Desktop wrapper: double-click to run; auto-starts/reuses the dsh web
  service and cleans up the process tree on exit
- Web UI identical to the browser experience (zero Web code changes)
- Custom background images: local image picker, fit modes (cover / contain /
  repeat / center), background fade slider (0–90% — fades only the background
  layer, UI text stays crisp), remove background
- Persisted settings (%APPDATA%\DeepSeek Harness\settings.json)
- Bundled portable Node.js and dsh runtime: usable after install without
  Node or a repository checkout
- Theme-plugin compatible (only main surface tokens are handed over; no
  overrides while no image is set)
- Single instance; reuses an existing service on 127.0.0.1:3080
  (DSH_DESKTOP_NO_REUSE=1 disables reuse)

### Security

- Renderer isolation (contextIsolation, fixed bridge API, no Node
  capabilities)
- Fixed IPC allowlist, input validation, path-traversal protection, no
  eval / shell concatenation
- Static security audit (npm run security-check) and runtime isolation
  probes (inside the smoke test)
- Design details in SECURITY.md

### Engineering

- Automated smoke test (npm run smoke, incl. packaged build)
- One-command runtime bundling (npm run bundle:server / npm run dist)
