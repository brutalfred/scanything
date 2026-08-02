import logoAsset from "@/assets/scanything-logo.png.asset.json";
import { createFileRoute, Link } from "@tanstack/react-router";
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
  ChevronDown,
} from "lucide-react";

import { toast } from "sonner";


import {
  analyzeRoom,
  analyzeDocument,
  quickScan,
  enrichItem,
  analyzeFurther,
  translateText,
  translateName,
  personInfo,
  personSearch,
  type DetectedItem,
  type QuickItem,
  type DeepAnalysis,
  type Translation,
  type PersonInfo,
  type PersonMatch,

} from "@/lib/analyze-room.functions";
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
import { CREDIT_COSTS } from "@/lib/credits";
import {
  baseScanCost,
  estimateScanCost,
  recordScanCost,
  type ScanMode,
} from "@/lib/scan-estimate";

import { playSound } from "@/lib/sounds";
import { ScanHistorySheet } from "@/components/credits/ScanHistorySheet";
import { saveScanHistory, appendScanHistory } from "@/lib/scan-history.functions";
import { getPaddleEnvironment } from "@/lib/paddle";
import { useLanguage } from "@/hooks/useLanguage";




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
  { key: "person", label: "People" },
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);


  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [mode, setMode] = useState<Mode>("photo");
  const [phase, setPhase] = useState<Phase>("camera");
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [items, setItems] = useState<DetectedItem[]>([]);
  /** How many items the AI actually returned before any local filtering. */
  const [rawItemCount, setRawItemCount] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreNote, setLoadMoreNote] = useState<string | null>(null);
  /** History row of the current photo scan, so "Load more" appends to the same entry. */
  const historyIdRef = useRef<string | null>(null);


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
      void playSound("bubble");
    }
    tracked.forEach((t) => trackedSoundIdsRef.current.add(t.id));
  }, [tracked]);

  // Bubble sound when photo-mode results first show items.
  const photoItemsSoundPlayedRef = useRef(false);
  useEffect(() => {
    if (phase === "results" && items.length > 0 && !photoItemsSoundPlayedRef.current) {
      photoItemsSoundPlayedRef.current = true;
      void playSound("bubble");
    }
    if (phase === "camera" || items.length === 0) {
      photoItemsSoundPlayedRef.current = false;
    }
  }, [phase, items]);


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
      const track = stream.getVideoTracks()[0];
      const caps = (track?.getCapabilities?.() ?? {}) as MediaTrackCapabilities & {
        torch?: boolean;
      };
      setTorchSupported(Boolean(caps.torch));
      setTorchOn(false);
      return true;
    } catch (e) {
      setError(
        e instanceof Error
          ? `Camera access denied: ${e.message}. Retrying in 5s…`
          : "Could not access camera. Retrying in 5s…",
      );
      return false;
    }
  }, []);


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
    if (phase !== "camera" || snapshot) return;
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
  }, [phase, snapshot]);


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
    const isDoc = mode === "document";
    const isResale = mode === "resale";
    if (!credits.spend(isDoc ? "document_scan" : "photo_scan")) return;
    startScanSpend(isDoc ? "document" : "photo");

    void playSound("shutter");
    const dataUrl = grabFrame(1024, 0.8);
    if (!dataUrl) return;
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
        const doc = await analyzeDocument({ data: { imageBase64: dataUrl, environment } });
        detected = (doc.items ?? []).filter(Boolean);
        setRawItemCount(detected.length);
      } else {
        const result = await analyzeRoom({
          data: { imageBase64: dataUrl, environment, resale: isResale },
        });
        setRawItemCount(result.items.length);
        detected = result.items.filter(
          (it) => it.category === "person" || !isBodyPart(it.name),
        );

      }
      credits.refresh();
      setItems(detected);
      setPhase("results");
      historyIdRef.current = null;
      if (detected.length) {
        void saveScanHistory({
          data: {
            mode: isDoc ? "document" : "photo",
            items: detected.map((d) => ({
              name: d.name,
              category: d.category,
              description: d.description,
              confidence: d.confidence,
              priceMin: d.priceMin,
              priceMax: d.priceMax,
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
      setError(e instanceof Error ? e.message : "Analysis failed.");
      setPhase("results");
      credits.refresh();
      try {
        sessionStorage.setItem(LAST_SCAN_KEY, JSON.stringify({ snapshot: dataUrl, items: [] }));
      } catch {
        /* ignore */
      }
    }
  }, [grabFrame, stopCamera, credits, mode, environment, startScanSpend]);

  const loadMore = useCallback(async () => {
    if (!snapshot || loadingMore) return;
    if (!credits.spend("photo_scan")) return;
    addScanSpend(CREDIT_COSTS.photo_scan);

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
        (it) => it.category === "person" || !isBodyPart(it.name),
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
        void playSound("bubble");
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
          void saveScanHistory({ data: { mode: "photo", items: payload } })
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
        const frame = grabFrame(512, 0.6);
        if (!frame) {
          await new Promise((r) => setTimeout(r, 300));
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
        await new Promise((r) => setTimeout(r, 400));
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
    void playSound("sweep");
    trackedSoundIdsRef.current.clear();
    photoItemsSoundPlayedRef.current = false;
    try {
      sessionStorage.removeItem(LAST_SCAN_KEY);
    } catch {
      /* ignore */
    }
    setSnapshot(null);
    setItems([]);
    setRawItemCount(0);
    setLoadMoreNote(null);
    setSelected(null);
    setError(null);
    setTracked([]);
    setVideoPaused(false);
    setPhase("camera");
  }, []);




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
    setVideoPaused(false);
    setError(null);
  }, []);

  // Door handling
  const [doorPrompt, setDoorPrompt] = useState<{ item: TrackedItem | DetectedItem } | null>(null);
  const [addressInput, setAddressInput] = useState("");

  // Person handling (photo mode only, when person is the main subject)
  const [personPrompt, setPersonPrompt] = useState<{ item: TrackedItem | DetectedItem } | null>(
    null,
  );
  const [personName, setPersonName] = useState("");
  const [personLocation, setPersonLocation] = useState("");
  const [personLoading, setPersonLoading] = useState(false);
  const [personMatches, setPersonMatches] = useState<PersonMatch[] | null>(null);
  const [personResult, setPersonResult] = useState<{ name: string; info: PersonInfo } | null>(
    null,
  );
  const [personError, setPersonError] = useState<string | null>(null);


  // List tab (Items / Categories)
  const [listTab, setListTab] = useState<"items" | "categories">("items");

  const openAddressSearch = useCallback((address: string) => {
    const url = `https://www.google.com/search?q=${encodeURIComponent(address)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  const isPersonItem = (item: TrackedItem | DetectedItem) => {
    const cat = "category" in item ? item.category : item.enrichment?.category;
    return cat === "person";
  };

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
      if (isPersonItem(item)) {
        setPersonName("");
        setPersonLocation("");
        setPersonMatches(null);
        setPersonResult(null);
        setPersonError(null);
        setPersonPrompt({ item });
        return;
      }
      // Capture image at open time (snapshot for photo mode, live frame for video)
      const img = snapshot ?? grabFrame(1280, 0.9) ?? null;
      setSelectedImage(img);
      setSelected(item);
      void playSound("bubble");
    },
    [openAddressSearch, snapshot],
  );

  const closePerson = useCallback(() => {
    setPersonPrompt(null);
    setPersonMatches(null);
    setPersonResult(null);
    setPersonError(null);
  }, []);

  const submitPerson = useCallback(async () => {
    const name = personName.trim();
    if (!name) return;
    if (!credits.spend("person_info")) return;
    setPersonLoading(true);
    setPersonError(null);
    try {
      const { matches } = await personSearch({
        data: { name, location: personLocation.trim() },
      });
      if (matches.length === 0) {
        setPersonError("No public information found for that name.");
      } else if (matches.length === 1) {
        const m = matches[0];
        setPersonResult({
          name: m.name,
          info: {
            known: true,
            summary: m.summary,
            bullets: m.bullets,
            occupation: m.occupation,
            nationality: [m.nationality, m.location].filter(Boolean).join(" · "),
            wikipediaUrl: m.wikipediaUrl,
            sources: m.sources,

          },
        });
        setPersonPrompt(null);
      } else {
        setPersonMatches(matches);
      }
    } catch (e) {
      setPersonError(e instanceof Error ? e.message : "Lookup failed.");
    } finally {
      setPersonLoading(false);
    }
  }, [personName, personLocation, credits]);



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
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/70 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-2 px-4 py-3">
          <div className="flex flex-shrink-0 items-center justify-start">
            <AccountButton
              signedIn={credits.signedIn}
              email={credits.email}
              balance={credits.balance}
            />
          </div>
          <h1 className="flex min-w-0 flex-1 items-center justify-center select-none">
            <span className="sr-only">Scanything — AI camera room analyzer</span>
            <img
              src={logoAsset.url}
              alt="Scanything logo"
              className="h-20 w-full object-contain sm:h-[100px]"
              width={1024}
              height={512}
            />
          </h1>

          <div className="flex flex-shrink-0 items-center justify-end gap-2">
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
            {!isGuest && (
              <button
                onClick={() => setFilterOpen((o) => !o)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent gold-glow"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t("filters")}</span>
                <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                  {filters.size}
                </span>
              </button>
            )}

            {snapshot && (
              <Button size="sm" variant="secondary" onClick={reset}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                {t("newScan")}
              </Button>
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
            <div className="flex items-center justify-center">
              <div className="inline-flex flex-wrap items-center justify-center gap-1 rounded-full border border-border bg-secondary p-1">
                <button
                  onClick={() => switchMode("photo")}
                  className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                    mode === "photo"
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                  {t("photoScan")}
                </button>
                <button
                  onClick={() => {
                    if (credits.signedIn) {
                      setVideoWarningOpen(true);
                    } else {
                      switchMode("video");
                    }
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                    mode === "video"
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Video className="h-3.5 w-3.5" />
                  {t("videoScan")}
                </button>
                <button
                  onClick={() => switchMode("resale")}
                  className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                    mode === "resale"
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Tag className="h-3.5 w-3.5" />
                  Resale Scan
                </button>
                <button
                  onClick={() => switchMode("document")}
                  className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                    mode === "document"
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" />
                  {t("documentScan")}
                </button>
                {credits.signedIn && (
                  <button
                    onClick={() => setHistoryOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <History className="h-3.5 w-3.5" />
                    {t("scanHistory")}
                  </button>
                )}
              </div>
            </div>


            {mode === "resale" && (
              <p className="text-center text-[11px] text-muted-foreground">
                Resale Scan values everything for second-hand sale and tells you what's worth
                listing.
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
                          {it.enrichment && !["person", "plate"].includes(it.enrichment.category) && (
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
                <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white">
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
                  <p className="mb-2">Sign in for your 5 free credits and get started.</p>
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
                  <Button
                    size="lg"
                    data-no-sound
                    onClick={capture}
                    disabled={!credits.canAfford(mode === "document" ? "document_scan" : "photo_scan")}
                    className="w-full max-w-xs"
                  >
                    <Camera className="mr-2 h-5 w-5" />
                    {mode === "document"
                      ? "Scan document · "
                      : mode === "resale"
                        ? "Resale scan · "
                        : "Scan · "}
                    {scanEstimate[mode === "document" ? "document" : "photo"].learned ? "~" : ""}
                    {scanEstimate[mode === "document" ? "document" : "photo"].credits}
                  </Button>
                  <p className="text-center text-[11px] text-muted-foreground">
                    {(() => {
                      const key: ScanMode = mode === "document" ? "document" : "photo";
                      const est = scanEstimate[key];
                      const base = baseScanCost(key);
                      return est.learned && est.credits > base
                        ? `Est. ~${est.credits} credits — ${base} to scan plus extra passes you usually run. Balance: ${credits.balance}`
                        : `Estimated cost: ${base} credits. Balance: ${credits.balance}`;
                    })()}
                  </p>

                </div>

              )
            )}

          </div>
        )}

        {snapshot && (
          <div className="space-y-4">
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
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-background/80 p-3 text-foreground backdrop-blur-sm">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <p className="text-sm">{t("analyzing")}</p>
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
                    void playSound("click");
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
                    `${t("loadMore")} · ${CREDIT_COSTS.photo_scan}`
                  )}
                </Button>
                <p className="text-center text-[11px] text-muted-foreground">
                  {loadMoreNote ?? "Re-checks the same photo for objects the first pass missed."}
                </p>
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
          </div>
          <p>© {new Date().getFullYear()} Scanything. All rights reserved.</p>
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

      {personPrompt && !personResult && !personMatches && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
          onClick={() => !personLoading && closePerson()}
        >
          <div
            className="w-full max-w-md rounded-t-2xl border border-border bg-card p-5 shadow-xl sm:rounded-2xl gold-glow"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold gold-text">Who is this person?</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Add a name and location — we’ll gather public info from the web.
                </p>
              </div>
              <button
                onClick={() => !personLoading && closePerson()}
                className="rounded-full p-1 text-muted-foreground hover:bg-accent"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitPerson();
              }}
              className="mt-4 space-y-3"
            >
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Name</label>
                <input
                  autoFocus
                  type="text"
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  placeholder="e.g. Marie Curie"
                  maxLength={120}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Location</label>
                <input
                  type="text"
                  value={personLocation}
                  onChange={(e) => setPersonLocation(e.target.value)}
                  placeholder="e.g. Paris, France (optional)"
                  maxLength={160}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              {personError && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                  {personError}
                </div>
              )}
              <Button type="submit" className="w-full" disabled={personLoading || !personName.trim()}>
                {personLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Looking up…
                  </>
                ) : (
                  <>
                    <User className="mr-2 h-4 w-4" />
                    Submit
                  </>
                )}
              </Button>
            </form>
          </div>
        </div>
      )}

      {personMatches && !personResult && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
          onClick={closePerson}
        >
          <div
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-border bg-card p-5 shadow-xl sm:rounded-2xl gold-glow"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold gold-text">
                  {personMatches.length} matches found
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Pick the right person to see their public info.
                </p>
              </div>
              <button
                onClick={closePerson}
                className="rounded-full p-1 text-muted-foreground hover:bg-accent"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {personMatches.map((m, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() =>
                    setPersonResult({
                      name: m.name,
                      info: {
                        known: true,
                        summary: m.summary,
                        bullets: m.bullets,
                        occupation: m.occupation,
                        nationality: [m.nationality, m.location].filter(Boolean).join(" · "),
                        wikipediaUrl: m.wikipediaUrl,
                        sources: m.sources,

                      },
                    })
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-left hover:bg-accent"
                >
                  <div className="text-sm font-semibold text-primary">{m.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {[m.occupation, m.location || m.nationality].filter(Boolean).join(" · ")}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}


      {personResult && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
          onClick={closePerson}
        >
          <div
            className="w-full max-w-lg rounded-t-2xl border border-border bg-card p-5 shadow-xl sm:rounded-2xl gold-glow"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold gold-text">{personResult.name}</h2>
                {personResult.info.occupation && (
                  <p className="text-xs text-muted-foreground">
                    {personResult.info.occupation}
                    {personResult.info.nationality ? ` · ${personResult.info.nationality}` : ""}
                  </p>
                )}
              </div>
              <button
                onClick={closePerson}
                className="rounded-full p-1 text-muted-foreground hover:bg-accent"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {personResult.info.known ? (
              <>
                {personResult.info.summary && (
                  <p className="mt-3 text-sm leading-relaxed">{personResult.info.summary}</p>
                )}
                {personResult.info.bullets.length > 0 && (
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
                    {personResult.info.bullets.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                )}
                {personResult.info.sources && personResult.info.sources.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Sources from web search
                    </p>
                    <div className="mt-2 flex flex-col gap-1">
                      {personResult.info.sources.map((s, i) => (
                        <a
                          key={i}
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-between gap-2 text-sm text-primary hover:underline"
                        >
                          <span className="truncate">{s.title || s.url}</span>
                          <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-60" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </>

            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                No widely-known public info for that name. Try a more complete spelling.
              </p>
            )}
            <div className="mt-4 flex flex-col gap-2">
              <a
                href={
                  personResult.info.wikipediaUrl ||
                  `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(personResult.name)}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
              >
                Wikipedia
                <ExternalLink className="h-4 w-4 opacity-60" />
              </a>
              <a
                href={`https://www.google.com/search?q=${encodeURIComponent(personResult.name)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
              >
                Google search
                <ExternalLink className="h-4 w-4 opacity-60" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Video scan warning for signed-in users */}
      <ScanHistorySheet open={historyOpen} onClose={() => setHistoryOpen(false)} />

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
type PlateLink = { label: string; url: string };

const PLATE_REGISTRIES: { match: RegExp; label: string; url: string }[] = [
  {
    match: /\b(uk|united kingdom|british|england|scotland|wales|northern ireland)\b/i,
    label: "DVLA vehicle enquiry (UK)",
    url: "https://www.gov.uk/get-vehicle-information-from-dvla",
  },
  {
    match: /\b(sweden|swedish|sverige)\b/i,
    label: "Transportstyrelsen vehicle lookup (Sweden)",
    url: "https://fordonsfraga.transportstyrelsen.se/",
  },
  {
    match: /\b(norway|norwegian)\b/i,
    label: "Statens vegvesen vehicle lookup (Norway)",
    url: "https://www.vegvesen.no/kjoretoy/kjop-og-salg/kjoretoyopplysninger/",
  },
  {
    match: /\b(netherlands|dutch)\b/i,
    label: "RDW vehicle lookup (Netherlands)",
    url: "https://ovi.rdw.nl/",
  },
  {
    match: /\b(germany|german|deutschland)\b/i,
    label: "Kraftfahrt-Bundesamt (Germany)",
    url: "https://www.kba.de/",
  },
  {
    match: /\b(usa|united states|american|u\.s\.|california|texas|florida|new york)\b/i,
    label: "Find your state DMV (USA)",
    url: "https://www.usa.gov/motor-vehicle-services",
  },
  {
    match: /\b(canada|canadian|ontario|quebec)\b/i,
    label: "Provincial vehicle registry (Canada)",
    url: "https://www.canada.ca/en/services/transport.html",
  },
  {
    match: /\b(australia|australian)\b/i,
    label: "PPSR vehicle check (Australia)",
    url: "https://www.ppsr.gov.au/",
  },
];

/** Marketplace research links for a resale-scanned item. */
function resaleMarketLinks(name: string): { label: string; url: string }[] {
  const q = encodeURIComponent(name);
  return [
    {
      label: "eBay sold",
      url: `https://www.ebay.com/sch/i.html?_nkw=${q}&LH_Sold=1&LH_Complete=1`,
    },
    { label: "Facebook", url: `https://www.facebook.com/marketplace/search/?query=${q}` },
    { label: "Etsy", url: `https://www.etsy.com/search?q=${q}` },
  ];
}

function plateLookupLinks(plate: string, description: string): PlateLink[] {
  const hay = `${plate} ${description}`;
  const links: PlateLink[] = PLATE_REGISTRIES.filter((r) => r.match.test(hay)).map((r) => ({
    label: r.label,
    url: r.url,
  }));
  links.push({
    label: "Search official registry for this plate format",
    url: `https://www.google.com/search?q=${encodeURIComponent(
      `official vehicle registration check ${plate} ${description.slice(0, 60)}`,
    )}`,
  });
  return links;
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
  onClose,
}: {
  item: TrackedItem | DetectedItem;
  imageBase64: string | null;
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
        confidence: item.confidence,
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

  const runDeep = useCallback(async () => {
    if (!panelCredits.spend("analyze_further")) return;
    if (!imageBase64) {
      setDeepError("No image available. Reopen from a scan.");
      return;
    }
    setDeepLoading(true);
    setDeepError(null);
    try {
      const result = await analyzeFurther({
        data: { name, imageBase64: imageBase64.replace(/^data:[^,]+,/, ""), environment: getPaddleEnvironment() },
      });

      setDeep(result);
    } catch (e) {
      setDeepError(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      setDeepLoading(false);
    }
  }, [imageBase64, name, panelCredits]);

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
   * Follow the app-wide language: scan content is auto-translated whenever the
   * user browses the app in something other than English.
   */
  useEffect(() => {
    if (appLanguage === "English") return;
    if (nameTranslation?.language === appLanguage) return;
    void runNameTranslate(appLanguage);
    // Re-run when the item, its details or the app language change.
  }, [appLanguage, nameTranslation?.language, runNameTranslate]);

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
  const deepLang = nameTranslation?.language ?? (appLanguage === "English" ? null : appLanguage);

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
            <p className="mt-3 text-sm leading-relaxed">
              {nameTranslation?.description || enrichment.description}
            </p>

            {!["person", "plate"].includes(enrichment.category) && (
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
                    Second-hand resale value
                  </div>
                  <span
                    className={`rounded-full border px-2 py-[2px] text-[10px] font-bold uppercase leading-none ${
                      item.resale.verdict === "sell"
                        ? "border-primary/60 bg-primary/20 text-primary"
                        : "border-border bg-secondary text-muted-foreground"
                    }`}
                  >
                    {item.resale.verdict === "sell" ? "Worth selling" : "Not worth it"}
                  </span>
                </div>
                <div className="mt-1 text-xl font-semibold text-foreground tabular-nums">
                  ${item.resale.typical}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    typical (${item.resale.low}–${item.resale.high} {item.resale.currency})
                  </span>
                </div>
                {item.resale.reason && (
                  <p className="mt-1.5 text-xs text-muted-foreground">{item.resale.reason}</p>
                )}
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {resaleMarketLinks(name).map((l) => (
                    <a
                      key={l.url}
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
            )}



            {enrichment.category === "plate" && (
              <div className="mt-4 rounded-lg border border-border bg-secondary p-3">
                <div className="text-xs font-medium text-muted-foreground">
                  {tl(3)}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Owner details are not public. Use an official registry below — you must be
                  authorised and sign in with your own credentials.
                </p>
                <div className="mt-2 flex flex-col gap-2">
                  {plateLookupLinks(name, enrichment.description).map((l) => (
                    <a
                      key={l.url}
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
                    >
                      {l.label}
                      <ExternalLink className="h-4 w-4 opacity-60" />
                    </a>
                  ))}
                </div>
              </div>
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

              <Button
                variant="secondary"
                onClick={runDeep}
                disabled={deepLoading || !imageBase64 || !panelCredits.canAfford("analyze_further")}
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
                    {t("analyzeFurther")} · {CREDIT_COSTS.analyze_further}
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
                {enrichment && !["person", "plate"].includes(enrichment.category) && (deep.priceMin > 0 || deep.priceMax > 0) && (
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
                  Translation
                  {translation.language && ` · ${translation.language}`}
                  {translation.script && ` (${translation.script})`}
                </div>
                {translation.translation ? (
                  <div className="mt-1 text-sm font-medium">{translation.translation}</div>
                ) : (
                  <div className="mt-1 text-sm text-muted-foreground">
                    Couldn’t translate confidently.
                  </div>
                )}
                {translation.transliteration && (
                  <div className="text-xs text-muted-foreground">
                    Romanized: {translation.transliteration}
                  </div>
                )}
                {translation.note && (
                  <p className="mt-1 text-xs text-muted-foreground">{translation.note}</p>
                )}
                <a
                  href={`https://translate.google.com/?sl=${encodeURIComponent(translation.languageCode || "auto")}&tl=en&text=${encodeURIComponent(name)}&op=translate`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-accent"
                >
                  Open in Google Translate
                  <ExternalLink className="h-4 w-4 opacity-60" />
                </a>
              </div>
            )}
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
        {item.enrichment && !["person", "plate"].includes(item.enrichment.category) ? (
          <div className="shrink-0 text-xs font-semibold text-primary">
            ${item.enrichment.priceMin}–${item.enrichment.priceMax}
          </div>
        ) : item.enrichment ? (
          <div className="shrink-0 text-xs font-semibold text-muted-foreground">Person</div>
        ) : (
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
        {!["person", "plate"].includes(item.category) && (
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
