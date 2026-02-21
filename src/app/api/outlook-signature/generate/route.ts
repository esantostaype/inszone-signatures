import { NextResponse } from "next/server";
import { buildOutlookSignatureHtml } from "@/lib/outlookSignature";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json();

  const html = buildOutlookSignatureHtml({
    fullName:       body.fullName,
    title:          body.title,
    contactLines:   body.contactLines,
    email:          body.email,
    address:        body.address,
    lic:            body.lic            || undefined,
    userLogoUrl:    body.userLogoUrl    || undefined,
    userLogoWidth:  body.userLogoWidth  || undefined,
    userLogoHeight: body.userLogoHeight || undefined,
  });

  return NextResponse.json({ html });
}