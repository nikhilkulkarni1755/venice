"use client";

import { useState } from "react";

type Shop = { name: string; address?: string; email?: string; phone?: string; website?: string; distance?: string };
type Job = { poster: { data: { svg: string; images?: (string | null)[] } }; shops: Shop[]; pdfBase64: string; filename: string; draft: { subject: string; body: string }; note: string };

function downloadPdf(base64: string, filename: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function PrintPanel({ bakeryId, onDesigned }: { bakeryId: string; onDesigned: () => void }) {
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
    if (j.shops) {
      setJob(j);
      onDesigned();
    }
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
          <h2 className="font-display text-2xl text-crust">Design &amp; print poster</h2>
          <p className="text-sm text-crust/55">
            Designs a poster from your verified data and website colors, then finds the nearest FedEx Office for a color print order.
          </p>
        </div>
        <button id="print-run" className="btn-primary" onClick={prepare} disabled={loading}>
          {loading ? "Designing…" : job ? "Redesign" : "Design & print →"}
        </button>
      </div>

      {job && (
        <div className="mt-4">
          <div
            className="mx-auto mb-4 max-w-[260px] overflow-hidden rounded-lg shadow [&>svg]:h-auto [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: job.poster.data.svg }}
          />
          {job.poster.data.images?.some(Boolean) && (
            <p className="mb-3 text-center text-xs text-crust/50">
              Dish images are AI-generated illustrations, not photos of the bakery&apos;s own products.
            </p>
          )}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button className="btn-ghost !py-1.5 !text-xs" onClick={() => downloadPdf(job.pdfBase64, job.filename)}>
              ⬇ Print-ready PDF
            </button>
            <span className="pill bg-butter/25 text-caramel">1 copy · 8.5×11 · full color</span>
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
