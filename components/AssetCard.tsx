"use client";

import { useState } from "react";
import type { GeneratedAsset } from "@/lib/types";

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function AssetCard({ asset, onDeployed }: { asset: GeneratedAsset; onDeployed: () => void }) {
  const d = asset.data as any;
  const [deploying, setDeploying] = useState(false);
  const [deployUrl, setDeployUrl] = useState<string | null>(d.deployUrl || null);

  async function deploy() {
    setDeploying(true);
    const r = await fetch("/api/deploy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId: asset.id, bakeryId: asset.bakeryId }),
    });
    const j = await r.json();
    setDeploying(false);
    if (j.url) {
      setDeployUrl(j.url);
      onDeployed();
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-crust/10 px-4 py-2.5">
        <span className="font-semibold text-crust">{asset.title}</span>
        <span className="pill bg-crust/10 text-crust/55">{asset.provider}</span>
      </div>
      <div className="p-4">
        {asset.kind === "poster" && (
          <div>
            <div
              className="mx-auto max-w-[260px] overflow-hidden rounded-lg shadow"
              dangerouslySetInnerHTML={{ __html: d.svg }}
            />
            <div className="mt-3 flex gap-2">
              <button className="btn-ghost !py-1.5 !text-xs" onClick={() => download(`${asset.id}-poster.svg`, d.svg, "image/svg+xml")}>
                ⬇ Download SVG
              </button>
              <a className="btn-ghost !py-1.5 !text-xs" href={d.preorderUrl} target="_blank">
                QR → pre-order ({d.preorderProvider?.split("(")[0]})
              </a>
            </div>
          </div>
        )}

        {asset.kind === "google_business" && (
          <div className="space-y-3 text-sm">
            <div>
              <div className="text-xs uppercase text-crust/45">Business description</div>
              <p className="text-crust/80">{d.description}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(d.categories || []).map((c: string) => (
                <span key={c} className="pill bg-sage/15 text-sage">{c}</span>
              ))}
              {(d.attributes || []).map((c: string) => (
                <span key={c} className="pill bg-butter/25 text-caramel">{c}</span>
              ))}
            </div>
            <div className="space-y-2">
              <div className="text-xs uppercase text-crust/45">Profile posts</div>
              {(d.posts || []).map((p: any, i: number) => (
                <div key={i} className="rounded-lg bg-crust/5 p-2.5">
                  <div className="font-semibold text-crust">{p.title}</div>
                  <div className="text-crust/70">{p.body}</div>
                </div>
              ))}
            </div>
            {(d.reviewReplies || []).length > 0 && (
              <div className="space-y-2">
                <div className="text-xs uppercase text-crust/45">Suggested review replies</div>
                {(d.reviewReplies || []).map((r: any, i: number) => (
                  <div key={i} className="rounded-lg bg-berry/5 p-2.5">
                    <div className="text-xs text-berry">↳ to {r.to}</div>
                    <div className="text-crust/70">{r.reply}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {asset.kind === "website" && (
          <div>
            {d.brandedFrom && (
              <div className="mb-2 pill bg-sage/15 text-sage">🎨 brand colors pulled live from {d.brandedFrom}</div>
            )}
            <iframe title={asset.title} srcDoc={d.html} className="h-80 w-full rounded-lg border border-crust/10 bg-white" />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {deployUrl ? (
                <a className="btn-primary !py-1.5 !text-xs" href={deployUrl} target="_blank">
                  🌐 Live: {deployUrl.replace(/^https?:\/\//, "")}
                </a>
              ) : (
                <button className="btn-primary !py-1.5 !text-xs" onClick={deploy} disabled={deploying}>
                  {deploying ? "Deploying…" : "🚀 Deploy to Freestyle"}
                </button>
              )}
              <button className="btn-ghost !py-1.5 !text-xs" onClick={() => download(`${asset.id}-site.html`, d.html, "text/html")}>
                ⬇ Download HTML
              </button>
            </div>
          </div>
        )}

        {asset.kind === "tiktok" && (
          <div className="space-y-3 text-sm">
            <div className="rounded-lg bg-crust/5 p-2.5">
              <div className="text-xs uppercase text-crust/45">Hook</div>
              <div className="font-semibold text-crust">{d.hook}</div>
            </div>
            <div className="space-y-1.5">
              {(d.script || []).map((s: any, i: number) => (
                <div key={i} className="flex gap-2">
                  <span className="pill bg-berry/15 text-berry whitespace-nowrap">{s.time}</span>
                  <div>
                    <div className="text-crust/80"><b>{s.shot}</b></div>
                    <div className="text-crust/60">“{s.vo}”</div>
                  </div>
                </div>
              ))}
            </div>
            {d.audioUrl ? (
              <audio controls src={d.audioUrl} className="w-full" />
            ) : (
              <div className="text-xs text-crust/45">{d.audioNote}</div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {(d.hashtags || []).map((h: string) => (
                <span key={h} className="pill bg-sage/15 text-sage">{h}</span>
              ))}
            </div>
            <div className="text-crust/70">{d.caption}</div>
          </div>
        )}
      </div>
    </div>
  );
}
