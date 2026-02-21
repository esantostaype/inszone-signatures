/* eslint-disable @typescript-eslint/no-explicit-any */
// src/lib/logoSmart.ts
import sharp from "sharp";

export type SmartPlan =
  | { kind: "HAS_ALPHA" }
  | { kind: "SOLID_BG"; bgHex: string; bgR: number; bgG: number; bgB: number }
  | { kind: "COMPLEX_BG" }
  | { kind: "SVG" }
  | { kind: "BADGE" }; // <-- NEW: colored badge/emblem, keep as-is

export type LogoBox = { w: number; h: number };

export type SmartLogoResult = {
  plan: SmartPlan;
  trimmedAr: number;
  box: LogoBox;
  /** Buffer procesado (fondo blanco + padding) listo para subir a Cloudinary */
  processedBuffer: Buffer;
  /** Si es SVG o imagen perfecta, saltar el pipeline analyze/enhance */
  skipEnhancement: boolean;
};

/** Tamaño visual según AR real del logo (post-trim, sin contar el padding) */
export function getSmartLogoBox(ar: number): LogoBox {
  let w: number;

  if (ar < 0.85)       w = 40;
  else if (ar <= 1.18) w = 64;
  else if (ar <= 1.7) w = 96;
  else if (ar <= 2.4) w = 105;
  else if (ar <= 3.4) w = 117;
  else if (ar <= 4.4) w = 126;
  else if (ar <= 5.4) w = 136;
  else if (ar <= 6.4) w = 145;
  else if (ar <= 7.4) w = 154;
  else if (ar <= 8.4) w = 164;
  else if (ar <= 9.4) w = 173;
  else                w = 180;

  const h = Math.round(w / ar);
  return { w, h };
}

/**
 * Agrega fondo blanco sólido y N píxeles de padding a todos los lados.
 * La imagen resultante tiene dimensions (w + padding*2) x (h + padding*2)
 * con el logo centrado sobre fondo blanco.
 */
