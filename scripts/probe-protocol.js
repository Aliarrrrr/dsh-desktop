'use strict'
// Probe: img/fetch on dshbg:// from an http-origin page (the real webui).
const { app, protocol, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

protocol.registerSchemesAsPrivileged([
  { scheme: 'dshbg', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
])

app.whenReady().then(async () => {
  const imgPath = path.join(__dirname, '..', 'probe.png')
  protocol.handle('dshbg', (request) => {
    console.log('[handler] url:', request.url)
    return new Response(fs.readFileSync(imgPath), { headers: { 'content-type': 'image/png' } })
  })
  const win = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, contextIsolation: true } })
  await win.loadURL('http://127.0.0.1:3080/')
  await new Promise((resolve) => setTimeout(resolve, 6000))
  const result = await win.webContents.executeJavaScript(
    '(async () => {' +
    '  const out = {};' +
    '  const u = "dshbg://test.png/";' +
    '  try { const res = await fetch(u); const buf = await res.arrayBuffer(); out.fetch = res.status + " bytes=" + buf.byteLength; }' +
    '  catch (e) { out.fetch = "ERR " + e.message; }' +
    '  out.img = await new Promise((resolve) => {' +
    '    const img = new Image();' +
    '    img.onload = () => resolve("loaded w=" + img.naturalWidth);' +
    '    img.onerror = () => resolve("error");' +
    '    setTimeout(() => resolve("timeout"), 4000);' +
    '    img.src = u;' +
    '  });' +
    '  out.imgCors = await new Promise((resolve) => {' +
    '    const img = new Image();' +
    '    img.crossOrigin = "anonymous";' +
    '    img.onload = () => resolve("loaded w=" + img.naturalWidth);' +
    '    img.onerror = () => resolve("error");' +
    '    setTimeout(() => resolve("timeout"), 4000);' +
    '    img.src = u;' +
    '  });' +
    '  out.resources = performance.getEntriesByType("resource").filter((e) => e.name.includes("dshbg")).map((e) => e.name + " ts=" + e.transferSize);' +
    '  return out;' +
    '})()',
    true,
  )
  console.log('PROBE RESULT:', JSON.stringify(result, null, 1))
  app.exit(0)
})
