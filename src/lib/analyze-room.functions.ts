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

export type QuickItem = {
  name: string;
  box: { x: number; y: number; w: number; h: number };
};

export type AnalyzeResult = {
  items: DetectedItem[];
};

export type QuickResult = {
  items: QuickItem[];
};

const FULL_SYSTEM = `You are a fast visual room-analyzer. Identify DISTINCT physical objects visible in the photo that are LARGER than an apple (roughly >10cm across). Ignore tiny items, wall paint, floor, ceiling, and merged clutter.

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

const QUICK_SYSTEM = `You are a REAL-TIME object spotter. Look at the photo and quickly name up to 10 distinct objects LARGER than an apple. Focus on objects near the CENTER of the frame first. Use the shortest possible common name (1-2 words: "TV", "Bed", "Lamp", "Chair", "Plant").

Respond with ONLY compact JSON:
{"items":[{"name":"TV","box":{"x":0.2,"y":0.3,"w":0.4,"h":0.3}}]}

box is normalized image coords (top-left origin). Be tight around the object. Max 10 items. NO markdown, NO extra text. Be fast.`;

const ENRICH_SYSTEM = `You are giving quick shopping info for a single household item. Respond ONLY with compact JSON:
{"category":"furniture|electronics|appliance|decor|plant|book|kitchenware|clothing|toy|instrument|other","description":"1-2 sentence plain description","priceMin":<usd number>,"priceMax":<usd number>,"currency":"USD","searchUrl":"https://www.google.com/search?q=<url-encoded>","infoUrl":"https://en.wikipedia.org/wiki/<topic> or relevant homepage"}`;

async function callGateway(body: unknown): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429) throw new Error("Rate limit exceeded. Try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Please add credits in workspace settings.");
    throw new Error(`AI request failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content ?? "{}";
}

function safeParse<T>(content: string, fallback: T): T {
  try {
    const stripped = content
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();
    return JSON.parse(stripped) as T;
  } catch {
    return fallback;
  }
}

function toDataUrl(b: string) {
  return b.startsWith("data:") ? b : `data:image/jpeg;base64,${b}`;
}

export const analyzeRoom = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<AnalyzeResult> => {
    const content = await callGateway({
      model: "google/gemini-3-flash-preview",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: FULL_SYSTEM },
        {
          role: "user",
          content: [
            { type: "text", text: "Analyze this room photo. Return JSON only." },
            { type: "image_url", image_url: { url: toDataUrl(data.imageBase64) } },
          ],
        },
      ],
    });

    const parsed = safeParse<AnalyzeResult>(content, { items: [] });
    const items = (parsed.items ?? [])
      .filter((it) => it && it.box && typeof it.box.x === "number")
      .map((it) => normalizeFull(it));
    return { items };
  });

export const quickScan = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<QuickResult> => {
    const content = await callGateway({
      model: "google/gemini-3-flash-preview",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: QUICK_SYSTEM },
        {
          role: "user",
          content: [
            { type: "text", text: "Spot objects. JSON only." },
            { type: "image_url", image_url: { url: toDataUrl(data.imageBase64) } },
          ],
        },
      ],
    });

    const parsed = safeParse<QuickResult>(content, { items: [] });
    const items = (parsed.items ?? [])
      .filter((it) => it && it.box && typeof it.box.x === "number")
      .slice(0, 10)
      .map((it) => ({
        name: String(it.name ?? "Object").trim(),
        box: {
          x: clamp01(it.box.x),
          y: clamp01(it.box.y),
          w: clamp01(it.box.w),
          h: clamp01(it.box.h),
        },
      }));
    return { items };
  });

const EnrichInput = z.object({
  name: z.string().min(1),
  imageBase64: z.string().min(100),
});

export const enrichItem = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => EnrichInput.parse(data))
  .handler(async ({ data }): Promise<Omit<DetectedItem, "box" | "name">> => {
    const content = await callGateway({
      model: "google/gemini-3-flash-preview",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: ENRICH_SYSTEM },
        {
          role: "user",
          content: [
            { type: "text", text: `Give details for: ${data.name}. It's the object in this photo. JSON only.` },
            { type: "image_url", image_url: { url: toDataUrl(data.imageBase64) } },
          ],
        },
      ],
    });

    const parsed = safeParse<Partial<DetectedItem>>(content, {});
    return {
      category: String(parsed.category ?? "other"),
      description: String(parsed.description ?? ""),
      priceMin: Number(parsed.priceMin ?? 0),
      priceMax: Number(parsed.priceMax ?? 0),
      currency: String(parsed.currency ?? "USD"),
      searchUrl:
        parsed.searchUrl ||
        `https://www.google.com/search?q=${encodeURIComponent(data.name)}`,
      infoUrl:
        parsed.infoUrl ||
        `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(data.name)}`,
    };
  });

function normalizeFull(it: DetectedItem): DetectedItem {
  return {
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
  };
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
