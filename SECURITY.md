# 安全设计与验证

> **中文** | [English](SECURITY.en.md)

本文档说明 dsh-desktop 的安全模型、已实施的加固措施，以及自动化验证结果。

## 威胁模型

dsh-desktop 的渲染进程只加载本地 dsh web 服务（127.0.0.1，随机端口）提供的内容。
信任边界：

- **主进程**（Electron main）：拥有系统能力（spawn 服务进程、读写 userData、打开外部链接）。
- **渲染进程**（页面世界）：只运行 webui 代码 + 我们注入的桌面设置脚本，无 Node 能力。
- **预加载桥**（preload）：页面世界与主进程之间唯一的数据通道，只暴露固定 API。

## 加固措施（实现即审计项）

| 措施 | 实现位置 |
| --- | --- |
| contextIsolation 开启、nodeIntegration 关闭 | main.js webPreferences |
| 不关闭 sandbox / webSecurity；无远程内容加载 | main.js webPreferences |
| 页面世界拿不到 require / process / ipcRenderer | preload.js contextBridge 固定 API |
| IPC 通道固定白名单（6 个），无动态通道 | main.js registerIpc |
| 参数校验：set-fit 白名单、set-mask 数值钳制、debug 通道仅在 DSH_DESKTOP_DEBUG=1 时可用 | main.js registerIpc |
| 背景文件路径防穿越（仅接受 basename，拒绝 ..） | main.js backgroundFilePath |
| 无 eval / new Function / execSync；子进程一律 argv 数组启动（无 shell 拼接） | main.js / server.js |
| 服务仅绑定 127.0.0.1（dsh web 默认拒绝 0.0.0.0） | server.js |
| 无自定义协议 scheme（背景图走 data: URL，不留协议面） | main.js / inject.js |
| 新窗口一律拒绝；仅 http/https 链接交给系统浏览器 | main.js setWindowOpenHandler |
| 注入脚本零网络调用（无 fetch / XHR / WebSocket） | inject.js |
| 退出时用数值 PID 结束服务进程树（无注入面） | server.js stop |

## 自动化验证

### 1. 静态审计（28 项断言）

```sh
npm run security-check
```

覆盖上表全部条目，输出 PASS/FAIL，任一 FAIL 退出码非 0。

### 2. 运行时探针（随冒烟测试执行，DSH_DESKTOP_DEBUG=1）

在真实渲染进程中验证隔离边界：

- `window.require` / `window.process` / `window.ipcRenderer` 均为 undefined
- `window.dshDesktop` 只暴露 7 个固定方法，且不可被页面覆盖（contextBridge 冻结对象）
- 页面无外部网络调用代码路径

最近一次运行结果（打包版）：

```json
{"requireUndefined":true,"processUndefined":true,"ipcRendererUndefined":true,
 "bridgeKeys":["chooseBackground","clearBackground","debugSetBackground","getSettings","onSettingsChanged","setFit","setMask"],
 "bridgeImmutable":true}
```

## 已知边界（评审时请注意）

- **未签名二进制**：安装程序未做代码签名，SmartScreen/杀软可能提示"未知发布者"；
  正式分发前应补签名证书。
- **服务即 dsh web 本身**：桌面应用复用 dsh web 服务的既有安全姿态
  （本地回环绑定、浏览器信任围栏等）；该服务的风险同样属于本应用的暴露面。
- **数据本地性**：背景图片复制到 userData（%APPDATA%\DeepSeek Harness\backgrounds\），
  仅本机使用；会话/凭据仍遵循 dsh 自身约定（DSH_HOME、.env）。
- **debug-set-background 通道**：仅在 `DSH_DESKTOP_DEBUG=1` 环境变量下注册可用，
  正常用户启动路径不可达。
