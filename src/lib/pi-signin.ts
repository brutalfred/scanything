/**
 * Pi Sign-In (OAuth implicit flow) for regular browsers.
 *
 * The Pi SDK only exists inside the Pi Browser, so everywhere else sign-in
 * goes through Pi's hosted consent page at authorize.pi2.com: the user
 * approves there and Pi redirects back to /auth/pi-callback with the access
 * token in the URL hash. The token is validated server-side exactly like the
 * SDK flow (GET /v2/me) before a session is opened.
 */

/** Public OAuth client identifier from the Pi Developer Portal — not a secret. */
export const PI_OAUTH_CLIENT_ID = "cIbqbnwUqDZOwxdX-NJkFrn1tWq0-prcjj7uWHbsxyg";

const AUTHORIZE_URL = "https://authorize.pi2.com/";
const STATE_KEY = "pi_oauth_state";
const RETURN_KEY = "pi_oauth_return";

function randomState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Redirects the tab to Pi's consent page. `returnTo` is where the callback
 * sends the user once the session is established.
 */
export function startPiOAuthSignIn(returnTo = "/"): void {
  const state = randomState();
  try {
    sessionStorage.setItem(STATE_KEY, state);
    sessionStorage.setItem(RETURN_KEY, returnTo);
  } catch {
    /* ignore */
  }
  const params = new URLSearchParams({
    client_id: PI_OAUTH_CLIENT_ID,
    redirect_uri: `${window.location.origin}/auth/pi-callback`,
    response_type: "token",
    scope: "username",
    state,
  });
  window.location.assign(`${AUTHORIZE_URL}?${params.toString()}`);
}

export type PiOAuthCallback =
  | { ok: true; accessToken: string; returnTo: string }
  | { ok: false; error: string };

/** Parses and validates the implicit-flow response on the callback page. */
export function parsePiOAuthCallback(hash: string): PiOAuthCallback {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const error = params.get("error");
  if (error) return { ok: false, error: params.get("error_description") ?? error };

  const accessToken = params.get("access_token") ?? "";
  const state = params.get("state") ?? "";
  if (!accessToken) return { ok: false, error: "Pi returned no access token" };

  let expectedState: string | null = null;
  let returnTo = "/";
  try {
    expectedState = sessionStorage.getItem(STATE_KEY);
    returnTo = sessionStorage.getItem(RETURN_KEY) ?? "/";
    sessionStorage.removeItem(STATE_KEY);
    sessionStorage.removeItem(RETURN_KEY);
  } catch {
    /* ignore */
  }
  if (!expectedState || state !== expectedState) {
    return { ok: false, error: "Pi sign-in state mismatch — please try again" };
  }
  return { ok: true, accessToken, returnTo: returnTo.startsWith("/") ? returnTo : "/" };
}
