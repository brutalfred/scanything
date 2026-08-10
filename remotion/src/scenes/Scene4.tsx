import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { COLORS, FONT_FAMILY } from "../MainVideo";

const PERSONAL = [
  "Identify objects",
  "Price estimates",
  "Sell on marketplaces",
  "Translate documents",
];

const BUSINESS = [
  "Inventory valuation",
  "Bulk resale drafts",
  "Listing copy in seconds",
  "Multi-region platforms",
];

export const Scene4: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = spring({ frame: frame - 10, fps, config: { damping: 20, stiffness: 100 } });

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 60,
      }}
    >
      <div
        style={{
          fontFamily: FONT_FAMILY,
          fontSize: 56,
          fontWeight: 700,
          color: COLORS.white,
          opacity: titleOpacity,
          textShadow: "0 0 40px rgba(201,168,76,0.2)",
        }}
      >
        Built for everyone.
      </div>

      <div
        style={{
          display: "flex",
          gap: 80,
          width: "80%",
        }}
      >
        <Card
          label="For you"
          items={PERSONAL}
          frame={frame}
          fps={fps}
          delay={30}
          align="left"
        />
        <Card
          label="For business"
          items={BUSINESS}
          frame={frame}
          fps={fps}
          delay={70}
          align="right"
        />
      </div>
    </AbsoluteFill>
  );
};

const Card: React.FC<{
  label: string;
  items: string[];
  frame: number;
  fps: number;
  delay: number;
  align: "left" | "right";
}> = ({ label, items, frame, fps, delay, align }) => {
  const cardProgress = spring({ frame: frame - delay, fps, config: { damping: 18, stiffness: 90 } });
  const y = interpolate(cardProgress, [0, 1], [80, 0]);
  const opacity = interpolate(cardProgress, [0, 0.3], [0, 1], { extrapolateRight: "clamp" });

  return (
    <div
      style={{
        flex: 1,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(201,168,76,0.35)",
        borderRadius: 28,
        padding: 44,
        opacity,
        transform: `translateY(${y}px)`,
        textAlign: align,
      }}
    >
      <div
        style={{
          fontFamily: FONT_FAMILY,
          fontSize: 36,
          fontWeight: 800,
          color: COLORS.goldLight,
          marginBottom: 32,
          letterSpacing: "-0.5px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 20,
          alignItems: align === "left" ? "flex-start" : "flex-end",
        }}
      >
        {items.map((item, i) => {
          const itemDelay = delay + 20 + i * 12;
          const itemProgress = spring({ frame: frame - itemDelay, fps, config: { damping: 20, stiffness: 100 } });
          const itemOpacity = interpolate(itemProgress, [0, 0.3], [0, 1], { extrapolateRight: "clamp" });
          const itemX = interpolate(itemProgress, [0, 1], [align === "left" ? -40 : 40, 0]);

          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                opacity: itemOpacity,
                transform: `translateX(${itemX}px)`,
                flexDirection: align === "left" ? "row" : "row-reverse",
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: COLORS.gold,
                  boxShadow: "0 0 12px rgba(201,168,76,0.6)",
                }}
              />
              <span
                style={{
                  fontFamily: FONT_FAMILY,
                  fontSize: 28,
                  fontWeight: 500,
                  color: COLORS.white,
                }}
              >
                {item}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
