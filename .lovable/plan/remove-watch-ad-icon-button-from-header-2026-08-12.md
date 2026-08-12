# Remove Watch-ad icon button from header

## What changes
Remove the `WatchAdButton` (icon variant) from the header in `src/routes/index.tsx` (lines ~1450-1454), and remove the now-unused import on line 73.

## What stays
The full "Watch an ad for 2 credits" button remains in the Account tab and the Top-up sheet — those are untouched.

## No new .aab needed
This is a web-only UI change. The Android shell loads the live site, so it ships automatically on publish. No Gradle sync or AAB upload required.

## After editing
Run a security scan check, then publish the web app.
