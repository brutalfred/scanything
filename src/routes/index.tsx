import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  Loader2,
  RefreshCw,
  X,
  ExternalLink,
  Sparkles,
  Video,
  Image as ImageIcon,
  Pause,
  Play,
} from "lucide-react";
import {
  analyzeRoom,
  quickScan,
  enrichItem,
  type DetectedItem,
  type QuickItem,
} from "@/lib/analyze-room.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RoomScan — AI camera room analyzer" },
      {
        name: "description",
        content:
          "Point your camera at a room. AI identifies every object bigger than an apple with prices and info.",
      },
      { property: "og:title", content: "RoomScan — AI camera room analyzer" },
      {
        property: "og:description",
        content: "Identify everything in your room instantly with AI.",
      },
    ],
  }),
  component: Index,
});

type Phase = "camera" | "analyzing" | "results";
type Mode = "photo" | "video";

type Enrichment = Omit<DetectedItem, "box" | "name">;

type TrackedItem = {
  id: string;
  name: string;
  box: { x: number; y: number; w: number; h: number };
  enrichment?: Enrichment;
  enriching?: boolean;
  firstSeen: number;
  lastSeen: number;
};

const MAX_TRACKED = 10;
const STALE_MS = 6000;

function normName(n: string) {
  return n.toLowerCase().trim();
}
function centerDist(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) {
  const ax = a.x + a.w / 2;
  const ay = a.y + a.h / 2;
  const bx = b.x + b.w / 2;
  const by = b.y + b.h / 2;
  return Math.hypot(ax - bx, ay - by);
}
function distFromCenter(b: { x: number; y: number; w: number; h: number }) {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  return Math.hypot(cx - 0.5, cy - 0.5);
}

