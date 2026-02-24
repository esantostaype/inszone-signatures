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
      phone, fax,                // ← antes: contactLines
      email, address, lic, website,
      partnerLogoUrl, partnerLogoWidth, partnerLogoHeight,
    } = body;

    if (!name || !fullName || !title || !phone || !email || !address) {  // ← contactLines → phone
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
      phone:             phone.trim(),       // ← antes: contactLines
      fax:               fax?.trim() || null, // ← nuevo (opcional)
      email:             email.trim(),
      address:           address.trim(),
      lic:               lic?.trim() || null,
      website:           website?.trim() || null,
      partnerLogoUrl:    partnerLogoUrl    || null,
      partnerLogoWidth:  partnerLogoWidth  ? Number(partnerLogoWidth)  : null,
      partnerLogoHeight: partnerLogoHeight ? Number(partnerLogoHeight) : null,
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