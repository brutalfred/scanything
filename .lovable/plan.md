# Map View mode

Yes — this is possible. Google Maps' vector map supports a tilted, rotatable 3D view with extruded buildings (no satellite imagery), and it can be rendered right inside the camera square where the video feed normally sits.

## What you get

A new mode in the existing mode picker, next to Photo / Video / Resale / Document:

- Selecting **Map View** swaps the live camera feed for a 3D map filling the same square, with the same gold-framed styling and rounded corners as the camera.
- The map centers on your current GPS position (with a permission prompt); if location is denied or unavailable it falls back to a default city view.
- Tilted 45-degree perspective with extruded grey buildings, roads and labels — plain map styling, not satellite. Themed to match the active app theme where the map style allows.
- Gestures: drag to pan, pinch/scroll to zoom, two-finger drag to tilt and rotate. Buttons for recenter-on-me, tilt toggle, and zoom.
- Tapping a place marker opens the same style of info card used for scanned items, showing name, category, address, rating and a link to the place's website when available. This uses Places API and is the only part that touches the network beyond map tiles.
- The bottom shutter button is hidden in this mode (nothing to scan); the mode is free and costs no credits.
- Map View is browse-only: nothing is written to scan history or collections.

## Provider and keys

Map View uses the Google Maps connector.

Important: the Lovable-managed Google Maps key only works on `*.lovable.app` preview/publish domains. It will **not** work on `scanything.app`, `www.scanything.app`, or inside the Android app. To make Map View work everywhere you'll need your own Google Cloud API key:

1. A Google Cloud project with billing enabled.
2. Maps JavaScript API and Places API (New) enabled on it.
3. An API key, restricted by HTTP referrer to `https://scanything.app/*` and `https://*.scanything.app/*` (plus your Lovable preview domains), and for the Android app either add the app's referrer or create a second Android-restricted key.

I'll connect the managed key first so you can see it working in preview, then swap in your own key through the connector when you have it.

## Technical notes

- New `MapView` component, lazily loaded and rendered only after hydration so the Maps script never runs during server rendering.
- Maps JS API loaded async with the `loading=async` + `callback` pattern using the connector's browser key; `google.maps.Marker` only, no `mapId` and no Advanced Markers.
- Place lookups go through the Lovable connector gateway from a server function (Places API New `searchNearby` / place details) — never from the browser, so no server key is exposed.
- `"map"` added to the `Mode` union in `src/routes/index.tsx`; the mode picker, description strings and translation keys extended for all supported languages.
- Scan-related UI (shutter, filters, cancel, item overlay list) is hidden while in Map View; camera stream is stopped to save battery and restarted on switching back.
- Android: geolocation needs the location permission added to `AndroidManifest.xml`, and a new `.aab` build for the change to reach Play Store users.
