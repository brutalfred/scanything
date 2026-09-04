/**
 * Panorama capture — motion-compensated sweep stitching on the device.
 *
 * Naive slit-scan (append a fixed strip every N ms) smears badly: pan slowly
 * and the same content is repeated many times, pan fast and content is
 * skipped. Instead we estimate how far the frame actually moved horizontally
 * between grabs (coarse grayscale cross-correlation on a downsampled band)
 * and append exactly that much new image from the centre of the frame.
 */

const SMALL_W = 160;
const SMALL_H = 90;
const MAX_SHIFT = 40; // in small-canvas pixels

export class PanoramaStitcher {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private small: HTMLCanvasElement;
  private smallCtx: CanvasRenderingContext2D | null;
  private prev: Float32Array | null = null;
  private left = 0;
  private right = 0;
  private started = false;
  private height: number;
  private maxWidth: number;
  private direction = 0; // sign of measured shift: <0 camera pans right

  frames = 0;

  constructor(height = 720, _stripWidth = 0, maxWidth = 8000) {
    this.canvas = document.createElement("canvas");
    this.canvas.height = height;
    this.canvas.width = maxWidth;
    this.height = height;
    this.maxWidth = maxWidth;
    this.ctx = this.canvas.getContext("2d");
    this.small = document.createElement("canvas");
    this.small.width = SMALL_W;
    this.small.height = SMALL_H;
    this.smallCtx = this.small.getContext("2d", { willReadFrequently: true });
  }

  get width() {
    return this.right - this.left;
  }

  get full() {
    if (!this.started) return false;
    return this.right >= this.maxWidth - 8 || this.left <= 8;
  }



  private grab(video: HTMLVideoElement): Float32Array | null {
    const c = this.smallCtx;
    if (!c) return null;
    c.drawImage(video, 0, 0, SMALL_W, SMALL_H);
    const d = c.getImageData(0, 0, SMALL_W, SMALL_H).data;
    const gray = new Float32Array(SMALL_W * SMALL_H);
    for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
      gray[i] = (d[p] * 0.299 + d[p + 1] * 0.587 + d[p + 2] * 0.114) / 255;
    }
    return gray;
  }

  /** Best horizontal shift (small px) between prev and cur, or null. */
  private estimateShift(cur: Float32Array): number | null {
    const prev = this.prev;
    if (!prev) return null;
    const y0 = Math.round(SMALL_H * 0.25);
    const y1 = Math.round(SMALL_H * 0.75);
    let best = 0;
    let bestScore = Infinity;
    let secondScore = Infinity;
    for (let s = -MAX_SHIFT; s <= MAX_SHIFT; s++) {
      let sum = 0;
      let n = 0;
      for (let y = y0; y < y1; y += 2) {
        const row = y * SMALL_W;
        const xa = Math.max(0, -s);
        const xb = Math.min(SMALL_W, SMALL_W - s);
        for (let x = xa; x < xb; x += 2) {
          sum += Math.abs(prev[row + x] - cur[row + x + s]);
          n++;
        }
      }
      if (n < 40) continue;
      const score = sum / n;
      if (score < bestScore) {
        secondScore = bestScore;
        bestScore = score;
        best = s;
      } else if (score < secondScore) {
        secondScore = score;
      }
    }
    // Reject flat / ambiguous matches (blank wall, no texture).
    if (bestScore > 0.14) return null;
    return best;
  }

  /**
   * Append whatever new image appeared since the previous frame.
   * Returns true when a strip was added.
   */
  push(video: HTMLVideoElement): boolean {
    const ctx = this.ctx;
    if (!ctx || this.full) return false;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return false;

    const cur = this.grab(video);
    if (!cur) return false;

    const shift = this.estimateShift(cur);
    this.prev = cur;

    // First frame: seed the canvas with a wide centre slab so the panorama
    // does not start as a sliver.
    if (!this.started) {
      const scale0 = this.height / vh;
      const seedSrc = Math.min(vw, vh * 0.7);
      const seedOut = Math.round(seedSrc * scale0);
      const mid = Math.round(this.maxWidth / 2 - seedOut / 2);
      ctx.drawImage(video, (vw - seedSrc) / 2, 0, seedSrc, vh, mid, 0, seedOut, this.height);
      this.left = mid;
      this.right = mid + seedOut;
      this.started = true;
      this.frames = 1;
      return true;
    }

    if (shift === null || shift === 0) return false;

    // Lock the sweep direction on the first real movement.
    if (this.direction === 0) {
      if (Math.abs(shift) < 2) return false;
      this.direction = shift > 0 ? 1 : -1;
    }
    // Ignore movement against the chosen direction (hand jitter / backtrack).
    if (Math.sign(shift) !== this.direction) return false;

    const scale = this.height / vh;
    const srcPerSmall = vw / SMALL_W;
    const srcStrip = Math.min(vw * 0.5, Math.abs(shift) * srcPerSmall);
    const outStrip = Math.max(1, Math.round(srcStrip * scale));
    if (outStrip < 2) return false;

    // shift < 0 means the camera is panning right: new image appears on the
    // right edge of the frame and is appended to the right of the panorama.
    const panRight = this.direction < 0;
    const inset = vw * 0.06;
    const sx = panRight
      ? Math.max(0, vw - inset - srcStrip)
      : Math.min(vw - srcStrip, inset);

    if (panRight) {
      if (this.right + outStrip > this.maxWidth) return false;
      ctx.drawImage(video, sx, 0, srcStrip, vh, this.right, 0, outStrip, this.height);
      this.right += outStrip;
    } else {
      if (this.left - outStrip < 0) return false;
      this.left -= outStrip;
      ctx.drawImage(video, sx, 0, srcStrip, vh, this.left, 0, outStrip, this.height);
    }
    this.frames++;
    return true;
  }

  /** Crop to what was actually captured and return a JPEG data URL. */
  finish(): string | null {
    const w = this.right - this.left;
    if (this.frames < 3 || w < this.height * 1.1) return null;
    const out = document.createElement("canvas");
    out.width = w;
    out.height = this.height;
    const ctx = out.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(this.canvas, this.left, 0, w, this.height, 0, 0, w, this.height);
    return out.toDataURL("image/jpeg", 0.92);
  }

}
