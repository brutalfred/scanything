import { Coins } from "lucide-react";
import { cn } from "@/lib/utils";

export function CreditMeter({
  balance,
  loading,
  signedIn,
  onClick,
}: {
  balance: number;
  loading?: boolean;
  signedIn?: boolean;
  onClick?: () => void;
}) {
  const tone =
    balance <= 0
      ? "text-destructive border-destructive/50"
      : balance < 20
        ? "text-amber-400 border-amber-400/40"
        : "text-primary border-primary/40";

  return (
    <button
      type="button"
      disabled={!signedIn}
      onClick={signedIn ? onClick : undefined}
      aria-label={signedIn ? `Scan credits: ${balance}` : "Sign in to view credits"}
      className={cn(
        "flex items-center gap-1.5 rounded-full border bg-card/60 px-3 py-1.5 text-sm font-semibold tabular-nums backdrop-blur transition-colors",
        !signedIn && "cursor-default opacity-80",
        tone,
      )}
    >
      <Coins className="h-4 w-4" />
      {loading ? "…" : balance}
    </button>
  );
}

