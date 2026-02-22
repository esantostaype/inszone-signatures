/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/outlook-signature/enhance/route.ts
import { NextResponse } from "next/server";
import { cloudinary } from "@/lib/cloudinary";
import sharp from "sharp";
import { analyzeLogoBuffer, buildSmartDisplayUrl } from "@/lib/logoSmart";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_AI_PX = 640;

/**
 * Pre-procesa el logo para enviarlo a GPT:
 * 1. Trim de espacio excesivo
 * 2. Escala a máx 640px
 * 3. CRÍTICO: Compone sobre fondo GRIS OSCURO (#1a1a2e) antes de enviar.
 *    Esto hace que logos con contenido blanco sobre fondo transparente sean
 *    visibles para GPT — sin esto, GPT recibe un "rectángulo blanco" y no
 *    puede reconocer el diseño del logo.
 */
async function preprocessForAI(buffer: Buffer): Promise<Buffer> {
  // Trim del espacio sobrante
  const trimmed = await sharp(buffer, { failOn: "none" })
    .trim({ threshold: 30 })
    .toBuffer();

  // Escalar si es demasiado grande
  const meta = await sharp(trimmed).metadata();
  const w = meta.width  ?? 0;
  const h = meta.height ?? 0;

  const scaled = (w <= MAX_AI_PX && h <= MAX_AI_PX)
    ? await sharp(trimmed).png().toBuffer()
    : await sharp(trimmed)
        .resize(MAX_AI_PX, MAX_AI_PX, { fit: "inside", withoutEnlargement: true })
        .png()
        .toBuffer();

  // Componer sobre fondo oscuro para que el contenido blanco sea visible a GPT
  const scaledMeta = await sharp(scaled).metadata();
  const sw = scaledMeta.width  ?? w;
  const sh = scaledMeta.height ?? h;

  const withDarkBg = await sharp({
    create: {
      width:      sw,
      height:     sh,
      channels:   3,
      background: { r: 26, g: 26, b: 46 }, // #1a1a2e — oscuro pero no negro puro
    },
  })
    .composite([{ input: scaled, top: 0, left: 0 }])
    .png()
    .toBuffer();

  return withDarkBg;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    // Acepta FormData con el archivo crudo del usuario
    const form    = await req.formData();
    const file    = form.get("file");
    const isBadge = form.get("isBadge") === "true";

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    // 1) Buffer crudo — exactamente lo que subió el usuario
    const rawBuf = Buffer.from(await file.arrayBuffer());

    // 2) Pre-procesar: trim + escala + fondo oscuro para que GPT vea el contenido
    const aiBuf = await preprocessForAI(rawBuf);

    // 3) Prompt según tipo de logo
    const prompt = isBadge
      ? `
You are a professional graphic designer. Your task is to recreate this badge/emblem logo at higher quality as a PNG with TRANSPARENT background.

STRICT RULES:
1. Keep EXACTLY the same design — same colors, shapes, text, fonts, layout, and proportions as the original
2. The output MUST have a fully transparent background (PNG with alpha channel)
3. Only the badge/emblem itself should be visible — no rectangular background behind it
4. Make edges sharp and clean — crisp anti-aliasing, no blur, no pixelation
5. Remove any excess empty space around the badge — tight-cropped
6. Do NOT change any colors, add effects, drop shadows, or modify the design in any way
7. Output a clean, high-resolution PNG with transparency

The result must look exactly like the original badge, just at higher quality, with a transparent background.
`.trim()
      : `
You are a professional graphic designer. Your task is to recreate this company logo at higher quality.

IMPORTANT CONTEXT: The logo image you receive has been placed on a dark background (#1a1a2e) so you can see it clearly. The dark background is NOT part of the logo — it is just a viewing aid.

STRICT RULES:
1. Keep EXACTLY the same design — same shapes, text, fonts, icons, layout, and proportions as the original logo content
2. The output background MUST be solid WHITE (#FFFFFF)
3. Recreate all logo elements faithfully:
   - If the logo content (text, icons, shapes) appears WHITE or LIGHT on the dark background → render them in DARK/BLACK on the white output background
   - If the logo content appears COLORED (red, blue, etc.) → keep those exact colors on the white background
   - If the logo content appears DARK on a light area → keep it dark on the white background
4. Remove ALL excess whitespace — logo content should fill most of the canvas with minimal margin
5. Make the image sharper and cleaner — crisp edges, no blur, no pixelation, no JPEG artifacts
6. Do NOT add drop shadows, gradients, borders, or effects not present in the original logo
7. Output a clean, high-resolution PNG

The result must look like the original logo rendered on a clean white background, at higher quality.
`.trim();

    // 4) OpenAI image edit
    const formData = new FormData();
    formData.append("model", "gpt-image-1");
    formData.append("prompt", prompt);
    formData.append("image", new Blob([new Uint8Array(aiBuf)], { type: "image/png" }), "logo.png");
    formData.append("size", "1024x1024");

    const aiRes = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY!}` },
      body: formData,
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

    // 5) Pasar el resultado por el mismo pipeline que el upload normal
    const { processedBuffer, trimmedAr, box, plan } = await analyzeLogoBuffer(enhancedBuf);

    // 6) Subir a Cloudinary
    const uploadResult = await new Promise<any>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder:        "outlook-signatures/enhanced",
          resource_type: "image",
          format:        "png",
          transformation: [{ quality: 100 }, { fetch_format: "png" }],
        },
        (err, result) => (err ? reject(err) : resolve(result))
      ).end(processedBuffer);
    });

    const cloudName  = process.env.CLOUDINARY_CLOUD_NAME!;
    const displayUrl = buildSmartDisplayUrl({
      cloudName,
      publicId: uploadResult.public_id,
      box,
    });

    console.log("Enhance complete. Plan:", plan, "AR:", trimmedAr, "Box:", box);

    return NextResponse.json({
      public_id:   uploadResult.public_id,
      secure_url:  uploadResult.secure_url,
      display_url: displayUrl,
      width:       box.w,
      height:      box.h,
      trimmed_ar:  trimmedAr,
      bytes:       uploadResult.bytes,
      format:      "png",
      plan,
    });

  } catch (e: any) {
    console.error("Enhance error:", e);
    return NextResponse.json({ error: e?.message || "Enhance failed" }, { status: 500 });
  }
}