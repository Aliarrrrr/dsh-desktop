'use strict'

/**
 * Injected page-world script (run via webContents.executeJavaScript).
 *
 * Two jobs:
 *  1. window.__dshDesktopApplyBackground(settings) — apply the background
 *     image + readability veil as CSS on <html>/<body>.
 *  2. the desktop settings UI (gear button + panel) — only when the preload
 *     bridge (window.dshDesktop) exists, so the webui stays byte-identical
 *     when opened in a plain browser.
 */

;(function () {
  var UI_ID = 'dsh-desktop-ui'

  if (!window.dshDesktop) return

  // ── background applier ──────────────────────────────────────────────────

  function luminanceOf(rgb) {
    var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb || '')
    if (!m) return null
    var r = +m[1] / 255, g = +m[2] / 255, b = +m[3] / 255
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }

  // The fade is the theme's base color blended INTO the background image
  // layer (a gradient overlay in background-image): raising the slider fades
  // the background toward the theme while the UI above stays crisp. The color
  // is captured once from the live theme, because after the first apply the
  // body background is transparent (our own override) and would read as dark.
  var cachedFade = null
  function fadeColor() {
    if (cachedFade) return cachedFade
    var lum = luminanceOf(getComputedStyle(document.body).backgroundColor)
    // Unknown (transparent page) defaults to the light theme's white.
    cachedFade = lum !== null && lum <= 0.5 ? [10, 12, 18] : [255, 255, 255]
    return cachedFade
  }

  window.__dshDesktopApplyBackground = function (settings) {
    var root = document.documentElement
    var styleId = 'dsh-desktop-bg-style'
    var styleEl = document.getElementById(styleId)
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = styleId
      document.head.appendChild(styleEl)
    }

    var imageUrl = (settings && settings.imageData) || null
    if (!imageUrl) {
      styleEl.textContent = ''
      root.classList.remove('dsh-desktop-bg')
      root.removeAttribute('data-dsh-bg-fit')
      cachedFade = null
      return
    }

    var fit = (settings && settings.fit) || 'cover'
    var fade = Math.min(0.9, Math.max(0, Number((settings && settings.mask) || 0)))
    var rgb = fadeColor()
    var fadeRgba = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + fade + ')'

    styleEl.textContent =
      'html.dsh-desktop-bg{' +
      'background-image:linear-gradient(' + fadeRgba + ',' + fadeRgba + '),url("' + imageUrl + '");' +
      'background-repeat:no-repeat;' +
      'background-position:center;' +
      'background-attachment:fixed;' +
      '}' +
      'html.dsh-desktop-bg[data-dsh-bg-fit="cover"]{background-size:cover;}' +
      'html.dsh-desktop-bg[data-dsh-bg-fit="contain"]{background-size:contain;}' +
      'html.dsh-desktop-bg[data-dsh-bg-fit="repeat"],html.dsh-desktop-bg[data-dsh-bg-fit="center"]{background-size:auto;}' +
      'html.dsh-desktop-bg body{background:transparent !important;' +
      '--dsw-alias-bg-base:transparent !important;' +
      '--dsw-alias-bg-layer-1:transparent !important;' +
      '--dsw-specific-sidebar-fill:transparent !important;}'

    root.classList.add('dsh-desktop-bg')
    root.setAttribute('data-dsh-bg-fit', fit)
  }

  // ── settings UI (idempotent) ────────────────────────────────────────────

  if (document.getElementById(UI_ID)) return

  var dark = (luminanceOf(getComputedStyle(document.body).backgroundColor) || 1) <= 0.5
  var fg = dark ? '#e8eaed' : '#1f2329'
  var muted = dark ? '#8a93a3' : '#6b7280'
  var surface = dark ? '#1a1f2a' : '#ffffff'
  var border = dark ? '#2c3442' : '#e3e6eb'

  var css = document.createElement('style')
  css.textContent =
    '#dsh-desktop-gear{' +
    'position:fixed;right:16px;bottom:16px;width:44px;height:44px;border-radius:50%;' +
    'background:rgba(15,18,24,.78);color:#fff;border:1px solid rgba(255,255,255,.14);' +
    'display:grid;place-items:center;cursor:pointer;z-index:2147483647;' +
    'box-shadow:0 4px 14px rgba(0,0,0,.28);transition:transform .15s ease;' +
    '}' +
    '#dsh-desktop-gear:hover{transform:scale(1.08);}' +
    '#dsh-desktop-ui{' +
    'position:fixed;right:16px;bottom:68px;width:300px;max-height:70vh;overflow:auto;' +
    'background:' + surface + ';color:' + fg + ';border:1px solid ' + border + ';' +
    'border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.32);' +
    'padding:16px;z-index:2147483647;font-family:-apple-system,"Segoe UI","Microsoft YaHei",sans-serif;' +
    'font-size:13px;line-height:1.5;display:none;' +
    '}' +
    '#dsh-desktop-ui.open{display:block;}' +
    '#dsh-desktop-ui h3{margin:0 0 12px;font-size:14px;font-weight:600;}' +
    '#dsh-desktop-ui .row{margin:10px 0;}' +
    '#dsh-desktop-ui .row>label{display:block;margin-bottom:6px;color:' + muted + ';}' +
    '#dsh-desktop-ui select,#dsh-desktop-ui input[type=range]{width:100%;}' +
    '#dsh-desktop-ui button{' +
    'background:' + (dark ? '#232b3a' : '#f2f4f7') + ';color:' + fg + ';border:1px solid ' + border + ';' +
    'border-radius:8px;padding:6px 12px;cursor:pointer;font-size:13px;' +
    '}' +
    '#dsh-desktop-ui button:hover{filter:brightness(1.08);}' +
    '#dsh-desktop-ui .preview{' +
    'width:100%;height:96px;border-radius:8px;border:1px solid ' + border + ';' +
    'background:#0f1218 center/cover no-repeat;margin-bottom:8px;' +
    '}' +
    '#dsh-desktop-ui .note{margin-top:12px;color:' + muted + ';font-size:12px;}' +
    '#dsh-desktop-ui .close{float:right;cursor:pointer;color:' + muted + ';font-size:16px;line-height:1;}'

  document.head.appendChild(css)

  var gear = document.createElement('button')
  gear.id = 'dsh-desktop-gear'
  gear.title = '桌面设置'
  gear.setAttribute('aria-label', '桌面设置')
  gear.innerHTML =
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="12" cy="12" r="3"></circle>' +
    '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>' +
    '</svg>'
  document.body.appendChild(gear)

  var panel = document.createElement('div')
  panel.id = 'dsh-desktop-ui'
  panel.innerHTML =
    '<h3>桌面设置 <span class="close" title="关闭">×</span></h3>' +
    '<div class="row">' +
    '  <label>背景图片</label>' +
    '  <div class="preview"></div>' +
    '  <div style="display:flex;gap:8px">' +
    '    <button data-act="choose" style="flex:1">选择图片…</button>' +
    '    <button data-act="clear">移除</button>' +
    '  </div>' +
    '</div>' +
    '<div class="row"><label>显示方式</label>' +
    '  <select data-act="fit">' +
    '    <option value="cover">铺满窗口</option>' +
    '    <option value="contain">完整显示</option>' +
    '    <option value="repeat">平铺</option>' +
    '    <option value="center">居中</option>' +
    '  </select>' +
    '</div>' +
    '<div class="row">' +
    '  <label>背景淡化 <span data-act="maskval"></span></label>' +
    '  <input data-act="mask" type="range" min="0" max="90" step="5" value="15" />' +
    '</div>' +
    '<div class="note">淡化只作用于背景图，界面文字保持清晰；图片仅本机显示，不会上传。</div>'
  document.body.appendChild(panel)

  var previewEl = panel.querySelector('.preview')
  var fitSelect = panel.querySelector('[data-act="fit"]')
  var maskInput = panel.querySelector('[data-act="mask"]')
  var maskVal = panel.querySelector('[data-act="maskval"]')

  function syncUi(settings) {
    var image = (settings && settings.imageData) || null
    previewEl.style.backgroundImage = image ? 'url("' + image + '")' : ''
    previewEl.style.background = image ? 'center/cover no-repeat url("' + image + '")' : '#0f1218'
    fitSelect.value = (settings && settings.fit) || 'cover'
    var mask = Math.round(((settings && settings.mask) || 0) * 100)
    maskInput.value = String(mask)
    maskVal.textContent = mask + '%'
  }

  gear.addEventListener('click', function () {
    panel.classList.toggle('open')
    if (panel.classList.contains('open')) {
      window.dshDesktop.getSettings().then(syncUi)
    }
  })

  panel.querySelector('.close').addEventListener('click', function () {
    panel.classList.remove('open')
  })

  panel.addEventListener('click', function (event) {
    var act = event.target && event.target.getAttribute && event.target.getAttribute('data-act')
    if (act === 'choose') window.dshDesktop.chooseBackground().then(syncUi)
    if (act === 'clear') window.dshDesktop.clearBackground().then(syncUi)
  })

  fitSelect.addEventListener('change', function () {
    window.dshDesktop.setFit(fitSelect.value).then(syncUi)
  })

  maskInput.addEventListener('input', function () {
    maskVal.textContent = maskInput.value + '%'
    window.dshDesktop.setMask(Number(maskInput.value) / 100).then(syncUi)
  })

  window.dshDesktop.onSettingsChanged(syncUi)
})()
