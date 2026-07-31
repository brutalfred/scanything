const MUTE_STORAGE_KEY = "scanything:sounds-muted";
const VOLUME_STORAGE_KEY = "scanything:sounds-volume";
export const SOUND_SETTINGS_EVENT = "scanything:sound-settings";

export type SoundType =
  | "click"
  | "bubble"
  | "shutter"
  | "sweep"
  | "coin"
  | "beepLow"
  | "beepHigh"
  | "pistol"
  | "champagne"
  | "cheer"
  | "aww";

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


/** Short countdown beep (low = 3/2/1, high = ready/set). */
function playBeep(ac: AudioContext, out: GainNode, freq: number) {
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
  g.gain.setValueAtTime(0.35, t + 0.1);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + 0.2);
}

/** Starter pistol: sharp noise crack with a short slap-back tail. */
function playPistol(ac: AudioContext, out: GainNode) {
  const t = ac.currentTime;

  const crack = ac.createBufferSource();
  crack.buffer = noiseBuffer(ac, 0.25);
  const hp = ac.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.setValueAtTime(1200, t);
  hp.frequency.exponentialRampToValueAtTime(400, t + 0.2);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(1, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  crack.connect(hp).connect(g).connect(out);
  crack.start(t);
  crack.stop(t + 0.25);

  // low body thump
  const osc = ac.createOscillator();
  const g2 = ac.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(150, t);
  osc.frequency.exponentialRampToValueAtTime(50, t + 0.12);
  g2.gain.setValueAtTime(0.0001, t);
  g2.gain.exponentialRampToValueAtTime(0.5, t + 0.006);
  g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  osc.connect(g2).connect(out);
  osc.start(t);
  osc.stop(t + 0.18);
}

/** Champagne: hollow cork pop followed by a soft fizz tail. */
function playChampagne(ac: AudioContext, out: GainNode) {
  const t = ac.currentTime;

  // cork pop — fast pitch drop through a resonant bandpass
  const osc = ac.createOscillator();
  const bp = ac.createBiquadFilter();
  const g = ac.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(900, t);
  osc.frequency.exponentialRampToValueAtTime(180, t + 0.07);
  bp.type = "bandpass";
  bp.frequency.value = 700;
  bp.Q.value = 2;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(1, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
  osc.connect(bp).connect(g).connect(out);
  osc.start(t);
  osc.stop(t + 0.16);

  // fizz tail
  const fizz = ac.createBufferSource();
  fizz.buffer = noiseBuffer(ac, 1.4);
  const hp = ac.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 3800;
  const fg = ac.createGain();
  fg.gain.setValueAtTime(0.0001, t + 0.05);
  fg.gain.exponentialRampToValueAtTime(0.22, t + 0.14);
  fg.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
  fizz.connect(hp).connect(fg).connect(out);
  fizz.start(t + 0.05);
  fizz.stop(t + 1.4);
}

/** One-shot crowd roar (used on GO and at the finish line). */
function playCheer(ac: AudioContext, out: GainNode) {
  const t = ac.currentTime;
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac, 2.2);
  const bp = ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(700, t);
  bp.frequency.linearRampToValueAtTime(1600, t + 0.5);
  bp.frequency.linearRampToValueAtTime(900, t + 2);
  bp.Q.value = 0.7;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.5, t + 0.35);
  g.gain.setValueAtTime(0.5, t + 0.9);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 2.1);
  src.connect(bp).connect(g).connect(out);
  src.start(t);
  src.stop(t + 2.2);
}

/** Disappointed crowd "aww": a descending muffled swell. */
function playAww(ac: AudioContext, out: GainNode) {
  const t = ac.currentTime;
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac, 1.3);
  const lp = ac.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(1100, t);
  lp.frequency.exponentialRampToValueAtTime(320, t + 1.1);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.4, t + 0.18);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
  src.connect(lp).connect(g).connect(out);
  src.start(t);
  src.stop(t + 1.3);
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
      case "beepLow":
        playBeep(ac, master, 440);
        break;
      case "beepHigh":
        playBeep(ac, master, 720);
        break;
      case "pistol":
        playPistol(ac, master);
        break;
      case "champagne":
        playChampagne(ac, master);
        break;
      case "cheer":
        playCheer(ac, master);
        break;
      case "aww":
        playAww(ac, master);
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

