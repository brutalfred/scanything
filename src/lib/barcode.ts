/**
 * Barcode / QR decoding.
 *
 * Uses the native BarcodeDetector when the browser has it (Android Chrome does),
 * and lazily falls back to ZXing everywhere else so desktop browsers and iOS
 * Safari still work.
 */

export type BarcodeHit = { value: string; format: string };

type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string; format: string }[]>;
};

type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike;

const FORMATS = [
  "qr_code",
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
  "code_39",
  "itf",
  "data_matrix",
  "aztec",
  "pdf417",
];

let nativeDetector: BarcodeDetectorLike | null | undefined;

function getNativeDetector(): BarcodeDetectorLike | null {
  if (nativeDetector !== undefined) return nativeDetector;
  const Ctor = (globalThis as unknown as { BarcodeDetector?: BarcodeDetectorCtor })
    .BarcodeDetector;
  try {
    nativeDetector = Ctor ? new Ctor({ formats: FORMATS }) : null;
  } catch {
    nativeDetector = null;
  }
  return nativeDetector;
}

export function hasNativeBarcodeDetector() {
  return getNativeDetector() !== null;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read the image."));
    img.src = src;
  });
}

/** Decode from a live <video> element (or any canvas image source). */
export async function decodeFromSource(source: CanvasImageSource): Promise<BarcodeHit | null> {
  const detector = getNativeDetector();
  if (detector) {
    try {
      const found = await detector.detect(source);
      if (found.length) {
        return { value: found[0].rawValue, format: found[0].format };
      }
      return null;
    } catch {
      /* fall through to ZXing */
    }
  }
  return decodeWithZxing(source);
}

/** Decode from a data URL (uploaded picture or captured frame). */
export async function decodeFromDataUrl(dataUrl: string): Promise<BarcodeHit | null> {
  const img = await loadImage(dataUrl);
  return decodeFromSource(img);
}

async function decodeWithZxing(source: CanvasImageSource): Promise<BarcodeHit | null> {
  try {
    const { BrowserMultiFormatReader } = await import("@zxing/browser");
    const canvas = document.createElement("canvas");
    const w =
      (source as HTMLVideoElement).videoWidth ||
      (source as HTMLImageElement).naturalWidth ||
      (source as HTMLCanvasElement).width;
    const h =
      (source as HTMLVideoElement).videoHeight ||
      (source as HTMLImageElement).naturalHeight ||
      (source as HTMLCanvasElement).height;
    if (!w || !h) return null;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(source, 0, 0, w, h);
    const reader = new BrowserMultiFormatReader();
    const result = reader.decodeFromCanvas(canvas);
    const value = result?.getText?.();
    if (!value) return null;
    return { value, format: String(result.getBarcodeFormat?.() ?? "barcode") };
  } catch {
    return null;
  }
}

/** Best-effort classification so the UI can offer sensible follow-up actions. */
export function classifyBarcode(hit: BarcodeHit): "url" | "product" | "text" {
  if (/^https?:\/\//i.test(hit.value)) return "url";
  if (/^\d{8,14}$/.test(hit.value)) return "product";
  return "text";
}

/** Resale-focused lookup links for a scanned product code. */
export function productLookupLinks(code: string) {
  const q = encodeURIComponent(code);
  return [
    { label: "Google", url: `https://www.google.com/search?q=${q}` },
    { label: "eBay sold", url: `https://www.ebay.com/sch/i.html?_nkw=${q}&LH_Sold=1&LH_Complete=1` },
    { label: "Amazon", url: `https://www.amazon.com/s?k=${q}` },
    { label: "Barcode Lookup", url: `https://www.barcodelookup.com/${q}` },
  ];
}