function Index() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [mode, setMode] = useState<Mode>("photo");
  const [phase, setPhase] = useState<Phase>("camera");
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [items, setItems] = useState<DetectedItem[]>([]);
  const [selected, setSelected] = useState<TrackedItem | DetectedItem | null>(null);

  // Video mode state
  const [tracked, setTracked] = useState<TrackedItem[]>([]);
  const trackedRef = useRef<TrackedItem[]>([]);
  const [videoPaused, setVideoPaused] = useState(false);
  const scanningRef = useRef(false);
  const pausedRef = useRef(false);
  const modeRef = useRef<Mode>("photo");
  const enrichingIdsRef = useRef<Set<string>>(new Set());
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    pausedRef.current = videoPaused || !!selected;
  }, [videoPaused, selected]);
  useEffect(() => {
    trackedRef.current = tracked;
  }, [tracked]);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 1280 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? `Camera access denied: ${e.message}`
          : "Could not access camera.",
      );
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (phase === "camera") {
      void startCamera();
    }
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const grabFrame = useCallback((maxDim = 1024, quality = 0.8): string | null => {
    const video = videoRef.current;
    if (!video) return null;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return null;
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, maxDim / Math.max(w, h));
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", quality);
  }, []);

  const capture = useCallback(async () => {
    const dataUrl = grabFrame(1024, 0.8);
    if (!dataUrl) return;
    setSnapshot(dataUrl);
    stopCamera();
    setPhase("analyzing");
    setError(null);
    try {
      const result = await analyzeRoom({ data: { imageBase64: dataUrl } });
      setItems(result.items);
      setPhase("results");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed.");
      setPhase("results");
    }
  }, [grabFrame, stopCamera]);

  // Merge quickScan detections into tracked state
  const mergeDetections = useCallback((detections: QuickItem[]) => {
    setTracked((prev) => {
      const now = Date.now();
      const next = prev.map((t) => ({ ...t }));
      const usedIdx = new Set<number>();

      for (const det of detections) {
        const dn = normName(det.name);
        let bestIdx = -1;
        let bestDist = Infinity;
        for (let i = 0; i < next.length; i++) {
          if (usedIdx.has(i)) continue;
          const t = next[i];
          if (normName(t.name) !== dn) continue;
          const d = centerDist(t.box, det.box);
          if (d < bestDist) {
            bestDist = d;
            bestIdx = i;
          }
        }
        // fallback: nearest box regardless of name if very close
        if (bestIdx === -1) {
          for (let i = 0; i < next.length; i++) {
            if (usedIdx.has(i)) continue;
            const d = centerDist(next[i].box, det.box);
            if (d < 0.08 && d < bestDist) {
              bestDist = d;
              bestIdx = i;
            }
          }
        }
        if (bestIdx >= 0) {
          usedIdx.add(bestIdx);
          next[bestIdx].box = det.box;
          next[bestIdx].lastSeen = now;
          // keep original name (already enriched maybe)
        } else {
          next.push({
            id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
            name: det.name,
            box: det.box,
            firstSeen: now,
            lastSeen: now,
          });
        }
      }

      // prune stale
      const fresh = next.filter((t) => now - t.lastSeen < STALE_MS);
      // keep 10 nearest to center
      fresh.sort((a, b) => distFromCenter(a.box) - distFromCenter(b.box));
      return fresh.slice(0, MAX_TRACKED);
    });
  }, []);

  // Video-mode quick-scan loop
  useEffect(() => {
    if (mode !== "video" || phase !== "camera") return;
    let cancelled = false;

    const loop = async () => {
      while (!cancelled && modeRef.current === "video") {
        if (pausedRef.current || scanningRef.current) {
          await new Promise((r) => setTimeout(r, 200));
          continue;
        }
        const frame = grabFrame(512, 0.6);
        if (!frame) {
          await new Promise((r) => setTimeout(r, 300));
          continue;
        }
        scanningRef.current = true;
        setScanning(true);
        try {
          const result = await quickScan({ data: { imageBase64: frame } });
          if (!cancelled && modeRef.current === "video") {
            mergeDetections(result.items);
            setError(null);
          }
        } catch (e) {
          if (!cancelled) setError(e instanceof Error ? e.message : "Scan failed.");
        } finally {
          scanningRef.current = false;
          setScanning(false);
        }
        await new Promise((r) => setTimeout(r, 400));
      }
    };
    void loop();
    return () => {
      cancelled = true;
    };
  }, [mode, phase, grabFrame, mergeDetections]);

  // Background enrichment loop — one item at a time
  useEffect(() => {
    if (mode !== "video" || phase !== "camera") return;
    let cancelled = false;

    const loop = async () => {
      while (!cancelled && modeRef.current === "video") {
        const target = trackedRef.current.find(
          (t) => !t.enrichment && !enrichingIdsRef.current.has(t.id),
        );
        if (!target || pausedRef.current) {
          await new Promise((r) => setTimeout(r, 500));
          continue;
        }
        const frame = grabFrame(640, 0.7);
        if (!frame) {
          await new Promise((r) => setTimeout(r, 400));
          continue;
        }
        enrichingIdsRef.current.add(target.id);
        try {
          const enrichment = await enrichItem({
            data: { name: target.name, imageBase64: frame },
          });
          if (!cancelled) {
            setTracked((prev) =>
              prev.map((t) => (t.id === target.id ? { ...t, enrichment } : t)),
            );
          }
        } catch {
          // silent — try next tick
        } finally {
          enrichingIdsRef.current.delete(target.id);
        }
        await new Promise((r) => setTimeout(r, 300));
      }
    };
    void loop();
    return () => {
      cancelled = true;
    };
  }, [mode, phase, grabFrame]);

  const reset = useCallback(() => {
    setSnapshot(null);
    setItems([]);
    setSelected(null);
    setError(null);
    setTracked([]);
    setVideoPaused(false);
    setPhase("camera");
  }, []);

  const switchMode = useCallback((m: Mode) => {
    setMode(m);
    setTracked([]);
    setVideoPaused(false);
    setError(null);
  }, []);

  // Door handling
  const [doorPrompt, setDoorPrompt] = useState<{ item: TrackedItem | DetectedItem } | null>(null);
  const [addressInput, setAddressInput] = useState("");

  const openAddressSearch = useCallback((address: string) => {
    const url = `https://www.google.com/search?q=${encodeURIComponent(address)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  const openItem = useCallback(
    (item: TrackedItem | DetectedItem) => {
      const isDoor = /\bdoor(way|s)?\b/i.test(item.name);
      if (isDoor) {
        const saved =
          typeof window !== "undefined" ? window.localStorage.getItem("roomscan:address") : null;
        if (saved && saved.trim()) {
          openAddressSearch(saved.trim());
        } else {
          setAddressInput("");
          setDoorPrompt({ item });
        }
        return;
      }
      setSelected(item);
    },
    [openAddressSearch],
  );

  const openTracked = useCallback((t: TrackedItem) => openItem(t), [openItem]);

  const submitAddress = useCallback(
    (remember: boolean) => {
      const addr = addressInput.trim();
      if (!addr) return;
      if (remember && typeof window !== "undefined") {
        window.localStorage.setItem("roomscan:address", addr);
      }
      setDoorPrompt(null);
      openAddressSearch(addr);
    },
    [addressInput, openAddressSearch],
  );


  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-sm font-semibold leading-tight">RoomScan</h1>
              <p className="text-[11px] leading-tight text-muted-foreground">
                AI room analyzer
              </p>
            </div>
          </div>
          {phase === "results" && (
            <Button size="sm" variant="secondary" onClick={reset}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              New scan
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-4">
        {phase === "camera" && (
          <div className="space-y-3">
            {/* Mode toggle */}
            <div className="flex justify-center">
              <div className="inline-flex rounded-full border border-border bg-secondary p-1">
                <button
                  onClick={() => switchMode("photo")}
                  className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                    mode === "photo"
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                  Photo
                </button>
                <button
                  onClick={() => switchMode("video")}
                  className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                    mode === "video"
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Video className="h-3.5 w-3.5" />
                  Live video
                </button>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-border bg-black aspect-[3/4] sm:aspect-video">
              <video
                ref={videoRef}
                playsInline
                muted
                className="absolute inset-0 h-full w-full object-cover"
              />

              {/* Live overlay boxes (video mode) */}
              {mode === "video" &&
                tracked.map((it) => (
                  <button
                    key={it.id}
                    onClick={() => openTracked(it)}
                    className="group absolute rounded border border-emerald-400 bg-emerald-400/10 shadow-[0_0_0_1px_rgba(0,0,0,0.35)] transition-[left,top,width,height,background-color] duration-300 ease-out hover:bg-emerald-400/25 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    style={{
                      left: `${it.box.x * 100}%`,
                      top: `${it.box.y * 100}%`,
                      width: `${it.box.w * 100}%`,
                      height: `${it.box.h * 100}%`,
                    }}
                  >
                    <span className="absolute -top-4 left-0 max-w-full truncate rounded bg-emerald-500 px-1 py-[1px] text-[9px] font-medium leading-tight text-white shadow">
                      {it.name}
                      {it.enrichment && (
                        <span className="ml-1 opacity-90">
                          ${it.enrichment.priceMin}–${it.enrichment.priceMax}
                        </span>
                      )}
                    </span>
                  </button>
                ))}

              {/* Center focus reticle (video mode) */}
              {mode === "video" && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-1 w-1 rounded-full bg-white/50 shadow-[0_0_0_3px_rgba(255,255,255,0.15)]" />
                </div>
              )}

              {/* Video mode status pill */}
              {mode === "video" && (
                <div className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      videoPaused
                        ? "bg-yellow-400"
                        : scanning
                          ? "bg-emerald-400 animate-pulse"
                          : "bg-emerald-400"
                    }`}
                  />
                  {videoPaused ? "Paused" : scanning ? "Scanning…" : "Live"}
                </div>
              )}

              {error && (
                <div className="absolute inset-x-2 bottom-2 rounded-md bg-black/80 p-2 text-center text-xs text-white">
                  {error}
                </div>
              )}
            </div>

            {mode === "photo" ? (
              <div className="flex flex-col items-center gap-2">
                <Button size="lg" onClick={capture} className="w-full max-w-xs">
                  <Camera className="mr-2 h-5 w-5" />
                  Scan the room
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Point at a room and tap. AI finds every item bigger than an apple.
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-col items-center gap-2">
                  <Button
                    size="lg"
                    variant="secondary"
                    onClick={() => setVideoPaused((p) => !p)}
                    className="w-full max-w-xs"
                  >
                    {videoPaused ? (
                      <>
                        <Play className="mr-2 h-5 w-5" />
                        Resume scanning
                      </>
                    ) : (
                      <>
                        <Pause className="mr-2 h-5 w-5" />
                        Pause scanning
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Green boxes track items near the center. Tap any item to see details.
                  </p>
                </div>

                {/* Live list below camera */}
                <div className="rounded-2xl border border-border bg-card">
                  <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
                    <h2 className="text-xs font-semibold text-muted-foreground">
                      Detected in view ({tracked.length}/{MAX_TRACKED})
                    </h2>
                    {scanning && (
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  {tracked.length === 0 ? (
                    <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                      Point the camera at objects…
                    </div>
                  ) : (
                    <ul className="divide-y divide-border/60">
                      {tracked.map((it) => (
                        <li key={it.id}>
                          <button
                            onClick={() => openTracked(it)}
                            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-accent"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium">
                                {it.name}
                              </div>
                              {it.enrichment ? (
                                <div className="truncate text-[11px] capitalize text-muted-foreground">
                                  {it.enrichment.category}
                                </div>
                              ) : (
                                <div className="text-[11px] text-muted-foreground">
                                  analyzing…
                                </div>
                              )}
                            </div>
                            {it.enrichment ? (
                              <div className="shrink-0 text-xs font-semibold text-primary">
                                ${it.enrichment.priceMin}–${it.enrichment.priceMax}
                              </div>
                            ) : (
                              <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {(phase === "analyzing" || phase === "results") && snapshot && (
          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-2xl border border-border bg-black">
              <img
                src={snapshot}
                alt="Captured room"
                className="block h-auto w-full"
              />
              {phase === "analyzing" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 text-white">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <p className="text-sm">Analyzing room…</p>
                </div>
              )}
              {phase === "results" &&
                items.map((it, i) => (
                  <button
                    key={i}
                    onClick={() => openItem(it)}
                    className="group absolute rounded-md border-2 border-primary/80 bg-primary/10 transition-all hover:bg-primary/25 focus:outline-none focus:ring-2 focus:ring-primary"
                    style={{
                      left: `${it.box.x * 100}%`,
                      top: `${it.box.y * 100}%`,
                      width: `${it.box.w * 100}%`,
                      height: `${it.box.h * 100}%`,
                    }}
                  >
                    <span className="absolute -top-6 left-0 max-w-full truncate rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground shadow">
                      {it.name}
                    </span>
                  </button>
                ))}
            </div>

            {error && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {phase === "results" && items.length > 0 && (
              <div>
                <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
                  {items.length} item{items.length === 1 ? "" : "s"} detected — tap to explore
                </h2>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {items.map((it, i) => (
                    <button
                      key={i}
                      onClick={() => openItem(it)}
                      className="rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary hover:bg-accent"
                    >
                      <div className="text-sm font-medium">{it.name}</div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {it.category}
                      </div>
                      <div className="mt-1 text-xs font-medium text-primary">
                        ${it.priceMin}–${it.priceMax}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {phase === "results" && items.length === 0 && !error && (
              <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
                No items detected. Try a clearer photo.
              </div>
            )}
          </div>
        )}
      </main>

      {selected && <DetailPanel item={selected} onClose={() => setSelected(null)} />}

      {doorPrompt && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
          onClick={() => setDoorPrompt(null)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl border border-border bg-card p-5 shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">Which address is this?</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  You scanned a door. Enter the address to look it up on the web.
                </p>
              </div>
              <button
                onClick={() => setDoorPrompt(null)}
                className="rounded-full p-1 text-muted-foreground hover:bg-accent"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitAddress(true);
              }}
              className="mt-4 space-y-3"
            >
              <input
                autoFocus
                type="text"
                inputMode="text"
                value={addressInput}
                onChange={(e) => setAddressInput(e.target.value)}
                placeholder="e.g. 1600 Pennsylvania Ave NW, Washington, DC"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="submit" className="flex-1" disabled={!addressInput.trim()}>
                  Save & search
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  disabled={!addressInput.trim()}
                  onClick={() => submitAddress(false)}
                >
                  Search once
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Saved locally on this device so future door scans open instantly.
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailPanel({
  item,
  onClose,
}: {
  item: TrackedItem | DetectedItem;
  onClose: () => void;
}) {
  const isTracked = (i: TrackedItem | DetectedItem): i is TrackedItem =>
    (i as TrackedItem).id !== undefined;

  const name = item.name;
  const enrichment: Enrichment | undefined = isTracked(item)
    ? item.enrichment
    : {
        category: item.category,
        description: item.description,
        priceMin: item.priceMin,
        priceMax: item.priceMax,
        currency: item.currency,
        searchUrl: item.searchUrl,
        infoUrl: item.infoUrl,
      };

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-2xl border border-border bg-card p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">{name}</h3>
            {enrichment ? (
              <p className="text-xs capitalize text-muted-foreground">
                {enrichment.category}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Analyzing details…</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground hover:bg-accent"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {enrichment ? (
          <>
            <p className="mt-3 text-sm leading-relaxed">{enrichment.description}</p>

            <div className="mt-4 rounded-lg bg-secondary p-3">
              <div className="text-xs font-medium text-muted-foreground">
                Estimated price range
              </div>
              <div className="text-xl font-semibold text-foreground">
                ${enrichment.priceMin}
                <span className="text-muted-foreground"> – </span>${enrichment.priceMax}
                <span className="ml-1 text-xs text-muted-foreground">
                  {enrichment.currency}
                </span>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <a
                href={enrichment.searchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
              >
                Shop this item
                <ExternalLink className="h-4 w-4 opacity-60" />
              </a>
              <a
                href={enrichment.infoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
              >
                Learn more
                <ExternalLink className="h-4 w-4 opacity-60" />
              </a>
            </div>
          </>
        ) : (
          <div className="mt-6 flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading details…
          </div>
        )}
      </div>
    </div>
  );
}
