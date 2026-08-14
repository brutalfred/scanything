import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { COLORS, FONT_FAMILY } from "../MainVideo";

export const SceneNoAds: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const p = spring({ frame: frame - 4, fps, config: { damping: 14, stiffness: 120 } });
  const scale = interpolate(p, [0, 1], [0.8, 1]);
  const strike = interpolate(frame, [26, 50], [0, 100], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const subP = spring({ frame: frame - 55, fps, config: { damping: 20, stiffness: 100 } });
  const noteP = spring({ frame: frame - 80, fps, config: { damping: 20, stiffness: 100 } });

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 40,
      }}
    >
      <div style={{ position: "relative", opacity: p, transform: `scale(${scale})` }}>
        <div
          style={{
            fontFamily: FONT_FAMILY,
            fontSize: 130,
            fontWeight: 800,
            color: "rgba(255,255,255,0.35)",
            letterSpacing: "-3px",
          }}
        >
          FORCED ADS
        </div>
        <div
          style={{
            position: "absolute",
            top: "52%",
            left: 0,
            width: `${strike}%`,
            height: 10,
            background: "linear-gradient(to right, #c9a84c, #f0d78c)",
            boxShadow: "0 0 30px rgba(240,215,140,0.7)",
            borderRadius: 6,
          }}
        />
      </div>

      <div
        style={{
          fontFamily: FONT_FAMILY,
          fontSize: 72,
          fontWeight: 800,
          color: COLORS.goldLight,
          opacity: subP,
          transform: `translateY(${interpolate(subP, [0, 1], [30, 0])}px)`,
          textShadow: "0 0 60px rgba(201,168,76,0.3)",
        }}
      >
        Never. Not once.
      </div>

      <div
        style={{
          fontFamily: FONT_FAMILY,
          fontSize: 30,
          fontWeight: 500,
          color: "rgba(255,255,255,0.7)",
          textAlign: "center",
          opacity: noteP,
          maxWidth: 1100,
          lineHeight: 1.4,
        }}
      >
        Watch an ad only if you want free credits. Otherwise the app never
        interrupts you.
      </div>
    </AbsoluteFill>
  );
};
