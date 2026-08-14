'use strict'

// Automated end-to-end smoke test: launches the real Electron app with
// DSH_DESKTOP_SMOKE=1 (hidden workspace-local DSH_HOME/userData), waits for
// the app's own checks (page load, injection, background, persistence), and
// exits with the app's code. Screenshots land in the app root.
// Run: npm run smoke

const { spawn } = require('node:child_process')
const path = require('node:path')
const fs = require('node:fs')
const { encodePng } = require('./gen-icon.js')

const root = path.join(__dirname, '..')

// Generate a small test background image (diagonal gradient) for the smoke.
const bgPath = path.join(root, 'smoke-bg.png')
fs.writeFileSync(bgPath, encodePng(64, 64, (x, y) => [
  Math.round(30 + x * 2.6),
  Math.round(60 + y * 1.6),
  Math.round(140 + (x + y) * 0.9),
  255,
]))

// require('electron') in plain node returns the path to the Electron binary.
const electronPath = require('electron')
console.log('[smoke] electron:', electronPath)

const child = spawn(electronPath, ['.'], {
  cwd: root,
  env: {
    ...process.env,
    DSH_DESKTOP_SMOKE: '1',
    DSH_DESKTOP_SMOKE_BG: bgPath,
  },
  stdio: 'inherit',
})

child.on('exit', (code) => process.exit(code ?? 1))
