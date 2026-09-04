import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Images, Loader2, Pencil, ScanLine, Share2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useSlideDismiss } from "@/hooks/useSlideDismiss";
import { deletePhoto, listPhotos, type GalleryPhoto } from "@/lib/gallery";

function fileName(p: GalleryPhoto) {
  const d = new Date(p.createdAt);
  const n = (x: number) => String(x).padStart(2, "0");
  return `scanything-${d.getFullYear()}-${n(d.getMonth() + 1)}-${n(d.getDate())}-${n(d.getHours())}${n(d.getMinutes())}.jpg`;
}

async function share(p: GalleryPhoto) {
  try {
    const blob = await (await fetch(p.dataUrl)).blob();
    const file = new File([blob], fileName(p), { type: blob.type || "image/jpeg" });
    const nav = navigator as Navigator & { canShare?: (d?: ShareData) => boolean };
    if (nav.share && nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], title: "Scanything photo" });
      return;
    }
    download(p);
    toast("Sharing isn't supported here — saved the photo instead");
  } catch (e) {
    if ((e as DOMException)?.name === "AbortError") return;
    toast.error("Could not share that photo");
  }
}

function download(p: GalleryPhoto) {
  const a = document.createElement("a");
  a.href = p.dataUrl;
  a.download = fileName(p);
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function GallerySheet({
  open,
  onClose,
  onScan,
  onEdit,
}: {
  open: boolean;
  onClose: () => void;
  /** Send a stored photo through an AI scan. */
  onScan?: (dataUrl: string) => void;
  /** Open a stored photo in the editor. */
  onEdit?: (photo: GalleryPhoto) => void;
}) {
  const slide = useSlideDismiss("bottom", onClose);
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState<GalleryPhoto | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setPhotos(await listPhotos());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) void refresh();
    else setActive(null);
  }, [open, refresh]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Photo gallery"
        {...slide}
        onClick={(e) => e.stopPropagation()}
        className={`theme-panel gold-glow max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl p-4 text-sm shadow-2xl sm:rounded-2xl ${slide.className}`}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Images className="h-4 w-4" />
            Gallery
            {photos.length > 0 && (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                {photos.length}
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-destructive/50 text-destructive hover:bg-destructive/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading photos…
          </div>
        ) : photos.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No photos yet. Take a picture in “Take photo” mode and it lands here.
          </p>
        ) : active ? (
          <div className="space-y-3">
            <img
              src={active.dataUrl}
              alt="Saved capture"
              className="max-h-[50vh] w-full rounded-xl object-contain"
            />
            <p className="text-center text-[11px] text-muted-foreground">
              {new Date(active.createdAt).toLocaleString()}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {onScan && (
                <button
                  type="button"
                  onClick={() => {
                    onScan(active.dataUrl);
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary/50 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10"
                >
                  <ScanLine className="h-3.5 w-3.5" /> Scan this
                </button>
              )}
              {onEdit && (
                <button
                  type="button"
                  onClick={() => {
                    onEdit(active);
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-accent"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
              )}
              <button
                type="button"
                onClick={() => void share(active)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-accent"
              >
                <Share2 className="h-3.5 w-3.5" /> Share
              </button>
              <button
                type="button"
                onClick={() => download(active)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-accent"
              >
                <Download className="h-3.5 w-3.5" /> Save
              </button>
              <button
                type="button"
                onClick={async () => {
                  await deletePhoto(active.id);
                  setActive(null);
                  await refresh();
                  toast.success("Photo deleted");
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-destructive/50 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
              <button
                type="button"
                onClick={() => setActive(null)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-accent"
              >
                Back
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {photos.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setActive(p)}
                className="group relative aspect-square overflow-hidden rounded-xl border border-border"
              >
                <img
                  src={p.dataUrl}
                  alt={`Photo from ${new Date(p.createdAt).toLocaleString()}`}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
