import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Loader2, RefreshCw, X, ExternalLink, Sparkles } from "lucide-react";
import { analyzeRoom, type DetectedItem } from "@/lib/analyze-room.functions";
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

function Index() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>("camera");
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [items, setItems] = useState<DetectedItem[]>([]);
  const [selected, setSelected] = useState<DetectedItem | null>(null);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 1280 } },
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

  const capture = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;

    const canvas = document.createElement("canvas");
    const max = 1024;
    const scale = Math.min(1, max / Math.max(w, h));
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);

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
  }, [stopCamera]);

  const reset = useCallback(() => {
    setSnapshot(null);
    setItems([]);
    setSelected(null);
    setError(null);
    setPhase("camera");
  }, []);

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
            <div className="relative overflow-hidden rounded-2xl border border-border bg-black aspect-[3/4] sm:aspect-video">
              <video
                ref={videoRef}
                playsInline
                muted
                className="absolute inset-0 h-full w-full object-cover"
              />
              {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6 text-center text-sm text-white">
                  {error}
                </div>
              )}
            </div>
            <div className="flex flex-col items-center gap-2">
              <Button size="lg" onClick={capture} className="w-full max-w-xs">
                <Camera className="mr-2 h-5 w-5" />
                Scan the room
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Point at a room and tap. AI finds every item bigger than an apple.
              </p>
            </div>
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
                    onClick={() => setSelected(it)}
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
                      onClick={() => setSelected(it)}
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

      {selected && (
        <div
          className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-lg rounded-t-2xl border border-border bg-card p-5 shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">{selected.name}</h3>
                <p className="text-xs capitalize text-muted-foreground">
                  {selected.category}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded-full p-1 text-muted-foreground hover:bg-accent"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-3 text-sm leading-relaxed">{selected.description}</p>

            <div className="mt-4 rounded-lg bg-secondary p-3">
              <div className="text-xs font-medium text-muted-foreground">
                Estimated price range
              </div>
              <div className="text-xl font-semibold text-foreground">
                ${selected.priceMin}
                <span className="text-muted-foreground"> – </span>${selected.priceMax}
                <span className="ml-1 text-xs text-muted-foreground">
                  {selected.currency}
                </span>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <a
                href={selected.searchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
              >
                Shop this item
                <ExternalLink className="h-4 w-4 opacity-60" />
              </a>
              <a
                href={selected.infoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
              >
                Learn more
                <ExternalLink className="h-4 w-4 opacity-60" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
