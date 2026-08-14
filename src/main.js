'use strict'

/**
 * dsh-desktop main process.
 *
 * Responsibilities:
 *  - single-instance lock
 *  - spawn the dsh web server (see server.js) and open one BrowserWindow
 *  - persist desktop settings (background image, fit, mask) under userData
 *  - serve the background to the page as a data: URL (no custom scheme)
 *  - apply the background through the injected page script
 *  - DSH_DESKTOP_SMOKE=1 runs an automated end-to-end check and exits
 */

const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { DshServer } = require('./server.js')

const APP_ROOT = path.join(__dirname, '..')
const SMOKE = process.env.DSH_DESKTOP_SMOKE === '1'
const SMOKE_BG = process.env.DSH_DESKTOP_SMOKE_BG || null

// Smoke runs keep all state out of the real profile dirs. Packaged apps
// cannot write into the asar, so packaged smokes use a temp root.
const SMOKE_ROOT = app.isPackaged
  ? path.join(app.getPath('temp'), 'dsh-desktop-smoke')
  : APP_ROOT
if (SMOKE) {
  app.setPath('userData', path.join(SMOKE_ROOT, '.smoke-userdata'))
  if (!process.env.DSH_DESKTOP_DSH_HOME) {
    process.env.DSH_DESKTOP_DSH_HOME = path.join(SMOKE_ROOT, '.smoke-dsh-home')
  }
}

const server = new DshServer()
let mainWindow = null
let settings = null
let settingsPath = null

// ── settings persistence ────────────────────────────────────────────────────

function loadSettings() {
  settingsPath = path.join(app.getPath('userData'), 'settings.json')
  const defaults = { image: null, fit: 'cover', mask: 0.15 }
  try {
    const parsed = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
    return { ...defaults, ...parsed }
  } catch {
    return defaults
  }
}

function saveSettings() {
  try {
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true })
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8')
  } catch (error) {
    console.error('[desktop] failed to save settings:', error.message)
  }
}

// ── background images ───────────────────────────────────────────────────────

function backgroundsDir() {
  return path.join(app.getPath('userData'), 'backgrounds')
}

/** Import a user-picked image file into the managed backgrounds directory. */
function importBackground(sourcePath) {
  const ext = path.extname(sourcePath).toLowerCase() || '.png'
  const id = crypto.createHash('sha1').update(sourcePath + Date.now()).digest('hex').slice(0, 16)
  const target = path.join(backgroundsDir(), id + ext)
  fs.mkdirSync(backgroundsDir(), { recursive: true })
  fs.copyFileSync(sourcePath, target)
  return id + ext
}

/** Resolve a stored image name to its managed file path, or null when unsafe. */
function backgroundFilePath(imageName) {
  if (!imageName || typeof imageName !== 'string') return null
  const name = path.basename(imageName)
  if (name !== imageName || name.includes('..')) return null
  return path.join(backgroundsDir(), name)
}

/** Encode a stored background as a data: URL (null when missing). */
function imageDataUrl(imageName) {
  const file = backgroundFilePath(imageName)
  if (!file || !fs.existsSync(file)) return null
  const ext = path.extname(file).slice(1).toLowerCase().replace('jpg', 'jpeg')
  return 'data:image/' + ext + ';base64,' + fs.readFileSync(file).toString('base64')
}

/** Settings as the page sees them: identity plus a ready-to-use data URL. */
function settingsForPage() {
  return {
    image: settings.image,
    imageData: settings.image ? imageDataUrl(settings.image) : null,
    fit: settings.fit,
    mask: settings.mask,
  }
}

function broadcastSettings() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('dsh-desktop:settings-changed', settingsForPage())
  }
}

/** Push the current background into the page (via the injected script). */
async function applyBackground() {
  const contents = mainWindow && mainWindow.webContents
  if (!contents || contents.isDestroyed()) return
  try {
    await contents.executeJavaScript(
      'window.__dshDesktopApplyBackground(' + JSON.stringify(settingsForPage()) + ')',
      true,
    )
  } catch (error) {
    console.error('[desktop] applyBackground failed:', error.message)
  }
}

