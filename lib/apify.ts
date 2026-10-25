import type { DayTraffic, Peer, Review } from "./types";
import { UNIT } from "./context";

// Apify's Google Maps scraper (compass/crawler-google-places): one run returns a place's
// popular times, hours, amenities and dated reviews. Server-only, no-ops without APIFY_TOKEN.

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const ACTOR = "https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items";

async function run(input: Record<string, unknown>): Promise<any[]> {
  const res = await fetch(`${ACTOR}?token=${process.env.APIFY_TOKEN}&timeout=240`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ language: "en", maxReviews: 60, reviewsSort: "newest", ...input }),
  });
  const items = await res.json();
  if (!Array.isArray(items)) throw new Error(`Apify: ${items?.error?.message ?? "run failed"}`);
  return items;
}

// Reviews per month over the span the newest-first reviews cover (robust to busy places
// where 60 reviews arrive in weeks and quiet ones where they take a year).
function perMonth(reviews: Review[]): number | undefined {
  const dates = reviews.map((r) => Date.parse(r.date)).filter((d) => !isNaN(d));
  const days = (Date.now() - Math.min(...dates)) / 864e5;
  return dates.length >= 5 && days >= 1 ? Math.round(((dates.length * 30.4) / days) * 10) / 10 : undefined;
}

function toPlace(x: any) {
  const hist = x.popularTimesHistogram || {};
  const reviews: Review[] = (x.reviews || []).map((r: any) => ({
    author: r.name || "Reviewer",
    rating: r.stars,
    text: r.text || "",
    date: r.publishedAtDate,
  }));
  const popularTimes: DayTraffic[] = DAYS.flatMap((day) =>
    hist[day.slice(0, 2)]?.length
      ? [{ day, hours: hist[day.slice(0, 2)].map((h: any) => ({ hour: h.hour, busyness: h.occupancyPercent })) }]
      : []
  );
  return {
    placeId: x.placeId as string,
    name: x.title as string,
    rating: x.totalScore as number,
    reviewCount: x.reviewsCount as number,
    address: x.address as string,
    searchString: x.searchString as string,
    url: x.url as string,
    category: (x.categoryName as string) || "Bakery",
    kinds: [x.categoryName, ...(x.categories || [])].join(" ") as string,
    website: x.website as string | undefined,
    lat: x.location?.lat as number,
    lng: x.location?.lng as number,
    hours: (x.openingHours || []).map((h: any) => `${h.day} ${String(h.hours).replace(/ /g, " ")}`) as string[],
    attributes: Object.values(x.additionalInfo || {})
      .flat()
      .flatMap((o: any) => Object.entries(o).filter(([, v]) => v).map(([k]) => k)) as string[],
    popularTimes,
    reviews,
    tags: (x.reviewsTags || []).map((t: any) => ({ title: t.title as string, count: t.count as number })),
    reviewsPerMonth: perMonth(reviews),
  };
}
export type ApifyPlace = ReturnType<typeof toPlace>;

export function meters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return Math.round(12742000 * Math.asin(Math.sqrt(h)));
}

// Comparable = sells baked goods, coffee or desserts (searches like "cafe" also return pharmacies etc.).
const FOOD = /bake|patisserie|pastr|cafe|café|coffee|dessert|donut|bagel|tea|cake|chocolate/i;

// The business itself plus its 3 nearest comparable places (bakeries/cafes with >=100 reviews
// within 600 m, excluding its own building listing), found by a circle search around its coordinates.
export async function apifyPlaces(name: string, address: string): Promise<{ self?: ApifyPlace; peers: Peer[] }> {
  if (!process.env.APIFY_TOKEN) return { peers: [] };
  try {
    const mine = await run({ searchStringsArray: [`${name} ${address.replace(UNIT, "")}`], maxCrawledPlacesPerSearch: 1 });
    const self = mine[0] ? toPlace(mine[0]) : undefined;
    const tokens = name.toLowerCase().split(/\s+/).filter((t) => t.length > 3);
    if (!self || !tokens.some((t) => self.name.toLowerCase().includes(t))) return { peers: [] };
    const nearby = await run({
      searchStringsArray: ["bakery", "cafe"],
      customGeolocation: { type: "Point", coordinates: [self.lng, self.lat], radiusKm: 0.6 },
      maxCrawledPlacesPerSearch: 8,
    });
    const seen = new Set([self.placeId]);
    const peers = nearby
      .map(toPlace)
      .filter((p) => p.placeId && !seen.has(p.placeId) && seen.add(p.placeId) && !p.name.toLowerCase().includes(tokens[0]))
      .filter((p) => p.reviewCount >= 100 && FOOD.test(p.kinds))
      .map((p) => ({ name: p.name, rating: p.rating, reviewCount: p.reviewCount, reviewsPerMonth: p.reviewsPerMonth, distanceM: meters(self, p) }))
      .sort((a, b) => a.distanceM - b.distanceM)
      .slice(0, 3);
    return { self, peers };
  } catch (e) {
    console.warn((e as Error).message); // e.g. out of Apify usage: ingest then falls back to the Maps listing
    return { peers: [] };
  }
}

// Where the business is, for records ingested before locations were stored.
export async function apifyLocate(name: string, address: string): Promise<{ lat: number; lng: number } | null> {
  if (!process.env.APIFY_TOKEN) return null;
  const [x] = await run({ searchStringsArray: [`${name} ${address.replace(UNIT, "")}`], maxCrawledPlacesPerSearch: 1, maxReviews: 0 });
  return x?.location ? { lat: x.location.lat, lng: x.location.lng } : null;
}

// Places for each search term within radiusKm of a point (no reviews, so it stays cheap).
export async function apifySpots(center: { lat: number; lng: number }, queries: string[], radiusKm: number): Promise<ApifyPlace[]> {
  if (!process.env.APIFY_TOKEN) return [];
  const items = await run({
    searchStringsArray: queries,
    customGeolocation: { type: "Point", coordinates: [center.lng, center.lat], radiusKm },
    maxCrawledPlacesPerSearch: 10,
    maxReviews: 0,
  });
  return items.map(toPlace);
}
