# Texas Hold'em — 2-4 player multiplayer poker

Yes, this works with no external servers. The app's existing backend (database + realtime + server functions) can host the whole game: card dealing and hand evaluation run server-side so nobody can see another player's hole cards, and realtime pushes table updates to everyone instantly.

## What gets built

**Entry point**
- New "Texas Hold'em - Play free chips poker" button in the Account tab, right under the existing 400m hurdles button.
- It opens a dedicated `/poker` page in a new tab (lobby + table live there, so the camera app isn't disturbed).

**Lobby (public)**
- List of open tables: name, seated players (e.g. 2/4), blinds, status.
- "Create table" button (2-4 seats), "Join" on any open table.
- "Play solo" button: creates a private table auto-filled with 3 bots and starts immediately.
- At a waiting table with 2+ humans, the host can press "Fill with bots" to take the remaining seats, or "Start" once 2 humans are seated.

**Table**
- Felt layout themed to the app's current color theme, up to 4 seats around it.
- Community cards, pot, each player's chip stack and current bet, dealer/small-blind/big-blind markers.
- Your two hole cards face up to you only; opponents show card backs until showdown.
- Action bar on your turn: Fold, Check/Call, Bet/Raise with a slider, All-in.
- 25-second turn timer with a visible countdown; timeout = auto check or fold.
- Hand result banner ("Wins with a Flush, K-high") and animated chip award, then next hand deals automatically.
- Leave table any time; your seat frees up and the hand continues.

**Chips**
- Play-money only, completely separate from credits. Each player gets a free 5,000-chip stack that tops back up to 1,000 whenever it hits zero, so nobody can get stuck.
- Nothing is purchasable and nothing pays out - keeps it clear of gambling rules on the store.

**Bots**
- Basic but believable: they evaluate their hand strength, fold weak hands, call reasonable bets, raise strong ones, and occasionally bluff. They act after a short delay so play feels natural.

## Technical section

Database (one migration, with GRANTs + RLS):
- `poker_tables` - name, status (waiting/playing/finished), max_seats, blinds, host, private flag.
- `poker_seats` - table, seat index, user id or bot marker, display name, chip stack, current bet, folded/all-in flags.
- `poker_hands` - per-hand state: deck (server-only), board, pot, stage (preflop/flop/turn/river/showdown), acting seat, action deadline, hole cards (server-only column).
- `poker_chips` - play-money balance per user.
- RLS: authenticated users can read tables/seats and read hands with hole cards and deck stripped via a `SECURITY DEFINER` view/function that only returns your own cards. All writes go through server functions only.

Server functions (`src/lib/poker.functions.ts`, all `.middleware([requireSupabaseAuth])`):
- `listTables`, `createTable`, `joinTable`, `leaveTable`, `addBots`, `startHand`
- `playerAction({ action, amount })` - validates it's your turn, applies the bet, advances the stage, deals from the server-side deck, runs bots, resolves showdown.
- `tickTable()` - called by clients as a heartbeat; enforces the turn deadline (auto-fold/check) and drives bot turns. This replaces a permanent game loop, since there's no always-on server.
- Hand evaluation + deck shuffling in `src/lib/poker.server.ts` (pure TypeScript 7-card evaluator, no dependency).

Realtime: each table subscribes to Postgres changes on its `poker_seats` / `poker_hands` rows, so all clients re-render on every action without polling.

Routes: `src/routes/poker.tsx` (lobby + table, gated on sign-in) with its own head metadata. Components in `src/components/poker/`.

Not included: chat, tournaments, more than 4 seats, spectating, credit stakes.
