# Contributing

> **English** | [中文](CONTRIBUTING.md)

All contributions are welcome: bug reports, feature suggestions, docs
improvements, and code.

## Reporting Issues

- Open an issue on the [Issues](https://github.com/Aliarrrrr/dsh-desktop/issues) page
- Include: OS version, reproduction steps, expected vs actual behavior; for
  crashes add the error output (set DSH_DESKTOP_DEBUG=1 for verbose logs)

## Local Development

```sh
npm install
npm start              # run
npm run smoke          # smoke test (must pass after any change)
npm run security-check # static security audit (must pass after any change)
```

## Commit Guidelines

- Commit messages in English, format: `type: summary` (type: feat / fix /
  docs / refactor / chore / security)
- Never commit build artifacts (node_modules, release, bundle, caches —
  covered by .gitignore)
- After touching src/, run `npm run smoke` and `npm run security-check`
  and confirm they pass

## Branches & PRs

- Branch from main: `git checkout -b feat/xxx`
- Push and open a Pull Request describing the change and verification results
