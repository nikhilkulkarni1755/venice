"use client";

import { useState } from "react";
import type { GeneratedAsset, PosterSpot } from "@/lib/types";

export function SpotsPanel({ bakeryId, assets, onDone }: { bakeryId: string; assets: GeneratedAsset[]; onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const latest = assets.filter((a) => a.kind === "spots")[0]; // newest first
  const spots = (latest?.data.spots as PosterSpot[] | undefined) ?? [];

  async function find() {
    setLoading(true);
    const r = await fetch("/api/spots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bakeryId }),
    });
    const j = await r.json();
    setLoading(false);
    if (j.asset) onDone();
    else alert(j.error);
  }

  return (
    <section className="card mt-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl text-crust">Poster spots</h2>
          <p className="text-sm text-crust/55">
            Busy places 0.75–1 mile away where coffee drinkers pass: hardware and electronics stores, libraries, coworking
            spaces, bookstores, gyms, laundromats and universities.
          </p>
        </div>
        <button className="btn-primary whitespace-nowrap" onClick={find} disabled={loading}>
          {loading ? "Searching…" : spots.length ? "Refresh" : "Find spots →"}
        </button>
      </div>

      {spots.length > 0 && (
        <div className="mt-4 space-y-2">
          {spots.map((s) => (
            <a
              key={s.url}
              href={s.url}
              target="_blank"
              className="flex items-center justify-between gap-3 rounded-xl border border-crust/10 bg-white/60 p-3 transition hover:border-caramel"
            >
              <div className="min-w-0">
                <div className="font-semibold text-crust">{s.name}</div>
                <div className="truncate text-xs text-crust/55">
                  {s.kind} · {s.miles} mi · {s.address}
                </div>
              </div>
              <div className="whitespace-nowrap text-right text-xs text-crust/55">
                <div>★ {s.rating} · {s.reviewCount.toLocaleString()} reviews</div>
                {s.busiest && <div>busiest {s.busiest}</div>}
              </div>
            </a>
          ))}
          <p className="text-xs text-crust/45">
            Ranked by Google review volume within each kind of place, so older places rank higher. Ask each venue before posting.
          </p>
        </div>
      )}
    </section>
  );
}
