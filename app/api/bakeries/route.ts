import { NextRequest, NextResponse } from "next/server";
import { getBakery, listBakeries, saveBakery, storageMode } from "@/lib/store";
import { bakeryId, ingestBakery } from "@/lib/ingest";
import type { Bakery } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// An ingest costs real scraper credits and ~2 minutes: reuse a recent one, and let
// simultaneous requests for the same bakery share a single run.
const FRESH_MS = 6 * 3600e3;
const inflight = new Map<string, Promise<Bakery>>();

export async function GET() {
  const bakeries = await listBakeries();
  return NextResponse.json({ bakeries, storageMode });
}

export async function POST(req: NextRequest) {
  const { name, address } = await req.json();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const id = bakeryId(name, address || "");

  const cached = await getBakery(id);
  if (cached && Date.now() - Date.parse(cached.updatedAt ?? "") < FRESH_MS) {
    return NextResponse.json({ bakery: cached });
  }
  let job = inflight.get(id);
  if (!job) {
    job = ingestBakery(name, address || "")
      .then(async (b) => (await saveBakery(b), b))
      .finally(() => inflight.delete(id));
    inflight.set(id, job);
  }
  try {
    return NextResponse.json({ bakery: await job });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
