const MUTE_STORAGE_KEY = "scanything:sounds-muted";
const VOLUME_STORAGE_KEY = "scanything:sounds-volume";
export const SOUND_SETTINGS_EVENT = "scanything:sound-settings";

export type SoundType = "bubble" | "shutter" | "sweep";

function clampVolume(n: number) {
  if (!Number.isFinite(n)) return 1;
  return Math.max(0, Math.min(1, n));
}

export function isSoundMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MUTE_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function getSoundVolume(): number {
  if (typeof window === "undefined") return 1;
  try {
    const raw = window.localStorage.getItem(VOLUME_STORAGE_KEY);
    if (raw === null) return 1;
    return clampVolume(Number(raw));
  } catch {
    return 1;
  }
}

function notifyChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SOUND_SETTINGS_EVENT));
}

export function setSoundMuted(muted: boolean) {
  try {
    window.localStorage.setItem(MUTE_STORAGE_KEY, String(muted));
  } catch {
    /* ignore */
  }
  notifyChange();
}

export function setSoundVolume(volume: number) {
  const v = clampVolume(volume);
  try {
    window.localStorage.setItem(VOLUME_STORAGE_KEY, String(v));
  } catch {
    /* ignore */
  }
  notifyChange();
}

/**
 * Sound playback is currently disabled — no audio is produced.
 * The mute toggle and volume preference are kept so new sounds can be
 * plugged in later without touching any call sites.
 */
export async function playSound(_type: SoundType): Promise<void> {
  return;
}
