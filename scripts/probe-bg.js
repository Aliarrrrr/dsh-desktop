'use strict'
// Bisect: root background-image vs ::after veil painting, with the full
// surface-transparency override set (same as inject.js).
// Phase 1: image only. Phase 2: image + white veil at 0.8.
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: true, width: 1280, height: 800, webPreferences: { contextIsolation: true, nodeIntegration: false } })
  await win.loadURL('http://127.0.0.1:3080/')
  await new Promise((r) => setTimeout(r, 8000))
  const imgPath = path.join(__dirname, '..', 'smoke-bg.png')
  const dataUrl = 'data:image/png;base64,' + fs.readFileSync(imgPath).toString('base64')

  await win.webContents.executeJavaScript(
    '(function(){var s=document.createElement("style");s.id="t1";' +
    's.textContent="html.dsh-desktop-bg{background-image:url(' + "'" + dataUrl + "'" + ');background-repeat:no-repeat;background-position:center;background-attachment:fixed;background-size:cover;}html.dsh-desktop-bg body{background:transparent !important;--dsw-alias-bg-base:transparent !important;--dsw-alias-bg-layer-1:transparent !important;--dsw-specific-sidebar-fill:transparent !important;}";' +
    'document.head.appendChild(s);document.documentElement.classList.add("dsh-desktop-bg");})()',
    true,
  )
  await new Promise((r) => setTimeout(r, 1200))
  const shot1 = await win.webContents.capturePage()
  fs.writeFileSync(path.join(__dirname, '..', 'probe-shot-1.png'), shot1.toPNG())
  console.log('phase1 captured (image only)')

  await win.webContents.executeJavaScript(
    '(function(){var s=document.getElementById("t1");' +
    's.textContent=s.textContent+"html.dsh-desktop-bg::after{content:\'v\';position:fixed;inset:0;background:rgb(255,255,255);opacity:0.8;pointer-events:none;z-index:2147483646;}";})()',
    true,
  )
  await new Promise((r) => setTimeout(r, 1200))
  const shot2 = await win.webContents.capturePage()
  fs.writeFileSync(path.join(__dirname, '..', 'probe-shot-2.png'), shot2.toPNG())
  console.log('phase2 captured (image + veil)')
  app.exit(0)
})
