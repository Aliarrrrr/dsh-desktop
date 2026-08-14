'use strict'

// Static security audit of the desktop app sources (regex-free string checks).
// Run: node scripts/verify-security.mjs   (exit 0 = all checks pass)
// Runtime probes (renderer isolation) live in the smoke's DEBUG section.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (f) => fs.readFileSync(path.join(root, 'src', f), 'utf8')

let failures = 0
const check = (name, ok, detail = '') => {
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (ok ? '' : '  -- ' + detail))
  if (!ok) failures++
}
const has = (src, needle) => src.includes(needle)
const lacks = (src, needle) => !src.includes(needle)

const main = read('main.js')
const preload = read('preload.js')
const inject = read('inject.js')
const server = read('server.js')

// ── renderer isolation ──────────────────────────────────────────────────────
check('contextIsolation enabled', has(main, 'contextIsolation: true'))
check('nodeIntegration disabled', has(main, 'nodeIntegration: false'))
check('no sandbox disable', lacks(main, 'sandbox: false'))
check('no nodeIntegrationInSubFrames', lacks(main, 'nodeIntegrationInSubFrames'))
check('no webSecurity disable', lacks(main, 'webSecurity: false'))
check('no allowRunningInsecureContent', lacks(main, 'allowRunningInsecureContent'))

// ── no dynamic code execution ───────────────────────────────────────────────
for (const [name, src] of [['main.js', main], ['preload.js', preload], ['inject.js', inject], ['server.js', server]]) {
  check('no eval/new Function in ' + name, lacks(src, 'eval(') && lacks(src, 'new Function('))
}

// ── process/network surface ─────────────────────────────────────────────────
check('spawn uses argv arrays (no shell strings)', lacks(server, 'shell: true') && lacks(main, 'shell: true'))
check('no execSync in app code', lacks(server, 'execSync') && lacks(main, 'execSync'))
check('taskkill uses numeric pid only', has(server, "taskkill', ['/pid', String(this.child.pid)"))
check('server binds loopback (no --host override)', lacks(server, '--host'))
check('no custom protocol schemes registered', lacks(main, 'registerSchemesAsPrivileged'))
check('no http server in the app itself', lacks(main, 'createServer('))

// ── IPC surface ─────────────────────────────────────────────────────────────
const allowedIpc = [
  'dsh-desktop:get-settings',
  'dsh-desktop:choose-background',
  'dsh-desktop:clear-background',
  'dsh-desktop:set-fit',
  'dsh-desktop:set-mask',
  'dsh-desktop:debug-set-background',
]
const channels = main.split("ipcMain.handle('").slice(1).map((s) => s.slice(0, s.indexOf("'")))
const unknown = channels.filter((c) => !allowedIpc.includes(c))
check('IPC channels are the fixed allowlist', unknown.length === 0 && channels.length === allowedIpc.length,
  'channels=' + JSON.stringify(channels))
check('debug IPC gated by DEBUG env', has(main, "DSH_DESKTOP_DEBUG !== '1'"))
check('set-fit validates the value', has(main, "['cover', 'contain', 'repeat', 'center'].includes(fit)"))
check('set-mask clamps the value', has(main, 'Math.min(0.9, Math.max(0, Number(mask)'))
check('background path traversal guard', has(main, "name.includes('..')"))
check('background copy is file-scoped', has(main, 'fs.copyFileSync(sourcePath, target)'))

// ── preload surface ─────────────────────────────────────────────────────────
const bridgeKeys = ['getSettings', 'chooseBackground', 'clearBackground', 'setFit', 'setMask', 'debugSetBackground', 'onSettingsChanged']
const missing = bridgeKeys.filter((k) => !has(preload, '  ' + k + ':'))
check('preload exposes exactly the fixed bridge API', missing.length === 0 && has(preload, 'contextBridge.exposeInMainWorld'),
  'missing=' + JSON.stringify(missing))
const badPreloadLines = preload.split('\n').filter((l) => l.includes('ipcRenderer') && !l.includes('dsh-desktop:') && !l.includes('require('))
check('preload channels are fixed literals only', badPreloadLines.length === 0,
  'lines=' + JSON.stringify(badPreloadLines))

// ── injected page script surface ────────────────────────────────────────────
check('inject.js makes no network calls', lacks(inject, 'fetch(') && lacks(inject, 'XMLHttpRequest') && lacks(inject, 'new WebSocket('))
check('inject.js builds UI via safe DOM APIs', lacks(inject, 'insertAdjacentHTML'))

// ── external navigation ─────────────────────────────────────────────────────
check('new windows denied', has(main, "action: 'deny'"))
const extIdx = main.indexOf('shell.openExternal')
const guardIdx = main.indexOf('https?:')
check('external links restricted to http(s)', extIdx > 0 && guardIdx > 0 && guardIdx < extIdx)

console.log('')
if (failures > 0) {
  console.log('SECURITY AUDIT FAILED: ' + failures + ' check(s) failed')
  process.exit(1)
}
console.log('SECURITY AUDIT PASSED: all checks clean')
