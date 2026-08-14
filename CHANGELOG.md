# 更新日志

> **中文** | [English](CHANGELOG.en.md)

## [0.1.0] - 2026-08-14

首个公开发布版本。

### 新增

- 桌面化封装：双击即用，自动启动/复用 dsh web 服务，退出时自动清理进程树
- Web UI 与浏览器访问完全一致（Web 代码零改动）
- 自定义背景图片：本地图片选择、显示方式（铺满/完整/平铺/居中）、
  背景淡化滑杆（0–90%，只影响背景图层，UI 文字保持清晰）、移除背景
- 设置持久化（%APPDATA%\DeepSeek Harness\settings.json）
- 内置便携 Node.js 与 dsh 运行时：安装后无需 Node、无需仓库即可使用
- 与主题插件兼容（仅接管主表面 token，未设背景图时不覆盖任何样式）
- 单实例运行；复用已有 127.0.0.1:3080 服务（DSH_DESKTOP_NO_REUSE=1 可关闭）

### 安全

- 渲染进程隔离（contextIsolation、固定桥接 API、无 Node 能力）
- IPC 固定白名单、参数校验、路径穿越防护、无 eval / shell 拼接
- 静态安全审计（npm run security-check）与运行时隔离探针（随冒烟测试执行）
- 安全设计详见 SECURITY.md

### 工程

- 自动化冒烟测试（npm run smoke，含打包版）
- 内置运行时一键打包（npm run bundle:server / npm run dist）
