import { useCallback, useEffect, useState } from "react";
import { isNative } from "@/lib/platform";

const KEY = "scanything.reminder.enabled";
const HOUR_KEY = "scanything.reminder.hour";
const NOTIFICATION_ID = 4711;

type LocalNotificationsPlugin = {
  requestPermissions: () => Promise<{ display: string }>;
  checkPermissions: () => Promise<{ display: string }>;
  schedule: (opts: unknown) => Promise<unknown>;
  cancel: (opts: { notifications: { id: number }[] }) => Promise<void>;
};

async function plugin(): Promise<LocalNotificationsPlugin | null> {
  if (!isNative()) return null;
  try {
    const mod = await import("@capacitor/local-notifications");
    return mod.LocalNotifications as unknown as LocalNotificationsPlugin;
  } catch {
    return null;
  }
}

/**
 * Opt-in daily reminder telling the user their check-in credits are waiting.
 *
 * Native Android schedules a repeating local notification. On the web there is
 * no reliable background scheduler, so the reminder is shown the next time the
 * app is opened after the chosen hour.
 */
export function useDailyReminder() {
  const [enabled, setEnabled] = useState(false);
  const [hour, setHour] = useState(19);
  const [busy, setBusy] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    try {
      setEnabled(localStorage.getItem(KEY) === "1");
      const h = Number(localStorage.getItem(HOUR_KEY));
      if (Number.isFinite(h) && h >= 0 && h <= 23) setHour(h);
    } catch {
      /* ignore */
    }
    setSupported(isNative() || (typeof window !== "undefined" && "Notification" in window));
  }, []);

  const schedule = useCallback(async (atHour: number) => {
    const plug = await plugin();
    if (!plug) return;
    await plug.cancel({ notifications: [{ id: NOTIFICATION_ID }] }).catch(() => undefined);
    await plug.schedule({
      notifications: [
        {
          id: NOTIFICATION_ID,
          title: "Your daily credits are waiting",
          body: "Check in on Scanything to keep your streak alive.",
          schedule: { on: { hour: atHour, minute: 0 }, repeats: true, allowWhileIdle: true },
        },
      ],
    });
  }, []);

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      const plug = await plugin();
      if (plug) {
        const res = await plug.requestPermissions();
        if (res.display !== "granted") return false;
        await schedule(hour);
      } else if (typeof window !== "undefined" && "Notification" in window) {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") return false;
      } else {
        return false;
      }
      localStorage.setItem(KEY, "1");
      setEnabled(true);
      return true;
    } catch {
      return false;
    } finally {
      setBusy(false);
    }
  }, [hour, schedule]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const plug = await plugin();
      await plug?.cancel({ notifications: [{ id: NOTIFICATION_ID }] }).catch(() => undefined);
      localStorage.setItem(KEY, "0");
      setEnabled(false);
    } finally {
      setBusy(false);
    }
  }, []);

  const changeHour = useCallback(
    async (next: number) => {
      setHour(next);
      try {
        localStorage.setItem(HOUR_KEY, String(next));
      } catch {
        /* ignore */
      }
      if (enabled) await schedule(next);
    },
    [enabled, schedule],
  );

  return { enabled, hour, busy, supported, native: isNative(), enable, disable, changeHour };
}

const WEB_SHOWN_KEY = "scanything.reminder.lastWebNudge";

/** Web fallback: nudge once per day when the app is opened after the chosen hour. */
export function useWebReminderNudge(signedIn: boolean) {
  useEffect(() => {
    if (!signedIn || isNative()) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    try {
      if (localStorage.getItem(KEY) !== "1") return;
      if (Notification.permission !== "granted") return;
      const hour = Number(localStorage.getItem(HOUR_KEY) ?? 19);
      const today = new Date().toISOString().slice(0, 10);
      if (localStorage.getItem(WEB_SHOWN_KEY) === today) return;
      if (new Date().getHours() < hour) return;
      localStorage.setItem(WEB_SHOWN_KEY, today);
      new Notification("Your daily credits are waiting", {
        body: "Check in on Scanything to keep your streak alive.",
        icon: "/favicon.png",
      });
    } catch {
      /* ignore */
    }
  }, [signedIn]);
}
