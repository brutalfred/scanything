import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { staticFile, Img } from "remotion";
import { COLORS, FONT_FAMILY } from "../MainVideo";

export const Scene5: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame: frame - 10, fps, config: { damping: 18, stiffness: 100 } });
  const taglineOpacity = spring({ frame: frame - 50, fps, config: { damping: 20, stiffness: 100 } });
  const taglineY = interpolate(taglineOpacity, [0, 1], [30, 0]);

  const urlOpacity = spring({ frame: frame - 90, fps, config: { damping: 20, stiffness: 100 } });
  const urlScale = interpolate(urlOpacity, [0, 1], [0.9, 1]);

  const lineX = interpolate(frame, [100, 150], [-1920, 1920], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 48,
      }}
    >
      <Img
        src={staticFile("images/logo.png")}
        style={{
          width: 180,
          height: 180,
          objectFit: "contain",
          transform: `scale(${logoScale})`,
          filter: "drop-shadow(0 0 60px rgba(201,168,76,0.45))",
        }}
      />
      <div
        style={{
          fontFamily: FONT_FAMILY,
          fontSize: 80,
          fontWeight: 800,
          color: COLORS.white,
          textAlign: "center",
          opacity: taglineOpacity,
          transform: `translateY(${taglineY}px)`,
          textShadow: "0 0 60px rgba(201,168,76,0.25)",
        }}
      >
        Scan anything.
        <br />
        Know everything.
      </div>
      <div
        style={{
          fontFamily: FONT_FAMILY,
          fontSize: 44,
          fontWeight: 600,
          color: COLORS.goldLight,
          opacity: urlOpacity,
          transform: `scale(${urlScale})`,
          letterSpacing: "1px",
          textShadow: "0 0 40px rgba(201,168,76,0.3)",
        }}
      >
        scanything.app
      </div>

      {/* Final sweep line */}
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
