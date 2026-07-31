import { useCallback, useEffect, useState } from "react";
import { X, Pencil, Trash2, Loader2, ChevronLeft, History, ExternalLink } from "lucide-react";
import {
  listScanHistory,
  renameScanHistory,
  deleteScanHistory,
  type ScanHistoryEntry,
  type ScanHistoryItem,
} from "@/lib/scan-history.functions";

function formatStamp(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function ItemDetailModal({ item, onClose }: { item: ScanHistoryItem; onClose: () => void }) {
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(`${item.name} buy price`)}`;
  const infoUrl = `https://www.google.com/search?q=${encodeURIComponent(item.name)}`;
  const showPrice =
    item.category !== "person" &&
    item.category !== "plate" &&
    typeof item.priceMin === "number" &&
    typeof item.priceMax === "number";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-card p-5 shadow-xl gold-glow sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold gold-text">{item.name}</h2>
              {typeof item.confidence === "number" && (
                <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                  {Math.round(item.confidence)}%
                </span>
              )}
            </div>
            {item.category && (
              <p className="text-xs capitalize text-muted-foreground">{item.category}</p>
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

        {item.description && (
          <p className="mt-3 text-sm leading-relaxed text-foreground">{item.description}</p>
        )}

        {showPrice && (
          <div className="mt-4 rounded-lg bg-secondary p-3">
            <div className="text-xs font-medium text-muted-foreground">Estimated price range</div>
            <div className="text-xl font-semibold text-foreground">
              ${item.priceMin}
              <span className="text-muted-foreground"> – </span>${item.priceMax}
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2">
          <a
            href={searchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            Shop this item
            <ExternalLink className="h-4 w-4 opacity-60" />
          </a>
          <a
            href={infoUrl}
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
  );
}


export function ScanHistorySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [entries, setEntries] = useState<ScanHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ScanHistoryEntry | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEntries(await listScanHistory());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load history.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setSelected(null);
    void load();
  }, [open, load]);

  if (!open) return null;

  const commitRename = async (entry: ScanHistoryEntry) => {
    const title = draft.trim();
    setEditingId(null);
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, title: title || null } : e)));
    try {
      await renameScanHistory({ data: { id: entry.id, title } });
    } catch {
      void load();
    }
  };

  const remove = async (entry: ScanHistoryEntry) => {
    setEntries((prev) => prev.filter((e) => e.id !== entry.id));
    if (selected?.id === entry.id) setSelected(null);
    try {
      await deleteScanHistory({ data: { id: entry.id } });
    } catch {
      void load();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-background p-4 shadow-[0_0_40px_-6px_hsl(var(--primary)/0.45)] gold-glow sm:rounded-2xl">
        <div className="mb-3 flex items-center gap-2">
          {selected ? (
            <button
              onClick={() => setSelected(null)}
              className="rounded-full p-1 text-muted-foreground hover:text-foreground"
              aria-label="Back"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : (
            <History className="h-4 w-4 text-primary" />
          )}
          <h2 className="flex-1 text-sm font-semibold text-foreground">
            {selected ? selected.title || formatStamp(selected.createdAt) : "Scan History"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
        {error && !loading && <p className="py-6 text-center text-xs text-destructive">{error}</p>}

        {!loading && !error && !selected && (
          <div className="space-y-2">
            {entries.length === 0 && (
              <p className="py-8 text-center text-xs text-muted-foreground">
                No scans yet. Your scans will be saved here automatically.
              </p>
            )}
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2"
              >
                {editingId === entry.id ? (
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => void commitRename(entry)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void commitRename(entry);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:border-primary"
                  />
                ) : (
                  <button
                    onClick={() => setSelected(entry)}
                    className="flex-1 text-left"
                  >
                    <span className="block truncate text-xs font-medium text-foreground">
                      {entry.title || formatStamp(entry.createdAt)}
                    </span>
                    <span className="block text-[10px] text-muted-foreground">
                      {entry.items.length} item{entry.items.length === 1 ? "" : "s"} ·{" "}
                      {entry.mode === "video" ? "Video scan" : "Photo scan"}
                      {entry.title ? ` · ${formatStamp(entry.createdAt)}` : ""}
                    </span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setDraft(entry.title || formatStamp(entry.createdAt));
                    setEditingId(entry.id);
                  }}
                  className="rounded-md p-1.5 text-muted-foreground hover:text-primary"
                  aria-label="Rename scan"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => void remove(entry)}
                  className="rounded-md p-1.5 text-muted-foreground hover:text-destructive"
                  aria-label="Delete scan"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {!loading && selected && (
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">
              {formatStamp(selected.createdAt)} · {selected.mode === "video" ? "Video scan" : "Photo scan"}
            </p>
            {selected.items.length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No items were saved for this scan.
              </p>
            )}
            {selected.items.map((item, i) => (
              <div key={i} className="rounded-xl border border-border bg-secondary/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-foreground">{item.name}</span>
                  {typeof item.confidence === "number" && (
                    <span className="text-[10px] text-muted-foreground">
                      {Math.round(item.confidence)}%
                    </span>
                  )}
                </div>
                {item.category && (
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {item.category}
                  </span>
                )}
                {item.description && (
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                )}
                {item.category !== "person" &&
                  typeof item.priceMin === "number" &&
                  typeof item.priceMax === "number" && (
                    <p className="mt-1 text-[11px] font-medium text-primary">
                      ${item.priceMin}–${item.priceMax}
                    </p>
                  )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
