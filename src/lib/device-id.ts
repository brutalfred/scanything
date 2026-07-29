// Browser device fingerprint used to limit the one-time free trial grant to one
// device. The raw signals never leave the browser — only a SHA-256 hash is sent.

const STORAGE_KEY = "scanything.device.salt";

function persistentSalt(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const fresh =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);
    localStorage.setItem(STORAGE_KEY, fresh);
    return fresh;
  } catch {
    return "no-storage";
  }
}

function canvasSignal(): string {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 40;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "no-canvas";
    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial'";
    ctx.fillStyle = "#f0c";
    ctx.fillRect(0, 0, 120, 20);
    ctx.fillStyle = "#0af";
    ctx.fillText("scanything-device", 2, 4);
    return canvas.toDataURL().slice(-96);
  } catch {
    return "no-canvas";
  }
}

async function sha256(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Stable-ish hash identifying this browser/device. Safe to send to the server. */
export async function getDeviceHash(): Promise<string> {
  const nav = typeof navigator !== "undefined" ? navigator : ({} as Navigator);
  const parts = [
    persistentSalt(),
    nav.userAgent ?? "",
    nav.language ?? "",
    String((nav as Navigator & { hardwareConcurrency?: number }).hardwareConcurrency ?? ""),
    String((nav as Navigator & { deviceMemory?: number }).deviceMemory ?? ""),
    typeof screen !== "undefined" ? `${screen.width}x${screen.height}x${screen.colorDepth}` : "",
    Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
    canvasSignal(),
  ];
  return sha256(parts.join("|"));
}
