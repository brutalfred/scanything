import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getScanEconomics } from "@/lib/economics.functions";
import { SCAN_COST_USD_ESTIMATE } from "@/lib/economics";

export const Route = createFileRoute("/economics")({
  head: () => ({
    meta: [
      { title: "Scan Economics — Scanything" },
      {
        name: "description",
        content:
          "Owner-only report on Scanything AI processing costs: token usage, average cost per photo and video scan, and how credit pricing compares.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Scan Economics — Scanything" },
      {
        property: "og:description",
        content:
          "Owner-only report on Scanything AI token usage and the real cost of each photo and video scan.",
      },

      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EconomicsPage,
});

function usd(n: number) {
  return `$${n.toFixed(n < 0.01 ? 5 : 2)}`;
}

function EconomicsPage() {
  const [days, setDays] = useState(30);
  const fetchEconomics = useServerFn(getScanEconomics);

  const { data, isLoading, error } = useQuery({
    queryKey: ["scan-economics", days],
    queryFn: () => fetchEconomics({ data: { days } }),
    retry: false,
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/70 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-3">
          <Link to="/" className="text-sm font-medium text-primary hover:underline">
            ← Back to Scanything
          </Link>
          <span className="text-xs text-muted-foreground">Scan Economics</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-6 text-3xl font-bold gold-text">Scan Economics</h1>

        <div className="mb-6 flex gap-2">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-md border px-3 py-1 text-sm transition ${
                days === d
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              Last {d} days
            </button>
          ))}
        </div>

        {error ? (
          <p className="text-sm text-destructive">
            This report is only available to the owner account.
          </p>
        ) : isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : data ? (
          <div className="space-y-6">
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat label="Photo scans" value={String(data.scans)} />
              <Stat
                label="Avg cost / scan"
                value={data.scans > 0 ? usd(data.avgScanCostUsd) : `${usd(SCAN_COST_USD_ESTIMATE)}*`}
              />
              <Stat label="Total AI cost" value={usd(data.totalCostUsd)} />
            </section>

            {data.scans === 0 && (
              <p className="text-xs text-muted-foreground">
                * No measured scans yet in this window — showing the modelled estimate.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Cost is measured from the Lovable AI Gateway token usage recorded in{" "}
              <code>ai_usage</code>. The estimate is based on Gemini 3 Flash until real data exists.
            </p>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  return (
    <div className="rounded-lg border border-border/60 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`text-lg font-semibold ${
          tone === "bad" ? "text-destructive" : tone === "good" ? "text-primary" : "gold-text"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
