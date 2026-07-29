/** Maps ad-reward error codes raised by the database to friendly messages. */
export function adErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  if (raw.includes("ad_limit_reached") || raw.includes("daily_limit")) {
    return "No free ads left today";
  }
  if (raw.includes("ad_cooldown")) {
    return "Please wait a moment before your next free ad";
  }
  if (raw.includes("ad_too_fast")) {
    return "Watch the whole ad to collect your credits";
  }
  if (raw.includes("ad_session_invalid")) {
    return "That ad view expired — start a new one";
  }
  if (raw.includes("not_authenticated")) {
    return "Sign in to collect free credits";
  }
  return "Could not add credits";
}
