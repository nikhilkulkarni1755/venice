import type { Bakery } from "@/lib/types";
import { counterPrices, deadWindow, estimatedRevenue, peerRank, weeklyOpenHours } from "@/lib/traffic";

// Client-safe KPI computation (does NOT import server modules). Missing data reads "Unavailable".
const NA = "Unavailable";
const sum = (xs: number[]) => xs.reduce((a, x) => a + x, 0);
const ord = (n: number) => `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0]}`;
const usd = (n: number) => `$${n.toLocaleString()}`;

export function computeKpis(bakery: Bakery) {
  const peers = bakery.peers ?? [];
  const rank = peerRank(bakery);
  const est = estimatedRevenue(bakery);
  const dead = deadWindow(bakery);
  const prices = counterPrices(bakery.menu).sort((a, b) => a - b);
  const peerRating = peers.length ? sum(peers.map((p) => p.rating)) / peers.length : 0;
  const peerRpm = peers.filter((p) => p.reviewsPerMonth != null).map((p) => p.reviewsPerMonth!);
  const open = weeklyOpenHours(bakery.hours);

  return [
    {
      label: "Google rating",
      value: `★ ${bakery.rating}`,
      sub: peerRating
        ? `${bakery.rating >= peerRating ? "+" : ""}${(bakery.rating - peerRating).toFixed(2)} vs ${peers.length} nearby`
        : `${bakery.reviewCount.toLocaleString()} reviews`,
    },
    {
      label: "Relative foot traffic",
      value: rank ? `${ord(rank.rank)} of ${rank.of}` : NA,
      sub: rank ? `by ${rank.basis}` : "needs nearby peers",
    },
    {
      label: "Avg price",
      value: bakery.avgTicket ? `$${bakery.avgTicket.toFixed(2)}` : NA,
      sub: prices.length ? `${prices.length} counter items · median $${prices[Math.floor(prices.length / 2)]}` : "no menu found",
    },
    {
      label: "Est. daily revenue",
      value: est ? usd(est.base.revenue) : NA,
      sub: est ? `~${est.base.visits} visits · range ${usd(est.low.revenue)}–${usd(est.high.revenue)}` : "needs review velocity + menu",
    },
    {
      label: "Dead window",
      value: dead ? dead.label : NA,
      sub: dead
        ? `${dead.avg}/100${dead.altAgrees === undefined ? "" : dead.altAgrees ? " · BestTime agrees" : " · BestTime disagrees"}`
        : "needs popular times",
    },
    {
      label: "Reviews / month",
      value: bakery.reviewsPerMonth ? String(bakery.reviewsPerMonth) : NA,
      sub: peerRpm.length ? `nearby avg ${(sum(peerRpm) / peerRpm.length).toFixed(1)}` : `${bakery.reviewCount.toLocaleString()} lifetime`,
    },
    {
      label: "Counter price range",
      value: prices.length ? `$${prices[0]}–$${prices[prices.length - 1]}` : NA,
      sub: "pastries, desserts, drinks",
    },
    {
      label: "Open hours / week",
      value: open ? `${Math.round(open)}h` : NA,
      sub: "per Google hours",
    },
  ];
}
