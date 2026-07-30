import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

const FULL_SYSTEM = `You are a fast visual room-analyzer. Identify DISTINCT physical objects visible in the photo that are LARGER than an apple (roughly >10cm across).

PRIORITY — focus almost entirely on everyday human-use objects:
furniture, toys, plants, clothes, shoes, bags, books, electronics, appliances, kitchenware, decor, instruments, sports gear, pets/pet items, food items, doors, windows.

TEXT / SIGNS: If you see any writing, logo, sign, sticker, tattoo or label that is NOT in the Latin alphabet (e.g. Chinese, Japanese, Korean, Arabic, Hebrew, Cyrillic, Thai, Devanagari, Greek), include it as an item with category="text" and use the actual visible characters as the "name" (short — max ~40 chars). Draw its box tightly around the writing.

PERSON: Include ONE item with category="person" and name="Person" ONLY IF a human is clearly the MAIN SUBJECT of the photo (portrait or half-portrait, face/upper body large and centered, occupying >=25% of the image). Do NOT include people who are merely on the side, in the background, or partially visible.

NEVER include isolated human body parts (hand, arm, leg, foot, torso, face without a portrait context, head, hair, skin, finger). Skip them entirely.

DO NOT include structural/architectural surfaces (walls, wall paint, floor, ceiling, beams, pillars, concrete, tiles, carpet, molding, radiators, empty corners) UNLESS the photo contains essentially no everyday items — only then may you include at most 1-2 structural elements as a last resort.

For each object, respond with a compact JSON object matching:
{
  "items": [
    {
      "name": "short common name",
      "category": "furniture|electronics|appliance|decor|plant|book|kitchenware|clothing|toy|instrument|door|text|person|other",
      "description": "1-2 sentence plain description of what it likely is (brand/style guess if obvious)",
      "priceMin": number in USD (typical low retail, 0 for text/person),
      "priceMax": number in USD (typical high retail, 0 for text/person),
      "currency": "USD",
      "searchUrl": "https://www.google.com/search?q=<url-encoded query to buy the item>",
      "infoUrl": "https://en.wikipedia.org/wiki/<topic>  OR a relevant homepage/wikipedia URL",
      "box": { "x": 0..1, "y": 0..1, "w": 0..1, "h": 0..1 }
    }
  ]
}

box is the object's bounding box in NORMALIZED image coordinates where (0,0) is the TOP-LEFT of the image and (1,1) is the bottom-right. x,y is the top-left corner of the box. Be accurate with boxes.

Keep it under 12 items. Prefer confident guesses. Output ONLY JSON, no markdown.`;

const QUICK_SYSTEM = `You are a REAL-TIME object spotter. Look at the photo and quickly name up to 10 distinct objects LARGER than an apple. Focus on objects near the CENTER of the frame first.

PRIORITY — spot everyday human-use items: furniture, toys, plants, clothes, shoes, bags, books, electronics, appliances, kitchenware, decor, instruments, sports gear, doors, windows.
ALSO include any visible writing/sign/logo that is NOT in the Latin alphabet (Chinese, Japanese, Korean, Arabic, Hebrew, Cyrillic, Thai, Devanagari, Greek). Use the actual characters as the name (short).
NEVER include human body parts or people (hand, arm, leg, foot, torso, face, head, hair, skin, finger, nose, ear, eye, mouth, person, human, body). Skip them entirely.
IGNORE walls, wall paint, floor, ceiling, beams, pillars, concrete, tiles, carpet, molding — unless there is literally nothing else visible in the frame.

Use the shortest possible common name (1-2 words: "TV", "Bed", "Lamp", "Chair", "Plant", "Door"). For non-Latin text, use the actual characters.

Respond with ONLY compact JSON:
{"items":[{"name":"TV","box":{"x":0.2,"y":0.3,"w":0.4,"h":0.3}}]}

box is normalized image coords (top-left origin). Be tight around the object. Max 10 items. NO markdown, NO extra text. Be fast.`;

