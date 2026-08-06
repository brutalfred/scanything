import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EnvironmentSchema = z.object({
  environment: z.enum(["sandbox", "live"]).optional().default("live"),
});

const InputSchema = z.object({
  imageBase64: z.string().min(100),
  excludeNames: z.array(z.string()).optional(),
  pass: z.number().optional(),
  resale: z.boolean().optional(),
}).merge(EnvironmentSchema);


export type ResaleInfo = {
  low: number;
  typical: number;
  high: number;
  currency: string;
  /** "sell" = worth listing, "keep" = not worth the effort. */
  verdict: "sell" | "keep";
  reason: string;
};

export type DetectedItem = {
  name: string;
  category: string;
  description: string;
  priceMin: number;
  priceMax: number;
  currency: string;
  searchUrl: string;
  infoUrl: string;
  confidence: number; // 0..100
  box: { x: number; y: number; w: number; h: number }; // 0..1 normalized (top-left)
  resale?: ResaleInfo;
};


export type QuickItem = {
  name: string;
  confidence: number; // 0..100
  box: { x: number; y: number; w: number; h: number };
};


export type AnalyzeResult = {
  items: DetectedItem[];
};

export type QuickResult = {
  items: QuickItem[];
};

const FULL_SYSTEM = `You are a fast visual room-analyzer. Identify EVERY DISTINCT physical object visible in the photo, at any size. Do not skip small objects.

PRIORITY — focus almost entirely on everyday human-use objects:
furniture, toys, plants, clothes, shoes, bags, books, electronics, appliances, kitchenware, decor, instruments, sports gear, pets/pet items, food items, doors, windows.

TEXT / SIGNS: If you see any writing, logo, sign, sticker, tattoo or label that is NOT in the Latin alphabet (e.g. Chinese, Japanese, Korean, Arabic, Hebrew, Cyrillic, Thai, Devanagari, Greek), include it as an item with category="text" and use the actual visible characters as the "name" (short — max ~40 chars). Draw its box tightly around the writing.

VEHICLES: If a car, motorcycle, van, truck, bus or bicycle is visible, include it with category="vehicle". Guess make, model and generation/year range in the description, and give a realistic used-market price range.

LICENSE PLATES: If a vehicle registration plate is readable, include a SEPARATE item with category="plate", name = the plate characters exactly as shown (uppercase), box tight around the plate. In the description ONLY state the issuing country/region and the plate format/series. Set priceMin and priceMax to 0. NEVER guess, state or imply the owner's identity, name, address or any other personal detail, and never suggest how to look the plate up.

PEOPLE: NEVER include people, faces or human body parts as items, and NEVER describe, identify, name or guess anything about a person visible in the photo. Skip humans entirely and only list objects.

NEVER include isolated human body parts (hand, arm, leg, foot, torso, face without a portrait context, head, hair, skin, finger). Skip them entirely.

NAMING: name the OBJECT itself, never the person who uses it. Small handheld things (baby rattles, teethers, toys, tools, utensils, remotes, phones, cups) must be named as the object, e.g. "Baby rattle", "Teething toy", "Screwdriver" — never "Baby", "Child" or "Person".


DO NOT include structural/architectural surfaces (walls, wall paint, floor, ceiling, beams, pillars, concrete, tiles, carpet, molding, radiators, empty corners) UNLESS the photo contains essentially no everyday items — only then may you include at most 1-2 structural elements as a last resort.

For each object, respond with a compact JSON object matching:
{
  "items": [
    {
      "name": "short common name",
      "category": "furniture|electronics|appliance|decor|plant|book|kitchenware|clothing|toy|instrument|door|text|vehicle|plate|other",
      "description": "1-2 sentence plain description of what it likely is (brand/style guess if obvious)",
      "priceMin": number in USD (typical low retail, 0 for text/plate),
      "priceMax": number in USD (typical high retail, 0 for text/plate),
      "currency": "USD",
      "searchUrl": "https://www.google.com/search?q=<url-encoded query to buy the item>",
      "infoUrl": "https://en.wikipedia.org/wiki/<topic>  OR a relevant homepage/wikipedia URL",
      "confidence": integer 0-100 — how certain you are that this identification is correct,
      "box": { "x": 0..1, "y": 0..1, "w": 0..1, "h": 0..1 }
    }
  ]
}

box is the object's bounding box in NORMALIZED image coordinates where (0,0) is the TOP-LEFT of the image and (1,1) is the bottom-right. x,y is the top-left corner of the box. Be accurate with boxes.

There is NO maximum number of items — list everything you can identify. Prefer confident guesses. Output ONLY JSON, no markdown.`;

