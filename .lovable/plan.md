## Goal

Add a **Language** section to the account tab that switches the whole app — interface text, scan item boxes, detail cards and deep analysis — into the chosen language, and remembers the choice across sessions.

## Language list

The same 15 options already used by the item Translate picker: English, Spanish, French, German, Swedish, Italian, Portuguese, Polish, Arabic, Chinese, Japanese, Korean, Hindi, Russian, Thai (ไทย). English is the default.

## How it works

**1. Interface text — built-in dictionary (free, instant, offline)**
- New `src/lib/i18n/` with one dictionary per language and a `useLanguage()` hook plus a `t("key")` helper.
- The setting is stored in `localStorage` and broadcast app-wide with the same event pattern already used for themes, so every open panel updates immediately and the choice survives reloads and sign-outs.
- Right-to-left languages (Arabic) set `dir="rtl"` on the document so layout mirrors correctly.
- Strings covered: home screen and scan controls, filters, item list tabs, credits/top-up sheet, account tab, daily check-in, welcome popup, scan history, video warning, pricing page, auth screen, cookie banner, footer, and toast messages. Legal pages (terms, privacy, refund) stay in English, with a note, since they are legal documents.

**2. Scan content — automatic AI translation (free to the user)**
- When the app language is not English, scan results translate automatically instead of requiring a per-item Translate tap: item names on the green boxes, the detail card (description, category, price notes) and Analyze-further output.
- Reuses the existing translation server function and its fallback behaviour, so a failed translation shows the original English text rather than a blank card.
- Translations are cached per item and language in memory for the session, so reopening a box is instant and doesn't re-translate.
- The per-item Translate button stays, letting a user peek at one item in another language without changing the app language.

## Account tab UI

Under the existing Theme section: a "Language" heading with a compact grid of language chips (same visual style as the theme swatches), the active one highlighted. Selecting one applies instantly and closes nothing else.

## Technical notes

- New: `src/lib/i18n/index.ts` (types, language list, `t`), `src/lib/i18n/locales/*.ts` (dictionaries), `src/hooks/useLanguage.ts`.
- Edited: `AccountButton.tsx` (picker), `__root.tsx` (mount language + `dir`), `src/routes/index.tsx` (largest change — swap hardcoded strings for `t()`, auto-translate scan data), plus the credits, check-in, welcome, history, pricing and auth components.
- No database or backend schema changes; the existing `translateName` server function is reused as-is.
- Because `src/routes/index.tsx` is ~2800 lines, its string replacement is done in passes, verifying the app renders between passes.
