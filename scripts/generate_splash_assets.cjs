/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");
const { Resvg } = require("@resvg/resvg-js");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function readSvg(relPath) {
  return fs.readFileSync(path.resolve(__dirname, "..", relPath), "utf8");
}

function renderPng(svg, outPath) {
  const r = new Resvg(svg);
  const pngData = r.render().asPng();
  ensureDir(path.dirname(outPath));
  fs.writeFileSync(outPath, pngData);
}

function withDimensions(svg, { width, height, preserveAspectRatio } = {}) {
  const w = String(width);
  const h = String(height);
  const par = preserveAspectRatio ? ` preserveAspectRatio="${preserveAspectRatio}"` : "";

  // Inject width/height (and optional preserveAspectRatio) onto the root <svg ...>.
  return svg.replace(
    /<svg\b([^>]*)>/,
    (match, attrs) => `<svg${attrs} width="${w}" height="${h}"${par}>`
  );
}

function iconVariant(svg, size) {
  // Keep the 1024x1024 viewBox; set explicit output dimensions.
  return withDimensions(svg, { width: size, height: size });
}

function splashVariant(svg, width, height) {
  // Keep the base viewBox; stretch to exact device dimensions.
  return withDimensions(svg, { width, height, preserveAspectRatio: "none" });
}

function main() {
  const iconSvg = readSvg("design/splash/icon.svg");
  const splashSvgBase = readSvg("design/splash/splash.svg");

  const iconOutDir = path.resolve(__dirname, "..", "public", "icons");
  const splashOutDir = path.resolve(__dirname, "..", "public", "splash");

  // App icons
  renderPng(iconVariant(iconSvg, 192), path.join(iconOutDir, "icon-192.png"));
  renderPng(iconVariant(iconSvg, 512), path.join(iconOutDir, "icon-512.png"));
  renderPng(iconVariant(iconSvg, 512), path.join(iconOutDir, "icon-512-maskable.png"));
  renderPng(iconVariant(iconSvg, 180), path.join(iconOutDir, "apple-touch-icon.png"));

  // iOS startup images (portrait)
  const iosSizes = [
    { w: 1170, h: 2532, name: "apple-splash-1170-2532.png" }, // 390x844@3 (iPhone 12/13/14)
    { w: 1179, h: 2556, name: "apple-splash-1179-2556.png" }, // 393x852@3 (iPhone 14/15 Pro)
    { w: 1284, h: 2778, name: "apple-splash-1284-2778.png" }, // 428x926@3 (iPhone 12/13/14 Pro Max)
    { w: 1290, h: 2796, name: "apple-splash-1290-2796.png" }, // 430x932@3 (iPhone 14/15 Pro Max)
    { w: 828, h: 1792, name: "apple-splash-828-1792.png" }, // 414x896@2 (iPhone XR/11)
    { w: 750, h: 1334, name: "apple-splash-750-1334.png" }, // 375x667@2 (iPhone 6/7/8)
    { w: 640, h: 1136, name: "apple-splash-640-1136.png" } // 320x568@2 (iPhone SE 1st gen)
  ];

  for (const s of iosSizes) {
    const svg = splashVariant(splashSvgBase, s.w, s.h);
    renderPng(svg, path.join(splashOutDir, s.name));
  }

  console.log("Generated icons + iOS splash images.");
}

main();
