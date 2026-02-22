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

    const buffer   = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "";

    // 1) Subir el archivo CRUDO original a Cloudinary (sin ningún procesamiento)
    const rawUploadResult = await new Promise<any>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder:        "logos/originals",
          resource_type: "image",
        },
        (err, result) => (err ? reject(err) : resolve(result))
      ).end(buffer);
    });

    // 2) Analizar + procesar localmente
    //    - SVG: rasteriza directamente, skipEnhancement = true
    //    - Otros: remueve fondo, trim, agrega fondo blanco + 20px padding
    const { plan, trimmedAr, box, processedBuffer, skipEnhancement } =
      await analyzeLogoBuffer(buffer, mimeType);

    // 3) Subir el buffer procesado a Cloudinary (PNG con fondo blanco)
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

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;

    // 4) URL con resize inteligente
    const displayUrl = buildSmartDisplayUrl({
      cloudName,
      publicId: uploadResult.public_id,
      box,
    });

    return NextResponse.json({
      public_id:        uploadResult.public_id,
      secure_url:       uploadResult.secure_url,
      display_url:      displayUrl,
      width:            box.w,
      height:           box.h,
      trimmed_ar:       trimmedAr,
      bytes:            uploadResult.bytes,
      format:           "png",
      plan,
      skipEnhancement,
      // URL del archivo crudo original — se usa para enviar a GPT en el enhance
      raw_url:          rawUploadResult.secure_url,
    });

  } catch (e: any) {
    console.error("UPLOAD ERROR:", e);
    return NextResponse.json(
      { error: e?.message ?? "Upload failed" },
      { status: 500 }
    );
  }
}