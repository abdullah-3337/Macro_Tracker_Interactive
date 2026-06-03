// Generates PWA icons (any / maskable / monochrome + favicon.ico) from a
// single vector-style design. Pure Node + zlib, no external deps.
// Run: node generate-icons.js
//
// Design: macro pie chart — protein (red) / fat (amber) / carbs (green)
// on a dark-green rounded square. Matches the convention used by Lose It,
// Lifesum, MacroFactor.
//
// Three variants are produced for each size:
//   any         — full design with white ring, pie at 36% radius.
//   maskable    — content compressed inside the 80% safe zone (≤40% radius)
//                 with the ring removed so circular Android masks don't clip.
//   monochrome  — single-color silhouette for Android themed icons.
//
// Also emits favicon.ico (32x32 from the 'any' design).
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const BG          = [27, 67, 50, 255];     // #1b4332
const RING        = [255, 255, 255, 255];  // white ring (any variant only)
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

function fillBg(buf, w, c) {
  for (let i = 0; i < w * w; i++) {
    buf[i * 4] = c[0]; buf[i * 4 + 1] = c[1]; buf[i * 4 + 2] = c[2]; buf[i * 4 + 3] = c[3];
  }
}

// Returns wedge color for an angle (radians).
// Starts at 12 o'clock (-PI/2) and goes clockwise.
function wedgeColor(angle) {
  let a = angle + Math.PI / 2;
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

// 4x4 supersampled renderer.
// variant: 'any' | 'maskable' | 'monochrome'
//   any         — outer disc (0.42), white ring (0.40–0.42), pie (0.36), hole (0.12)
//   maskable    — pie (0.32) only, sitting inside the 80% safe zone; full BG canvas
//   monochrome  — solid pie silhouette + ring stroke in a single color (alpha-only;
//                 platform tints it). Background is transparent.
function renderIcon(size, variant) {
  const buf = Buffer.alloc(size * size * 4);
  const transparent = variant === 'monochrome';
  if (!transparent) fillBg(buf, size, BG);

  const cx = size / 2, cy = size / 2;
  let rOuter, rRing, rPie, rHole;
  if (variant === 'maskable') {
    // Pie content lives entirely inside the 80% safe zone (radius ≤ 0.40 of size).
    rOuter = size * 0.5;
    rRing  = -1;
    rPie   = size * 0.32;
    rHole  = size * 0.10;
  } else if (variant === 'monochrome') {
    rOuter = size * 0.42;
    rRing  = size * 0.40;
    rPie   = size * 0.36;
    rHole  = size * 0.12;
  } else {
    rOuter = size * 0.42;
    rRing  = size * 0.40;
    rPie   = size * 0.36;
    rHole  = size * 0.12;
  }

  const SS = 4;
  const inv = 1 / SS;
  const half = inv / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      let covered = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + sx * inv + half - cx;
          const py = y + sy * inv + half - cy;
          const d  = Math.sqrt(px * px + py * py);
          let c;
          if (variant === 'maskable') {
            // Full canvas already filled with BG; just draw pie.
            if (d > rPie) continue;
            else if (d > rHole) c = wedgeColor(Math.atan2(py, px));
            else c = BG;
            r += c[0]; g += c[1]; b += c[2]; a += 255; n++; covered++;
          } else if (variant === 'monochrome') {
            // Alpha-only mask: pie + ring are opaque white, rest transparent.
            let opaque = false;
            if (d <= rOuter && d > rRing) opaque = true;          // ring stroke
            else if (d <= rPie && d > rHole) opaque = true;       // pie body
            if (opaque) { r += 255; g += 255; b += 255; a += 255; n++; covered++; }
          } else {
            if (d > rOuter) continue;
            else if (d > rRing) c = RING;
            else if (d > rPie) c = BG;
            else if (d > rHole) c = wedgeColor(Math.atan2(py, px));
            else c = BG;
            r += c[0]; g += c[1]; b += c[2]; a += c[3]; n++; covered++;
          }
        }
      }
      const i = (y * size + x) * 4;
      if (transparent) {
        if (n === 0) { buf[i] = 0; buf[i + 1] = 0; buf[i + 2] = 0; buf[i + 3] = 0; continue; }
        const total = SS * SS;
        const wFg = covered / total;
        buf[i]     = 255;
        buf[i + 1] = 255;
        buf[i + 2] = 255;
        buf[i + 3] = Math.round(255 * wFg);
      } else {
        if (n === 0) continue;
        const total = SS * SS;
        const wFg = n / total;
        const wBg = 1 - wFg;
        buf[i]     = Math.round((r / n) * wFg + BG[0] * wBg);
        buf[i + 1] = Math.round((g / n) * wFg + BG[1] * wBg);
        buf[i + 2] = Math.round((b / n) * wFg + BG[2] * wBg);
        buf[i + 3] = 255;
      }
    }
  }
  return encodePNG(size, size, buf);
}

