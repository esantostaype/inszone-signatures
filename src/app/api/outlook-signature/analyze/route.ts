/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/outlook-signature/analyze/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type AnalyzeResult = {
  needsWork: boolean;
  reason: string;
};

export async function POST(req: Request) {
  try {
    const { imageUrl } = await req.json();

    if (!imageUrl || typeof imageUrl !== "string") {
      return NextResponse.json({ error: "Missing imageUrl" }, { status: 400 });
    }

    // GPT-4o Vision — mucho más barato que image generation
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:  `Bearer ${process.env.OPENAI_API_KEY!}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 100,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: imageUrl, detail: "high" },
              },
              {
                type: "text",
                text: `Analyze this company logo image for use in an email signature.

Respond ONLY with a JSON object like this (no markdown, no explanation):
{"needsWork": true, "reason": "short reason in Spanish"}
or
{"needsWork": false, "reason": "short reason in Spanish"}

needsWork must be true if ANY of these apply:
- Background is not fully transparent (has white, gray, or any solid color)
- Image is blurry, pixelated, or has compression artifacts
- Edges are jagged or not crisp
- Logo is not well centered or has excessive empty space

needsWork must be false ONLY if:
- Background is already transparent
- Image is sharp and high quality
- Edges are clean and crisp`,
              },
            ],
          },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("OpenAI analyze error:", errText);
      // Si falla el análisis, asumimos que necesita trabajo (más seguro)
      return NextResponse.json<AnalyzeResult>({
        needsWork: true,
        reason: "No se pudo analizar la imagen, se mejorará por precaución",
      });
    }

    const aiJson: any = await aiRes.json();
    const content = aiJson?.choices?.[0]?.message?.content ?? "";

    // Parsear JSON de la respuesta
    const cleaned = content.replace(/```json|```/g, "").trim();
    const result: AnalyzeResult = JSON.parse(cleaned);

    return NextResponse.json<AnalyzeResult>(result);
  } catch (e: any) {
    console.error("Analyze error:", e);
    // En caso de error, asumimos que necesita trabajo
    return NextResponse.json<AnalyzeResult>({
      needsWork: true,
      reason: "Error al analizar, se mejorará por precaución",
    });
  }
}