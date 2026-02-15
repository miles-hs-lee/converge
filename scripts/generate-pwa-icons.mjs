import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Tiny dependency-free PNG writer (RGBA, 8-bit), good enough for app icons.
// Produces:
// - public/icons/icon-192.png
// - public/icons/icon-512.png
// - public/icons/icon-512-maskable.png (extra padding/safe area)
// - public/icons/apple-touch-icon.png (180x180)
// - public/favicon-16x16.png
// - public/favicon-32x32.png

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

function insideRoundedRect(x, y, size, r) {
  const rx = Math.max(0, Math.min(r, size / 2));
  const nx = Math.min(x, size - 1 - x);
  const ny = Math.min(y, size - 1 - y);
  if (nx >= rx || ny >= rx) return true;
  const dx = rx - nx;
  const dy = rx - ny;
  return dx * dx + dy * dy <= rx * rx;
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const wx = px - x1;
  const wy = py - y1;
  const c1 = wx * vx + wy * vy;
  if (c1 <= 0) return Math.hypot(px - x1, py - y1);
  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return Math.hypot(px - x2, py - y2);
  const t = c1 / c2;
  const bx = x1 + t * vx;
  const by = y1 + t * vy;
  return Math.hypot(px - bx, py - by);
}

function inRange(angle, startDeg, endDeg) {
  // inclusive, 0..360
  if (startDeg <= endDeg) return angle >= startDeg && angle <= endDeg;
  return angle >= startDeg || angle <= endDeg;
}

function drawIcon({ size, maskable = false, transparentCorners = true }) {
  const w = size;
  const h = size;
  const pixels = Buffer.alloc(w * h * 4);

  // Match BrandLogo SVG (viewBox 0 0 240 240) as closely as possible.
  const scale = size / 240;
  const bg = [15, 23, 42, 255]; // #0F172A
  const ring1 = [125, 211, 252, 255]; // #7DD3FC
  const ring2 = [56, 189, 248, 255]; // #38BDF8
  const streak = [226, 232, 240, 204]; // #E2E8F0 @ 0.8
  const core = [34, 211, 238, 255]; // #22D3EE
  const hole = [15, 23, 42, 255];

  const rCorner = Math.round(32 * scale);
  const cx = 120 * scale;
  const cy = 120 * scale;

  // Arc/ring: approximate circle arc around center; stroke width 20 in SVG.
  const rArc = 78 * scale;
  const strokeArc = 20 * scale;
  const innerArc = rArc - strokeArc / 2;
  const outerArc = rArc + strokeArc / 2;

  // Diagonal stroke: 72,66 -> 168,174 width 12.
  const x1 = 72 * scale;
  const y1 = 66 * scale;
  const x2 = 168 * scale;
  const y2 = 174 * scale;
  const strokeDiag = 12 * scale;

  // Core circle/hole.
  const rCore = 26 * scale;
  const rHole = 9 * scale;

  // Maskable: add safe padding by scaling the mark down slightly.
  const markScale = maskable ? 0.86 : 1.0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const inside = insideRoundedRect(x, y, size, rCorner);
      const idx = (y * w + x) * 4;

      if (!inside && transparentCorners) {
        pixels[idx + 0] = 0;
        pixels[idx + 1] = 0;
        pixels[idx + 2] = 0;
        pixels[idx + 3] = 0;
        continue;
      }

      // Base
      pixels[idx + 0] = bg[0];
      pixels[idx + 1] = bg[1];
      pixels[idx + 2] = bg[2];
      pixels[idx + 3] = 255;

      const dx = (x - cx) / markScale;
      const dy = (y - cy) / markScale;
      const d = Math.hypot(dx, dy);

      // Diagonal streak (blend)
      const dLine = distToSegment(x, y, x1, y1, x2, y2);
      if (dLine <= strokeDiag / 2) {
        const a = streak[3] / 255;
        pixels[idx + 0] = Math.round(pixels[idx + 0] * (1 - a) + streak[0] * a);
        pixels[idx + 1] = Math.round(pixels[idx + 1] * (1 - a) + streak[1] * a);
        pixels[idx + 2] = Math.round(pixels[idx + 2] * (1 - a) + streak[2] * a);
        pixels[idx + 3] = 255;
      }

      // Arc strokes
      if (d >= innerArc && d <= outerArc) {
        let ang = Math.atan2(dy, dx) * (180 / Math.PI);
        if (ang < 0) ang += 360;
        if (inRange(ang, 180, 270)) {
          pixels[idx + 0] = ring1[0];
          pixels[idx + 1] = ring1[1];
          pixels[idx + 2] = ring1[2];
          pixels[idx + 3] = 255;
        } else if (inRange(ang, 0, 90)) {
          pixels[idx + 0] = ring2[0];
          pixels[idx + 1] = ring2[1];
          pixels[idx + 2] = ring2[2];
          pixels[idx + 3] = 255;
        }
      }

      // Core dot + hole
      if (d <= rCore) {
        pixels[idx + 0] = core[0];
        pixels[idx + 1] = core[1];
        pixels[idx + 2] = core[2];
        pixels[idx + 3] = 255;
      }
      if (d <= rHole) {
        pixels[idx + 0] = hole[0];
        pixels[idx + 1] = hole[1];
        pixels[idx + 2] = hole[2];
        pixels[idx + 3] = 255;
      }
    }
  }

  return pngRGBA({ width: w, height: h, pixels });
}

function main() {
  const outDir = join(process.cwd(), "public", "icons");
  mkdirSync(outDir, { recursive: true });

  writeFileSync(join(outDir, "icon-192.png"), drawIcon({ size: 192, transparentCorners: true }));
  writeFileSync(join(outDir, "icon-512.png"), drawIcon({ size: 512, transparentCorners: true }));
  writeFileSync(join(outDir, "icon-512-maskable.png"), drawIcon({ size: 512, maskable: true, transparentCorners: false }));
  writeFileSync(join(outDir, "apple-touch-icon.png"), drawIcon({ size: 180, transparentCorners: false }));

  const publicDir = join(process.cwd(), "public");
  writeFileSync(join(publicDir, "favicon-16x16.png"), drawIcon({ size: 16, transparentCorners: false }));
  writeFileSync(join(publicDir, "favicon-32x32.png"), drawIcon({ size: 32, transparentCorners: false }));
}

main();
