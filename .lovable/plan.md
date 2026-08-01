## Goal
After a photo scan, show two small icon buttons in the bottom-right corner of the captured picture: Share and Save to device.

## What to build
In `src/routes/index.tsx`, inside the snapshot container (the bordered box holding the captured image), add a small overlay in the bottom-right with two round icon buttons styled like the existing zoom-reset pill (dark translucent background, theme-consistent):

1. **Share** (`Share2` icon) — converts the snapshot data URL to a JPEG file and calls the native share sheet (`navigator.share` with files). If the device can't share files, it falls back to downloading the image and shows a short toast explaining sharing isn't supported on this device.
2. **Save** (`Download` icon) — downloads the snapshot as `scanything-YYYY-MM-DD-HHMM.jpg` via a temporary link. On the Android app build, it uses the existing native path check (`isNative`) and falls back to the same browser download if native filesystem plugins are unavailable.

## Details
- Buttons only render when a snapshot exists; they stay visible during analyzing and results phases.
- Buttons sit outside the zoom/pan wrapper so they don't scale or move with pinch-zoom.
- They use the standard bubble-pop click sound (no `data-no-sound`).
- Bounding boxes and the image itself are unaffected; the saved/shared image is the clean captured photo, not the overlay.
- Accessible labels: "Share picture" and "Save picture".
