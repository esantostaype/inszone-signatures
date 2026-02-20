/* eslint-disable @typescript-eslint/no-explicit-any */
// src/lib/logoSmart.ts
import sharp from "sharp";
import { cloudinary } from "./cloudinary";

export type UploadMeta = {
  public_id: string;
  secure_url: string;
  width: number;
  height: number;
  bytes?: number;
  format?: string;
};

export type SmartPlan =
  | { kind: "HAS_ALPHA" }
  | { kind: "SOLID_BG"; bgHex: string }
  | { kind: "COMPLEX_BG" };

export type LogoBox = { w: number; h: number };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Tu regla de tamaños (solo UI, NO redimensiona el archivo en Cloudinary).
 */
export function getSmartLogoBox(srcW?: number, srcH?: number): LogoBox {
  if (!srcW || !srcH) return { w: 64, h: 64 };
  const ar = srcW / srcH;

  if (ar >= 0.9 && ar <= 1.1) return { w: 64, h: 64 };      // ~1:1
  if (ar > 1.1 && ar <= 2.3) return { w: 90, h: 45 };       // ~2:1
  if (ar > 2.3 && ar <= 3.6) return { w: 110, h: 35 };      // ~3:1

  if (ar < 0.9) return { w: 45, h: 90 };                    // vertical

  // fallback ratios raros
  const maxW = 140;
  const minH = 28;
  const maxH = 96;
  const h = clamp(Math.round(maxW / ar), minH, maxH);
  return { w: maxW, h };
}

/**
 * Analiza el archivo subido y decide automáticamente el plan:
 * - Si tiene alpha => HAS_ALPHA
 * - Si no tiene alpha y el fondo se ve sólido (por esquinas) => SOLID_BG con hex
 * - Si no => COMPLEX_BG (intenta AI bg removal si está disponible)
 */
export async function detectSmartPlan(fileBuffer: Buffer): Promise<SmartPlan> {
  // 1) Detectar alpha
  const img = sharp(fileBuffer, { failOn: "none" });
  const meta = await img.metadata();
  const hasAlpha = Boolean(meta.hasAlpha);

  if (hasAlpha) return { kind: "HAS_ALPHA" };

  // 2) Si no hay alpha, inspecciona “color de fondo” por esquinas
  //    (si el logo está centrado o abajo, igual las esquinas suelen ser fondo)
  const { data, info } = await img
    .ensureAlpha() // agrega canal alpha (opaco) para simplificar lectura RGBA
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;

  const corners = [
    getPixelRGBA(data, w, 0, 0),           // top-left
    getPixelRGBA(data, w, w - 1, 0),       // top-right
    getPixelRGBA(data, w, 0, h - 1),       // bottom-left
    getPixelRGBA(data, w, w - 1, h - 1),   // bottom-right
  ];

  // Si las esquinas son MUY parecidas => fondo sólido
  const solid = cornersSimilar(corners, 18); // tolerancia (0-255). Sube/baja si quieres.

  if (solid) {
    const avg = averageRGBA(corners);
    const bgHex = rgbToHex(avg.r, avg.g, avg.b);
    return { kind: "SOLID_BG", bgHex };
  }

  return { kind: "COMPLEX_BG" };
}

function getPixelRGBA(raw: Buffer, width: number, x: number, y: number) {
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
  const to2 = (n: number) => n.toString(16).padStart(2, "0");
  return `${to2(r)}${to2(g)}${to2(b)}`;
}

/**
 * Genera URL “display” para tu card.
 *
 * Incluye:
 * - Trim para recortar aire: e_trim
 * - Si NO alpha y fondo sólido => e_make_transparent (por color) + trim
 * - Si fondo complejo => intenta AI bg removal + trim (si tu cuenta lo soporta)
 *
 * Importante:
 * - Esto NO “elige logo”; es automático.
 * - Si AI bg removal no está habilitado, el asset igual se verá (solo sin remover fondo).
 */
export function buildSmartDisplayUrl(args: {
  cloudName: string;
  publicId: string;
  srcW?: number;
  srcH?: number;
  plan: SmartPlan;
  canvas?: "fit" | "pad"; // fit recomendado; pad si quieres tamaño exacto
}) {
  const { cloudName, publicId, srcW, srcH, plan, canvas = "fit" } = args;
  const box = getSmartLogoBox(srcW, srcH);

  const t: Array<Record<string, any>> = [];

  // 1) Normalización de formato/calidad (mantiene alpha cuando exista)
  t.push({ fetch_format: "auto", quality: "auto" });

  // 2) Remover fondo si aplica
  if (plan.kind === "SOLID_BG") {
    // Hace transparente el color del fondo detectado.
    // Nota: en Cloudinary, el color suele ir como "rgb:ffffff" o "FFFFFF"
    t.push({ effect: `make_transparent:${plan.bgHex}` });
  } else if (plan.kind === "COMPLEX_BG") {
    // Intento de AI Background Removal (si tu cuenta lo tiene habilitado).
    // Si no lo tienes, Cloudinary puede devolver error si lo llamas como transformación.
    // Por eso, abajo te doy un handler server-side que lo intenta y hace fallback.
    t.push({ effect: "background_removal" });
  }

  // 3) Recorta bordes vacíos (sirve para “logo pequeño centrado” o “logo abajo con aire arriba”)
  t.push({ effect: "trim" });

  // 4) Ajuste final al tamaño visual que quieres
  if (canvas === "pad") {
    t.push({ crop: "pad", background: "transparent", width: box.w, height: box.h });
  } else {
    t.push({ crop: "fit", width: box.w, height: box.h });
  }

  // Construye URL con SDK (para evitar string manual)
  // OJO: necesitas cloudinary.v2.url. Aquí usamos cloudinary.url.
  return cloudinary.url(publicId, {
    secure: true,
    cloud_name: cloudName,
    transformation: t,
  });
}