/**
 * Panorama capture — sweep stitching done on the device.
 *
 * While the user pans the phone we keep grabbing frames and append a
 * narrow vertical strip from the centre of each one onto a wide canvas
 * (slit-scan stitching). It is fast, needs no feature matching and gives
 * a clean, seam-free sweep as long as the user pans steadily.
 */

export class PanoramaStitcher {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private x = 0;
  private height: number;
  private stripWidth: number;
  frames = 0;

  constructor(height = 720, stripWidth = 26, maxWidth = 8000) {
    this.canvas = document.createElement("canvas");
    this.canvas.height = height;
    this.canvas.width = maxWidth;
    this.height = height;
    this.stripWidth = stripWidth;
    this.ctx = this.canvas.getContext("2d");
  }

  get width() {
    return this.x;
  }

  get full() {
    return this.x + this.stripWidth >= this.canvas.width;
  }

  /** Append the centre strip of a live video frame. */
  push(video: HTMLVideoElement): void {
    const ctx = this.ctx;
    if (!ctx || this.full) return;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;

    const scale = this.height / vh;
    const srcStrip = this.stripWidth / scale;
    const sx = (vw - srcStrip) / 2;
    ctx.drawImage(video, sx, 0, srcStrip, vh, this.x, 0, this.stripWidth, this.height);
    this.x += this.stripWidth;
    this.frames++;
  }

  /** Crop to what was actually captured and return a JPEG data URL. */
  finish(): string | null {
    if (this.x < this.stripWidth * 4) return null;
    const out = document.createElement("canvas");
    out.width = this.x;
    out.height = this.height;
    const ctx = out.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(this.canvas, 0, 0, this.x, this.height, 0, 0, this.x, this.height);
    return out.toDataURL("image/jpeg", 0.9);
  }
}
