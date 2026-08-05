# Camera permission in the account tab

## Short answer

No — a checkbox inside the app cannot grant camera access. Only the browser or the phone's OS can do that, and it deliberately keeps that decision out of the website's hands. What the app *can* do is show you the current permission state and guide you to make the browser remember it.

Why you get asked repeatedly today: the app calls the camera when the screen opens, and if you tap "Allow once" (Safari/Chrome default on some devices) the grant expires as soon as the tab closes. Choosing "Allow while visiting this site" / "Allow on every visit", or using the installed app (Home Screen / Play Store shell), makes the grant stick.

## What to build instead

Add a "Camera access" row in the account tab that:

- Reads the live permission state (granted / prompt / denied) and shows it as a status pill.
- When state is "prompt": a button "Grant camera access" that triggers the permission request once, right there, so it's remembered from then on.
- When state is "granted": shows "Granted — you won't be asked again" (a disabled/checked control, so it reads like the checkbox you wanted).
- When state is "denied": shows short per-browser instructions to re-enable it in site settings, since code cannot reopen that dialog.
- On the native Android shell, the OS permission is remembered after the first grant, so the row simply reports granted.

Also stop the camera screen from re-prompting when permission is already granted, and keep the existing 5-second retry only for the denied case.

## Technical notes

- Use `navigator.permissions.query({ name: "camera" })` where supported (Chrome/Android; Safari doesn't support it — fall back to "unknown" and just show the grant button). Subscribe to its `onchange` to keep the pill live.
- The grant button calls `getUserMedia` and immediately stops the tracks; the browser persists the choice.
- New strings go through the existing i18n files so the row is translated.
- Files touched: `src/components/credits/AccountButton.tsx` (new row), a small `src/hooks/useCameraPermission.ts`, and `src/lib/i18n` locale entries. No backend changes.
