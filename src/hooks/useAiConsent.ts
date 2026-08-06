import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "scanything-ai-consent";

/** Bump when the disclosure text materially changes — forces a re-consent. */
export const AI_CONSENT_VERSION = 1;

export type AiConsentRecord = {
  granted: boolean;
  version: number;
  at: string;
};

function read(): AiConsentRecord | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AiConsentRecord>;
    if (typeof parsed?.granted !== "boolean") return null;
    return {
      granted: parsed.granted,
      version: typeof parsed.version === "number" ? parsed.version : 0,
      at: typeof parsed.at === "string" ? parsed.at : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function write(record: AiConsentRecord | null) {
  try {
    if (record) localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage can be unavailable */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("scanything-ai-consent"));
  }
}

/**
 * Explicit consent for sending camera frames to the AI provider.
 *
 * The camera must not start and no frame may leave the device until
 * `granted` is true for the current disclosure version.
 */
export function useAiConsent() {
  const [record, setRecord] = useState<AiConsentRecord | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setRecord(read());
    const sync = () => setRecord(read());
    window.addEventListener("scanything-ai-consent", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("scanything-ai-consent", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const accept = useCallback(() => {
    const next: AiConsentRecord = {
      granted: true,
      version: AI_CONSENT_VERSION,
      at: new Date().toISOString(),
    };
    write(next);
    setRecord(next);
  }, []);

  const decline = useCallback(() => {
    const next: AiConsentRecord = {
      granted: false,
      version: AI_CONSENT_VERSION,
      at: new Date().toISOString(),
    };
    write(next);
    setRecord(next);
  }, []);

  const revoke = useCallback(() => {
    write(null);
    setRecord(null);
  }, []);

  const granted = !!record?.granted && record.version >= AI_CONSENT_VERSION;
  const answered = !!record && record.version >= AI_CONSENT_VERSION;

  return {
    mounted,
    record,
    granted,
    answered,
    /** First run (or a new disclosure version) — the modal should be shown. */
    needsConsent: mounted && !answered,
    grantedAt: record?.granted ? record.at : null,
    accept,
    decline,
    revoke,
  };
}
