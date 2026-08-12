import { useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Check, ChevronDown, Download, LogIn, LogOut, ShieldCheck, Trophy, User2, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getAccountStats } from "@/lib/credits.functions";
import { getIsAdmin } from "@/lib/admin.functions";
import { THEMES, isPremiumTheme } from "@/lib/theme";
import { LANGUAGES, LANGUAGE_NATIVE } from "@/lib/i18n";
import { useLanguage } from "@/hooks/useLanguage";
import { useTheme } from "@/hooks/useTheme";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { useCameraPermission } from "@/hooks/useCameraPermission";
import { useAiConsent } from "@/hooks/useAiConsent";
import { useAppVersion } from "@/hooks/useAppVersion";
import { useAndroidApp } from "@/hooks/useAndroidApp";
import { DailyCheckin } from "./DailyCheckin";
import { GameSheet } from "@/components/game/GameSheet";
import { isNative } from "@/lib/platform";
import { useSubscription } from "@/hooks/useSubscription";
import { PlanBadge } from "@/components/PlanLogo";




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
  const camera = useCameraPermission();
  const aiConsent = useAiConsent();
  const appVersion = useAppVersion();
  const androidApp = useAndroidApp();
  const { plan, subscription } = useSubscription(signedIn && open);
  const renewalDate = subscription?.current_period_end
    ? new Date(subscription.current_period_end)
    : null;


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
            <div className="flex flex-wrap items-center justify-center gap-2">
              <p className="truncate text-center text-base font-semibold">
                {email ?? t("account")}
              </p>
              {plan && <PlanBadge plan={plan} />}
            </div>
            {plan && (
              <p className="mt-1 text-center text-[11px] opacity-70">
                {renewalDate
                  ? `${t("renewsOn")} ${renewalDate.toLocaleDateString()}`
                  : t("lifetimeAccess")}
              </p>
            )}


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



            <div className="mt-3 rounded-xl border border-current/30 bg-current/5 px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 font-semibold">
                  <ShieldCheck className="h-4 w-4" />
                  AI analysis consent
                </span>
                {aiConsent.granted ? (
                  <button
                    type="button"
                    onClick={aiConsent.decline}
                    className="rounded-lg border border-current/30 px-2 py-1 text-xs font-semibold transition-colors hover:bg-current/10"
                  >
                    Withdraw
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={aiConsent.accept}
                    className="rounded-lg border border-current/30 px-2 py-1 text-xs font-semibold transition-colors hover:bg-current/10"
                  >
                    Give consent
                  </button>
                )}
              </div>
              <p className="mt-1.5 text-[11px] leading-snug opacity-70">
                {aiConsent.granted
                  ? `Granted${aiConsent.grantedAt ? " " + new Date(aiConsent.grantedAt).toLocaleDateString() : ""} — scans are sent to our AI provider for analysis.`
                  : "Not granted — the camera stays off and no pictures are sent to the AI provider."}
              </p>
            </div>

            <DailyCheckin enabled={signedIn && open} />

            <div className="mt-4">
              <WatchAdButton signedIn={signedIn} />
            </div>


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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="mt-2 flex w-full items-center justify-between gap-2 rounded-xl border border-current/30 bg-current/5 px-3 py-2 text-sm font-semibold transition-colors hover:bg-current/10"
                  >
                    <span className="flex items-center gap-2">
                      <span className="flex h-4 w-10 overflow-hidden rounded">
                        {(THEMES.find((th) => th.key === theme) ?? THEMES[0]).swatch.map((c) => (
                          <span key={c} className="flex-1" style={{ backgroundColor: c }} />
                        ))}
                      </span>
                      {(THEMES.find((th) => th.key === theme) ?? THEMES[0]).label}
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-70" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="z-[60] max-h-64 w-56 overflow-y-auto">
                  {THEMES.map((th) => {
                    const locked = isPremiumTheme(th.key) && !plan;
                    return (
                      <DropdownMenuItem
                        key={th.key}
                        disabled={locked}
                        onSelect={() => setTheme(th.key)}
                        className="gap-2"
                      >
                        <span className="flex h-4 w-10 shrink-0 overflow-hidden rounded">
                          {th.swatch.map((c) => (
                            <span key={c} className="flex-1" style={{ backgroundColor: c }} />
                          ))}
                        </span>
                        <span className="flex-1 truncate text-xs">
                          {locked ? "🔒 " : ""}
                          {th.label}
                        </span>
                        {theme === th.key && <Check className="h-3.5 w-3.5" />}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
              {!plan && (
                <p className="mt-2 text-[10px] opacity-70">{t("premiumThemesLocked")}</p>
              )}
            </div>

            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
                {t("language")}
              </p>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="mt-2 flex w-full items-center justify-between gap-2 rounded-xl border border-current/30 bg-current/5 px-3 py-2 text-sm font-semibold transition-colors hover:bg-current/10"
                  >
                    <span className="truncate">{LANGUAGE_NATIVE[language]}</span>
                    <ChevronDown className="h-4 w-4 opacity-70" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="z-[60] max-h-64 w-56 overflow-y-auto">
                  {LANGUAGES.map((lang) => (
                    <DropdownMenuItem
                      key={lang}
                      onSelect={() => setLanguage(lang)}
                      className="gap-2"
                    >
                      <span className="flex-1 truncate text-xs">{LANGUAGE_NATIVE[lang]}</span>
                      {language === lang && <Check className="h-3.5 w-3.5" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
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
              to="/account/data"
              onClick={() => setOpen(false)}
              className="mt-3 block text-center text-xs text-muted-foreground underline"
            >
              Delete my data
            </Link>

            <Link
              to="/account/delete"
              onClick={() => setOpen(false)}
              className="mt-2 block text-center text-xs text-muted-foreground underline"
            >
              {t("deleteMyAccount")}
            </Link>


            <p className="mt-3 text-center text-[10px] text-muted-foreground opacity-60">
              {t("version")} {appVersion} · {androidApp ? "Android app" : "Web"}
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
