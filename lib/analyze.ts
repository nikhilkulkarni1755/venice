import type { Bakery, Analysis, Recommendation } from "./types";
import { researchTactics } from "./context";
import { llmJson } from "./llm";
import { counterPrices, deadWindow, estimatedRevenue, peerRank, roomToGrow, weeklyOpenHours } from "./traffic";

// Every fact (and number) the analysis may state. The model writes the narrative; it never
// computes: projections come from traffic.ts and are included here.
export function analysisFacts(b: Bakery) {
  const dead = deadWindow(b);
  const rank = peerRank(b);
  const est = estimatedRevenue(b);
  const prices = counterPrices(b.menu).sort((x, y) => x - y);
  const nearby = (b.peers ?? []).map((p) => ({
    name: p.name,
    metersAway: p.distanceM,
    rating: p.rating,
    reviewsPerMonth: p.reviewsPerMonth,
  }));
  const busiest = [...nearby].filter((p) => p.reviewsPerMonth).sort((x, y) => y.reviewsPerMonth! - x.reviewsPerMonth!)[0];
  return {
    name: b.name,
    address: b.address,
    rating: b.rating,
    reviewCount: b.reviewCount,
    reviewsPerMonth: b.reviewsPerMonth,
    rank: rank && `${rank.rank} of ${rank.of} nearby by ${rank.basis}`,
    nearby,
    busiestNeighbor: busiest && b.reviewsPerMonth ? { ...busiest, timesOurReviewRate: Math.round((busiest.reviewsPerMonth! / b.reviewsPerMonth) * 10) / 10 } : null,
    quietestWindow: dead && {
      label: dead.label,
      busynessOutOf100: dead.avg,
      secondSource: dead.altAgrees === undefined ? "unavailable" : dead.altAgrees ? "agrees" : "disagrees",
    },
    averageCounterPrice: b.avgTicket,
    counterPriceRange: prices.length ? [prices[0], prices[prices.length - 1]] : null,
    estimatedVisitsPerDay: est && { low: est.low.visits, base: est.base.visits, high: est.high.visits },
    roomToGrowIfQuietestWindowReachedItsDaysAverage: roomToGrow(b),
    openHoursPerWeek: Math.round(weeklyOpenHours(b.hours)),
    amenities: b.attributes ?? [],
    salesData: "unavailable",
    recentReviews: b.reviews.slice(0, 8).map((r) => ({ stars: r.rating, text: r.text.slice(0, 200) })),
  };
}
type Facts = ReturnType<typeof analysisFacts>;

function sentimentFromReviews(bakery: Bakery) {
  const positive: string[] = [];
  const negative: string[] = [];
  for (const r of bakery.reviews) {
    if (!r.text) continue;
    (r.rating >= 4 ? positive : negative).push(r.text);
  }
  return { positive: positive.slice(0, 4), negative: negative.slice(0, 4) };
}

const EFFORT: Record<string, Recommendation["effort"]> = { poster: "low", google_business: "low", website: "medium", tiktok: "medium" };

// Fallback narrative built only from the facts (no model).
function baseline(f: Facts) {
  const nb = f.busiestNeighbor;
  const headline = f.rank ? `${f.name} ranks ${f.rank}` : `${f.name}: what the data shows`;
  const summary = [
    nb && f.reviewsPerMonth
      ? `${f.name} gets ${f.reviewsPerMonth} new Google reviews a month; ${nb.name}, ${nb.metersAway} m away, gets ${nb.reviewsPerMonth}.`
      : `${f.name} is rated ${f.rating} from ${f.reviewCount} reviews.`,
    f.quietestWindow
      ? `Its quietest open stretch is ${f.quietestWindow.label} (${f.quietestWindow.busynessOutOf100}/100; second source ${f.quietestWindow.secondSource}).`
      : "Popular-times data is unavailable.",
    f.roomToGrowIfQuietestWindowReachedItsDaysAverage
      ? `At the estimated visit volume, lifting that window to its day's average is worth about ${f.roomToGrowIfQuietestWindowReachedItsDaysAverage.extraVisitsPerWeek.base} visits a week.`
      : "",
  ].join(" ").trim();
  const recommendations = [
    {
      id: "rec-poster",
      type: "poster",
      title: "Put a \"nearby\" poster in front of passersby",
      rationale: nb
        ? `${nb.name}, ${nb.metersAway} m away, collects ${nb.reviewsPerMonth} reviews a month against ${f.reviewsPerMonth}; a street-level poster reaches the people already walking by.`
        : "A street-level poster reaches the people already walking by.",
    },
    {
      id: "rec-gbp",
      type: "google_business",
      title: "Refresh the Google Business profile from verified facts",
      rationale: `The profile is where searchers see the ${f.rating} rating, hours and amenities; keep it accurate and answer the low-rated reviews.`,
    },
  ];
  return { headline, summary, recommendations };
}

const SYSTEM = `You are Venice's analyst for a local bakery. Use ONLY the facts JSON. Return ONLY JSON:
{"headline": string, "summary": string (2-3 sentences), "recommendations": [{"id": string, "type": "poster"|"google_business"|"website"|"tiktok", "title": string, "rationale": string}]} with 2-4 recommendations.
Rules: every number you write must appear verbatim in the facts; never compute new numbers, percentages, revenue, lifts or conversion rates; never state anything about the business, its neighborhood, tourists, competitors or customers that is not in the facts. Web tactics are ideas only, never statistics. Say what is unknown (for example salesData) instead of guessing. Lead with the biggest evidenced gap (nearby peers, quiet window) and say if the second source disagrees about the quiet window.`;

// Numbers in a text, with thousands separators ("1,719") joined but list commas ("[3,15]") not.
const nums = (t: string) => (t.match(/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g) ?? []).map((n) => n.replace(/,/g, ""));

export async function analyzeBakery(bakery: Bakery): Promise<Analysis> {
  const facts = analysisFacts(bakery);
  const research = await researchTactics(bakery.name);
  const allowed = new Set(nums(JSON.stringify(facts, null, 1)));
  type Out = { headline: string; summary: string; recommendations: (Recommendation & { rationale: string })[] };
  const user = JSON.stringify({ facts, webTacticIdeas: research.map((r) => `${r.title}: ${r.description}`) });

  // Reject any output that states a number not in the facts; retry once, then fall back.
  let out: Out | null = await llmJson<Out | null>(SYSTEM, user, null);
  const unsupported = (o: Out | null) => (o ? nums(JSON.stringify(o)).filter((n) => !allowed.has(n)) : ["no output"]);
  let bad = unsupported(out);
  if (bad.length) {
    out = await llmJson<Out | null>(SYSTEM, `${user}\n\nYour previous answer used numbers that are not in the facts: ${bad.join(", ")}. Rewrite without them.`, null);
    bad = unsupported(out);
  }
  const ok = !!out && !bad.length && Array.isArray(out.recommendations) && out.recommendations.length > 0;
  const text = ok ? out! : baseline(facts);

  return {
    bakeryId: bakery.id,
    headline: text.headline,
    summary: text.summary,
    sentiment: sentimentFromReviews(bakery),
    recommendations: (text.recommendations as Recommendation[]).map((r) => ({
      ...r,
      effort: EFFORT[r.type] ?? "medium",
      buildable: r.type in EFFORT,
    })),
    sources: research.map((r) => ({ url: r.url, title: r.title })),
    generatedAt: new Date().toISOString(),
    model: ok ? process.env.ANTHROPIC_MODEL || "claude-opus-4-8" : "Venice analytics (facts only)",
  };
}