/** Appended to FULL_SYSTEM when the user runs a Resale Scan. */
const RESALE_ADDENDUM = `

RESALE MODE — this scan is for someone deciding what is worth selling. For EVERY item (except category "plate" and "text") ALSO include a "resale" object:
"resale": {
  "low": <realistic USED second-hand sale price, low end, USD number>,
  "typical": <most likely actual selling price used, USD number>,
  "high": <best realistic used price in great condition, USD number>,
  "currency": "USD",
  "verdict": "sell" | "keep",
  "reason": "one short sentence — why it is or isn't worth listing (demand, effort, shipping, typical payout)"
}
Use real second-hand marketplace prices (eBay sold listings, Facebook Marketplace, Etsy for vintage/handmade), NOT retail. Be conservative and honest — most everyday used items sell for far less than retail. Set verdict to "keep" when typical resale is under about $15 or when shipping/effort would eat the payout. Also mention brand/model in the description whenever you can see it, since that drives resale value.`;


const QUICK_SYSTEM = `You are a REAL-TIME object spotter. Look at the photo and quickly name every distinct object you can identify, at any size. There is no maximum — name as many as you can see, starting with objects near the CENTER of the frame.

PRIORITY — spot everyday human-use items: furniture, toys, plants, clothes, shoes, bags, books, electronics, appliances, kitchenware, decor, instruments, sports gear, doors, windows.
ALSO spot vehicles (name them "Car", "Motorcycle", etc) and any readable vehicle registration plate (use the plate characters as the name).
ALSO include any visible writing/sign/logo that is NOT in the Latin alphabet (Chinese, Japanese, Korean, Arabic, Hebrew, Cyrillic, Thai, Devanagari, Greek). Use the actual characters as the name (short).
NEVER include human body parts or people (hand, arm, leg, foot, torso, face, head, hair, skin, finger, nose, ear, eye, mouth, person, human, body). Skip them entirely.
IGNORE walls, wall paint, floor, ceiling, beams, pillars, concrete, tiles, carpet, molding — unless there is literally nothing else visible in the frame.

Use the shortest possible common name (1-2 words: "TV", "Bed", "Lamp", "Chair", "Plant", "Door"). For non-Latin text, use the actual characters.

Respond with ONLY compact JSON:
{"items":[{"name":"TV","confidence":88,"box":{"x":0.2,"y":0.3,"w":0.4,"h":0.3}}]}

confidence is an integer 0-100 for how sure you are about the name.

box is normalized image coords (top-left origin). Be tight around the object. No item limit. NO markdown, NO extra text. Be fast.`;

const ENRICH_SYSTEM = `You are giving quick shopping info for a single item. If the item is a vehicle registration plate, use category="plate", set prices to 0, and describe the issuing country/region and plate format only — NEVER the owner or any personal detail. If it is a vehicle, use category="vehicle" and guess make/model with a used-market price range. Respond ONLY with compact JSON:
{"category":"furniture|electronics|appliance|decor|plant|book|kitchenware|clothing|toy|instrument|vehicle|plate|other","description":"1-2 sentence plain description","priceMin":<usd number>,"priceMax":<usd number>,"currency":"USD","searchUrl":"https://www.google.com/search?q=<url-encoded>","infoUrl":"https://en.wikipedia.org/wiki/<topic> or relevant homepage","confidence":<integer 0-100 certainty of the identification>}`;

