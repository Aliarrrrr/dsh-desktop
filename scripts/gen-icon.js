'use strict'

// Zero-dependency PNG encoder (RGBA, 8-bit) + the app icon generator.
// Run: node scripts/gen-icon.js  → writes assets/icon.png

const zlib = require('node:zlib')
const fs = require('node:fs')
const path = require('node:path')

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'ascii')
  data.copy(out, 8)
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length)
  return out
}

/** Encode a width x height RGBA PNG. pixel(x, y) returns [r, g, b, a]. */
function encodePng(width, height, pixel) {
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0 // filter: none
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixel(x, y)
      const i = y * (stride + 1) + 1 + x * 4
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; raw[i + 3] = a
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
  return png
}

/** The 256x256 app icon: dark rounded tile, blue chat orb with a tail. */
function iconPixel(size) {
  const r = size * 0.22
  const inRounded = (x, y) => {
    const x0 = r, x1 = size - 1 - r, y0 = r, y1 = size - 1 - r
    const cx = Math.min(Math.max(x, x0), x1)
    const cy = Math.min(Math.max(y, y0), y1)
    const dx = x - cx, dy = y - cy
    return dx * dx + dy * dy <= r * r
  }
  const orbCx = size * 0.5, orbCy = size * 0.42, orbR = size * 0.20
  const inTriangle = (x, y) => {
    const ax = size * 0.39, ay = size * 0.58, bx = size * 0.61, by = size * 0.58, cx = size * 0.5, cy = size * 0.69
    const sign = (p1x, p1y, p2x, p2y, p3x, p3y) => (p1x - p3x) * (p2y - p3y) - (p2x - p3x) * (p1y - p3y)
    const d1 = sign(x, y, ax, ay, bx, by)
    const d2 = sign(x, y, bx, by, cx, cy)
    const d3 = sign(x, y, cx, cy, ax, ay)
    const neg = d1 < 0 || d2 < 0 || d3 < 0
    const pos = d1 > 0 || d2 > 0 || d3 > 0
    return !(neg && pos)
  }
  return (x, y) => {
    if (!inRounded(x, y)) return [0, 0, 0, 0]
    const t = y / size
    const bg = [17 + t * 6, 24 + t * 4, 39 + t * 3]
    const dx = x - orbCx, dy = y - orbCy
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist <= orbR) {
      const f = dist / orbR
      const light = 0.55 - f * 0.45
      return [
        Math.round(115 * light + 47 * (1 - light) + (x < orbCx ? 12 : 0)),
        Math.round(160 * light + 95 * (1 - light)),
        Math.round(255 * light + 222 * (1 - light)),
        255,
      ]
    }
    if (dist <= orbR + size * 0.03 && inTriangle(x, y)) {
      return [92, 141, 242, 255]
    }
    if (inTriangle(x, y) && dist > orbR + size * 0.03) {
      return [59, 111, 224, 255]
    }
    return [bg[0], bg[1], bg[2], 255]
  }
}

function main() {
  const out = path.join(__dirname, '..', 'assets', 'icon.png')
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, encodePng(256, 256, iconPixel(256)))
  console.log('icon written:', out)
}

if (require.main === module) main()

module.exports = { encodePng, iconPixel }
