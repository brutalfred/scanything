/**
 * Pi Network browser SDK helpers.
 *
 * The SDK only exists inside the Pi Browser, so everything here is guarded and
 * lazily loaded — normal web tabs and the Android shell never touch it.
 */

export type PiAuthResult = {
  accessToken: string;
  user: { uid: string; username?: string };
};

type PiSdk = {
  init: (opts: { version: string; sandbox?: boolean }) => Promise<void> | void;
  authenticate: (
    scopes: string[],
    onIncompletePaymentFound: (payment: unknown) => void,
  ) => Promise<PiAuthResult>;
};

const SDK_URL = "https://sdk.minepi.com/pi-sdk.js";

function piGlobal(): PiSdk | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Pi?: PiSdk }).Pi;
}

/** True when the app runs inside the Pi Browser. */
export function isPiBrowser(): boolean {
  if (typeof window === "undefined") return false;
  if (piGlobal()) return true;
  return /PiBrowser/i.test(navigator.userAgent);
}

let sdkPromise: Promise<PiSdk> | null = null;

/** Injects the Pi SDK once and awaits `Pi.init` fully before resolving. */
export function loadPiSdk(): Promise<PiSdk> {
  if (sdkPromise) return sdkPromise;

  sdkPromise = (async () => {
    if (typeof document === "undefined") throw new Error("Pi SDK unavailable");

    if (!piGlobal()) {
      await new Promise<void>((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>(
          `script[src="${SDK_URL}"]`,
        );
        if (existing) {
          existing.addEventListener("load", () => resolve());
          existing.addEventListener("error", () => reject(new Error("Pi SDK failed to load")));
          if (piGlobal()) resolve();
          return;
        }
        const script = document.createElement("script");
        script.src = SDK_URL;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Pi SDK failed to load"));
        document.head.appendChild(script);
      });
    }

    const Pi = piGlobal();
    if (!Pi) throw new Error("Pi SDK unavailable");

    // Pi.init returns a promise in current SDK versions; await it either way.
    await Promise.resolve(Pi.init({ version: "2.0" }));
    return Pi;
  })().catch((err) => {
    sdkPromise = null;
    throw err;
  });

  return sdkPromise;
}

/** Runs the Pi authentication flow with the `username` scope. */
export async function piAuthenticate(): Promise<PiAuthResult> {
  const Pi = await loadPiSdk();
  return Pi.authenticate(["username"], () => {
    // Auth-only integration: nothing to recover for incomplete payments yet.
  });
}
