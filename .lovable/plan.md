Plan: Add browser-synthesized camera-themed sound effects to Scanything

Goal
Add subtle, camera-themed audio feedback for three key interactions without requiring an external API key or connector. All sounds will be synthesized directly in the browser using the Web Audio API.

Sounds
- Bubble pop: a short, soft sine-wave chirp with a quick decay, played when a newly detected item appears in the list.
- Camera shutter click: a short burst of filtered noise plus a crisp click, played when a photo scan is captured.
- Sweep/clear: a downward filtered noise sweep, played when the user presses "New scan" and the current view resets.

Sounds will be enabled by default and can be muted from the signed-in account tab.

Steps

1. Create a Web Audio sound engine
   - Add `src/lib/sounds.ts` with a small synthesizer that creates sounds on demand using `AudioContext`/`OscillatorNode`/`GainNode`.
   - Implement three functions: `playBubblePop()`, `playCameraShutter()`, `playSweepClear()`.
   - Guard against unsupported environments and resume the AudioContext on first user interaction if needed.

2. Add a sound settings hook
   - Create `src/hooks/useSounds.ts`:
     - Reads `scanything:sounds-muted` from `localStorage`.
     - Provides `play(type)` that calls the matching synthesizer when not muted.
     - Provides `muted` and `toggleMute()`.
   - Sounds start enabled by default.

3. Add a mute toggle in the account tab
   - In `src/components/credits/AccountButton.tsx`, add a "Sound effects" row with a mute/unmute toggle.
   - Style it with the current theme colors.

4. Wire sounds to the UI
   - Photo scan: call `play('shutter')` when the photo is captured.
   - New item detected: call `play('bubble')` when a new item first appears in the detected list.
   - New scan reset: call `play('sweep')` when the user clears the current scan and the view resets.

5. Verify
   - Typecheck and build the project.
   - Confirm the three sounds trigger on the right interactions and the mute toggle works.

Technical notes
- No external API key, connector, or asset upload is required.
- Sounds are generated in real time, so there are no files to host or cache.
- The app will fall back to silent operation if Web Audio API is unavailable or if the user mutes the app.