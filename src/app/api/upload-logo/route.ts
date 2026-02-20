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

    // 1) Analizar + procesar localmente (remover fondo, trim, calcular AR)
    const { plan, trimmedAr, box, processedBuffer } = await analyzeLogoBuffer(buffer);

    // 2) Subir el buffer YA PROCESADO a Cloudinary (PNG con transparencia)
    const uploadResult = await new Promise<any>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: "logos",
          resource_type: "image",
          format: "png", // forzar PNG para preservar alpha
        },
        (err, result) => (err ? reject(err) : resolve(result))
      ).end(processedBuffer);
    });

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;

    // 3) URL con resize inteligente (sin transformaciones de fondo — ya está limpio)
    const displayUrl = buildSmartDisplayUrl({
      cloudName,
      publicId: uploadResult.public_id,
      box,
    });

    return NextResponse.json({
      public_id:   uploadResult.public_id,
      secure_url:  uploadResult.secure_url,  // original procesado sin resize
      display_url: displayUrl,               // ← usar esta en la firma y preview
      width:       box.w,                    // ← ancho visual correcto para el HTML
      height:      box.h,                    // ← alto visual correcto para el HTML
      trimmed_ar:  trimmedAr,
      bytes:       uploadResult.bytes,
      format:      "png",
      plan,
    });

  } catch (e: any) {
    console.error("UPLOAD ERROR:", e);
    return NextResponse.json(
      { error: e?.message ?? "Upload failed" },
      { status: 500 }
    );
  }
}