# Fix closed-alpha purchase routing

## Confirmed cause

The installed app is version 1.9.5, and the published web bundle contains both Google Play and web checkout paths. The purchase branch chooses web checkout only when Android-native detection returns false.

`appendUserAgent: "ScanythingAndroid"` is currently nested inside the `android` object in `capacitor.config.ts` and in the generated Android config. Capacitor 8 defines `appendUserAgent` as a top-level configuration property. Because the native marker is in the wrong place, the closed-alpha WebView does not reliably receive it, so `isNativeAndroid()` treats the app as an ordinary Android browser and routes purchases to Paddle.

## Implementation

1. Move `appendUserAgent` to the supported top-level location in the Capacitor configuration.
2. Strengthen native Android detection so checkout does not depend on only one signal:
   - Capacitor native platform API when available.
   - The correctly configured app-only user-agent marker as fallback.
   - Never classify a normal Android browser as the native app.
3. Make the purchase decision fail closed: if the app has native-shell evidence but Google Play Billing is unavailable, show an update/error message and never fall through to web checkout.
4. Add a small diagnostic status in the existing Account area showing whether the running client is detected as Web or Android app, so closed-alpha testing can confirm routing before opening a product.

## Verification

- Confirm normal desktop and mobile browsers continue to use web checkout.
- Confirm an Android-shell user agent selects Google Play Billing and cannot invoke Paddle.
- Confirm the native billing plugin remains packaged in the Android project.
- Confirm the generated Android configuration contains the user-agent marker at the supported top level after sync.

## Release impact

This changes native wrapper configuration, so it requires a new Android App Bundle with a higher version code and upload to the closed-alpha track. Publishing the website alone cannot correct the missing WebView marker in the already-installed 1.9.5 wrapper.