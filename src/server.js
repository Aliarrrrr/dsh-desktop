'use strict'

/**
 * Server manager: owns the dsh web server child process.
 *
 * The server is the same process the PowerShell workflow starts
 * (`dsh web`), spawned here as a child. Command resolution order:
 *   1. $env:DSH_DESKTOP_SERVER_CMD (+ optional DSH_DESKTOP_SERVER_ARGS)
 *   2. the sibling deepseek-harness checkout (repo bin + node from PATH)
 *   3. `npx --yes @deepseek-ai/dsh web` (requires Node + network)
 * The server binds an OS-assigned port (--port 0) and prints its URL as
 * `dsh web: http://127.0.0.1:<port>`; readiness is confirmed by polling.
 */

const { spawn } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const URL_RE = /dsh web: http:\/\/127\.0\.0\.1:(\d+)/
const HOME_PROBE_RE = /<div id="root">/

/** Resolve the spawn command for the dsh web server. */
function resolveServerCommand(appRoot) {
  const envCmd = process.env.DSH_DESKTOP_SERVER_CMD
  if (envCmd) {
    const args = (process.env.DSH_DESKTOP_SERVER_ARGS || '--profile web --port 0')
      .split(/\s+/).filter(Boolean)
    return { cmd: envCmd, args, cwd: process.cwd(), source: 'env' }
  }

  // Bundled runtime (packaged installs: resources/bundle; dev: <appRoot>/bundle):
  // portable Node + the published dsh CLI, fully standalone without system Node.
  const bundleRoots = [process.resourcesPath, appRoot].filter(Boolean)
  for (const bundleRoot of bundleRoots) {
    const nodeExe = path.join(bundleRoot, 'bundle', 'node-runtime', 'node.exe')
    const bin = path.join(bundleRoot, 'bundle', 'dsh-runtime', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
    if (fs.existsSync(nodeExe) && fs.existsSync(bin)) {
      return { cmd: nodeExe, args: [bin, '--profile', 'web', '--port', '0'], cwd: path.join(bundleRoot, 'bundle', 'dsh-runtime'), source: 'bundled' }
    }
  }

  const envRepo = process.env.DSH_DESKTOP_REPO
  if (envRepo && fs.existsSync(path.join(envRepo, 'apps', 'cli', 'lib', 'bin.js'))) {
    return { cmd: 'node', args: [path.join(envRepo, 'apps', 'cli', 'lib', 'bin.js'), '--profile', 'web', '--port', '0'], cwd: envRepo, source: 'repo' }
  }

  // Walk upward from the app root looking for a deepseek-harness checkout
  // (dev tree, win-unpacked, or installed layouts).
  let dir = path.resolve(appRoot)
  for (let depth = 0; depth < 6; depth++) {
    const repo = path.join(dir, 'deepseek-harness')
    const bin = path.join(repo, 'apps', 'cli', 'lib', 'bin.js')
    if (fs.existsSync(bin)) {
      return { cmd: 'node', args: [bin, '--profile', 'web', '--port', '0'], cwd: repo, source: 'repo' }
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }

  return { cmd: 'npx', args: ['--yes', '@deepseek-ai/dsh', 'web', '--port', '0'], cwd: appRoot, source: 'npx' }
}

/** Probe an authority for the harness UI: true when it answers with the webui root. */
async function probeUi(port, timeoutMs = 800) {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch('http://127.0.0.1:' + port + '/', { signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok) return false
    const text = await res.text()
    return HOME_PROBE_RE.test(text)
  } catch {
    return false
  }
}

/** The spawned server lifecycle: spawn, readiness, URL, teardown. */
class DshServer {
  constructor({ log = console.log } = {}) {
    this.log = log
    this.child = null
    this.url = null
    this.exited = false
    this.stderrTail = []
    this.onExit = null
  }

  /** Spawn the server and resolve with its URL when ready (or throw). */
  async start(appRoot) {
    // Reuse an already-running harness on the default port before spawning a
    // second server (the same session store serves both).
    if (process.env.DSH_DESKTOP_NO_REUSE !== '1' && await probeUi(3080)) {
      this.url = 'http://127.0.0.1:3080'
      this.log('[server] reused running server at', this.url)
      return this.url
    }

    const spec = resolveServerCommand(appRoot)
    this.log('[server] command:', spec.source, spec.cmd, spec.args.join(' '))

    const env = { ...process.env, DSH_NO_UPDATE_NOTIFIER: '1' }
    // When the desktop app was itself started under a restricted sandbox
    // (dev smoke tests), point DSH_HOME into the sandbox workspace.
    if (!env.DSH_HOME && process.env.DSH_DESKTOP_DSH_HOME) {
      env.DSH_HOME = process.env.DSH_DESKTOP_DSH_HOME
    }

    const child = spawn(spec.cmd, spec.args, {
      cwd: spec.cwd,
      env,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    this.child = child
    child.on('error', (error) => {
      this.log('[server] spawn error:', error.message)
      this.exited = true
    })
    child.on('exit', (code, signal) => {
      this.exited = true
      this.log('[server] exited:', code, signal)
    })
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk) => {
      const match = URL_RE.exec(chunk)
      if (match) {
        this.url = 'http://127.0.0.1:' + match[1]
        this.log('[server] url:', this.url)
      }
    })
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk) => {
      this.stderrTail.push(chunk)
      if (this.stderrTail.length > 60) this.stderrTail.shift()
    })

    // Readiness: URL line, confirmed by HTTP probe.
    const deadline = Date.now() + 60000
    while (Date.now() < deadline) {
      if (this.url) {
        if (await probeUi(new URL(this.url).port)) return this.url
      }
      if (this.exited) break
      await new Promise((resolve) => setTimeout(resolve, 400))
    }

    const tail = this.stderrTail.join('').slice(-4000)
    const error = new Error(
      this.exited
        ? 'dsh web server exited during startup.' + (tail ? '\n\n' + tail : '')
        : 'dsh web server did not become ready in time.' + (tail ? '\n\n' + tail : ''),
    )
    this.stop()
    throw error
  }

  /** Terminate the child process tree. */
  stop() {
    if (!this.child || this.child.killed) return
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(this.child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
      } else {
        this.child.kill('SIGTERM')
      }
    } catch (error) {
      this.log('[server] stop error:', error.message)
    }
  }
}

module.exports = { DshServer, resolveServerCommand, probeUi }
