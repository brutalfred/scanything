import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Gift, Share2 } from "lucide-react";
import { toast } from "sonner";
import {
  getReferralStats,
  redeemReferralCode,
  REFERRAL_REWARD,
} from "@/lib/referral.functions";

export const PENDING_REF_KEY = "scanything.referral.pending";

function inviteLink(code: string) {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://scanything.app";
  return `${origin}/?ref=${code}`;
}

export function ReferralCard({ enabled }: { enabled: boolean }) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [input, setInput] = useState("");

  const stats = useQuery({
    queryKey: ["referral-stats"],
    queryFn: () => getReferralStats(),
    enabled,
    staleTime: 60_000,
  });

  const redeem = useMutation({
    mutationFn: (code: string) => redeemReferralCode({ data: { code } }),
    onSuccess: (res) => {
      if (res.status === "redeemed") {
        toast.success(`Invite accepted — ${res.reward} credits added for both of you!`);
        queryClient.invalidateQueries({ queryKey: ["credits"] });
        queryClient.invalidateQueries({ queryKey: ["referral-stats"] });
        setInput("");
      } else if (res.status === "already_redeemed") {
        toast.info("You've already used an invite code");
      } else if (res.status === "self_referral") {
        toast.error("You can't use your own invite code");
      } else {
        toast.error("That invite code doesn't exist");
      }
      try {
        localStorage.removeItem(PENDING_REF_KEY);
      } catch {
        /* ignore */
      }
    },
    onError: () => toast.error("Could not redeem that code"),
  });

  // Auto-redeem a code captured from an invite link.
  useEffect(() => {
    if (!enabled || !stats.data || stats.data.redeemed || redeem.isPending) return;
    let pending: string | null = null;
    try {
      pending = localStorage.getItem(PENDING_REF_KEY);
    } catch {
      return;
    }
    if (!pending || pending === stats.data.code) return;
    redeem.mutate(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, stats.data?.redeemed, stats.data?.code]);

  const code = stats.data?.code ?? "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteLink(code));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      toast.success("Invite link copied");
    } catch {
      toast.error("Could not copy the link");
    }
  }

  async function share() {
    const text = `Scan anything with your camera and get instant prices and info. Use my invite code ${code} and we both get ${REFERRAL_REWARD} credits.`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Scanything", text, url: inviteLink(code) });
        return;
      } catch {
        return;
      }
    }
    void copy();
  }

  /** Pi Browser link always points at the public site so Pioneers can open it. */
  async function sharePi() {
    const url = `https://scanything.app/?ref=${code}`;
    const text = `Scan anything with your camera. Sign in with Pi using my invite code ${code} — we both get ${REFERRAL_REWARD} credits.`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Scanything", text, url });
        return;
      } catch {
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Pi invite link copied");
    } catch {
      toast.error("Could not copy the link");
    }
  }


  return (
    <div className="mt-3 rounded-xl border border-current/30 bg-current/5 px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 font-semibold">
          <Gift className="h-4 w-4" />
          Invite a friend
        </span>
        <span className="text-[11px] opacity-70">
          {stats.isLoading ? "…" : `${stats.data?.invited ?? 0} joined`}
        </span>
      </div>
      <p className="mt-1.5 text-[11px] leading-snug opacity-70">
        You both get {REFERRAL_REWARD} credits when a friend signs in with your code.
        {stats.data?.creditsEarned ? ` You've earned ${stats.data.creditsEarned} so far.` : ""}
      </p>

      <div className="mt-2 flex items-center gap-2">
        <code className="flex-1 truncate rounded-lg border border-current/30 bg-current/5 px-2 py-1.5 text-center text-sm font-semibold tracking-[0.2em]">
          {code || "……"}
        </code>
        <button
          type="button"
          onClick={copy}
          disabled={!code}
          aria-label="Copy invite link"
          className="rounded-lg border border-current/30 p-2 transition-colors hover:bg-current/10 disabled:opacity-50"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={share}
          disabled={!code}
          aria-label="Share invite"
          className="rounded-lg border border-current/30 p-2 transition-colors hover:bg-current/10 disabled:opacity-50"
        >
          <Share2 className="h-4 w-4" />
        </button>
      </div>

      {piBrowser && (
        <button
          type="button"
          disabled={!code}
          onClick={() => void sharePi()}
          className="mt-2 w-full rounded-lg border border-current/30 px-2.5 py-1.5 text-xs font-semibold transition-colors hover:bg-current/10 disabled:opacity-50"
        >
          Share Pi invite link
        </button>
      )}


      {stats.data && !stats.data.redeemed && (
        <form
          className="mt-2 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const value = input.trim().toUpperCase();
            if (value) redeem.mutate(value);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            placeholder="Got a code?"
            maxLength={12}
            className="min-w-0 flex-1 rounded-lg border border-current/30 bg-transparent px-2 py-1.5 text-xs outline-none placeholder:opacity-50"
          />
          <button
            type="submit"
            disabled={redeem.isPending || input.trim().length < 4}
            className="rounded-lg border border-current/30 px-2.5 py-1.5 text-xs font-semibold transition-colors hover:bg-current/10 disabled:opacity-50"
          >
            {redeem.isPending ? "…" : "Redeem"}
          </button>
        </form>
      )}
    </div>
  );
}