/* ------------------------------------------------------------------ */
/* Continuous crowd ambience (stadium murmur)                           */
/* ------------------------------------------------------------------ */

type CrowdGraph = {
  source: AudioBufferSourceNode;
  gain: GainNode;
  lfo: OscillatorNode;
  filter: BiquadFilterNode;
};

let crowd: CrowdGraph | null = null;
let crowdWanted = false;
let crowdIntensity = 0;

const CROWD_BASE = 0.05;
const CROWD_RANGE = 0.16;

function buildCrowd(ac: AudioContext, out: GainNode): CrowdGraph {
  const source = ac.createBufferSource();
  source.buffer = noiseBuffer(ac, 4);
  source.loop = true;

  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 800;
  filter.Q.value = 0.6;

  const gain = ac.createGain();
  gain.gain.value = 0.0001;

  // slow wobble so the murmur breathes instead of hissing flatly
  const lfo = ac.createOscillator();
  const lfoGain = ac.createGain();
  lfo.type = "sine";
  lfo.frequency.value = 0.28;
  lfoGain.gain.value = 260;
  lfo.connect(lfoGain).connect(filter.frequency);

  source.connect(filter).connect(gain).connect(out);
  source.start();
  lfo.start();

  return { source, gain, lfo, filter };
}

function crowdTarget() {
  return CROWD_BASE + CROWD_RANGE * Math.max(0, Math.min(1, crowdIntensity));
}

/** Fades the stadium murmur in. Safe to call repeatedly. */
export function startCrowdAmbience() {
  crowdWanted = true;
  if (isSoundMuted() || getSoundVolume() <= 0) return;
  const ac = getCtx();
  if (!ac || !master) return;
  if (ac.state === "suspended") void ac.resume();
  if (!crowd) crowd = buildCrowd(ac, master);
  crowd.gain.gain.cancelScheduledValues(ac.currentTime);
  crowd.gain.gain.setTargetAtTime(crowdTarget(), ac.currentTime, 0.6);
}

/** 0..1 — how excited the crowd is (drives volume + brightness). */
export function setCrowdIntensity(value: number) {
  crowdIntensity = Math.max(0, Math.min(1, value));
  if (!crowd || !ctx) return;
  crowd.gain.gain.setTargetAtTime(crowdTarget(), ctx.currentTime, 0.25);
  crowd.filter.frequency.setTargetAtTime(700 + crowdIntensity * 700, ctx.currentTime, 0.3);
}

/** Short burst of extra noise, e.g. when an obstacle is cleared. */
export function swellCrowd(amount = 0.35, seconds = 0.7) {
  if (!crowd || !ctx) return;
  const t = ctx.currentTime;
  const peak = Math.min(0.45, crowdTarget() + amount);
  crowd.gain.gain.cancelScheduledValues(t);
  crowd.gain.gain.setTargetAtTime(peak, t, 0.05);
  crowd.gain.gain.setTargetAtTime(crowdTarget(), t + seconds, 0.3);
}

/** Fades out and tears down the ambience graph. */
export function stopCrowdAmbience(immediate = false) {
  crowdWanted = false;
  crowdIntensity = 0;
  const graph = crowd;
  if (!graph || !ctx) {
    crowd = null;
    return;
  }
  crowd = null;
  const t = ctx.currentTime;
  const fade = immediate ? 0.03 : 0.5;
  try {
    graph.gain.gain.cancelScheduledValues(t);
    graph.gain.gain.setTargetAtTime(0.0001, t, fade / 3);
  } catch {
    /* ignore */
  }
  window.setTimeout(() => {
    try {
      graph.source.stop();
      graph.lfo.stop();
      graph.source.disconnect();
      graph.lfo.disconnect();
      graph.filter.disconnect();
      graph.gain.disconnect();
    } catch {
      /* ignore */
    }
  }, fade * 1000 + 80);
}

if (typeof window !== "undefined") {
  window.addEventListener(SOUND_SETTINGS_EVENT, () => {
    const silent = isSoundMuted() || getSoundVolume() <= 0;
    if (silent && crowd) {
      const wanted = crowdWanted;
      stopCrowdAmbience(true);
      crowdWanted = wanted; // remember so unmuting resumes it
    } else if (!silent && crowdWanted && !crowd) {
      startCrowdAmbience();
    }
  });
}
