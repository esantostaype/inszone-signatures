/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/upload-logo/commit/route.ts
//
// Se llama UNA SOLA VEZ por logo, justo antes de guardar o copiar la firma.
// Recibe el buffer PNG ya procesado (en base64) y lo sube a Cloudinary.
// Devuelve public_id, secure_url y display_url reales.

import { NextResponse } from "next/server";
import { cloudinary } from "@/lib/cloudinary";
import { buildSmartDisplayUrl } from "@/lib/logoSmart";
import type { LogoBox } from "@/lib/logoSmart";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      processed_base64: string;
      width:            number;
      height:           number;
    };

    const { processed_base64, width, height } = body;

    if (!processed_base64) {
      return NextResponse.json({ error: "Missing processed_base64" }, { status: 400 });
    }

    const buffer   = Buffer.from(processed_base64, "base64");
    const box: LogoBox = { w: width, h: height };

    // Subir el PNG ya procesado a Cloudinary
    const uploadResult = await new Promise<any>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder:        "logos",
          resource_type: "image",
          format:        "png",
        },
        (err, result) => (err ? reject(err) : resolve(result))
      ).end(buffer);
    });

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;

    const displayUrl = buildSmartDisplayUrl({
      cloudName,
      publicId: uploadResult.public_id,
      box,
    });

    return NextResponse.json({
      public_id:   uploadResult.public_id,
      secure_url:  uploadResult.secure_url,
      display_url: displayUrl,
      width,
      height,
      bytes:       uploadResult.bytes,
      format:      "png",
    });

  } catch (e: any) {
    console.error("COMMIT ERROR:", e);
    return NextResponse.json(
      { error: e?.message ?? "Commit to Cloudinary failed" },
      { status: 500 }
    );
  }
}