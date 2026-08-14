# Third-Party Notices

> **English** | [中文](THIRD_PARTY_NOTICES.md)

dsh-desktop is built on the following third-party projects. The license of
each project governs its use (full texts live in each project's repository /
LICENSE file; packaged builds include each dependency's license files).

| Project | Used for | License |
| --- | --- | --- |
| [DeepSeek Harness (@deepseek-ai/dsh)](https://github.com/deepseek-ai/deepseek-harness) | The wrapped server side (dsh web) | MIT |
| [Electron](https://github.com/electron/electron) | Desktop app runtime | MIT (Chromium components: LICENSES.chromium.html in the Electron repo) |
| [electron-builder](https://github.com/electron-userland/electron-builder) | Installer build | MIT |
| [React](https://github.com/facebook/react) / ReactDOM | dsh Web frontend (shipped with dsh) | MIT |
| [Node.js](https://nodejs.org) | Bundled portable runtime | Node.js license (MIT + third-party component notices) |

Licenses of other npm dependencies can be found in
`node_modules/<pkg>/LICENSE` or inside the release package.

> Note: this project is for learning and personal reference. dsh is an open
> source project by DeepSeek AI; its trademarks and names belong to their
> respective owners, and this project has no affiliation with them.
