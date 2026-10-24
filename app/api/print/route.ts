import { NextRequest, NextResponse } from "next/server";
import { getBakery, latestAssetOfKind, saveAsset } from "@/lib/store";
import { generatePoster } from "@/lib/generate";
import { findPrinters } from "@/lib/context";
import { posterPdfBase64, draftPrintEmail } from "@/lib/print";
import { logAgentRun } from "@/lib/omnara";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

export async function POST(req: NextRequest) {
  const { bakeryId } = await req.json();
  const bakery = await getBakery(bakeryId);
  if (!bakery) return NextResponse.json({ error: "bakery not found" }, { status: 404 });

  await logAgentRun(bakery.name, "print:find-shops");

  // Reuse the latest generated poster, or make one so there's always something to print.
  let poster = await latestAssetOfKind(bakeryId, "poster");
  if (!poster) {
    poster = await generatePoster(bakery);
    await saveAsset(poster);
  }
  const copy = (poster.data as any).copy;
  const preorderUrl = (poster.data as any).preorderUrl as string;

  const [shops, pdfBase64] = await Promise.all([
    findPrinters(bakery.address),
    posterPdfBase64(copy, preorderUrl, bakery),
  ]);
  const draft = draftPrintEmail(bakery, copy);

  await logAgentRun(bakery.name, `print:ready (${shops.length} shops found)`);

  return NextResponse.json({
    shops,
    pdfBase64,
    filename: `${bakeryId}-poster-print.pdf`,
    draft,
    note:
      "USPS retail locations don't publish emails or accept emailed print jobs — these are nearby print shops (chains + independents) that run color poster jobs.",
  });
}
