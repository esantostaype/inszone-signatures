import { NextResponse } from "next/server";
import { buildOutlookSignatureHtml } from "@/lib/outlookSignature";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json();

  const companyLogoUrl = process.env.COMPANY_STATIC_LOGO_URL;
  if (!companyLogoUrl) {
    return NextResponse.json({ error: "Missing COMPANY_STATIC_LOGO_URL" }, { status: 500 });
  }

  const html = buildOutlookSignatureHtml({
    fullName: body.fullName,
    title: body.title,
    phone: body.phone,
    email: body.email,
    address: body.address,
    extra: body.extra,
    companyLogoUrl,
    userLogoUrl: body.userLogoUrl || undefined,
  });

  return NextResponse.json({ html });
}