# 第三方许可声明

> **中文** | [English](THIRD_PARTY_NOTICES.en.md)

dsh-desktop 构建于以下第三方项目之上，各项目的许可以此清单为准（全文见各自
仓库/LICENSE 文件；打包产物内亦包含各依赖的许可证文件）。

| 项目 | 用途 | 许可证 |
| --- | --- | --- |
| [DeepSeek Harness (@deepseek-ai/dsh)](https://github.com/deepseek-ai/deepseek-harness) | 桌面应用所封装的服务端（dsh web） | MIT |
| [Electron](https://github.com/electron/electron) | 桌面应用运行时 | MIT（Chromium 组件许可见 electron 仓库 LICENSES.chromium.html） |
| [electron-builder](https://github.com/electron-userland/electron-builder) | 安装包构建 | MIT |
| [React](https://github.com/facebook/react) / ReactDOM | dsh Web 前端（随 dsh 分发） | MIT |
| [Node.js](https://nodejs.org) | 内置便携运行时 | 遵循 Node.js 自身许可（MIT 及第三方组件声明） |

其余 npm 依赖的许可证可在 `node_modules/<pkg>/LICENSE` 或发布包内查看。

> 注意：本项目仅作学习与个人使用参考；dsh 为 DeepSeek AI 的开源项目，商标与
> 名称归其权利人所有，本项目与其无隶属关系。
