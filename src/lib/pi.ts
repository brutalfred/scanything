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

export type PiPaymentData = {
  amount: number;
  memo: string;
  metadata: Record<string, unknown>;
};

export type PiPaymentCallbacks = {
  onReadyForServerApproval: (paymentId: string) => void;
  onReadyForServerCompletion: (paymentId: string, txid: string) => void;
  onCancel: (paymentId: string) => void;
  onError: (error: Error, payment?: unknown) => void;
};

/** Shape of the payment object handed to `onIncompletePaymentFound`. */
export type PiIncompletePayment = {
  identifier: string;
  transaction?: { txid?: string } | null;
};

type PiSdk = {
  init: (opts: { version: string; sandbox?: boolean }) => Promise<void> | void;
  authenticate: (
    scopes: string[],
    onIncompletePaymentFound: (payment: PiIncompletePayment) => void,
  ) => Promise<PiAuthResult>;
  createPayment: (data: PiPaymentData, callbacks: PiPaymentCallbacks) => void;
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

/**
 * Recovers a payment the Pi wallet reports as still in flight.
 * Registered as the `onIncompletePaymentFound` callback everywhere, so a
 * purchase interrupted mid-flow is always finished instead of being dropped.
 */
export type IncompleteHandler = (payment: PiIncompletePayment) => void;

let incompleteHandler: IncompleteHandler = () => {};

/** Registers the app-wide recovery handler for interrupted Pi payments. */
export function setIncompletePaymentHandler(handler: IncompleteHandler) {
  incompleteHandler = handler;
}

/** Runs the Pi authentication flow with the `username` and `payments` scopes. */
export async function piAuthenticate(): Promise<PiAuthResult> {
  const Pi = await loadPiSdk();
  return Pi.authenticate(["username", "payments"], (payment) => {
    incompleteHandler(payment);
  });
}

/** Starts a User-to-App payment. `Pi.init` is always awaited first. */
export async function piCreatePayment(
  data: PiPaymentData,
  callbacks: PiPaymentCallbacks,
): Promise<void> {
  const Pi = await loadPiSdk();
  Pi.createPayment(data, callbacks);
}
