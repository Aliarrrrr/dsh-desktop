'use strict'

// Bundle the dsh web server runtime (published @deepseek-ai/dsh + portable
// Node) into bundle/, so packaged installs run fully standalone:
//   - bundle/dsh-runtime     npm install --omit=dev @deepseek-ai/dsh
//   - bundle/node-runtime    portable Node for Windows x64
// Run: node scripts/bundle-server.mjs [--force]

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const bundleDir = path.join(root, 'bundle')
const runtimeDir = path.join(bundleDir, 'dsh-runtime')
const nodeDir = path.join(bundleDir, 'node-runtime')
const force = process.argv.includes('--force')

const NODE_VERSION = 'v22.19.0'
const NODE_URL = 'https://nodejs.org/dist/' + NODE_VERSION + '/node-' + NODE_VERSION + '-win-x64.zip'
const DSH_PACKAGE = '@deepseek-ai/dsh'

function sh(cmd, args, opts = {}) {
  execFileSync(cmd, args, { stdio: 'inherit', ...opts })
}

console.log('[bundle] dsh runtime dir:', runtimeDir)
if (!force && fs.existsSync(path.join(runtimeDir, 'node_modules', DSH_PACKAGE))) {
  console.log('[bundle] dsh-runtime already present; use --force to refresh')
} else {
  fs.rmSync(runtimeDir, { recursive: true, force: true })
  fs.mkdirSync(runtimeDir, { recursive: true })
  sh('npm', ['install', '--prefix', runtimeDir, DSH_PACKAGE, '--omit=dev', '--no-audit', '--no-fund', '--ignore-scripts'])
}

if (!force && fs.existsSync(path.join(nodeDir, 'node.exe'))) {
  console.log('[bundle] node-runtime already present; use --force to refresh')
} else {
  fs.rmSync(nodeDir, { recursive: true, force: true })
  const zipPath = path.join(bundleDir, 'node-' + NODE_VERSION + '-win-x64.zip')
  console.log('[bundle] downloading', NODE_URL)
  const res = await fetch(NODE_URL)
  if (!res.ok) throw new Error('download failed: HTTP ' + res.status)
  fs.writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()))
  const extractDir = path.join(bundleDir, 'node-' + NODE_VERSION + '-win-x64')
  fs.rmSync(extractDir, { recursive: true, force: true })
  sh('tar', ['-xf', zipPath, '-C', bundleDir])
  fs.renameSync(extractDir, nodeDir)
  fs.rmSync(zipPath, { force: true })
  console.log('[bundle] node:', sh('node', ['--version']) || '')
}

const size = fs.readdirSync(bundleDir, { recursive: true })
  .filter((f) => fs.statSync(path.join(bundleDir, f)).isFile())
  .reduce((sum, f) => sum + fs.statSync(path.join(bundleDir, f)).size, 0)
console.log('[bundle] done, total ' + Math.round(size / 1048576) + ' MB')
