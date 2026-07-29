import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { verifyWebhook, EventName, type PaddleEnv } from "@/lib/paddle.server";
import { CREDITS_BY_PRICE_ID } from "@/lib/credit-packs";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _supabase;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleTransactionCompleted(data: any, env: PaddleEnv) {
  const userId = data?.customData?.userId as string | undefined;
  if (!userId) {
    console.error("payments webhook: no userId in customData");
    return;
  }

  const item = data?.items?.[0];
  const priceId = item?.price?.importMeta?.externalId as string | undefined;
  if (!priceId) {
    console.warn("payments webhook: missing importMeta.externalId", {
      rawPriceId: item?.price?.id,
    });
    return;
  }

  const credits = CREDITS_BY_PRICE_ID[priceId];
  if (!credits) {
    console.warn("payments webhook: unknown credit pack", priceId);
    return;
  }

  const supabase = getSupabase();

  // Idempotency: the unique transaction id guards against webhook retries.
  const { error: insertError } = await supabase.from("credit_purchases").insert({
    user_id: userId,
    paddle_transaction_id: data.id,
    price_id: priceId,
    credits,
    amount_cents: Number(data?.details?.totals?.total ?? 0) || null,
    currency: data?.currencyCode ?? null,
    environment: env,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      console.log("payments webhook: transaction already processed", data.id);
      return;
    }
    throw new Error(insertError.message);
  }

  const { error: grantError } = await supabase.rpc("grant_credits", {
    _user_id: userId,
    _amount: credits,
    _reason: `purchase:${priceId}`,
  });
  if (grantError) throw new Error(grantError.message);
}

async function handleWebhook(req: Request, env: PaddleEnv) {
  const event = await verifyWebhook(req, env);

  switch (event.eventType) {
    case EventName.TransactionCompleted:
      await handleTransactionCompleted(event.data, env);
      break;
    default:
      console.log("Unhandled event:", event.eventType);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const env = (url.searchParams.get("env") || "sandbox") as PaddleEnv;
        try {
          await handleWebhook(request, env);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
