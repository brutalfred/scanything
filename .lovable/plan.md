# Free in-app AI assistant prompt

Add a small "Ask AI" prompt inside the app that users can use without spending credits, by trying the browser's built-in AI first.

## What will be built

- A floating "Ask AI" button (or a new tab/section) that opens a chat-style prompt panel.
- A free AI path using the Chrome Built-in AI API (`window.ai.languageModel`) with Gemini Nano, which runs entirely on the device and costs no credits.
- A graceful fallback message when native AI is not available, telling the user they can use a normal scan instead (which uses credits).
- The panel will match the existing dark/gold theme.

## Limitations to be aware of

- Browser-native AI only works in Chrome/Edge on supported devices and may require flags to be enabled.
- It is not as powerful as the cloud models used for scans, but it is good enough for general Q&A about scan results or simple explanations.
- There will be no persistent conversation history in the first version.

## Technical approach

1. Detect `window.ai` and `window.ai.languageModel.create()` support.
2. Create a lightweight language model session on demand.
3. Stream the response into the prompt panel.
4. If detection fails, show a friendly message: "Free AI is not available in this browser. Use a scan to get AI-powered results."
5. Keep the UI inside the existing `src/routes/index.tsx` or a new small component file, depending on where the button is placed.

## Out of scope

- Server-side free LLM provider (no unlimited free API exists).
- Storing chat history.
- Multimodal file uploads inside the prompt.

## Suggested UI placement

- Add a compact "Ask AI" button near the existing scan button or in the account/menu area.
- Tapping it slides up a small prompt panel with an input and a streamed answer area.
