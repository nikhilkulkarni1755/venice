import type { Bakery, DayTraffic, HourPoint, SalesPoint } from "./types";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "bakery";
}

// Deterministic pseudo-random from a string, so the same bakery name always
// yields the same profile (stable demos, no flicker on re-entry).
function seededRand(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function genProfile(name: string, address: string): Bakery {
  const rnd = seededRand(name + address);
  const morningPeak = 70 + Math.floor(rnd() * 20);
  const afternoonDip = 18 + Math.floor(rnd() * 25); // the lever
  const eveningBump = Math.floor(rnd() * 25);

  const popularTimes: DayTraffic[] = DAYS.map((d) => {
    const weekend = d === "Sat" || d === "Sun";
    const hours: HourPoint[] = [];
    for (let h = 0; h < 24; h++) {
      let b = 0;
      if (h >= 7 && h <= 19) {
        const morning = Math.max(0, 1 - Math.abs(h - 8.5) / 3) * (weekend ? morningPeak - 10 : morningPeak);
        const lunch = Math.max(0, 1 - Math.abs(h - 12.5) / 2) * 46;
        const afternoon = Math.max(0, 1 - Math.abs(h - 15.5) / 3) * afternoonDip;
        const evening = Math.max(0, 1 - Math.abs(h - 17.5) / 2) * eveningBump;
        b = Math.min(100, Math.round(morning + lunch + afternoon + evening));
      }
      hours.push({ hour: h, busyness: b });
    }
    return { day: d, hours };
  });

  const base = 1200 + Math.floor(rnd() * 1400);
  const sales: SalesPoint[] = [];
  const now = new Date("2026-10-23T00:00:00Z");
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(now.getUTCDate() - i);
    const dow = d.getUTCDay();
    const weekend = dow === 0 || dow === 6;
    const revenue = Math.round(base * (weekend ? 1.25 : 1) * (0.85 + rnd() * 0.3));
    sales.push({ date: d.toISOString().slice(0, 10), revenue, transactions: Math.round(revenue / 8) });
  }

  return {
    id: slugify(name),
    name,
    address,
    rating: Math.round((4.1 + rnd() * 0.7) * 10) / 10,
    reviewCount: 60 + Math.floor(rnd() * 800),
    priceLevel: 2,
    categories: ["Bakery", "Coffee", "Pastries"],
    source: "seed",
    popularTimes,
    sales,
    reviews: [
      { author: "Local Guide", rating: 5, text: "Fresh pastries, friendly staff, great morning spot.", date: "2026-10-16" },
      { author: "Visitor", rating: 3, text: "Quiet in the afternoon, limited selection later in the day.", date: "2026-10-04" },
    ],
  };
}

// Attempt a live Google Maps popular-times scrape via Firecrawl, else generate.
export async function ingestBakery(name: string, address: string): Promise<Bakery> {
  const key = process.env.FIRECRAWL_API_KEY;
  const profile = genProfile(name, address);

  if (key) {
    try {
      const q = encodeURIComponent(`${name} ${address}`);
      const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          url: `https://www.google.com/maps/search/${q}`,
          formats: ["json"],
          jsonOptions: {
            prompt:
              "Extract the bakery's rating (number), total review count (number), price level (1-4), and up to 4 recent review snippets with author, rating, and text. Return JSON.",
          },
          onlyMainContent: true,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const j = data?.data?.json ?? data?.json;
        if (j) {
          if (typeof j.rating === "number") profile.rating = j.rating;
          if (typeof j.reviewCount === "number") profile.reviewCount = j.reviewCount;
          if (typeof j.priceLevel === "number") profile.priceLevel = j.priceLevel;
          if (Array.isArray(j.reviews) && j.reviews.length) {
            profile.reviews = j.reviews.slice(0, 4).map((r: any) => ({
              author: r.author || "Reviewer",
              rating: Number(r.rating) || 4,
              text: String(r.text || ""),
              date: r.date || "2026-10-01",
            }));
          }
          profile.source = "live";
        }
      }
    } catch {
      // fall through to generated profile
    }
  }

  return profile;
}
