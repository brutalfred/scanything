import { useCallback, useEffect, useState } from "react";
import { isNative } from "@/lib/platform";

export type CameraPermissionState = "granted" | "prompt" | "denied" | "unknown";

/**
 * Live camera permission state.
 *
 * Browsers own this decision — the app can only read the state and trigger
 * the native prompt once so the browser remembers the choice.
 */
export function useCameraPermission() {
  const [state, setState] = useState<CameraPermissionState>("unknown");
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    let status: PermissionStatus | null = null;
    let cancelled = false;

    async function read() {
      if (typeof navigator === "undefined" || !navigator.permissions?.query) return;
      try {
        status = await navigator.permissions.query({
          name: "camera" as PermissionName,
        });
        if (cancelled || !status) return;
        setState(status.state as CameraPermissionState);
        status.onchange = () => {
          if (status) setState(status.state as CameraPermissionState);
        };
      } catch {
        // Safari and some browsers don't support the camera permission name.
      }
    }
    void read();

    return () => {
      cancelled = true;
      if (status) status.onchange = null;
    };
  }, []);

  const request = useCallback(async (): Promise<CameraPermissionState> => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      return "unknown";
    }
    setRequesting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      stream.getTracks().forEach((t) => t.stop());
      setState("granted");
      return "granted";
    } catch (e) {
      const name = e instanceof Error ? e.name : "";
      const next: CameraPermissionState =
        name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unknown";
      setState(next);
      return next;
    } finally {
      setRequesting(false);
    }
  }, []);

  return { state, requesting, request, supported: !isNative() || true };
}
