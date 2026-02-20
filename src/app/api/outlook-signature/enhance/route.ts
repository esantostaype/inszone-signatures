/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { cloudinary } from "@/lib/cloudinary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { imageUrl } = await req.json();

    if (!imageUrl || typeof imageUrl !== "string") {
      return NextResponse.json({ error: "Missing imageUrl" }, { status: 400 });
    }

    // 1) Descargar original
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) return NextResponse.json({ error: "Failed to download image" }, { status: 500 });
    const imgBuf = Buffer.from(await imgRes.arrayBuffer());

    // 2) OpenAI Images Edit
    const prompt = `
Improve this company logo for use in an email signature.
Rules:
- Preserve the exact logo design and text. Do NOT change wording, letters, or shapes.
- Remove background to transparent.
- Increase sharpness and clarity; reduce pixelation/compression artifacts.
- Keep colors faithful.
Output: transparent PNG with crisp edges.
If too low-res, enhance gently without inventing details.
`.trim();

    const form = new FormData();
    form.append("model", "gpt-image-1");
    form.append("prompt", prompt);
    form.append("image", new Blob([imgBuf]), "logo.png");
    form.append("size", "1024x1024");

    const aiRes = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY!}` },
      body: form,
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      return NextResponse.json({ error: t }, { status: 500 });
    }

    const aiJson: any = await aiRes.json();
    const b64 = aiJson?.data?.[0]?.b64_json;
    if (!b64) return NextResponse.json({ error: "No image returned by AI" }, { status: 500 });

    const enhancedBuf = Buffer.from(b64, "base64");

    // 3) Guardar en Cloudinary (formato PNG + optimización)
    const uploadResult = await new Promise<any>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "outlook-signatures/enhanced",
          resource_type: "image",
          format: "png",
          transformation: [{ height: 256, crop: "limit" }, { quality: "auto" }, { fetch_format: "png" }],
        },
        (err, result) => {
          if (err) reject(err);
          else resolve(result);
        }
      );
      stream.end(enhancedBuf);
    });

    return NextResponse.json({
      public_id: uploadResult.public_id,
      secure_url: uploadResult.secure_url,
      width: uploadResult.width,
      height: uploadResult.height,
      bytes: uploadResult.bytes,
      format: uploadResult.format,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Enhance failed" }, { status: 500 });
  }
}