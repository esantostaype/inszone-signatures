/* eslint-disable @typescript-eslint/no-explicit-any */
// src/lib/logoSmart.ts
import sharp from "sharp";

export type SmartPlan =
  | { kind: "HAS_ALPHA" }
  | { kind: "SOLID_BG"; bgHex: string; bgR: number; bgG: number; bgB: number }
  | { kind: "COMPLEX_BG" }
  | { kind: "SVG" }
  | { kind: "BADGE" };

export type LogoBox = { w: number; h: number };

export type SmartLogoResult = {
  plan: SmartPlan;
  trimmedAr: number;
  box: LogoBox;
  processedBuffer: Buffer;
  skipEnhancement: boolean;
};

export function getSmartLogoBox(ar: number): LogoBox {
  let w: number;
  if (ar < 0.85)       w = 48;
  else if (ar <= 1.18) w = 72;
  else if (ar <= 1.7)  w = 106;
  else if (ar <= 2.4)  w = 118;
  else if (ar <= 3.4)  w = 130;
  else if (ar <= 4.4)  w = 142;
  else if (ar <= 5.4)  w = 154;
  else if (ar <= 6.4)  w = 166;
  else if (ar <= 7.4)  w = 178;
  else if (ar <= 8.4)  w = 190;
  else if (ar <= 9.4)  w = 202;
  else                 w = 214;
  const h = Math.round(w / ar);
  return { w, h };
}

