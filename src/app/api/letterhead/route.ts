// src/app/api/letterhead/route.ts
import { NextRequest, NextResponse } from "next/server";
import { generateLetterhead } from "@/lib/generateLetterhead";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { partnerName, phone, fax, address, website, partnerLogoUrl, partnerLogoWidth, partnerLogoHeight } = body;

    if (!partnerName || !phone || !address) {
      return NextResponse.json(
        { success: false, message: "Missing required fields: partnerName, phone, address" },
        { status: 400 }
      );
    }

    // Returns Uint8Array — compatible with BodyInit (no TypeScript error)
    const docxData = await generateLetterhead({
      partnerName,
      phone,
      fax:               fax          || "",
      address,
      website:           website      || "",
      partnerLogoUrl:    partnerLogoUrl    || "",
      partnerLogoWidth:  Number(partnerLogoWidth)  || 152,
      partnerLogoHeight: Number(partnerLogoHeight) || 44,
    });

    const safeName = String(partnerName)
      .trim()
      .replace(/[^\w\s-]/g, "")
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join("-");

    const filename = `INS-Branding-Letterhead-Acquisition-${safeName}.docx`;

    return new NextResponse(Buffer.from(docxData), {

      status: 200,
      headers: {
        "Content-Type":        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length":      String(docxData.byteLength),
      },
    });
  } catch (error) {
    console.error("POST /api/letterhead error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to generate letterhead" },
      { status: 500 }
    );
  }
}