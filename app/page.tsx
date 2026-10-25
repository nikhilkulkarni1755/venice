"use client";

import { useEffect, useState } from "react";
import type { Bakery } from "@/lib/types";

export default function Home() {
  const [bakeries, setBakeries] = useState<Bakery[]>([]);
  const [mode, setMode] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    const r = await fetch("/api/bakeries");
    const j = await r.json();
    setBakeries(j.bakeries || []);
    setMode(j.storageMode);
  }
  useEffect(() => {
    load();
  }, []);

  async function addBakery(e: React.FormEvent) {
    e.preventDefault();
    if (!name) return;
    setLoading(true);
    const r = await fetch("/api/bakeries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, address }),
    });
    const j = await r.json();
    setLoading(false);
    if (j.bakery) window.location.href = `/b/${j.bakery.id}`;
    else alert(j.error);
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <header className="mb-10">
        <div className="pill bg-butter/30 text-caramel mb-4">🥐 Venice</div>
        <h1 className="font-display text-5xl leading-tight text-crust">
          Let&apos;s get your bakery more <span className="text-berry">foot traffic!</span>
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-crust/70">
          An agent that reads your Google foot-traffic &amp; sales, finds where you&apos;re losing money, and
          <strong className="text-crust"> builds the posters, Google profile, website, and TikToks</strong> to bring
          customers back — automatically.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="card p-6">
          <h2 className="mb-1 font-display text-2xl text-crust">Analyze a bakery</h2>
          <p className="mb-4 text-sm text-crust/60">Enter any bakery. We pull live foot-traffic signals and reviews.</p>
          <form onSubmit={addBakery} className="space-y-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Bakery name (e.g. Tartine Bakery)"
              className="w-full rounded-xl border border-crust/15 bg-white px-4 py-2.5 outline-none focus:border-caramel"
            />
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="City or address (optional)"
              className="w-full rounded-xl border border-crust/15 bg-white px-4 py-2.5 outline-none focus:border-caramel"
            />
            <button className="btn-primary w-full" disabled={loading}>
              {loading ? "Pulling foot-traffic…" : "Analyze →"}
            </button>
          </form>
        </div>

        <div className="card p-6">
          <h2 className="mb-1 font-display text-2xl text-crust">Your bakeries</h2>
          <p className="mb-4 text-sm text-crust/60">
            Live data only. <span className="pill bg-sage/15 text-sage">storage: {mode || "…"}</span>
          </p>
          <div className="space-y-2">
            {bakeries.map((b) => (
              <a
                key={b.id}
                href={`/b/${b.id}`}
                className="flex items-center justify-between rounded-xl border border-crust/10 bg-white/70 px-4 py-3 transition hover:border-caramel hover:bg-white"
              >
                <div>
                  <div className="font-semibold text-crust">{b.name}</div>
                  <div className="text-xs text-crust/55">{b.address}</div>
                </div>
                <div className="text-right text-sm">
                  <div className="text-caramel">★ {b.rating}</div>
                  <div className="text-xs text-crust/45">{b.reviewCount} reviews</div>
                </div>
              </a>
            ))}
            {!bakeries.length && <div className="text-sm text-crust/50">No bakeries yet. Add one on the left.</div>}
          </div>
        </div>
      </section>

      <footer className="mt-12 text-center text-xs text-crust/40">
        Built with Supabase · Anthropic · Firecrawl · Canva · ElevenLabs · Stripe · Freestyle · Omnara
      </footer>
    </main>
  );
}
