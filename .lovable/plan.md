## Goal

Make Scanything shippable on Google Play as a Capacitor-wrapped Android app, with credit purchases going through Google Play Billing instead of Paddle when running inside the Android app.

## What I do in this project

**1. Capacitor setup**
- Add `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, plus `@capacitor/app`, `@capacitor/browser`, `@capacitor/status-bar`, `@capacitor/splash-screen`.
- Create `capacitor.config.ts`: appId `app.scanything.twa` → `app.scanything`, appName `Scanything`, `server.url = https://scanything.app` with `androidScheme: "https"` so the shell loads the live site (web updates ship without a new Play upload).
- Add npm scripts for `cap sync` / `cap open android`.

**2. Native-aware app code**
- `src/lib/platform.ts` — `isNativeAndroid()` helper (Capacitor detection).
- Hide the "Install app" PWA button inside the native shell.
- Android hardware back button handling (close modals/sheets before exiting).
- Safe-area padding for the status bar on the camera overlay.

**3. Auth for native**
- Sign-in opens in a system browser tab and returns via a custom scheme (`app.scanything://callback`) plus the existing `/auth/callback` web path.
- Add the Android intent-filter/deep-link config and document the redirect URI to register.

**4. Play Billing (credits)**
- New table `play_purchases` (purchase token, product id, user id, credits granted, state) with RLS + grants; unique purchase token so a token can only be redeemed once.
- Server function `verifyPlayPurchase` — verifies the purchase token against Google Play Developer API, then credits the account atomically. Requires a Google service-account JSON secret; I'll request it when we reach that step.
- `src/lib/billing.ts` — wraps a Play Billing Capacitor plugin behind the same interface the credits sheet already uses; on native, the credits sheet shows Play products, on web it keeps Paddle.
- Product IDs mirroring the current packs (e.g. `credits_1`, `credits_5`, `credits_10`, `credits_50`) to be created in Play Console.

**5. Store compliance**
- Privacy policy link + account deletion route (Play requires in-app account deletion): `/account/delete` calling a server function that removes the user's data.
- Data-safety notes: camera images sent to AI for analysis, no biometric storage.
- App icons + 512px store icon, feature graphic and screenshot guidance from the existing logo.

## What you do outside Lovable

1. Export the project to GitHub, `npm install`, `npx cap add android`, open in Android Studio.
2. Create the Google Play developer account ($25 one-time) and the app entry.
3. Create the four in-app products in Play Console with the IDs above.
4. Create a Google Cloud service account, grant it Play Developer API access, download the JSON key — I'll store it as a secret.
5. Build the signed AAB (Play App Signing), upload to internal testing, then production.

## Technical notes

- Camera and flashlight already use `getUserMedia`; with `server.url` pointing at the https site the WebView grants them after the native `CAMERA` permission prompt — I'll add the manifest permission entries and the WebView permission-request handler snippet.
- Because the shell loads the live site, content/UI/AI changes need no Play upload; only wrapper, permission, icon, or billing-plugin changes do.
- Paddle stays for the web app; Play Billing only activates inside the Android build to satisfy Google's payments policy.

## Order of work

1. Capacitor config + native-aware UI + back button + deep links
2. Account deletion route + store compliance pieces
3. Play Billing table, server verification, and billing abstraction
4. Icon/store asset generation and a written build/upload checklist
