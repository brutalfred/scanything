import { useCallback, useEffect, useMemo, useState } from "react";
import { X, Pencil, Trash2, Loader2, ChevronLeft, ChevronRight, History, ExternalLink, Languages, Camera, Video, FileText, Tag } from "lucide-react";
import {
  listScanHistory,
  renameScanHistory,
  deleteScanHistory,
  type ScanHistoryEntry,
  type ScanHistoryItem,
} from "@/lib/scan-history.functions";
import { translateName } from "@/lib/analyze-room.functions";
import { useLanguage } from "@/hooks/useLanguage";
import { LANGUAGES } from "@/lib/i18n";

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

/** Cached per language+item so reopening an entry costs nothing. */
const HISTORY_TRANSLATIONS = new Map<
  string,
  { translation: string; description: string; category: string; labels: string[] }
>();

function ItemDetailModal({ item, onClose }: { item: ScanHistoryItem; onClose: () => void }) {
  const { language: appLanguage, t } = useLanguage();
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(`${item.name} buy price`)}`;
  const infoUrl = `https://www.google.com/search?q=${encodeURIComponent(item.name)}`;
  const showPrice =
    item.category !== "person" &&
    item.category !== "plate" &&
    typeof item.priceMin === "number" &&
    typeof item.priceMax === "number";

  const LABELS = useMemo(
    () => [t("estimatedPriceRange"), t("shopThisItem"), t("learnMore")],
    [t],
  );

  const [pickerOpen, setPickerOpen] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tr, setTr] = useState<{
    language: string;
    translation: string;
    description: string;
    category: string;
    labels: string[];
  } | null>(null);

  const run = useCallback(
    async (language: string) => {
      setPickerOpen(false);
      if (language === "English") {
        setTr(null);
        setError(null);
        return;
      }
      const key = `${language}|${item.name}|${item.description ?? ""}`;
      const cached = HISTORY_TRANSLATIONS.get(key);
      if (cached) {
        setTr({ language, ...cached });
        return;
      }
      setTranslating(true);
      setError(null);
      try {
        const result = await translateName({
          data: {
            text: item.name,
            targetLanguage: language,
            description: item.description ?? "",
            category: item.category ?? "",
            labels: LABELS,
          },
        });
        HISTORY_TRANSLATIONS.set(key, result);
        setTr({ language, ...result });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Translation failed.");
      } finally {
        setTranslating(false);
      }
    },
    [item.name, item.description, item.category, LABELS],
  );

  // Follow the app language automatically.
  useEffect(() => {
    if (appLanguage === "English") {
      setTr((prev) => (prev ? null : prev));
      return;
    }
    if (tr?.language === appLanguage) return;
    void run(appLanguage);
  }, [appLanguage, tr?.language, run]);

  const tl = (i: number) => tr?.labels?.[i] || LABELS[i] || "";

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
              <button
                type="button"
                onClick={() => setPickerOpen((v) => !v)}
                className="inline-flex items-center gap-1 rounded-full border border-primary/50 px-2 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/10"
              >
                <Languages className="h-3 w-3" />
                {t("translate")}
                <span className="text-muted-foreground">· {t("free")}</span>
              </button>
            </div>
            {pickerOpen && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => void run(lang)}
                    disabled={translating}
                    className="rounded-full border border-border px-2 py-0.5 text-[10px] text-foreground hover:border-primary hover:text-primary disabled:opacity-50"
                  >
                    {lang}
                  </button>
                ))}
              </div>
            )}
            {translating && (
              <p className="mt-1 text-[11px] text-muted-foreground">{t("translating")}</p>
            )}
            {error && <p className="mt-1 text-[11px] text-destructive">{error}</p>}
            {tr && !translating && (
              <p className="mt-1 text-sm font-medium text-primary">
                {tr.translation}
                <span className="ml-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {tr.language}
                </span>
              </p>
            )}
            {item.category && (
              <p className="text-xs capitalize text-muted-foreground">
                {tr?.category || item.category}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground hover:bg-accent"
            aria-label={t("close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {item.description && (
          <p className="mt-3 text-sm leading-relaxed text-foreground">
            {tr?.description || item.description}
          </p>
        )}

        {item.deep && (
          <div className="mt-4 rounded-xl border border-primary/40 bg-primary/5 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-primary">
              {t("deepAnalysis")}
              {typeof item.deep.confidence === "number" && ` · ${Math.round(item.deep.confidence)}%`}
            </div>
            {(item.deep.brand || item.deep.product) && (
              <div className="mt-1 text-sm font-medium text-foreground">
                {[item.deep.brand, item.deep.product].filter(Boolean).join(" — ")}
              </div>
            )}
            {item.deep.description && (
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {item.deep.description}
              </p>
            )}
            {item.category !== "person" &&
              item.category !== "plate" &&
              (Number(item.deep.priceMin) > 0 || Number(item.deep.priceMax) > 0) && (
                <p className="mt-2 text-sm font-semibold text-primary">
                  ${item.deep.priceMin}–${item.deep.priceMax} {item.deep.currency ?? ""}
                </p>
              )}
            <div className="mt-2 flex flex-col gap-2">
              {item.deep.buyUrl && (
                <a
                  href={item.deep.buyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-accent"
                >
                  {tl(1)}
                  <ExternalLink className="h-4 w-4 opacity-60" />
                </a>
              )}
              {item.deep.infoUrl && (
                <a
                  href={item.deep.infoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-accent"
                >
                  {tl(2)}
                  <ExternalLink className="h-4 w-4 opacity-60" />
                </a>
              )}
            </div>
          </div>
        )}


        {showPrice && (
          <div className="mt-4 rounded-lg bg-secondary p-3">
            <div className="text-xs font-medium text-muted-foreground">{tl(0)}</div>
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
            {tl(1)}
            <ExternalLink className="h-4 w-4 opacity-60" />
          </a>
          <a
            href={infoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            {tl(2)}
            <ExternalLink className="h-4 w-4 opacity-60" />
          </a>
        </div>
      </div>
    </div>
  );
}

type FolderKey = "photo" | "resale" | "video" | "document";

const FOLDERS: { key: FolderKey; icon: typeof Camera; labelKey: "photoScan" | "resaleScan" | "videoScan" | "documentScan" }[] = [
  { key: "photo", icon: Camera, labelKey: "photoScan" },
  { key: "resale", icon: Tag, labelKey: "resaleScan" },
  { key: "video", icon: Video, labelKey: "videoScan" },
  { key: "document", icon: FileText, labelKey: "documentScan" },
];

function folderOf(mode: string): FolderKey {
  return mode === "video" || mode === "document" || mode === "resale" ? mode : "photo";
}


export function ScanHistorySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLanguage();
  const [entries, setEntries] = useState<ScanHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ScanHistoryEntry | null>(null);
  const [selectedItem, setSelectedItem] = useState<ScanHistoryItem | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [folder, setFolder] = useState<FolderKey | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEntries(await listScanHistory());
    } catch (e) {
      setError(e instanceof Error ? e.message : t("couldNotLoadHistory"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!open) return;
    setSelected(null);
    setFolder(null);
    void load();
  }, [open, load]);

  if (!open) return null;

  const modeLabel = (mode: string) =>
    mode === "video"
      ? t("videoScan")
      : mode === "document"
        ? t("documentScan")
        : mode === "resale"
          ? t("resaleScan")
          : t("photoScan");

  const visible = folder ? entries.filter((e) => folderOf(e.mode) === folder) : [];

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
          {selected || folder ? (
            <button
              onClick={() => (selected ? setSelected(null) : setFolder(null))}
              className="rounded-full p-1 text-muted-foreground hover:text-foreground"
              aria-label={t("back")}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : (
            <History className="h-4 w-4 text-primary" />
          )}
          <h2 className="flex-1 text-sm font-semibold text-foreground">
            {selected
              ? selected.title || formatStamp(selected.createdAt)
              : folder
                ? modeLabel(folder)
                : t("scanHistory")}
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground hover:text-foreground"
            aria-label={t("close")}
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
              <p className="py-8 text-center text-xs text-muted-foreground">{t("noScansYet")}</p>
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
                      {entry.items.length}{" "}
                      {entry.items.length === 1 ? t("item") : t("items").toLowerCase()} ·{" "}
                      {modeLabel(entry.mode)}
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
                  aria-label={t("rename")}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => void remove(entry)}
                  className="rounded-md p-1.5 text-muted-foreground hover:text-destructive"
                  aria-label={t("deleteAction")}
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
              {formatStamp(selected.createdAt)} · {modeLabel(selected.mode)}
            </p>
            {selected.items.length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">{t("noItemsSaved")}</p>
            )}
            {selected.items.map((item, i) => (
              <button
                key={i}
                onClick={() => setSelectedItem(item)}
                className="w-full rounded-xl border border-border bg-secondary/40 p-3 text-left transition-colors hover:border-primary"
              >
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
                  <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
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
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedItem && (
        <ItemDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>

  );
}