export async function addWhiteBackgroundAndPadding(
  buffer: Buffer,
  padding = 20
): Promise<Buffer> {
  const meta = await sharp(buffer, { failOn: "none" }).metadata();
  const w = meta.width  ?? 0;
  const h = meta.height ?? 0;

  return sharp({
    create: {
      width:      w + padding * 2,
      height:     h + padding * 2,
      channels:   3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([{ input: buffer, top: padding, left: padding }])
    .png()
    .toBuffer();
}

/**
 * Elimina fondo de color sólido píxel a píxel con sharp.
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

    const diff = Math.sqrt(
      (r - bgR) ** 2 +
      (g - bgG) ** 2 +
      (b - bgB) ** 2
    );

    if (diff <= tolerance) {
      pixels[idx + 3] = 0;
    }
  }

  return sharp(Buffer.from(pixels.buffer), {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

/**
 * Detecta si una imagen es un "badge" o insignia — un logo circular, escudo,
 * o emblema donde el fondo de color ES parte del diseño intencional.
 *
 * Funciona tanto para imágenes con alpha COMO sin alpha:
 *
 * Caso A — CON alpha (ej: webp/png circular recortado):
 *   Muestrea los píxeles del borde INTERNO de la forma opaca (los primeros/últimos
 *   píxeles opacos en cada fila/columna). Si esos píxeles tienen alta saturación
 *   de color (no son blancos/grises), es un badge con fondo de color intencional.
 *
 * Caso B — SIN alpha (imagen rectangular sólida):
 *   Verifica que los bordes exteriores sean de un color uniforme y saturado
 *   (no blanco), indicando que el fondo rectangular es parte del diseño.
 *
 * Returns true si el logo es un badge y debe mantenerse sin modificación.
 */
async function isBadgeLogo(
  fileBuffer: Buffer,
  hasAlpha: boolean
): Promise<boolean> {
  const { data, info } = await sharp(fileBuffer, { failOn: "none" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;

  if (hasAlpha) {
    // ── Caso A: imagen con transparencia ────────────────────────────────────
    // Encontrar el bounding box del contenido opaco
    let rmin = h, rmax = 0, cmin = w, cmax = 0;
    let opaqueCount = 0;
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

    const bw = cmax - cmin;
    const bh = rmax - rmin;

    // Debe ser razonablemente compacto/cuadrado (badges suelen ser ~cuadrados o ligeramente rectangulares)
    const bbAr = bw / bh;
    if (bbAr < 0.4 || bbAr > 2.5) return false; // muy alargado → no es badge

    // Muestrear píxeles del borde interno de la forma opaca
    // (los primeros píxeles opacos desde cada borde del bounding box)
    const innerEdgeSamples: Array<{ r: number; g: number; b: number }> = [];
    const insetPx = Math.max(4, Math.floor(Math.min(bw, bh) * 0.04)); // ~4% hacia adentro
    const step = 8;

    // Borde superior e inferior de la forma
    for (let x = cmin; x <= cmax; x += step) {
      // Primeros opacos desde arriba y desde abajo
      for (let y = rmin; y <= rmin + insetPx * 4; y++) {
        const idx = (y * w + x) * 4;
        if (data[idx + 3] > 128) {
          innerEdgeSamples.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });
          break;
        }
      }
      for (let y = rmax; y >= rmax - insetPx * 4; y--) {
        const idx = (y * w + x) * 4;
        if (data[idx + 3] > 128) {
          innerEdgeSamples.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });
          break;
        }
      }
    }
    // Borde izquierdo y derecho de la forma
    for (let y = rmin; y <= rmax; y += step) {
      for (let x = cmin; x <= cmin + insetPx * 4; x++) {
        const idx = (y * w + x) * 4;
        if (data[idx + 3] > 128) {
          innerEdgeSamples.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });
          break;
        }
      }
      for (let x = cmax; x >= cmax - insetPx * 4; x--) {
        const idx = (y * w + x) * 4;
        if (data[idx + 3] > 128) {
          innerEdgeSamples.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });
          break;
        }
      }
    }

    if (innerEdgeSamples.length < 10) return false;

    // Calcular saturación promedio de los píxeles del borde interno
    // Saturación = (max - min) / max  (simplificación HSV)
    const avgSaturation = innerEdgeSamples.reduce((acc, px) => {
      const mx = Math.max(px.r, px.g, px.b);
      const mn = Math.min(px.r, px.g, px.b);
      return acc + (mx > 0 ? (mx - mn) / mx : 0);
    }, 0) / innerEdgeSamples.length;

    // Verificar que no sea un blanco/gris (whiteness alta = no badge)
    const avgBrightness = innerEdgeSamples.reduce(
      (acc, px) => acc + (px.r + px.g + px.b) / 3, 0
    ) / innerEdgeSamples.length;

    // Badge si: borde interno tiene color saturado (dorado, azul, rojo, etc.)
    // y no es casi blanco o casi negro sin saturación
    const isSaturatedColor = avgSaturation > 0.25 && avgBrightness > 20;
    return isSaturatedColor;

  } else {
    // ── Caso B: imagen sin alpha (rectangular sólida) ────────────────────────
    const corners = [
      getPixel(data, w, 0,     0    ),
      getPixel(data, w, w - 1, 0    ),
      getPixel(data, w, 0,     h - 1),
      getPixel(data, w, w - 1, h - 1),
    ];

    if (!cornersSimilar(corners, 30)) return false;

    const edgeColor = averageRGBA(corners);

    // Skip near-white backgrounds
    const whiteness = Math.min(edgeColor.r, edgeColor.g, edgeColor.b);
    if (whiteness > 220) return false;

    // El color de borde debe ser saturado
    const mx = Math.max(edgeColor.r, edgeColor.g, edgeColor.b);
    const mn = Math.min(edgeColor.r, edgeColor.g, edgeColor.b);
    const saturation = mx > 0 ? (mx - mn) / mx : 0;
    if (saturation < 0.2) return false; // gris → no es badge

    // Muestrear borde exterior
    const edgeSamples: Array<{ r: number; g: number; b: number; a: number }> = [];
    const step = 4;
    for (let x = 0; x < w; x += step) {
      edgeSamples.push(getPixel(data, w, x, 0));
      edgeSamples.push(getPixel(data, w, x, h - 1));
    }
    for (let y = 0; y < h; y += step) {
      edgeSamples.push(getPixel(data, w, 0,     y));
      edgeSamples.push(getPixel(data, w, w - 1, y));
    }

    const matchCount = edgeSamples.filter(px => {
      const diff = Math.sqrt(
        (px.r - edgeColor.r) ** 2 +
        (px.g - edgeColor.g) ** 2 +
        (px.b - edgeColor.b) ** 2
      );
      return diff <= 50;
    }).length;

    if (matchCount / edgeSamples.length < 0.55) return false;

    // Centro debe ser diferente del borde
    const centerPx = getPixel(data, w, Math.floor(w / 2), Math.floor(h / 2));
    const centerDiff = Math.sqrt(
      (centerPx.r - edgeColor.r) ** 2 +
      (centerPx.g - edgeColor.g) ** 2 +
      (centerPx.b - edgeColor.b) ** 2
    );
    return centerDiff >= 30;
  }
}

const PADDING = 20;

