import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { staticFile, Img } from "remotion";
import { COLORS, FONT_FAMILY } from "../MainVideo";

const ITEMS = [
  { name: "Vintage chair", price: "$80 - $140", top: 28, left: 12, width: 26, height: 34 },
  { name: "Sony headphones", price: "$120 - $180", top: 44, left: 58, width: 22, height: 18 },
  { name: "Coffee mug", price: "$8 - $18", top: 62, left: 38, width: 10, height: 12 },
];

export const Scene3: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const phoneScale = spring({ frame, fps, config: { damping: 22, stiffness: 100 } });
  const scanLineY = interpolate(frame, [30, 170], [20, 95], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "relative",
          width: 520,
          height: 920,
          borderRadius: 60,
          background: "#111",
          padding: 18,
          boxShadow: "0 60px 140px rgba(0,0,0,0.8), 0 0 0 2px rgba(201,168,76,0.25)",
          transform: `scale(${phoneScale})`,
        }}
      >
        {/* Screen */}
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            borderRadius: 46,
            background: "#000",
            overflow: "hidden",
          }}
        >
          {/* Camera view mockup */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 100%)",
            }}
          >
            {/* Shelf / room hint */}
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: "40%",
                background: "linear-gradient(to top, #1f1f1f, transparent)",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: "30%",
                left: "10%",
                width: "80%",
                height: 4,
                background: "rgba(201,168,76,0.15)",
                borderRadius: 2,
              }}
            />
            <div
              style={{
                position: "absolute",
                top: "55%",
                left: "5%",
                width: "90%",
                height: 4,
                background: "rgba(201,168,76,0.15)",
                borderRadius: 2,
              }}
            />
          </div>

          {/* Grid overlay */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `
                linear-gradient(to right, rgba(201,168,76,0.12) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(201,168,76,0.12) 1px, transparent 1px)
              `,
              backgroundSize: "40px 40px",
            }}
          />

          {/* Bounding boxes + labels */}
          {ITEMS.map((item, i) => {
            const delay = 20 + i * 18;
            const itemProgress = spring({ frame: frame - delay, fps, config: { damping: 16, stiffness: 110 } });
            const scale = interpolate(itemProgress, [0, 1], [0.85, 1]);
            const opacity = interpolate(itemProgress, [0, 0.4], [0, 1], { extrapolateRight: "clamp" });

            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  top: `${item.top}%`,
                  left: `${item.left}%`,
                  width: `${item.width}%`,
                  height: `${item.height}%`,
                  border: "2px solid #c9a84c",
                  borderRadius: 8,
                  boxShadow: "0 0 20px rgba(201,168,76,0.25), inset 0 0 20px rgba(201,168,76,0.05)",
                  opacity,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: -28,
                    left: 0,
                    background: "rgba(201,168,76,0.95)",
                    color: "#000",
                    fontFamily: FONT_FAMILY,
                    fontSize: 14,
                    fontWeight: 700,
                    padding: "6px 12px",
                    borderRadius: "6px 6px 6px 0",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.name}
                </div>
                <div
                  style={{
                    position: "absolute",
                    bottom: -22,
                    right: 0,
                    color: "#f0d78c",
                    fontFamily: FONT_FAMILY,
                    fontSize: 13,
                    fontWeight: 600,
                    padding: "4px 10px",
                    background: "rgba(0,0,0,0.65)",
                    borderRadius: "6px 0 6px 6px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.price}
                </div>
              </div>
            );
          })}

          {/* Info card popup */}
          <InfoCard frame={frame} fps={fps} />

          {/* Scan sweep line */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: `${scanLineY}%`,
              height: 3,
              background: "linear-gradient(to right, transparent, #f0d78c, transparent)",
              boxShadow: "0 0 24px rgba(240,215,140,0.6)",
              opacity: 0.8,
            }}
          />
        </div>
      </div>

      {/* Caption */}
      <div
        style={{
          position: "absolute",
          bottom: 90,
          fontFamily: FONT_FAMILY,
          fontSize: 36,
          fontWeight: 600,
          color: COLORS.white,
          opacity: spring({ frame: frame - 120, fps, config: { damping: 20, stiffness: 100 } }),
          textShadow: "0 0 40px rgba(201,168,76,0.2)",
        }}
      >
        Point. Tap. Know everything.
      </div>
    </AbsoluteFill>
  );
};

const InfoCard: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const progress = spring({ frame: frame - 90, fps, config: { damping: 18, stiffness: 90 } });
  const y = interpolate(progress, [0, 1], [60, 0]);
  const opacity = interpolate(progress, [0, 0.4], [0, 1], { extrapolateRight: "clamp" });

  return (
    <div
      style={{
        position: "absolute",
        bottom: 60,
        left: 30,
        right: 30,
        background: "rgba(10,10,10,0.92)",
        border: "1px solid rgba(201,168,76,0.5)",
        borderRadius: 20,
        padding: 24,
        opacity,
        transform: `translateY(${y}px)`,
        boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
      }}
    >
      <div
        style={{
          fontFamily: FONT_FAMILY,
          fontSize: 24,
          fontWeight: 700,
          color: COLORS.goldLight,
          marginBottom: 8,
        }}
      >
        Vintage chair
      </div>
      <div
        style={{
          fontFamily: FONT_FAMILY,
          fontSize: 16,
          color: COLORS.white,
          marginBottom: 16,
          lineHeight: 1.4,
        }}
      >
        Mid-century wooden frame with original upholstery. Estimated resale value: $80 - $140.
      </div>
      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        {["eBay", "Chairish", "1stDibs"].map((m) => (
          <span
            key={m}
            style={{
              fontFamily: FONT_FAMILY,
              fontSize: 13,
              fontWeight: 600,
              color: "#000",
              background: "#c9a84c",
              padding: "6px 12px",
              borderRadius: 6,
            }}
          >
            {m}
          </span>
        ))}
      </div>
    </div>
  );
};
