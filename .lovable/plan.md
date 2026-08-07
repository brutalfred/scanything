# Investigate Android app treated as Web after sign-in

## Current understanding
- User is testing the closed-alpha Android app (versionCode 16) and sees the Account tab show **“Web”** instead of **“Android app.”**
- This happens during the **email sign-in** flow.
- Email/password sign-in in `src/routes/auth.tsx` does not redirect to a browser; it calls `supabase.auth.signInWithPassword()` and then `navigate({ to: "/" })` inside the same WebView.
- Therefore, the login method itself does **not** force the app into web mode. The problem is that the WebView is not being recognized as the native Android shell, so the app is already treated as web before/during login.

## Possible causes to investigate
1. The build installed on the test device is still the old version, despite the user thinking it is version 16.
2. `appendUserAgent: "ScanythingAndroid"` is not being applied by the Capacitor runtime on that device.
3. The WebView user-agent is being overwritten or stripped by the server/site after login.
4. The user is actually clicking an email confirmation / password reset link from the email app, which opens in the system browser, not the native app.

## Plan
1. Add diagnostic logging to the Account tab and auth page so we can read the actual user agent and `Capacitor` bridge state at runtime.
2. Verify the `isNativeAndroid()` detection logic is robust and add a fallback that also checks `Capacitor.isNativePlatform()` and `Capacitor.getPlatform()` even when the UA marker is missing.
3. Add a small in-app diagnostics toast/alert on the auth page that shows whether the app is running as native Android or web.
4. Implement a deep-link/intent-filter path (`/auth/callback`) and update the Supabase auth emails so confirmation and reset links can return the user to the native app when clicked from an email client.
5. Update the reset-password and auth pages to surface an “Open in Scanything app” prompt when the page is loaded in a browser but the UA indicates the Android app is available.

## Outcome
After this plan, the user will be able to tell whether the installed AAB is actually the native build and, if not, get a clear path back into the app from email links.