export async function addWhiteBackgroundAndPadding(buffer: Buffer, padding = 20): Promise<Buffer> {
  const meta = await sharp(buffer, { failOn: "none" }).metadata();
  const w = meta.width  ?? 0;
  const h = meta.height ?? 0;
  return sharp({
    create: { width: w + padding * 2, height: h + padding * 2, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite([{ input: buffer, top: padding, left: padding }])
    .png()
    .toBuffer();
}

async function removeSolidBackground(buffer: Buffer, bgR: number, bgG: number, bgB: number, tolerance = 40): Promise<Buffer> {
  const { data, info } = await sharp(buffer, { failOn: "none" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = new Uint8ClampedArray(data);
  for (let i = 0; i < info.width * info.height; i++) {
    const idx = i * 4;
    const diff = Math.sqrt((pixels[idx] - bgR) ** 2 + (pixels[idx+1] - bgG) ** 2 + (pixels[idx+2] - bgB) ** 2);
    if (diff <= tolerance) pixels[idx + 3] = 0;
  }
  return sharp(Buffer.from(pixels.buffer), { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

/**
 * Cuenta píxeles que difieren del color de fondo y verifica si forman un shape circular.
 * fillRatio ≈ π/4 ≈ 0.785 para un círculo perfecto. Rango 0.55–0.98 cubre escudos/ovales.
 */
function detectCircularContent(data: Buffer, w: number, h: number, bgR: number, bgG: number, bgB: number, bgTol = 30): boolean {
  let contentCount = 0;
  let rmin = h, rmax = 0, cmin = w, cmax = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const diff = Math.sqrt((data[idx] - bgR) ** 2 + (data[idx+1] - bgG) ** 2 + (data[idx+2] - bgB) ** 2);
      if (diff > bgTol) {
        contentCount++;
        if (y < rmin) rmin = y;
        if (y > rmax) rmax = y;
        if (x < cmin) cmin = x;
        if (x > cmax) cmax = x;
      }
    }
  }
  if (contentCount === 0) return false;
  const bw = cmax - cmin + 1;
  const bh = rmax - rmin + 1;
  const bbAr = bw / bh;
  if (bbAr < 0.4 || bbAr > 2.5) return false;
  const fillRatio = contentCount / (bw * bh);
  return fillRatio >= 0.55 && fillRatio <= 0.98;
}

/**
 * Detecta badges/insignias circulares.
 *
 * Caso A  — alpha REAL (píxeles transparentes): fillRatio de opacos ≈ π/4, o borde saturado.
 * Caso A' — alpha FALSO (PNG con bg opaco, alpha=255 en todos): redirige a Caso B.
 * Caso B  — sin alpha (JPG/PNG sólido): fondo blanco → circularidad; fondo color → lógica original.
 */
async function isBadgeLogo(fileBuffer: Buffer, hasAlpha: boolean): Promise<boolean> {
  const { data, info } = await sharp(fileBuffer, { failOn: "none" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;

  if (hasAlpha) {
    // Contar píxeles transparentes para saber si el alpha es real
    let transparentCount = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 128) { transparentCount++; }
    }

    // ── Caso A': sin transparencia real → tratar como Caso B ─────────────
    if (transparentCount === 0) {
      return checkSolidRectBadge(data, w, h);
    }

    // ── Caso A: transparencia real ────────────────────────────────────────
    let rmin = h, rmax = 0, cmin = w, cmax = 0, opaqueCount = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const a = data[(y * w + x) * 4 + 3];
        if (a > 128) {
          opaqueCount++;
          if (y < rmin) rmin = y;
          if (y > rmax) rmax = y;
          if (x < cmin) cmin = x;
          if (x > cmax) cmax = x;
        }
      }
    }
    if (opaqueCount === 0) return false;

    const bw = cmax - cmin + 1;
    const bh = rmax - rmin + 1;
    if (bw / bh < 0.4 || bw / bh > 2.5) return false;

    // Estrategia 1: forma circular
    const fillRatio = opaqueCount / (bw * bh);
    if (fillRatio >= 0.65 && fillRatio <= 0.98) return true;

    // Estrategia 2: borde interno saturado
    const samples: Array<{ r: number; g: number; b: number }> = [];
    const inset = Math.max(4, Math.floor(Math.min(bw, bh) * 0.04));
    const step = 8;
    for (let x = cmin; x <= cmax; x += step) {
      for (let y = rmin; y <= rmin + inset * 4; y++) {
        const idx = (y * w + x) * 4;
        if (data[idx + 3] > 128) { samples.push({ r: data[idx], g: data[idx+1], b: data[idx+2] }); break; }
      }
      for (let y = rmax; y >= rmax - inset * 4; y--) {
        const idx = (y * w + x) * 4;
        if (data[idx + 3] > 128) { samples.push({ r: data[idx], g: data[idx+1], b: data[idx+2] }); break; }
      }
    }
    for (let y = rmin; y <= rmax; y += step) {
      for (let x = cmin; x <= cmin + inset * 4; x++) {
        const idx = (y * w + x) * 4;
        if (data[idx + 3] > 128) { samples.push({ r: data[idx], g: data[idx+1], b: data[idx+2] }); break; }
      }
      for (let x = cmax; x >= cmax - inset * 4; x--) {
        const idx = (y * w + x) * 4;
        if (data[idx + 3] > 128) { samples.push({ r: data[idx], g: data[idx+1], b: data[idx+2] }); break; }
      }
    }
    if (samples.length < 10) return false;
    const avgSat = samples.reduce((acc, px) => {
      const mx = Math.max(px.r, px.g, px.b), mn = Math.min(px.r, px.g, px.b);
      return acc + (mx > 0 ? (mx - mn) / mx : 0);
    }, 0) / samples.length;
    const avgBrt = samples.reduce((acc, px) => acc + (px.r + px.g + px.b) / 3, 0) / samples.length;
    return avgSat > 0.25 && avgBrt > 20;

  } else {
    // ── Caso B: sin canal alpha ───────────────────────────────────────────
    return checkSolidRectBadge(data, w, h);
  }
}

/** Lógica común para imágenes rectangulares sólidas (Caso B y Caso A'). */
function checkSolidRectBadge(data: Buffer, w: number, h: number): boolean {
  const corners = [
    getPixel(data, w, 0,     0    ),
    getPixel(data, w, w - 1, 0    ),
    getPixel(data, w, 0,     h - 1),
    getPixel(data, w, w - 1, h - 1),
  ];
  if (!cornersSimilar(corners, 30)) return false;

  const edgeColor = averageRGBA(corners);
  const whiteness = Math.min(edgeColor.r, edgeColor.g, edgeColor.b);

  // Fondo blanco → detectar badge por circularidad del contenido
  if (whiteness > 220) {
    return detectCircularContent(data, w, h, edgeColor.r, edgeColor.g, edgeColor.b, 30);
  }

  // Fondo de color saturado → lógica original
  const mx = Math.max(edgeColor.r, edgeColor.g, edgeColor.b);
  const mn = Math.min(edgeColor.r, edgeColor.g, edgeColor.b);
  if (mx === 0 || (mx - mn) / mx < 0.2) return false;

  const step = 4;
  const edgeSamples: Array<{ r: number; g: number; b: number; a: number }> = [];
  for (let x = 0; x < w; x += step) {
    edgeSamples.push(getPixel(data, w, x, 0));
    edgeSamples.push(getPixel(data, w, x, h - 1));
  }
  for (let y = 0; y < h; y += step) {
    edgeSamples.push(getPixel(data, w, 0,     y));
    edgeSamples.push(getPixel(data, w, w - 1, y));
  }
  const matchCount = edgeSamples.filter(px => {
    const diff = Math.sqrt((px.r - edgeColor.r) ** 2 + (px.g - edgeColor.g) ** 2 + (px.b - edgeColor.b) ** 2);
    return diff <= 50;
  }).length;
  if (matchCount / edgeSamples.length < 0.55) return false;

  const center = getPixel(data, w, Math.floor(w / 2), Math.floor(h / 2));
  const centerDiff = Math.sqrt((center.r - edgeColor.r) ** 2 + (center.g - edgeColor.g) ** 2 + (center.b - edgeColor.b) ** 2);
  return centerDiff >= 30;
}

const PADDING = 20;

export async function analyzeLogoBuffer(fileBuffer: Buffer, mimeType?: string): Promise<SmartLogoResult> {
  const isSvg =
    mimeType?.includes("svg") ||
    fileBuffer.slice(0, 200).toString("utf8").trimStart().startsWith("<svg") ||
    fileBuffer.slice(0, 200).toString("utf8").trimStart().startsWith("<?xml");

  if (isSvg) {
    const rasterized = await sharp(fileBuffer, { failOn: "none" }).resize(512, 512, { fit: "inside", withoutEnlargement: false }).png().toBuffer();
    const trimmed = await sharp(rasterized, { failOn: "none" }).trim({ threshold: 10 }).png().toBuffer();
    const meta = await sharp(trimmed).metadata();
    const tw = meta.width ?? 1, th = meta.height ?? 1;
    const ar = tw / th;
    return { plan: { kind: "SVG" }, trimmedAr: ar, box: getSmartLogoBox(ar), processedBuffer: await addWhiteBackgroundAndPadding(trimmed, PADDING), skipEnhancement: true };
  }

  const img = sharp(fileBuffer, { failOn: "none" });
  const meta = await img.metadata();
  const hasAlpha = Boolean(meta.hasAlpha);

  const badge = await isBadgeLogo(fileBuffer, hasAlpha);
  if (badge) {
    let badgeBuffer: Buffer;

    const { data: rawData, info: rawInfo } = await sharp(fileBuffer, { failOn: "none" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const rw = rawInfo.width, rh = rawInfo.height;

    // Detectar si hay transparencia real
    let hasRealTransparency = false;
    if (hasAlpha) {
      for (let i = 3; i < rawData.length; i += 4) {
        if (rawData[i] < 128) { hasRealTransparency = true; break; }
      }
    }

    if (hasRealTransparency) {
      // Alpha real → trim + resize, ya es transparente
      badgeBuffer = await sharp(fileBuffer, { failOn: "none" })
        .trim({ threshold: 10 })
        .resize(512, 512, { fit: "inside", withoutEnlargement: false })
        .png()
        .toBuffer();
    } else {
      // Sin transparencia real (JPG, PNG sólido, o PNG alpha-pero-opaco)
      const corners = [
        getPixel(rawData, rw, 0,      0     ),
        getPixel(rawData, rw, rw - 1, 0     ),
        getPixel(rawData, rw, 0,      rh - 1),
        getPixel(rawData, rw, rw - 1, rh - 1),
      ];
      const avg = averageRGBA(corners);
      const isWhiteBg = cornersSimilar(corners, 30) && avg.r > 220 && avg.g > 220 && avg.b > 220;

      if (isWhiteBg) {
        // Quitar fondo blanco (tol=40 para artefactos JPG), sin padding
        const withoutBg = await removeSolidBackground(fileBuffer, avg.r, avg.g, avg.b, 40);
        badgeBuffer = await sharp(withoutBg, { failOn: "none" })
          .trim({ threshold: 10 })
          .resize(512, 512, { fit: "inside", withoutEnlargement: false })
          .png()
          .toBuffer();
      } else {
        // Fondo de color → es parte del diseño, solo resize
        badgeBuffer = await sharp(fileBuffer, { failOn: "none" })
          .resize(512, 512, { fit: "inside", withoutEnlargement: false })
          .png()
          .toBuffer();
      }
    }

    const resizedMeta = await sharp(badgeBuffer).metadata();
    const tw = resizedMeta.width ?? meta.width ?? 1;
    const th = resizedMeta.height ?? meta.height ?? 1;
    const ar = tw / th;
    return { plan: { kind: "BADGE" }, trimmedAr: ar, box: getSmartLogoBox(ar), processedBuffer: badgeBuffer, skipEnhancement: true };
  }

  // ── Normal logo paths ─────────────────────────────────────────────────────
  let plan: SmartPlan;
  let logoBuffer: Buffer;

  if (hasAlpha) {
    plan = { kind: "HAS_ALPHA" };
    logoBuffer = await sharp(fileBuffer, { failOn: "none" }).trim({ threshold: 20 }).png().toBuffer();
  } else {
    const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const w = info.width, h = info.height;
    const corners = [
      getPixel(data, w, 0,     0    ),
      getPixel(data, w, w - 1, 0    ),
      getPixel(data, w, 0,     h - 1),
      getPixel(data, w, w - 1, h - 1),
    ];
    if (cornersSimilar(corners, 18)) {
      const avg = averageRGBA(corners);
      plan = { kind: "SOLID_BG", bgHex: rgbToHex(avg.r, avg.g, avg.b), bgR: avg.r, bgG: avg.g, bgB: avg.b };
      const withoutBg = await removeSolidBackground(fileBuffer, avg.r, avg.g, avg.b, 40);
      logoBuffer = await sharp(withoutBg, { failOn: "none" }).trim({ threshold: 10 }).png().toBuffer();
    } else {
      plan = { kind: "COMPLEX_BG" };
      logoBuffer = await sharp(fileBuffer, { failOn: "none" }).trim({ threshold: 20 }).png().toBuffer();
    }
  }

  const logoMeta = await sharp(logoBuffer).metadata();
  const tw = logoMeta.width ?? meta.width ?? 1;
  const th = logoMeta.height ?? meta.height ?? 1;
  const trimmedAr = tw / th;
  const processedBuffer = await addWhiteBackgroundAndPadding(logoBuffer, PADDING);
  return { plan, trimmedAr, box: getSmartLogoBox(trimmedAr), processedBuffer, skipEnhancement: false };
}

export function buildSmartDisplayUrl(args: { cloudName: string; publicId: string; box: LogoBox }): string {
  const { cloudName, publicId, box } = args;
  return `https://res.cloudinary.com/${cloudName}/image/upload/c_fit,w_${box.w},h_${box.h}/f_png,q_auto/${publicId}`;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getPixel(raw: Buffer, width: number, x: number, y: number) {
  const idx = (y * width + x) * 4;
  return { r: raw[idx], g: raw[idx + 1], b: raw[idx + 2], a: raw[idx + 3] };
}

function cornersSimilar(px: Array<{ r: number; g: number; b: number; a: number }>, tol: number) {
  const base = px[0];
  for (let i = 1; i < px.length; i++) {
    if (Math.abs(px[i].r - base.r) > tol || Math.abs(px[i].g - base.g) > tol || Math.abs(px[i].b - base.b) > tol) return false;
  }
  return true;
}

function averageRGBA(px: Array<{ r: number; g: number; b: number; a: number }>) {
  const sum = px.reduce((acc, p) => ({ r: acc.r + p.r, g: acc.g + p.g, b: acc.b + p.b, a: acc.a + p.a }), { r: 0, g: 0, b: 0, a: 0 });
  const n = px.length;
  return { r: Math.round(sum.r / n), g: Math.round(sum.g / n), b: Math.round(sum.b / n), a: Math.round(sum.a / n) };
}

function rgbToHex(r: number, g: number, b: number) {
  return r.toString(16).padStart(2, "0") + g.toString(16).padStart(2, "0") + b.toString(16).padStart(2, "0");
}