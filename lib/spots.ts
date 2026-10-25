import type { Bakery, PosterSpot } from "./types";
import { apifyLocate, apifySpots, meters } from "./apify";

// Where to put posters: busy places a bit beyond the bakery's own street, where people who'd want a
// coffee pass by. Candidates come from Google Maps; "busy" = Google review volume (lifetime, so it
// favors older places), shown next to each place's own busiest hour from popular times.
export const BAND_MILES = [0.75, 1] as const;
const MILE = 1609.34;
const KINDS = ["hardware store", "electronics store", "library", "coworking space", "bookstore", "gym", "laundromat", "university"];
const PER_KIND = 2;
const MAX_SPOTS = 8;

const hour = (h: number) => `${h % 12 || 12}${h >= 12 ? "pm" : "am"}`;

export async function findPosterSpots(b: Bakery): Promise<PosterSpot[]> {
  const center = b.location ?? (await apifyLocate(b.name, b.address));
  if (!center) return [];
  const seen = new Set<string>();
  const inBand = (await apifySpots(center, KINDS, (BAND_MILES[1] * MILE) / 1000))
    .map((p) => ({ p, miles: meters(center, p) / MILE }))
    .filter(({ p, miles }) => miles >= BAND_MILES[0] && miles <= BAND_MILES[1] && p.reviewCount >= 50)
    .filter(({ p }) => p.placeId && !seen.has(p.placeId) && seen.add(p.placeId));

  return KINDS.flatMap((kind) =>
    inBand.filter(({ p }) => p.searchString === kind).sort((x, y) => y.p.reviewCount - x.p.reviewCount).slice(0, PER_KIND)
  )
    .sort((x, y) => y.p.reviewCount - x.p.reviewCount)
    .slice(0, MAX_SPOTS)
    .map(({ p, miles }) => {
      const peak = p.popularTimes
        .flatMap((d) => d.hours.map((h) => ({ day: d.day, hour: h.hour, busyness: h.busyness })))
        .sort((x, y) => y.busyness - x.busyness)[0];
      return {
        name: p.name,
        kind: p.searchString,
        address: p.address,
        miles: Math.round(miles * 100) / 100,
        rating: p.rating,
        reviewCount: p.reviewCount,
        busiest: peak?.busyness ? `${peak.day} ${hour(peak.hour)}` : undefined,
        url: p.url,
      };
    });
}
