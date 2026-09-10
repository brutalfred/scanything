import logoAsset from "@/assets/scanything-logo.png.asset.json";
import type { PlanType } from "@/lib/plan-mapping";

/**
 * App logo with the two-line tagline underneath:
 *   Scan Anything
 *   Know Everything
 * Pro and Max subscribers also get a glowing wordmark (gold for Pro,
 * diamond for Max). All three text rows are stacked so nothing crosses.
 */
export function PlanLogo({ plan, className }: { plan: PlanType | null; className?: string }) {
  return (
    <span className="flex flex-col items-center">
      <img
        src={logoAsset.url}
        alt="Scanything logo — AI camera item identifier and price estimator"
        className={className ?? "h-20 w-auto max-w-full object-contain sm:h-[100px]"}
        width={1216}
        height={391}
      />
      <Tagline />
      {plan ? <PlanWordmark plan={plan} /> : null}
    </span>
  );
}

/** Two-line tagline sized to sit under the logo without crossing the wordmark. */
export function Tagline() {
  return (
    <span
      aria-hidden
      className="mt-0.5 flex w-full flex-col items-center gap-px text-[7px] font-semibold uppercase leading-none tracking-[0.42em] text-foreground/70 sm:text-[8px]"
    >
      <span className="w-full text-center">Scan Anything</span>
      <span className="w-full text-center">Know Everything</span>
    </span>
  );
}

export function PlanWordmark({ plan }: { plan: PlanType }) {
  const isMax = plan === "max";
  return (
    <span
      className="mt-1 inline-flex items-center gap-[0.35em] text-[10px] font-black uppercase leading-none tracking-[0.5em] sm:text-[11px]"
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
