/* eslint-disable @typescript-eslint/no-unused-vars */
// src/lib/logoSmart.ts
import sharp from "sharp";

export type LogoBox = { w: number; h: number };

export type SmartLogoResult = {
  processedBuffer: Buffer;
  trimmedAr: number;
  box: LogoBox;
};

const PADDING = 10;

/**
 * Tamaño visual según AR real del logo (post-trim, sin contar el padding)
 */
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

  return { w, h: Math.round(w / ar) };
}

/**
 * Pipeline único para cualquier tipo de logo (SVG, PNG, JPG, WebP, etc.):
 * 1. Rasteriza a PNG (sharp maneja SVG nativamente)
 * 2. Aplana transparencia sobre fondo blanco
 * 3. Trim para eliminar bordes vacíos/blancos del logo original
 * 4. Agrega 10px de padding blanco en todos los lados
 */
export async function analyzeLogoBuffer(
  fileBuffer: Buffer,
  mimeType?: string
): Promise<SmartLogoResult> {
  // 1. Rasterizar + aplanar transparencia sobre blanco
  const rasterized = await sharp(fileBuffer, { failOn: "none" })
    .resize(512, 512, { fit: "inside", withoutEnlargement: false })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .png()
    .toBuffer();

  // 2. Trim: elimina bordes blancos/homogéneos del logo original
  const trimmed = await sharp(rasterized, { failOn: "none" })
    .trim({ background: "#ffffff", threshold: 10 })
    .png()
    .toBuffer();

  // 3. Medir el contenido recortado para calcular el aspect ratio
  const meta = await sharp(trimmed).metadata();
  const tw = meta.width  ?? 1;
  const th = meta.height ?? 1;
  const trimmedAr = tw / th;

  // 4. Agregar fondo blanco sólido + 10px de padding en todos los lados
  const processedBuffer = await sharp({
    create: {
      width:      tw + PADDING * 2,
      height:     th + PADDING * 2,
      channels:   3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([{ input: trimmed, top: PADDING, left: PADDING }])
    .png()
    .toBuffer();

  return {
    processedBuffer,
    trimmedAr,
    box: getSmartLogoBox(trimmedAr),
  };
}

/**
 * URL de Cloudinary — el procesamiento ya se hizo localmente.
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