/* eslint-disable @typescript-eslint/no-explicit-any */
// src/lib/logoSmart.ts
import sharp from "sharp";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

export type SmartPlan =
  | { kind: "HAS_ALPHA" }
  | { kind: "SOLID_BG"; bgHex: string; bgR: number; bgG: number; bgB: number }
  | { kind: "COMPLEX_BG" };

export type LogoBox = { w: number; h: number };

export type SmartLogoResult = {
  plan: SmartPlan;
  trimmedAr: number;
  box: LogoBox;
  /** Buffer procesado (fondo removido + trimmed) listo para subir a Cloudinary */
  processedBuffer: Buffer;
};

/** Tamaño visual según AR real del logo (post-trim) */
export function getSmartLogoBox(ar: number): LogoBox {
  let w: number;

  if (ar < 0.85)                w = 40;  // vertical
  else if (ar <= 1.18)          w = 64;  // ~1:1
  else if (ar <= 1.7)           w = 88;  // ~3:2
  else if (ar <= 2.4)           w = 96;  // ~2:1
  else if (ar <= 3.4)           w = 106; // ~3:1
  else if (ar <= 4.4)           w = 114; // ~4:1
  else if (ar <= 5.4)           w = 122; // ~5:1
  else if (ar <= 6.4)           w = 130; // ~6:1
  else if (ar <= 7.4)           w = 138; // ~7:1
  else if (ar <= 8.4)           w = 146; // ~8:1
  else if (ar <= 9.4)           w = 154; // ~9:1
  else                          w = 160; // ~10:1+

  // Alto calculado del AR real — nunca forzado
  const h = Math.round(w / ar);

  return { w, h };
}

/**
 * Elimina fondo de color sólido píxel a píxel con sharp.
 * 100% local, 100% gratis — no necesita Cloudinary AI ni APIs externas.
 *
 * Usa distancia euclidiana en espacio RGB para comparar cada píxel
 * contra el color detectado en las esquinas.
 */
