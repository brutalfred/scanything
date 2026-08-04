import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ScanHistoryDeep = {
  brand?: string;
  product?: string;
  confidence?: number;
  description?: string;
  priceMin?: number;
  priceMax?: number;
  currency?: string;
  buyUrl?: string;
  infoUrl?: string;
};

export type ScanHistoryItem = {
  name: string;
  category?: string;
  description?: string;
  confidence?: number;
  priceMin?: number;
  priceMax?: number;
  deep?: ScanHistoryDeep;
};

function sanitizeDeep(d: unknown): ScanHistoryDeep | undefined {
  if (!d || typeof d !== "object") return undefined;
  const o = d as Record<string, unknown>;
  const str = (v: unknown, n: number) => (typeof v === "string" && v ? v.slice(0, n) : undefined);
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
  return {
    brand: str(o.brand, 120),
    product: str(o.product, 160),
    confidence: num(o.confidence),
    description: str(o.description, 1500),
    priceMin: num(o.priceMin),
    priceMax: num(o.priceMax),
    currency: str(o.currency, 8),
    buyUrl: str(o.buyUrl, 500),
    infoUrl: str(o.infoUrl, 500),
  };
}


export type ScanHistoryEntry = {
  id: string;
  title: string | null;
  mode: string;
  items: ScanHistoryItem[];
  createdAt: string;
};

export const listScanHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ScanHistoryEntry[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("scan_history")
      .select("id, title, mode, items, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      mode: r.mode,
      items: (Array.isArray(r.items) ? r.items : []) as ScanHistoryItem[],
      createdAt: r.created_at,
    }));
  });

export const saveScanHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { mode?: string; items: ScanHistoryItem[]; title?: string | null }) => {
    const items = Array.isArray(input?.items) ? input.items.slice(0, 200) : [];
    return {
      mode: input?.mode === "video" ? "video" : "photo",
      title: typeof input?.title === "string" ? input.title.slice(0, 120) : null,
      items: items.map((i) => ({
        name: String(i?.name ?? "").slice(0, 120),
        category: i?.category ? String(i.category).slice(0, 40) : undefined,
        description: i?.description ? String(i.description).slice(0, 600) : undefined,
        confidence: typeof i?.confidence === "number" ? i.confidence : undefined,
        priceMin: typeof i?.priceMin === "number" ? i.priceMin : undefined,
        priceMax: typeof i?.priceMax === "number" ? i.priceMax : undefined,
        deep: sanitizeDeep(i?.deep),

      })),
    };
  })
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("scan_history")
      .insert({ user_id: userId, mode: data.mode, title: data.title, items: data.items })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    // Keep only the 10 most recent scans per user.
    const { data: keep } = await supabase
      .from("scan_history")
      .select("id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);
    if (keep && keep.length === 10) {
      const oldest = keep[keep.length - 1]!.id;
      const { data: cutoff } = await supabase
        .from("scan_history")
        .select("created_at")
        .eq("id", oldest)
        .single();
      if (cutoff) {
        await supabase
          .from("scan_history")
          .delete()
          .eq("user_id", userId)
          .lt("created_at", cutoff.created_at);
      }
    }

    return { id: row.id };
  });

export const renameScanHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; title: string }) => ({
    id: String(input?.id ?? ""),
    title: String(input?.title ?? "").slice(0, 120),
  }))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("scan_history")
      .update({ title: data.title || null })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteScanHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: String(input?.id ?? "") }))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("scan_history")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Appends newly-found items ("Load more") to an existing scan history entry. */
export const appendScanHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; items: ScanHistoryItem[] }) => ({
    id: String(input?.id ?? ""),
    items: (Array.isArray(input?.items) ? input.items : []).slice(0, 200).map((i) => ({
      name: String(i?.name ?? "").slice(0, 120),
      category: i?.category ? String(i.category).slice(0, 40) : undefined,
      description: i?.description ? String(i.description).slice(0, 600) : undefined,
      confidence: typeof i?.confidence === "number" ? i.confidence : undefined,
      priceMin: typeof i?.priceMin === "number" ? i.priceMin : undefined,
      priceMax: typeof i?.priceMax === "number" ? i.priceMax : undefined,
      deep: sanitizeDeep(i?.deep),

    })),
  }))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const { data: row, error: readError } = await supabase
      .from("scan_history")
      .select("items")
      .eq("id", data.id)
      .eq("user_id", userId)
      .single();
    if (readError) throw new Error(readError.message);
    const existing = (Array.isArray(row?.items) ? row.items : []) as ScanHistoryItem[];
    const { error } = await supabase
      .from("scan_history")
      .update({ items: [...existing, ...data.items].slice(0, 400) })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Stores "Analyze further" results on the matching item inside a scan history entry. */
export const saveScanHistoryItemDeep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; name: string; deep: ScanHistoryDeep }) => ({
    id: String(input?.id ?? ""),
    name: String(input?.name ?? "").slice(0, 120),
    deep: sanitizeDeep(input?.deep) ?? {},
  }))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    if (!data.id || !data.name) return { ok: true };
    const { data: row, error: readError } = await supabase
      .from("scan_history")
      .select("items")
      .eq("id", data.id)
      .eq("user_id", userId)
      .single();
    if (readError) throw new Error(readError.message);
    const existing = (Array.isArray(row?.items) ? row.items : []) as ScanHistoryItem[];
    const next = existing.map((i) =>
      i?.name === data.name ? { ...i, deep: data.deep } : i,
    );
    const { error } = await supabase
      .from("scan_history")
      .update({ items: next })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
