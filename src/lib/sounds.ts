const MUTE_STORAGE_KEY = "scanything:sounds-muted";

export type SoundType = "bubble" | "shutter" | "sweep";


let ctx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctx = (window as typeof window & { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
  }
  return ctx;
}

async function resumeIfNeeded(): Promise<boolean> {
  const c = getAudioContext();
  if (!c) return false;
  if (c.state === "suspended") {
    try {
      await c.resume();
    } catch {
      return false;
    }
  }
  return true;
}

export async function playBubblePop() {
  const c = getAudioContext();
  if (!c || !(await resumeIfNeeded())) return;
  const t = c.currentTime;

  const osc = c.createOscillator();
  const gain = c.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(880, t);
  osc.frequency.exponentialRampToValueAtTime(1760, t + 0.04);

  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.25, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.13);
}

export async function playCameraShutter() {
  const c = getAudioContext();
  if (!c || !(await resumeIfNeeded())) return;
  const t = c.currentTime;

  // Mechanical click: short low-frequency impulse
  const clickOsc = c.createOscillator();
  const clickGain = c.createGain();
  clickOsc.type = "square";
  clickOsc.frequency.setValueAtTime(150, t);
  clickGain.gain.setValueAtTime(0, t);
  clickGain.gain.linearRampToValueAtTime(0.25, t + 0.002);
  clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  clickOsc.connect(clickGain).connect(c.destination);
  clickOsc.start(t);
  clickOsc.stop(t + 0.07);

  // Shutter curtain noise: short filtered noise burst
  const bufferSize = c.sampleRate * 0.08;
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = c.createBufferSource();
  noise.buffer = buffer;

  const noiseFilter = c.createBiquadFilter();
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.setValueAtTime(2500, t);
  noiseFilter.Q.setValueAtTime(1, t);

  const noiseGain = c.createGain();
  noiseGain.gain.setValueAtTime(0, t);
  noiseGain.gain.linearRampToValueAtTime(0.2, t + 0.005);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

  noise.connect(noiseFilter).connect(noiseGain).connect(c.destination);
  noise.start(t);
  noise.stop(t + 0.09);
}

export async function playSweepClear() {
  const c = getAudioContext();
  if (!c || !(await resumeIfNeeded())) return;
  const t = c.currentTime;

  const bufferSize = c.sampleRate * 0.25;
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = c.createBufferSource();
  noise.buffer = buffer;

  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1800, t);
  filter.frequency.exponentialRampToValueAtTime(200, t + 0.25);
  filter.Q.setValueAtTime(0.5, t);

  const gain = c.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.2, t + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

  noise.connect(filter).connect(gain).connect(c.destination);
  noise.start(t);
  noise.stop(t + 0.26);
}

export async function playSound(type: SoundType) {
  switch (type) {
    case "bubble":
      await playBubblePop();
      break;
    case "shutter":
      await playCameraShutter();
      break;
    case "sweep":
      await playSweepClear();
      break;
  }
}
