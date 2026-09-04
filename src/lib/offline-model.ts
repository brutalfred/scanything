/**
 * Offline / on-device fallback recognition.
 *
 * A small MobileNet classifier runs entirely in the browser (WebGL/CPU via
 * TensorFlow.js). It is nowhere near the cloud model, but it keeps basic
 * identification working with no connection: the weights are cached by the
 * browser after the first download, so once the model has been fetched the
 * app can name common objects while offline and for free.
 */

export type OfflinePrediction = { name: string; confidence: number };

type MobileNetLike = {
  classify: (
    img: HTMLImageElement | HTMLCanvasElement,
    topk?: number,
  ) => Promise<Array<{ className: string; probability: number }>>;
};

let modelPromise: Promise<MobileNetLike> | null = null;

const READY_KEY = "scanything.offlineModelReady";

/** True once the weights have been fetched at least once on this device. */
export function offlineModelDownloaded(): boolean {
  try {
    return localStorage.getItem(READY_KEY) === "1";
  } catch {
    return false;
  }
}

export function loadOfflineModel(): Promise<MobileNetLike> {
  if (!modelPromise) {
    modelPromise = (async () => {
      const tf = await import("@tensorflow/tfjs");
      await tf.ready();
      const mobilenet = await import("@tensorflow-models/mobilenet");
      const model = (await mobilenet.load({
        version: 2,
        alpha: 0.5,
      })) as unknown as MobileNetLike;
      try {
        localStorage.setItem(READY_KEY, "1");
      } catch {
        /* private mode — model still works this session */
      }
      return model;
    })().catch((e) => {
      modelPromise = null;
      throw e;
    });
  }
  return modelPromise;
}

function tidyLabel(raw: string): string {
  const first = raw.split(",")[0]!.trim();
  return first.charAt(0).toUpperCase() + first.slice(1);
}

/** Classify a data-URL photo on-device. Returns the top few guesses. */
export async function classifyOffline(
  dataUrl: string,
  topk = 3,
): Promise<OfflinePrediction[]> {
  const model = await loadOfflineModel();
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Could not read the photo."));
    el.src = dataUrl;
  });
  const preds = await model.classify(img, topk);
  return preds
    .filter((p) => p.probability > 0.03)
    .map((p) => ({ name: tidyLabel(p.className), confidence: p.probability }));
}
