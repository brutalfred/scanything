import { useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Check, Download, LogIn, LogOut, ShieldCheck, Trophy, User2, Volume2, VolumeX, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getAccountStats } from "@/lib/credits.functions";
import { getIsAdmin } from "@/lib/admin.functions";
import { THEMES } from "@/lib/theme";
import { LANGUAGES, LANGUAGE_NATIVE } from "@/lib/i18n";
import { useLanguage } from "@/hooks/useLanguage";
import { useTheme } from "@/hooks/useTheme";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { useSounds } from "@/hooks/useSounds";
import { useCameraPermission } from "@/hooks/useCameraPermission";
import { APP_VERSION } from "@/lib/version";
import { DailyCheckin } from "./DailyCheckin";
import { GameSheet } from "@/components/game/GameSheet";
import { isNative } from "@/lib/platform";




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
  const [gameOpen, setGameOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const { canInstall, installed, isIos, promptInstall } = useInstallPrompt();
  const { muted, volume, toggleMute, setVolume } = useSounds();
  const camera = useCameraPermission();


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
        {t("signIn")}
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
            className="theme-panel gold-glow max-h-[85vh] w-full max-w-xs overflow-y-auto rounded-2xl p-5 text-sm shadow-2xl"
          >
            <p className="truncate text-center text-base font-semibold">
              {email ?? t("account")}
            </p>


            <dl className="mt-4 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <dt className="opacity-70">{t("credits")}</dt>
                <dd className="font-semibold">{balance}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="opacity-70">{t("photoScans")}</dt>
                <dd className="font-semibold">
                  {stats.isLoading ? "…" : (stats.data?.photoScans ?? 0)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="opacity-70">{t("creditsSpent")}</dt>
                <dd className="font-semibold">
                  {stats.isLoading ? "…" : (stats.data?.creditsSpent ?? 0)}
                </dd>
              </div>
            </dl>

            <div className="mt-4 rounded-xl border border-current/30 bg-current/5">
              <button
                type="button"
                onClick={toggleMute}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 font-semibold transition-colors hover:bg-current/10"
              >
                <span className="flex items-center gap-2">
                  {muted || volume === 0 ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                  {t("soundEffects")}
                </span>
                <span className="text-xs font-medium opacity-70">{muted ? t("muted") : t("on")}</span>
              </button>
              <div className="flex items-center gap-3 px-3 pb-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={Math.round(volume * 100)}
                  onChange={(e) => setVolume(Number(e.target.value) / 100)}
                  aria-label="Sound effects volume"
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-current/25 accent-current disabled:opacity-50"
                  disabled={muted}
                />
                <span className="w-9 shrink-0 text-right text-xs font-medium tabular-nums opacity-70">
                  {Math.round(volume * 100)}%
                </span>
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-current/30 bg-current/5 px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 font-semibold">
                  <Camera className="h-4 w-4" />
                  {t("cameraAccess")}
                </span>
                {camera.state === "granted" ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                    <Check className="h-3.5 w-3.5" />
                    {t("on")}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void camera.request()}
                    disabled={camera.requesting || camera.state === "denied"}
                    className="rounded-lg border border-current/30 px-2 py-1 text-xs font-semibold transition-colors hover:bg-current/10 disabled:opacity-50"
                  >
                    {camera.requesting ? t("cameraRequesting") : t("cameraGrantButton")}
                  </button>
                )}
              </div>
              <p className="mt-1.5 text-[11px] leading-snug opacity-70">
                {camera.state === "granted"
                  ? t("cameraGranted")
                  : camera.state === "denied"
                    ? t("cameraDeniedHelp")
                    : t("cameraPromptHelp")}
              </p>
            </div>



            <DailyCheckin enabled={signedIn && open} />


            <button
              type="button"
              onClick={() => setGameOpen(true)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-current/30 bg-current/5 px-3 py-2 font-semibold transition-colors hover:bg-current/10"
            >
              <Trophy className="h-4 w-4" />
              400m hurdles - Compete for free credits every month
            </button>


            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{t("theme")}</p>
              <div className="mt-2 grid grid-cols-5 gap-2">
                {THEMES.map((th) => (
                  <button
                    key={th.key}
                    type="button"
                    onClick={() => setTheme(th.key)}
                    aria-label={`${th.label} theme`}
                    aria-pressed={theme === th.key}
                    className={`rounded-lg border p-1 transition-transform hover:scale-105 ${
                      theme === th.key ? "border-current" : "border-transparent opacity-70"
                    }`}
                  >
                    <span className="flex h-6 w-full overflow-hidden rounded">
                      {th.swatch.map((c) => (
                        <span key={c} className="flex-1" style={{ backgroundColor: c }} />
                      ))}
                    </span>
                    <span className="mt-1 block text-[9px] font-medium leading-tight">
                      {th.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
                {t("language")}
              </p>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setLanguage(lang)}
                    aria-pressed={language === lang}
                    className={`rounded-lg border px-2 py-1.5 text-[10px] font-medium leading-tight transition-colors ${
                      language === lang
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-current/25 opacity-70 hover:bg-current/10"
                    }`}
                  >
                    {LANGUAGE_NATIVE[lang]}
                  </button>
                ))}
              </div>
            </div>



            {!isNative() && (
            <button
              type="button"
              onClick={handleInstall}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-current/30 bg-current/5 px-3 py-2 font-semibold transition-colors hover:bg-current/10"
            >
              <Download className="h-4 w-4" />
              {installed ? t("appInstalled") : canInstall ? t("installApp") : t("addToHomeScreen")}
            </button>
            )}

            {admin.data === true && (
              <Link
                to="/admin"
                onClick={() => setOpen(false)}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-current/30 bg-current/5 px-3 py-2 font-semibold transition-colors hover:bg-current/10"
              >
                <ShieldCheck className="h-4 w-4" />
                {t("admin")}
              </Link>
            )}

            <button
              type="button"
              onClick={signOut}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-current/30 bg-current/5 px-3 py-2 font-semibold transition-colors hover:bg-current/10"
            >
              <LogOut className="h-4 w-4" />
              {t("logOut")}
            </button>

            <Link
              to="/account/delete"
              onClick={() => setOpen(false)}
              className="mt-3 block text-center text-xs text-muted-foreground underline"
            >
              {t("deleteMyAccount")}
            </Link>

            <p className="mt-3 text-center text-[10px] text-muted-foreground opacity-60">
              {t("version")} {APP_VERSION}
            </p>

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

      <GameSheet open={gameOpen} onClose={() => setGameOpen(false)} email={email} />
    </>
  );
}
