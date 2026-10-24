import { NextRequest, NextResponse } from "next/server";
import { getBakery, latestAssetOfKind, saveAsset } from "@/lib/store";
import { generatePoster } from "@/lib/generate";
import { findFedExOffice } from "@/lib/context";
import { posterPdfBase64, draftPrintEmail } from "@/lib/print";
import { logAgentRun } from "@/lib/omnara";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

export async function POST(req: NextRequest) {
  const { bakeryId } = await req.json();
  const bakery = await getBakery(bakeryId);
  if (!bakery) return NextResponse.json({ error: "bakery not found" }, { status: 404 });

  await logAgentRun(bakery.name, "print:find-fedex-office");

  // Reuse the latest generated poster, or make one so there's always something to print.
  let poster = await latestAssetOfKind(bakeryId, "poster");
  if (!poster) {
    poster = await generatePoster(bakery);
    await saveAsset(poster);
  }
  const copy = (poster.data as any).copy;
  const preorderUrl = (poster.data as any).preorderUrl as string;

  const [shops, pdfBase64] = await Promise.all([
    findFedExOffice(bakery.address),
    posterPdfBase64(copy, preorderUrl, bakery),
  ]);
  const draft = draftPrintEmail(bakery, copy);

  await logAgentRun(bakery.name, `print:ready (${shops.length ? shops[0].email : "no store found"})`);

  return NextResponse.json({
    shops,
    pdfBase64,
    filename: `${bakeryId}-poster-print.pdf`,
    draft,
    note:
      "We send to the nearest FedEx Office store email (usaNNNN@fedex.com) — the one chain whose per-store email is reliably published on its location page and derivable from the office number. USPS retail locations don't publish emails or accept emailed print jobs.",
  });
}
