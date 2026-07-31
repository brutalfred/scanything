## Goal
Bring back sound, arcade-style, synthesized in-browser with the Web Audio API (no assets, no API keys), reusing the existing mute + volume settings.

## Sounds
- `click` — short bubbly "pop": rising sine blip (~440→900 Hz) with fast decay, slight detune for a plasticky arcade feel. Fires on every button click.
- `shutter` — camera: quick noise burst through a bandpass filter plus two short mechanical clicks (open/close), ~180 ms.
- `sweep` — "clean house": filtered white noise with a downward sweeping lowpass, ~500 ms, soft tail.
- `coin` — classic arcade two-note square-wave coin (B5 → E6), short then sustained, ~250 ms.

All routed through a master gain that reads the saved volume, and skipped when muted.

## Steps

1. **Rewrite the synthesizer in `src/lib/sounds.ts`**
   - Add lazily created shared `AudioContext` + master `GainNode`; resume it on first user gesture.
   - Extend `SoundType` to `"click" | "bubble" | "shutter" | "sweep" | "coin"` (keep `bubble` as an alias of the pop so existing call sites keep working).
   - Implement `playSound(type)` with the four synths above; apply `getSoundVolume()` and bail out when `isSoundMuted()`.
   - Keep the existing localStorage keys, `SOUND_SETTINGS_EVENT`, and exported getters/setters unchanged so the account-tab toggle and slider keep working.
   - Live-update the master gain when the volume changes.

2. **Global button click sound**
   - Add a small mount-once listener (in `src/routes/__root.tsx`) that plays `click` on `pointerdown` for anything matching `button, [role="button"], a[href]`, so every button in the app is covered without touching each component.
   - Respect the mute setting and skip elements that opt out via `data-no-sound`.

3. **Specific triggers in `src/routes/index.tsx`**
   - Photo scan capture → `shutter` (replaces the current no-op call).
   - "New scan" → `sweep`.

4. **Coin sound on credit changes**
   - In the credits provider/hook (`src/components/credits/CreditsProvider.tsx` / `src/hooks/useCredits.ts`), watch the balance and play `coin` whenever it increases — covers purchases, daily check-in, admin grants, and signup grant in one place.
   - Skip the first balance load so it doesn't fire on page open.

5. **Verify**
   - Typecheck/build, then check in the preview that clicks pop, capture clicks, reset sweeps, and the mute/volume controls still apply.

## Technical notes
- Everything is generated at runtime; no audio files to host, no extra dependencies.
- Sounds stay silent automatically if `AudioContext` is unavailable or the user is muted.
- Volume slider and mute button in the account tab need no changes.