## Goal

Give the 110m Hurdles game an arcade stadium atmosphere using the app's existing Web Audio engine — no audio files to download, no extra cost, and everything obeys the existing mute toggle and volume slider in the account tab.

## What you'll hear

**Start sequence (during the 3 · 2 · 1 · Ready · Set · GO countdown)**
Instead of a spoken voice (not possible without audio files), the countdown gets a real athletics-style start:
- "3", "2", "1" — short low beeps
- "Ready…" / "Set…" — two rising two-tone beeps, like a track starter's cadence
- "GO!" — a sharp starter-pistol crack (noise burst + snap), replacing the current camera-shutter sound
- The crowd hushes slightly on "Set…" and roars on GO

**Crowd ambience (continuous, as chosen)**
A soft, breathing crowd murmur runs the whole race: layered filtered noise with a slow wobble so it sounds like a distant packed stand rather than static. It:
- fades in when the countdown starts
- sits quiet under the race, and swells briefly each time you clear a hurdle or stone
- rises with your speed, so running fast sounds more exciting
- swells into a full cheer at the finish
- cuts to a disappointed "aww" dip on a wipeout, then fades out
- stops completely when you leave the game, and never runs while muted

**Finish**
A champagne celebration: a bright cork "pop" (pitch-bent thump with a hollow snap) followed by a soft fizz tail, layered over the crowd cheer. This plays on top of the existing finish sound.

## Controls and safety

- All new sounds route through the same master volume/mute already in the account tab — no new settings needed.
- Muting mid-race stops the ambience immediately; unmuting resumes it if a race is running.
- Ambience never starts before a user interaction (browser autoplay rules), and is torn down when the game modal closes or the tab is hidden, so nothing keeps playing in the background.

## Technical details

- Extend `src/lib/sounds.ts`:
  - New one-shot sound types: `pistol`, `beepLow`, `beepHigh`, `champagne`, `cheer`, `aww`.
  - New ambience API: `startCrowdAmbience()`, `setCrowdIntensity(0..1)`, `swellCrowd()`, `stopCrowdAmbience()` — a single persistent noise-source + filter + LFO graph on the existing AudioContext, driven by gain ramps so intensity changes are smooth and cheap (no per-frame node creation).
  - Ambience respects `isSoundMuted()` / `getSoundVolume()` and listens to `SOUND_SETTINGS_EVENT` to stop or resume live.
- Wire into `src/components/game/HurdlesGame.tsx`:
  - `startCountdown` starts ambience and maps each countdown step to its beep/pistol.
  - The run loop calls `setCrowdIntensity` (throttled to a few times per second, not every frame) based on current speed.
  - Obstacle-cleared, `finished`, and `crashed` branches trigger swell / champagne+cheer / aww respectively.
  - A cleanup effect calls `stopCrowdAmbience()` on unmount and on `visibilitychange` to hidden.
- No database, backend, or dependency changes.
