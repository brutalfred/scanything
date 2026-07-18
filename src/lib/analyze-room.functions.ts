import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  imageBase64: z.string().min(100),
});

export type DetectedItem = {
  name: string;
  category: string;
  description: string;
  priceMin: number;
  priceMax: number;
  currency: string;
  searchUrl: string;
  infoUrl: string;
  box: { x: number; y: number; w: number; h: number }; // 0..1 normalized (top-left)
};

export type AnalyzeResult = {
  items: DetectedItem[];
};

const SYSTEM = `You are a fast visual room-analyzer. Identify DISTINCT physical objects visible in the photo that are LARGER than an apple (roughly >10cm across). Ignore tiny items, wall paint, floor, ceiling, and merged clutter.

For each object, respond with a compact JSON object matching:
{
  "items": [
    {
      "name": "short common name",
      "category": "furniture|electronics|appliance|decor|plant|book|kitchenware|clothing|toy|instrument|other",
      "description": "1-2 sentence plain description of what it likely is (brand/style guess if obvious)",
      "priceMin": number in USD (typical low retail),
      "priceMax": number in USD (typical high retail),
      "currency": "USD",
      "searchUrl": "https://www.google.com/search?q=<url-encoded query to buy the item>",
      "infoUrl": "https://en.wikipedia.org/wiki/<topic>  OR a relevant homepage/wikipedia URL",
      "box": { "x": 0..1, "y": 0..1, "w": 0..1, "h": 0..1 }
    }
  ]
}

box is the object's bounding box in NORMALIZED image coordinates where (0,0) is the TOP-LEFT of the image and (1,1) is the bottom-right. x,y is the top-left corner of the box. Be accurate with boxes.

Keep it under 12 items. Prefer confident guesses. Output ONLY JSON, no markdown.`;

export const analyzeRoom = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<AnalyzeResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const dataUrl = data.imageBase64.startsWith("data:")
      ? data.imageBase64
      : `data:image/jpeg;base64,${data.imageBase64}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze this room photo. Return JSON only." },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) throw new Error("Rate limit exceeded. Try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted. Please add credits in workspace settings.");
      throw new Error(`AI request failed (${res.status}): ${text.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content ?? "{}";

    let parsed: AnalyzeResult;
    try {
      const stripped = content
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/, "")
        .trim();
      parsed = JSON.parse(stripped) as AnalyzeResult;
    } catch {
      parsed = { items: [] };
    }

    const items = (parsed.items ?? [])
      .filter((it) => it && it.box && typeof it.box.x === "number")
      .map((it) => ({
        name: String(it.name ?? "Unknown"),
        category: String(it.category ?? "other"),
        description: String(it.description ?? ""),
        priceMin: Number(it.priceMin ?? 0),
        priceMax: Number(it.priceMax ?? 0),
        currency: String(it.currency ?? "USD"),
        searchUrl:
          it.searchUrl ||
          `https://www.google.com/search?q=${encodeURIComponent(String(it.name ?? ""))}`,
        infoUrl:
          it.infoUrl ||
          `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(String(it.name ?? ""))}`,
        box: {
          x: clamp01(it.box.x),
          y: clamp01(it.box.y),
          w: clamp01(it.box.w),
          h: clamp01(it.box.h),
        },
      }));

    return { items };
  });

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
