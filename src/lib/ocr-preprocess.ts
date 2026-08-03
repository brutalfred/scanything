/**
 * Client-side image clean-up for Document Scan.
 *
 * Photos of paper are usually tilted, unevenly lit and low contrast, which is
 * the main reason OCR drops or invents words. Before the image is sent to the
 * model we:
 *   1. convert to grayscale,
 *   2. flatten uneven lighting (local background subtraction),
 *   3. stretch contrast with percentile auto-levels,
 *   4. estimate the text skew angle and rotate the page straight.
 *
 * Everything runs on a canvas in the browser — no extra dependencies, no cost.
 */

const MAX_DIM = 2200;

/** Load a data URL / object URL into an ImageBitmap-like drawable. */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read the captured image"));
    img.src = src;
  });
}

function makeCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/** Grayscale + illumination flattening + percentile auto-levels, in place. */
function enhance(data: Uint8ClampedArray, w: number, h: number) {
  const gray = new Float32Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    // Luma weights — keeps ink dark and paper light better than a flat average.
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  // Background estimate: heavy box blur (separable, integral-image style) so we
  // can divide out shadows and page curl.
  const radius = Math.max(8, Math.round(Math.min(w, h) / 24));
  const tmp = new Float32Array(w * h);
  const bg = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    let sum = 0;
    const row = y * w;
    for (let x = 0; x < w; x++) {
      sum += gray[row + x];
      if (x > radius * 2) sum -= gray[row + x - radius * 2 - 1];
      const count = Math.min(x + 1, radius * 2 + 1);
      tmp[row + Math.max(0, x - radius)] = sum / count;
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = 0; y < h; y++) {
      sum += tmp[y * w + x];
      if (y > radius * 2) sum -= tmp[(y - radius * 2 - 1) * w + x];
      const count = Math.min(y + 1, radius * 2 + 1);
      bg[Math.max(0, y - radius) * w + x] = sum / count;
    }
  }

  const flat = new Float32Array(w * h);
  for (let p = 0; p < flat.length; p++) {
    const base = bg[p] || 1;
    flat[p] = Math.min(255, (gray[p] / base) * 200);
  }

  // Percentile auto-levels (robust to a few pure-black / pure-white pixels).
  const hist = new Uint32Array(256);
  for (let p = 0; p < flat.length; p++) hist[Math.round(flat[p])]++;
  const total = flat.length;
  const lowCut = total * 0.02;
  const highCut = total * 0.985;
  let acc = 0;
  let lo = 0;
  let hi = 255;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= lowCut) {
      lo = v;
      break;
    }
  }
  acc = 0;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= highCut) {
      hi = v;
      break;
    }
  }
  const span = Math.max(1, hi - lo);

  for (let p = 0, i = 0; p < flat.length; p++, i += 4) {
    let v = ((flat[p] - lo) / span) * 255;
    v = v < 0 ? 0 : v > 255 ? 255 : v;
    // Gentle S-curve: darkens ink, keeps paper clean, without destroying
    // faint strokes the way hard binarization does.
    v = 255 * Math.pow(v / 255, 1.15);
    data[i] = data[i + 1] = data[i + 2] = v;
    data[i + 3] = 255;
  }

  return gray;
}

/**
 * Estimate text skew by maximising the variance of the horizontal projection
 * profile: text lines line up only when the page is straight.
 */
function estimateSkew(data: Uint8ClampedArray, w: number, h: number): number {
  // Work on a small copy for speed.
  const step = Math.max(1, Math.round(Math.max(w, h) / 400));
  const pts: Array<[number, number]> = [];
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      // Dark pixel = likely ink (image is already contrast-stretched).
      if (data[(y * w + x) * 4] < 110) pts.push([x - w / 2, y - h / 2]);
    }
  }
  if (pts.length < 200) return 0;

  let best = 0;
  let bestScore = -1;
  for (let deg = -10; deg <= 10; deg += 0.25) {
    const rad = (deg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const bins = new Float64Array(h + 1);
    for (let i = 0; i < pts.length; i++) {
      const [px, py] = pts[i];
      const b = Math.round(py * cos - px * sin + h / 2);
      if (b >= 0 && b <= h) bins[b]++;
    }
    let mean = 0;
    for (let i = 0; i < bins.length; i++) mean += bins[i];
    mean /= bins.length;
    let variance = 0;
    for (let i = 0; i < bins.length; i++) {
      const d = bins[i] - mean;
      variance += d * d;
    }
    if (variance > bestScore) {
      bestScore = variance;
      best = deg;
    }
  }
  // Ignore sub-degree noise.
  return Math.abs(best) < 0.4 ? 0 : best;
}

/**
 * Returns a cleaned-up, deskewed JPEG data URL ready for OCR.
 * Falls back to the original image if anything goes wrong.
 */
export async function preprocessForOcr(dataUrl: string): Promise<string> {
  try {
    const img = await loadImage(dataUrl);
    const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));

    const canvas = makeCanvas(w, h);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, w, h);

    const imageData = ctx.getImageData(0, 0, w, h);
    enhance(imageData.data, w, h);
    ctx.putImageData(imageData, 0, 0);

    const angle = estimateSkew(imageData.data, w, h);
    if (angle === 0) return canvas.toDataURL("image/jpeg", 0.95);

    // Rotate the straightened page onto a canvas big enough to hold it.
    const rad = (-angle * Math.PI) / 180;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    const rw = Math.round(w * cos + h * sin);
    const rh = Math.round(w * sin + h * cos);
    const out = makeCanvas(rw, rh);
    const octx = out.getContext("2d");
    if (!octx) return canvas.toDataURL("image/jpeg", 0.95);
    octx.fillStyle = "#ffffff";
    octx.fillRect(0, 0, rw, rh);
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = "high";
    octx.translate(rw / 2, rh / 2);
    octx.rotate(rad);
    octx.drawImage(canvas, -w / 2, -h / 2);
    return out.toDataURL("image/jpeg", 0.95);
  } catch {
    return dataUrl;
  }
}
