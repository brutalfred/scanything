# Fix: account tab still shows version 1.1

## What's happening

The version line in the account tab comes from `useAppVersion()`. It tries to read the real native version from the Capacitor App plugin, and falls back to the web version if that isn't available.

Two things confirmed in the code:

1. `package.json` still says `"version": "1.1"`, and `src/lib/version.ts` uses that as the fallback. So whenever the native read doesn't come through, the tab shows 1.1 — regardless of what the AAB says (currently versionName 1.5 / versionCode 6).
2. The Android shell's bundled config `android/app/src/main/assets/capacitor.config.json` is stale: it has the old app id `app.scanything` (the project now uses `app.scanything.scanything`) and it is missing the `appendUserAgent: "ScanythingAndroid"` marker that the app uses to detect the native shell. Without that marker, the native detection in `src/lib/platform.ts` can fail on the remotely loaded site, so the hook never asks for the native version and just prints the fallback.

## The fix

- Bump `package.json` version to `1.5` so the web fallback matches the shipped Android version (and web/PWA users see the right number too).
- Refresh `android/app/src/main/assets/capacitor.config.json` so it matches `capacitor.config.ts`: correct app id, and the `appendUserAgent` marker present.
- Make `useAppVersion()` resilient: attempt the native read even if the shell marker is late/missing (the plugin call simply fails harmlessly in a browser), so the real native versionName wins whenever it is obtainable.

## What you need to do after

- Publish the web app (the shell loads the live site, so the fallback fix ships that way — no new AAB needed for it).
- The `capacitor.config.json` change only lands in a new build: run your usual sync + build and upload a new AAB when convenient. It is not required for the version number to display correctly once the fallback is corrected.

## Going forward

Whenever you bump `versionName` in `android/app/build.gradle`, bump `package.json` to the same number so the two never drift apart again.
