const fs = require("node:fs");
const path = require("node:path");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const fontkit = require("@pdf-lib/fontkit");

const A4 = { width: 595.28, height: 841.89 };

const FONT_PATH = "/System/Library/Fonts/Supplemental/AppleGothic.ttf";
const HERO_IMAGE_PATH = path.resolve(__dirname, "..", "marketing", "assets", "calendar-desktop.jpg");
const OUTPUT_PATH = path.resolve(__dirname, "..", "marketing", "Converge_OnePager_ko.pdf");

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function textWidth(font, text, size) {
  return font.widthOfTextAtSize(text, size);
}

function wrapLine(font, text, size, maxWidth) {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return [""];

  const words = normalized.split(" ");
  const lines = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (textWidth(font, candidate, size) <= maxWidth) {
      line = candidate;
      continue;
    }

    if (line) lines.push(line);

    // If a single "word" is too long, fall back to char-splitting.
    if (textWidth(font, word, size) > maxWidth) {
      let chunk = "";
      for (const ch of word) {
        const cand = chunk + ch;
        if (textWidth(font, cand, size) <= maxWidth) {
          chunk = cand;
        } else {
          if (chunk) lines.push(chunk);
          chunk = ch;
        }
      }
      line = chunk;
    } else {
      line = word;
    }
  }

  if (line) lines.push(line);
  return lines;
}

function wrapText(font, text, size, maxWidth) {
  const parts = String(text ?? "").split("\n");
  const lines = [];
  for (const part of parts) {
    const wrapped = wrapLine(font, part, size, maxWidth);
    for (const l of wrapped) lines.push(l);
  }
  return lines;
}

function drawWrappedText(page, { font, text, x, yTop, maxWidth, size, lineHeight, color }) {
  const lines = wrapText(font, text, size, maxWidth);
  let y = yTop;
  for (const line of lines) {
    y -= lineHeight;
    page.drawText(line, { x, y, size, font, color });
  }
  return y;
}

function drawHeading(page, { font, text, x, yTop, size, color }) {
  const y = yTop - size;
  page.drawText(text, { x, y, size, font, color });
  return y;
}

function drawRule(page, { x, y, w, color }) {
  page.drawRectangle({ x, y, width: w, height: 1, color });
}

function drawCard(page, { x, yTop, w, h, title, body, font, titleSize, bodySize, accentColor, lineColor, fillColor }) {
  const y = yTop - h;
  page.drawRectangle({ x, y, width: w, height: h, borderColor: lineColor, borderWidth: 1, color: fillColor });

  const pad = 10;
  const titleYTop = yTop - pad;
  drawHeading(page, { font, text: title, x: x + pad, yTop: titleYTop, size: titleSize, color: accentColor });
  const bodyYTop = titleYTop - titleSize - 6;
  drawWrappedText(page, {
    font,
    text: body,
    x: x + pad,
    yTop: bodyYTop,
    maxWidth: w - pad * 2,
    size: bodySize,
    lineHeight: bodySize + 4,
    color: rgb(0.15, 0.18, 0.22)
  });
}

function drawBullets(page, { font, bullets, x, yTop, maxWidth, size, lineHeight, color }) {
  let y = yTop;
  const bullet = "\u2022";
  const bulletW = textWidth(font, `${bullet} `, size);
  for (const item of bullets) {
    const lines = wrapText(font, item, size, maxWidth - bulletW);
    if (lines.length === 0) continue;

    y -= lineHeight;
    page.drawText(`${bullet} ${lines[0]}`, { x, y, size, font, color });

    for (let i = 1; i < lines.length; i += 1) {
      y -= lineHeight;
      page.drawText(lines[i], { x: x + bulletW, y, size, font, color });
    }

    y -= clamp(lineHeight * 0.35, 3, 6);
  }
  return y;
}