const ENRICH_SYSTEM = `You are giving quick shopping info for a single household item. Respond ONLY with compact JSON:
{"category":"furniture|electronics|appliance|decor|plant|book|kitchenware|clothing|toy|instrument|other","description":"1-2 sentence plain description","priceMin":<usd number>,"priceMax":<usd number>,"currency":"USD","searchUrl":"https://www.google.com/search?q=<url-encoded>","infoUrl":"https://en.wikipedia.org/wiki/<topic> or relevant homepage"}`;

const DEEP_SYSTEM = `You are a product identification expert. Given a photo (or crop) of a single item and a rough name, do your best to identify the EXACT product: guess brand, model, materials, generation/year if possible. Give a refined price range in USD based on that specific guess. Respond ONLY with compact JSON:
{"brand":"best-guess brand or empty","product":"best-guess specific product name or empty","confidence":"low|medium|high","description":"2-4 sentences with concrete details (materials, features, distinguishing marks)","priceMin":<usd>,"priceMax":<usd>,"currency":"USD","buyUrl":"https://www.google.com/search?q=<url-encoded specific product query>","infoUrl":"https://www.google.com/search?q=<url-encoded review/spec query>"}`;

const TRANSLATE_SYSTEM = `You translate short pieces of text (signs, logos, labels) into English. Respond ONLY with compact JSON:
{"language":"detected language name in English (e.g. 'Japanese', 'Arabic') or 'Unknown'","languageCode":"ISO 639-1 code if known, else empty","script":"script name (e.g. 'Han', 'Arabic', 'Cyrillic') or empty","translation":"best English translation, or empty if you truly cannot translate","transliteration":"Latin-alphabet phonetic reading if applicable, else empty","note":"short note on ambiguity if any, else empty"}`;

const PERSON_SYSTEM = `You compile a short, neutral, publicly-known summary about a named person for a UI info card. Do NOT invent facts; if you don't know, say so plainly. Use only widely-known public information. Respond ONLY with compact JSON:
{"known":true|false,"summary":"2-4 sentence neutral overview, or a note that this person is not publicly known","bullets":["short fact 1","short fact 2","..."],"occupation":"if known, else empty","nationality":"if known, else empty","wikipediaUrl":"https://en.wikipedia.org/wiki/<topic> if plausible, else empty"}`;

