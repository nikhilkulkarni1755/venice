import { NextRequest, NextResponse } from "next/server";
import { getBakery, saveAsset } from "@/lib/store";
import { generatePoster, generateGBP, generateWebsite, generateTiktok } from "@/lib/generate";
import { logAgentRun } from "@/lib/omnara";
import type { GeneratedAsset } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

const GENERATORS = {
  poster: generatePoster,
  google_business: generateGBP,
  website: generateWebsite,
  tiktok: generateTiktok,
} as const;

export async function POST(req: NextRequest) {
  const { bakeryId, type } = await req.json();
  const gen = GENERATORS[type as keyof typeof GENERATORS];
  if (!gen) return NextResponse.json({ error: "unknown type" }, { status: 400 });
  const bakery = await getBakery(bakeryId);
  if (!bakery) return NextResponse.json({ error: "bakery not found" }, { status: 404 });

  await logAgentRun(bakery.name, `generate:${type}:start`);
  const asset: GeneratedAsset = await gen(bakery);
  await saveAsset(asset);
  await logAgentRun(bakery.name, `generate:${type}:done (${asset.provider})`);

  return NextResponse.json({ asset });
}
