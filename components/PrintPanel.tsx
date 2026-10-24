"use client";

import { useState } from "react";

type Shop = { name: string; address?: string; email?: string; phone?: string; website?: string; distance?: string };
type Job = { shops: Shop[]; pdfBase64: string; filename: string; draft: { subject: string; body: string }; note: string };

function downloadPdf(base64: string, filename: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function PrintPanel({ bakeryId }: { bakeryId: string }) {
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(false);

  async function prepare() {
    setLoading(true);
    const r = await fetch("/api/print", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bakeryId }),
    });
    const j = await r.json();
    setLoading(false);
    if (j.shops) setJob(j);
  }

  function sendOrder(shop: Shop) {
    if (!job) return;
    downloadPdf(job.pdfBase64, job.filename); // user attaches this to the email
    const to = shop.email || "";
    const url = `mailto:${to}?subject=${encodeURIComponent(job.draft.subject)}&body=${encodeURIComponent(
      job.draft.body + "\n\n(Attaching the print-ready PDF that just downloaded.)"
    )}`;
    window.location.href = url;
  }

  return (
    <section className="card mt-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl text-crust">Print &amp; distribute</h2>
          <p className="text-sm text-crust/55">Find the nearest FedEx Office and send a color print order for your poster.</p>
        </div>
        <button className="btn-primary" onClick={prepare} disabled={loading}>
          {loading ? "Locating store…" : job ? "Refresh" : "Find FedEx Office →"}
        </button>
      </div>

      {job && (
        <div className="mt-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button className="btn-ghost !py-1.5 !text-xs" onClick={() => downloadPdf(job.pdfBase64, job.filename)}>
              ⬇ Print-ready PDF
            </button>
            <span className="pill bg-butter/25 text-caramel">25 copies · 13×19 · full color</span>
          </div>

          <div className="space-y-2">
            {job.shops.map((s, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl border border-crust/10 bg-white/60 p-3">
                <div className="min-w-0">
                  <div className="font-semibold text-crust">{s.name}</div>
                  <div className="truncate text-xs text-crust/55">
                    {s.address || "address n/a"}
                    {s.email ? ` · ${s.email}` : ""}
                    {s.phone ? ` · ${s.phone}` : ""}
                  </div>
                </div>
                <button
                  className="btn-ghost !py-1.5 !text-xs whitespace-nowrap"
                  onClick={() => (s.email ? sendOrder(s) : s.website ? window.open(s.website, "_blank") : null)}
                  disabled={!s.email && !s.website}
                  title={s.email ? `Email the order to ${s.email}` : "No public email — order via their website"}
                >
                  {s.email ? "Send print order ✉️" : s.website ? "Order online ↗" : "No contact"}
                </button>
              </div>
            ))}
            {!job.shops.length && <div className="text-sm text-crust/50">No shops found — try a more specific address.</div>}
          </div>

          <p className="mt-3 text-xs text-crust/45">{job.note}</p>
        </div>
      )}
    </section>
  );
}
