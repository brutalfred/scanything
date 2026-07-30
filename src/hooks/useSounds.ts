import { useCallback, useEffect, useState } from "react";
import { playSound, type SoundType } from "@/lib/sounds";

const MUTE_STORAGE_KEY = "scanything:sounds-muted";

export function useSounds() {
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(MUTE_STORAGE_KEY);
    } catch {
      stored = null;
    }
    setMuted(stored === "true");
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(MUTE_STORAGE_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const play = useCallback((type: SoundType) => {
    void playSound(type);
  }, []);

  return { muted, toggleMute, play };
}

