import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { signatures } from "@/lib/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// ── DELETE /api/signatures/[id] ───────────────────────────────
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { success: false, message: "ID is required" },
        { status: 400 }
      );
    }

    await db.delete(signatures).where(eq(signatures.id, id));

    return NextResponse.json({ success: true, message: "Signature deleted" });
  } catch (error) {
    console.error("DELETE /api/signatures/[id] error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to delete signature" },
      { status: 500 }
    );
  }
}

// ── GET /api/signatures/[id] ──────────────────────────────────
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const result = await db.select().from(signatures).where(eq(signatures.id, id)).limit(1);

    if (!result[0]) {
      return NextResponse.json(
        { success: false, message: "Signature not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: result[0] });
  } catch (error) {
    console.error("GET /api/signatures/[id] error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch signature" },
      { status: 500 }
    );
  }
}