const DEEP_SYSTEM = `You are a product identification expert. Given a photo (or crop) of a single item and a rough name, do your best to identify the EXACT product: guess brand, model, materials, generation/year if possible. Give a refined price range in USD based on that specific guess. Respond ONLY with compact JSON:
{"brand":"best-guess brand or empty","product":"best-guess specific product name or empty","confidence":<integer 0-100 certainty of this exact product identification>,"description":"2-4 sentences with concrete details (materials, features, distinguishing marks)","priceMin":<usd>,"priceMax":<usd>,"currency":"USD","buyUrl":"https://www.google.com/search?q=<url-encoded specific product query>","infoUrl":"https://www.google.com/search?q=<url-encoded review/spec query>"}`;

const TRANSLATE_SYSTEM = `You translate short pieces of text (signs, logos, labels) into English. Respond ONLY with compact JSON:
{"language":"detected language name in English (e.g. 'Japanese', 'Arabic') or 'Unknown'","languageCode":"ISO 639-1 code if known, else empty","script":"script name (e.g. 'Han', 'Arabic', 'Cyrillic') or empty","translation":"best English translation, or empty if you truly cannot translate","transliteration":"Latin-alphabet phonetic reading if applicable, else empty","note":"short note on ambiguity if any, else empty"}`;

async function callGateway(action: string, body: unknown, userId: string): Promise<string> {
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
  const { recordAiUsage } = await import("./ai-usage.server");
  // Identity comes from the auth middleware, never from an unverified token.
  await recordAiUsage({ action, model, usage: json.usage, userId });

  return json.choices?.[0]?.message?.content ?? "{}";
}

function safeParse<T>(content: string, fallback: T): T {
  const stripped = content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  try {
    return JSON.parse(stripped) as T;
  } catch {
    // Models sometimes wrap JSON in prose or truncate it — grab the outermost object.
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(stripped.slice(start, end + 1)) as T;
      } catch {
        /* fall through */
      }
    }
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
    const exclude = (data.excludeNames ?? []).map((n) => String(n).trim()).filter(Boolean);
    const userText = exclude.length
      ? `SECOND PASS. These objects were ALREADY found and must NOT be repeated: ${exclude
          .slice(0, 120)
          .join(", ")}.
Look again at the SAME photo and find ONLY additional objects that were missed: small items, partially hidden or occluded objects, things in the background or at the edges, individual objects inside clusters/shelves/tables, and items behind or on top of the ones already listed. Keep all the same rules (no human body parts, structural surfaces only as a last resort) and the exact same JSON shape. If you truly find nothing new, return {"items":[]}. Return JSON only.`
      : data.resale
        ? "Resale scan of this photo — value every sellable item. Return JSON only."
        : "Analyze this room photo. Return JSON only.";
    const content = await withCredits("photo_scan", context.userId, () =>
      callGateway("photo_scan", {
        model: "google/gemini-3-flash-preview",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: data.resale ? FULL_SYSTEM + RESALE_ADDENDUM : FULL_SYSTEM,
          },
          {
            role: "user",
            content: [
              { type: "text", text: userText },
              { type: "image_url", image_url: { url: toDataUrl(data.imageBase64) } },
            ],
          },
        ],
      }, context.userId),
      data.environment as "sandbox" | "live",
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
        // Sweep mode: smallest/fastest model, capped output — speed over accuracy.
        model: "google/gemini-2.5-flash-lite",
        response_format: { type: "json_object" },
        temperature: 0,
        max_tokens: 900,
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
      }, context.userId),
      data.environment as "sandbox" | "live",
    );

    const parsed = safeParse<QuickResult>(content, { items: [] });

    const items = (parsed.items ?? [])
      .filter((it) => it && it.box && typeof it.box.x === "number")
      .map((it) => ({
        name: String(it.name ?? "Object").trim(),
        confidence: clampPct(it.confidence),
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
}).merge(EnvironmentSchema);


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
      }, context.userId),
      data.environment as "sandbox" | "live",
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
      confidence: clampPct(parsed.confidence),
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
    confidence: clampPct(it.confidence),
    box: {
      x: clamp01(it.box.x),
      y: clamp01(it.box.y),
      w: clamp01(it.box.w),
      h: clamp01(it.box.h),
    },
    ...(it.resale ? { resale: normalizeResale(it.resale) } : {}),
  };
}

