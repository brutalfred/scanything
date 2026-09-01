import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { usePiAuth } from "@/hooks/usePiAuth";
import { getPiIdentity, piUnlink } from "@/lib/pi.functions";

/** "Continue with Pi" — only rendered inside the Pi Browser. */
export function PiSignInButton({ className }: { className?: string }) {
  const { available, busy, signInWithPi } = usePiAuth();
  if (!available) return null;

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void signInWithPi()}
      className={
        className ??
        "mb-4 w-full rounded-lg border border-black/30 px-4 py-2.5 text-sm font-semibold text-black hover:bg-black/5 disabled:opacity-50"
      }
    >
      {busy ? "Connecting to Pi…" : "Continue with Pi"}
    </button>
  );
}

/** Account-tab row showing the linked Pi identity, with connect/unlink. */
export function PiAccountRow({ enabled }: { enabled: boolean }) {
  const { available, busy, signInWithPi } = usePiAuth();
  const queryClient = useQueryClient();

  const identity = useQuery({
    queryKey: ["pi-identity"],
    queryFn: () => getPiIdentity(),
    enabled,
    retry: false,
    staleTime: 60_000,
  });

  if (!available && !identity.data) return null;

  async function unlink() {
    try {
      await piUnlink();
      await queryClient.invalidateQueries({ queryKey: ["pi-identity"] });
      toast.success("Pi account unlinked");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not unlink");
    }
  }

  return (
    <div className="mt-5 rounded-xl border border-current/30 bg-current/5 px-3 py-2 text-sm">
      {identity.data ? (
        <div className="flex items-center justify-between gap-2">
          <span>
            Pi connected
            {identity.data.username ? `: @${identity.data.username}` : ""}
          </span>
          <button
            type="button"
            onClick={() => void unlink()}
            className="text-xs underline opacity-80"
          >
            Unlink
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => void signInWithPi()}
          className="w-full text-center font-semibold disabled:opacity-50"
        >
          {busy ? "Connecting to Pi…" : "Connect Pi account"}
        </button>
      )}
      <p className="mt-1 text-[10px] opacity-60">
        Pi accounts sign in through the Pi Browser — email login and password reset
        don't apply to them.
      </p>
    </div>
  );
}
