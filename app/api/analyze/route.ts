import { NextRequest, NextResponse } from "next/server";
import { getBakery, saveAnalysis } from "@/lib/store";
import { analyzeBakery } from "@/lib/analyze";
import { logAgentRun } from "@/lib/omnara";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { bakeryId } = await req.json();
  const bakery = await getBakery(bakeryId);
  if (!bakery) return NextResponse.json({ error: "bakery not found" }, { status: 404 });

  await logAgentRun(bakery.name, "analyze:start");
  const analysis = await analyzeBakery(bakery);
  await saveAnalysis(analysis);
  await logAgentRun(bakery.name, `analyze:done (${analysis.recommendations.length} recs, ${analysis.model})`);

  return NextResponse.json({ analysis });
}