async function callGateway(action: string, body: unknown): Promise<string> {
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
    if (res.status === 402)
      throw new Error("AI credits exhausted. Please add credits in workspace settings.");
    throw new Error(`AI request failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  // Cost telemetry: record what this call actually cost us.
  const model = (body as { model?: string })?.model ?? "unknown";
  const [{ recordAiUsage }, { getRequestUserId }] = await Promise.all([
    import("./ai-usage.server"),
    import("./credits.server"),
  ]);
  await recordAiUsage({ action, model, usage: json.usage, userId: getRequestUserId() });

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
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }): Promise<AnalyzeResult> => {
    const { withCredits } = await import("./credits.server");
    const content = await withCredits("photo_scan", context.userId, () =>
      callGateway("photo_scan", {
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
      }),
    );

    const parsed = safeParse<AnalyzeResult>(content, { items: [] });
    const items = (parsed.items ?? [])
      .filter((it) => it && it.box && typeof it.box.x === "number")
      .map((it) => normalizeFull(it));
    return { items };
  });

export const quickScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }): Promise<QuickResult> => {
    const { withCredits } = await import("./credits.server");
    const content = await withCredits("quick_scan", context.userId, () =>
      callGateway("quick_scan", {
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
      }),
    );

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
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => EnrichInput.parse(data))
  .handler(async ({ data, context }): Promise<Omit<DetectedItem, "box" | "name">> => {
    const { withCredits } = await import("./credits.server");
    const content = await withCredits("enrich", context.userId, () =>
      callGateway("enrich", {
        model: "google/gemini-3-flash-preview",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: ENRICH_SYSTEM },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Give details for: ${data.name}. It's the object in this photo. JSON only.`,
              },
              { type: "image_url", image_url: { url: toDataUrl(data.imageBase64) } },
            ],
          },
        ],
      }),
    );

    const parsed = safeParse<Partial<DetectedItem>>(content, {});
    return {
      category: String(parsed.category ?? "other"),
      description: String(parsed.description ?? ""),
      priceMin: Number(parsed.priceMin ?? 0),
      priceMax: Number(parsed.priceMax ?? 0),
      currency: String(parsed.currency ?? "USD"),
      searchUrl:
        parsed.searchUrl || `https://www.google.com/search?q=${encodeURIComponent(data.name)}`,
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

const DeepInput = z.object({
  name: z.string().min(1),
  imageBase64: z.string().min(100),
});

export type DeepAnalysis = {
  brand: string;
  product: string;
  confidence: "low" | "medium" | "high";
  description: string;
  priceMin: number;
  priceMax: number;
  currency: string;
  buyUrl: string;
  infoUrl: string;
};

export const analyzeFurther = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => DeepInput.parse(data))
  .handler(async ({ data, context }): Promise<DeepAnalysis> => {
    const { withCredits } = await import("./credits.server");
    const content = await withCredits("analyze_further", context.userId, () =>
      callGateway("analyze_further", {
        model: "google/gemini-2.5-pro",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: DEEP_SYSTEM },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Identify the EXACT product for: ${data.name}. Give best-guess brand, model, refined price. JSON only.`,
              },
              { type: "image_url", image_url: { url: toDataUrl(data.imageBase64) } },
            ],
          },
        ],
      }),
    );
    const parsed = safeParse<Partial<DeepAnalysis>>(content, {});
    const q = [parsed.brand, parsed.product, data.name].filter(Boolean).join(" ").trim();
    return {
      brand: String(parsed.brand ?? ""),
      product: String(parsed.product ?? ""),
      confidence: (parsed.confidence as DeepAnalysis["confidence"]) ?? "low",
      description: String(parsed.description ?? ""),
      priceMin: Number(parsed.priceMin ?? 0),
      priceMax: Number(parsed.priceMax ?? 0),
      currency: String(parsed.currency ?? "USD"),
      buyUrl: parsed.buyUrl || `https://www.google.com/search?q=${encodeURIComponent(`buy ${q}`)}`,
      infoUrl:
        parsed.infoUrl ||
        `https://www.google.com/search?q=${encodeURIComponent(`${q} review specs`)}`,
    };
  });

const TranslateInput = z.object({ text: z.string().min(1).max(200) });

export type Translation = {
  language: string;
  languageCode: string;
  script: string;
  translation: string;
  transliteration: string;
  note: string;
};

export const translateText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => TranslateInput.parse(data))
  .handler(async ({ data, context }): Promise<Translation> => {
    const { withCredits } = await import("./credits.server");
    const content = await withCredits("translate", context.userId, () =>
      callGateway("translate", {
        model: "google/gemini-3-flash-preview",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: TRANSLATE_SYSTEM },
          { role: "user", content: `Translate to English: ${data.text}` },
        ],
      }),
    );
    const parsed = safeParse<Partial<Translation>>(content, {});
    return {
      language: String(parsed.language ?? "Unknown"),
      languageCode: String(parsed.languageCode ?? ""),
      script: String(parsed.script ?? ""),
      translation: String(parsed.translation ?? ""),
      transliteration: String(parsed.transliteration ?? ""),
      note: String(parsed.note ?? ""),
    };
  });

const PersonInput = z.object({ name: z.string().min(1).max(120) });

export type WebSource = { title: string; url: string };

export type PersonInfo = {
  known: boolean;
  summary: string;
  bullets: string[];
  occupation: string;
  nationality: string;
  wikipediaUrl: string;
  sources?: WebSource[];
};


