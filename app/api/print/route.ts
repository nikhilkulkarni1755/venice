import { NextRequest, NextResponse } from "next/server";
import { getBakery, saveAsset } from "@/lib/store";
import { generatePoster } from "@/lib/generate";
import { findFedExOffice } from "@/lib/context";
import { posterPdfBase64, draftPrintEmail } from "@/lib/print";
import { logAgentRun } from "@/lib/omnara";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

// One agent: design the poster from verified data, render the print-ready PDF, find the
// nearest print shop and draft the order.
export async function POST(req: NextRequest) {
  const { bakeryId } = await req.json();
  const bakery = await getBakery(bakeryId);
  if (!bakery) return NextResponse.json({ error: "bakery not found" }, { status: 404 });

  await logAgentRun(bakery.name, "poster:design");
  const poster = await generatePoster(bakery);
  await saveAsset(poster);
  const { copy, palette, images } = poster.data as any;

  await logAgentRun(bakery.name, "poster:print (find-fedex-office)");
  const [shops, pdfBase64] = await Promise.all([findFedExOffice(bakery.address), posterPdfBase64(copy, palette, images)]);
  const draft = draftPrintEmail(bakery, copy);

  await logAgentRun(bakery.name, `poster:ready (${shops.length ? shops[0].email : "no store found"})`);

  return NextResponse.json({
    poster,
    shops,
    pdfBase64,
    filename: `${bakeryId}-poster-print.pdf`,
    draft,
    note:
      "We send to the nearest FedEx Office store email (usaNNNN@fedex.com), derived from the office number on its location page. We have not verified that the derived address accepts print jobs.",
  });
}
