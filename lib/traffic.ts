import type { Bakery } from "./types";

// Pure foot-traffic math shared by the server and the dashboard (no server imports).

const hr = (h: number) => `${h % 12 || 12}${h >= 12 ? "pm" : "am"}`;
const sum = (xs: number[]) => xs.reduce((a, x) => a + x, 0);
const mean = (xs: number[]) => sum(xs) / xs.length;

// Counter menu = pastries, desserts and drinks (no whole cakes, entrees or retail).
// Pre-order rows repeat in-store items, so dedupe by name.
const COUNTER = /bread|viennois|pastr|dessert|drink|beverage|coffee|\btea\b/i;
export function counterItems(menu: NonNullable<Bakery["menu"]> = []) {
  const items = new Map<string, { name: string; category: string; price: number }>();
  for (const m of menu) {
    const name = m.name.replace(/\s*\[pre-?order\]/i, "");
    if (COUNTER.test(m.category)) items.set(name.toLowerCase(), { name, category: m.category, price: m.price });
  }
  return [...items.values()];
}
export const counterPrices = (menu?: Bakery["menu"]) => counterItems(menu).map((i) => i.price);

// This bakery + its peers, each with the volume signal we rank on.
export function cohort(b: Bakery) {
  return [{ name: b.name, rating: b.rating, reviewCount: b.reviewCount, reviewsPerMonth: b.reviewsPerMonth }, ...(b.peers ?? [])];
}

// Relative foot traffic: z-scored log review volume (85%) + rating (15%) within the cohort.
// Volume is reviews/month when every place has it, else lifetime reviews (low confidence).
// Weights are placeholders until validated against popular-times data.
export function peerRank(b: Bakery) {
  const c = cohort(b);
  if (c.length < 3) return null;
  const velocity = c.every((p) => p.reviewsPerMonth != null);
  const z = (xs: number[]) => {
    const m = mean(xs);
    const sd = Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
    return xs.map((x) => (sd ? (x - m) / sd : 0));
  };
  const zv = z(c.map((p) => Math.log1p(velocity ? p.reviewsPerMonth! : p.reviewCount)));
  const zs = z(c.map((p) => p.rating));
  const score = c.map((_, i) => 0.85 * zv[i] + 0.15 * zs[i]);
  return {
    rank: score.filter((s) => s > score[0]).length + 1,
    of: c.length,
    basis: velocity ? "reviews/month" : "lifetime reviews (low confidence)",
  };
}

// Share of visits that become a Google review. NOT sourced: an explicit assumption that sets
// the scale of the estimate (halve the rate and visits double). A higher rate means fewer visits.
export const REVIEW_RATE = { base: 0.01, lowRevenue: 0.02, highRevenue: 0.005 };

// Estimated daily visits = reviews/day / review rate; revenue = visits x average counter price.
export function estimatedRevenue(b: Bakery) {
  if (!b.reviewsPerMonth || !b.avgTicket) return null;
  const perDay = b.reviewsPerMonth / 30.4;
  const at = (rate: number) => ({ visits: Math.round(perDay / rate), revenue: Math.round((perDay / rate) * b.avgTicket!) });
  return { base: at(REVIEW_RATE.base), low: at(REVIEW_RATE.lowRevenue), high: at(REVIEW_RATE.highRevenue) };
}