function normalizeResale(r: ResaleInfo): ResaleInfo {
  const num = (v: unknown) => Math.max(0, Math.round(Number(v) || 0));
  return {
    low: num(r.low),
    typical: num(r.typical),
    high: num(r.high),
    currency: String(r.currency ?? "USD"),
    verdict: r.verdict === "keep" ? "keep" : "sell",
    reason: String(r.reason ?? ""),
  };
}


function clampPct(n: unknown) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 70;
  return Math.max(0, Math.min(100, Math.round(v <= 1 ? v * 100 : v)));
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

const DeepInput = z.object({
  name: z.string().min(1),
  imageBase64: z.string().min(100),
  /** Additional user-supplied photos of the same object (other angles/close-ups). */
  extraImages: z.array(z.string().min(100)).max(4).optional(),
  /** Optional free-text hint the user typed to help identification. */
  userNote: z.string().trim().max(300).optional(),

  live: z.boolean().optional(),
}).merge(EnvironmentSchema);


export type DeepAnalysis = {
  brand: string;
  product: string;
  confidence: number; // 0..100
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
    const reason = data.live ? "analyze_further_live" : "analyze_further";
    const extras = (data.extraImages ?? []).slice(0, 4);
    const total = 1 + extras.length;
    const note = (data.userNote ?? "").trim();
    const notePart = note
      ? ` The user added this context about the object — treat it as reliable evidence and reconcile it with what you see: "${note}".`
      : "";
    const content = await withCredits(reason, context.userId, () =>
      callGateway(reason, {
        model: "google/gemini-2.5-pro",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: DEEP_SYSTEM },
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  (total > 1
                    ? `Identify the EXACT product for: ${data.name}. All ${total} images show the SAME single object from different angles/close-ups — combine every detail you can read across them (labels, logos, model numbers, wear, materials) into one identification, and raise confidence only if the images agree.`
                    : `Identify the EXACT product for: ${data.name}. Give best-guess brand, model, refined price.`) +
                  notePart +
                  " JSON only.",
              },

              { type: "image_url", image_url: { url: toDataUrl(data.imageBase64) } },
              ...extras.map((img) => ({
                type: "image_url" as const,
                image_url: { url: toDataUrl(img) },
              })),
            ],
          },
        ],
      }, context.userId),
      data.environment as "sandbox" | "live",
    );
    const parsed = safeParse<Partial<DeepAnalysis>>(content, {});
    const q = [parsed.brand, parsed.product, data.name].filter(Boolean).join(" ").trim();
    return {
      brand: String(parsed.brand ?? ""),
      product: String(parsed.product ?? ""),
      confidence: clampPct(parsed.confidence),
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

const TranslateInput = z.object({ text: z.string().min(1).max(200) }).merge(EnvironmentSchema);

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
      }, context.userId),
      data.environment as "sandbox" | "live",
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

const DOC_SYSTEM = `You are a high-accuracy OCR engine. Transcribe ALL text visible in the image verbatim.
Rules:
- Output the literal text exactly as printed/written: same words, spelling, capitalisation, punctuation, numbers, dates, currency symbols and totals.
- Preserve the visual layout: one output line per printed line, blank line between blocks. Read multi-column pages column by column, left column fully before the right one. Keep table rows on one line with columns separated by " | ".
- Transcribe headers, footers, page numbers, stamps, handwriting and small print too. Never stop early or truncate — continue until the last line of the page.
- Do NOT summarize, explain, describe the document, translate it, correct spelling, or add commentary, headings or labels of your own.
- Keep the original language and script. Use "?" only for individual characters you truly cannot read.
- If the image contains no text, description must be an empty string.
Respond ONLY with compact JSON:
{"items":[{"name":"short title (e.g. 'Receipt' or 'Document page')","category":"document","description":"<the verbatim transcribed text, with \\n between lines>","priceMin":0,"priceMax":0,"currency":"USD","searchUrl":"","infoUrl":"","confidence":85,"box":{"x":0,"y":0,"w":1,"h":1}}]}`;


