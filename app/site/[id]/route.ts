import { NextRequest } from "next/server";
import { latestAssetOfKind } from "@/lib/store";

export const dynamic = "force-dynamic";

// Serves the most recent generated website for a bakery as a real public page.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const asset = await latestAssetOfKind(id, "website");
  const html = (asset?.data as any)?.html;
  if (!html) {
    return new Response("No website generated yet.", { status: 404 });
  }
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
