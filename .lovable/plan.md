## What happened

Your scan almost certainly *did* work — the app threw the results away before showing them.

In `src/routes/index.tsx` there is a body-part blocklist regex (line 131) used to strip human body parts out of results. It matches any name **containing** these words:

`hand, arm, leg, foot, finger, face, head, hair, skin, back, body, person, people, human, man, woman, boy, girl, child, kid, baby`

A baby rattle comes back from the AI as something like "Baby rattle" / "Baby toy" — the word `baby` matches, so the item is deleted. The couch behind it can come back as "Sofa arm" / "Armrest of couch" (matches `arm`), and the floor/rug is deliberately skipped by the prompt as structural. Net result: an empty result list even though the AI returned items.

The same bug silently eats many everyday objects: "Baby monitor", "Man's shirt", "Kids' bike", "Hand mirror", "Handbag", "Headphones" (whole-word `head` in "Head phones"), "Backpack" ("back"), "Legos", "Foot stool", "Body lotion".

## The fix

1. **Rewrite the body-part filter** in `src/routes/index.tsx`:
   - Only reject when the *whole name* is a body part ("Hand", "Left arm", "Face"), not when the word appears inside a longer object name.
   - Keep an explicit allowlist of object words that contain body-part words (baby toy/monitor/bottle, handbag, headphones, backpack, armchair, footstool, hand mirror, man's/woman's/kids' clothing, etc.).
   - Drop `baby`, `child`, `kid`, `man`, `woman`, `boy`, `girl`, `back`, `body` from the plain word list — those are almost never a standalone body part and cause most false removals.
   - Apply the same corrected helper to live video mode, which uses the same list.

2. **Never show a silent empty result**: when the AI returns items but every one is removed by the body-part filter or the category filters, show a short note under the photo ("Items were hidden by your filters" / "Nothing identified — try a closer shot") instead of a blank list, so this class of bug is visible rather than looking like a failed scan.

3. **Nudge the prompt** in `src/lib/analyze-room.functions.ts` so small handheld objects (toys, rattles, tools, utensils) are explicitly named as the object, not as the person who uses them.

No credits/backend/pricing logic changes.

## Technical detail

- `BODY_PART_RE` at `src/routes/index.tsx:131` is applied in `capture()` (line 483) for photo scans and in the video tracking path.
- New helper: exact/leading-modifier match (`/^(left |right |his |her )?(hand|arm|leg|...)s?$/i`) plus an object allowlist check that short-circuits before the regex.
