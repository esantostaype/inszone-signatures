/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/outlook-signature/enhance/route.ts
import { NextResponse } from "next/server";
import { cloudinary } from "@/lib/cloudinary";
import sharp from "sharp";
import { getSmartLogoBox, addWhiteBackgroundAndPadding } from "@/lib/logoSmart";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_AI_PX = 640;
const PADDING   = 20;

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

    // 2) Pre-procesar para AI: trim + escalar a máx 640px
    const aiBuf = await preprocessForAI(rawBuf);

    // 3) OpenAI: mejorar calidad del logo manteniendo diseño exacto
    const prompt = `
You are a professional graphic designer. Your ONLY task is to recreate this logo with higher quality.

STRICT RULES:
1. Keep EXACTLY the same design, colors, text, fonts, layout, and proportions as the original
2. Make the image sharper and cleaner — crisp edges, no blur, no pixelation
3. The output background must be solid WHITE (#FFFFFF)
4. Do NOT add any padding or border — just the logo with white background
5. Do NOT change any colors, add effects, shadows, or modify the design in any way
6. Output a clean, high-resolution PNG

The result must look exactly like the original logo, just at higher quality.
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

    // 4) Trim del resultado de AI
    const trimmed = await sharp(enhancedBuf, { failOn: "none" })
      .trim({ threshold: 15 })
      .png()
      .toBuffer();

    // 5) Calcular AR del logo antes del padding
    const trimmedMeta = await sharp(trimmed).metadata();
    const tw = trimmedMeta.width  ?? 1;
    const th = trimmedMeta.height ?? 1;
    const ar = tw / th;
    const box = getSmartLogoBox(ar);

    // 6) Agregar fondo blanco + 20px de padding
    const finalBuf = await addWhiteBackgroundAndPadding(trimmed, PADDING);

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