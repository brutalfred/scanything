const GATEWAY = "https://connector-gateway.lovable.dev/firecrawl/v2";

export type WebResult = { title: string; url: string; snippet: string };

/**
 * Runs a plain web (Google-style) search through the Firecrawl connector gateway.
 * Returns lightweight result rows — no page scraping, to keep it fast/cheap.
 */
export async function webSearch(query: string, limit = 6): Promise<WebResult[]> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const firecrawlKey = process.env.FIRECRAWL_API_KEY;
  if (!lovableKey || !firecrawlKey) return [];

  const res = await fetch(`${GATEWAY}/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": firecrawlKey,
    },
    body: JSON.stringify({ query, limit }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`Firecrawl search failed [${res.status}]: ${body}`);
    return [];
  }

  const json = (await res.json()) as {
    data?: { web?: unknown[] } | unknown[];
  };
  const raw = Array.isArray(json.data)
    ? json.data
    : Array.isArray((json.data as { web?: unknown[] } | undefined)?.web)
      ? ((json.data as { web?: unknown[] }).web as unknown[])
      : [];

  return raw
    .map((r) => {
      const o = r as { title?: string; url?: string; description?: string; snippet?: string };
      return {
        title: String(o.title ?? ""),
        url: String(o.url ?? ""),
        snippet: String(o.description ?? o.snippet ?? ""),
      };
    })
    .filter((r) => r.url);
}
