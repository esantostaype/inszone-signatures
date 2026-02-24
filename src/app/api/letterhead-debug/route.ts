// src/app/api/letterhead-debug/route.ts
// TEMPORAL — eliminar después de diagnosticar
import { NextResponse } from "next/server";
import JSZip from "jszip";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const templatePath = path.join(process.cwd(), "public", "templates", "letterhead-template.docx");
    const templateBuffer = fs.readFileSync(templatePath);
    const zip = await JSZip.loadAsync(templateBuffer);

    const header1 = await zip.file("word/header1.xml")!.async("string");
    const footer1 = await zip.file("word/footer1.xml")!.async("string");
    const header1rels = await zip.file("word/_rels/header1.xml.rels")!.async("string");
    const footer1rels = await zip.file("word/_rels/footer1.xml.rels")!.async("string");

    return NextResponse.json({
      header1,
      footer1,
      header1rels,
      footer1rels,
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}