'use strict'

// Preload bridge: exposes a tiny, explicit API to the page world. The webui
// itself never sees this; only the injected desktop settings UI calls it.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('dshDesktop', {
  getSettings: () => ipcRenderer.invoke('dsh-desktop:get-settings'),
  chooseBackground: () => ipcRenderer.invoke('dsh-desktop:choose-background'),
  clearBackground: () => ipcRenderer.invoke('dsh-desktop:clear-background'),
  setFit: (fit) => ipcRenderer.invoke('dsh-desktop:set-fit', fit),
  setMask: (mask) => ipcRenderer.invoke('dsh-desktop:set-mask', mask),
  debugSetBackground: (filePath) => ipcRenderer.invoke('dsh-desktop:debug-set-background', filePath),
  onSettingsChanged: (callback) => {
    ipcRenderer.on('dsh-desktop:settings-changed', (_event, settings) => callback(settings))
  },
})