// Splash renderer: fills BG, paints a centered macro-pie at iconFrac of min(w,h).
// Uses the same 4x4 supersampled pie+ring math as renderIcon('any').
function renderSplash(w, h) {
  const buf = Buffer.alloc(w * h * 4);
  // Fill background.
  for (let i = 0; i < w * h; i++) {
    buf[i * 4] = BG[0]; buf[i * 4 + 1] = BG[1]; buf[i * 4 + 2] = BG[2]; buf[i * 4 + 3] = 255;
  }
  const iconSize = Math.round(Math.min(w, h) * 0.30);
  const cx = w / 2, cy = h / 2;
  const rOuter = iconSize * 0.42;
  const rRing  = iconSize * 0.40;
  const rPie   = iconSize * 0.36;
  const rHole  = iconSize * 0.12;
  const SS = 4;
  const inv = 1 / SS;
  const half = inv / 2;
  // Iterate only the bounding box around the icon for speed on big canvases.
  const x0 = Math.max(0, Math.floor(cx - rOuter - 1));
  const x1 = Math.min(w, Math.ceil(cx + rOuter + 1));
  const y0 = Math.max(0, Math.floor(cy - rOuter - 1));
  const y1 = Math.min(h, Math.ceil(cy + rOuter + 1));
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      let r = 0, g = 0, b = 0, n = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + sx * inv + half - cx;
          const py = y + sy * inv + half - cy;
          const d  = Math.sqrt(px * px + py * py);
          let c;
          if (d > rOuter) continue;
          else if (d > rRing) c = RING;
          else if (d > rPie)  c = BG;
          else if (d > rHole) c = wedgeColor(Math.atan2(py, px));
          else c = BG;
          r += c[0]; g += c[1]; b += c[2]; n++;
        }
      }
      if (n === 0) continue;
      const total = SS * SS;
      const wFg = n / total;
      const wBg = 1 - wFg;
      const i = (y * w + x) * 4;
      buf[i]     = Math.round((r / n) * wFg + BG[0] * wBg);
      buf[i + 1] = Math.round((g / n) * wFg + BG[1] * wBg);
      buf[i + 2] = Math.round((b / n) * wFg + BG[2] * wBg);
      buf[i + 3] = 255;
    }
  }
  return encodePNG(w, h, buf);
}

// favicon.ico container around a 32x32 PNG.
// ICO header (6) + ICONDIRENTRY (16) + PNG payload.
function encodeIco(png32) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);    // reserved
  header.writeUInt16LE(1, 2);    // type: icon
  header.writeUInt16LE(1, 4);    // count
  const entry = Buffer.alloc(16);
  entry[0] = 32;                 // width  (0 = 256)
  entry[1] = 32;                 // height
  entry[2] = 0;                  // palette
  entry[3] = 0;                  // reserved
  entry.writeUInt16LE(1, 4);     // planes
  entry.writeUInt16LE(32, 6);    // bpp
  entry.writeUInt32LE(png32.length, 8);
  entry.writeUInt32LE(6 + 16, 12); // offset
  return Buffer.concat([header, entry, png32]);
}

const outDir = path.join(__dirname, 'icons');
fs.mkdirSync(outDir, { recursive: true });

const ANY_SIZES        = [32, 144, 152, 167, 180, 192, 256, 384, 512, 1024];
const MASKABLE_SIZES   = [192, 512];
const MONOCHROME_SIZES = [512];

// Pixel dimensions (px = CSS px × DPR) for popular iOS devices.
// Both portrait and landscape orientations are emitted per device.
const SPLASH_DEVICES = [
  { name: 'iphone-15-pro-max', cssW: 430,  cssH: 932,  dpr: 3 }, // 1290×2796
  { name: 'iphone-15-pro',     cssW: 393,  cssH: 852,  dpr: 3 }, // 1179×2556
  { name: 'iphone-14-plus',    cssW: 428,  cssH: 926,  dpr: 3 }, // 1284×2778
  { name: 'iphone-13-14',      cssW: 390,  cssH: 844,  dpr: 3 }, // 1170×2532
  { name: 'iphone-xr-11',      cssW: 414,  cssH: 896,  dpr: 2 }, // 828×1792
  { name: 'iphone-se',         cssW: 375,  cssH: 667,  dpr: 2 }, // 750×1334
  { name: 'ipad-pro-12_9',     cssW: 1024, cssH: 1366, dpr: 2 }, // 2048×2732
  { name: 'ipad-pro-11',       cssW: 834,  cssH: 1194, dpr: 2 }, // 1668×2388
  { name: 'ipad-air',          cssW: 820,  cssH: 1180, dpr: 2 }, // 1640×2360
  { name: 'ipad-mini',         cssW: 744,  cssH: 1133, dpr: 2 }, // 1488×2266
];

ANY_SIZES.forEach((size) => {
  const name = size === 32 ? 'favicon-32.png'
             : size === 180 ? 'icon-180.png'
             : `icon-${size}.png`;
  const png = renderIcon(size, 'any');
  fs.writeFileSync(path.join(outDir, name), png);
  console.log(name, png.length, 'bytes');
});

MASKABLE_SIZES.forEach((size) => {
  const name = `icon-maskable-${size}.png`;
  const png = renderIcon(size, 'maskable');
  fs.writeFileSync(path.join(outDir, name), png);
  console.log(name, png.length, 'bytes');
});

MONOCHROME_SIZES.forEach((size) => {
  const name = `icon-monochrome-${size}.png`;
  const png = renderIcon(size, 'monochrome');
  fs.writeFileSync(path.join(outDir, name), png);
  console.log(name, png.length, 'bytes');
});

// iOS splash screens. One PNG per device per orientation.
SPLASH_DEVICES.forEach((d) => {
  const w = d.cssW * d.dpr;
  const h = d.cssH * d.dpr;
  const portrait  = renderSplash(w, h);
  const landscape = renderSplash(h, w);
  const pName = `splash-${d.name}-portrait.png`;
  const lName = `splash-${d.name}-landscape.png`;
  fs.writeFileSync(path.join(outDir, pName), portrait);
  fs.writeFileSync(path.join(outDir, lName), landscape);
  console.log(pName, portrait.length, 'bytes');
  console.log(lName, landscape.length, 'bytes');
});

const favicon32Png = renderIcon(32, 'any');
const ico = encodeIco(favicon32Png);
fs.writeFileSync(path.join(__dirname, 'favicon.ico'), ico);
console.log('favicon.ico', ico.length, 'bytes');
