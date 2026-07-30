import { useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, LogIn, LogOut, ShieldCheck, User2, Volume2, VolumeX, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getAccountStats } from "@/lib/credits.functions";
import { getIsAdmin } from "@/lib/admin.functions";
import { THEMES } from "@/lib/theme";
import { useTheme } from "@/hooks/useTheme";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { useSounds } from "@/hooks/useSounds";
import { DailyCheckin } from "./DailyCheckin";



export function AccountButton({
  signedIn,
  email,
  balance,
}: {
  signedIn: boolean;
  email: string | null;
  balance: number;
}) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const { canInstall, installed, isIos, promptInstall } = useInstallPrompt();

  async function handleInstall() {
    if (installed) {
      toast.info("Scanything is already installed on this device");
      return;
    }
    const outcome = await promptInstall();
    if (outcome === "unavailable") {
      toast.info(
        isIos
          ? "On iPhone/iPad: tap the Share button in Safari, then \"Add to Home Screen\"."
          : "In your browser menu choose \"Install app\" or \"Add to Home screen\" to add Scanything.",
        { duration: 8000 },
      );
    } else if (outcome === "accepted") {
      toast.success("Scanything added to your device");
    }
  }


  const stats = useQuery({
    queryKey: ["account-stats"],
    queryFn: () => getAccountStats(),
    enabled: signedIn && open,
    staleTime: 15_000,
  });

  const admin = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => getIsAdmin(),
    enabled: signedIn && open,
    retry: false,
    staleTime: 5 * 60_000,
  });

  async function signOut() {
    setOpen(false);
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  }

  if (!signedIn) {
    return (
      <Link
        to="/auth"
        className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-primary/40 bg-card px-2.5 py-1 text-[11px] font-semibold text-primary gold-glow sm:px-3 sm:py-1.5 sm:text-xs"
      >
        <LogIn className="h-3.5 w-3.5" />
        Sign in
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Account"
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-primary/40 bg-card text-primary gold-glow"
      >
        <User2 className="h-4 w-4" />
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-label="Account"
            onClick={(e) => e.stopPropagation()}
            className="theme-panel gold-glow w-full max-w-xs rounded-2xl p-5 text-sm shadow-2xl"
          >
            <p className="truncate text-center text-base font-semibold">
              {email ?? "Account"}
            </p>

            <dl className="mt-4 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <dt className="opacity-70">Credits</dt>
                <dd className="font-semibold">{balance}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="opacity-70">Photo scans</dt>
                <dd className="font-semibold">
                  {stats.isLoading ? "…" : (stats.data?.photoScans ?? 0)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="opacity-70">Credits spent</dt>
                <dd className="font-semibold">
                  {stats.isLoading ? "…" : (stats.data?.creditsSpent ?? 0)}
                </dd>
              </div>

            </dl>

            <DailyCheckin enabled={signedIn && open} />

            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wide opacity-70">Theme</p>
              <div className="mt-2 grid grid-cols-5 gap-2">
                {THEMES.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTheme(t.key)}
                    aria-label={`${t.label} theme`}
                    aria-pressed={theme === t.key}
                    className={`rounded-lg border p-1 transition-transform hover:scale-105 ${
                      theme === t.key ? "border-current" : "border-transparent opacity-70"
                    }`}
                  >
                    <span className="flex h-6 w-full overflow-hidden rounded">
                      {t.swatch.map((c) => (
                        <span key={c} className="flex-1" style={{ backgroundColor: c }} />
                      ))}
                    </span>
                    <span className="mt-1 block text-[9px] font-medium leading-tight">
                      {t.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>


            <button
              type="button"
              onClick={handleInstall}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-current/30 bg-current/5 px-3 py-2 font-semibold transition-colors hover:bg-current/10"
            >
              <Download className="h-4 w-4" />
              {installed ? "App installed" : canInstall ? "Install app" : "Add to desktop / home screen"}
            </button>

            {admin.data === true && (
              <Link
                to="/admin"
                onClick={() => setOpen(false)}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-current/30 bg-current/5 px-3 py-2 font-semibold transition-colors hover:bg-current/10"
              >
                <ShieldCheck className="h-4 w-4" />
                Admin
              </Link>
            )}

            <button
              type="button"
              onClick={signOut}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-current/30 bg-current/5 px-3 py-2 font-semibold transition-colors hover:bg-current/10"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>

            <div className="mt-3 flex justify-center">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-destructive/50 text-destructive transition-colors hover:bg-destructive/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
