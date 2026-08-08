import { recordAiUsage } from "./ai-usage.server";

export const LISTING_SYSTEM = `You write concise, trustworthy second-hand marketplace listings.
Given an item name, description, and resale price estimate, produce a ready-to-paste listing.

Rules:
- Title: 40-80 characters, specific and searchable, include brand/model if known.
- Description: 2-4 short paragraphs, mention what it is, key features, condition, and what is included.
- Price: choose a realistic listing price slightly below the typical resale estimate to attract buyers; round to a nice number.
- Condition: one of "New", "Like new", "Good", "Fair", "For parts".
- Keywords: 5-8 relevant hashtags or search keywords, no # symbol.
- Keep the same language as the item name/description.
- Do not include any personal information, phone numbers, or email addresses.
- Output ONLY compact JSON, no markdown or commentary.

JSON format:
{
  "title": "...",
  "description": "...",
  "price": 123,
  "currency": "USD",
  "condition": "...",
  "category": "...",
  "keywords": ["..."]
}`;

export async function callGateway(action: string, body: unknown, userId: string): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
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

  const model = (body as { model?: string })?.model ?? "unknown";
  await recordAiUsage({ action, model, usage: json.usage, userId });

  return json.choices?.[0]?.message?.content ?? "{}";
}

export function safeParse<T>(content: string, fallback: T): T {
  const stripped = content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  try {
    return JSON.parse(stripped) as T;
  } catch {
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
