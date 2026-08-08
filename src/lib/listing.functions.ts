import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { LISTING_SYSTEM, callGateway, safeParse } from "./listing.server";

const EnvironmentSchema = z.object({
  environment: z.enum(["sandbox", "live"]).optional().default("live"),
});

const GenerateListingInput = z
  .object({
    name: z.string().min(1).max(200),
    description: z.string().max(2000).optional().default(""),
    category: z.string().max(100).optional().default("other"),
    priceMin: z.number().min(0).optional().default(0),
    priceMax: z.number().min(0).optional().default(0),
    currency: z.string().max(3).optional().default("USD"),
    resaleLow: z.number().min(0).optional().default(0),
    resaleTypical: z.number().min(0).optional().default(0),
    resaleHigh: z.number().min(0).optional().default(0),
    conditionHint: z.string().max(200).optional().default(""),
  })
  .merge(EnvironmentSchema);

export type ListingDraft = {
  title: string;
  description: string;
  /** Suggested listing price in the original currency. */
  price: number;
  currency: string;
  /** Estimated condition string. */
  condition: string;
  /** Category suggested for marketplace listings. */
  category: string;
  /** Hashtags / keywords for the listing. */
  keywords: string[];
};

export const generateListingDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => GenerateListingInput.parse(data))
  .handler(async ({ data, context }): Promise<ListingDraft> => {
    const { withCredits } = await import("./credits.server");

    const prompt = `Item: ${data.name}
Category: ${data.category}
Description: ${data.description || "No description provided."}
Original retail estimate: ${data.priceMin}-${data.priceMax} ${data.currency}
Estimated resale range: ${data.resaleLow}-${data.resaleHigh} ${data.currency}, typical ${data.resaleTypical} ${data.currency}
Extra condition note: ${data.conditionHint || "None"}

Generate a marketplace listing draft for this item.`;

    const content = await withCredits(
      "resale_listing",
      context.userId,
      () =>
        callGateway(
          "resale_listing",
          {
            model: "google/gemini-3.6-flash",
            temperature: 0.25,
            max_tokens: 1024,
            messages: [
              { role: "system", content: LISTING_SYSTEM },
              { role: "user", content: prompt },
            ],
          },
          context.userId,
        ),
      data.environment as "sandbox" | "live",
    );

    const parsed = safeParse<ListingDraft>(content, {
      title: data.name,
      description: data.description || "",
      price: data.resaleTypical || 0,
      currency: data.currency,
      condition: "Good",
      category: data.category,
      keywords: [data.category, data.name.split(" ").slice(0, 3).join(" ")],
    });

    return {
      title: parsed.title?.slice(0, 120) || data.name,
      description: parsed.description || "",
      price: typeof parsed.price === "number" ? parsed.price : data.resaleTypical || 0,
      currency: parsed.currency || data.currency,
      condition: parsed.condition || "Good",
      category: parsed.category || data.category,
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 12) : [],
    };
  });
