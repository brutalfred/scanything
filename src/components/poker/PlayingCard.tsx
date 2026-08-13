import { RANKS, SUIT_SYMBOL, cardRank, cardSuit, isRedCard } from "@/lib/poker";

export function PlayingCard({
  card,
  size = "md",
  faceDown = false,
}: {
  card?: number;
  size?: "sm" | "md";
  faceDown?: boolean;
}) {
  const dims =
    size === "sm" ? "h-11 w-8 text-[11px] rounded-md" : "h-16 w-11 text-sm rounded-lg";

  if (faceDown || card === undefined || card === null) {
    return (
      <div
        className={`${dims} flex items-center justify-center border border-current/40 bg-current/15 shadow-sm`}
        aria-label="Face-down card"
      >
        <span className="opacity-50">◈</span>
      </div>
    );
  }

  const red = isRedCard(card);
  return (
    <div
      className={`${dims} flex flex-col items-center justify-center border border-current/40 bg-background font-bold shadow-sm ${
        red ? "text-destructive" : "text-foreground"
      }`}
      aria-label={`${RANKS[cardRank(card)]} of ${cardSuit(card)}`}
    >
      <span className="leading-none">{RANKS[cardRank(card)]}</span>
      <span className="leading-none">{SUIT_SYMBOL[cardSuit(card)]}</span>
    </div>
  );
}