// ── IPC ─────────────────────────────────────────────────────────────────────

function registerIpc() {
  ipcMain.handle('dsh-desktop:get-settings', () => settingsForPage())

  ipcMain.handle('dsh-desktop:choose-background', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择背景图片',
      properties: ['openFile'],
      filters: [
        { name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] },
      ],
    })
    if (result.canceled || result.filePaths.length === 0) return settingsForPage()
    try {
      settings.image = importBackground(result.filePaths[0])
      saveSettings()
      broadcastSettings()
      await applyBackground()
    } catch (error) {
      dialog.showErrorBox('背景图片设置失败', error.message)
    }
    return settingsForPage()
  })

  ipcMain.handle('dsh-desktop:clear-background', async () => {
    settings.image = null
    saveSettings()
    broadcastSettings()
    await applyBackground()
    return settingsForPage()
  })

  ipcMain.handle('dsh-desktop:set-fit', async (_event, fit) => {
    if (['cover', 'contain', 'repeat', 'center'].includes(fit)) {
      settings.fit = fit
      saveSettings()
      broadcastSettings()
      await applyBackground()
    }
    return settingsForPage()
  })

  ipcMain.handle('dsh-desktop:debug-set-background', async (_event, filePath) => {
    if (process.env.DSH_DESKTOP_DEBUG !== '1' || typeof filePath !== 'string') return settingsForPage()
    try {
      settings.image = importBackground(filePath)
      saveSettings()
      broadcastSettings()
      await applyBackground()
    } catch (error) {
      console.error('[desktop] debug-set-background failed:', error.message)
    }
    return settingsForPage()
  })

  ipcMain.handle('dsh-desktop:set-mask', async (_event, mask) => {
    const clamped = Math.min(0.9, Math.max(0, Number(mask) || 0))
    settings.mask = clamped
    saveSettings()
    broadcastSettings()
    await applyBackground()
    return settingsForPage()
  })
}

