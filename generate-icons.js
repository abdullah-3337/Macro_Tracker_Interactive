// Generates PWA icons (192/512/180/32 PNG) from a single vector-style design.
// Pure Node + zlib, no external deps. Run: node generate-icons.js
//
// Design: macro pie chart — protein (red) / fat (amber) / carbs (green)
// on a dark-green rounded square. Matches the convention used by Lose It,
// Lifesum, MacroFactor.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const BG          = [27, 67, 50, 255];     // #1b4332
const RING        = [255, 255, 255, 255];  // white ring
const PROTEIN     = [230, 57, 70, 255];    // #e63946
const FAT         = [244, 162, 97, 255];   // #f4a261
const CARBS       = [82, 183, 136, 255];   // #52b788

// Wedge split — protein 30%, fat 25%, carbs 45% (visual default)
const SPLITS = [
  { color: PROTEIN, frac: 0.30 },
  { color: FAT,     frac: 0.25 },
  { color: CARBS,   frac: 0.45 },
];

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function encodePNG(w, h, pixels) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const rowBytes = w * 4;
  const filtered = Buffer.alloc((rowBytes + 1) * h);
  for (let y = 0; y < h; y++) {
    filtered[y * (rowBytes + 1)] = 0;
    pixels.copy(filtered, y * (rowBytes + 1) + 1, y * rowBytes, (y + 1) * rowBytes);
  }
  const idat = zlib.deflateSync(filtered, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function setPx(buf, w, x, y, c) {
  if (x < 0 || y < 0 || x >= w || y >= w) return;
  const i = (y * w + x) * 4;
  buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = c[3];
}
function fillBg(buf, w, c) {
  for (let i = 0; i < w * w; i++) {
    buf[i * 4] = c[0]; buf[i * 4 + 1] = c[1]; buf[i * 4 + 2] = c[2]; buf[i * 4 + 3] = c[3];
  }
}

// Returns wedge color for an angle (radians), or null if outside any wedge.
// Starts at 12 o'clock (-PI/2) and goes clockwise.
function wedgeColor(angle) {
  let a = angle + Math.PI / 2;          // shift so 0 = top
  while (a < 0) a += Math.PI * 2;
  while (a >= Math.PI * 2) a -= Math.PI * 2;
  const frac = a / (Math.PI * 2);
  let acc = 0;
  for (const s of SPLITS) {
    acc += s.frac;
    if (frac < acc) return s.color;
  }
  return SPLITS[SPLITS.length - 1].color;
}

// 4x4 supersampled pie: smooths the wedge boundaries and ring edge.
function renderPie(size) {
  const buf = Buffer.alloc(size * size * 4);
  fillBg(buf, size, BG);
  const cx = size / 2, cy = size / 2;
  const rOuter = size * 0.42;
  const rRing  = size * 0.40;
  const rPie   = size * 0.36;
  const rHole  = size * 0.12;          // tiny dark center for depth
  const SS = 4;
  const inv = 1 / SS;
  const half = inv / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + sx * inv + half - cx;
          const py = y + sy * inv + half - cy;
          const d  = Math.sqrt(px * px + py * py);
          let c;
          if (d > rOuter) continue;                         // outside icon disc -> bg already set
          else if (d > rRing) c = RING;                     // white ring
          else if (d > rPie) c = BG;                        // gap inside ring
          else if (d > rHole) c = wedgeColor(Math.atan2(py, px));
          else c = BG;                                      // center hole
          r += c[0]; g += c[1]; b += c[2]; a += c[3]; n++;
        }
      }
      if (n === 0) continue;
      const total = SS * SS;
      // blend with bg for partial coverage at edges
      const wFg = n / total;
      const wBg = 1 - wFg;
      const i = (y * size + x) * 4;
      buf[i]     = Math.round((r / n) * wFg + BG[0] * wBg);
      buf[i + 1] = Math.round((g / n) * wFg + BG[1] * wBg);
      buf[i + 2] = Math.round((b / n) * wFg + BG[2] * wBg);
      buf[i + 3] = 255;
    }
  }
  return encodePNG(size, size, buf);
}

const outDir = path.join(__dirname, 'icons');
fs.mkdirSync(outDir, { recursive: true });
[
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['icon-180.png', 180],   // iOS apple-touch-icon
  ['favicon-32.png', 32],
].forEach(([name, size]) => {
  const png = renderPie(size);
  fs.writeFileSync(path.join(outDir, name), png);
  console.log(name, png.length, 'bytes');
});
