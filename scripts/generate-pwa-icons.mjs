import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Tiny dependency-free PNG writer (RGBA, 8-bit), good enough for app icons.
// Produces:
// - public/icons/icon-192.png
// - public/icons/icon-512.png
// - public/icons/icon-512-maskable.png (extra padding/safe area)
// - public/icons/apple-touch-icon.png (180x180)

function crc32(buf) {
  // Table-based CRC32 (IEEE)
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

function pngRGBA({ width, height, pixels }) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(6, 9); // color type RGBA
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace

  // Each row: filter byte (0) + RGBA pixels
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[(stride + 1) * y] = 0;
    pixels.copy(raw, (stride + 1) * y + 1, stride * y, stride * (y + 1));
  }

  const idat = deflateSync(raw, { level: 9 });
  const iend = Buffer.alloc(0);

  return Buffer.concat([signature, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", iend)]);
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function blend(a, b, t) {
  return [
    Math.round(lerp(a[0], b[0], t)),
    Math.round(lerp(a[1], b[1], t)),
    Math.round(lerp(a[2], b[2], t)),
    Math.round(lerp(a[3], b[3], t))
  ];
}

function drawIcon({ size, maskable = false }) {
  const w = size;
  const h = size;
  const pixels = Buffer.alloc(w * h * 4);

  // Brand-ish palette from UI:
  // background: deep slate (#0F172A)
  // accents: cyan/sky (#22D3EE, #38BDF8, #7DD3FC)
  const bgTop = [245, 250, 255, 255]; // #F5FAFF
  const bgBot = [234, 242, 251, 255]; // #EAF2FB

  // For maskable, give extra safe area by shrinking the mark.
  const pad = maskable ? Math.round(size * 0.12) : Math.round(size * 0.06);

  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const r0 = (Math.min(w, h) / 2) - pad;

  const markBg = [15, 23, 42, 255]; // #0F172A
  const ring1 = [125, 211, 252, 255]; // #7DD3FC
  const ring2 = [56, 189, 248, 255]; // #38BDF8
  const core = [34, 211, 238, 255]; // #22D3EE
  const coreHole = [15, 23, 42, 255];

  // Subtle diagonal streak
  const streak = [226, 232, 240, 200]; // #E2E8F0 @ ~0.78

  for (let y = 0; y < h; y++) {
    const t = y / (h - 1);
    const rowBg = blend(bgTop, bgBot, t);
    for (let x = 0; x < w; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);

      // Base background gradient
      let col = rowBg;

      // Big rounded square-ish mark background (use circle for simplicity)
      if (d <= r0) col = markBg;

      // Two arc-like rings (approx using annulus)
      const r1 = r0 * 0.78;
      const r2 = r0 * 0.62;
      if (d <= r1 && d >= r1 - r0 * 0.09) col = ring1;
      if (d <= r2 && d >= r2 - r0 * 0.09) col = ring2;

      // Diagonal streak line
      // Line around y = x mapped into icon space
      const line = Math.abs((y - x) - (cy - cx));
      if (d <= r0 * 0.92 && line < Math.max(1, Math.round(size * 0.012))) {
        // alpha blend streak over current
        const a = streak[3] / 255;
        col = [
          Math.round(col[0] * (1 - a) + streak[0] * a),
          Math.round(col[1] * (1 - a) + streak[1] * a),
          Math.round(col[2] * (1 - a) + streak[2] * a),
          255
        ];
      }

      // Core dot + hole
      if (d <= r0 * 0.22) col = core;
      if (d <= r0 * 0.08) col = coreHole;

      const idx = (y * w + x) * 4;
      pixels[idx + 0] = col[0];
      pixels[idx + 1] = col[1];
      pixels[idx + 2] = col[2];
      pixels[idx + 3] = col[3];
    }
  }

  return pngRGBA({ width: w, height: h, pixels });
}

function main() {
  const outDir = join(process.cwd(), "public", "icons");
  mkdirSync(outDir, { recursive: true });

  writeFileSync(join(outDir, "icon-192.png"), drawIcon({ size: 192 }));
  writeFileSync(join(outDir, "icon-512.png"), drawIcon({ size: 512 }));
  writeFileSync(join(outDir, "icon-512-maskable.png"), drawIcon({ size: 512, maskable: true }));
  writeFileSync(join(outDir, "apple-touch-icon.png"), drawIcon({ size: 180 }));
}

main();

