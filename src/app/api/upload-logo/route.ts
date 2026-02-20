/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/upload-logo/route.ts
import { NextResponse } from "next/server";
import { cloudinary } from "@/lib/cloudinary";
import { detectSmartPlan, buildSmartDisplayUrl } from "@/lib/logoSmart";

export const runtime = "nodejs"; // sharp requiere node runtime

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1) Decide plan automáticamente (alpha / fondo sólido / fondo complejo)
    const plan = await detectSmartPlan(buffer);

    // 2) Upload (guardamos original tal cual)
    const uploadResult = await new Promise<any>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: "logos",
          resource_type: "image",
        },
        (err, result) => (err ? reject(err) : resolve(result))
      ).end(buffer);
    });

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;

    // 3) Genera URL para mostrar el ORIGINAL de forma “inteligente”
    //    (puedes usar canvas: "fit" o "pad")
    //    NOTA IMPORTANTE:
    //    - Si plan = COMPLEX_BG y tu cuenta NO soporta background_removal, esta URL puede fallar
    //      si Cloudinary intenta aplicar el efecto y lo rechaza.
    //    - Para hacerlo 100% robusto, abajo te dejo el fallback “safe” (sin IA) también.
    const originalDisplayUrl = buildSmartDisplayUrl({
      cloudName,
      publicId: uploadResult.public_id,
      srcW: uploadResult.width,
      srcH: uploadResult.height,
      plan,
      canvas: "fit",
    });

    // 4) URL “safe” (nunca usa IA) por si quieres que SIEMPRE funcione:
    const safePlan = plan.kind === "COMPLEX_BG" ? { kind: "HAS_ALPHA" as const } : plan;
    const safeDisplayUrl = buildSmartDisplayUrl({
      cloudName,
      publicId: uploadResult.public_id,
      srcW: uploadResult.width,
      srcH: uploadResult.height,
      plan: safePlan,
      canvas: "fit",
    });

    return NextResponse.json({
      public_id: uploadResult.public_id,
      secure_url: uploadResult.secure_url,
      width: uploadResult.width,
      height: uploadResult.height,
      bytes: uploadResult.bytes,
      format: uploadResult.format,
      plan,
      originalDisplayUrl,
      safeDisplayUrl,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Upload failed" },
      { status: 500 }
    );
  }
}