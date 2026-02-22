// src/app/api/outlook-signature/generate/route.ts
import { NextResponse } from "next/server";
import { buildOutlookSignatureHtml, SignatureType } from "@/lib/outlookSignature";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json();

  const html = buildOutlookSignatureHtml({
    fullName:          body.fullName,
    title:             body.title,
    contactLines:      body.contactLines,
    email:             body.email,
    address:           body.address,
    lic:               body.lic              || undefined,
    partnerLogoUrl:    body.partnerLogoUrl   || undefined,
    partnerLogoWidth:  body.partnerLogoWidth  || undefined,
    partnerLogoHeight: body.partnerLogoHeight || undefined,
    signatureType:     (body.signatureType as SignatureType) || "powered-by",
  });

  return NextResponse.json({ html });
}