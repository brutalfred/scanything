// Server-only: persist token usage + estimated USD cost for every AI call.
import { estimateCostUsd, usdToMicro } from "./economics";

type Usage = { prompt_tokens?: number; completion_tokens?: number };

export async function recordAiUsage(params: {
  action: string;
  model: string;
  usage?: Usage;
  userId: string | null;
}) {
  const inputTokens = Math.max(0, Math.round(params.usage?.prompt_tokens ?? 0));
  const outputTokens = Math.max(0, Math.round(params.usage?.completion_tokens ?? 0));
  if (inputTokens === 0 && outputTokens === 0) return;

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("ai_usage").insert({
      user_id: params.userId,
      action: params.action,
      model: params.model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_micro_usd: usdToMicro(estimateCostUsd(params.model, inputTokens, outputTokens)),
    });
  } catch {
    // Cost telemetry must never break a scan.
  }
}
