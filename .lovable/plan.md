# Keep sign-in inside the Android app

## What is actually happening

Two confirmed gaps in the Android shell:

1. `android/app/src/main/AndroidManifest.xml` has only a LAUNCHER intent filter. There is no App Links filter for `https://scanything.app`, and there is no `.well-known/assetlinks.json` in `public/`. So any `scanything.app` link opened from Gmail (email confirmation, password reset) opens Chrome instead of the app — and the session is created in the browser, not in the WebView.
2. Google sign-in leaves the WebView. The OAuth flow navigates to Google, which Capacitor hands to an external browser; the redirect back to `https://scanything.app` also lands in that browser, so the user finishes signed in on the web page while the app still shows the logged-out/"Web" state.

Both leave the user in a normal browser, which is why the app behaves as Web and offers Paddle.

## Fix

### 1. Android App Links (email confirmation + reset links reopen the app)
- Add an App Links intent filter to `MainActivity` for `https://scanything.app` and `https://www.scanything.app` (`android:autoVerify="true"`).
- Serve `public/.well-known/assetlinks.json` with the app's package name and the release signing-key SHA-256 fingerprint, so Android verifies the link ownership.
- Keep `launchMode="singleTask"` and handle `appUrlOpen` in `useNativeShell` so a link tap routes to the in-app path instead of a cold start on `/`.

### 2. Google sign-in stays in the app
- On native Android, run the OAuth flow through the Capacitor in-app browser and close it on return, instead of letting the WebView navigate away to the system browser.
- Set the OAuth return target to a public same-origin callback, then let the existing session listener take over inside the app.
- On the web build nothing changes: the existing `lovable.auth.signInWithOAuth` path stays as is.

### 3. Email links point back at the app path
- Confirmation and reset links already target `scanything.app` URLs, so once App Links verification is in place they open the app. No auth-provider change needed beyond keeping `redirectTo` on the site origin.

### 4. Safeguard
- Once detection is reliable, the Account tab shows "Android app" and the credits sheet keeps failing closed on Paddle inside the native app (already in place from v1.9.6).

## Ship steps
Requires a new AAB: version bump to 1.9.7 / versionCode 17, `npm run build`, `npx cap sync android`, rebuild and upload. The `assetlinks.json` must be live on the published site before Android can verify the links.

## Signing fingerprint (already provided)

```
3D:FA:08:9C:9B:81:65:1D:23:EC:B6:90:E6:05:31:3C:08:3E:ED:FA:4F:3B:5D:AC:65:DF:3B:E0:FE:F7:F8:5E
```

Package: `app.scanything.scanything`. I will use this classic-key SHA-256 value for the `assetlinks.json` file.
