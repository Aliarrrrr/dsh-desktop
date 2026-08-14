# dsh-desktop — DeepSeek Harness Desktop

> **English** | [中文](README.md)

Turns the "run `dsh web` in PowerShell, then open http://127.0.0.1:3080 in a
browser" workflow into a lightweight ChatGPT-style desktop app: **double-click
and go**. The window hosts the **exact same Web UI** as the browser, plus
**custom background images**.

![Desktop settings panel](docs/screenshot.png)

## ✨ Features

- **Ready to use**: the installer bundles portable Node.js and the dsh
  runtime — no Node install, no repository clone, no command line. Launch the
  app and it starts the service, opens the chat window, and cleans up on exit
- **Identical UI**: zero changes to the Web code; browsing the service directly
  stays byte-identical
- **Custom background images**: gear button (bottom-right) → "Desktop settings"
  panel
  - Pick a local image (png / jpg / webp / gif / bmp)
  - Fit modes: cover / contain / repeat / center
  - **Background fade** slider (0–90%): fades only the background layer — UI
    text stays crisp
  - Remove background; settings are persisted
- **Theme-plugin friendly**: no styles are overridden while no image is set;
  with an image, only the main surface tokens are handed over (bg-base /
  bg-layer-1 / sidebar-fill) — everything else from theme plugins keeps
  working
- **Single instance**; reuses an already-running dsh web on 127.0.0.1:3080

## 🚀 Quick Start (install & use)

1. Run `DeepSeek Harness Setup.exe` on Windows 10/11 and complete the install
   (installers are also available on the [Releases](https://github.com/Aliarrrrr/dsh-desktop/releases) page)
2. Double-click "DeepSeek Harness" on the desktop or in the Start menu
3. The app handles everything: starts the bundled service → opens the chat
   window → cleans up the process tree on exit

> Installed size is about 450 MB (Electron + portable Node.js 22 + the
> `@deepseek-ai/dsh` runtime). No network is needed after installation except
> for model API calls (first launch initializes local config under
> `%USERPROFILE%\.dsh`).

## 🛠 Development from Source

```sh
cd dsh-desktop
npm install            # installs electron / electron-builder
npm start              # run the desktop app
npm run smoke          # automated end-to-end smoke test (screenshots to project root)
npm run security-check # static security audit (28 assertions)
```

## 📦 Packaging

```sh
npm run bundle:server  # fetch bundled dsh runtime + portable Node into bundle/
npm run dist           # build the bundled runtime and the NSIS installer (release/)
npm run dist:dir       # unpacked build only (release/win-unpacked/)
```

## 🎨 Background Image Feature

- **Fade semantics**: the higher the slider, the closer the background gets to
  the theme base color (light themes fade toward white, dark themes toward
  dark). The fade applies only to the background layer — UI text is never
  affected
- **Theme adaptation**: the fade color is captured once from the current theme
  and cached; adjusting the slider never changes the fade direction
- **Plugin compatibility**: implemented via an injected page script — zero Web
  code changes; nothing is injected when the service is opened in a browser

## 🔒 Security

See [SECURITY.md](SECURITY.md) for the threat model, hardening measures, and
verification results:

- Renderer isolation (contextIsolation on, no Node capabilities, fixed
  immutable bridge API)
- Fixed IPC allowlist + input validation + path-traversal protection; no
  eval / shell string concatenation
- Server binds loopback only; background images stay local, never uploaded
- Static audit via `npm run security-check` plus runtime isolation probes
  inside the smoke test

> Known limitation: the installer is unsigned, so SmartScreen may warn on
> first launch.

## 📁 Data Locations

| Content | Location |
| --- | --- |
| Desktop settings | `%APPDATA%\DeepSeek Harness\settings.json` |
| Background images | `%APPDATA%\DeepSeek Harness\backgrounds\` |
| dsh sessions/config | `%USERPROFILE%\.dsh` (DSH_HOME) |

## 🗂 Project Structure

```
dsh-desktop/
├─ src/                    # app source
│  ├─ main.js              # main process: window, server lifecycle, settings, IPC
│  ├─ server.js            # dsh web server child management (bundled → repo → npx)
│  ├─ preload.js           # renderer bridge (fixed API)
│  └─ inject.js            # injected page script: background applier + settings panel
├─ assets/                 # icon and splash screen
├─ scripts/                # packaging, smoke, security audit, debug tools
├─ bundle/                 # bundled runtime (generated at build time, not committed)
├─ release/                # build artifacts (not committed)
├─ SECURITY.md             # security design & verification
└─ package.json
```

## ❓ FAQ

**Port conflict?** The service port is assigned by the OS; if a dsh web
service is already running on 3080 it is reused (`DSH_DESKTOP_NO_REUSE=1`
disables reuse).

**Slow first launch?** The first run initializes local dsh config and
dependency links; later launches are near-instant.

**SmartScreen "unknown publisher"?** The installer is unsigned; get a code
signing certificate for public distribution.

**Prefer a local checkout over the bundled runtime?** Point
`DSH_DESKTOP_REPO` at a `deepseek-harness` checkout; see `src/server.js` for
the resolution order.

## 📄 License

MIT License, copyright Aliarrrrr (see [LICENSE](LICENSE)).
Third-party licenses: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

This project wraps `@deepseek-ai/dsh` (DeepSeek Harness, MIT, see its
project page); Electron (MIT) and Chromium component licenses live in their
own projects.
