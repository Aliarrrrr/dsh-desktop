# Security Design & Verification

> **English** | [中文](SECURITY.md)

This document describes the security model of dsh-desktop, the hardening
measures in place, and the automated verification results.

## Threat Model

The renderer of dsh-desktop only loads content served by the local dsh web
service (127.0.0.1, random port). Trust boundaries:

- **Main process** (Electron main): has system capabilities (spawns the
  server, reads/writes userData, opens external links).
- **Renderer** (page world): runs only the webui code plus our injected
  desktop-settings script — no Node capabilities.
- **Preload bridge**: the only data channel between the page world and the
  main process; it exposes a fixed API only.

## Hardening Measures

| Measure | Where |
| --- | --- |
| contextIsolation on, nodeIntegration off | main.js webPreferences |
| sandbox / webSecurity not disabled; no remote content | main.js webPreferences |
| Page world cannot reach require / process / ipcRenderer | preload.js contextBridge fixed API |
| Fixed IPC channel allowlist (6 channels), no dynamic channels | main.js registerIpc |
| Input validation: set-fit allowlist, set-mask clamping, debug channel only when DSH_DESKTOP_DEBUG=1 | main.js registerIpc |
| Background path traversal guard (basename only, no "..") | main.js backgroundFilePath |
| No eval / new Function / execSync; child processes spawned with argv arrays (no shell concatenation) | main.js / server.js |
| Server binds 127.0.0.1 only (dsh web rejects --host 0.0.0.0) | server.js |
| No custom protocol scheme (background images use data: URLs) | main.js / inject.js |
| New windows always denied; only http(s) links open in the system browser | main.js setWindowOpenHandler |
| Injected script makes zero network calls (no fetch / XHR / WebSocket) | inject.js |
| Exit terminates the server process tree by numeric PID | server.js stop |

## Automated Verification

### 1. Static audit (28 assertions)

```sh
npm run security-check
```

Covers every row above; prints PASS/FAIL and exits non-zero on any failure.

### 2. Runtime probes (inside the smoke test, DSH_DESKTOP_DEBUG=1)

Verifies the isolation boundary in the real renderer process:

- `window.require` / `window.process` / `window.ipcRenderer` are undefined
- `window.dshDesktop` exposes exactly 7 fixed methods and cannot be
  overwritten by the page (contextBridge freezes the object)
- The page has no external network call code paths

Latest result (packaged build):

```json
{"requireUndefined":true,"processUndefined":true,"ipcRendererUndefined":true,
 "bridgeKeys":["chooseBackground","clearBackground","debugSetBackground","getSettings","onSettingsChanged","setFit","setMask"],
 "bridgeImmutable":true}
```

## Known Boundaries (review notes)

- **Unsigned binary**: the installer is not code-signed; SmartScreen/AV may
  show "unknown publisher". A signing certificate should be added before
  public distribution.
- **The service is dsh web itself**: the desktop app inherits dsh web's
  existing security posture (loopback binding, browser trust fence, etc.);
  its risks are part of this app's exposure.
- **Data locality**: background images are copied to userData
  (%APPDATA%\DeepSeek Harness\backgrounds\) and used locally; sessions and
  credentials follow dsh conventions (DSH_HOME, .env).
- **debug-set-background channel**: only available when
  `DSH_DESKTOP_DEBUG=1` is set; unreachable in normal user launches.
