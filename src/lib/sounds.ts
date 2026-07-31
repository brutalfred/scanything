const MUTE_STORAGE_KEY = "scanything:sounds-muted";
const VOLUME_STORAGE_KEY = "scanything:sounds-volume";
export const SOUND_SETTINGS_EVENT = "scanything:sound-settings";

export type SoundType = "click" | "bubble" | "shutter" | "sweep" | "coin";

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
  applyMasterVolume();
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

/* ------------------------------------------------------------------ */
/* Web Audio engine                                                     */
/* ------------------------------------------------------------------ */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

// Overall headroom so the arcade blips never clip or startle.
const MASTER_TRIM = 0.35;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = getSoundVolume() * MASTER_TRIM;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
    master = null;
  }
  return ctx;
}

function applyMasterVolume() {
  if (!master || !ctx) return;
  master.gain.setTargetAtTime(getSoundVolume() * MASTER_TRIM, ctx.currentTime, 0.01);
}

function noiseBuffer(ac: AudioContext, seconds: number) {
  const length = Math.max(1, Math.floor(ac.sampleRate * seconds));
  const buffer = ac.createBuffer(1, length, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/** Bubbly arcade pop: rising sine blip with a fast decay. */
function playPop(ac: AudioContext, out: GainNode) {
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(440, t);
  osc.frequency.exponentialRampToValueAtTime(920, t + 0.06);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.9, t + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  osc.connect(gain).connect(out);
  osc.start(t);
  osc.stop(t + 0.14);

  // Slight detuned triangle layer for a plasticky bubble edge.
  const osc2 = ac.createOscillator();
  const gain2 = ac.createGain();
  osc2.type = "triangle";
  osc2.frequency.setValueAtTime(660, t);
  osc2.frequency.exponentialRampToValueAtTime(1380, t + 0.05);
  gain2.gain.setValueAtTime(0.0001, t);
  gain2.gain.exponentialRampToValueAtTime(0.25, t + 0.006);
  gain2.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  osc2.connect(gain2).connect(out);
  osc2.start(t);
  osc2.stop(t + 0.1);
}

/** Camera shutter: two mechanical clicks around a bandpassed noise burst. */
function playShutter(ac: AudioContext, out: GainNode) {
  const t = ac.currentTime;

  const click = (at: number, freq: number, level: number) => {
    const src = ac.createBufferSource();
    src.buffer = noiseBuffer(ac, 0.05);
    const bp = ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = freq;
    bp.Q.value = 3;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(level, at + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
    src.connect(bp).connect(g).connect(out);
    src.start(at);
    src.stop(at + 0.06);
  };

  click(t, 2400, 1);
  click(t + 0.085, 1600, 0.75);

  // Low mechanical thunk under the clicks.
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(180, t);
  osc.frequency.exponentialRampToValueAtTime(90, t + 0.1);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.18, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + 0.18);
}

/** Clean-house sweep: noise through a downward-sweeping lowpass. */
function playSweep(ac: AudioContext, out: GainNode) {
  const t = ac.currentTime;
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac, 0.6);
  const lp = ac.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(6000, t);
  lp.frequency.exponentialRampToValueAtTime(320, t + 0.5);
  lp.Q.value = 6;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.55, t + 0.06);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
  src.connect(lp).connect(g).connect(out);
  src.start(t);
  src.stop(t + 0.55);
}

/** Classic arcade coin: two square-wave notes, short then sustained. */
function playCoin(ac: AudioContext, out: GainNode) {
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(987.77, t); // B5
  osc.frequency.setValueAtTime(1318.51, t + 0.07); // E6
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.5, t + 0.01);
  g.gain.setValueAtTime(0.5, t + 0.22);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + 0.36);
}

export async function playSound(type: SoundType): Promise<void> {
  if (typeof window === "undefined") return;
  if (isSoundMuted() || getSoundVolume() <= 0) return;

  const ac = getCtx();
  if (!ac || !master) return;

  try {
    if (ac.state === "suspended") await ac.resume();
    applyMasterVolume();
    switch (type) {
      case "shutter":
        playShutter(ac, master);
        break;
      case "sweep":
        playSweep(ac, master);
        break;
      case "coin":
        playCoin(ac, master);
        break;
      case "click":
      case "bubble":
      default:
        playPop(ac, master);
        break;
    }
  } catch {
    /* audio is best-effort */
  }
}

/**
 * Plays the bubbly click for any button / link press, app-wide.
 * Add `data-no-sound` to an element to opt out.
 */
export function installGlobalClickSound(): () => void {
  if (typeof document === "undefined") return () => {};
  const handler = (e: Event) => {
    const target = e.target as HTMLElement | null;
    if (!target || typeof target.closest !== "function") return;
    const el = target.closest<HTMLElement>('button, [role="button"], a[href], summary');
    if (!el) return;
    if (el.closest("[data-no-sound]")) return;
    if (el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true") return;
    void playSound("click");
  };
  document.addEventListener("pointerdown", handler, true);
  return () => document.removeEventListener("pointerdown", handler, true);
}
