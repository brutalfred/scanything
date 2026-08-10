import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { COLORS } from "../MainVideo";

export const PersistentBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Slow rotating gradient overlay.
  const rotation = interpolate(frame, [0, durationInFrames], [0, 90], {
    extrapolateRight: "clamp",
  });

  const gridY = interpolate(frame, [0, durationInFrames], [0, 200], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: `radial-gradient(circle at 70% 30%, rgba(201,168,76,0.08) 0%, transparent 50%),
                     radial-gradient(circle at 30% 70%, rgba(240,215,140,0.05) 0%, transparent 40%),
                     ${COLORS.bg}`,
        transform: `rotate(${rotation}deg) scale(1.5)`,
        transformOrigin: "center center",
      }}
    >
      {/* Perspective grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(to right, rgba(201,168,76,0.08) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(201,168,76,0.08) 1px, transparent 1px)
          `,
          backgroundSize: "120px 120px",
          transform: `perspective(800px) rotateX(60deg) translateY(${gridY}px) scale(2)`,
          transformOrigin: "center top",
          opacity: 0.35,
          maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 70%)",
        }}
      />
      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle, transparent 40%, rgba(0,0,0,0.7) 100%)",
        }}
      />
    </div>
  );
};
