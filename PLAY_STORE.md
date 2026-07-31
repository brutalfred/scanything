# Scanything on Google Play

The Android app is a Capacitor shell that loads `https://scanything.app`.
Web, UI and AI changes go live instantly after publishing in Lovable — a new
AAB upload is only needed for wrapper, permission, icon or billing changes.

## 1. One-time local setup

Requires Node 20+, Java 17 and Android Studio.

```bash
npm i -D @capacitor/cli
npm i @capacitor/core @capacitor/app @capacitor/status-bar @capacitor/splash-screen
npm i cordova-plugin-purchase
npx cap add android
npm run cap:sync
npm run cap:open
```

`capacitor.config.ts` already sets:
- `appId: app.scanything` (must match the Play Console package name)
- `server.url: https://scanything.app`

## 2. Android manifest

In `android/app/src/main/AndroidManifest.xml` add:

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="com.android.vending.BILLING" />
<uses-feature android:name="android.hardware.camera" android:required="false" />
```

Camera and flashlight use the standard web APIs through the WebView, so no
extra Capacitor camera plugin is needed.

## 3. Google sign-in

Add the app's redirect URLs to the auth provider allow-list:
- `https://scanything.app`
- `https://scanything.app/auth/callback`

The shell runs on the same origin as the site, so the existing web OAuth flow
works unchanged.

## 4. In-app purchases (required by Play)

Digital credits sold inside the Android app must use Google Play Billing.

1. Play Console → Monetize → Products → In-app products. Create consumable
   products with these exact IDs and prices:
   - `credits_1` — $1 — 12 credits
   - `credits_5` — $5 — 66 credits
   - `credits_10` — $10 — 140 credits
   - `credits_50` — $50 — 800 credits
2. Create a Google Cloud service account, grant it access under
   Play Console → Users and permissions → *View financial data* +
   *Manage orders*, and link it to the Play Developer API.
3. Save its JSON key as the `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` secret, and
   optionally `GOOGLE_PLAY_PACKAGE_NAME` if it differs from `app.scanything`.

The app then routes purchases through Play (`src/lib/play-billing.ts`),
verifies them server-side (`src/lib/play-billing.functions.ts`) and credits the
account exactly once per purchase token. Web visitors keep using web checkout.

## 5. Store listing requirements

- Title: Scanything — AI analysis
- Short description: Scan anything and get identification, information, price
  estimates and links.
- Privacy policy URL: `https://scanything.app/privacy`
- Account deletion URL: `https://scanything.app/account/delete`
- Terms URL: `https://scanything.app/terms`
- Refund policy: `https://scanything.app/refund-policy`
- Assets: 512×512 icon, 1024×500 feature graphic, at least 2 phone screenshots.
- Data safety form: declare camera images (processed, not stored), email
  address, and purchase history.
- Content rating questionnaire and target audience: 13+.

## 6. Build and upload

```bash
npm run cap:sync
npm run cap:open   # Android Studio → Build → Generate Signed Bundle (AAB)
```

Keep the upload keystore safe, or enable Play App Signing. Upload the AAB to
Internal testing first, then promote to Production.