async function removeSolidBackground(
  buffer: Buffer,
  bgR: number,
  bgG: number,
  bgB: number,
  tolerance = 40
): Promise<Buffer> {
  const { data, info } = await sharp(buffer, { failOn: "none" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8ClampedArray(data);
  const totalPixels = info.width * info.height;

  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    const r = pixels[idx];
    const g = pixels[idx + 1];
    const b = pixels[idx + 2];

    // Distancia euclidiana RGB al color de fondo
    const diff = Math.sqrt(
      (r - bgR) ** 2 +
      (g - bgG) ** 2 +
      (b - bgB) ** 2
    );

    if (diff <= tolerance) {
      pixels[idx + 3] = 0; // transparente
    }
  }

  return sharp(Buffer.from(pixels.buffer), {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

/**
 * Pipeline completo:
 * 1. Detecta plan (alpha / fondo sólido / fondo complejo)
 * 2. Remueve el fondo localmente con sharp (gratis)
 * 3. Hace trim para quitar bordes vacíos
 * 4. Calcula el AR real del logo (sin canvas vacío)
 * 5. Devuelve buffer PNG procesado listo para subir
 */
export async function analyzeLogoBuffer(fileBuffer: Buffer): Promise<SmartLogoResult> {
  const img = sharp(fileBuffer, { failOn: "none" });
  const meta = await img.metadata();
  const hasAlpha = Boolean(meta.hasAlpha);

  let plan: SmartPlan;
  let processedBuffer: Buffer;

  if (hasAlpha) {
    // Ya tiene canal alpha — solo hacemos trim
    plan = { kind: "HAS_ALPHA" };
    processedBuffer = await sharp(fileBuffer, { failOn: "none" })
      .trim({ threshold: 20 })
      .png()
      .toBuffer();

  } else {
    // Sin alpha — detectar color de fondo por esquinas
    const { data, info } = await img
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const w = info.width;
    const h = info.height;

    const corners = [
      getPixel(data, w, 0,     0    ),
      getPixel(data, w, w - 1, 0    ),
      getPixel(data, w, 0,     h - 1),
      getPixel(data, w, w - 1, h - 1),
    ];

    if (cornersSimilar(corners, 18)) {
      // ✅ Fondo sólido → remover gratis con sharp
      const avg = averageRGBA(corners);
      plan = {
        kind:  "SOLID_BG",
        bgHex: rgbToHex(avg.r, avg.g, avg.b),
        bgR:   avg.r,
        bgG:   avg.g,
        bgB:   avg.b,
      };

      const withoutBg = await removeSolidBackground(
        fileBuffer,
        avg.r, avg.g, avg.b,
        40 // tolerancia: sube si quedan restos de fondo, baja si se come el logo
      );

      processedBuffer = await sharp(withoutBg, { failOn: "none" })
        .trim({ threshold: 10 })
        .png()
        .toBuffer();

    } else {
      // Fondo complejo (foto, gradiente, etc.)
      // Subimos el original; el usuario puede usar "Mejorar con IA" para esto
      plan = { kind: "COMPLEX_BG" };
      processedBuffer = await sharp(fileBuffer, { failOn: "none" })
        .trim({ threshold: 20 })
        .png()
        .toBuffer();
    }
  }

  // Calcular AR real del buffer procesado (ya sin bordes vacíos)
  const processedMeta = await sharp(processedBuffer).metadata();
  const tw = processedMeta.width  ?? meta.width  ?? 1;
  const th = processedMeta.height ?? meta.height ?? 1;
  const trimmedAr = tw / th;

  return {
    plan,
    trimmedAr,
    box: getSmartLogoBox(trimmedAr),
    processedBuffer,
  };
}

/**
 * URL de Cloudinary simple — el procesamiento ya se hizo localmente.
 * Solo aplica resize final manteniendo AR.
 */
export function buildSmartDisplayUrl(args: {
  cloudName: string;
  publicId: string;
  box: LogoBox;
}): string {
  const { cloudName, publicId, box } = args;
  // f_png: forzar PNG para preservar transparencia (no webp que puede perderla en Outlook)
  const transformation = `c_fit,w_${box.w},h_${box.h}/f_png,q_auto`;
  return `https://res.cloudinary.com/${cloudName}/image/upload/${transformation}/${publicId}`;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getPixel(raw: Buffer, width: number, x: number, y: number) {
  const idx = (y * width + x) * 4;
  return { r: raw[idx], g: raw[idx + 1], b: raw[idx + 2], a: raw[idx + 3] };
}

function cornersSimilar(
  px: Array<{ r: number; g: number; b: number; a: number }>,
  tol: number
) {
  const base = px[0];
  for (let i = 1; i < px.length; i++) {
    if (
      Math.abs(px[i].r - base.r) > tol ||
      Math.abs(px[i].g - base.g) > tol ||
      Math.abs(px[i].b - base.b) > tol
    ) return false;
  }
  return true;
}

function averageRGBA(px: Array<{ r: number; g: number; b: number; a: number }>) {
  const sum = px.reduce(
    (acc, p) => ({ r: acc.r + p.r, g: acc.g + p.g, b: acc.b + p.b, a: acc.a + p.a }),
    { r: 0, g: 0, b: 0, a: 0 }
  );
  const n = px.length;
  return {
    r: Math.round(sum.r / n),
    g: Math.round(sum.g / n),
    b: Math.round(sum.b / n),
    a: Math.round(sum.a / n),
  };
}

function rgbToHex(r: number, g: number, b: number) {
  return (
    r.toString(16).padStart(2, "0") +
    g.toString(16).padStart(2, "0") +
    b.toString(16).padStart(2, "0")
  );
}

const execFileAsync = promisify(execFile);

async function runImageMagickStroke(buffer: Buffer, strokePx: number): Promise<Buffer> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "logo-im-"));
  const inputPath = path.join(tmpDir, "in.png");
  const outputPath = path.join(tmpDir, "out.png");

  try {
    await fs.writeFile(inputPath, buffer);

    await execFileAsync("magick", [
      inputPath,
      "(",
      "+clone",
      "-alpha",
      "extract",
      "-morphology",
      "open",
      "disk:1",
      "-morphology",
      "close",
      "disk:1",
      "-threshold",
      "10%",
      ")",
      "-write",
      "mpr:mask",
      "+delete",
      "(",
      "mpr:mask",
      "-morphology",
      "dilate",
      `disk:${strokePx}`,
      "mpr:mask",
      "-compose",
      "minus_src",
      "-composite",
      "-fill",
      "white",
      "-colorize",
      "100",
      ")",
      "(",
      "xc:none",
      "-size",
      "1x1",
      ")",
      "-delete",
      "2",
      "(",
      "+clone",
      "-alpha",
      "off",
      "mpr:mask",
      "-compose",
      "copyopacity",
      "-composite",
      ")",
      "-delete",
      "0",
      "1",
      "-background",
      "none",
      "-layers",
      "merge",
      outputPath,
    ]);

    return await fs.readFile(outputPath);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

async function runSharpStrokeFallback(buffer: Buffer, strokePx: number): Promise<Buffer> {
  const { data, info } = await sharp(buffer, { failOn: "none" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const src = new Uint8ClampedArray(data);

  const alpha = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) {
    alpha[i] = src[i * 4 + 3] > 20 ? 255 : 0;
  }

  const cleaned = new Uint8ClampedArray(alpha);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      if (alpha[idx] === 255) continue;
      let neighbors = 0;
      for (let yy = -1; yy <= 1; yy++) {
        for (let xx = -1; xx <= 1; xx++) {
          if (xx === 0 && yy === 0) continue;
          if (alpha[(y + yy) * w + (x + xx)] === 255) neighbors++;
        }
      }
      if (neighbors >= 7) cleaned[idx] = 255;
    }
  }

  const dilated = new Uint8ClampedArray(cleaned);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (cleaned[idx] === 255) continue;
      let hit = false;
      for (let yy = -strokePx; yy <= strokePx && !hit; yy++) {
        for (let xx = -strokePx; xx <= strokePx; xx++) {
          if (xx * xx + yy * yy > strokePx * strokePx) continue;
          const nx = x + xx;
          const ny = y + yy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (cleaned[ny * w + nx] === 255) {
            hit = true;
            break;
          }
        }
      }
      if (hit) dilated[idx] = 255;
    }
  }

  const out = new Uint8ClampedArray(src);
  for (let i = 0; i < w * h; i++) {
    const a = cleaned[i] === 255;
    const d = dilated[i] === 255;
    if (!a && d) {
      const idx = i * 4;
      out[idx] = 255;
      out[idx + 1] = 255;
      out[idx + 2] = 255;
      out[idx + 3] = 255;
    } else if (!a) {
      out[i * 4 + 3] = 0;
    }
  }

  return sharp(Buffer.from(out.buffer), { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toBuffer();
}

export async function cleanBackgroundAndAddWhiteStroke(
  buffer: Buffer,
  strokePx = 2
): Promise<Buffer> {
  const normalized = await sharp(buffer, { failOn: "none" })
    .ensureAlpha()
    .trim({ threshold: 10 })
    .png()
    .toBuffer();

  try {
    return await runImageMagickStroke(normalized, strokePx);
  } catch {
    return runSharpStrokeFallback(normalized, strokePx);
  }
}
