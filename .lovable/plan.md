Plan: Add camera-themed UI sound effects to Scanything

Goal
Give the app subtle, camera-themed audio feedback for three key interactions: a bubble pop when a new item appears, a shutter click when a photo scan is captured, and a sweep/clear sound when the user resets with "New scan". Sounds will be enabled by default and can be muted from the signed-in account tab.

Prerequisite
ElevenLabs is available as a workspace connector but not yet linked to this project. The first step is to link it so the server function can call the ElevenLabs Sound Effects API.

Steps

1. Link ElevenLabs
   - Call `standard_connectors--connect` with `connector_id: "elevenlabs"`.
   - This injects `ELEVENLABS_API_KEY` for direct provider API calls (not gateway-backed).

2. Create a sound-generation server function
   - Add `src/lib/sounds.functions.ts` that wraps `createServerFn`.
   - Handler calls `https://api.elevenlabs.io/v1/sound-generation` with a prompt and duration, returning the raw MP3 bytes.
   - Keep prompts focused on the camera theme, e.g.:
     - "soft camera bubble pop, short, subtle"
     - "vintage camera shutter click, crisp, short"
     - "gentle sweep or clear slate sound, short, whoosh"

3. Generate and store the three sounds
   - Generate one sound for each prompt using the server function.
   - Upload each MP3 as a Lovable asset via `lovable-assets create` so it is served from `/__l5e/assets-v1/...` and kept out of the repo.
   - Write the `.asset.json` pointer files under `src/assets/sounds/`.

4. Build a lightweight sound manager
   - Create `src/hooks/useSounds.ts`:
     - Loads the three assets into `<audio>` elements on first interaction.
     - Reads/writes a `scanything:sounds-muted` flag to `localStorage`.
     - Exposes `playSound(type)` and `toggleMute()`.
   - Sounds start enabled by default.

5. Add a mute toggle in the account tab
   - In `src/components/credits/AccountButton.tsx`, add a "Sound effects" row with a mute/unmute toggle button.
   - Use the current theme colors for the control.

6. Wire sounds to the UI
   - Photo scan capture: play the shutter click when the user takes a photo scan.
   - New item detected: play the bubble pop when a new item box/cards first appear in the list.
   - New scan reset: play the sweep/clear sound when the user taps "New scan" and the current snapshot/items are cleared.

7. Verify
   - Typecheck and build the project.
   - Confirm the sounds play on the three interactions and the mute toggle works.

Technical notes
- ElevenLabs Sound Effects API returns raw MP3 bytes; the server function will return the binary and the client will play via HTML5 `<audio>` or `Audio` objects.
- No direct API calls from the browser; the sound files are served through Lovable assets after generation.
- If ElevenLabs generation fails, the app will fall back to silent operation so it never blocks the scan flow.