async function main() {
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const page = pdfDoc.addPage([A4.width, A4.height]);

  const fontBytes = fs.readFileSync(FONT_PATH);
  const font = await pdfDoc.embedFont(fontBytes, { subset: true });
  const mono = await pdfDoc.embedFont(StandardFonts.Courier);

  const heroImgBytes = fs.existsSync(HERO_IMAGE_PATH) ? fs.readFileSync(HERO_IMAGE_PATH) : null;
  const heroImg = heroImgBytes ? await pdfDoc.embedJpg(heroImgBytes) : null;

  const bg = rgb(0.98, 0.985, 0.99);
  const text = rgb(0.06, 0.09, 0.16);
  const muted = rgb(0.35, 0.42, 0.51);
  const line = rgb(0.86, 0.89, 0.92);
  const accent = rgb(0.06, 0.46, 0.43); // teal-ish
  const soft = rgb(1, 1, 1);

  page.drawRectangle({ x: 0, y: 0, width: A4.width, height: A4.height, color: bg });
  page.drawRectangle({ x: 0, y: A4.height - 8, width: A4.width, height: 8, color: accent });

  const m = 44;
  const contentW = A4.width - m * 2;
  let yTop = A4.height - m;

  // Header
  page.drawText("Converge", { x: m, y: yTop - 18, size: 18, font, color: text });
  page.drawText("통합 M365 워크스페이스", { x: m, y: yTop - 34, size: 10.5, font, color: muted });

  const versionLabel = "One-page brochure";
  page.drawText(versionLabel, { x: A4.width - m - textWidth(font, versionLabel, 10), y: yTop - 34, size: 10, font, color: muted });

  yTop -= 52;
  drawRule(page, { x: m, y: yTop, w: contentW, color: line });
  yTop -= 18;

  // Hero: left copy + right screenshot
  const gap = 16;
  const heroLeftW = 322;
  const heroRightW = contentW - heroLeftW - gap;
  const heroH = 190;

  const heroTitle = "멀티 테넌트 Microsoft 365 운영을\n하나의 워크스페이스로";
  const heroDesc =
    "Converge는 여러 테넌트에 분산된 캘린더와 디렉터리(직원) 정보를 단일 화면에서 통합 제공합니다. " +
    "검색과 표준 액션(메일, Teams, 미팅 생성)으로 실행까지 연결해 전환 비용을 줄이고, 테넌트 간 일정 충돌을 선제적으로 탐지합니다.";

  yTop = drawWrappedText(page, {
    font,
    text: heroTitle,
    x: m,
    yTop,
    maxWidth: heroLeftW,
    size: 22,
    lineHeight: 26,
    color: text
  });
  yTop -= 8;
  yTop = drawWrappedText(page, {
    font,
    text: heroDesc,
    x: m,
    yTop,
    maxWidth: heroLeftW,
    size: 11,
    lineHeight: 16,
    color: muted
  });

  // CTA chips
  const chipY = A4.height - m - 52 - heroH + 22;
  const chips = ["Microsoft로 시작", "테넌트 전환 최소화", "일정 충돌 탐지"];
  let chipX = m;
  for (const c of chips) {
    const padX = 10;
    const padY = 6;
    const size = 10.5;
    const w = textWidth(font, c, size) + padX * 2;
    const h = size + padY * 2;
    page.drawRectangle({ x: chipX, y: chipY, width: w, height: h, color: soft, borderColor: line, borderWidth: 1 });
    page.drawText(c, { x: chipX + padX, y: chipY + padY, size, font, color: rgb(0.18, 0.22, 0.27) });
    chipX += w + 8;
  }

  // Screenshot card
  const heroBoxX = m + heroLeftW + gap;
  const heroBoxYTop = A4.height - m - 52;
  const heroBoxY = heroBoxYTop - heroH;
  page.drawRectangle({ x: heroBoxX, y: heroBoxY, width: heroRightW, height: heroH, color: soft, borderColor: line, borderWidth: 1 });
  if (heroImg) {
    const pad = 8;
    const imgW = heroRightW - pad * 2;
    const imgH = heroH - pad * 2;
    const scale = Math.min(imgW / heroImg.width, imgH / heroImg.height);
    const w = heroImg.width * scale;
    const h = heroImg.height * scale;
    const x = heroBoxX + pad + (imgW - w) / 2;
    const y = heroBoxY + pad + (imgH - h) / 2;
    page.drawImage(heroImg, { x, y, width: w, height: h });
  } else {
    const fallback = "Preview";
    page.drawText(fallback, {
      x: heroBoxX + (heroRightW - textWidth(font, fallback, 12)) / 2,
      y: heroBoxY + heroH / 2,
      size: 12,
      font,
      color: muted
    });
  }

  // Middle grid
  const midStartTop = heroBoxY - 22;
  const colW = (contentW - gap) / 2;
  const leftX = m;
  const rightX = m + colW + gap;

  // Left: problems + target
  let leftTop = midStartTop;
  page.drawText("주요 과제", { x: leftX, y: leftTop - 12, size: 12.5, font, color: text });
  leftTop -= 18;
  leftTop = drawBullets(page, {
    font,
    bullets: [
      "테넌트/계정 전환으로 인한 컨텍스트 손실과 커뮤니케이션 지연",
      "테넌트별 디렉터리 분리로 인한 담당자 탐색 비용 증가",
      "일정 분산으로 인한 더블부킹 및 충돌 리스크 확대"
    ],
    x: leftX,
    yTop: leftTop,
    maxWidth: colW,
    size: 10.8,
    lineHeight: 15.5,
    color: rgb(0.18, 0.22, 0.27)
  });

  leftTop -= 6;
  page.drawText("권장 대상", { x: leftX, y: leftTop - 12, size: 12.5, font, color: text });
  leftTop -= 18;
  drawBullets(page, {
    font,
    bullets: [
      "컨설팅/에이전시/MSP 등 여러 고객 테넌트를 병행 운영하는 팀",
      "그룹사/계열사처럼 테넌트가 분리된 조직",
      "파트너 협업, 프로젝트 조직 등 기간 한정 멀티 테넌트를 운용하는 부서",
      "세일즈/HR/PM/운영 등 사람 탐색과 미팅 생성 빈도가 높은 직군"
    ],
    x: leftX,
    yTop: leftTop,
    maxWidth: colW,
    size: 10.8,
    lineHeight: 15.5,
    color: rgb(0.18, 0.22, 0.27)
  });

  // Right: capabilities cards (2x2)
  let rightTop = midStartTop;
  page.drawText("핵심 역량", { x: rightX, y: rightTop - 12, size: 12.5, font, color: text });
  rightTop -= 18;

  const cardGap = 10;
  const cardW = (colW - cardGap) / 2;
  const cardH = 92;

  drawCard(page, {
    x: rightX,
    yTop: rightTop,
    w: cardW,
    h: cardH,
    title: "통합 캘린더",
    body: "여러 테넌트 일정을 주간/월간으로 집계하고, 테넌트별 제어와 검색으로 빠르게 파악합니다.",
    font,
    titleSize: 11.5,
    bodySize: 10.2,
    accentColor: accent,
    lineColor: line,
    fillColor: soft
  });
  drawCard(page, {
    x: rightX + cardW + cardGap,
    yTop: rightTop,
    w: cardW,
    h: cardH,
    title: "디렉터리 검색",
    body: "이름/부서/테넌트로 탐색하고, 메일·Teams·미팅 생성까지 표준 동선으로 실행합니다.",
    font,
    titleSize: 11.5,
    bodySize: 10.2,
    accentColor: accent,
    lineColor: line,
    fillColor: soft
  });

  const row2Top = rightTop - cardH - cardGap;
  drawCard(page, {
    x: rightX,
    yTop: row2Top,
    w: cardW,
    h: cardH,
    title: "충돌 탐지",
    body: "서로 다른 테넌트의 겹치는 일정을 감지하고, 인앱 알림 및 선택적 알림으로 확인합니다.",
    font,
    titleSize: 11.5,
    bodySize: 10.2,
    accentColor: accent,
    lineColor: line,
    fillColor: soft
  });
  drawCard(page, {
    x: rightX + cardW + cardGap,
    yTop: row2Top,
    w: cardW,
    h: cardH,
    title: "연결 관리",
    body: "Microsoft 계정을 추가 연결하고, 연결 상태를 중앙에서 관리합니다.",
    font,
    titleSize: 11.5,
    bodySize: 10.2,
    accentColor: accent,
    lineColor: line,
    fillColor: soft
  });

  // Bottom: onboarding steps across full width
  const stepsTop = 180;
  page.drawText("도입 흐름", { x: m, y: stepsTop, size: 12.5, font, color: text });
  const stepY = stepsTop - 26;

  const stepW = (contentW - gap * 2) / 3;
  const stepH = 72;
  const steps = [
    { n: "1", t: "메인 계정 인증", d: "Supabase 인증 또는 Microsoft 계정으로 시작" },
    { n: "2", t: "추가 테넌트 연결", d: "설정에서 다른 테넌트 계정 추가" },
    { n: "3", t: "검색과 실행", d: "통합 캘린더/디렉터리에서 즉시 액션" }
  ];

  for (let i = 0; i < steps.length; i += 1) {
    const sx = m + i * (stepW + gap);
    page.drawRectangle({ x: sx, y: stepY - stepH, width: stepW, height: stepH, color: soft, borderColor: line, borderWidth: 1 });

    const badgeX = sx + 12;
    const badgeY = stepY - 24;
    page.drawRectangle({ x: badgeX, y: badgeY, width: 18, height: 18, color: accent });
    page.drawText(steps[i].n, { x: badgeX + 6, y: badgeY + 4, size: 11, font, color: rgb(1, 1, 1) });

    page.drawText(steps[i].t, { x: sx + 36, y: stepY - 20, size: 11.2, font, color: text });
    drawWrappedText(page, {
      font,
      text: steps[i].d,
      x: sx + 12,
      yTop: stepY - 30,
      maxWidth: stepW - 24,
      size: 10.2,
      lineHeight: 14.5,
      color: muted
    });
  }

  // Footer
  const footerY = 54;
  drawRule(page, { x: m, y: footerY + 22, w: contentW, color: line });
  page.drawText("웹", { x: m, y: footerY + 6, size: 10, font, color: muted });
  page.drawText("https://converge-teal.vercel.app", { x: m + 22, y: footerY + 6, size: 10.2, font: mono, color: rgb(0.2, 0.27, 0.33) });
  const rightNote = "멀티 테넌트 M365를 위한 통합 업무 워크스페이스";
  page.drawText(rightNote, {
    x: A4.width - m - textWidth(font, rightNote, 10),
    y: footerY + 6,
    size: 10,
    font,
    color: muted
  });

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(OUTPUT_PATH, pdfBytes);
  // eslint-disable-next-line no-console
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
