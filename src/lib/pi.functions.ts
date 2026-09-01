import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PiProfile = { uid: string; username: string | null };

type PiMeResponse = { uid?: string; username?: string };

/**
 * Validates a Pi access token against the Pi Platform API.
 * No Pi API key is needed for this flow — the user's own token is the proof.
 */
async function verifyPiToken(accessToken: string): Promise<PiProfile> {
  if (!accessToken || accessToken.length < 10) {
    throw new Error("Missing Pi access token");
  }
  const res = await fetch("https://api.minepi.com/v2/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error("Pi authentication could not be verified");
  }
  const me = (await res.json()) as PiMeResponse;
  if (!me?.uid) throw new Error("Pi authentication returned no user");
  return { uid: me.uid, username: me.username ?? null };
}

function piEmail(uid: string): string {
  const safe = uid.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return `pi_${safe}@pi.scanything.app`;
}

export type PiSignInResult = {
  /** One-time token the browser redeems with verifyOtp to open the session. */
  tokenHash: string;
  username: string | null;
  created: boolean;
};

/**
 * Signs a Pi Browser user into their Pi-backed Scanything account,
 * creating it on first use.
 */
export const piSignIn = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string }) => {
    if (typeof input?.accessToken !== "string") throw new Error("Invalid request");
    return { accessToken: input.accessToken };
  })
  .handler(async ({ data }): Promise<PiSignInResult> => {
    const profile = await verifyPiToken(data.accessToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("pi_identities")
      .select("user_id, pi_username")
      .eq("pi_uid", profile.uid)
      .maybeSingle();

    let email: string;
    let created = false;

    if (existing?.user_id) {
      const { data: user, error } = await supabaseAdmin.auth.admin.getUserById(existing.user_id);
      if (error || !user?.user?.email) throw new Error("Linked account is unavailable");
      email = user.user.email;
      if (profile.username && profile.username !== existing.pi_username) {
        await supabaseAdmin
          .from("pi_identities")
          .update({ pi_username: profile.username })
          .eq("pi_uid", profile.uid);
      }
    } else {
      email = piEmail(profile.uid);
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { pi_uid: profile.uid, pi_username: profile.username },
      });
      if (createError || !newUser?.user) {
        throw new Error(createError?.message ?? "Could not create Pi account");
      }
      created = true;
      const { error: linkError } = await supabaseAdmin.from("pi_identities").insert({
        pi_uid: profile.uid,
        user_id: newUser.user.id,
        pi_username: profile.username,
      });
      if (linkError) {
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
        throw new Error("Could not link Pi account");
      }
    }

    const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    const tokenHash = link?.properties?.hashed_token;
    if (linkErr || !tokenHash) throw new Error("Could not start the Pi session");

    return { tokenHash, username: profile.username, created };
  });

/** Links a Pi identity to the account that is already signed in. */
export const piLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { accessToken: string }) => {
    if (typeof input?.accessToken !== "string") throw new Error("Invalid request");
    return { accessToken: input.accessToken };
  })
  .handler(async ({ data, context }): Promise<PiProfile> => {
    const profile = await verifyPiToken(data.accessToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("pi_identities")
      .select("user_id")
      .eq("pi_uid", profile.uid)
      .maybeSingle();

    if (existing?.user_id && existing.user_id !== context.userId) {
      throw new Error("This Pi account is already linked to another Scanything account");
    }

    const { error } = await supabaseAdmin.from("pi_identities").upsert(
      {
        pi_uid: profile.uid,
        user_id: context.userId,
        pi_username: profile.username,
      },
      { onConflict: "pi_uid" },
    );
    if (error) throw new Error("Could not link this Pi account");

    return profile;
  });

/** Removes the Pi link from the signed-in account. */
export const piUnlink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("pi_identities")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error("Could not unlink this Pi account");
    return { ok: true };
  });

/** Returns the Pi identity linked to the signed-in account, if any. */
export const getPiIdentity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PiProfile | null> => {
    const { data } = await context.supabase
      .from("pi_identities")
      .select("pi_uid, pi_username")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!data) return null;
    return { uid: data.pi_uid, username: data.pi_username };
  });
