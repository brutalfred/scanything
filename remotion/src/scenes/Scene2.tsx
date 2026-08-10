import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { COLORS, FONT_FAMILY } from "../MainVideo";

const QUESTIONS = [
  "What's it worth?",
  "Where do I sell it?",
  "What does this document say?",
];

export const Scene2: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingLeft: 180,
        gap: 36,
      }}
    >
      {QUESTIONS.map((q, i) => {
        const delay = i * 20;
        const progress = spring({ frame: frame - 15 - delay, fps, config: { damping: 15, stiffness: 90 } });
        const x = interpolate(progress, [0, 1], [-120, 0]);
        const opacity = interpolate(progress, [0, 0.3, 1], [0, 1, 1], { extrapolateRight: "clamp" });
        const blur = interpolate(progress, [0, 1], [12, 0]);

        return (
          <div
            key={i}
            style={{
              fontFamily: FONT_FAMILY,
              fontSize: 64,
              fontWeight: 600,
              color: COLORS.white,
              opacity,
              transform: `translateX(${x}px)`,
              filter: `blur(${blur}px)`,
              textShadow: "0 0 40px rgba(201,168,76,0.15)",
              paddingLeft: 24,
              borderLeft: "4px solid #c9a84c",
            }}
          >
            {q}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
