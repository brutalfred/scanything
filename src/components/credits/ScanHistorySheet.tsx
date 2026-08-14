import { useCallback, useEffect, useMemo, useState } from "react";
import { useSlideDismiss } from "@/hooks/useSlideDismiss";
import { X, Pencil, Trash2, Loader2, ChevronLeft, ChevronRight, History, ExternalLink, Languages, Camera, Video, FileText, Tag, Search, FolderOpen } from "lucide-react";
import {
  listScanHistory,
  renameScanHistory,
  deleteScanHistory,
  type ScanHistoryEntry,
  type ScanHistoryItem,
} from "@/lib/scan-history.functions";
import { translateName, translateDocument } from "@/lib/analyze-room.functions";
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

/** Full scanned document text, translatable back and forth inside this box only. */
function HistoryDocumentText({ text, language }: { text: string; language: string }) {
  const [value, setValue] = useState(text);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (language === "English") {
      setValue(text);
      return;
    }
    let cancelled = false;
    setBusy(true);
    void (async () => {
      try {
        const result = await translateDocument({
          data: { text: text.slice(0, 60000), targetLanguage: language },
        });
        if (!cancelled && result.text) setValue(result.text);
      } catch {
        /* keep the original text */
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [text, language]);

  return (
    <div className="mt-3">
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-secondary p-3 font-mono text-xs leading-relaxed text-foreground">
        {busy ? "Translating…" : value}
      </pre>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(value).then(
            () => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            },
            () => {},
          );
        }}
        className="mt-2 inline-flex items-center gap-1 rounded-full border border-primary/50 px-3 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"
      >
        {copied ? "Copied" : "Copy to clipboard"}
      </button>
    </div>
  );
}

