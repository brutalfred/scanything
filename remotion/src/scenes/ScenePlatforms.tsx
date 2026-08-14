import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { COLORS, FONT_FAMILY } from "../MainVideo";

const Badge: React.FC<{
  frame: number;
  fps: number;
  delay: number;
  label: string;
  sub: string;
  strong?: boolean;
}> = ({ frame, fps, delay, label, sub, strong }) => {
  const p = spring({ frame: frame - delay, fps, config: { damping: 16, stiffness: 110 } });
  const opacity = interpolate(p, [0, 0.35], [0, 1], { extrapolateRight: "clamp" });
  const y = interpolate(p, [0, 1], [55, 0]);

  return (
    <div
      style={{
        flex: 1,
        opacity,
        transform: `translateY(${y}px)`,
        border: `1px solid ${strong ? "rgba(201,168,76,0.7)" : "rgba(255,255,255,0.15)"}`,
        background: strong ? "rgba(201,168,76,0.08)" : "rgba(255,255,255,0.03)",
        borderRadius: 24,
        padding: "36px 34px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontFamily: FONT_FAMILY,
          fontSize: 40,
          fontWeight: 800,
          color: strong ? COLORS.goldLight : COLORS.white,
          marginBottom: 12,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: FONT_FAMILY,
          fontSize: 24,
          fontWeight: 500,
          color: "rgba(255,255,255,0.65)",
        }}
      >
        {sub}
      </div>
    </div>
  );
};

export const ScenePlatforms: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleP = spring({ frame, fps, config: { damping: 20, stiffness: 110 } });
  const socialP = spring({ frame: frame - 78, fps, config: { damping: 18, stiffness: 100 } });

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 56,
        paddingLeft: 150,
        paddingRight: 150,
      }}
    >
      <div
        style={{
          fontFamily: FONT_FAMILY,
          fontSize: 62,
          fontWeight: 800,
          color: COLORS.white,
          opacity: titleP,
          transform: `translateY(${interpolate(titleP, [0, 1], [28, 0])}px)`,
        }}
      >
        Coming to your phone
      </div>

      <div style={{ display: "flex", gap: 36, width: "100%" }}>
        <Badge
          frame={frame}
          fps={fps}
          delay={18}
          label="Google Play"
          sub="Coming soon"
          strong
        />
        <Badge frame={frame} fps={fps} delay={34} label="App Store" sub="iPhone version in the works" />
        <Badge frame={frame} fps={fps} delay={50} label="Web app" sub="scanything.app — live now" />
      </div>

      <div
        style={{
          display: "flex",
          gap: 24,
          alignItems: "center",
          opacity: socialP,
          transform: `translateY(${interpolate(socialP, [0, 1], [30, 0])}px)`,
        }}
      >
        <span
          style={{
            fontFamily: FONT_FAMILY,
            fontSize: 28,
            color: "rgba(255,255,255,0.6)",
          }}
        >
          Follow us on
        </span>
        {["Telegram", "X"].map((s) => (
          <span
            key={s}
            style={{
              fontFamily: FONT_FAMILY,
              fontSize: 32,
              fontWeight: 700,
              color: "#000",
              background: "linear-gradient(135deg, #f0d78c, #c9a84c)",
              padding: "12px 30px",
              borderRadius: 999,
              boxShadow: "0 0 40px rgba(201,168,76,0.3)",
            }}
          >
            {s}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};