export const personInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => PersonInput.parse(data))
  .handler(async ({ data, context }): Promise<PersonInfo> => {
    const { withCredits } = await import("./credits.server");
    const content = await withCredits("person_info", context.userId, () =>
      callGateway("person_info", {
        model: "google/gemini-2.5-pro",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: PERSON_SYSTEM },
          {
            role: "user",
            content: `Give a public info summary for: ${data.name}. Use only widely-known public information. If not publicly known, say so.`,
          },
        ],
      }),
    );
    const parsed = safeParse<Partial<PersonInfo>>(content, {});
    return {
      known: Boolean(parsed.known),
      summary: String(parsed.summary ?? ""),
      bullets: Array.isArray(parsed.bullets) ? parsed.bullets.map(String).slice(0, 10) : [],
      occupation: String(parsed.occupation ?? ""),
      nationality: String(parsed.nationality ?? ""),
      wikipediaUrl: String(parsed.wikipediaUrl ?? ""),
    };
  });

const PersonSearchInput = z.object({
  name: z.string().min(1).max(120),
  location: z.string().max(160).optional().default(""),
});

export type PersonMatch = {
  name: string;
  occupation: string;
  location: string;
  nationality: string;
  summary: string;
  bullets: string[];
  wikipediaUrl: string;
  sources: WebSource[];
};

export type PersonSearchResult = { matches: PersonMatch[] };

const PERSON_SEARCH_SYSTEM = `You summarize web search results about a person. You are given the raw results of a normal web (Google-style) search.
Base EVERY fact strictly on the provided search results — never add knowledge that is not supported by them, and never include private/sensitive data (home address, phone, email, ID numbers).
If the results clearly describe several different people with the same name, list each as a separate match (max 6), most likely first. If a location was given, prioritize matches connected to that place. If the results contain nothing meaningful about a person, return an empty list.
For each match, "sources" must contain 1-4 of the given result URLs that support the summary (copy the url and title exactly).
Respond ONLY with compact JSON:
{"matches":[{"name":"full name","occupation":"","location":"city/country most associated with, else empty","nationality":"","summary":"2-4 neutral sentences","bullets":["short public fact","..."],"wikipediaUrl":"wikipedia url if present in results else empty","sources":[{"title":"","url":""}]}]}`;

export const personSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => PersonSearchInput.parse(data))
  .handler(async ({ data, context }): Promise<PersonSearchResult> => {
    const { withCredits } = await import("./credits.server");
    const { webSearch } = await import("./websearch.server");

    const query = [data.name, data.location].filter(Boolean).join(" ");
    const results = await webSearch(query, 8);

    if (results.length === 0) return { matches: [] };

    const resultsText = results
      .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.snippet}`)
      .join("\n\n");

    const content = await withCredits("person_info", context.userId, () =>
      callGateway("person_search", {
        model: "google/gemini-2.5-flash",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: PERSON_SEARCH_SYSTEM },
          {
            role: "user",
            content: `Searched for: "${query}"\nName: ${data.name}\nLocation: ${data.location || "(not provided)"}\n\nSearch results:\n${resultsText}\n\nJSON only.`,
          },
        ],
      }),
    );
    const parsed = safeParse<{ matches?: Partial<PersonMatch>[] }>(content, {});
    const allowed = new Set(results.map((r) => r.url));
    const matches = (parsed.matches ?? []).slice(0, 6).map((m) => ({
      name: String(m.name ?? data.name),
      occupation: String(m.occupation ?? ""),
      location: String(m.location ?? ""),
      nationality: String(m.nationality ?? ""),
      summary: String(m.summary ?? ""),
      bullets: Array.isArray(m.bullets) ? m.bullets.map(String).slice(0, 10) : [],
      wikipediaUrl: String(m.wikipediaUrl ?? ""),
      sources: (Array.isArray(m.sources) ? m.sources : [])
        .map((s) => ({ title: String(s?.title ?? ""), url: String(s?.url ?? "") }))
        .filter((s) => allowed.has(s.url))
        .slice(0, 4),
    }));
    return { matches };
  });

