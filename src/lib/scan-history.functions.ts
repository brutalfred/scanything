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
  officialUrl?: string;
};

export type ScanHistoryItem = {
  name: string;
  /** Full untruncated document text (document scans only). */
  fullText?: string;
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
    officialUrl: str(o.officialUrl, 500),
  };
}


export type ScanHistoryEntry = {
  id: string;
  title: string | null;
  mode: string;
  collection: string | null;
  items: ScanHistoryItem[];
  createdAt: string;
};

export const listScanHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ScanHistoryEntry[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("scan_history")
      .select("id, title, mode, items, collection, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      mode: r.mode,
      collection: (r as { collection?: string | null }).collection ?? null,
      items: (Array.isArray(r.items) ? r.items : []) as ScanHistoryItem[],
      createdAt: r.created_at,
    }));
  });

export const saveScanHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      mode?: string;
      items: ScanHistoryItem[];
      title?: string | null;
      collection?: string | null;
    }) => {
      const items = Array.isArray(input?.items) ? input.items.slice(0, 200) : [];
      return {
        mode: ["video", "document", "resale"].includes(String(input?.mode))
          ? String(input?.mode)
          : "photo",
        title: typeof input?.title === "string" ? input.title.slice(0, 120) : null,
        collection:
          typeof input?.collection === "string" && input.collection.trim()
            ? input.collection.trim().slice(0, 60)
            : null,
        items: items.map((i) => ({
          name: String(i?.name ?? "").slice(0, 120),
          category: i?.category ? String(i.category).slice(0, 40) : undefined,
          description: i?.description ? String(i.description).slice(0, 600) : undefined,
          confidence: typeof i?.confidence === "number" ? i.confidence : undefined,
          priceMin: typeof i?.priceMin === "number" ? i.priceMin : undefined,
          priceMax: typeof i?.priceMax === "number" ? i.priceMax : undefined,
          deep: sanitizeDeep(i?.deep),
          fullText:
            typeof i?.fullText === "string" && i.fullText ? i.fullText.slice(0, 60000) : undefined,
        })),
      };
    },
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("scan_history")
      .insert({
        user_id: userId,
        mode: data.mode,
        title: data.title,
        items: data.items,
        collection: data.collection,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    // Keep only the 10 most recent loose scans per user. Scans filed into a
    // collection are kept forever.
    const { data: keep } = await supabase
      .from("scan_history")
      .select("id")
      .eq("user_id", userId)
      .is("collection", null)
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
          .is("collection", null)
          .lt("created_at", cutoff.created_at);
      }
    }

    return { id: row.id };
  });

/** Moves an existing scan into a named collection (or back out with null). */
export const setScanCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; collection: string | null }) => ({
    id: String(input?.id ?? ""),
    collection:
      typeof input?.collection === "string" && input.collection.trim()
        ? input.collection.trim().slice(0, 60)
        : null,
  }))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("scan_history")
      .update({ collection: data.collection })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
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
      fullText:
        typeof i?.fullText === "string" && i.fullText ? i.fullText.slice(0, 60000) : undefined,
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
