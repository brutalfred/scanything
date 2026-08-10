/**
 * Renders a branded scan result card to a PNG and shares (or downloads) it.
 * Pure client-side — no AI, no credits.
 */

export type ShareCardData = {
  name: string;
  category?: string;
  priceLine?: string;
  resaleLine?: string;
  imageDataUrl?: string | null;
};

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    } else {
      line = candidate;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  return lines;
}

export async function buildShareCard(data: ShareCardData): Promise<Blob | null> {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, W, H);

  // Photo
  const photo = data.imageDataUrl ? await loadImage(data.imageDataUrl) : null;
  const photoBox = { x: 60, y: 60, w: W - 120, h: 700 };
  ctx.save();
  ctx.beginPath();
  ctx.rect(photoBox.x, photoBox.y, photoBox.w, photoBox.h);
  ctx.clip();
  if (photo) {
    const scale = Math.max(photoBox.w / photo.width, photoBox.h / photo.height);
    const dw = photo.width * scale;
    const dh = photo.height * scale;
    ctx.drawImage(photo, photoBox.x + (photoBox.w - dw) / 2, photoBox.y + (photoBox.h - dh) / 2, dw, dh);
  } else {
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(photoBox.x, photoBox.y, photoBox.w, photoBox.h);
  }
  ctx.restore();

  ctx.strokeStyle = "#d4af37";
  ctx.lineWidth = 3;
  ctx.strokeRect(photoBox.x, photoBox.y, photoBox.w, photoBox.h);

  let y = 850;
  ctx.fillStyle = "#f5f5f5";
  ctx.font = "bold 58px system-ui, sans-serif";
  for (const line of wrap(ctx, data.name, W - 120, 2)) {
    ctx.fillText(line, 60, y);
    y += 68;
  }

  if (data.category) {
    ctx.fillStyle = "#9a9a9a";
    ctx.font = "34px system-ui, sans-serif";
    ctx.fillText(data.category, 60, y + 10);
    y += 60;
  }

  if (data.priceLine) {
    ctx.fillStyle = "#d4af37";
    ctx.font = "bold 46px system-ui, sans-serif";
    ctx.fillText(data.priceLine, 60, y + 30);
    y += 80;
  }

  if (data.resaleLine) {
    ctx.fillStyle = "#f5f5f5";
    ctx.font = "36px system-ui, sans-serif";
    for (const line of wrap(ctx, data.resaleLine, W - 120, 2)) {
      ctx.fillText(line, 60, y + 20);
      y += 50;
    }
  }

  ctx.fillStyle = "#d4af37";
  ctx.font = "bold 40px system-ui, sans-serif";
  ctx.fillText("Scanything", 60, H - 70);
  ctx.fillStyle = "#7a7a7a";
  ctx.font = "32px system-ui, sans-serif";
  ctx.fillText("scanything.app", W - 60 - ctx.measureText("scanything.app").width, H - 70);

  return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
}

/** Shares the card via the Web Share API, falling back to a download. */
export async function shareScanCard(data: ShareCardData): Promise<"shared" | "downloaded" | "failed"> {
  const blob = await buildShareCard(data);
  if (!blob) return "failed";
  const file = new File([blob], `scanything-${Date.now()}.png`, { type: "image/png" });

  const nav = navigator as Navigator & {
    canShare?: (data: { files?: File[] }) => boolean;
  };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: data.name, text: `${data.name} — scanned with Scanything` });
      return "shared";
    } catch {
      // user cancelled or share failed — fall through to download
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
  return "downloaded";
}
