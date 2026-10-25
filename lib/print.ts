import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Bakery } from "./types";

type Copy = { headline: string; name: string; address: string; items: string[] };

export type Palette = { bg: string; ink: string; accent: string; accent2: string };
export const DEFAULT_PALETTE: Palette = { bg: "#2a1a12", ink: "#f7efe3", accent: "#f4c04e", accent2: "#b4455f" };

function hex(h: string) {
  const n = parseInt(h.replace("#", ""), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

export const isDark = (h: string) => {
  const n = parseInt(h.slice(1), 16);
  return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 < 140;
};

// Render the poster as a print-ready, full-bleed color PDF (600x800pt). Same layout as the SVG.
export async function posterPdfBase64(copy: Copy, p: Palette = DEFAULT_PALETTE, images: (string | null)[] = []): Promise<string> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([600, 800]);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);

  page.drawRectangle({ x: 0, y: 0, width: 600, height: 800, color: hex(p.bg) });

  // Standard PDF fonts only encode WinAnsi, so strip arrows/emoji/smart punctuation.
  const clean = (s: string) =>
    String(s)
      .replace(/[–—]/g, "-")
      .replace(/[’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
  const center = (raw: string, size: number, y: number, color: string, maxW = 540, cx = 300) => {
    const text = clean(raw);
    let s = size;
    while (font.widthOfTextAtSize(text, s) > maxW && s > 8) s--;
    page.drawText(text, { x: cx - font.widthOfTextAtSize(text, s) / 2, y, size: s, font, color: hex(color) });
  };

  center(copy.headline, 84, 590, p.ink);
  center(copy.name, 40, 505, p.accent);
  center(copy.address, 26, 455, p.ink);
  page.drawLine({ start: { x: 60, y: 405 }, end: { x: 540, y: 405 }, thickness: 2, color: hex(p.accent) });
  const w = 230;
  const fitSize = (text: string) => {
    let s = 38;
    while (font.widthOfTextAtSize(clean(text), s) > w - 30 && s > 8) s--;
    return s;
  };
  const itemSize = Math.min(...copy.items.map(fitSize)); // one size for all items
  const jpgs = await Promise.all(copy.items.map((_, i) => (images[i] ? doc.embedJpg(Buffer.from(images[i]!.split(",")[1], "base64")) : null)));
  copy.items.forEach((item, i) => {
    const x = copy.items.length === 1 ? 185 : 60 + i * 250;
    const ink = isDark(p.accent2) ? "#ffffff" : "#111111";
    if (!jpgs[i]) {
      page.drawRectangle({ x, y: 80, width: w, height: 250, color: hex(p.accent2) });
      return center(item, itemSize, 193, ink, w - 30, x + w / 2);
    }
    // Full square dish image (uncropped, so its own corner label stays visible) above the name strip.
    page.drawImage(jpgs[i]!, { x, y: 44 + 56, width: w, height: w });
    page.drawRectangle({ x, y: 44, width: w, height: 56, color: hex(p.accent2) });
    center(item, 28, 63, ink, w - 24, x + w / 2);
  });

  return Buffer.from(await doc.save()).toString("base64");
}

// Draft the print-order email a print shop would receive.
export function draftPrintEmail(bakery: Bakery, copy: Copy) {
  const subject = `Color print order — ${bakery.name} promo poster (1 copy)`;
  const body = [
    `Hi,`,
    ``,
    `I'd like to place a color printing order:`,
    ``,
    `• Item: Promotional poster ("${copy.headline}")`,
    `• Quantity: 1 copy`,
    `• Size: standard 8.5" x 11" (US Letter), full color, scaled to fit the page`,
    `• File: print-ready PDF attached`,
    `• Turnaround: standard`,
    `• Pickup for: ${bakery.name}, ${bakery.address}`,
    ``,
    `Please confirm pricing and when they'll be ready. Thank you!`,
  ].join("\n");
  return { subject, body };
}
