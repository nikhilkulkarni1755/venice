import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Bakery } from "./types";

type Copy = { headline: string; subhead: string; offer: string; cta: string; footer: string };

function hex(h: string) {
  const n = parseInt(h.replace("#", ""), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

// Render a print-ready, full-bleed color PDF of the poster (US Letter-ish, 600x800pt).
export async function posterPdfBase64(copy: Copy, preorderUrl: string, bakery: Bakery): Promise<string> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([600, 800]);
  const serif = await doc.embedFont(StandardFonts.TimesRomanBold);
  const sans = await doc.embedFont(StandardFonts.HelveticaBold);

  const dough = hex("#f7efe3");
  const gold = hex("#f4c04e");
  const crust = hex("#2a1a12");
  const berry = hex("#b4455f");

  page.drawRectangle({ x: 0, y: 0, width: 600, height: 800, color: crust });

  // Standard PDF fonts only encode WinAnsi — strip arrows/emoji/smart punctuation.
  const clean = (s: string) =>
    String(s)
      .replace(/→/g, "->")
      .replace(/[–—]/g, "-")
      .replace(/[’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
  const center = (font: any, raw: string, size: number, y: number, color = dough) => {
    const text = clean(raw);
    const w = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: (600 - w) / 2, y, size, font, color });
  };

  center(serif, bakery.name.toUpperCase(), 22, 720, gold);
  center(serif, copy.headline, 64, 560, dough);
  center(sans, copy.subhead, 22, 500, gold);

  page.drawRectangle({ x: 80, y: 360, width: 440, height: 70, color: berry });
  center(sans, copy.offer, 20, 388, dough);

  // QR (color PNG fetched from the QR service) linking to the pre-order page.
  try {
    const qrRes = await fetch(
      `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=0&data=${encodeURIComponent(preorderUrl)}`
    );
    const qrPng = await doc.embedPng(new Uint8Array(await qrRes.arrayBuffer()));
    page.drawRectangle({ x: 180, y: 100, width: 240, height: 240, color: dough });
    page.drawImage(qrPng, { x: 190, y: 110, width: 220, height: 220 });
  } catch {
    /* QR optional */
  }

  center(sans, `${copy.cta} →`, 18, 60, dough);
  const bytes = await doc.save();
  return Buffer.from(bytes).toString("base64");
}

// Draft the print-order email a print shop would receive.
export function draftPrintEmail(bakery: Bakery, copy: Copy) {
  const subject = `Color print order — ${bakery.name} promo poster (25 copies)`;
  const body = [
    `Hi,`,
    ``,
    `I'd like to place a color printing order:`,
    ``,
    `• Item: Promotional poster ("${copy.headline}")`,
    `• Quantity: 25`,
    `• Size: 13" x 19" (or A3), full color`,
    `• Stock: 100lb gloss cover`,
    `• File: print-ready PDF attached`,
    `• Turnaround: standard`,
    `• Pickup for: ${bakery.name}, ${bakery.address}`,
    ``,
    `Please confirm pricing and when they'll be ready. Thank you!`,
  ].join("\n");
  return { subject, body };
}
