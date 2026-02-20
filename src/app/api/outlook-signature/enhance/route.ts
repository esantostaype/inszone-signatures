/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/outlook-signature/enhance/route.ts
import { NextResponse } from "next/server";
import { cloudinary } from "@/lib/cloudinary";
import sharp from "sharp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_AI_PX = 640;

function getSmartLogoBox(ar: number): { w: number; h: number } {
  let w: number;
  if (ar < 0.85)       w = 40;
  else if (ar <= 1.18) w = 64;
  else if (ar <= 1.7)  w = 88;
  else if (ar <= 2.4)  w = 96;
  else if (ar <= 3.4)  w = 106;
  else if (ar <= 4.4)  w = 114;
  else if (ar <= 5.4)  w = 122;
  else if (ar <= 6.4)  w = 130;
  else if (ar <= 7.4)  w = 138;
  else if (ar <= 8.4)  w = 146;
  else if (ar <= 9.4)  w = 154;
  else                 w = 160;
  const h = Math.round(w / ar);
  return { w, h };
}

async function preprocessForAI(buffer: Buffer): Promise<Buffer> {
  const trimmed = await sharp(buffer, { failOn: "none" })
    .trim({ threshold: 30 })
    .toBuffer();

  const meta = await sharp(trimmed).metadata();
  const w = meta.width  ?? 0;
  const h = meta.height ?? 0;

  if (w <= MAX_AI_PX && h <= MAX_AI_PX) {
    return sharp(trimmed).png().toBuffer();
  }

  return sharp(trimmed)
    .resize(MAX_AI_PX, MAX_AI_PX, { fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
}

/**
 * Fuerza transparencia si OpenAI dejó fondo blanco/gris.
 * Solo actúa si las esquinas son claras y opacas.
 */
async function forceTransparency(buffer: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(buffer, { failOn: "none" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8ClampedArray(data);
  const w = info.width;
  const h = info.height;

  const corners = [
    getPixelAt(pixels, w, 0,     0    ),
    getPixelAt(pixels, w, w - 1, 0    ),
    getPixelAt(pixels, w, 0,     h - 1),
    getPixelAt(pixels, w, w - 1, h - 1),
  ];
  const avgBg = average(corners);
  const isSolidBg = avgBg.a > 200 && avgBg.r > 160 && avgBg.g > 160 && avgBg.b > 160;

  if (isSolidBg) {
    const total = w * h;
    for (let i = 0; i < total; i++) {
      const idx = i * 4;
      const dist = Math.sqrt(
        (pixels[idx]     - avgBg.r) ** 2 +
        (pixels[idx + 1] - avgBg.g) ** 2 +
        (pixels[idx + 2] - avgBg.b) ** 2
      );
      if (dist <= 45) pixels[idx + 3] = 0;
    }
  }

  return sharp(Buffer.from(pixels.buffer), {
    raw: { width: w, height: h, channels: 4 },
  }).png().toBuffer();
}

function getPixelAt(px: Uint8ClampedArray, width: number, x: number, y: number) {
  const idx = (y * width + x) * 4;
  return { r: px[idx], g: px[idx + 1], b: px[idx + 2], a: px[idx + 3] };
}

function average(px: Array<{ r: number; g: number; b: number; a: number }>) {
  const s = px.reduce(
    (a, p) => ({ r: a.r + p.r, g: a.g + p.g, b: a.b + p.b, a: a.a + p.a }),
    { r: 0, g: 0, b: 0, a: 0 }
  );
  const n = px.length;
  return {
    r: Math.round(s.r / n), g: Math.round(s.g / n),
    b: Math.round(s.b / n), a: Math.round(s.a / n),
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const { imageUrl } = await req.json();

    if (!imageUrl || typeof imageUrl !== "string") {
      return NextResponse.json({ error: "Missing imageUrl" }, { status: 400 });
    }

    // 1) Descargar imagen original
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      return NextResponse.json({ error: "Failed to download image" }, { status: 500 });
    }
    const rawBuf = Buffer.from(await imgRes.arrayBuffer());

    // 2) Pre-procesar: trim agresivo + escalar a máx 640px
    const aiBuf = await preprocessForAI(rawBuf);

    // 3) OpenAI: mejorar logo + fondo transparente + borde blanco de forma
    const prompt = `
You are a technical image processor. You are NOT allowed to redesign, recreate, enhance, reinterpret, or restyle the logo.

Your task is strictly pixel-level processing.

────────────────────────
CRITICAL RULES
────────────────────────

• DO NOT redraw anything.
• DO NOT recreate text.
• DO NOT regenerate shapes.
• DO NOT change any internal color.
• DO NOT modify any non-background pixel.
• White areas inside the logo are NEVER background.
• Transparent text must NEVER be created.
• If a letter is white in the original, it must remain solid white.

You must preserve 100% of the original logo exactly as-is.

────────────────────────
STEP 1 — BACKGROUND REMOVAL
────────────────────────

Remove ONLY the outer background (areas connected to the image edges).

Important:
• Background means only the outer empty area.
• Do NOT remove white pixels inside the logo.
• Do NOT remove light gray or white shapes inside the logo.
• Do NOT convert text to transparent.

Result must have:
• Fully transparent outer background
• Original logo completely intact

────────────────────────
STEP 2 — ADD 4PX WHITE OUTLINE
────────────────────────

Add a 4 pixel white stroke OUTSIDE the exact silhouette of the logo.

Rules for the stroke:

• Stroke must follow the true contour of the logo.
• Stroke must wrap tightly around:
  - Diamonds
  - Arrows
  - Rectangles
  - Text boxes
• Stroke must NOT be rectangular.
• Stroke must NOT cut into the logo.
• Stroke must be entirely outside the existing shape.
• Stroke color: pure white (#FFFFFF).
• Thickness: exactly 4 pixels.

The interior of the logo must remain pixel-identical.

────────────────────────
STEP 3 — QUALITY
────────────────────────

• Keep sharp edges.
• Do NOT add glow.
• Do NOT add shadow.
• Do NOT soften edges.
• Do NOT change color saturation.

────────────────────────
OUTPUT
────────────────────────

• Transparent PNG
• Tight crop
• No extra padding
• No redesign
`.trim();

    const form = new FormData();
    form.append("model", "gpt-image-1");
    form.append("prompt", prompt);
    form.append("image", new Blob([new Uint8Array(aiBuf)], { type: "image/png" }), "logo.png");
    form.append("size", "1024x1024");

    const aiRes = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY!}` },
      body: form,
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("OpenAI error:", errText);
      return NextResponse.json({ error: `OpenAI: ${errText}` }, { status: 500 });
    }

    const aiJson: any = await aiRes.json();
    const b64 = aiJson?.data?.[0]?.b64_json;
    if (!b64) {
      return NextResponse.json({ error: "No image returned by OpenAI" }, { status: 500 });
    }

    const enhancedBuf = Buffer.from(b64, "base64");

    // 4) Fallback: forzar transparencia si OpenAI dejó fondo sólido
    const transparent = await forceTransparency(enhancedBuf);

    // 5) Trim final
    const finalBuf = await sharp(transparent, { failOn: "none" })
      .trim({ threshold: 10 })
      .png()
      .toBuffer();

    // 6) Calcular AR y box inteligente
    const finalMeta = await sharp(finalBuf).metadata();
    const fw  = finalMeta.width  ?? 1;
    const fh  = finalMeta.height ?? 1;
    const ar  = fw / fh;
    const box = getSmartLogoBox(ar);

    // 7) Subir a Cloudinary
    const uploadResult = await new Promise<any>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder:        "outlook-signatures/enhanced",
          resource_type: "image",
          format:        "png",
          transformation: [{ quality: 100 }, { fetch_format: "png" }],
        },
        (err, result) => (err ? reject(err) : resolve(result))
      ).end(finalBuf);
    });

    const cloudName  = process.env.CLOUDINARY_CLOUD_NAME!;
    const displayUrl = `https://res.cloudinary.com/${cloudName}/image/upload/f_png,q_100/${uploadResult.public_id}`;

    return NextResponse.json({
      public_id:   uploadResult.public_id,
      secure_url:  uploadResult.secure_url,
      display_url: displayUrl,
      width:       box.w,
      height:      box.h,
      trimmed_ar:  ar,
      bytes:       uploadResult.bytes,
      format:      "png",
    });

  } catch (e: any) {
    console.error("Enhance error:", e);
    return NextResponse.json({ error: e?.message || "Enhance failed" }, { status: 500 });
  }
}