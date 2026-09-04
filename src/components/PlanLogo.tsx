import logoAsset from "@/assets/scanything-logo.png.asset.json";
import type { PlanType } from "@/lib/plan-mapping";

/**
 * App logo. Pro and Max subscribers get a glowing variant with a stylish
 * wordmark underneath (gold shine for Pro, diamond shine for Max).
 */
export function PlanLogo({ plan, className }: { plan: PlanType | null; className?: string }) {
  const img = (
    <img
      src={logoAsset.url}
      alt="Scanything logo — AI camera item identifier and price estimator"
      className={className ?? "h-20 w-auto max-w-full object-contain sm:h-[100px]"}
    width={886}
    height={580}
    />
  );

  // The scan-line overlay wraps the image so the sweeping line stays clipped
  // to the logo's bounding box.
  const withScanLine = (
    <span className="logo-scan-wrap relative isolate inline-flex overflow-hidden">
      {img}
      <span aria-hidden className="logo-scan-line" />
    </span>
  );

  if (!plan) return withScanLine;

  return (
    <span className="flex flex-col items-center">
      <span
        className={`relative isolate inline-flex ${plan === "max" ? "plan-glow-max" : "plan-glow-pro"}`}
      >
        {withScanLine}
      </span>
      <PlanWordmark plan={plan} />
    </span>
  );
}

export function PlanWordmark({ plan }: { plan: PlanType }) {
  const isMax = plan === "max";
  return (
    <span
      className="-mt-1 inline-flex items-center gap-[0.35em] text-[10px] font-black uppercase leading-none tracking-[0.5em] sm:text-[11px]"
      style={{
        backgroundImage: isMax
          ? "linear-gradient(100deg,#ffffff 0%,#b9e8ff 25%,#ffffff 50%,#d9c8ff 75%,#ffffff 100%)"
          : "linear-gradient(100deg,#8a6b1f 0%,#f0d78c 35%,#fff6d5 50%,#c9a84c 70%,#8a6b1f 100%)",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "transparent",
      }}
    >
      <span aria-hidden className="text-[0.8em] opacity-70">
        {isMax ? "◆" : "✦"}
      </span>
      {isMax ? "Max" : "Pro"}
      <span aria-hidden className="text-[0.8em] opacity-70">
        {isMax ? "◆" : "✦"}
      </span>
    </span>
  );
}

/** Small inline badge, e.g. next to the account email. */
export function PlanBadge({ plan }: { plan: PlanType }) {
  const isMax = plan === "max";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest"
      style={
        isMax
          ? {
              background: "linear-gradient(100deg,#e8f7ff,#ffffff 40%,#d9c8ff 70%,#ffffff)",
              color: "#1a1a2e",
              boxShadow: "0 0 10px rgba(180,225,255,0.7)",
            }
          : {
              background: "linear-gradient(100deg,#8a6b1f,#f0d78c 45%,#c9a84c)",
              color: "#1a1405",
              boxShadow: "0 0 10px rgba(240,215,140,0.6)",
            }
      }
    >
      {isMax ? "◆" : "✦"} {isMax ? "Max" : "Pro"}
    </span>
  );
}
