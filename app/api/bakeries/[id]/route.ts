import { NextRequest, NextResponse } from "next/server";
import { getBakery, getAnalysis, listAssets } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bakery = await getBakery(id);
  if (!bakery) return NextResponse.json({ error: "not found" }, { status: 404 });
  const [analysis, assets] = await Promise.all([getAnalysis(id), listAssets(id)]);
  return NextResponse.json({ bakery, analysis, assets });
}
