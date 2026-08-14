import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { COLORS, FONT_FAMILY } from "../MainVideo";

const LANGS = [
  "English",
  "Svenska",
  "Español",
  "Français",
  "Deutsch",
  "Italiano",
  "Português",
  "Polski",
  "Türkçe",
  "Nederlands",
  "Русский",
  "العربية",
  "हिन्दी",
  "ไทย",
  "中文",
  "日本語",
  "한국어",
  "Tiếng Việt",
];

export const SceneLanguages: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleP = spring({ frame, fps, config: { damping: 20, stiffness: 110 } });
  const drift = Math.sin(frame / 40) * 8;

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 48,
        paddingLeft: 160,
        paddingRight: 160,
      }}
    >
      <div
        style={{
          fontFamily: FONT_FAMILY,
          fontSize: 60,
          fontWeight: 800,
          color: COLORS.white,
          textAlign: "center",
          opacity: titleP,
          transform: `translateY(${interpolate(titleP, [0, 1], [26, 0])}px)`,
        }}
      >
        Scan and read in <span style={{ color: COLORS.goldLight }}>your language</span>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 18,
          justifyContent: "center",
          transform: `translateY(${drift}px)`,
        }}
      >
        {LANGS.map((l, i) => {
          const p = spring({
            frame: frame - 14 - i * 3.5,
            fps,
            config: { damping: 14, stiffness: 130 },
          });
          const opacity = interpolate(p, [0, 0.4], [0, 1], { extrapolateRight: "clamp" });
          const scale = interpolate(p, [0, 1], [0.75, 1]);

          return (
            <span
              key={l}
              style={{
                fontFamily: FONT_FAMILY,
                fontSize: 34,
                fontWeight: 600,
                color: i % 3 === 0 ? COLORS.goldLight : COLORS.white,
                border: "1px solid rgba(201,168,76,0.35)",
                borderRadius: 999,
                padding: "12px 26px",
                opacity,
                transform: `scale(${scale})`,
                background: "rgba(255,255,255,0.03)",
              }}
            >
              {l}
            </span>
          );
        })}
      </div>

      <div
        style={{
          fontFamily: FONT_FAMILY,
          fontSize: 28,
          fontWeight: 500,
          color: "rgba(255,255,255,0.6)",
          opacity: spring({ frame: frame - 80, fps, config: { damping: 20 } }),
        }}
      >
        Instant translation of any scanned document
      </div>
    </AbsoluteFill>
  );
};
