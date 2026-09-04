import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Loader2, RotateCw, X } from "lucide-react";
import { useSlideDismiss } from "@/hooks/useSlideDismiss";

type Aspect = "original" | "1:1" | "4:5" | "16:9";

const ASPECTS: { key: Aspect; label: string; value: number | null }[] = [
  { key: "original", label: "Original", value: null },
  { key: "1:1", label: "1:1", value: 1 },
  { key: "4:5", label: "4:5", value: 4 / 5 },
  { key: "16:9", label: "16:9", value: 16 / 9 },
];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read the image."));
    img.src = src;
  });
}

/**
 * Lightweight canvas photo editor: rotate, straighten-free crop presets,
 * brightness/contrast/saturation and an optional Scanything watermark.
 */
export function PhotoEditor({
  open,
  src,
  onClose,
  onDone,
}: {
  open: boolean;
  src: string | null;
  onClose: () => void;
  onDone: (dataUrl: string) => void;
}) {
  const slide = useSlideDismiss("bottom", onClose);
  const [rotation, setRotation] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [aspect, setAspect] = useState<Aspect>("original");
  const [watermark, setWatermark] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setRotation(0);
      setBrightness(100);
      setContrast(100);
      setSaturation(100);
      setAspect("original");
      setWatermark(false);
    }
  }, [open, src]);

  const filter = useMemo(
    () => `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`,
    [brightness, contrast, saturation],
  );

  const apply = useCallback(async () => {
    if (!src) return;
    setBusy(true);
    try {
      const img = await loadImage(src);
      const rotated = rotation % 180 !== 0;
      const srcW = rotated ? img.naturalHeight : img.naturalWidth;
      const srcH = rotated ? img.naturalWidth : img.naturalHeight;

      const target = ASPECTS.find((a) => a.key === aspect)?.value ?? null;
      let outW = srcW;
      let outH = srcH;
      if (target) {
        if (srcW / srcH > target) outW = Math.round(srcH * target);
        else outH = Math.round(srcW / target);
      }

      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      ctx.filter = filter;
      ctx.save();
      ctx.translate(outW / 2, outH / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      ctx.restore();

      if (watermark) {
        const pad = Math.round(Math.min(outW, outH) * 0.03);
        const size = Math.max(14, Math.round(Math.min(outW, outH) * 0.045));
        ctx.filter = "none";
        ctx.font = `600 ${size}px Barlow, system-ui, sans-serif`;
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillText("Scanything", outW - pad + 2, outH - pad + 2);
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.fillText("Scanything", outW - pad, outH - pad);
      }

      onDone(canvas.toDataURL("image/jpeg", 0.92));
    } finally {
      setBusy(false);
    }
  }, [src, rotation, aspect, filter, watermark, onDone]);

  if (!open || !src || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-background/85 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Photo editor"
        {...slide}
        onClick={(e) => e.stopPropagation()}
        className={`theme-panel gold-glow max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl p-4 text-sm shadow-2xl sm:rounded-2xl ${slide.className}`}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Edit photo</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close editor"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-destructive/50 text-destructive hover:bg-destructive/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-black">
          <img
            src={src}
            alt="Photo being edited"
            className="mx-auto max-h-[42vh] w-auto object-contain"
            style={{ filter, transform: `rotate(${rotation}deg)` }}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-accent"
          >
            <RotateCw className="h-3.5 w-3.5" /> Rotate
          </button>
          {ASPECTS.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => setAspect(a.key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                aspect === a.key
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border hover:bg-accent"
              }`}
            >
              {a.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setWatermark((w) => !w)}
            aria-pressed={watermark}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              watermark
                ? "border-primary bg-primary/15 text-primary"
                : "border-border hover:bg-accent"
            }`}
          >
            Watermark
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {(
            [
              ["Brightness", brightness, setBrightness],
              ["Contrast", contrast, setContrast],
              ["Saturation", saturation, setSaturation],
            ] as const
          ).map(([label, value, set]) => (
            <label key={label} className="block">
              <span className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                {label}
                <span>{value}%</span>
              </span>
              <input
                type="range"
                min={40}
                max={180}
                value={value}
                aria-label={label}
                onChange={(e) => set(Number(e.target.value))}
                className="mt-1 w-full accent-[hsl(var(--primary))]"
              />
            </label>
          ))}
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => void apply()}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-primary/50 bg-primary/10 px-3 py-2 font-semibold text-primary transition-colors hover:bg-primary/20 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Apply changes
        </button>
      </div>
    </div>,
    document.body,
  );
}