function ItemDetailModal({ item, onClose }: { item: ScanHistoryItem; onClose: () => void }) {
  const slide = useSlideDismiss("bottom", onClose);
  const { t } = useLanguage();
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(`${item.name} buy price`)}`;
  const infoUrl = `https://www.google.com/search?q=${encodeURIComponent(item.name)}`;
  const showPrice =
    item.category !== "plate" &&
    typeof item.priceMin === "number" &&
    typeof item.priceMax === "number";

  const LABELS = useMemo(
    () => [t("estimatedPriceRange"), t("shopThisItem"), t("learnMore")],
    [t],
  );

  const [pickerOpen, setPickerOpen] = useState(false);
  /** Language of this information box only. */
  const [boxLanguage, setBoxLanguage] = useState<string>("English");
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
      setBoxLanguage(language);
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

  // This box has its own language, independent of the account-tab language.

  const tl = (i: number) => tr?.labels?.[i] || LABELS[i] || "";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        {...slide}
        className={`max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-card p-5 shadow-xl gold-glow sm:rounded-2xl ${slide.className}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div data-swipe-handle className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-border sm:hidden" />
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

        {item.fullText ? (
          <HistoryDocumentText text={item.fullText} language={boxLanguage} />
        ) : (
          item.description && (
            <p className="mt-3 text-sm leading-relaxed text-foreground">
              {tr?.description || item.description}
            </p>
          )
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
            {item.category !== "plate" &&
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
  const slide = useSlideDismiss("bottom", onClose);
  const { t } = useLanguage();
  const [entries, setEntries] = useState<ScanHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ScanHistoryEntry | null>(null);
  const [selectedItem, setSelectedItem] = useState<ScanHistoryItem | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [folder, setFolder] = useState<FolderKey | null>(null);
  const [tab, setTab] = useState<"scans" | "collections">("scans");
  const [collection, setCollection] = useState<string | null>(null);
  const [query, setQuery] = useState("");


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
    setCollection(null);
    setQuery("");
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

  const loose = entries.filter((e) => !e.collection);
  const filed = entries.filter((e) => !!e.collection);
  const collectionNames = Array.from(new Set(filed.map((e) => e.collection as string))).sort(
    (a, b) => a.localeCompare(b),
  );

  const q = query.trim().toLowerCase();
  const matches = (e: ScanHistoryEntry) =>
    !q ||
    (e.title ?? "").toLowerCase().includes(q) ||
    (e.collection ?? "").toLowerCase().includes(q) ||
    modeLabel(e.mode).toLowerCase().includes(q) ||
    e.items.some(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.category ?? "").toLowerCase().includes(q) ||
        (i.description ?? "").toLowerCase().includes(q) ||
        (i.deep?.description ?? "").toLowerCase().includes(q),
    );

  const searchResults = q ? entries.filter(matches) : [];
  const visible = collection
    ? filed.filter((e) => e.collection === collection)
    : folder
      ? loose.filter((e) => folderOf(e.mode) === folder)
      : [];


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
      <div
        {...slide}
        className={`max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-background p-4 shadow-[0_0_40px_-6px_hsl(var(--primary)/0.45)] gold-glow sm:rounded-2xl ${slide.className}`}
      >
        <div data-swipe-handle className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-border sm:hidden" />
        <div className="mb-3 flex items-center gap-2">

          {selected || folder || collection ? (
            <button
              onClick={() =>
                selected ? setSelected(null) : collection ? setCollection(null) : setFolder(null)
              }
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
              : collection
                ? collection
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

        {!loading && !error && !selected && !folder && !collection && (
          <div className="space-y-3">
            <div className="inline-flex w-full rounded-full border border-border/60 bg-secondary p-0.5 text-[11px]">
              <button
                onClick={() => setTab("scans")}
                className={`flex-1 rounded-full px-2.5 py-1 font-medium transition-colors ${tab === "scans" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {t("scanHistory")}
              </button>
              <button
                onClick={() => setTab("collections")}
                className={`flex-1 rounded-full px-2.5 py-1 font-medium transition-colors ${tab === "collections" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Collections
              </button>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search items, categories, text…"
                className="w-full rounded-lg border border-border bg-background py-2 pl-8 pr-3 text-xs text-foreground outline-none focus:border-primary"
              />
            </div>

            {q ? (
              <div className="space-y-2">
                {searchResults.length === 0 && (
                  <p className="py-8 text-center text-xs text-muted-foreground">No matches.</p>
                )}
                {searchResults.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => setSelected(entry)}
                    className="w-full rounded-xl border border-border bg-secondary/40 px-3 py-2 text-left transition-colors hover:border-primary"
                  >
                    <span className="block truncate text-xs font-medium text-foreground">
                      {entry.title || formatStamp(entry.createdAt)}
                    </span>
                    <span className="block text-[10px] text-muted-foreground">
                      {entry.collection ? `${entry.collection} · ` : ""}
                      {modeLabel(entry.mode)} · {entry.items.length}{" "}
                      {entry.items.length === 1 ? t("item") : t("items").toLowerCase()}
                    </span>
                  </button>
                ))}
              </div>
            ) : tab === "scans" ? (
              <div className="space-y-2">
                {loose.length === 0 && (
                  <p className="py-8 text-center text-xs text-muted-foreground">{t("noScansYet")}</p>
                )}
                {loose.length > 0 &&
                  FOLDERS.map(({ key, icon: Icon, labelKey }) => {
                    const count = loose.filter((e) => folderOf(e.mode) === key).length;
                    return (
                      <button
                        key={key}
                        onClick={() => setFolder(key)}
                        disabled={count === 0}
                        className="flex w-full items-center gap-3 rounded-xl border border-border bg-secondary/40 px-3 py-3 text-left transition-colors hover:border-primary disabled:opacity-40"
                      >
                        <Icon className="h-4 w-4 text-primary" />
                        <span className="flex-1 text-xs font-medium text-foreground">
                          {t(labelKey)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{count}</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </button>
                    );
                  })}
              </div>
            ) : (
              <div className="space-y-2">
                {collectionNames.length === 0 && (
                  <p className="py-8 text-center text-xs text-muted-foreground">
                    No collections yet — use "Save to collection" after a scan.
                  </p>
                )}
                {collectionNames.map((name) => {
                  const count = filed.filter((e) => e.collection === name).length;
                  return (
                    <button
                      key={name}
                      onClick={() => setCollection(name)}
                      className="flex w-full items-center gap-3 rounded-xl border border-border bg-secondary/40 px-3 py-3 text-left transition-colors hover:border-primary"
                    >
                      <FolderOpen className="h-4 w-4 text-primary" />
                      <span className="flex-1 truncate text-xs font-medium text-foreground">
                        {name}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{count}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

        )}

        {!loading && !error && !selected && (folder || collection) && (
          <div className="space-y-2">
            {visible.length === 0 && (
              <p className="py-8 text-center text-xs text-muted-foreground">{t("noScansYet")}</p>
            )}
            {visible.map((entry) => (
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
                {item.category !== "plate" &&
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
