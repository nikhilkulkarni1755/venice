import { NextRequest, NextResponse } from "next/server";
import { listBakeries, saveBakery, storageMode } from "@/lib/store";
import { ingestBakery } from "@/lib/ingest";

export const dynamic = "force-dynamic";

export async function GET() {
  const bakeries = await listBakeries();
  return NextResponse.json({ bakeries, storageMode });
}

export async function POST(req: NextRequest) {
  const { name, address } = await req.json();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const bakery = await ingestBakery(name, address || "");
  await saveBakery(bakery);
  return NextResponse.json({ bakery });
}
