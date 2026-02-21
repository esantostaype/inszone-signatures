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

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:  `Bearer ${process.env.OPENAI_API_KEY!}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 150,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                // "low" para no amplificar artefactos de compresión al hacer zoom
                image_url: { url: imageUrl, detail: "low" },
              },
              {
                type: "text",
                text: `You are evaluating whether a company logo image needs AI quality enhancement.

Be VERY conservative — only flag genuinely bad quality images.

Return ONLY a JSON object with no markdown:
{"needsWork": false, "reason": "brief reason in Spanish"}

needsWork must be TRUE ONLY if the image has SEVERE quality problems:
- Extremely blurry (like a photo taken out of focus)
- Heavily pixelated (large visible blocks, not just normal digital edges)
- Severe JPEG compression with large color blocks

needsWork must be FALSE for:
- Sharp, clear logos (even if they have a simple design)
- Images with clean edges (digital/vector-like sharpness is fine)
- Normal PNG or high-quality JPEG logos
- Logos that look professionally designed
- Any image where you are not 100% certain it needs enhancement

Default to needsWork: false when in doubt. Most logos do not need enhancement.`,
              },
            ],
          },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("OpenAI analyze error:", errText);
      return NextResponse.json<AnalyzeResult>({
        needsWork: false,
        reason: "No se pudo analizar la imagen, se usará el logo original",
      });
    }

    const aiJson: any = await aiRes.json();
    const content = aiJson?.choices?.[0]?.message?.content ?? "";

    const cleaned = content.replace(/```json|```/g, "").trim();
    const result: AnalyzeResult = JSON.parse(cleaned);

    console.log("Analyze result:", result);
    return NextResponse.json<AnalyzeResult>(result);
  } catch (e: any) {
    console.error("Analyze error:", e);
    return NextResponse.json<AnalyzeResult>({
      needsWork: false,
      reason: "Error al analizar, se usará el logo original",
    });
  }
}