// ── window ──────────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#0f1218',
    icon: path.join(APP_ROOT, 'assets', 'icon.png'),
    autoHideMenuBar: true,
    title: 'DeepSeek Harness',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  })

  mainWindow.loadFile(path.join(APP_ROOT, 'assets', 'splash.html'))

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  // Inject the desktop settings UI on every page load (SPA navigation keeps
  // it, full reloads re-run this).
  mainWindow.webContents.on('dom-ready', () => {
    const injectScript = fs.readFileSync(path.join(__dirname, 'inject.js'), 'utf8')
    mainWindow.webContents.executeJavaScript(injectScript, true)
      .then(() => {
        if (process.env.DSH_DESKTOP_DEBUG === '1') {
          return mainWindow.webContents.executeJavaScript(
            '({ bridge: typeof window.dshDesktop, gear: !!document.getElementById("dsh-desktop-gear"), panel: !!document.getElementById("dsh-desktop-ui") })',
            true,
          ).then((probe) => console.log('[desktop] inject probe:', JSON.stringify(probe)))
        }
        return null
      })
      .catch((error) => console.error('[desktop] inject failed:', error.message))
  })

  mainWindow.webContents.on('did-finish-load', () => {
    setTimeout(() => applyBackground().catch(() => {}), 800)
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // New windows are always denied; only http/https links may open in the
    // system browser. Everything else (file:, custom schemes, javascript:)
    // is dropped.
    if (/^https?:\/\//i.test(url)) {
      require('electron').shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// ── server lifecycle ────────────────────────────────────────────────────────

async function startServerAndNavigate() {
  try {
    const url = await server.start(APP_ROOT)
    if (!mainWindow || mainWindow.isDestroyed()) return
    await mainWindow.loadURL(url)
  } catch (error) {
    console.error('[desktop] server error:', error.message)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadURL(
        'data:text/html;charset=utf-8,' + encodeURIComponent(
          '<h2 style="font-family:sans-serif">无法启动 dsh web 服务</h2><pre style="font-family:monospace;white-space:pre-wrap">' +
          String(error.message).replace(/&/g, '&amp;').replace(/</g, '&lt;') +
          '</pre>',
        ),
      )
    }
  }
}

// ── smoke test ──────────────────────────────────────────────────────────────

async function runSmoke() {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  const log = (line) => console.log('[smoke] ' + line)
  const evalWithTimeout = (code, ms) => Promise.race([
    mainWindow.webContents.executeJavaScript(code, true),
    new Promise((_, reject) => setTimeout(() => reject(new Error('executeJavaScript timed out')), ms)),
  ])
  try {
    // Wait for the real webui page (not the splash): http origin + #root.
    const deadline = Date.now() + 90000
    let state = null
    while (Date.now() < deadline) {
      try {
        state = await evalWithTimeout(
          '({ url: location.href, hasRoot: !!document.getElementById("root") })',
          4000,
        )
        if (state.url.startsWith('http') && state.hasRoot) break
      } catch {
        // page mid-navigation or renderer busy; retry
      }
      await wait(500)
    }
    if (!state || !state.url.startsWith('http') || !state.hasRoot) {
      throw new Error('webui page never became ready (last state: ' + JSON.stringify(state) + ')')
    }
    await wait(2000)
    state = await evalWithTimeout(
      '({ title: document.title, hasRoot: !!document.getElementById("root"), ui: !!document.getElementById("dsh-desktop-ui"), gear: !!document.getElementById("dsh-desktop-gear") })',
      8000,
    )
    log('page: ' + JSON.stringify(state))

    if (process.env.DSH_DESKTOP_DEBUG === '1') {
      const probes = await evalWithTimeout(
        '(async () => {' +
        '  const out = {};' +
        '  const el = document.elementFromPoint(12, 12);' +
        '  const chain = [];' +
        '  let n = el;' +
        '  for (let i = 0; n && i < 14; i++) {' +
        '    const cs = getComputedStyle(n);' +
        '    const cn = typeof n.className === "string" ? n.className : (n.className && n.className.baseVal) || "";' +
        '    chain.push(n.tagName + "|" + String(cn).slice(0, 50) + "|bg=" + cs.backgroundColor + "|img=" + cs.backgroundImage.slice(0, 40));' +
        '    n = n.parentElement;' +
        '  }' +
        '  out.chain = chain;' +
        '  out.imageLoad = await new Promise((resolve) => {' +
        '    const img = new Image();' +
        '    const t = setTimeout(() => resolve("timeout"), 5000);' +
        '    img.onload = () => { clearTimeout(t); resolve("loaded"); };' +
        '    img.onerror = () => { clearTimeout(t); resolve("error"); };' +
        '    img.src = getComputedStyle(document.documentElement).backgroundImage.replace(/^url("?|"?)$/g, "");' +
        '  });' +
        '  out.htmlBgImg = getComputedStyle(document.documentElement).backgroundImage.slice(0, 60);' +
        '  const targets = [];' +
        '  document.querySelectorAll("*").forEach((el) => {' +
        '    const c = getComputedStyle(el).backgroundColor;' +
        '    if (c === "rgb(249, 250, 251)") targets.push(el);' +
        '  });' +
        '  out.sidebarTargets = targets.length;' +
        '  const candidates = ["--dsw-alias-bg-base", "--dsw-alias-bg-layer-1", "--dsw-alias-bg-layer-2", "--dsw-alias-bg-layer-3", "--dsw-alias-bg-overlay", "--dsw-alias-bg-module-platform", "--dsw-alias-bg-mask-1", "--dsw-static-neutral-bluish-00", "--dsw-static-neutral-bluish-01", "--dsw-static-neutral-bluish-02", "--dsw-static-neutral-bluish-03", "--dsw-static-neutral-bluish-04", "--dsw-static-neutral-bluish-05"];' +
        '  const hits = [];' +
        '  candidates.forEach((v) => {' +
        '    document.body.style.setProperty(v, "rgb(255, 0, 0)", "important");' +
        '    const red = targets.filter((el) => getComputedStyle(el).backgroundColor === "rgb(255, 0, 0)").length;' +
        '    if (red > 0) hits.push(v + "=" + red + "/" + targets.length);' +
        '    document.body.style.removeProperty(v);' +
        '  });' +
        '  out.tokenHits = hits;' +
        '  const walk = (list, out, el) => {' +
        '    for (const r of list || []) {' +
        '      if (r.cssRules) { walk(r.cssRules, out, el); continue; }' +
        '      if (r.style && r.selectorText && el.matches(r.selectorText)) {' +
        '        const bg = r.style.backgroundColor;' +
        '        if (bg && bg !== "transparent" && bg !== "rgba(0, 0, 0, 0)") out.push(r.selectorText + " => " + bg);' +
        '      }' +
        '    }' +
        '  };' +
        '  const rule = [];' +
        '  targets.forEach((el) => {' +
        '    if (el.style && el.style.backgroundColor && el.style.backgroundColor !== "transparent") rule.push("INLINE => " + el.style.backgroundColor);' +
        '    const roots = [document, el.getRootNode()];' +
        '    roots.forEach((root) => {' +
        '      (root.adoptedStyleSheets || []).forEach((sheet) => {' +
        '        try { walk(Array.from(sheet.cssRules || []), rule, el); } catch (e) { rule.push("ADOPTED-ERR " + e.message); }' +
        '      });' +
        '      try {' +
        '        Array.from(root.styleSheets || []).forEach((sheet) => {' +
        '          let rules = [];' +
        '          try { rules = Array.from(sheet.cssRules || []); } catch (e) { return; }' +
        '          walk(rules, rule, el);' +
        '        });' +
        '      } catch (e) { rule.push("SHEETS-ERR " + e.message); }' +
        '    });' +
        '    rule.push("root=" + (el.getRootNode() === document ? "document" : "shadow"));' +
        '  });' +
        '  out.matchingRules = rule;' +
        '  const sub = [];' +
        '  const subWalk = (list) => {' +
        '    for (const r of list || []) {' +
        '      if (r.cssRules) { subWalk(r.cssRules); continue; }' +
        '      if (r.selectorText && (r.selectorText.includes("sidebar") || r.selectorText.includes("frame") || r.selectorText.includes("_root") || r.selectorText.includes("quietBars"))) {' +
        '        sub.push(r.selectorText.slice(0, 80) + " => bg=" + (r.style && r.style.backgroundColor) + " img=" + (r.style && r.style.backgroundImage || "").slice(0, 20));' +
        '      }' +
        '    }' +
        '  };' +
        '  for (const sheet of document.styleSheets) {' +
        '    try { subWalk(Array.from(sheet.cssRules || [])); } catch (e) { sub.push("SKIP " + (sheet.href || "inline")); }' +
        '  }' +
        '  document.adoptedStyleSheets.forEach((sheet) => { try { subWalk(Array.from(sheet.cssRules || [])); } catch (e) { sub.push("SKIP adopted"); } });' +
        '  out.substrRules = sub;' +
        '  return out;' +
        '})()',
        12000,
      )
      log('probes: ' + JSON.stringify(probes, null, 1))

      const uiProbe = await evalWithTimeout(
        '(async () => {' +
        '  const panel = document.getElementById("dsh-desktop-ui");' +
        '  panel.classList.add("open");' +
        '  const gear = document.getElementById("dsh-desktop-gear");' +
        '  const r = gear.getBoundingClientRect();' +
        '  await window.dshDesktop.debugSetBackground(' + JSON.stringify(SMOKE_BG) + ');' +
        '  await new Promise((r) => setTimeout(r, 500));' +
        '  const s = await window.dshDesktop.setMask(0.4);' +
        '  const fade1 = getComputedStyle(document.documentElement).backgroundImage;' +
        '  const s2 = await window.dshDesktop.setMask(0.8);' +
        '  const fade2 = getComputedStyle(document.documentElement).backgroundImage;' +
        '  await window.dshDesktop.setMask(0.3);' +
        '  await new Promise((r) => setTimeout(r, 400));' +
        '  return {' +
        '    gearRect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },' +
        '    panelDisplay: getComputedStyle(panel).display,' +
        '    maskAfter: s.mask,' +
        '    fade1: fade1.slice(0, 66),' +
        '    fade2: fade2.slice(0, 66),' +
        '    panelPreviewBg: getComputedStyle(panel.querySelector(".preview")).backgroundImage.slice(0, 40),' +
        '  };' +
        '})()',
        12000,
      )
      log('ui probe: ' + JSON.stringify(uiProbe))
      const shotUi = await mainWindow.webContents.capturePage()
      fs.writeFileSync(path.join(SMOKE_ROOT, 'smoke-shot-ui.png'), shotUi.toPNG())
      log('screenshot: smoke-shot-ui.png (panel open)')

      // Runtime security probes: the page world must be isolated from Node
      // and expose only the fixed bridge surface.
      const secProbe = await evalWithTimeout(
        '(async () => {' +
        '  const out = {};' +
        '  out.requireUndefined = typeof window.require === "undefined";' +
        '  out.processUndefined = typeof window.process === "undefined";' +
        '  out.ipcRendererUndefined = typeof window.ipcRenderer === "undefined";' +
        '  out.bridgeKeys = Object.keys(window.dshDesktop || {}).sort();' +
        '  out.noEval = typeof window.eval === "function";' +
        '  const before = window.dshDesktop.chooseBackground;' +
        '  window.dshDesktop.chooseBackground = () => "pwned";' +
        '  out.bridgeImmutable = window.dshDesktop.chooseBackground === before;' +
        '  return out;' +
        '})()',
        10000,
      )
      log('security: ' + JSON.stringify(secProbe))

      // Theme-plugin compatibility: (1) default state without an image must
      // be the normal theme; (2) a simulated theme plugin's surface/label
      // tokens must apply with no image; (3) with an image, surfaces give way
      // to the background while the theme's non-surface tokens still apply.
      const compat = await evalWithTimeout(
        '(async () => {' +
        '  const out = {};' +
        '  const countBg = (rgb) => { let n = 0; document.querySelectorAll("*").forEach((el) => { if (getComputedStyle(el).backgroundColor === rgb) n++; }); return n; };' +
        '  const wait = (ms) => new Promise((r) => setTimeout(r, ms));' +
        '  await window.dshDesktop.clearBackground();' +
        '  document.documentElement.classList.remove("dsh-desktop-bg");' +
        '  await wait(300);' +
        '  const defaultBodyBg = getComputedStyle(document.body).backgroundColor;' +
        '  out.defaultBodyBg = defaultBodyBg;' +
        '  out.defaultSurfaces = countBg(defaultBodyBg);' +
        '  document.body.style.setProperty("--dsw-alias-bg-base", "rgb(180, 60, 220)");' +
        '  document.body.style.setProperty("--dsw-specific-sidebar-fill", "rgb(0, 200, 100)");' +
        '  document.body.style.setProperty("--dsw-alias-label-primary", "rgb(255, 0, 0)");' +
        '  await wait(300);' +
        '  out.themeSurfaces = countBg("rgb(180, 60, 220)");' +
        '  out.themeSidebar = countBg("rgb(0, 200, 100)");' +
        '  out.themeLabelColor = getComputedStyle(document.body).color;' +
        '  await window.dshDesktop.debugSetBackground(' + JSON.stringify(SMOKE_BG) + ');' +
        '  await wait(600);' +
        '  out.afterImageSurfaces = countBg("rgb(180, 60, 220)");' +
        '  out.afterImageSidebar = countBg("rgb(0, 200, 100)");' +
        '  out.afterImageLabelColor = getComputedStyle(document.body).color;' +
        '  out.afterImageHtmlBg = getComputedStyle(document.documentElement).backgroundImage.slice(0, 30);' +
        '  await window.dshDesktop.clearBackground();' +
        '  document.body.style.removeProperty("--dsw-alias-bg-base");' +
        '  document.body.style.removeProperty("--dsw-specific-sidebar-fill");' +
        '  document.body.style.removeProperty("--dsw-alias-label-primary");' +
        '  return out;' +
        '})()',
        20000,
      )
      log('theme-compat: ' + JSON.stringify(compat))
    }

    const shot = await mainWindow.webContents.capturePage()
    fs.writeFileSync(path.join(SMOKE_ROOT, 'smoke-shot.png'), shot.toPNG())
    log('screenshot: ' + path.join(SMOKE_ROOT, 'smoke-shot.png'))

    if (SMOKE_BG) {
      settings.image = importBackground(SMOKE_BG)
      saveSettings()
      await applyBackground()
      await wait(1500)
      const bgPayload = settingsForPage()
      const bgState = await evalWithTimeout(
        '(async (payload) => {' +
        '  const el = document.elementFromPoint(30, 30);' +
        '  const cs = getComputedStyle(el);' +
        '  const htmlBg = getComputedStyle(document.documentElement).backgroundImage;' +
        '  const imgLoad = await new Promise((res) => {' +
        '    const img = new Image();' +
        '    const t = setTimeout(() => res("timeout"), 3000);' +
        '    img.onload = () => { clearTimeout(t); res("ok"); };' +
        '    img.onerror = () => { clearTimeout(t); res("error"); };' +
        '    img.src = payload.imageData;' +
        '  });' +
        '  return {' +
        '    htmlBg: htmlBg.slice(0, 66),' +
        '    imgLoad: imgLoad,' +
        '    panel: !!document.getElementById("dsh-desktop-ui"),' +
        '    htmlClass: document.documentElement.className,' +
        '    corner: el.tagName + "|" + String(el.className).slice(0, 50) + "|bg=" + cs.backgroundColor,' +
        '    fadeInBg: htmlBg.slice(0, 120),' +
        '  };' +
        '})(' + JSON.stringify(bgPayload) + ')',
        10000,
      )
      log('background: ' + JSON.stringify(bgState))
      const shot2 = await mainWindow.webContents.capturePage()
      fs.writeFileSync(path.join(SMOKE_ROOT, 'smoke-shot-bg.png'), shot2.toPNG())
      log('screenshot: smoke-shot-bg.png')
    }

    const persisted = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
    log('persisted settings: ' + JSON.stringify(persisted))
    log('SMOKE OK')
    server.stop()
    await wait(500)
    app.exit(0)
  } catch (error) {
    log('SMOKE FAILED: ' + error.message)
    server.stop()
    app.exit(1)
  }
}

// ── app lifecycle ───────────────────────────────────────────────────────────

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    settings = loadSettings()
    registerIpc()

    const menuTemplate = [
      {
        label: '编辑',
        submenu: [
          { role: 'undo', label: '撤销' },
          { role: 'redo', label: '重做' },
          { type: 'separator' },
          { role: 'cut', label: '剪切' },
          { role: 'copy', label: '复制' },
          { role: 'paste', label: '粘贴' },
          { role: 'selectAll', label: '全选' },
        ],
      },
      {
        label: '视图',
        submenu: [
          { role: 'reload', label: '重新加载' },
          { role: 'forceReload', label: '强制重新加载' },
          { role: 'toggleDevTools', label: '开发者工具' },
          { type: 'separator' },
          { role: 'resetZoom', label: '实际大小' },
          { role: 'zoomIn', label: '放大' },
          { role: 'zoomOut', label: '缩小' },
          { type: 'separator' },
          { role: 'togglefullscreen', label: '全屏' },
        ],
      },
    ]
    Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate))

    createWindow()
    void startServerAndNavigate()

    app.on('before-quit', () => server.stop())

    if (SMOKE) void runSmoke()
  })

  app.on('window-all-closed', () => {
    server.stop()
    app.quit()
  })
}
