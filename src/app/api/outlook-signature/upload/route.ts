/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/upload-logo/route.ts
import { NextResponse } from "next/server";
import { cloudinary } from "@/lib/cloudinary";
import { analyzeLogoBuffer, buildSmartDisplayUrl } from "@/lib/logoSmart";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // 1) Procesar localmente: fondo blanco + trim + padding
    const { processedBuffer, trimmedAr, box } = await analyzeLogoBuffer(buffer);

    // 2) Subir el buffer procesado a Cloudinary
    const uploadResult = await new Promise<any>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder:        "logos",
          resource_type: "image",
          format:        "png",
        },
        (err, result) => (err ? reject(err) : resolve(result))
      ).end(processedBuffer);
    });

    // 3) URL con resize inteligente
    const displayUrl = buildSmartDisplayUrl({
      cloudName: process.env.CLOUDINARY_CLOUD_NAME!,
      publicId:  uploadResult.public_id,
      box,
    });

    return NextResponse.json({
      public_id:   uploadResult.public_id,
      secure_url:  uploadResult.secure_url,
      display_url: displayUrl,
      width:       box.w,
      height:      box.h,
      trimmed_ar:  trimmedAr,
      bytes:       uploadResult.bytes,
      format:      "png",
    });

  } catch (e: any) {
    console.error("UPLOAD ERROR:", e);
    return NextResponse.json(
      { error: e?.message ?? "Upload failed" },
      { status: 500 }
    );
  }
}