import { useCallback, useEffect, useState } from "react";
import {
  getSoundVolume,
  isSoundMuted,
  playSound,
  setSoundMuted,
  setSoundVolume,
  SOUND_SETTINGS_EVENT,
  type SoundType,
} from "@/lib/sounds";

export function useSounds() {
  const [muted, setMutedState] = useState(false);
  const [volume, setVolumeState] = useState(1);

  // Hydrate from localStorage after mount (avoids SSR mismatch) and keep every
  // hook instance / tab in sync.
  useEffect(() => {
    const sync = () => {
      setMutedState(isSoundMuted());
      setVolumeState(getSoundVolume());
    };
    sync();
    window.addEventListener(SOUND_SETTINGS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SOUND_SETTINGS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggleMute = useCallback(() => {
    setSoundMuted(!isSoundMuted());
  }, []);

  const changeVolume = useCallback((next: number) => {
    setSoundVolume(next);
    // Unmute automatically when the user raises the volume.
    if (next > 0 && isSoundMuted()) setSoundMuted(false);
  }, []);

  const play = useCallback((type: SoundType) => {
    void playSound(type);
  }, []);

  return { muted, volume, toggleMute, setVolume: changeVolume, play };
}
