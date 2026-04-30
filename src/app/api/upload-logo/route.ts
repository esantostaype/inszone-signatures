/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/upload-logo/route.ts
//
// Solo procesa con Sharp y devuelve base64.
// El upload real a Cloudinary ocurre en /api/upload-logo/commit
// cuando el usuario guarda o copia la firma.

import { NextResponse } from "next/server";
import { analyzeLogoBuffer } from "@/lib/logoSmart";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Procesar localmente: fondo blanco + trim + padding
    const { processedBuffer, trimmedAr, box } = await analyzeLogoBuffer(buffer);

    return NextResponse.json({
      processed_base64: processedBuffer.toString("base64"),
      width:            box.w,
      height:           box.h,
      trimmed_ar:       trimmedAr,
      format:           "png",
      // Campos vacíos para compatibilidad hasta el commit
      public_id:   null,
      secure_url:  null,
      display_url: null,
      bytes:       processedBuffer.byteLength,
    });

  } catch (e: any) {
    console.error("UPLOAD ERROR:", e);
    return NextResponse.json(
      { error: e?.message ?? "Upload failed" },
      { status: 500 }
    );
  }
}