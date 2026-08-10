import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { staticFile, Img } from "remotion";
import { COLORS, FONT_FAMILY } from "../MainVideo";

export const Scene1: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame, fps, config: { damping: 18, stiffness: 120 } });
  const logoOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  const textOpacity = spring({ frame: frame - 35, fps, config: { damping: 20, stiffness: 100 } });
  const textY = interpolate(textOpacity, [0, 1], [40, 0]);

  const lineX = interpolate(frame, [50, 90], [-1920, 1920], { extrapolateRight: "clamp" });

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
      <Img
        src={staticFile("images/logo.png")}
        style={{
          width: 220,
          height: 220,
          objectFit: "contain",
          transform: `scale(${logoScale})`,
          opacity: logoOpacity,
          filter: "drop-shadow(0 0 40px rgba(201,168,76,0.35))",
        }}
      />
      <div
        style={{
          fontFamily: FONT_FAMILY,
          fontSize: 72,
          fontWeight: 700,
          color: COLORS.white,
          textAlign: "center",
          opacity: textOpacity,
          transform: `translateY(${textY}px)`,
          textShadow: "0 0 60px rgba(201,168,76,0.25)",
        }}
      >
        What are you looking at?
      </div>

      {/* Sweep line */}
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: lineX,
          width: 6,
          background: "linear-gradient(to right, transparent, #f0d78c, transparent)",
          opacity: 0.7,
          transform: "translateX(-50%)",
        }}
      />
    </AbsoluteFill>
  );
};
