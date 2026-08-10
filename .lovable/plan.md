# Ask AI about this item + remaining roadmap

## 1. "Ask about this object" — in-app AI chat

A new tab inside every item information box (and the scan history item view). No external page, no link out.

How it behaves:
- A third tab next to the existing details/listing content: **Ask AI**.
- On open, the app silently prepares the context: the item photo (plus any extra photos the user added), the item name, category, description, price range, resale verdict, and deep-analysis result if present.
- The typing field shows greyed-out placeholder text: "Ask me questions about this object." — placeholder only, nothing actually typed.
- The first message is pre-composed but **not sent**: the summary and picture appear as an attached context chip above the input, so the user just types their question and presses send.
- Answers stream back into the chat in the info box. Markdown rendered.
- The chat follows the box's own language picker, exactly like translations and listings do — independent of the language chosen in the Account tab.
- History is per item box, kept for the session (and stored with the scan in scan history so reopening a scanned item keeps its conversation).

Cost:
- **Free and unlimited for Scanything Pro and Max.**
- **1 credit per question** for everyone else, with the cost shown on the send button, same as Translate and Generate listing.
- A short daily safety cap on Pro/Max to prevent abuse (high enough that normal use never hits it).

## 2. Share scan as image card

- "Share as image" button in the item box: renders a card with the item photo, name, estimated price range, resale verdict, best marketplace, and the Scanything logo.
- Uses the Web Share API on Android/mobile, downloads a PNG on desktop.

## 3. Business tools

- **Bulk resale report**: from scan history, select multiple items and get a report — total estimated value, best items to sell first, and the recommended marketplace per item.
- **Inventory CSV export**: item name, category, condition, estimated value range, currency, scan date, marketplace links.
- **Duplicate detection**: flags when the same item appears across several scans, so resellers don't double-list.
- **Scanything for Business page**: a new page explaining team/volume use cases with a contact route, linked from the footer and pricing page.

## 4. Growth loops

- **Referral credits**: each user gets an invite link; both sides get credits once the invited user signs up and completes their first scan. Anti-abuse: one reward per invited account, device/email checks reuse the existing signup protections.
- **7-day streak bonus**: extends the existing daily check-in with a bigger reward on day 7.
- **Public shareable scan page**: a user can make one scan result public at a shareable URL, showing the item, photo, and price range — no account data, opt-in per scan, revocable.

## Build order

1. Ask AI tab (item box + scan history), plan-aware pricing.
2. Share as image card.
3. Business tools: CSV export, duplicate detection, bulk resale report, business page.
4. Growth loops: referral credits, streak bonus, public shareable scan.

## Technical notes

- New server function `askAboutItem` in a `.functions.ts` module, auth-required, streaming through the Lovable AI Gateway on `google/gemini-3.6-flash` (fast, cheap, multimodal — it can read the item photo). Full message history is resent each call; the item context is a system message so it is never lost.
- New credit reason `ask_ai` (1 credit) added to `CREDIT_COSTS`; `withCredits` already waives cost for subscribers, extended via `plan-mapping.ts` so Pro and Max both cover it.
- Chat UI built from AI SDK Elements primitives (conversation, message, prompt input), themed to the existing gold/dark token system.
- Ask-AI transcripts stored on the scan history row alongside the existing item data.
- New tables: `referrals` (inviter, invited, reward state) and `public_scans` (share slug, scan id, revoked flag) with RLS and grants; public scan reads go through a narrow anon SELECT policy.
- CSV export and the report are generated client-side from already-fetched history data — no extra AI cost.
- Duplicate detection compares normalized item name + category + price band inside the user's own history; no AI call.
- Share card rendered on a canvas in the browser, so no server image cost.
