## Scanything Hurdles — mini-game

A small arcade game inside the signed-in account tab: a 1-lane 110m hurdles sprint with a global leaderboard and monthly credit prizes.

### Gameplay
- Entry: a "Play: 110m Hurdles" button in the account modal, opening a themed game panel (same colors/glow as the other sheets).
- Countdown: "3 — 2 — 1 — Ready… Set… GO!" (false start before GO = restart).
- Side-view single lane, runner silhouette, 10 hurdles spaced over a 110m track, camera scrolls with the runner.
- Controls: tap/click/hold anywhere on the track area accelerates; releasing decelerates to a stop. A dedicated "JUMP" button clears hurdles.
- Hitting a hurdle costs speed and a small time penalty; the runner stumbles briefly.
- Timer runs from GO to the finish line, shown to 1/100s. On finish: your time, your personal best, and whether it beat your monthly best.
- Works with mouse, touch, and keyboard (space = jump).
- Uses the existing arcade sound helper (bubble pop for buttons; no new sound assets).

### Leaderboards
Two boards in tabs inside the game panel:
- **This month** — resets at the start of each month, drives the credit prizes.
- **All time** — never resets, no payouts.

Each shows the top 10 by fastest time, with a "Show more" toggle that expands to top 50. Your own row is always highlighted and shown even if you're outside the visible range. Players appear under a display name they can set once in the game panel (defaults to a masked version of their sign-in email — full emails are never shown to other users).

### Monthly prizes
- On the 1st of each month, the previous month's top 3 are awarded automatically: 1st = 100 credits, 2nd = 50 credits, 3rd = 10 credits (coin sound plays next time they see the balance change; a note appears in their credit history).
- The monthly board then starts fresh; all-time results are untouched.
- A small line in the game panel shows the prize structure and days remaining in the month.

### Anti-cheat (kept light)
- Times are validated server-side against plausible bounds (no sub-human times, no negative or absurd values), and only improvements to a player's best are stored.
- Score submission requires a signed-in session; one best-time row per player per month.

## Technical details

**Database (one migration)**
- `game_scores`: user_id, display_name, time_ms, month_key (e.g. `2026-07`), created_at/updated_at, unique on (user_id, month_key). GRANTs + RLS: users insert/update their own rows only; leaderboard reads go through a security-definer function that returns rank, display name, and time (no emails, no user ids).
- `game_prize_payouts`: month_key + user_id + place + credits, unique per month/place, so payouts can never double-fire.
- Security-definer functions: `submit_game_score(_user_id, _time_ms)`, `get_game_leaderboard(_scope text, _limit int)` (`month` | `alltime`), `award_monthly_game_prizes()` — the last one reads last month's top 3, calls the existing `grant_credits` with reason `game_prize:<place>`, and records rows in `game_prize_payouts`.
- `pg_cron` job on the 1st at 00:05 UTC calling `award_monthly_game_prizes()` (pure SQL, no HTTP needed).

**Frontend**
- `src/lib/game.functions.ts` — `requireSupabaseAuth`-protected server fns wrapping the three RPCs.
- `src/components/game/HurdlesGame.tsx` — canvas-free DOM/CSS render loop via `requestAnimationFrame`, fixed-timestep physics, no new dependencies.
- `src/components/game/GameSheet.tsx` — themed modal holding the game + leaderboard tabs.
- `src/components/credits/AccountButton.tsx` — adds the "Play: 110m Hurdles" button.
- No AI calls, no credit cost to play.
