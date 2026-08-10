# Scanything commercial video

## Goal
Create a short, shareable promotional video for X/Twitter that quickly shows what Scanything does and why it matters for both everyday users and businesses.

## Format
- 16:9 horizontal, 1920x1080, 30 fps
- 20-25 seconds total
- MP4 output to `/mnt/documents/`
- Built with Remotion so it is fully version-controlled and re-renderable

## Creative direction

Style: **Dark, premium, fast-paced.** Black background with gold/yellow light accents matching the default Scanything theme. Clean sans-serif typography, glowing scan lines, and quick cuts. Feels like a polished app launch trailer rather than a feature walkthrough.

Motion system:
- Entrances: sharp scale-up + fade-in with spring snap
- Transitions: quick directional wipes and zooms between scenes
- Accent motion: gold scan lines sweep across the frame to reveal content
- Default easing: spring snap for UI elements, smooth interpolation for text

## Scene breakdown

Scene 1 — Hook (0:00-0:03)
- Black screen, gold logo pulses in.
- Text: "What are you looking at?"
- Subtle camera shutter / scan line sweep.

Scene 2 — The problem (0:03-0:06)
- A blurry room or object montage, with quick questions floating in:
  "What's it worth?" / "Where do I sell it?" / "What does this document say?"
- Text is slightly off-center, fast cuts.

Scene 3 — The app (0:06-0:12)
- Stylized phone/device frame with Scanything UI mockups:
  - live camera view with bounding boxes around objects
  - tap an item → info card pops up with name, price range, confidence
  - resale mode → marketplace recommendations (eBay, Blocket, Vinted, etc.)
  - document scan → text extracted and highlighted
- Gold scan lines and grid overlay to emphasize the AI "seeing" the scene.

Scene 4 — For retail and businesses (0:12-0:18)
- Split screen or stacked text cards:
  - "For you" → identify, price, sell, translate
  - "For business" → inventory, valuation, resale, listing drafts
- Icons appear beside each card (price tag, camera, document, globe).

Scene 5 — CTA (0:18-0:23)
- Logo + app name lockup.
- Text: "Scan anything. Know everything."
- URL + CTA: "scanything.app"
- Gold glow and final scan line reveal.

## Assets needed

- Scanything logo (`src/assets/scanything-logo.png`) copied to the Remotion project's `public/` folder
- Optional: 2-3 generated product/still-life images for the mockup scenes if real app screenshots are not used
- Text rendered in Remotion using Google Fonts (Inter or a similar clean sans-serif)

## Technical approach

1. Create a `remotion/` directory in the project.
2. Initialize with `bun init`, install Remotion packages, and configure the compositor for the sandbox.
3. Build scenes as separate components under `remotion/src/scenes/`.
4. Use `<TransitionSeries>` for scene sequencing.
5. Use `interpolate()` and `spring()` for all motion.
6. Render via the programmatic render script to `/mnt/documents/scanything-commercial.mp4`.
7. Verify the final MP4 exists and report the file size.

## Deliverables

- `/mnt/documents/scanything-commercial.mp4` — the final video
- `remotion/` directory — the source Remotion project saved in the repo

## Notes

- No audio (the sandbox ffmpeg build lacks AAC encoding, and the video works as a mute-friendly social clip).
- The video should be visually understandable with sound off, since X auto-plays on mute.
- All text will be in English for the broadest social reach.
