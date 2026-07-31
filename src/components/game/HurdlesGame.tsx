import { useCallback, useEffect, useRef, useState } from "react";
import { playSound } from "@/lib/sounds";

const TRACK_M = 110;
const FIRST_HURDLE_M = 13.72;
const HURDLE_GAP_M = 9.14;
const HURDLE_COUNT = 10;
const PX_PER_M = 26;

const HURDLES = Array.from(
  { length: HURDLE_COUNT },
  (_, i) => FIRST_HURDLE_M + i * HURDLE_GAP_M,
);

const ACCEL = 5.2; // m/s^2 while holding
const DECEL = 6.5; // m/s^2 while released
const MAX_SPEED = 11.5; // m/s
const JUMP_TIME = 0.52; // seconds airborne
const JUMP_HEIGHT = 52; // px
const HURDLE_HIT_PENALTY = 0.35; // seconds of stumble

type Phase = "idle" | "countdown" | "running" | "finished";

export function formatTime(ms: number) {
  return (ms / 1000).toFixed(2) + "s";
}

export function HurdlesGame({
  onFinish,
  submitting,
  resultLine,
}: {
  onFinish: (timeMs: number) => void;
  submitting: boolean;
  resultLine: string | null;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [countText, setCountText] = useState("");
  const [distance, setDistance] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [jumpY, setJumpY] = useState(0);
  const [stumbling, setStumbling] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [hits, setHits] = useState(0);
  const [falseStart, setFalseStart] = useState(false);

  const holding = useRef(false);
  const jumpUntil = useRef(0);
  const stumbleUntil = useRef(0);
  const cleared = useRef<Set<number>>(new Set());
  const raf = useRef<number | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const stopLoop = () => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
  };

  useEffect(() => () => {
    clearTimers();
    stopLoop();
  }, []);

  const runLoop = useCallback(() => {
    let last = performance.now();
    const start = last;
    let dist = 0;
    let spd = 0;

    const step = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      const airborne = now < jumpUntil.current;
      const stumble = now < stumbleUntil.current;

      if (stumble) {
        spd = Math.max(0, spd - DECEL * 2 * dt);
      } else if (holding.current) {
        spd = Math.min(MAX_SPEED, spd + ACCEL * dt);
      } else {
        spd = Math.max(0, spd - DECEL * dt);
      }

      const prev = dist;
      dist = Math.min(TRACK_M, dist + spd * dt);

      HURDLES.forEach((h, i) => {
        if (cleared.current.has(i)) return;
        if (prev < h && dist >= h) {
          cleared.current.add(i);
          if (!airborne) {
            stumbleUntil.current = now + HURDLE_HIT_PENALTY * 1000;
            setStumbling(true);
            setHits((n) => n + 1);
            setTimeout(() => setStumbling(false), HURDLE_HIT_PENALTY * 1000);
          }
        }
      });

      if (airborne) {
        const t = 1 - (jumpUntil.current - now) / (JUMP_TIME * 1000);
        setJumpY(Math.sin(Math.PI * t) * JUMP_HEIGHT);
      } else {
        setJumpY(0);
      }

      setDistance(dist);
      setSpeed(spd);
      setElapsed(now - start);

      if (dist >= TRACK_M) {
        stopLoop();
        const ms = Math.round(now - start);
        setElapsed(ms);
        setPhase("finished");
        void playSound("coin");
        onFinish(ms);
        return;
      }
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  }, [onFinish]);

  const startCountdown = useCallback(() => {
    clearTimers();
    stopLoop();
    cleared.current = new Set();
    jumpUntil.current = 0;
    stumbleUntil.current = 0;
    holding.current = false;
    setDistance(0);
    setElapsed(0);
    setSpeed(0);
    setJumpY(0);
    setHits(0);
    setFalseStart(false);
    setStumbling(false);
    setPhase("countdown");

    const seq: [string, number][] = [
      ["3", 0],
      ["2", 700],
      ["1", 1400],
      ["Ready…", 2100],
      ["Set…", 2800],
      ["GO!", 3600],
    ];
    seq.forEach(([text, delay]) => {
      timers.current.push(
        setTimeout(() => {
          setCountText(text);
          void playSound(text === "GO!" ? "shutter" : "bubble");
          if (text === "GO!") {
            setPhase("running");
            runLoop();
            timers.current.push(setTimeout(() => setCountText(""), 500));
          }
        }, delay),
      );
    });
  }, [runLoop]);

  const pressStart = () => {
    if (phase === "countdown") {
      clearTimers();
      stopLoop();
      setFalseStart(true);
      setCountText("");
      setPhase("idle");
      return;
    }
    if (phase !== "running") return;
    holding.current = true;
  };

  const pressEnd = () => {
    holding.current = false;
  };

  const jump = () => {
    if (phase !== "running") return;
    const now = performance.now();
    if (now < jumpUntil.current) return;
    jumpUntil.current = now + JUMP_TIME * 1000;
    void playSound("bubble");
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        jump();
      }
      if (e.code === "ArrowRight") holding.current = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "ArrowRight") holding.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  });

  const cameraPx = Math.max(0, distance * PX_PER_M - 90);
  const runnerLean = Math.min(18, speed * 1.6);

  return (
    <div className="select-none">
      <div className="mb-2 flex items-center justify-between text-xs font-semibold tabular-nums">
        <span className="opacity-70">{distance.toFixed(1)} / 110 m</span>
        <span className="text-base">{formatTime(elapsed)}</span>
        <span className="opacity-70">{hits} hits</span>
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-label="Hold to run"
        data-no-sound
        onPointerDown={pressStart}
        onPointerUp={pressEnd}
        onPointerLeave={pressEnd}
        onPointerCancel={pressEnd}
        className="relative h-40 w-full cursor-pointer overflow-hidden rounded-xl border border-current/30 bg-current/5 touch-none"
      >
        {/* sky/ground */}
        <div className="absolute inset-x-0 bottom-0 h-14 border-t border-current/30 bg-current/10" />

        {/* scrolling world */}
        <div
          className="absolute inset-y-0 left-0"
          style={{ transform: `translateX(${-cameraPx}px)`, willChange: "transform" }}
        >
          {/* lane markers */}
          {Array.from({ length: TRACK_M / 10 + 1 }, (_, i) => i * 10).map((m) => (
            <div
              key={m}
              className="absolute bottom-0 h-14 w-px bg-current/25"
              style={{ left: m * PX_PER_M }}
            >
              <span className="absolute -top-4 left-1 text-[9px] opacity-60">{m}m</span>
            </div>
          ))}

          {/* hurdles */}
          {HURDLES.map((m, i) => (
            <div
              key={i}
              className="absolute bottom-14 w-[3px] rounded-sm bg-current opacity-80"
              style={{ left: m * PX_PER_M, height: 30 }}
            >
              <span className="absolute -left-3 top-0 block h-[3px] w-8 rounded-sm bg-current" />
            </div>
          ))}

          {/* finish line */}
          <div
            className="absolute bottom-14 h-16 w-1 bg-current"
            style={{ left: TRACK_M * PX_PER_M }}
          >
            <span className="absolute -top-4 left-2 whitespace-nowrap text-[10px] font-bold">
              FINISH
            </span>
          </div>

          {/* runner */}
          <div
            className="absolute bottom-14"
            style={{
              left: distance * PX_PER_M,
              transform: `translate(-50%, ${-jumpY}px) rotate(${stumbling ? -12 : runnerLean * 0.3}deg)`,
              willChange: "transform",
            }}
          >
            <svg width="26" height="42" viewBox="0 0 26 42" className="fill-current">
              <circle cx="13" cy="6" r="5" />
              <rect x="10.5" y="11" width="5" height="16" rx="2.5" />
              <rect
                x="12"
                y="24"
                width="4"
                height="16"
                rx="2"
                transform={`rotate(${jumpY > 0 ? -35 : speed > 4 ? -18 : 0} 14 26)`}
              />
              <rect
                x="10"
                y="24"
                width="4"
                height="16"
                rx="2"
                transform={`rotate(${jumpY > 0 ? 30 : speed > 4 ? 20 : 0} 12 26)`}
              />
              <rect
                x="12"
                y="12"
                width="3.5"
                height="13"
                rx="1.75"
                transform={`rotate(${jumpY > 0 ? -55 : speed > 4 ? -30 : -5} 13 14)`}
              />
            </svg>
          </div>
        </div>

        {countText && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="text-4xl font-black drop-shadow">{countText}</span>
          </div>
        )}

        {phase === "idle" && !countText && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center text-xs">
            <span className="text-sm font-bold">110m Hurdles</span>
            <span className="mt-1 opacity-70">Hold the track to run · JUMP to clear hurdles</span>
            {falseStart && (
              <span className="mt-1 font-semibold text-destructive">False start! Try again.</span>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          data-no-sound
          onClick={startCountdown}
          className="flex-1 rounded-xl border border-current/30 bg-current/5 px-3 py-2 text-sm font-semibold transition-colors hover:bg-current/10"
        >
          {phase === "finished" || phase === "idle" ? "Start race" : "Restart"}
        </button>
        <button
          type="button"
          data-no-sound
          onPointerDown={(e) => {
            e.preventDefault();
            jump();
          }}
          className="flex-1 rounded-xl border border-current/40 bg-current/10 px-3 py-2 text-sm font-black uppercase tracking-wide transition-transform active:scale-95"
        >
          Jump
        </button>
      </div>

      <p className="mt-2 min-h-[1.25rem] text-center text-xs font-semibold">
        {submitting ? "Saving time…" : resultLine}
      </p>
    </div>
  );
}
