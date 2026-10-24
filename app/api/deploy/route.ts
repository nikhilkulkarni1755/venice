import { NextRequest, NextResponse } from "next/server";
import { getAsset, patchAssetData } from "@/lib/store";
import { deployToFreestyle } from "@/lib/freestyle";
import { logAgentRun } from "@/lib/omnara";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

export async function POST(req: NextRequest) {
  const { assetId, bakeryId } = await req.json();
  const asset = await getAsset(assetId);
  if (!asset || asset.kind !== "website") {
    return NextResponse.json({ error: "website asset not found" }, { status: 404 });
  }
  const html = (asset.data as any).html as string;
  const subdomain = `${bakeryId}-footfall`.replace(/[^a-z0-9-]/g, "").slice(0, 40);

  await logAgentRun(bakeryId, "deploy:start");
  const freestyleUrl = await deployToFreestyle(subdomain, html);

  // Fallback: serve the site from our own app (public once behind the tunnel).
  const base = process.env.NEXT_PUBLIC_BASE_URL || "";
  const url = freestyleUrl || `${base}/site/${bakeryId}`;
  const provider = freestyleUrl ? "Freestyle" : "FootfallAI hosted";

  await patchAssetData(assetId, { deployUrl: url, deployProvider: provider });
  await logAgentRun(bakeryId, `deploy:done (${provider}) ${url}`);

  return NextResponse.json({ url, provider });
}
