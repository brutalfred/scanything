import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogIn, LogOut, User2, Coins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function AccountButton({
  signedIn,
  email,
  onOpenCredits,
}: {
  signedIn: boolean;
  email: string | null;
  onOpenCredits: () => void;
}) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

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
        className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-card px-3 py-1.5 text-xs font-semibold text-primary gold-glow"
      >
        <LogIn className="h-3.5 w-3.5" />
        Sign in
      </Link>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-primary/40 bg-card text-primary gold-glow"
      >
        <User2 className="h-4 w-4" />
      </button>
      {open && (
        <div className="gold-line absolute right-0 z-40 mt-2 w-56 rounded-xl bg-card p-2 text-sm shadow-xl">
          <p className="truncate px-2 py-1.5 text-xs text-muted-foreground">{email}</p>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onOpenCredits();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-accent"
          >
            <Coins className="h-4 w-4" />
            Credits & history
          </button>
          <button
            type="button"
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-destructive hover:bg-accent"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
