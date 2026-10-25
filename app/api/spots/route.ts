import { NextRequest, NextResponse } from "next/server";
import { getBakery, latestAssetOfKind, saveAsset } from "@/lib/store";
import { BAND_MILES, findPosterSpots } from "@/lib/spots";
import { logAgentRun } from "@/lib/omnara";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// A search costs scraper credits, so reuse one from the last day.
const FRESH_MS = 24 * 3600e3;

export async function POST(req: NextRequest) {
  const { bakeryId } = await req.json();
  const bakery = await getBakery(bakeryId);
  if (!bakery) return NextResponse.json({ error: "bakery not found" }, { status: 404 });

  const prev = await latestAssetOfKind(bakeryId, "spots");
  if (prev && Date.now() - Date.parse(prev.createdAt) < FRESH_MS) return NextResponse.json({ asset: prev });

  await logAgentRun(bakery.name, "spots:search");
  let spots;
  try {
    spots = await findPosterSpots(bakery);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
  if (!spots.length) {
    return NextResponse.json(
      { error: `No busy places found ${BAND_MILES[0]}-${BAND_MILES[1]} miles away (is APIFY_TOKEN set?).` },
      { status: 404 }
    );
  }
  const asset = {
    id: Math.random().toString(36).slice(2, 10),
    bakeryId,
    kind: "spots" as const,
    title: "Poster spots",
    createdAt: new Date().toISOString(),
    provider: "Google Maps via Apify",
    data: { spots, bandMiles: BAND_MILES },
  };
  await saveAsset(asset);
  await logAgentRun(bakery.name, `spots:done (${spots.length} spots)`);
  return NextResponse.json({ asset });
}
