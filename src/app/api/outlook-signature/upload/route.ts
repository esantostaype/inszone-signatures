/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { detectSmartPlan, buildSmartDisplayUrl } from "@/lib/logoSmart";

export const runtime = "nodejs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "No file in form-data (field: file)" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // 1) detectar plan
    const plan = await detectSmartPlan(buffer);

    // 2) subir original
    const uploadResult = await new Promise<any>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ folder: "logos", resource_type: "image" }, (err, result) =>
          err ? reject(err) : resolve(result)
        )
        .end(buffer);
    });

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;

    // 3) URL smart (con trim / transparencia / IA si aplica)
    // Si background_removal no está habilitado, podrías preferir usar el safePlan aquí.
    const safePlan = plan.kind === "COMPLEX_BG" ? ({ kind: "HAS_ALPHA" } as const) : plan;

    const displayUrl = buildSmartDisplayUrl({
      cloudName,
      publicId: uploadResult.public_id,
      srcW: uploadResult.width,
      srcH: uploadResult.height,
      plan: safePlan,     // <- evita romper si no tienes IA habilitada
      canvas: "fit",
    });

    return NextResponse.json({
      public_id: uploadResult.public_id,
      secure_url: displayUrl,
      width: uploadResult.width,
      height: uploadResult.height,
      bytes: uploadResult.bytes,
      format: uploadResult.format,
      plan,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Upload failed" }, { status: 500 });
  }
}