// Emptiest 3 open hours (10am-6pm start window) on any day, cross-checked against the second
// provider: it "agrees" when that provider also sees the same window at least 10% below its own average.
export function deadWindow(b: Bakery) {
  const open = (d: { hours: { hour: number; busyness: number }[] }) =>
    new Map(d.hours.filter((h) => h.busyness > 0).map((h) => [h.hour, h.busyness]));
  let best: { day: string; start: number; avg: number } | null = null;
  for (const d of b.popularTimes) {
    const m = open(d);
    for (let s = 10; s <= 15; s++) {
      if (![s, s + 1, s + 2].every((h) => m.has(h))) continue;
      const avg = mean([s, s + 1, s + 2].map((h) => m.get(h)!));
      if (!best || avg < best.avg) best = { day: d.day, start: s, avg: Math.round(avg) };
    }
  }
  if (!best) return null;
  const alt = b.popularTimesAlt?.find((d) => d.day === best!.day);
  const altAll = (b.popularTimesAlt ?? []).flatMap((d) => d.hours.filter((h) => h.busyness > 0).map((h) => h.busyness));
  const altWin = alt ? [0, 1, 2].map((i) => alt.hours.find((h) => h.hour === best!.start + i)?.busyness ?? 0) : [];
  return {
    ...best,
    label: `${best.day} ${hr(best.start)}–${hr(best.start + 3)}`,
    altAgrees: altAll.length && altWin.length ? mean(altWin) < 0.9 * mean(altAll) : undefined,
  };
}

// "Monday 8 AM to 6 PM" lines -> open hours per week.
export function weeklyOpenHours(hours: string[] = []): number {
  const t = (h: string, m: string | undefined, ap: string) => (Number(h) % 12) + (ap.toUpperCase() === "PM" ? 12 : 0) + Number(m || 0) / 60;
  return sum(
    hours.map((l) => {
      const m = l.match(/(\d+)(?::(\d+))?\s*(AM|PM) to (\d+)(?::(\d+))?\s*(AM|PM)/i);
      return m ? t(m[4], m[5], m[6]) - t(m[1], m[2], m[3]) : 0;
    })
  );
}

// Extra visits if the dead window rose to its day's average open-hour busyness, at this bakery's
// estimated visit volume (same review-rate assumption as estimatedRevenue). Weekly visits are
// spread over all popular-times hours in proportion to busyness.
export function roomToGrow(b: Bakery) {
  const dw = deadWindow(b);
  const est = estimatedRevenue(b);
  const day = b.popularTimes.find((d) => d.day === dw?.day);
  if (!dw || !est || !day) return null;
  const openHours = day.hours.filter((h) => h.busyness > 0);
  const dayAvg = mean(openHours.map((h) => h.busyness));
  const points = sum([0, 1, 2].map((i) => Math.max(0, dayAvg - (day.hours.find((h) => h.hour === dw.start + i)?.busyness ?? 0))));
  const total = sum(b.popularTimes.flatMap((d) => d.hours.map((h) => h.busyness)));
  const weekly = (visitsPerDay: number) => Math.round(((visitsPerDay * b.popularTimes.length) / total) * points);
  const monthly = (visitsPerWeek: number) => Math.round(visitsPerWeek * 4.33 * b.avgTicket!);
  const v = { low: weekly(est.low.visits), base: weekly(est.base.visits), high: weekly(est.high.visits) };
  return {
    dayAverage: Math.round(dayAvg),
    extraVisitsPerWeek: v,
    extraRevenuePerMonth: { low: monthly(v.low), base: monthly(v.base), high: monthly(v.high) },
  };
}

// The 1-2 dishes reviewers mention most, restricted to things on the menu (one per dish noun,
// so "croissants" and "chocolate croissant" don't both appear).
export function popularItems(b: Bakery, n = 2): string[] {
  const noun = (s: string) => s.toLowerCase().trim().split(/\s+/).pop()!.replace(/s$/, "");
  const onMenu = new Set((b.menu ?? []).flatMap((m) => m.name.toLowerCase().split(/[^a-z]+/).map(noun)));
  const seen = new Set<string>();
  const items: string[] = [];
  for (const t of [...(b.reviewTags ?? [])].sort((x, y) => y.count - x.count)) {
    const k = noun(t.title);
    if (!onMenu.has(k) || seen.has(k)) continue;
    seen.add(k);
    items.push(t.title.replace(/\b\w/g, (c) => c.toUpperCase()));
    if (items.length === n) break;
  }
  return items;
}
