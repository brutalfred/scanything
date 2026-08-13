import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  Camera,
  Loader2,
  RefreshCw,
  X,
  ExternalLink,
  Video,
  Image as ImageIcon,
  Pause,
  Play,
  SlidersHorizontal,
  Trash2,
  Flashlight,
  FlashlightOff,
  Sparkles,
  Languages,
  User,
  History,
  Mail,
  Share2,
  Download,
  FileText,
  Tag,
  Copy,
  Check,
  Pencil,
  ChevronDown,
  Plus,
  Upload,
  CloudOff,
  FolderPlus,
  MessageCircle,
  Send,


} from "lucide-react";

import { toast } from "sonner";

import {
  analyzeRoom,
  analyzeDocument,
  summarizeDocument,
  translateDocument,

  quickScan,
  enrichItem,
  analyzeFurther,
  askAboutItem,
  translateText,
  translateName,
  type DetectedItem,
  type QuickItem,
  type DeepAnalysis,
  type Translation,
} from "@/lib/analyze-room.functions";
import { generateListingDraft, type ListingDraft } from "@/lib/listing.functions";
import { detectCountry, getMarketplacesForItem, getMarketplaceListingUrl, formatListingForMarketplace, getPriceCompareLinks, getManualSearchUrl, MARKETPLACES } from "@/lib/marketplaces";
import { Button } from "@/components/ui/button";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreditsProvider, useCreditsContext } from "@/components/credits/CreditsProvider";
import { CreditMeter } from "@/components/credits/CreditMeter";

import { AccountButton } from "@/components/credits/AccountButton";
import { PlanLogo } from "@/components/PlanLogo";
import { useSubscription } from "@/hooks/useSubscription";
import { CREDIT_COSTS, SIGNUP_GRANT, type CreditReason } from "@/lib/credits";
import {
  baseScanCost,
  estimateScanCost,
  recordScanCost,
  type ScanMode,
} from "@/lib/scan-estimate";

import { AiConsentModal } from "@/components/AiConsentModal";
import { useAiConsent } from "@/hooks/useAiConsent";
import { ScanHistorySheet } from "@/components/credits/ScanHistorySheet";
import {
  saveScanHistory,
  appendScanHistory,
  saveScanHistoryItemDeep,
} from "@/lib/scan-history.functions";
import { shareScanCard } from "@/lib/share-card";
import { getPaddleEnvironment } from "@/lib/paddle";
import { useLanguage } from "@/hooks/useLanguage";
import { useAppVersion } from "@/hooks/useAppVersion";
import { LANGUAGE_TAG } from "@/lib/i18n";
import {
  isOffline,
  listQueuedScans,
  queueScan,
  removeQueuedScan,
  type QueuedScan,
} from "@/lib/scan-queue";






export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Scanything — AI analysis" },
      {
        name: "description",
        content:
          "Scan anything and get identification, information, price estimations and links",
      },
      { property: "og:title", content: "Scanything — AI analysis" },
      {
        property: "og:description",
        content: "Scan anything and get identification, information, price estimations and links",
      },
    ],
  }),
  component: Index,
});

type Phase = "camera" | "analyzing" | "results";
type Mode = "photo" | "video" | "document" | "resale";
type Box = { x: number; y: number; w: number; h: number };

type Enrichment = Omit<DetectedItem, "box" | "name">;

type TrackedItem = {
  id: string;
  name: string;
  box: Box;
  confidence?: number; // 0..100 from the quick scan
  enrichment?: Enrichment;
  enriching?: boolean;
  firstSeen: number;
  lastSeen: number;
};


const STALE_MS = 6000;

const CATEGORY_FILTERS: { key: string; label: string }[] = [
  { key: "furniture", label: "Furniture" },
  { key: "electronics", label: "Electronics" },
  { key: "appliance", label: "Appliances" },
  { key: "decor", label: "Decor" },
  { key: "plant", label: "Plants" },
  { key: "kitchenware", label: "Kitchenware" },
  { key: "clothing", label: "Clothing" },
  { key: "toy", label: "Toys" },
  { key: "book", label: "Books" },
  { key: "instrument", label: "Instruments" },
  { key: "door", label: "Doors" },
  { key: "vehicle", label: "Vehicles" },
  { key: "plate", label: "Plates" },
  { key: "text", label: "Text / Signs" },
  { key: "document", label: "Documents" },
  { key: "other", label: "Other" },
];

const DEFAULT_FILTERS = new Set(CATEGORY_FILTERS.map((c) => c.key));
const FILTER_STORAGE_KEY = "roomscan:filters";
const LAST_SCAN_KEY = "scanything:last-scan";


function normName(n: string) {
  return n.toLowerCase().trim();
}

// Words that are body parts only when they ARE the whole item name.
// Matching them anywhere in the name wrongly removed real objects
// ("Baby rattle", "Handbag", "Backpack", "Armchair", "Headphones"...).
const BODY_PART_WORDS =
  "hand|arm|leg|foot|feet|toe|finger|thumb|torso|chest|shoulder|face|head|hair|skin|nose|ear|eye|mouth|lip|neck|knee|elbow|belly|stomach|person|people|human";

const BODY_PART_RE = new RegExp(
  `^(?:(?:left|right|his|her|their|a|an|the|human|bare)\\s+)*(?:${BODY_PART_WORDS})s?$`,
  "i",
);

// Object names that contain a body-part word but are clearly objects.
const OBJECT_NOT_BODY_RE =
  /\b(bag|chair|phone|phones|set|rest|stool|pack|rail|band|cream|lotion|mirror|towel|brush|dryer|board|rail|warmer|wear|light|lamp|rest|guard|strap|cuff|watch|ring|glove|sock|shoe|boot|nail|polish|soap|wash|gel|piece|band|pad|print|toy|doll|rattle|monitor|bottle|seat|cot|crib|stroller|pram|carrier|blanket|clothes|shirt|pants|jacket|book|mannequin|statue|figure|poster|photo|picture|painting)\b/i;

function isBodyPart(name: string) {
  const n = name.toLowerCase().trim();
  if (OBJECT_NOT_BODY_RE.test(n)) return false;
  return BODY_PART_RE.test(n);
}


/** Languages offered by the free item-name translator. */
const NAME_LANGUAGES = [
  "English",
  "Spanish",
  "French",
  "German",
  "Swedish",
  "Italian",
  "Portuguese",
  "Polish",
  "Arabic",
  "Chinese",
  "Japanese",
  "Korean",
  "Hindi",
  "Russian",
  "Thai (ไทย)",
] as const;

// Detect non-Latin script characters (Chinese, Arabic, Japanese, Korean, etc.)
// Any code point >= U+0370 excluding common punctuation counts as non-Latin.
/** Downscale a user-picked photo to a compact JPEG data URL for AI analysis. */
async function fileToCompressedDataUrl(file: File, maxDim = 1024, quality = 0.8): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return null;
  }
}

function hasNonLatin(text: string) {
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp >= 0x0370) return true;
  }
  return false;
}
function centerDist(a: Box, b: Box) {
  const ax = a.x + a.w / 2;
  const ay = a.y + a.h / 2;
  const bx = b.x + b.w / 2;
  const by = b.y + b.h / 2;
  return Math.hypot(ax - bx, ay - by);
}
function distFromCenter(b: Box) {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  return Math.hypot(cx - 0.5, cy - 0.5);
}

// Pinch-to-zoom hook. Attach handlers to an outer container; wrap inner content
// with a div that uses returned `transformStyle`. Boxes inside inherit the zoom.
function usePinchZoom(min = 1, max = 5) {
  const [scale, setScale] = useState(1);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const startRef = useRef({ dist: 0, scale: 1 });
  const [pinching, setPinching] = useState(false);

  const onPointerDown = (e: React.PointerEvent) => {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()];
      startRef.current.dist = Math.hypot(a.x - b.x, a.y - b.y);
      startRef.current.scale = scale;
      setPinching(true);
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2 && startRef.current.dist > 0) {
      const [a, b] = [...pointersRef.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const next = Math.max(min, Math.min(max, startRef.current.scale * (d / startRef.current.dist)));
      setScale(next);
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) {
      startRef.current.dist = 0;
      setPinching(false);
    }
  };
  const reset = useCallback(() => setScale(1), []);

  const handlers = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
    onPointerLeave: onPointerUp,
    style: { touchAction: "pan-y" as const },
  };
  const transformStyle: React.CSSProperties = {
    transform: `scale(${scale})`,
    transformOrigin: "center center",
    transition: pinching ? "none" : "transform 200ms ease-out",
    width: "100%",
    height: "100%",
    position: "absolute",
    inset: 0,
  };
  return { scale, pinching, reset, handlers, transformStyle };
}

