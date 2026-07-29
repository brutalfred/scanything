import { Coins } from "lucide-react";
import { cn } from "@/lib/utils";

export function CreditMeter({
  balance,
  loading,
  onClick,
}: {
  balance: number;
  loading?: boolean;
  onClick: () => void;
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
      onClick={onClick}
      aria-label={`Scan credits: ${balance}`}
      className={cn(
        "flex items-center gap-1.5 rounded-full border bg-card/60 px-3 py-1.5 text-sm font-semibold tabular-nums backdrop-blur transition-colors",
        tone,
      )}
    >
      <Coins className="h-4 w-4" />
      {loading ? "…" : balance}
    </button>
  );
}
