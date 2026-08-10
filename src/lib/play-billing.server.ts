/**
 * Server-only verification of Google Play purchases.
 *
 * Auth uses whichever is configured:
 *  1. GOOGLE_PLAY_SERVICE_ACCOUNT_JSON — service account key (preferred).
 *  2. GOOGLE_PLAY_OAUTH_CLIENT_ID / _CLIENT_SECRET / _REFRESH_TOKEN —
 *     user OAuth refresh token, for orgs that block service account keys.
 */

type ServiceAccount = {
  client_email: string;
  private_key: string;
};

function base64url(input: ArrayBuffer | string): string {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const bin = atob(body);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

function readServiceAccount(): ServiceAccount | null {
  const raw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  const parsed = JSON.parse(raw) as ServiceAccount;
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("Invalid Google Play service account key");
  }
  return parsed;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getRefreshTokenAccessToken(): Promise<string> {
  const clientId = process.env.GOOGLE_PLAY_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_PLAY_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_PLAY_OAUTH_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Google Play verification is not configured");
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(
      `Google refresh-token auth failed (${res.status}): ${(await res.text()).slice(0, 200)}`,
    );
  }
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error("Google auth returned no access token");
  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + ((json.expires_in ?? 3600) - 60) * 1000,
  };
  return json.access_token;
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;
  const sa = readServiceAccount();
  if (!sa) return getRefreshTokenAccessToken();
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/androidpublisher",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signingInput = `${header}.${claims}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(sa.private_key.replace(/\\n/g, "\n")),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );
  const jwt = `${signingInput}.${base64url(signature)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    throw new Error(`Google auth failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error("Google auth returned no access token");
  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + ((json.expires_in ?? 3600) - 60) * 1000,
  };
  return json.access_token;
}

export type PlayPurchaseState = {
  valid: boolean;
  orderId: string | null;
  /** 0 = purchased, 1 = cancelled, 2 = pending */
  purchaseState: number | null;
  acknowledged: boolean;
};

function extractDisabledApiError(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as { error?: { details?: Array<{ metadata?: { activationUrl?: string; serviceTitle?: string }; reason?: string }>; message?: string } };
    const detail = parsed.error?.details?.find((d) => d.reason === "SERVICE_DISABLED" || d.metadata?.activationUrl);
    if (detail?.metadata?.activationUrl) {
      return `Google Play Android Developer API is disabled in this Google Cloud project. Enable it first: ${detail.metadata.activationUrl}`;
    }
  } catch {
    /* ignore parse errors */
  }
  if (body.includes("has not been used in project") || body.includes("SERVICE_DISABLED")) {
    return "Google Play Android Developer API is disabled in this Google Cloud project. Enable it at https://console.cloud.google.com/apis/library/androidpublisher.googleapis.com";
  }
  return null;
}

function handlePlayApiError(res: Response, body: string): never {
  const disabled = extractDisabledApiError(body);
  if (disabled) {
    throw new Error(disabled);
  }
  throw new Error(`Play verification failed (${res.status}): ${body.slice(0, 200)}`);
}

/** Verifies a one-time product purchase token with the Play Developer API. */
export async function verifyPlayProductPurchase(
  productId: string,
  purchaseToken: string,
): Promise<PlayPurchaseState> {
  const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME || "app.scanything.scanything";
  const token = await getAccessToken();
  const url =
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/` +
    `${encodeURIComponent(packageName)}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const body = await res.text();
    handlePlayApiError(res, body);
  }
  const data = (await res.json()) as {
    orderId?: string;
    purchaseState?: number;
    acknowledgementState?: number;
  };
  return {
    valid: data.purchaseState === 0,
    orderId: data.orderId ?? null,
    purchaseState: data.purchaseState ?? null,
    acknowledged: data.acknowledgementState === 1,
  };
}

/** Acknowledges a verified purchase so Google does not auto-refund it. */
export async function acknowledgePlayPurchase(productId: string, purchaseToken: string) {
  const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME || "app.scanything.scanything";
  const token = await getAccessToken();
  const url =
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/` +
    `${encodeURIComponent(packageName)}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: "{}",
  });
  if (!res.ok && res.status !== 400) {
    const body = await res.text();
    handlePlayApiError(res, body);
  }
}

export type PlaySubscriptionState = {
  valid: boolean;
  orderId: string | null;
  expiryTime: string | null;
  startTime: string | null;
  acknowledged: boolean;
  autoRenewing: boolean;
};

/** Verifies a Google Play subscription token with the Play Developer API. */
export async function verifyPlaySubscriptionPurchase(
  productId: string,
  purchaseToken: string,
): Promise<PlaySubscriptionState> {
  const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME || "app.scanything.scanything";
  const token = await getAccessToken();
  const url =
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/` +
    `${encodeURIComponent(packageName)}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const body = await res.text();
    handlePlayApiError(res, body);
  }
  const data = (await res.json()) as {
    orderId?: string;
    expiryTimeMillis?: string;
    startTimeMillis?: string;
    paymentState?: number;
    acknowledgementState?: number;
    autoRenewing?: boolean;
  };

  const now = Date.now();
  const expiry = data.expiryTimeMillis ? Number(data.expiryTimeMillis) : null;
  const valid = expiry !== null && expiry > now && data.paymentState !== 0;

  return {
    valid,
    orderId: data.orderId ?? null,
    expiryTime: expiry ? new Date(expiry).toISOString() : null,
    startTime: data.startTimeMillis ? new Date(Number(data.startTimeMillis)).toISOString() : null,
    acknowledged: data.acknowledgementState === 1,
    autoRenewing: data.autoRenewing ?? false,
  };
}

/** Acknowledges a verified subscription so Google does not auto-refund it. */
export async function acknowledgePlaySubscription(productId: string, purchaseToken: string) {
  const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME || "app.scanything.scanything";
  const token = await getAccessToken();
  const url =
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/` +
    `${encodeURIComponent(packageName)}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: "{}",
  });
  if (!res.ok && res.status !== 400) {
    const body = await res.text();
    handlePlayApiError(res, body);
  }
}

