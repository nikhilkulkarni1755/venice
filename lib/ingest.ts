import type { Bakery } from "./types";
import { brandOf, mapsListing, pageMarkdown } from "./context";
import { apifyPlaces } from "./apify";
import { bestTime } from "./besttime";
import { llmJson } from "./llm";
import { counterPrices } from "./traffic";

// name + a short hash of the address, so two same-named bakeries never collide.
export function bakeryId(name: string, address: string): string {
  let h = 5381;
  for (const c of address.toLowerCase().replace(/[^a-z0-9]/g, "")) h = (h * 33) ^ c.charCodeAt(0);
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "bakery";
  return `${slug}-${(h >>> 0).toString(36).slice(0, 5)}`;
}

// Business site -> its online-ordering page (or the site itself when the menu is on it) -> menu items with prices.
const ORDER_LINK = /\]\((https?:\/\/[^)\s]*(?:gloriafood|toasttab|square\.site|chownow|clover\.com|order\.online)[^)\s]*)\)/i;
async function ingestMenu(site: string): Promise<{ menu: NonNullable<Bakery["menu"]>; orderUrl?: string }> {
  const home = await pageMarkdown(site);
  const orderUrl = home.match(ORDER_LINK)?.[1];
  const page = orderUrl ? await pageMarkdown(orderUrl) : home;
  if (!/\$\s?\d|\d\.\d{2}/.test(page)) return { menu: [], orderUrl };
  const { items } = await llmJson<{ items: [string, string, number][] }>(
    `Extract every menu item with a price from this page. Return minified JSON {"items":[[category,name,price],...]} with price as a USD number (the base price if several are listed). Skip customer orders.`,
    page.slice(0, 60000),
    { items: [] }
  );
  return {
    orderUrl,
    menu: items.filter((i) => typeof i[2] === "number").map(([category, name, price]) => ({ category, name, price })),
  };
}

async function ingestBrand(site?: string): Promise<Bakery["brand"]> {
  if (!site) return undefined;
  try {
    const b = await brandOf(new URL(site).hostname.replace(/^www\./, ""));
    return b.palette && { palette: b.palette, font: b.font };
  } catch {
    return undefined;
  }
}

// Live data only: Google place + popular times + dated reviews + peers (Apify), a BestTime
// cross-check, the Maps listing (Context.dev) when Apify is unavailable, and the menu + brand
// from the business's own site. Anything unavailable stays empty, never generated.
export async function ingestBakery(name: string, address: string): Promise<Bakery> {
  const [g, alt] = await Promise.all([apifyPlaces(name, address), bestTime(name, address)]);
  const place = g.self ?? (await mapsListing(name, address));
  if (!place) throw new Error("No live Google Maps listing found (check APIFY_TOKEN / CONTEXT_DEV_API_KEY and the name/address).");
  const [{ menu, orderUrl }, brand] = await Promise.all([
    place.website ? ingestMenu(place.website) : { menu: [] as NonNullable<Bakery["menu"]>, orderUrl: undefined },
    ingestBrand(place.website),
  ]);
  const times = g.self?.popularTimes ?? [];
  const prices = counterPrices(menu);

  return {
    id: bakeryId(name, address),
    name,
    address,
    rating: place.rating,
    reviewCount: place.reviewCount,
    categories: [place.category],
    website: place.website,
    location: g.self && { lat: g.self.lat, lng: g.self.lng },
    orderUrl,
    hours: g.self?.hours,
    attributes: g.self?.attributes,
    brand,
    popularTimes: times.length ? times : alt,
    popularTimesAlt: times.length ? alt : [],
    reviews: place.reviews,
    reviewsPerMonth: g.self?.reviewsPerMonth,
    peers: g.peers,
    menu,
    avgTicket: prices.length ? Math.round((prices.reduce((a, x) => a + x, 0) / prices.length) * 100) / 100 : undefined,
    reviewTags: g.self?.tags,
    updatedAt: new Date().toISOString(),
  };
}