export const analyzeDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }): Promise<AnalyzeResult> => {
    const { withCredits } = await import("./credits.server");
    const content = await withCredits("document_scan", context.userId, () =>
      callGateway("document_scan", {
        model: "google/gemini-3-flash-preview",
        response_format: { type: "json_object" },
        // Deterministic decoding: transcription must not be "creative".
        temperature: 0,
        top_p: 1,
        // Long pages need room; truncated output loses the end of the document.
        max_tokens: 8192,
        messages: [
          { role: "system", content: DOC_SYSTEM },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Transcribe every word of text in this image verbatim, in reading order, to the very last line. JSON only.",
              },
              { type: "image_url", image_url: { url: toDataUrl(data.imageBase64) } },
            ],
          },
        ],
      }, context.userId),
      data.environment as "sandbox" | "live",
    );


    const parsed = safeParse<AnalyzeResult>(content, { items: [] });
    const items = (parsed.items ?? [])
      .filter(Boolean)
      // A page transcription has no meaningful bounding box — default to full frame.
      .map((it) => normalizeFull({ ...it, box: it.box ?? { x: 0, y: 0, w: 1, h: 1 } }));
    return { items };
  });




const NameTranslateInput = z.object({
  text: z.string().min(1).max(200),
  targetLanguage: z.string().min(1).max(40),
  // Deep-analysis descriptions can be long; trim instead of rejecting the request.
  description: z
    .string()
    .optional()
    .transform((v) => (v ? v.slice(0, 2000) : v)),
  category: z.string().max(200).optional(),
  labels: z.array(z.string().max(120)).max(30).optional(),
});

export type NameTranslation = {
  translation: string;
  transliteration: string;
  description: string;
  category: string;
  labels: string[];
};

/** Free (no credit cost) translation of a scanned item's whole info card into a chosen language. */
export const translateName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => NameTranslateInput.parse(data))
  .handler(async ({ data, context }): Promise<NameTranslation> => {
    const labels = data.labels ?? [];

    const run = async (strict: boolean) => {
      const content = await callGateway(
        "translate_name",
        {
          model: "google/gemini-3-flash-preview",
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                'You are a translation engine. You ALWAYS translate, never refuse, never explain. Translate an object info card into the requested target language, writing in that language\'s native script. Keep numbers, prices, currency codes and brand names unchanged. Respond ONLY with compact JSON, no markdown: {"translation":"the item name in the target language","transliteration":"Latin-alphabet reading if the target script is not Latin, else empty","description":"the description translated (empty string only if no description was given)","category":"the category word translated (empty string only if none was given)","labels":["each provided UI label translated, same order and count"]}' +
                (strict
                  ? " The previous attempt returned empty or invalid output. Output valid JSON with every field filled in this time."
                  : ""),
            },
            {
              role: "user",
              content: JSON.stringify({
                targetLanguage: data.targetLanguage,
                name: data.text,
                description: data.description ?? "",
                category: data.category ?? "",
                labels,
              }),
            },
          ],
        },
        context.userId,
      );
      return safeParse<Partial<NameTranslation>>(content, {});
    };

    let parsed = await run(false);
    // A blank name translation means the model refused or emitted unusable JSON — retry once.
    if (!String(parsed.translation ?? "").trim()) parsed = await run(true);

    const translation = String(parsed.translation ?? "").trim();
    if (!translation) throw new Error("Translation failed. Please try again.");

    const outLabels = Array.isArray(parsed.labels) ? parsed.labels.map((l) => String(l)) : [];
    return {
      translation,
      transliteration: String(parsed.transliteration ?? ""),
      // Fall back to the original text rather than blanking parts of the card.
      description: String(parsed.description ?? "").trim() || (data.description ?? ""),
      category: String(parsed.category ?? "").trim() || (data.category ?? ""),
      labels: labels.map((l, i) => outLabels[i] || l),
    };
  });


