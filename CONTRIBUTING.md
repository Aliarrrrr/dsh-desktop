# 参与贡献

> **中文** | [English](CONTRIBUTING.en.md)

欢迎任何形式的贡献：问题反馈、功能建议、文档改进、代码提交。

## 反馈问题

- 打开 [Issues](https://github.com/Aliarrrrr/dsh-desktop/issues) 新建 issue
- 请附上：操作系统版本、复现步骤、期望行为与实际行为；
  如涉及崩溃请提供错误输出（可设置 DSH_DESKTOP_DEBUG=1 获取详细日志）

## 本地开发

```sh
npm install
npm start              # 运行
npm run smoke          # 冒烟测试（改动后务必通过）
npm run security-check # 静态安全审计（改动后务必通过）
```

## 提交规范

- 提交信息用英文，格式：`类型: 摘要`（类型：feat / fix / docs / refactor / chore / security）
- 不提交生成物（node_modules、release、bundle、缓存；.gitignore 已覆盖）
- 修改 src/ 后请运行 `npm run smoke` 与 `npm run security-check` 并确认通过

## 分支与 PR

- 从 main 新建分支：`git checkout -b feat/xxx`
- 完成后推送并提交 Pull Request，说明改动内容与验证结果
