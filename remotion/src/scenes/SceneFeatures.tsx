import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { COLORS, FONT_FAMILY } from "../MainVideo";

const FEATURES = [
  { title: "Room scan", desc: "Every object identified in one shot" },
  { title: "Price estimates", desc: "Live resale value ranges" },
  { title: "Document scan", desc: "Extract, translate, summarize" },
  { title: "One-tap resale", desc: "Listing drafts for eBay, Vinted & more" },
  { title: "Ask the AI", desc: "Chat about any scanned object" },
  { title: "Scan history", desc: "Searchable, saved, shareable" },
];

export const SceneFeatures: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleP = spring({ frame, fps, config: { damping: 20, stiffness: 110 } });

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        paddingLeft: 140,
        paddingRight: 140,
        gap: 54,
      }}
    >
      <div
        style={{
          fontFamily: FONT_FAMILY,
          fontSize: 64,
          fontWeight: 800,
          color: COLORS.white,
          opacity: titleP,
          transform: `translateY(${interpolate(titleP, [0, 1], [30, 0])}px)`,
          letterSpacing: "-1px",
        }}
      >
        Everything, <span style={{ color: COLORS.goldLight }}>in one app.</span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 28,
        }}
      >
        {FEATURES.map((f, i) => {
          const p = spring({
            frame: frame - 18 - i * 9,
            fps,
            config: { damping: 17, stiffness: 100 },
          });
          const opacity = interpolate(p, [0, 0.35], [0, 1], { extrapolateRight: "clamp" });
          const y = interpolate(p, [0, 1], [60, 0]);

          return (
            <div
              key={f.title}
              style={{
                background: "rgba(255,255,255,0.035)",
                border: "1px solid rgba(201,168,76,0.3)",
                borderRadius: 22,
                padding: "30px 28px",
                opacity,
                transform: `translateY(${y}px)`,
              }}
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  background: COLORS.gold,
                  boxShadow: "0 0 16px rgba(201,168,76,0.7)",
                  marginBottom: 18,
                }}
              />
              <div
                style={{
                  fontFamily: FONT_FAMILY,
                  fontSize: 32,
                  fontWeight: 700,
                  color: COLORS.goldLight,
                  marginBottom: 10,
                }}
              >
                {f.title}
              </div>
              <div
                style={{
                  fontFamily: FONT_FAMILY,
                  fontSize: 22,
                  fontWeight: 400,
                  color: "rgba(255,255,255,0.72)",
                  lineHeight: 1.35,
                }}
              >
                {f.desc}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