/** Small countdown to the next free daily scan (resets at midnight UTC). */
function FreeScanCountdown() {
  const [left, setLeft] = useState("");
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const next = Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
0,
        0,
        0,
      );
      const ms = Math.max(0, next - now.getTime());
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      const s = Math.floor((ms % 60_000) / 1000);
      setLeft(`${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <p className="text-center text-[11px] text-muted-foreground">
      Next free daily scan in {left}
    </p>
  );
}

function Index() {
  return (
    <CreditsProvider>
      <Scanner />
    </CreditsProvider>
  );
}

function Scanner() {
  const credits = useCreditsContext();
  const { t } = useLanguage();
  const appVersion = useAppVersion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);


  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [mode, setMode] = useState<Mode>("photo");
  const [phase, setPhase] = useState<Phase>("camera");
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  /** Image picked from the device — scanned instead of the live camera frame. */
  const [uploaded, setUploaded] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<DetectedItem[]>([]);
  /** How many items the AI actually returned before any local filtering. */
  const [rawItemCount, setRawItemCount] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreNote, setLoadMoreNote] = useState<string | null>(null);
  /** History row of the current photo scan, so "Load more" appends to the same entry. */
  const historyIdRef = useRef<string | null>(null);
  /** Set while an analysis is in flight and the user hits Cancel. */
  const cancelScanRef = useRef(false);
  /** Pages of a stitched multi-page document scan. */
  const [docPages, setDocPages] = useState<string[]>([]);
  const appendPageRef = useRef(false);
  /** Scans captured while offline, waiting to be analyzed. */
  const [queued, setQueued] = useState<QueuedScan[]>([]);
  const [queueOpen, setQueueOpen] = useState(false);
  const [collectionPrompt, setCollectionPrompt] = useState(false);
  const [collectionName, setCollectionName] = useState("");
  const [savingCollection, setSavingCollection] = useState(false);
  const [online, setOnline] = useState(true);

  const refreshQueue = useCallback(async () => {
    setQueued(await listQueuedScans());
  }, []);

  useEffect(() => {
    void refreshQueue();
    const sync = () => setOnline(!isOffline());
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, [refreshQueue]);




  // Restore the last photo scan so the picture stays open (survives reloads / tab restores).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(LAST_SCAN_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { snapshot: string; items: DetectedItem[] };
      if (!saved?.snapshot) return;
      setSnapshot(saved.snapshot);
      setItems(Array.isArray(saved.items) ? saved.items : []);
      setPhase("results");
    } catch {
      /* ignore corrupt cache */
    }
  }, []);

  const [selected, setSelected] = useState<TrackedItem | DetectedItem | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Filter state
  const [filters, setFilters] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set(DEFAULT_FILTERS);
    try {
      const raw = window.localStorage.getItem(FILTER_STORAGE_KEY);
      if (!raw) return new Set(DEFAULT_FILTERS);
      const arr = JSON.parse(raw) as string[];
      return new Set(arr);
    } catch {
      return new Set(DEFAULT_FILTERS);
    }
  });
  const [filterOpen, setFilterOpen] = useState(false);
  const [videoWarningOpen, setVideoWarningOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const environment = getPaddleEnvironment();


  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify([...filters]));
  }, [filters]);
  const toggleFilter = (key: string) => {
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Video mode state
  const [tracked, setTracked] = useState<TrackedItem[]>([]);
  const trackedRef = useRef<TrackedItem[]>([]);
  const [videoPaused, setVideoPaused] = useState(false);
  const scanningRef = useRef(false);
  const pausedRef = useRef(false);
  const modeRef = useRef<Mode>("photo");
  const enrichingIdsRef = useRef<Set<string>>(new Set());
  /** Video mode: only items the user tapped get the deeper (paid) enrichment. */
  const enrichWantedRef = useRef<Set<string>>(new Set());
  const [scanning, setScanning] = useState(false);

  // Estimated credit cost for the next scan, learned from recent real sessions.
  const [scanEstimate, setScanEstimate] = useState<Record<ScanMode, { credits: number; learned: boolean }>>({
    photo: { credits: baseScanCost("photo"), learned: false },
    document: { credits: baseScanCost("document"), learned: false },
  });
  const scanSpendRef = useRef<{ mode: ScanMode; cost: number } | null>(null);

  const refreshEstimates = useCallback(() => {
    setScanEstimate({ photo: estimateScanCost("photo"), document: estimateScanCost("document") });
  }, []);

  useEffect(() => {
    refreshEstimates();
  }, [refreshEstimates]);

  /** Closes out the previous scan session and starts counting a new one. */
  const startScanSpend = useCallback(
    (mode: ScanMode) => {
      const prev = scanSpendRef.current;
      if (prev) recordScanCost(prev.mode, prev.cost);
      scanSpendRef.current = { mode, cost: baseScanCost(mode) };
      if (prev) refreshEstimates();
    },
    [refreshEstimates],
  );

  const addScanSpend = useCallback((cost: number) => {
    if (scanSpendRef.current) scanSpendRef.current.cost += cost;
  }, []);


  // Blocklist: name -> expiry timestamp (ms). Prevents rescan for 60s.
  const BLOCK_MS = 60_000;
  const [blocked, setBlocked] = useState<Record<string, number>>({});
  const blockedRef = useRef<Record<string, number>>({});
  useEffect(() => {
    blockedRef.current = blocked;
  }, [blocked]);
  const isBlocked = useCallback((name: string) => {
    const exp = blockedRef.current[normName(name)];
    return typeof exp === "number" && exp > Date.now();
  }, []);
  // Sweep expired entries periodically so UI updates re-enable items.
  useEffect(() => {
    const id = window.setInterval(() => {
      setBlocked((prev) => {
        const now = Date.now();
        let changed = false;
        const next: Record<string, number> = {};
        for (const [k, v] of Object.entries(prev)) {
          if (v > now) next[k] = v;
          else changed = true;
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, []);
  const blockItem = useCallback((name: string) => {
    const key = normName(name);
    setBlocked((prev) => ({ ...prev, [key]: Date.now() + BLOCK_MS }));
    setTracked((prev) => prev.filter((t) => normName(t.name) !== key));
    setItems((prev) => prev.filter((it) => normName(it.name) !== key));
  }, []);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    pausedRef.current = videoPaused || !!selected || filterOpen;
  }, [videoPaused, selected, filterOpen]);
  useEffect(() => {
    trackedRef.current = tracked;
  }, [tracked]);

  // Bubble sound when new video-mode items appear.
  const trackedSoundIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const newIds = tracked.filter((t) => !trackedSoundIdsRef.current.has(t.id));
    if (newIds.length > 0) {
    }
    tracked.forEach((t) => trackedSoundIdsRef.current.add(t.id));
  }, [tracked]);

  // Bubble sound when photo-mode results first show items.
  const photoItemsSoundPlayedRef = useRef(false);
  useEffect(() => {
    if (phase === "results" && items.length > 0 && !photoItemsSoundPlayedRef.current) {
      photoItemsSoundPlayedRef.current = true;
    }
    if (phase === "camera" || items.length === 0) {
      photoItemsSoundPlayedRef.current = false;
    }
  }, [phase, items]);


  const aiConsent = useAiConsent();
  const [consentPromptOpen, setConsentPromptOpen] = useState(false);

  const startingRef = useRef(false);

  const attachStream = useCallback(async (stream: MediaStream) => {
    // The <video> element may not be mounted yet on the first attempt.
    for (let i = 0; i < 20; i++) {
      if (videoRef.current) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    if (!videoRef.current) return;
    videoRef.current.srcObject = stream;
    try {
      await videoRef.current.play();
    } catch {
      /* autoplay can reject if the element is re-mounted; the stream is still live */
    }
  }, []);

  const startCamera = useCallback(async () => {
    if (startingRef.current) return false;
    startingRef.current = true;
    setError(null);
    try {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setError(
          typeof window !== "undefined" && !window.isSecureContext
            ? "Camera needs a secure (https) connection."
            : "This browser does not support camera access.",
        );
        return false;
      }

      // Never hold two streams at once — some devices refuse the second request.
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 1280 },
          },
          audio: false,
        });
      } catch (e) {
        const name = e instanceof Error ? e.name : "";
        if (name === "OverconstrainedError" || name === "NotFoundError") {
          // Fall back to any available camera.
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } else {
          throw e;
        }
      }

      streamRef.current = stream;
      await attachStream(stream);
      const track = stream.getVideoTracks()[0];
      const caps = (track?.getCapabilities?.() ?? {}) as MediaTrackCapabilities & {
        torch?: boolean;
      };
      setTorchSupported(Boolean(caps.torch));
      setTorchOn(false);
      return true;
    } catch (e) {
      const name = e instanceof Error ? e.name : "";
      const msg =
        name === "NotAllowedError" || name === "SecurityError"
          ? "Camera access was blocked. Allow the camera in your browser settings, then reload."
          : name === "NotReadableError" || name === "AbortError"
            ? "Camera is in use by another app or tab. Close it and we'll retry."
            : name === "NotFoundError"
              ? "No camera found on this device."
              : e instanceof Error
                ? `Could not access camera: ${e.message}`
                : "Could not access camera.";
      setError(`${msg} Retrying in 5s…`);
      return false;
    } finally {
      startingRef.current = false;
    }
  }, [attachStream]);



  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setTorchOn(false);
    setTorchSupported(false);
  }, []);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: next } as MediaTrackConstraintSet & { torch: boolean }],
      });
      setTorchOn(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Flashlight not available.");
    }
  }, [torchOn]);

  useEffect(() => {
    if (phase !== "camera" || snapshot || !aiConsent.granted) return;
    let cancelled = false;
    let timer: number | null = null;

    const attempt = async () => {
      if (cancelled) return;
      const ok = await startCamera();
      if (!ok && !cancelled) {
        timer = window.setTimeout(attempt, 5000);
      }
    };
    void attempt();

    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, snapshot, aiConsent.granted]);


  const grabFrame = useCallback((maxDim = 1024, quality = 0.8): string | null => {
    const video = videoRef.current;
    if (!video) return null;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return null;

    // The preview uses object-cover inside a fixed-aspect frame (plus optional
    // pinch zoom), so the visible area is a centre crop of the raw frame.
    // Capture exactly what the user sees — nothing from outside the frame.
    let sx = 0;
    let sy = 0;
    let sw = w;
    let sh = h;

    const boxW = video.clientWidth;
    const boxH = video.clientHeight;
    if (boxW > 0 && boxH > 0) {
      const boxAspect = boxW / boxH;
      const srcAspect = w / h;
      if (srcAspect > boxAspect) {
        sw = h * boxAspect;
      } else {
        sh = w / boxAspect;
      }
      // Account for CSS pinch zoom applied to the video wrapper.
      let zoom = 1;
      const wrapper = video.parentElement;
      if (wrapper) {
        const m = new DOMMatrixReadOnly(getComputedStyle(wrapper).transform);
        if (m.a > 0.01) zoom = m.a;
      }
      if (zoom > 1) {
        sw /= zoom;
        sh /= zoom;
      }
      sx = (w - sw) / 2;
      sy = (h - sh) / 2;
    }

    const canvas = document.createElement("canvas");
    const scale = Math.min(1, maxDim / Math.max(sw, sh));
    canvas.width = Math.round(sw * scale);
    canvas.height = Math.round(sh * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", quality);
  }, []);


  const runScan = useCallback(
    async (dataUrl: string, m: Mode) => {
      const isDoc = m === "document";
      const isResale = m === "resale";
      if (!credits.spend(isDoc ? "document_scan" : "photo_scan")) return;
      startScanSpend(isDoc ? "document" : "photo");
      cancelScanRef.current = false;
      setSnapshot(dataUrl);

      try {
        sessionStorage.setItem(LAST_SCAN_KEY, JSON.stringify({ snapshot: dataUrl, items: [] }));
      } catch {
        /* storage full — keep the in-memory view */
      }
      stopCamera();
      setPhase("analyzing");
      setError(null);
      try {
        let detected: DetectedItem[] = [];
        if (isDoc) {
          // Deskew + flatten lighting + stretch contrast before OCR.
          const { preprocessForOcr } = await import("@/lib/ocr-preprocess");
          const cleaned = await preprocessForOcr(dataUrl);
          const doc = await analyzeDocument({ data: { imageBase64: cleaned, environment } });
          detected = (doc.items ?? []).filter(Boolean);
          if (cancelScanRef.current) return;
          setRawItemCount(detected.length);
        } else {
          const result = await analyzeRoom({
            data: { imageBase64: dataUrl, environment, resale: isResale },
          });
          if (cancelScanRef.current) return;
          setRawItemCount(result.items.length);
          detected = result.items.filter(
            (it) => !isBodyPart(it.name),
          );

        }
        credits.refresh();
        if (cancelScanRef.current) return;
        setItems(detected);
        setPhase("results");
        if (isDoc) {
          const pageText = detected
            .map((d) => d.description ?? "")
            .filter(Boolean)
            .join("\n\n");
          const append = appendPageRef.current;
          appendPageRef.current = false;
          setDocPages((prev) => (append ? [...prev, pageText] : [pageText]));
        }
        historyIdRef.current = null;
        if (detected.length) {
          void saveScanHistory({
            data: {
              mode: isDoc ? "document" : isResale ? "resale" : "photo",
              items: detected.map((d) => ({
                name: d.name,
                category: d.category,
                description: d.description,
                confidence: d.confidence,
                priceMin: d.priceMin,
                priceMax: d.priceMax,
                fullText: isDoc ? (d.description ?? undefined) : undefined,
              })),
            },
          })
            .then((row) => {
              historyIdRef.current = row.id;
            })
            .catch(() => {});
        }
        try {
          sessionStorage.setItem(
            LAST_SCAN_KEY,
            JSON.stringify({ snapshot: dataUrl, items: detected }),
          );
        } catch {
          /* storage full — keep the in-memory view */
        }
      } catch (e) {
        if (cancelScanRef.current) return;
        setError(e instanceof Error ? e.message : "Analysis failed.");
        setPhase("results");
        credits.refresh();
        try {
          sessionStorage.setItem(LAST_SCAN_KEY, JSON.stringify({ snapshot: dataUrl, items: [] }));
        } catch {
          /* ignore */
        }
      }
    },
    [stopCamera, credits, environment, startScanSpend],
  );

  const capture = useCallback(async () => {
    const isDoc = mode === "document";
    const isResale = mode === "resale";
    // Documents need every glyph, so capture at a much higher resolution.
    const dataUrl = uploaded ?? grabFrame(isDoc ? 2200 : 1024, isDoc ? 0.95 : 0.8);
    if (!dataUrl) return;

    // Offline: park the shot in the queue instead of burning a credit on a
    // request that cannot reach the server.
    if (isOffline()) {
      try {
        await queueScan({ mode: isDoc ? "document" : isResale ? "resale" : "photo", dataUrl });
        setUploaded(null);
        await refreshQueue();
        toast.success("You're offline — scan saved to the queue.");
      } catch {
        toast.error("Could not save this scan offline.");
      }
      return;
    }

    setUploaded(null);
    await runScan(dataUrl, mode);
  }, [grabFrame, mode, uploaded, runScan, refreshQueue]);

  const cancelScan = useCallback(() => {
    cancelScanRef.current = true;
    setPhase("camera");
    setSnapshot(null);
    setItems([]);
    setRawItemCount(0);
    setError(null);
    setLoadingMore(false);
    try {
      sessionStorage.removeItem(LAST_SCAN_KEY);
    } catch {
      /* ignore */
    }
    toast("Scan cancelled");
  }, []);


  const loadMore = useCallback(async () => {
    if (!snapshot || loadingMore) return;
    if (!credits.spend("load_more")) return;
    addScanSpend(CREDIT_COSTS.load_more);

    setLoadingMore(true);
    setLoadMoreNote(null);
    setError(null);
    try {
      const result = await analyzeRoom({
        data: {
          imageBase64: snapshot,
          environment,
          excludeNames: items.map((it) => it.name),
          pass: 2,
          resale: mode === "resale",
        },
      });
      const fresh = result.items.filter(
        (it) => !isBodyPart(it.name),
      );
      let added: DetectedItem[] = [];
      setItems((prev) => {
        const seen = new Set(prev.map((it) => normName(it.name)));
        added = fresh.filter((it) => {
          const key = normName(it.name);
          if (!key || seen.has(key) || isBlocked(it.name)) return false;
          seen.add(key);
          return true;
        });
        const next = [...prev, ...added];
        setRawItemCount((c) => c + result.items.length);
        try {
          sessionStorage.setItem(
            LAST_SCAN_KEY,
            JSON.stringify({ snapshot, items: next }),
          );
        } catch {
          /* storage full — keep the in-memory view */
        }
        return next;
      });
      if (added.length) {
        const payload = added.map((d) => ({
          name: d.name,
          category: d.category,
          description: d.description,
          confidence: d.confidence,
          priceMin: d.priceMin,
          priceMax: d.priceMax,
        }));
        const existingId = historyIdRef.current;
        if (existingId) {
          // Same scan — append to the existing history entry instead of creating a new one.
          void appendScanHistory({ data: { id: existingId, items: payload } }).catch(() => {});
        } else {
          void saveScanHistory({
            data: { mode: mode === "resale" ? "resale" : "photo", items: payload },
          })
            .then((row) => {
              historyIdRef.current = row.id;
            })
            .catch(() => {});
        }
      } else {
        setLoadMoreNote("No additional items found in this photo.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      setLoadingMore(false);
    }
  }, [snapshot, loadingMore, credits, environment, items, isBlocked, addScanSpend, mode]);




  const isGuest = !credits.signedIn;
  const { plan: headerPlan } = useSubscription(credits.signedIn);


  const mergeDetections = useCallback((detections: QuickItem[]) => {
    setTracked((prev) => {
      const now = Date.now();
      const next = prev.map((t) => ({ ...t }));
      const usedIdx = new Set<number>();

      for (const det of detections) {
        const dn = normName(det.name);
        if (isBlocked(det.name) || isBodyPart(det.name)) continue;
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
          if (typeof det.confidence === "number") next[bestIdx].confidence = det.confidence;
        } else {
          next.push({
            id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
            name: det.name,
            box: det.box,
            confidence: det.confidence,
            firstSeen: now,
            lastSeen: now,
          });
        }
      }

      const fresh = next.filter((t) => now - t.lastSeen < STALE_MS);
      fresh.sort((a, b) => distFromCenter(a.box) - distFromCenter(b.box));
      return fresh;
    });
  }, [isBlocked]);

  useEffect(() => {
    if (mode !== "video" || phase !== "camera" || isGuest) return;
    let cancelled = false;

    const loop = async () => {
      while (!cancelled && modeRef.current === "video") {
        if (pausedRef.current || scanningRef.current) {
          await new Promise((r) => setTimeout(r, 200));
          continue;
        }
        const frame = grabFrame(384, 0.5);
        if (!frame) {
          await new Promise((r) => setTimeout(r, 200));
          continue;
        }
        if (!credits.spend("quick_scan", { silent: true })) {
          setError("Out of scan credits — live scanning paused.");
          await new Promise((r) => setTimeout(r, 3000));
          continue;
        }
        scanningRef.current = true;
        setScanning(true);
        try {
          const result = await quickScan({ data: { imageBase64: frame, environment } });

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
        await new Promise((r) => setTimeout(r, 60));
      }
    };
    void loop();
    return () => {
      cancelled = true;
    };
  }, [mode, phase, isGuest, grabFrame, mergeDetections, credits]);


  useEffect(() => {
    if (mode !== "video" || phase !== "camera" || isGuest) return;
    let cancelled = false;

    const loop = async () => {
      while (!cancelled && modeRef.current === "video") {
        const target = trackedRef.current.find(
          (t) =>
            enrichWantedRef.current.has(t.id) &&
            !t.enrichment &&
            !enrichingIdsRef.current.has(t.id),
        );
        if (!target) {
          await new Promise((r) => setTimeout(r, 500));
          continue;
        }
        const frame = grabFrame(640, 0.7);
        if (!frame) {
          await new Promise((r) => setTimeout(r, 400));
          continue;
        }
        if (!credits.spend("enrich", { silent: true })) {
          await new Promise((r) => setTimeout(r, 3000));
          continue;
        }
        enrichingIdsRef.current.add(target.id);
        try {
          const enrichment = await enrichItem({
            data: { name: target.name, imageBase64: frame, environment },
          });

          if (!cancelled) {
            setTracked((prev) =>
              prev.map((t) => (t.id === target.id ? { ...t, enrichment } : t)),
            );
          }
        } catch {
          // silent
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
  }, [mode, phase, isGuest, grabFrame, credits]);


  const reset = useCallback(() => {
    trackedSoundIdsRef.current.clear();
    photoItemsSoundPlayedRef.current = false;
    try {
      sessionStorage.removeItem(LAST_SCAN_KEY);
    } catch {
      /* ignore */
    }
    setSnapshot(null);
    setUploaded(null);
    setItems([]);
    setRawItemCount(0);
    setLoadMoreNote(null);
    setSelected(null);
    setError(null);
    setTracked([]);
    setVideoPaused(false);
    setDocPages([]);
    appendPageRef.current = false;
    setPhase("camera");
  }, []);

  /** Keeps the pages collected so far and returns to the camera for the next page. */
  const addDocumentPage = useCallback(() => {
    appendPageRef.current = true;
    setItems([]);
    setSnapshot(null);
    setUploaded(null);
    setError(null);
    setSelected(null);
    setPhase("camera");
  }, []);

  /** Files the current scan into a named collection. */
  const saveToCollection = useCallback(async () => {
    const name = collectionName.trim();
    if (!name) return;
    setSavingCollection(true);
    try {
      const payload =
        mode === "video"
          ? tracked.map((it) => ({
              name: it.name,
              category: it.enrichment?.category,
              description: it.enrichment?.description,
              confidence: it.confidence,
              priceMin: it.enrichment?.priceMin,
              priceMax: it.enrichment?.priceMax,
            }))
          : items.map((d) => ({
              name: d.name,
              category: d.category,
              description: d.description,
              confidence: d.confidence,
              priceMin: d.priceMin,
              priceMax: d.priceMax,
              fullText: mode === "document" ? (d.description ?? undefined) : undefined,
            }));
      if (!payload.length) {
        toast.error("Nothing to save yet");
        return;
      }
      await saveScanHistory({
        data: { mode, items: payload, collection: name, title: name },
      });
      toast.success(`Saved to "${name}"`);
      setCollectionPrompt(false);
      setCollectionName("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save to collection");
    } finally {
      setSavingCollection(false);
    }
  }, [collectionName, items, tracked, mode]);

  /** Runs a queued offline capture now. */
  const analyzeQueued = useCallback(
    async (entry: QueuedScan) => {
      setQueueOpen(false);
      setMode(entry.mode);
      await removeQueuedScan(entry.id);
      await refreshQueue();
      await runScan(entry.dataUrl, entry.mode);
    },
    [refreshQueue, runScan],
  );

  const dropQueued = useCallback(
    async (id: string) => {
      await removeQueuedScan(id);
      await refreshQueue();
    },
    [refreshQueue],
  );





  const switchMode = useCallback((m: Mode) => {
    // Leaving a live video session: persist whatever was identified.
    setTracked((prev) => {
      if (m !== "video" && prev.length) {
        void saveScanHistory({
          data: {
            mode: "video",
            items: prev.map((t) => ({
              name: t.name,
              category: t.enrichment?.category,
              description: t.enrichment?.description,
              confidence: t.confidence,
              priceMin: t.enrichment?.priceMin,
              priceMax: t.enrichment?.priceMax,
            })),
          },
        }).catch(() => {});
      }
      return [];
    });
    setMode(m);
    setUploaded(null);
    setVideoPaused(false);
    setError(null);
  }, []);

  // Door handling
  const [doorPrompt, setDoorPrompt] = useState<{ item: TrackedItem | DetectedItem } | null>(null);
  const [addressInput, setAddressInput] = useState("");

  // List tab (Items / Categories)
  const [listTab, setListTab] = useState<"items" | "categories">("items");

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
      // Tapping a live box is what starts the deeper (paid) analysis.
      if ("id" in item && item.id) enrichWantedRef.current.add(item.id as string);
      // Capture image at open time (snapshot for photo mode, live frame for video)
      const img = snapshot ?? grabFrame(1280, 0.9) ?? null;
      setSelectedImage(img);
      setSelected(item);
    },
    [openAddressSearch, snapshot],
  );

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


  // Filtered lists
  const isAllowed = useCallback(
    (category: string | undefined) => {
      if (!category) return true; // not yet enriched
      const k = category.toLowerCase();
      const match = CATEGORY_FILTERS.find((c) => c.key === k)?.key ?? "other";
      return filters.has(match);
    },
    [filters],
  );

  const visibleTracked = useMemo(
    () => tracked.filter((t) => isAllowed(t.enrichment?.category) && !isBlocked(t.name)),
    [tracked, isAllowed, isBlocked, blocked],
  );
  const visibleItems = useMemo(
    () => items.filter((it) => isAllowed(it.category) && !isBlocked(it.name)),
    [items, isAllowed, isBlocked, blocked],
  );

  // Group items by category for the Categories tab.
  const groupBy = <T,>(arr: T[], keyFn: (t: T) => string) => {
    const map = new Map<string, T[]>();
    for (const it of arr) {
      const k = keyFn(it) || "other";
      const g = map.get(k) ?? [];
      g.push(it);
      map.set(k, g);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  };
  const categoryLabel = (key: string) =>
    CATEGORY_FILTERS.find((c) => c.key === key)?.label ??
    key.charAt(0).toUpperCase() + key.slice(1);

  const trackedByCategory = useMemo(
    () => groupBy(visibleTracked, (t) => (t.enrichment?.category || "").toLowerCase()),
    [visibleTracked],
  );
  const itemsByCategory = useMemo(
    () => groupBy(visibleItems, (t) => (t.category || "").toLowerCase()),
    [visibleItems],
  );

  const allOn = filters.size === CATEGORY_FILTERS.length;
  const noneOn = filters.size === 0;

  // Pinch-zoom for camera & snapshot views
  const cameraZoom = usePinchZoom();
  const photoZoom = usePinchZoom();
  useEffect(() => {
    // reset zoom when phase changes
    cameraZoom.reset();
    photoZoom.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // --- Share / save the captured picture -------------------------------
  const snapshotFileName = useCallback(() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `scanything-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.jpg`;
  }, []);

  const downloadSnapshot = useCallback(() => {
    if (!snapshot) return;
    const a = document.createElement("a");
    a.href = snapshot;
    a.download = snapshotFileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [snapshot, snapshotFileName]);

  const handleSavePicture = useCallback(() => {
    if (!snapshot) return;
    try {
      downloadSnapshot();
      toast.success("Picture saved");
    } catch {
      toast.error("Could not save the picture");
    }
  }, [snapshot, downloadSnapshot]);

  const handleSharePicture = useCallback(async () => {
    if (!snapshot) return;
    try {
      const blob = await (await fetch(snapshot)).blob();
      const file = new File([blob], snapshotFileName(), {
        type: blob.type || "image/jpeg",
      });
      const nav = navigator as Navigator & {
        canShare?: (data?: ShareData) => boolean;
      };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: "Scanything scan" });
        return;
      }
      downloadSnapshot();
      toast("Sharing isn't supported here — saved the picture instead");
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") return;
      downloadSnapshot();
      toast("Sharing failed — saved the picture instead");
    }
  }, [snapshot, snapshotFileName, downloadSnapshot]);


  return (
    <div className="min-h-screen text-foreground">
      <AiConsentModal
        open={aiConsent.needsConsent || consentPromptOpen}
        onAccept={() => {
          aiConsent.accept();
          setConsentPromptOpen(false);
        }}
        onDecline={() => {
          aiConsent.decline();
          setConsentPromptOpen(false);
        }}
      />
      {aiConsent.mounted && aiConsent.answered && !aiConsent.granted && (
        <div className="mx-auto flex max-w-4xl flex-col gap-2 px-4 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs opacity-80">
            Camera and AI analysis are off — you haven&apos;t given consent to send pictures to the AI provider.
          </p>
          <button
            type="button"
            onClick={() => setConsentPromptOpen(true)}
            className="shrink-0 rounded-lg border border-primary/50 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
          >
            Review camera &amp; AI consent
          </button>
        </div>
      )}
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/70 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-2 px-4 py-3">
          <div className="flex min-w-0 flex-1 basis-0 flex-shrink items-center justify-start">
            <AccountButton
              signedIn={credits.signedIn}
              email={credits.email}
              balance={credits.balance}
            />
          </div>
          <h1 className="flex shrink-0 items-center justify-center select-none">
            <span className="sr-only">Scanything — AI camera room analyzer</span>
            <PlanLogo plan={headerPlan} />
          </h1>

          <div className="flex min-w-0 flex-1 basis-0 flex-wrap items-center justify-end gap-2">

            <CreditMeter
              balance={credits.balance}
              loading={credits.loading}
              signedIn={credits.signedIn}
              onClick={credits.openSheet}
            />
            {phase === "camera" && torchSupported && (
              <button
                onClick={toggleTorch}
                aria-label={torchOn ? "Turn flashlight off" : "Turn flashlight on"}
                title={torchOn ? "Flashlight on" : "Flashlight off"}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/70 transition-colors gold-glow ${
                  torchOn
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-foreground hover:bg-accent"
                }`}
              >
                {torchOn ? (
                  <Flashlight className="h-4 w-4" />
                ) : (
                  <FlashlightOff className="h-4 w-4" />
                )}
              </button>
            )}

            {queued.length > 0 && (
              <button
                onClick={() => setQueueOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/70 bg-card px-3 py-1.5 text-xs font-medium text-primary hover:bg-accent"
                title="Offline scans waiting to be analyzed"
              >
                <CloudOff className="h-3.5 w-3.5" />
                <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                  {queued.length}
                </span>
              </button>
            )}




          </div>
        </div>
        <div className="h-px w-full gold-line opacity-80" />
      </header>

      {filterOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60"
          onClick={() => setFilterOpen(false)}
        >
          <div
            className="mx-auto mt-16 w-[min(92vw,28rem)] rounded-2xl border border-border bg-card p-4 gold-glow"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold gold-text">{t("filters")}</h2>
              <div className="flex gap-1">
                <button
                  onClick={() => setFilters(new Set(CATEGORY_FILTERS.map((c) => c.key)))}
                  disabled={allOn}
                  className="rounded-md border border-border/60 px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent disabled:opacity-40"
                >
                  All
                </button>
                <button
                  onClick={() => setFilters(new Set())}
                  disabled={noneOn}
                  className="rounded-md border border-border/60 px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent disabled:opacity-40"
                >
                  None
                </button>
                <button
                  onClick={() => setFilterOpen(false)}
                  className="rounded-md border border-border/60 px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent"
                >
                  Done
                </button>
              </div>
            </div>
            <p className="mb-3 text-[11px] text-muted-foreground">
              Choose what Scanything should highlight. Off = hidden from boxes and list.
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {CATEGORY_FILTERS.map((c) => {
                const on = filters.has(c.key);
                return (
                  <button
                    key={c.key}
                    onClick={() => toggleFilter(c.key)}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs transition-colors ${
                      on
                        ? "border-primary bg-primary/15 text-foreground"
                        : "border-border/50 bg-card text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    <span>{c.label}</span>
                    <span
                      className={`ml-2 h-2 w-2 rounded-full ${on ? "bg-primary" : "bg-muted"}`}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-4xl px-4 py-4">
        {phase === "camera" && !snapshot && (
          <div className="space-y-3">
            {/* Mode toggle */}
            <div className="flex items-center justify-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-5 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-secondary/80"
                    aria-label="Choose scan mode"
                  >
                    {mode === "photo" && <ImageIcon className="h-4 w-4" />}
                    {mode === "video" && <Video className="h-4 w-4" />}
                    {mode === "resale" && <Tag className="h-4 w-4" />}
                    {mode === "document" && <FileText className="h-4 w-4" />}
                    <span>
                      {mode === "photo" && t("photoScan")}
                      {mode === "video" && t("videoScan")}
                      {mode === "resale" && t("resaleScan")}
                      {mode === "document" && t("documentScan")}
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-70" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="min-w-[10rem]">
                  <DropdownMenuItem
                    onClick={() => switchMode("photo")}
                    className="flex items-center gap-2"
                  >
                    <ImageIcon className="h-4 w-4" />
                    {t("photoScan")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      if (credits.signedIn) {
                        setVideoWarningOpen(true);
                      } else {
                        switchMode("video");
                      }
                    }}
                    className="flex items-center gap-2"
                  >
                    <Video className="h-4 w-4" />
                    {t("videoScan")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => switchMode("resale")}
                    className="flex items-center gap-2"
                  >
                    <Tag className="h-4 w-4" />
                    {t("resaleScan")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => switchMode("document")}
                    className="flex items-center gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    {t("documentScan")}
                  </DropdownMenuItem>
                  {credits.signedIn && (
                    <DropdownMenuItem
                      onClick={() => setHistoryOpen(true)}
                      className="flex items-center gap-2"
                    >
                      <History className="h-4 w-4" />
                      {t("scanHistory")}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              {!isGuest && (
                <button
                  onClick={() => setFilterOpen((o) => !o)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-accent gold-glow"
                  aria-label={t("filters")}
                  title={t("filters")}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                    {filters.size}
                  </span>
                </button>
              )}
            </div>


            {(mode === "photo" || mode === "resale" || mode === "document") && (
              <p className="text-center text-[11px] text-muted-foreground">
                {mode === "photo" && t("photoScanDescription")}
                {mode === "resale" && t("resaleScanDescription")}
                {mode === "document" && t("documentScanDescription")}
              </p>
            )}



            <div className="relative overflow-hidden rounded-2xl border border-border bg-black aspect-[3/4] sm:aspect-video gold-glow">
              <div {...cameraZoom.handlers} className="absolute inset-0">
                <div style={cameraZoom.transformStyle}>
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="absolute inset-0 h-full w-full object-cover"
                  />

                  {mode === "video" &&
                    visibleTracked.map((it) => (
                    <button
                        key={it.id}
                        data-no-sound
                        onClick={(e) => {
                          e.preventDefault();
                          openItem(it);
                        }}
                        className="group absolute rounded border border-emerald-400 bg-emerald-400/10 shadow-[0_0_0_1px_rgba(0,0,0,0.35)] transition-[left,top,width,height,background-color] duration-300 ease-out hover:bg-emerald-400/25 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                        style={{
                          left: `${it.box.x * 100}%`,
                          top: `${it.box.y * 100}%`,
                          width: `${it.box.w * 100}%`,
                          height: `${it.box.h * 100}%`,
                          touchAction: "pan-y",
                        }}
                      >
                        <span className="absolute -top-4 left-0 max-w-full truncate rounded bg-emerald-500 px-1 py-[1px] text-[9px] font-medium leading-tight text-white shadow">
                          {it.name}
                          {typeof it.confidence === "number" && (
                            <span className="ml-1 opacity-80">{Math.round(it.confidence)}%</span>
                          )}
                          {it.enrichment && it.enrichment.category !== "plate" && (
                            <span className="ml-1 opacity-90">
                              ${it.enrichment.priceMin}–${it.enrichment.priceMax}
                            </span>
                          )}
                        </span>
                      </button>
                    ))}

                  {mode === "video" && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="h-1 w-1 rounded-full bg-white/50 shadow-[0_0_0_3px_rgba(255,255,255,0.15)]" />
                    </div>
                  )}
                </div>
              </div>

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
                  {videoPaused ? t("pause") : scanning ? t("analyzing") : "Live"}
                  {scanning && !videoPaused && (
                    <button
                      type="button"
                      onClick={() => setVideoPaused(true)}
                      className="ml-1 rounded-full border border-white/40 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-white/10"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              )}


              {uploaded && (
                <div className="absolute inset-0 z-20 bg-black">
                  <img
                    src={uploaded}
                    alt="Uploaded image ready to scan"
                    className="h-full w-full object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => setUploaded(null)}
                    aria-label="Remove uploaded image"
                    title="Remove uploaded image"
                    className="absolute right-2 top-2 rounded-full border border-primary/40 bg-black/70 p-2 text-primary backdrop-blur-sm transition-colors hover:bg-black/90"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <div className="pointer-events-none absolute inset-x-2 bottom-2 rounded-md bg-black/70 p-2 text-center text-[11px] text-white">
                    {mode === "document" ? "Uploaded document" : "Uploaded picture"}
                  </div>
                </div>
              )}


              {cameraZoom.scale > 1.01 && (
                <button
                  onClick={cameraZoom.reset}
                  className="absolute right-2 top-2 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-black/90"
                >
                  {cameraZoom.scale.toFixed(1)}× · reset
                </button>
              )}

              {isGuest && (
                <div className="absolute inset-x-2 bottom-2 rounded-xl bg-black/85 p-3 text-center text-xs text-white">
                  <p className="mb-2">Sign in for your {SIGNUP_GRANT} free credits and get started.</p>
                  <Link
                    to="/auth"
                    className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    {t("signIn")}
                  </Link>
                </div>
              )}

              {error && (
                <div className="pointer-events-none absolute inset-x-2 bottom-2 rounded-md bg-black/80 p-2 text-center text-xs text-white">
                  {error}
                </div>
              )}

            </div>

            {mode === "video" ? (
              <>
                {!isGuest && (
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
                          {t("resume")}
                        </>
                      ) : (
                        <>
                          <Pause className="mr-2 h-5 w-5" />
                          {t("pause")}
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      Tap a box for details.
                    </p>
                  </div>
                )}

                <div className="rounded-2xl border border-border bg-card">
                  <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
                    <div className="inline-flex rounded-full border border-border/60 bg-secondary p-0.5 text-[11px]">
                      <button
                        onClick={() => setListTab("items")}
                        className={`rounded-full px-2.5 py-0.5 font-medium transition-colors ${listTab === "items" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        {t("items")}
                      </button>
                      <button
                        onClick={() => setListTab("categories")}
                        className={`rounded-full px-2.5 py-0.5 font-medium transition-colors ${listTab === "categories" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        {t("categories")}
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground">
                        {visibleTracked.length}
                      </span>
                      {scanning && (
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  </div>
                  {visibleTracked.length === 0 ? (
                    <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                      {tracked.length > 0
                        ? "All detections filtered out. Adjust filters."
                        : "Point the camera at objects…"}
                    </div>
                  ) : listTab === "items" ? (
                    <ul className="divide-y divide-border/40">
                      {visibleTracked.map((it) => (
                        <TrackedRow
                          key={it.id}
                          item={it}
                          onOpen={() => openItem(it)}
                          onBlock={() => blockItem(it.name)}
                        />
                      ))}
                    </ul>
                  ) : (
                    <div>
                      {trackedByCategory.map(([cat, list]) => (
                        <div key={cat}>
                          <div className="sticky top-0 flex items-center justify-between border-b border-border/40 bg-card/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">
                            <span>{categoryLabel(cat)}</span>
                            <span className="rounded-full bg-primary/15 px-1.5 text-[10px] font-medium text-primary">
                              {list.length}
                            </span>
                          </div>
                          <ul className="divide-y divide-border/40">
                            {list.map((it) => (
                              <TrackedRow
                                key={it.id}
                                item={it}
                                onOpen={() => openItem(it)}
                                onBlock={() => blockItem(it.name)}
                              />
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              !isGuest && (
                <div className="flex flex-col items-center gap-2">
                  {(() => {
                    const isDocMode = mode === "document";
                    const freeScan = !isDocMode && credits.freeScanAvailable;
                    return (
                      <>
                        <Button
                          size="lg"
                          data-no-sound
                          onClick={capture}
                          disabled={
                            !freeScan &&
                            !credits.canAfford(isDocMode ? "document_scan" : "photo_scan")
                          }
                          className="w-full max-w-xs"
                        >
                          <Camera className="mr-2 h-5 w-5" />
                          {uploaded ? (
                            isDocMode ? (
                              "Scan the uploaded document"
                            ) : (
                              "Scan the uploaded picture"
                            )
                          ) : freeScan ? (
                            "Daily free scan available"
                          ) : (
                            <>
                              {isDocMode
                                ? "Scan document · "
                                : mode === "resale"
                                  ? "Resale scan · "
                                  : "Scan · "}
                              {scanEstimate[isDocMode ? "document" : "photo"].learned ? "~" : ""}
                              {scanEstimate[isDocMode ? "document" : "photo"].credits}
                            </>
                          )}
                        </Button>
                        {(isDocMode || mode === "photo" || mode === "resale") && (
                          <>
                            <input
                              ref={uploadInputRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                e.target.value = "";
                                if (!file) return;
                                const url = await fileToCompressedDataUrl(
                                  file,
                                  isDocMode ? 2200 : 1024,
                                  isDocMode ? 0.95 : 0.8,
                                );
                                if (!url) {
                                  setError("Could not read that image.");
                                  return;
                                }
                                setError(null);
                                setUploaded(url);
                              }}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => uploadInputRef.current?.click()}
                              className="w-full max-w-xs"
                            >
                              <Upload className="mr-2 h-4 w-4" />
                              {uploaded
                                ? "Choose a different image"
                                : isDocMode
                                  ? "Upload a document image"
                                  : "Upload a picture"}
                            </Button>
                          </>
                        )}
                        <p className="text-center text-[11px] text-muted-foreground">
                          {(() => {
                            const key: ScanMode = isDocMode ? "document" : "photo";
                            const est = scanEstimate[key];
                            const base = baseScanCost(key);
                            if (freeScan)
                              return `Your free daily scan — costs 0 credits. Balance: ${credits.balance}`;
                            return est.learned && est.credits > base
                              ? `Est. ~${est.credits} credits — ${base} to scan plus extra passes you usually run. Balance: ${credits.balance}`
                              : `Estimated cost: ${base} credits. Balance: ${credits.balance}`;
                          })()}
                        </p>
                        {!isDocMode && !freeScan && <FreeScanCountdown />}
                      </>
                    );
                  })()}
                </div>

              )
            )}

          </div>
        )}

        {snapshot && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <Button size="sm" variant="secondary" onClick={reset}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                {t("newScan")}
              </Button>
            </div>
            <div className="relative overflow-hidden rounded-2xl border border-border bg-black gold-glow">
              <div {...photoZoom.handlers} className="relative overflow-hidden">

                <div
                  className="relative w-full origin-center"
                  style={{
                    transform: `scale(${photoZoom.scale})`,
                    transition: photoZoom.pinching ? "none" : "transform 200ms ease-out",
                  }}
                >
                  <img
                    src={snapshot}
                    alt="Captured room"
                    className="block h-auto w-full"
                  />
                  {phase === "results" &&
                    visibleItems.map((it, i) => (
                      <button
                        key={i}
                        data-no-sound
                        onClick={(e) => {
                          e.preventDefault();
                          openItem(it);
                        }}
                        className="group absolute rounded-md border-2 border-primary/80 bg-primary/10 transition-all hover:bg-primary/25 focus:outline-none focus:ring-2 focus:ring-primary"
                        style={{
                          left: `${it.box.x * 100}%`,
                          top: `${it.box.y * 100}%`,
                          width: `${it.box.w * 100}%`,
                          height: `${it.box.h * 100}%`,
                          touchAction: "pan-y",
                        }}
                      >
                        <span className="absolute -top-6 left-0 max-w-full truncate rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground shadow">
                          {it.name}
                          {typeof it.confidence === "number" && (
                            <span className="ml-1 opacity-80">{Math.round(it.confidence)}%</span>
                          )}
                        </span>
                      </button>
                    ))}
                </div>
              </div>
              {phase === "analyzing" && (
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 bg-background/80 p-3 text-foreground backdrop-blur-sm">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <p className="text-sm">{t("analyzing")}</p>
                  <button
                    type="button"
                    onClick={cancelScan}
                    className="rounded-full border border-border px-3 py-1 text-[11px] font-medium text-foreground hover:border-primary hover:text-primary"
                  >
                    Cancel
                  </button>
                </div>
              )}

              <div className="absolute bottom-2 right-2 z-10 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSharePicture}
                  aria-label={t("share")}
                  title={t("share")}
                  className="rounded-full border border-primary/40 bg-black/70 p-2 text-primary backdrop-blur-sm transition-colors hover:bg-black/90"
                >
                  <Share2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleSavePicture}
                  aria-label={t("save")}
                  title={t("save")}
                  className="rounded-full border border-primary/40 bg-black/70 p-2 text-primary backdrop-blur-sm transition-colors hover:bg-black/90"
                >
                  <Download className="h-4 w-4" />
                </button>
              </div>
              {photoZoom.scale > 1.01 && (
                <button
                  onClick={photoZoom.reset}
                  className="absolute right-2 top-2 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-black/90"
                >
                  {photoZoom.scale.toFixed(1)}× · reset
                </button>
              )}
            </div>

            {error && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {phase === "results" && visibleItems.length > 0 && (
              <div>
                {(() => {
                  const resaleItems = visibleItems.filter((it) => it.resale);
                  if (!resaleItems.length) return null;
                  const total = resaleItems.reduce((s, it) => s + (it.resale?.typical ?? 0), 0);
                  const sellable = resaleItems.filter((it) => it.resale?.verdict === "sell");
                  const sellTotal = sellable.reduce((s, it) => s + (it.resale?.typical ?? 0), 0);
                  return (
                    <div className="mb-3 rounded-xl border border-primary/40 bg-primary/5 p-3">
                      <div className="text-xs font-medium text-muted-foreground">
                        Estimated resale value in this shot
                      </div>
                      <div className="mt-0.5 text-2xl font-bold text-primary tabular-nums">
                        ${total}
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {sellable.length} of {resaleItems.length} items worth listing · ~$
                        {sellTotal} from those
                      </p>
                    </div>
                  );
                })()}
                <div className="mb-2 flex items-center justify-between gap-2">

                  <div className="inline-flex rounded-full border border-border/60 bg-secondary p-0.5 text-[11px]">
                    <button
                      onClick={() => setListTab("items")}
                      className={`rounded-full px-2.5 py-0.5 font-medium transition-colors ${listTab === "items" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {t("items")}
                    </button>
                    <button
                      onClick={() => setListTab("categories")}
                      className={`rounded-full px-2.5 py-0.5 font-medium transition-colors ${listTab === "categories" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {t("categories")}
                    </button>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {visibleItems.length} · tap to explore
                  </span>
                </div>
                {listTab === "items" ? (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {visibleItems.map((it, i) => (
                      <PhotoItemCard
                        key={i}
                        item={it}
                        onOpen={() => openItem(it)}
                        onBlock={() => blockItem(it.name)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {itemsByCategory.map(([cat, list]) => (
                      <div
                        key={cat}
                        className="rounded-xl border border-border/60 bg-card p-2"
                      >
                        <div className="mb-2 flex items-center justify-between px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          <span>{categoryLabel(cat)}</span>
                          <span className="rounded-full bg-primary/15 px-1.5 text-[10px] font-medium text-primary">
                            {list.length}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {list.map((it, i) => (
                            <PhotoItemCard
                              key={i}
                              item={it}
                              onOpen={() => openItem(it)}
                              onBlock={() => blockItem(it.name)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {phase === "results" && visibleItems.length === 0 && !error && (
              <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
                {items.length > 0
                  ? "All items were hidden by your category filters. Open Filters and turn them back on."
                  : rawItemCount > 0
                    ? `${rawItemCount} item${rawItemCount === 1 ? " was" : "s were"} hidden by the people/body-part filter. Try another angle.`
                    : "Nothing identified in this shot. Try a closer, sharper photo with a clean lens."}
              </div>
            )}
            {phase === "results" && snapshot && mode !== "document" && (
              <div className="mt-4 flex flex-col items-center gap-2">
                <Button
                  data-no-sound
                  variant="outline"
                  onClick={() => {
                    void loadMore();
                  }}
                  disabled={loadingMore || !credits.signedIn}
                  className="border-primary/50 text-primary hover:bg-primary/10"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("loading")}
                    </>
                  ) : (
                    `${t("loadMore")} · ${CREDIT_COSTS.load_more}`
                  )}
                </Button>
                <p className="text-center text-[11px] text-muted-foreground">
                  {loadMoreNote ?? "Re-checks the same photo for objects the first pass missed."}
                </p>
              </div>
            )}

            {phase === "results" && mode === "document" && docPages.length > 0 && (
              <div className="mt-4 rounded-xl border border-primary/40 bg-card p-3">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
                  Document · {docPages.length} {docPages.length === 1 ? "page" : "pages"}
                </div>
                <DocumentTextBlock
                  text={docPages
                    .map((p, i) => (docPages.length > 1 ? `--- Page ${i + 1} ---\n${p}` : p))
                    .join("\n\n")}
                  onAddPage={addDocumentPage}
                />
              </div>
            )}

            {phase === "results" && (items.length > 0 || docPages.length > 0) && (
              <div className="mt-4 flex justify-center">
                <Button
                  data-no-sound
                  variant="outline"
                  onClick={() => {
                    setCollectionPrompt(true);
                  }}
                  className="border-primary/50 text-primary hover:bg-primary/10"
                >
                  <FolderPlus className="mr-2 h-4 w-4" />
                  Save to collection
                </Button>
              </div>
            )}




          </div>
        )}
      </main>

      <footer className="border-t border-border/60 bg-background/70 py-6 text-center text-xs text-muted-foreground backdrop-blur">
        <div className="mx-auto max-w-4xl px-4">
          <div className="mb-2 flex flex-wrap items-center justify-center gap-4">
            <Link to="/terms" className="hover:text-foreground hover:underline">
              {t("terms")}
            </Link>
            <Link to="/refund-policy" className="hover:text-foreground hover:underline">
              {t("refunds")}
            </Link>
            <Link to="/privacy" className="hover:text-foreground hover:underline">
              {t("privacy")}
            </Link>
            <Link to="/account/data" className="hover:text-foreground hover:underline">
              Delete my data
            </Link>
            <Link to="/account/delete" className="hover:text-foreground hover:underline">
              {t("deleteMyAccount")}
            </Link>

          </div>
          <p>© {new Date().getFullYear()} Scanything. All rights reserved. v{appVersion}</p>
          <div className="mt-3 flex items-center justify-center gap-4">
            <a
              href="https://x.com/scanythingapp"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="X / Twitter"
              className="inline-flex items-center justify-center rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X size={18} />
            </a>
            <a
              href="https://t.me/scanythingapp"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Telegram"
              className="inline-flex items-center justify-center rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M21.7 3.5c-.4-.3-.9-.3-1.3-.1L2.5 11.4c-.5.2-.8.7-.7 1.2.1.5.5.9 1 .9l4.4.1 1.6 5.6c.1.5.6.8 1.1.8.2 0 .4-.1.6-.2l3.2-2.4 3.2 2.4c.4.3 1 .3 1.4-.1.4-.3.5-.9.3-1.3l-2.6-5.1 5.3-7.3c.3-.4.2-1-.2-1.4z" />
              </svg>
            </a>
            <a
              href="mailto:scanythingapp@gmail.com"
              aria-label="Email"
              className="inline-flex items-center justify-center rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Mail size={18} />
            </a>
          </div>
        </div>
      </footer>

      {selected && (
        <DetailPanel
          item={selected}
          live={mode === "video"}
          historyId={historyIdRef.current}
          imageBase64={selectedImage}

          onClose={() => {
            setSelected(null);
            setSelectedImage(null);
          }}
        />
      )}

      {doorPrompt && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
          onClick={() => setDoorPrompt(null)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl border border-border bg-card p-5 shadow-xl sm:rounded-2xl gold-glow"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold gold-text">Which address is this?</h2>
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

      {/* Video scan warning for signed-in users */}
      <ScanHistorySheet open={historyOpen} onClose={() => setHistoryOpen(false)} />

      {queueOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
          onClick={() => setQueueOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-background p-4 gold-glow sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-2">
              <CloudOff className="h-4 w-4 text-primary" />
              <h2 className="flex-1 text-sm font-semibold text-foreground">Offline scans</h2>
              <button
                onClick={() => setQueueOpen(false)}
                className="rounded-full p-1 text-muted-foreground hover:text-foreground"
                aria-label={t("close")}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-3 text-[11px] text-muted-foreground">
              {online
                ? "You're back online — analyze these captures whenever you're ready."
                : "Still offline. These captures are stored on this device and can be analyzed once you're back online."}
            </p>
            <div className="space-y-2">
              {queued.map((q) => (
                <div
                  key={q.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-secondary/40 p-2"
                >
                  <img
                    src={q.dataUrl}
                    alt="Queued capture"
                    className="h-14 w-14 rounded-lg object-cover"
                  />
                  <div className="flex-1">
                    <div className="text-xs font-medium capitalize text-foreground">
                      {q.mode} scan
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(q.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    disabled={!online}
                    onClick={() => void analyzeQueued(q)}
                  >
                    Analyze
                  </Button>
                  <button
                    onClick={() => void dropQueued(q.id)}
                    className="rounded-md p-1.5 text-muted-foreground hover:text-destructive"
                    aria-label="Delete queued scan"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {queued.length === 0 && (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  Nothing queued right now.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {collectionPrompt && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setCollectionPrompt(false)}
        >
          <div
            className="w-full max-w-xs rounded-2xl border border-primary/40 bg-card p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-foreground">Save to collection</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Name the folder these results should be filed under, e.g. "Attic" or "Contracts".
            </p>
            <input
              autoFocus
              value={collectionName}
              onChange={(e) => setCollectionName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void saveToCollection();
              }}
              maxLength={60}
              placeholder="Collection name"
              className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setCollectionPrompt(false)}
                className="flex-1 rounded-full border border-border px-3 py-2 text-xs font-medium text-foreground hover:border-primary hover:text-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!collectionName.trim() || savingCollection}
                onClick={() => void saveToCollection()}
                className="flex-1 rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {savingCollection ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}


      {videoWarningOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setVideoWarningOpen(false)}
        >
          <div
            className="gold-glow w-full max-w-sm rounded-2xl border-2 border-primary/70 bg-card p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-primary">{t("warning")}</h2>
            <p className="mt-3 text-sm text-foreground">
              {t("videoDrainsCredits")}
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setVideoWarningOpen(false)}
                className="flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
              >
                {t("goBack")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setVideoWarningOpen(false);
                  switchMode("video");
                }}
                className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                {t("continueAction")}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>

  );
}



/** Session cache of AI translations, keyed by language + item, so reopening a box is instant. */
const TRANSLATION_CACHE = new Map<
  string,
  {
    language: string;
    translation: string;
    transliteration: string;
    description: string;
    category: string;
    labels: string[];
  }
>();

function DetailPanel({
  item,
  imageBase64,
  live = false,
  historyId = null,
  onClose,
}: {
  item: TrackedItem | DetectedItem;
  imageBase64: string | null;
  /** Opened from a live video-mode box: deep analysis is half price. */
  live?: boolean;
  /** Scan history row this item belongs to, so deep results persist. */
  historyId?: string | null;
  onClose: () => void;
}) {
  /** Documents are text-only follow-ups, so they use the cheaper deep-analysis price. */
  const isDocumentItem =
    ((item as TrackedItem).enrichment?.category ?? (item as DetectedItem).category) === "document";
  const deepReason: CreditReason = isDocumentItem
    ? "analyze_further_document"
    : live
      ? "analyze_further_live"
      : "analyze_further";


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
        confidence: item.confidence,
        resale: item.resale,
      };


  const panelCredits = useCreditsContext();
  const { language: appLanguage, t } = useLanguage();
  const [deep, setDeep] = useState<DeepAnalysis | null>(null);
  const [deepLoading, setDeepLoading] = useState(false);
  const [deepError, setDeepError] = useState<string | null>(null);

  const [translation, setTranslation] = useState<Translation | null>(null);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const showTranslate = hasNonLatin(name);

  const [extraShots, setExtraShots] = useState<string[]>([]);
  const [extraNote, setExtraNote] = useState("");

  const [showPreview, setShowPreview] = useState(false);
  const extraInputRef = useRef<HTMLInputElement | null>(null);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const replaceIndexRef = useRef<number | null>(null);

  // Resale listing draft state
  const [listingDraft, setListingDraft] = useState<ListingDraft | null>(null);
  /** Untranslated draft, kept so switching the box language re-translates cleanly. */
  const [listingBase, setListingBase] = useState<ListingDraft | null>(null);
  const [listingLoading, setListingLoading] = useState(false);
  const [listingOpen, setListingOpen] = useState(false);
  const [listingEdited, setListingEdited] = useState(false);
  const [listingError, setListingError] = useState<string | null>(null);



  const detectedCountry = useMemo(() => detectCountry(), []);
  const recommendedMarketplaces = useMemo(() => {
    if (!enrichment) return [];
    return getMarketplacesForItem(
      {
        name,
        category: enrichment.category,
        price: enrichment.priceMax,
        currency: enrichment.currency,
      },
      detectedCountry,
    );
  }, [enrichment, name, detectedCountry]);

  const whereToSell = useMemo(() => {
    if (!enrichment) return [];
    return getMarketplacesForItem(
      {
        name,
        category: enrichment.category,
        price: enrichment.priceMax,
        currency: enrichment.currency,
      },
      detectedCountry,
    ).slice(0, 3);
  }, [enrichment, name, detectedCountry]);

  /** Every marketplace the app knows about, alphabetical, for the full dropdown. */
  const allMarketplaces = useMemo(
    () =>
      [...MARKETPLACES]
        .sort((a, b) => a.label.localeCompare(b.label))
        .map((m) => ({ id: m.id, label: m.label })),
    [],
  );





  // Optional preview: how much extra photos are expected to sharpen the result.
  const resultPreview = useMemo(() => {
    const n = extraShots.length;
    const base = typeof enrichment?.confidence === "number" ? enrichment.confidence : 0.55;
    // diminishing returns: +12%, +7%, +4%, +2% of the remaining headroom gap
    const gains = [0, 0.12, 0.19, 0.23, 0.25];
    const gain = gains[Math.min(n, 4)] ?? 0.25;
    const expected = Math.min(0.97, base + (1 - base) * gain);

    const lo = enrichment?.priceMin;
    const hi = enrichment?.priceMax;
    let priceLo: number | undefined;
    let priceHi: number | undefined;
    if (typeof lo === "number" && typeof hi === "number" && hi >= lo) {
      // range narrows toward the midpoint as photos are added
      const narrow = [0, 0.18, 0.3, 0.38, 0.44][Math.min(n, 4)] ?? 0.44;
      const mid = (lo + hi) / 2;
      priceLo = Math.round(mid - (mid - lo) * (1 - narrow));
      priceHi = Math.round(mid + (hi - mid) * (1 - narrow));
    }
    return { count: n + 1, expected, base, priceLo, priceHi };
  }, [extraShots.length, enrichment?.confidence, enrichment?.priceMin, enrichment?.priceMax]);


  const addExtraShots = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const room = Math.max(0, 4 - extraShots.length);
    const picked = Array.from(files).slice(0, room);
    const shots = await Promise.all(picked.map((f) => fileToCompressedDataUrl(f)));
    setExtraShots((prev) =>
      [...prev, ...shots.filter((s): s is string => typeof s === "string")].slice(0, 4),
    );
  }, [extraShots.length]);

  const replaceExtraShot = useCallback(async (files: FileList | null) => {
    const idx = replaceIndexRef.current;
    replaceIndexRef.current = null;
    if (idx === null || !files || files.length === 0) return;
    const shot = await fileToCompressedDataUrl(files[0]);
    if (!shot) return;
    setExtraShots((prev) => prev.map((s, j) => (j === idx ? shot : s)));
  }, []);

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const moveExtraShot = useCallback((from: number, to: number) => {
    setExtraShots((prev) => {
      if (to < 0 || to >= prev.length || from === to) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  const runDeep = useCallback(async () => {
    if (!panelCredits.spend(deepReason)) return;
    if (!imageBase64) {
      setDeepError("No image available. Reopen from a scan.");
      return;
    }
    setDeepLoading(true);
    setDeepError(null);
    try {
      const result = await analyzeFurther({
        data: {
          name,
          imageBase64: imageBase64.replace(/^data:[^,]+,/, ""),
          extraImages: extraShots.map((s) => s.replace(/^data:[^,]+,/, "")),
          userNote: extraNote.trim() || undefined,
          live,
          document: isDocumentItem,

          environment: getPaddleEnvironment(),
        },
      });

      setDeep(result);
      if (historyId) {
        void saveScanHistoryItemDeep({ data: { id: historyId, name, deep: result } }).catch(
          () => {},
        );
      }
    } catch (e) {
      setDeepError(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      setDeepLoading(false);
    }
  }, [imageBase64, name, panelCredits, live, isDocumentItem, deepReason, historyId, extraShots, extraNote]);


  const generateListingFn = useServerFn(generateListingDraft);

  const runGenerateListing = useCallback(async () => {
    if (!panelCredits.spend("resale_listing")) return;
    if (!enrichment?.resale) return;
    setListingLoading(true);
    setListingError(null);
    try {
      const resale = enrichment.resale;
      const draft = await generateListingFn({
        data: {
          name,
          description: enrichment.description,
          category: enrichment.category,
          priceMin: enrichment.priceMin,
          priceMax: enrichment.priceMax,
          currency: enrichment.currency,
          resaleLow: resale.low,
          resaleTypical: resale.typical,
          resaleHigh: resale.high,
          conditionHint: "",
          environment: getPaddleEnvironment(),
        },
      });

      setListingBase(draft);
      setListingDraft(draft);
      setListingOpen(true);
      setListingEdited(false);
    } catch (e) {
      setListingError(e instanceof Error ? e.message : "Listing generation failed.");
    } finally {
      setListingLoading(false);
    }
  }, [panelCredits, enrichment, name, generateListingFn]);




  const runTranslate = useCallback(async () => {
    if (!panelCredits.spend("translate")) return;
    setTranslating(true);
    setTranslateError(null);
    try {
      const result = await translateText({ data: { text: name, environment: getPaddleEnvironment() } });
      setTranslation(result);
    } catch (e) {
      setTranslateError(e instanceof Error ? e.message : "Translation failed.");
    } finally {
      setTranslating(false);
    }
  }, [name, panelCredits]);

  const [namePickerOpen, setNamePickerOpen] = useState(false);
  /**
   * Language of this information box only. Independent of the account-tab
   * language: everything generated inside the box follows this.
   */
  const [boxLanguage, setBoxLanguage] = useState<string>("English");
  const [nameTranslating, setNameTranslating] = useState(false);
  const [nameTranslateError, setNameTranslateError] = useState<string | null>(null);
  const [nameTranslation, setNameTranslation] = useState<
    {
      language: string;
      translation: string;
      transliteration: string;
      description: string;
      category: string;
      labels: string[];
    } | null
  >(null);

  const PANEL_LABELS = useMemo(
    () => [t("estimatedPriceRange"), t("shopThisItem"), t("learnMore"), t("officialVehicleLookup")],
    [t],
  );

  const runNameTranslate = useCallback(
    async (language: string) => {
      setBoxLanguage(language);
      if (language === "English") {
        setNameTranslation(null);
        setNameTranslateError(null);
        setNamePickerOpen(false);
        return;
      }
      const cacheKey = `${language}|${name}|${enrichment?.description ?? ""}`;
      const cached = TRANSLATION_CACHE.get(cacheKey);
      if (cached) {
        setNameTranslation(cached);
        setNamePickerOpen(false);
        return;
      }
      setNameTranslating(true);
      setNameTranslateError(null);
      setNameTranslation(null);
      try {
        const result = await translateName({
          data: {
            text: name,
            targetLanguage: language,
            description: enrichment?.description ?? "",
            category: enrichment?.category ?? "",
            labels: PANEL_LABELS,
          },
        });
        const next = { language, ...result };
        TRANSLATION_CACHE.set(cacheKey, next);
        setNameTranslation(next);
        setNamePickerOpen(false);
      } catch (e) {
        setNameTranslateError(e instanceof Error ? e.message : "Translation failed.");
      } finally {
        setNameTranslating(false);
      }
    },
    [name, enrichment?.description, enrichment?.category, PANEL_LABELS],
  );

  /**
   * The box starts in the original (English) language. It only changes when the
   * user picks a language inside this box — the account-tab language never
   * affects the scanned content shown here.
   */


  /** Localized UI label helper: AI translation first, then the built-in dictionary. */
  const tl = useCallback(
    (i: number) => nameTranslation?.labels?.[i] || PANEL_LABELS[i] || "",
    [nameTranslation, PANEL_LABELS],
  );



  // --- Deep analysis auto-translation (follows the language picked above) ---
  const DEEP_LABELS = useMemo(
    () => [
      t("deepAnalysis"),
      t("confidence"),
      t("bestGuess"),
      t("buyExactProduct"),
      t("reviewsSpecs"),
    ],
    [t],
  );
  const [deepTranslation, setDeepTranslation] = useState<{
    language: string;
    description: string;
    labels: string[];
  } | null>(null);
  const deepLang = boxLanguage === "English" ? null : boxLanguage;

  useEffect(() => {
    if (!deep || !deepLang) {
      setDeepTranslation(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const r = await translateName({
          data: {
            text: name,
            targetLanguage: deepLang,
            description: deep.description ?? "",
            labels: DEEP_LABELS,
          },
        });
        if (!cancelled) {
          setDeepTranslation({ language: deepLang, description: r.description, labels: r.labels });
        }
      } catch {
        // Keep the English deep-analysis text if translation fails.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deep, deepLang, name, DEEP_LABELS]);

  /** Localized deep-analysis label helper. */
  const dl = useCallback(
    (i: number) => deepTranslation?.labels?.[i] || DEEP_LABELS[i] || "",
    [deepTranslation, DEEP_LABELS],
  );

  // --- Listing draft auto-translation (follows the box language) ---
  useEffect(() => {
    if (!listingBase) return;
    if (listingEdited) return;
    if (boxLanguage === "English") {
      setListingDraft(listingBase);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const r = await translateName({
          data: {
            text: listingBase.title,
            targetLanguage: boxLanguage,
            description: listingBase.description,
            category: listingBase.condition,
            labels: listingBase.keywords,
          },
        });
        if (cancelled) return;
        setListingDraft({
          ...listingBase,
          title: r.translation || listingBase.title,
          description: r.description || listingBase.description,
          condition: r.category || listingBase.condition,
          keywords: r.labels?.length ? r.labels : listingBase.keywords,
        });
      } catch {
        // Keep the original draft if translation fails.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listingBase, boxLanguage, listingEdited]);




  /** Everything the info box knows, summarized as the chat's starting context. */
  const askContext = useMemo(() => {
    const lines: string[] = [`Item: ${name}`];
    if (enrichment?.category) lines.push(`Category: ${enrichment.category}`);
    if (enrichment?.description) lines.push(`Description: ${enrichment.description}`);
    if (enrichment && enrichment.category !== "plate") {
      lines.push(
        `Estimated price range: ${enrichment.priceMin}-${enrichment.priceMax} ${enrichment.currency}`,
      );
    }
    if ("resale" in item && item.resale) {
      lines.push(
        `Second-hand resale: typical ${item.resale.typical} (${item.resale.low}-${item.resale.high} ${item.resale.currency}), verdict ${item.resale.verdict}. ${item.resale.reason ?? ""}`,
      );
    }
    if (deep) {
      lines.push(
        `Deep analysis: ${[deep.brand, deep.product].filter(Boolean).join(" ")} (${Math.round(deep.confidence)}% confidence). ${deep.description ?? ""}`,
      );
    }
    return lines.join("\n").slice(0, 4000);
  }, [name, enrichment, item, deep]);

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl border border-border bg-card p-5 shadow-xl sm:rounded-2xl gold-glow"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold gold-text">{name}</h2>
              <ConfidenceBadge
                value={isTracked(item) ? (item.confidence ?? item.enrichment?.confidence) : item.confidence}
              />
              <button
                type="button"
                onClick={() => setNamePickerOpen((v) => !v)}
                className="inline-flex items-center gap-1 rounded-full border border-primary/50 px-2 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/10"
              >
                <Languages className="h-3 w-3" />
                {t("translate")}
                <span className="text-muted-foreground">· {t("free")}</span>
              </button>
            </div>
            {namePickerOpen && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {NAME_LANGUAGES.map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => void runNameTranslate(lang)}
                    disabled={nameTranslating}
                    className="rounded-full border border-border px-2 py-0.5 text-[10px] text-foreground hover:border-primary hover:text-primary disabled:opacity-50"
                  >
                    {lang}
                  </button>
                ))}
              </div>
            )}
            {nameTranslating && (
              <p className="mt-1 text-[11px] text-muted-foreground">{t("translating")}</p>
            )}
            {nameTranslateError && (
              <p className="mt-1 text-[11px] text-destructive">{nameTranslateError}</p>
            )}
            {nameTranslation && !nameTranslating && (
              <p className="mt-1 text-sm font-medium text-primary">
                {nameTranslation.translation || "—"}
                <span className="ml-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {nameTranslation.language}
                </span>
                {nameTranslation.transliteration && (
                  <span className="ml-1 text-[11px] text-muted-foreground">
                    ({nameTranslation.transliteration})
                  </span>
                )}
              </p>
            )}
            {enrichment ? (
              <p className="text-xs capitalize text-muted-foreground">
                {nameTranslation?.category || enrichment.category}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">{t("analyzingDetails")}</p>
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
            {enrichment.category === "document" ? (
              <DocumentTextBlock
                text={enrichment.description}
                language={boxLanguage}
              />
            ) : (
              <p className="mt-3 text-sm leading-relaxed">
                {nameTranslation?.description || enrichment.description}
              </p>
            )}

            {!["plate", "document"].includes(enrichment.category) && (
              <div className="mt-4 rounded-lg bg-secondary p-3">
                <div className="text-xs font-medium text-muted-foreground">
                  {tl(0)}
                </div>
                <div className="text-xl font-semibold text-foreground">
                  ${enrichment.priceMin}
                  <span className="text-muted-foreground"> – </span>${enrichment.priceMax}
                  <span className="ml-1 text-xs text-muted-foreground">
                    {enrichment.currency}
                  </span>
                </div>
              </div>
            )}

            {"resale" in item && item.resale && (
              <div className="mt-4 rounded-lg border border-primary/40 bg-primary/5 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-medium text-muted-foreground">
                    {t("resaleValue")}
                  </div>
                  <span
                    className={`rounded-full border px-2 py-[2px] text-[10px] font-bold uppercase leading-none ${
                      item.resale.verdict === "sell"
                        ? "border-primary/60 bg-primary/20 text-primary"
                        : "border-border bg-secondary text-muted-foreground"
                    }`}
                  >
                    {item.resale.verdict === "sell" ? t("worthSelling") : t("notWorthIt")}
                  </span>
                </div>
                <div className="mt-1 text-xl font-semibold text-foreground tabular-nums">
                  ${item.resale.typical}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {t("typical")} (${item.resale.low}–${item.resale.high} {item.resale.currency})
                  </span>
                </div>

                {item.resale.reason && (
                  <p className="mt-1.5 text-xs text-muted-foreground">{item.resale.reason}</p>
                )}
                <div className="mt-3">
                  <h4 className="text-xs font-medium text-primary">{t("whereToSell")}</h4>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="mt-2 inline-flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-accent"
                      >
                        {t("allMarketplaces")}
                        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
                      {allMarketplaces.map((m) => (
                        <DropdownMenuItem key={m.id} asChild>
                          <a
                            href={getMarketplaceListingUrl(m.id, { name })}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between gap-4"
                          >
                            {m.label}
                            <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                          </a>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>


                <button
                  onClick={runGenerateListing}
                  disabled={listingLoading || listingOpen}
                  className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-lg border border-primary/60 bg-primary/20 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/30 disabled:opacity-50"
                >
                  {listingLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("generating")}
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      {t("generateListing")}
                    </>
                  )}
                </button>
                {listingError && (
                  <p className="mt-2 text-xs text-destructive">{listingError}</p>
                )}
              </div>
            )}

            {listingOpen && listingDraft && (
              <div className="mt-4 rounded-lg border border-primary/40 bg-primary/5 p-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-medium text-primary">{t("listingDraft")}</h4>
                  <button
                    onClick={() => {
                      setListingOpen(false);
                      setListingDraft(null);
                    }}
                    className="rounded-full p-1 text-muted-foreground hover:bg-accent"
                    aria-label="Close listing"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-3 space-y-3">
                  <div>
                    <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {t("listingTitle")}
                    </label>
                    {listingEdited ? (
                      <input
                        type="text"
                        value={listingDraft.title}
                        onChange={(e) =>
                          setListingDraft((prev) => (prev ? { ...prev, title: e.target.value } : prev))
                        }
                        className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                      />
                    ) : (
                      <p className="text-sm font-semibold text-foreground">{listingDraft.title}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {t("listingDescription")}
                    </label>
                    {listingEdited ? (
                      <textarea
                        value={listingDraft.description}
                        onChange={(e) =>
                          setListingDraft((prev) =>
                            prev ? { ...prev, description: e.target.value } : prev
                          )
                        }
                        className="mt-1 min-h-[80px] w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                      />
                    ) : (
                      <p className="text-sm leading-relaxed text-foreground">
                        {listingDraft.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    <div>
                      <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {t("conditionLabel")}
                      </label>
                      <p className="text-sm font-medium text-foreground">{listingDraft.condition}</p>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {t("listingPrice")}
                      </label>
                      <p className="text-sm font-medium text-foreground">
                        {listingDraft.price} {listingDraft.currency}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {t("listingKeywords")}
                    </label>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {listingDraft.keywords.map((k) => (
                        <span
                          key={k}
                          className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {k}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {t("recommendedForThisItem")}
                      </label>
                      {detectedCountry && (
                        <span className="text-[10px] text-muted-foreground">
                          {t("region")}: {detectedCountry} ({t("autoDetected")})
                        </span>
                      )}

                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {whereToSell.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center justify-between rounded-lg border border-primary/40 bg-background px-3 py-2"
                        >
                          <a
                            href={m.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium hover:underline"
                          >
                            {m.label}
                          </a>
                          <a
                            href={getMarketplaceListingUrl(m.id, { name })}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 inline-flex items-center gap-1 rounded-md border border-primary/50 px-2 py-1 text-[10px] font-medium text-primary hover:bg-primary/10"
                          >
                            List
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      ))}
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="mt-2 inline-flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-accent"
                        >
                          {t("allMarketplaces")}
                          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
                        {allMarketplaces
                          .filter((m) => !whereToSell.some((w) => w.id === m.id))
                          .map((m) => (
                            <DropdownMenuItem key={m.id} asChild>
                              <a
                                href={getMarketplaceListingUrl(m.id, { name })}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between gap-4"
                              >
                                {m.label}
                                <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                              </a>
                            </DropdownMenuItem>
                          ))}
                      </DropdownMenuContent>
                    </DropdownMenu>


                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-accent"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          {t("copyListing")}
                          <ChevronDown className="h-3 w-3 opacity-60" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem
                          onClick={() => {
                            const text = `${listingDraft.title}\n\n${listingDraft.description}\n\nPrice: ${listingDraft.price} ${listingDraft.currency}\nCondition: ${listingDraft.condition}\nKeywords: ${listingDraft.keywords.join(", ")}`;
                            navigator.clipboard
                              .writeText(text)
                              .then(() => toast.success(t("listingCopied")))
                              .catch(() => toast.error("Copy failed"));
                          }}
                        >
                          Generic listing
                        </DropdownMenuItem>
                        {recommendedMarketplaces.slice(0, 6).map((m) => (
                          <DropdownMenuItem
                            key={m.id}
                            onClick={() => {
                              navigator.clipboard
                                .writeText(formatListingForMarketplace(listingDraft, m.id))
                                .then(() => toast.success(`Copied for ${m.label}`))
                                .catch(() => toast.error("Copy failed"));
                            }}
                          >
                            Copy for {m.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <button
                      onClick={() => setListingEdited((prev) => !prev)}
                      className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-accent"
                    >
                      {listingEdited ? t("saveListing") : t("editListing")}
                    </button>
                  </div>

                </div>
              </div>
            )}

            <div className="mt-4 rounded-lg border border-border bg-background/60 p-3">
              <h4 className="text-xs font-medium text-foreground">{t("priceCompare")}</h4>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {getPriceCompareLinks(name).map((l) => (
                  <a
                    key={l.label}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-accent"
                  >
                    {l.label}
                    <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                  </a>
                ))}
              </div>
            </div>




            {(!["plate", "document"].includes(enrichment.category) ||
              ("resale" in item && item.resale)) && (
              <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
                {t("priceDisclaimer")}
              </p>
            )}





            <div className="mt-4 flex flex-col gap-2">
              <a
                href={enrichment.searchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
              >
                {tl(1)}
                <ExternalLink className="h-4 w-4 opacity-60" />
              </a>
              <a
                href={enrichment.infoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
              >
                {tl(2)}
                <ExternalLink className="h-4 w-4 opacity-60" />
              </a>
              <a
                href={getManualSearchUrl(name)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
              >
                {t("manualSupport")}
                <ExternalLink className="h-4 w-4 opacity-60" />
              </a>


              <div className="rounded-lg border border-border bg-background/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-foreground">
                    {t("addPhotoOfItem")}
                    {extraShots.length > 0 && (
                      <span className="ml-1 text-muted-foreground">
                        · {extraShots.length + 1} {t("photosLabel")}
                      </span>
                    )}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={extraShots.length >= 4 || deepLoading}
                    onClick={() => extraInputRef.current?.click()}
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    {t("addPhotoOfItem")}
                  </Button>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  {t("extraPhotosHint")}
                </p>
                <div className="mt-3 border-t border-border pt-2">
                  <label
                    htmlFor="item-extra-note"
                    className="text-[11px] font-medium text-foreground"
                  >
                    {t("extraNoteLabel")}
                  </label>
                  <textarea
                    id="item-extra-note"
                    value={extraNote}
                    onChange={(e) => setExtraNote(e.target.value.slice(0, 300))}
                    disabled={deepLoading}
                    rows={2}
                    placeholder={t("extraNotePlaceholder")}
                    className="mt-1 w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] leading-relaxed text-muted-foreground">
                      {t("extraNoteHint")}
                    </p>
                    <span className="text-[10px] text-muted-foreground">{extraNote.length}/300</span>
                  </div>
                </div>

                <input
                  ref={extraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    void addExtraShots(e.target.files);
                    e.target.value = "";
                  }}
                />
                <input
                  ref={replaceInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    void replaceExtraShot(e.target.files);
                    e.target.value = "";
                  }}
                />
                {extraShots.length > 0 && (
                  <>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {extraShots.map((src, i) => (
                        <div
                          key={i}
                          className={`relative ${dragIndex === i ? "opacity-50" : ""}`}
                          draggable={!deepLoading}
                          onDragStart={() => setDragIndex(i)}
                          onDragEnd={() => setDragIndex(null)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (dragIndex !== null) moveExtraShot(dragIndex, i);
                            setDragIndex(null);
                          }}
                        >
                          <button
                            type="button"
                            disabled={deepLoading}
                            onClick={() => {
                              replaceIndexRef.current = i;
                              replaceInputRef.current?.click();
                            }}
                            className="group block h-14 w-14 cursor-grab overflow-hidden rounded-md border border-border active:cursor-grabbing"
                            title={t("replacePhoto")}
                            aria-label={t("replacePhoto")}
                          >
                            <img
                              src={src}
                              alt={`${name} ${i + 2}`}
                              className="h-full w-full object-cover transition group-hover:opacity-60"
                            />
                            <span className="pointer-events-none absolute inset-0 hidden items-center justify-center group-hover:flex">
                              <RefreshCw className="h-4 w-4 text-foreground" />
                            </span>
                          </button>
                          <span className="pointer-events-none absolute bottom-0 left-0 rounded-tr-md bg-background/80 px-1 text-[10px] leading-tight text-muted-foreground">
                            {i + 1}
                          </span>
                          <button
                            type="button"
                            disabled={deepLoading}
                            onClick={() => setExtraShots((prev) => prev.filter((_, j) => j !== i))}
                            className="absolute -right-1.5 -top-1.5 rounded-full bg-background p-0.5 text-muted-foreground shadow hover:text-destructive"
                            title={t("removePhoto")}
                            aria-label={t("removePhoto")}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                          <div className="mt-1 flex justify-center gap-1">
                            <button
                              type="button"
                              disabled={deepLoading || i === 0}
                              onClick={() => moveExtraShot(i, i - 1)}
                              className="rounded px-1 text-[11px] leading-none text-muted-foreground hover:text-foreground disabled:opacity-30"
                              title={t("movePhotoLeft")}
                              aria-label={t("movePhotoLeft")}
                            >
                              ◀
                            </button>
                            <button
                              type="button"
                              disabled={deepLoading || i === extraShots.length - 1}
                              onClick={() => moveExtraShot(i, i + 1)}
                              className="rounded px-1 text-[11px] leading-none text-muted-foreground hover:text-foreground disabled:opacity-30"
                              title={t("movePhotoRight")}
                              aria-label={t("movePhotoRight")}
                            >
                              ▶
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-[11px] text-muted-foreground">{t("tapPhotoToReplace")}</p>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={deepLoading}
                        onClick={() => setExtraShots([])}
                        className="h-7 px-2 text-[11px]"
                      >
                        {t("removeAllPhotos")}
                      </Button>
                    </div>
                  </>
                )}
                <div className="mt-3 border-t border-border pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPreview((v) => !v)}
                    className="flex w-full items-center justify-between text-[11px] font-medium text-foreground"
                  >
                    <span>{t("expectedResultPreview")}</span>
                    <span className="text-muted-foreground">
                      {showPreview ? t("hidePreview") : t("showPreview")}
                    </span>
                  </button>

                  {showPreview && (
                    <div className="mt-2 space-y-2">
                      <div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">
                            {t("expectedConfidence")} · {resultPreview.count} {t("photosLabel")}
                          </span>
                          <span className="font-semibold text-foreground">
                            {Math.round(resultPreview.expected * 100)}%
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-300"
                            style={{ width: `${Math.round(resultPreview.expected * 100)}%` }}
                          />
                        </div>
                      </div>

                      {resultPreview.priceLo !== undefined && resultPreview.priceHi !== undefined && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">{t("expectedPriceRange")}</span>
                          <span className="font-semibold text-foreground">
                            {enrichment?.currency ?? "$"}
                            {resultPreview.priceLo} – {enrichment?.currency ?? "$"}
                            {resultPreview.priceHi}
                          </span>
                        </div>
                      )}

                      <p className="text-[10px] leading-relaxed text-muted-foreground">
                        {extraShots.length < 4 ? `${t("previewAddMore")} ` : ""}
                        {t("previewPhotoQualityTip")} {t("previewEstimateNote")}
                      </p>
                    </div>
                  )}
                </div>
              </div>


              <Button
                variant="secondary"
                onClick={runDeep}
                disabled={deepLoading || !imageBase64 || !panelCredits.canAfford(deepReason)}
                className="justify-start"
              >
                {deepLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("analyzing")}
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    {extraShots.length > 0
                      ? `${t("reanalyzeWithPhotos")} (${extraShots.length + 1})`
                      : t("analyzeFurther")}{" "}
                    · {CREDIT_COSTS[deepReason]}

                  </>
                )}
              </Button>

              {showTranslate && (
                <Button
                  variant="secondary"
                  onClick={runTranslate}
                  disabled={translating || !panelCredits.canAfford("translate")}
                  className="justify-start"
                >
                  {translating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("translating")}
                    </>
                  ) : (
                    <>
                      <Languages className="mr-2 h-4 w-4" />
                      {t("translate")} · {CREDIT_COSTS.translate}
                    </>
                  )}
                </Button>
              )}
            </div>

            {deepError && (
              <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                {deepError}
              </div>
            )}
            {deep && (
              <div className="mt-4 rounded-xl border border-primary/40 bg-primary/5 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                  {dl(0)} · {Math.round(deep.confidence)}% {dl(1)}
                </div>
                <div className="mt-1 text-sm font-semibold">
                  {[deep.brand, deep.product].filter(Boolean).join(" — ") || dl(2)}
                </div>
                {deep.description && (
                  <p className="mt-1 text-sm leading-relaxed">
                    {deepTranslation?.description || deep.description}
                  </p>
                )}
                {enrichment && enrichment.category !== "plate" && (deep.priceMin > 0 || deep.priceMax > 0) && (
                  <div className="mt-2 text-sm font-medium text-primary">
                    ${deep.priceMin}–${deep.priceMax} {deep.currency}
                  </div>
                )}
                <div className="mt-2 flex flex-col gap-2">
                  {deep.buyUrl && (
                    <a
                      href={deep.buyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-accent"
                    >
                      {dl(3)}
                      <ExternalLink className="h-4 w-4 opacity-60" />
                    </a>
                  )}
                  {deep.infoUrl && (
                    <a
                      href={deep.infoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-accent"
                    >
                      {dl(4)}
                      <ExternalLink className="h-4 w-4 opacity-60" />
                    </a>
                  )}

                </div>
              </div>
            )}

            {translateError && (
              <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                {translateError}
              </div>
            )}
            {translation && (
              <div className="mt-4 rounded-xl border border-primary/40 bg-primary/5 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                  {t("translationLabel")}
                  {translation.language && ` · ${translation.language}`}
                  {translation.script && ` (${translation.script})`}
                </div>
                {translation.translation ? (
                  <div className="mt-1 text-sm font-medium">{translation.translation}</div>
                ) : (
                  <div className="mt-1 text-sm text-muted-foreground">
                    {t("couldNotTranslate")}
                  </div>
                )}
                {translation.transliteration && (
                  <div className="text-xs text-muted-foreground">
                    {t("romanized")}: {translation.transliteration}
                  </div>
                )}
                {translation.note && (
                  <p className="mt-1 text-xs text-muted-foreground">{translation.note}</p>
                )}
                <a
                  href={`https://translate.google.com/?sl=${encodeURIComponent(translation.languageCode || "auto")}&tl=${LANGUAGE_TAG[appLanguage]}&text=${encodeURIComponent(name)}&op=translate`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-accent"
                >
                  {t("openInGoogleTranslate")}
                  <ExternalLink className="h-4 w-4 opacity-60" />
                </a>
              </div>
            )}

            <Button
              variant="secondary"
              className="mt-4 w-full justify-center"
              onClick={() => {
                void shareScanCard({
                  name,
                  category: enrichment?.category,
                  priceLine:
                    enrichment && enrichment.category !== "plate"
                      ? `$${enrichment.priceMin} – $${enrichment.priceMax} ${enrichment.currency}`
                      : undefined,
                  resaleLine:
                    "resale" in item && item.resale
                      ? `Resale ~$${item.resale.typical} ${item.resale.currency} · ${item.resale.verdict === "sell" ? t("worthSelling") : t("notWorthIt")}`
                      : undefined,
                  imageDataUrl: imageBase64,
                }).then((r) => {
                  if (r === "downloaded") toast.success(t("shareAsImage"));
                  if (r === "failed") toast.error(t("tryAgain"));
                });
              }}
            >
              <Share2 className="mr-2 h-4 w-4" />
              {t("shareAsImage")}
            </Button>

            <AskAiBlock
              itemName={name}
              imageBase64={imageBase64}
              language={boxLanguage}
              context={askContext}
            />
          </>
        ) : (
          <div className="mt-6 flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("loadingDetails")}
          </div>
        )}

      </div>
    </div>
  );
}

/**
 * In-app chat about one scanned item. The info box context (and the photo) are
 * attached automatically; the user only types the question.
 */
function AskAiBlock({
  itemName,
  imageBase64,
  language,
  context,
}: {
  itemName: string;
  imageBase64: string | null;
  language: string;
  context: string;
}) {
  const { t } = useLanguage();
  const credits = useCreditsContext();
  const ask = useServerFn(askAboutItem);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages, busy]);

  const send = useCallback(async () => {
    const question = input.trim();
    if (!question || busy) return;
    if (!credits.spend("ask_ai")) return;
    const next = [...messages, { role: "user" as const, content: question }];
    setMessages(next);
    setInput("");
    setBusy(true);
    setError(null);
    try {
      const res = await ask({
        data: {
          context,
          language,
          imageBase64: imageBase64 ? imageBase64.replace(/^data:[^,]+,/, "") : undefined,
          messages: next.slice(-12),
          environment: getPaddleEnvironment(),
        },
      });
      setMessages((prev) => [...prev, { role: "assistant", content: res.answer }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not get an answer.");
    } finally {
      setBusy(false);
    }
  }, [input, busy, credits, messages, ask, context, language, imageBase64]);

  return (
    <div className="mt-4 rounded-xl border border-primary/40 bg-primary/5 p-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
          <MessageCircle className="h-4 w-4" />
          {t("askAi")}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {CREDIT_COSTS.ask_ai} · {open ? t("hidePreview") : t("showPreview")}
        </span>
      </button>

      {open && (
        <div className="mt-3">
          <div className="flex items-start gap-2 rounded-lg border border-border bg-background/60 p-2">
            {imageBase64 && (
              <img
                src={imageBase64}
                alt={itemName}
                className="h-10 w-10 shrink-0 rounded object-cover"
              />
            )}
            <p className="line-clamp-3 text-[11px] leading-relaxed text-muted-foreground">
              {t("askAiContext")}: {context.replace(/\n/g, " · ")}
            </p>
          </div>

          {messages.length > 0 && (
            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={
                    m.role === "user"
                      ? "ml-auto max-w-[85%] rounded-lg bg-primary px-3 py-2 text-xs text-primary-foreground"
                      : "max-w-[95%] whitespace-pre-wrap text-xs leading-relaxed text-foreground"
                  }
                >
                  {m.content}
                </div>
              ))}
              {busy && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t("askAiThinking")}
                </div>
              )}
              <div ref={endRef} />
            </div>
          )}

          {error && (
            <div className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
              {error}
            </div>
          )}

          <div className="mt-3 flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={2}
              maxLength={2000}
              placeholder={t("askAiPlaceholder")}
              className="min-h-[44px] flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
            <Button
              type="button"
              size="icon"
              onClick={() => void send()}
              disabled={busy || !input.trim() || !credits.canAfford("ask_ai")}
              aria-label={t("askAi")}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function TrackedRow({
  item,
  onOpen,
  onBlock,
}: {
  item: TrackedItem;
  onOpen: () => void;
  onBlock: () => void;
}) {
  return (
    <li className="flex items-stretch">
      <button
        onClick={onOpen}
        className="flex flex-1 items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-accent"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <div className="truncate text-sm font-medium">{item.name}</div>
            <ConfidenceBadge value={item.confidence} />
          </div>
          {item.enrichment ? (
            <div className="truncate text-[11px] capitalize text-muted-foreground">
              {item.enrichment.category}
            </div>
          ) : (
            <div className="text-[11px] text-muted-foreground">analyzing…</div>
          )}
        </div>
        {item.enrichment && item.enrichment.category !== "plate" ? (
          <div className="shrink-0 text-xs font-semibold text-primary">
            ${item.enrichment.priceMin}–${item.enrichment.priceMax}
          </div>
        ) : item.enrichment ? null : (
          <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />
        )}
      </button>
      <button
        onClick={onBlock}
        title="Remove & don't rescan for 1 min"
        aria-label={`Remove ${item.name} for 1 minute`}
        className="flex items-center justify-center px-3 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}

function PhotoItemCard({
  item,
  onOpen,
  onBlock,
}: {
  item: DetectedItem;
  onOpen: () => void;
  onBlock: () => void;
}) {
  return (
    <div className="relative rounded-lg border border-border/60 bg-card transition-colors hover:border-primary">
      <button
        onClick={onOpen}
        className="block w-full rounded-lg p-3 pr-8 text-left transition-colors hover:bg-accent"
      >
        <div className="flex items-center gap-1.5">
          <div className="text-sm font-medium">{item.name}</div>
          <ConfidenceBadge value={item.confidence} />
        </div>
        <div className="text-xs text-muted-foreground capitalize">{item.category}</div>
        {item.category !== "plate" && (
          <div className="mt-1 text-xs font-medium text-primary">
            ${item.priceMin}–${item.priceMax}
          </div>
        )}
        {item.resale && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <span
              className={`rounded-full border px-1.5 py-[1px] text-[10px] font-bold uppercase leading-none ${
                item.resale.verdict === "sell"
                  ? "border-primary/50 bg-primary/15 text-primary"
                  : "border-border bg-secondary text-muted-foreground"
              }`}
            >
              {item.resale.verdict === "sell" ? "Worth selling" : "Keep"}
            </span>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              ~${item.resale.typical} used
            </span>
          </div>
        )}

      </button>
      <button
        onClick={onBlock}
        title="Remove & don't rescan for 1 min"
        aria-label={`Remove ${item.name} for 1 minute`}
        className="absolute right-1.5 top-1.5 rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}


function ConfidenceBadge({ value, className = "" }: { value?: number; className?: string }) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const tone =
    v >= 75
      ? "border-primary/50 bg-primary/15 text-primary"
      : v >= 50
        ? "border-border bg-secondary text-foreground"
        : "border-destructive/40 bg-destructive/10 text-destructive";
  return (
    <span
      title={`AI confidence: ${v}%`}
      className={`inline-flex shrink-0 items-center rounded-full border px-1.5 py-[1px] text-[10px] font-semibold leading-none tabular-nums ${tone} ${className}`}
    >
      {v}%
    </span>
  );
}

/** Scanned document text with copy + inline edit controls. */
function DocumentTextBlock({
  text,
  onAddPage,
  language,
}: {
  text: string;
  onAddPage?: () => void;
  /** When provided, the block follows this language instead of its own picker. */
  language?: string;
}) {
  const [value, setValue] = useState(text);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmSummary, setConfirmSummary] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  /** Original (untranslated) text, kept so the user can switch back and forth. */
  const [base, setBase] = useState(text);
  const [translatingDoc, setTranslatingDoc] = useState(false);
  const [langPickerOpen, setLangPickerOpen] = useState(false);
  /** Language of this text block only — never tied to the account-tab language. */
  const [localLang, setLocalLang] = useState<string>("English");
  /** Bumped every time the user picks a language, so re-picking the same one re-runs. */
  const [langNonce, setLangNonce] = useState(0);
  const docLanguage = language ?? localLang;
  const docCredits = useCreditsContext();

  useEffect(() => {
    setValue(text);
    setBase(text);
    setEditing(false);
    setLangNonce(0);
  }, [text]);

  // Translate the scanned text back and forth as the chosen language changes.
  useEffect(() => {
    if (!base.trim()) return;
    // Untouched blocks show the original scan; only skip work before any pick.
    if (langNonce === 0 && !language) {
      setValue(base);
      return;
    }
    let cancelled = false;
    setTranslatingDoc(true);
    void (async () => {
      try {
        const result = await translateDocument({
          data: { text: base.slice(0, 60000), targetLanguage: docLanguage },
        });
        if (!cancelled && result.text) setValue(result.text);
      } catch (e) {
        if (!cancelled)
          toast.error(e instanceof Error ? e.message : "Could not translate the text");
      } finally {
        if (!cancelled) setTranslatingDoc(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [base, docLanguage, langNonce, language]);




  const runSummary = async () => {
    setConfirmSummary(false);
    if (!value.trim()) return toast.error("No text to summarize");
    if (!docCredits.spend("document_scan")) return;
    setSummarizing(true);
    try {
      const result = await summarizeDocument({
        data: { text: value.slice(0, 40000), environment: getPaddleEnvironment() },
      });
      if (result.summary) {
        setBase(result.summary);
        setValue(result.summary);
        toast.success("Summary ready");
      } else {
        toast.error("Could not summarize the text");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not summarize the text");
    } finally {
      setSummarizing(false);
    }
  };


  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success("Text copied");
    } catch {
      toast.error("Could not copy text");
    }
  };

  const fileBase = `scanything-document-${new Date().toISOString().slice(0, 10)}`;

  const download = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const exportTxt = () => {
    if (!value.trim()) return toast.error("No text to export");
    download(new Blob([value], { type: "text/plain;charset=utf-8" }), `${fileBase}.txt`);
    toast.success("Saved .txt");
  };

  const exportPdf = async () => {
    if (!value.trim()) return toast.error("No text to export");
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const margin = 48;
      const width = doc.internal.pageSize.getWidth() - margin * 2;
      const height = doc.internal.pageSize.getHeight();
      doc.setFont("courier", "normal");
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(value, width) as string[];
      let y = margin;
      for (const line of lines) {
        if (y > height - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(line, margin, y);
        y += 14;
      }
      doc.save(`${fileBase}.pdf`);
      toast.success("Saved .pdf");
    } catch {
      toast.error("Could not create PDF");
    }
  };

  return (
    <div className="mt-3">
      {editing ? (
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={Math.min(20, Math.max(6, value.split("\n").length + 1))}
          className="w-full rounded-lg border border-primary/40 bg-secondary p-3 font-mono text-xs leading-relaxed text-foreground outline-none focus:border-primary"
        />
      ) : (
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-secondary p-3 font-mono text-xs leading-relaxed text-foreground">
          {value || "No text detected"}
        </pre>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex items-center gap-1 rounded-full border border-primary/50 px-3 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy to clipboard"}
        </button>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-[11px] font-medium text-foreground hover:border-primary hover:text-primary"
        >
          <Pencil className="h-3 w-3" />
          {editing ? "Done editing" : "Edit text"}
        </button>
        <button
          type="button"
          onClick={exportTxt}
          className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-[11px] font-medium text-foreground hover:border-primary hover:text-primary"
        >
          <Download className="h-3 w-3" />
          Export .txt
        </button>
        <button
          type="button"
          onClick={() => void exportPdf()}
          className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-[11px] font-medium text-foreground hover:border-primary hover:text-primary"
        >
          <FileText className="h-3 w-3" />
          Export .pdf
        </button>
        <button
          type="button"
          disabled={summarizing}
          onClick={() => setConfirmSummary(true)}
          className="inline-flex items-center gap-1 rounded-full border border-primary/50 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
        >
          <Sparkles className="h-3 w-3" />
          {summarizing ? "Summarizing…" : "Summarize"}
        </button>
        {!language && (
          <button
            type="button"
            disabled={translatingDoc}
            onClick={() => setLangPickerOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full border border-primary/50 px-3 py-1 text-[11px] font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
          >
            <Languages className="h-3 w-3" />
            {translatingDoc ? "Translating…" : `Language: ${docLanguage}`}
          </button>
        )}

        {onAddPage && (
          <button
            type="button"
            onClick={onAddPage}
            className="inline-flex items-center gap-1 rounded-full border border-primary/50 px-3 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"
          >
            <Plus className="h-3 w-3" />
            Add page
          </button>
        )}
      </div>


      {!language && langPickerOpen && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {["English", ...NAME_LANGUAGES.filter((l) => l !== "English")].map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => {
                setLocalLang(lang);
                setLangNonce((n) => n + 1);

                setLangPickerOpen(false);
              }}
              disabled={translatingDoc}
              className="rounded-full border border-border px-2 py-0.5 text-[10px] text-foreground hover:border-primary hover:text-primary disabled:opacity-50"
            >
              {lang}
            </button>
          ))}
        </div>
      )}

      {confirmSummary && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-xs rounded-2xl border border-primary/40 bg-card p-4 text-center shadow-xl">
            <p className="text-sm font-semibold text-foreground">Are you sure?</p>
            <p className="mt-1 text-xs text-muted-foreground">
              The scanned text will be replaced by the summary.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmSummary(false)}
                className="flex-1 rounded-full border border-border px-3 py-2 text-xs font-medium text-foreground hover:border-primary hover:text-primary"
              >
                Go back
              </button>
              <button
                type="button"
                onClick={() => void runSummary()}
                className="flex-1 rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Summarize
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
