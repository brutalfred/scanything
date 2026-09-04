/**
 * Portrait mode — depth-of-field blur applied entirely on the device.
 *
 * The subject area (an elliptical focus region the user can move) stays
 * fully sharp; everything outside falls off smoothly into a lens-style
 * blur, mimicking a wide aperture. No AI, no network, no credits.
 */

export type PortraitOptions = {
  /** Blur strength in px at the edge of the frame (2–30). */
  strength?: number;
  /** Focus centre, 0–1 relative to the image. */
  focusX?: number;
  focusY?: number;
  /** Radius of the fully sharp area, 0–1 of the smaller side. */
  focusRadius?: number;
};

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read the photo."));
    img.src = src;
  });
}

export async function applyPortraitBlur(
  dataUrl: string,
  opts: PortraitOptions = {},
): Promise<string> {
  const { strength = 12, focusX = 0.5, focusY = 0.45, focusRadius = 0.34 } = opts;

  const img = await loadImage(dataUrl);
  const w = img.naturalWidth;
  const h = img.naturalHeight;

  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d");
  if (!ctx) return dataUrl;

  // Build the blurred background in progressively stronger rings so the
  // fall-off looks optical rather than like a single flat blur.
  const rings = 4;
  ctx.drawImage(img, 0, 0);
  const minSide = Math.min(w, h);
  const cx = focusX * w;
  const cy = focusY * h;
  const r0 = focusRadius * minSide;
  const r1 = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy));

  for (let i = 1; i <= rings; i++) {
    const layer = document.createElement("canvas");
    layer.width = w;
    layer.height = h;
    const lctx = layer.getContext("2d");
    if (!lctx) break;
    lctx.filter = `blur(${(strength * i) / rings}px)`;
    lctx.drawImage(img, 0, 0);

    // Keep only the part of this blurred layer beyond the current ring.
    const mask = lctx.createRadialGradient(cx, cy, 0, cx, cy, r1);
    const inner = r0 / r1 + ((i - 1) / rings) * (1 - r0 / r1);
    const outer = Math.min(1, r0 / r1 + (i / rings) * (1 - r0 / r1));
    lctx.filter = "none";
    lctx.globalCompositeOperation = "destination-in";
    mask.addColorStop(0, "rgba(0,0,0,0)");
    mask.addColorStop(Math.max(0, inner - 0.001), "rgba(0,0,0,0)");
    mask.addColorStop(outer, "rgba(0,0,0,1)");
    mask.addColorStop(1, "rgba(0,0,0,1)");
    lctx.fillStyle = mask;
    lctx.fillRect(0, 0, w, h);

    ctx.drawImage(layer, 0, 0);
  }

  return out.toDataURL("image/jpeg", 0.92);
}
