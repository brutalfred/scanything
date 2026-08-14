import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { wipe } from "@remotion/transitions/wipe";
import { Scene1 } from "./scenes/Scene1";
import { Scene3 } from "./scenes/Scene3";
import { SceneFeatures } from "./scenes/SceneFeatures";
import { SceneLanguages } from "./scenes/SceneLanguages";
import { SceneNoAds } from "./scenes/SceneNoAds";
import { ScenePlatforms } from "./scenes/ScenePlatforms";
import { Scene5 } from "./scenes/Scene5";
import { PersistentBackground } from "./components/PersistentBackground";


loadFont("normal", { weights: ["400", "600", "800"], subsets: ["latin"] });

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "800"],
  subsets: ["latin"],
});

export const FONT_FAMILY = fontFamily;

export const COLORS = {
  bg: "#0a0a0a",
  gold: "#c9a84c",
  goldLight: "#f0d78c",
  white: "#ffffff",
  dim: "rgba(255,255,255,0.5)",
  subtle: "rgba(255,255,255,0.08)",
};

export const MainVideo: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        background: COLORS.bg,
        fontFamily,
        overflow: "hidden",
      }}
    >
      <PersistentBackground />

      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={80}>
          <Scene1 />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={wipe({ direction: "from-right" })}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: 20 })}
        />
        <TransitionSeries.Sequence durationInFrames={150}>
          <Scene3 />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={wipe({ direction: "from-left" })}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: 20 })}
        />
        <TransitionSeries.Sequence durationInFrames={140}>
          <SceneFeatures />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade({})}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: 20 })}
        />
        <TransitionSeries.Sequence durationInFrames={130}>
          <SceneLanguages />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={wipe({ direction: "from-bottom" })}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: 20 })}
        />
        <TransitionSeries.Sequence durationInFrames={120}>
          <SceneNoAds />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade({})}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: 20 })}
        />
        <TransitionSeries.Sequence durationInFrames={150}>
          <ScenePlatforms />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade({})}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: 20 })}
        />
        <TransitionSeries.Sequence durationInFrames={130}>
          <Scene5 />
        </TransitionSeries.Sequence>
      </TransitionSeries>

    </AbsoluteFill>
  );
};