/**
 * Pipeline completo:
 * 1. Detecta tipo (SVG, alpha, badge/emblem, fondo sólido, fondo complejo)
 * 2. Para SVG: rasteriza directamente
 * 3. Para alpha: trim directo + fondo blanco + padding
 * 4. Para badge/emblem: solo redimensiona, sin fondo blanco ni padding
 * 5. Para fondo sólido: remueve fondo + fondo blanco + padding
 * 6. Para complejo: trim + fondo blanco + padding
 * 7. Calcula AR del contenido (sin el padding)
 * 8. Devuelve buffer PNG listo para subir
 */
export async function analyzeLogoBuffer(
  fileBuffer: Buffer,
  mimeType?: string
): Promise<SmartLogoResult> {
  const isSvg =
    mimeType?.includes("svg") ||
    fileBuffer.slice(0, 200).toString("utf8").trimStart().startsWith("<svg") ||
    fileBuffer.slice(0, 200).toString("utf8").trimStart().startsWith("<?xml");

  // ── SVG: rasterizar a 512px y saltar enhance ──────────────────────────────
  if (isSvg) {
    const rasterized = await sharp(fileBuffer, { failOn: "none" })
      .resize(512, 512, { fit: "inside", withoutEnlargement: false })
      .png()
      .toBuffer();

    const trimmed = await sharp(rasterized, { failOn: "none" })
      .trim({ threshold: 10 })
      .png()
      .toBuffer();

    const meta = await sharp(trimmed).metadata();
    const tw = meta.width  ?? 1;
    const th = meta.height ?? 1;
    const ar = tw / th;

    const processedBuffer = await addWhiteBackgroundAndPadding(trimmed, PADDING);

    return {
      plan: { kind: "SVG" },
      trimmedAr: ar,
      box: getSmartLogoBox(ar),
      processedBuffer,
      skipEnhancement: true,
    };
  }

  // ── Imagen raster ─────────────────────────────────────────────────────────
  const img = sharp(fileBuffer, { failOn: "none" });
  const meta = await img.metadata();
  const hasAlpha = Boolean(meta.hasAlpha);

  // ── Badge/Emblem detection (before alpha / solid-bg logic) ───────────────
  const badge = await isBadgeLogo(fileBuffer, hasAlpha);
  if (badge) {
    // Badge: solo trim (si tiene alpha) + resize. Sin fondo blanco ni padding.
    let badgeBuffer: Buffer;
    if (hasAlpha) {
      badgeBuffer = await sharp(fileBuffer, { failOn: "none" })
        .trim({ threshold: 10 })
        .resize(512, 512, { fit: "inside", withoutEnlargement: false })
        .png()
        .toBuffer();
    } else {
      badgeBuffer = await sharp(fileBuffer, { failOn: "none" })
        .resize(512, 512, { fit: "inside", withoutEnlargement: false })
        .png()
        .toBuffer();
    }

    const resizedMeta = await sharp(badgeBuffer).metadata();
    const tw = resizedMeta.width  ?? meta.width  ?? 1;
    const th = resizedMeta.height ?? meta.height ?? 1;
    const ar = tw / th;

    return {
      plan: { kind: "BADGE" },
      trimmedAr: ar,
      box: getSmartLogoBox(ar),
      processedBuffer: badgeBuffer,
      skipEnhancement: true,
    };
  }

  // ── Normal logo paths ─────────────────────────────────────────────────────
  let plan: SmartPlan;
  let logoBuffer: Buffer; // logo sin fondo, trimmed

  if (hasAlpha) {
    plan = { kind: "HAS_ALPHA" };
    logoBuffer = await sharp(fileBuffer, { failOn: "none" })
      .trim({ threshold: 20 })
      .png()
      .toBuffer();

  } else {
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
      const avg = averageRGBA(corners);
      plan = {
        kind:  "SOLID_BG",
        bgHex: rgbToHex(avg.r, avg.g, avg.b),
        bgR:   avg.r,
        bgG:   avg.g,
        bgB:   avg.b,
      };

      const withoutBg = await removeSolidBackground(fileBuffer, avg.r, avg.g, avg.b, 40);
      logoBuffer = await sharp(withoutBg, { failOn: "none" })
        .trim({ threshold: 10 })
        .png()
        .toBuffer();

    } else {
      plan = { kind: "COMPLEX_BG" };
      logoBuffer = await sharp(fileBuffer, { failOn: "none" })
        .trim({ threshold: 20 })
        .png()
        .toBuffer();
    }
  }

  // Calcular AR del logo real (sin padding)
  const logoMeta = await sharp(logoBuffer).metadata();
  const tw = logoMeta.width  ?? meta.width  ?? 1;
  const th = logoMeta.height ?? meta.height ?? 1;
  const trimmedAr = tw / th;

  // Agregar fondo blanco + 20px padding
  const processedBuffer = await addWhiteBackgroundAndPadding(logoBuffer, PADDING);

  return {
    plan,
    trimmedAr,
    box: getSmartLogoBox(trimmedAr),
    processedBuffer,
    skipEnhancement: false,
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