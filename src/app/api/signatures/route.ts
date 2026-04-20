import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { signatures } from "@/lib/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

// ── GET /api/signatures ───────────────────────────────────────
export async function GET() {
  try {
    const data = await db.select().from(signatures).orderBy(desc(signatures.createdAt));
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET /api/signatures error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch signatures" },
      { status: 500 }
    );
  }
}

// ── POST /api/signatures ──────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      name, fullName, title,
      type,
      phone, fax, direct, sms,
      email, address, lic, website,
      partnerLogoUrl, partnerLogoWidth, partnerLogoHeight,
      certRequest, reviewLink,
    } = body;

    const validTypes = ["basic", "powered-by", "formerly"];
    const signatureType = validTypes.includes(type) ? type : "powered-by";

    // Address is optional for all types; basic falls back to HQ address
    const resolvedAddress = address?.trim() || null;

    if (!name || !fullName || !title || !phone || !email) {
      return NextResponse.json(
        { success: false, message: "Missing required fields" },
        { status: 400 }
      );
    }

    const newSignature = {
      id:                crypto.randomUUID(),
      name:              name.trim(),
      fullName:          fullName.trim(),
      title:             title.trim(),
      type:              signatureType,
      phone:             phone.trim(),
      fax:               fax?.trim()     || null,
      direct:            direct?.trim()  || null,
      sms:               sms?.trim()     || null,
      email:             email.trim(),
      address:           resolvedAddress,
      lic:               lic?.trim()     || null,
      website:           website?.trim() || null,
      partnerLogoUrl:    partnerLogoUrl    || null,
      partnerLogoWidth:  partnerLogoWidth  ? Number(partnerLogoWidth)  : null,
      partnerLogoHeight: partnerLogoHeight ? Number(partnerLogoHeight) : null,
      certRequest:       certRequest === true || certRequest === 1 ? true : false,
      reviewLink:        reviewLink?.trim() || null,
    };

    await db.insert(signatures).values(newSignature);

    return NextResponse.json({ success: true, data: newSignature }, { status: 201 });
  } catch (error) {
    console.error("POST /api/signatures error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to save signature" },
      { status: 500 }
    );
  }
}