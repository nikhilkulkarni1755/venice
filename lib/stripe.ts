import Stripe from "stripe";
import type { Bakery } from "./types";

// Creates a real Stripe Payment Link (test mode) for a pre-order when
// STRIPE_SECRET_KEY is set; otherwise returns our own hosted pre-order page
// so the poster QR always resolves to something that works in the demo.
export async function createPreorderLink(
  b: Bakery,
  product: string,
  amountCents: number
): Promise<{ url: string; provider: string }> {
  const key = process.env.STRIPE_SECRET_KEY;
  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  if (!key) {
    return { url: `${base}/preorder/${b.id}`, provider: "FootfallAI pre-order (add Stripe key for live checkout)" };
  }
  try {
    const stripe = new Stripe(key);
    const price = await stripe.prices.create({
      currency: "usd",
      unit_amount: amountCents,
      product_data: { name: `${b.name} — ${product}` },
    });
    const link = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      after_completion: { type: "redirect", redirect: { url: `${base}/preorder/${b.id}?paid=1` } },
    });
    return { url: link.url, provider: "Stripe" };
  } catch {
    return { url: `${base}/preorder/${b.id}`, provider: "FootfallAI pre-order (Stripe error)" };
  }
}
