/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/upload-logo/route.ts
//
// CAMBIO: Ya NO sube a Cloudinary durante el preview.
// Solo procesa con Sharp y devuelve un base64 del buffer resultante.
// El upload real a Cloudinary ocurre en /api/upload-logo/commit
// cuando el usuario guarda o copia la firma.

import { NextResponse } from "next/server";
import { analyzeLogoBuffer, getSmartLogoBox } from "@/lib/logoSmart";

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

    // Procesar localmente con Sharp (remover fondo, trim, padding, etc.)
    const { plan, trimmedAr, box, processedBuffer, skipEnhancement } =
      await analyzeLogoBuffer(buffer, mimeType);

    // Devolver el buffer procesado como base64 — sin tocar Cloudinary
    const processedBase64 = processedBuffer.toString("base64");

    return NextResponse.json({
      processed_base64: processedBase64,   // ← el cliente crea un blob URL
      width:            box.w,
      height:           box.h,
      trimmed_ar:       trimmedAr,
      format:           "png",
      plan,
      skipEnhancement,
      // Campos vacíos para compatibilidad con UploadResult hasta que se haga commit
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