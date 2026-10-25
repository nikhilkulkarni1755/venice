"use client";

import { use, useEffect, useState } from "react";
import type { Bakery, Analysis, GeneratedAsset, Recommendation } from "@/lib/types";
import { PeerChart, PopularTimesChart } from "@/components/Charts";
import { computeKpis } from "@/components/kpis";
import { AssetCard } from "@/components/AssetCard";
import { PrintPanel } from "@/components/PrintPanel";
import { SpotsPanel } from "@/components/SpotsPanel";

const TYPE_LABEL: Record<string, string> = {
  poster: "Poster",
  google_business: "Google Business",
  website: "Website",
  tiktok: "TikTok",
};

export default function Dashboard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [bakery, setBakery] = useState<Bakery | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [assets, setAssets] = useState<GeneratedAsset[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [building, setBuilding] = useState<string | null>(null);

  async function load() {
    const r = await fetch(`/api/bakeries/${id}`);
    const j = await r.json();
    setBakery(j.bakery);
    setAnalysis(j.analysis || null);
    setAssets([...(j.assets || [])].reverse());
  }
  useEffect(() => {
    load();
  }, [id]);

  async function runAnalysis() {
    setAnalyzing(true);
    const r = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bakeryId: id }),
    });
    const j = await r.json();
    if (j.analysis) setAnalysis(j.analysis);
    else alert(j.error);
    setAnalyzing(false);
  }

  async function build(type: string) {
    // The poster is made by the print agent (design + print in one step).
    if (type === "poster") return document.getElementById("print-run")?.click();
    setBuilding(type);
    const r = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bakeryId: id, type }),
    });
    const j = await r.json();
    if (j.asset) setAssets((a) => [j.asset, ...a]);
    setBuilding(null);
  }

  if (!bakery) return <main className="p-10 text-crust/60">Loading…</main>;
  const kpis = computeKpis(bakery);

  return (
    <main className="mx-auto max-w-5xl px-5 py-8">
      <a href="/" className="text-sm text-crust/50 hover:text-crust">← All bakeries</a>

      <header className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl text-crust">{bakery.name}</h1>
          <p className="text-crust/60">{bakery.address}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="pill bg-butter/30 text-caramel">★ {bakery.rating} · {bakery.reviewCount} reviews</span>
        </div>
      </header>

      {/* KPIs */}
      <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="card p-4">
            <div className="text-xs uppercase tracking-wide text-crust/45">{k.label}</div>
            <div className="mt-1 text-2xl font-bold text-crust">{k.value}</div>
            {k.sub && <div className="text-xs text-crust/50">{k.sub}</div>}
          </div>
        ))}
      </section>

      {/* Charts */}
      <section className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold text-crust">Foot traffic by day and hour</h3>
            <span className="pill bg-berry/15 text-berry">□ dead window</span>
          </div>
          {bakery.popularTimes.length ? (
            <PopularTimesChart bakery={bakery} />
          ) : (
            <p className="text-crust/50">Unavailable: connect BestTime or Apify for popular times.</p>
          )}
        </div>
        <div className="card p-5">
          <h3 className="mb-2 font-semibold text-crust">Nearby bakeries: reviews per month</h3>
          {(bakery.peers ?? []).length ? (
            <PeerChart bakery={bakery} />
          ) : (
            <p className="text-crust/50">Unavailable: no comparable nearby places found.</p>
          )}
        </div>
      </section>

      {/* Analysis */}
      <section className="card mt-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl text-crust">Agent analysis</h2>
          <button className="btn-primary" onClick={runAnalysis} disabled={analyzing}>
            {analyzing ? "Analyzing…" : analysis ? "Re-run" : "Run analysis →"}
          </button>
        </div>

        {!analysis && !analyzing && (
          <p className="mt-3 text-crust/55">
            Run the agent to find your biggest revenue leak and get a buildable growth plan.
          </p>
        )}

        {analysis && (
          <div className="mt-4">
            <h3 className="font-display text-xl text-berry">{analysis.headline}</h3>
            <p className="mt-2 text-crust/80">{analysis.summary}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="pill bg-crust/10 text-crust/60">brain: {analysis.model}</span>
              {analysis.sources?.map((s) => (
                <a key={s.url} href={s.url} target="_blank" className="pill bg-sage/15 text-sage hover:underline">
                  🔗 {s.title.slice(0, 42)}
                </a>
              ))}
            </div>

            {/* Recommendations */}
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {analysis.recommendations.map((rec: Recommendation) => (
                <div key={rec.id} className="rounded-xl border border-crust/10 bg-white/60 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold text-crust">{rec.title}</h4>
                    <span className="pill bg-butter/30 text-caramel whitespace-nowrap">{rec.effort} effort</span>
                  </div>
                  <p className="mt-1 text-sm text-crust/70">{rec.rationale}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span />
                    {rec.buildable && TYPE_LABEL[rec.type] && (
                      <button className="btn-ghost !py-1.5 !text-xs" onClick={() => build(rec.type)} disabled={building === rec.type}>
                        {building === rec.type ? "Building…" : rec.type === "poster" ? "Design & print ✨" : `Build ${TYPE_LABEL[rec.type]} ✨`}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Quick-build bar */}
      {analysis && (
        <section className="mt-4 flex flex-wrap gap-2">
          {Object.entries(TYPE_LABEL).filter(([type]) => type !== "poster").map(([type, label]) => (
            <button key={type} className="btn-ghost" onClick={() => build(type)} disabled={building === type}>
              {building === type ? "Building…" : `+ ${label}`}
            </button>
          ))}
        </section>
      )}

      {/* Print & distribute */}
      <PrintPanel bakeryId={id} onDesigned={load} />
      <SpotsPanel bakeryId={id} assets={assets} onDone={load} />

      {/* Generated assets */}
      {assets.some((a) => a.kind !== "spots") && (
        <section className="mt-6">
          <h2 className="mb-3 font-display text-2xl text-crust">Generated assets ({assets.filter((a) => a.kind !== "spots").length})</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {assets.filter((a) => a.kind !== "spots").map((a) => (
              <AssetCard key={a.id} asset={a} onDeployed={load} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
