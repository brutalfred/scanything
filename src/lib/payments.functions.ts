import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { gatewayFetch } from "@/lib/paddle.server";

const PriceSchema = z.object({
  priceId: z.string().min(1).max(120),
  environment: z.enum(["sandbox", "production"]),
});

export const resolvePaddlePrice = createServerFn({ method: "GET" })
  .inputValidator((data) => PriceSchema.parse(data))
  .handler(async ({ data }) => {
    const response = await gatewayFetch(
      data.environment,
      `/prices?external_id=${encodeURIComponent(data.priceId)}`,
    );
    const result = (await response.json()) as { data?: Array<{ id: string }> };
    if (!result.data?.length) throw new Error("Price not found");
    return result.data[0].id;
  });
