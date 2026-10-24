import type { Bakery, DayTraffic, SalesPoint, HourPoint } from "./types";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const OPEN = 7;
const CLOSE = 19;

// Build a plausible popular-times curve for a bakery day.
// `shape` lets us encode a specific business's rhythm.
function dayCurve(
  day: string,
  opts: { morningPeak: number; afternoonDip: number; eveningBump: number; weekend?: boolean }
): DayTraffic {
  const hours: HourPoint[] = [];
  for (let h = 0; h < 24; h++) {
    let b = 0;
    if (h >= OPEN && h <= CLOSE) {
      // morning rush around 8-10
      const morning = Math.max(0, 1 - Math.abs(h - 8.5) / 3) * opts.morningPeak;
      // lunch around 12-13
      const lunch = Math.max(0, 1 - Math.abs(h - 12.5) / 2) * (opts.weekend ? 55 : 48);
      // afternoon dip 14-17 (the pain point)
      const afternoon = Math.max(0, 1 - Math.abs(h - 15.5) / 3) * opts.afternoonDip;
      // evening commuter bump
      const evening = Math.max(0, 1 - Math.abs(h - 17.5) / 2) * opts.eveningBump;
      b = Math.min(100, Math.round(morning + lunch + afternoon + evening));
    }
    hours.push({ hour: h, busyness: b });
  }
  return { day, hours };
}

function salesSeries(base: number, weekendMult: number, days = 30): SalesPoint[] {
  const out: SalesPoint[] = [];
  const now = new Date("2026-10-23T00:00:00Z");
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(now.getUTCDate() - i);
    const dow = d.getUTCDay(); // 0 Sun ... 6 Sat
    const weekend = dow === 0 || dow === 6;
    const noise = 0.85 + Math.random() * 0.3;
    const revenue = Math.round(base * (weekend ? weekendMult : 1) * noise);
    const avgTicket = 7.5 + Math.random() * 2;
    out.push({
      date: d.toISOString().slice(0, 10),
      revenue,
      transactions: Math.round(revenue / avgTicket),
    });
  }
  return out;
}

export const SEED_BAKERIES: Bakery[] = [
  {
    id: "sweet-crumb",
    name: "Sweet Crumb Bakery",
    address: "412 Hayes St, San Francisco, CA",
    placeId: "demo_sweet_crumb",
    rating: 4.4,
    reviewCount: 287,
    priceLevel: 2,
    categories: ["Bakery", "Coffee", "Pastries", "Sourdough"],
    source: "seed",
    competitorNames: ["Rise & Co.", "Flour Theory"],
    // Strong morning + lunch, a painful 2-5pm dead zone, no evening presence.
    popularTimes: DAYS.map((d) => {
      const weekend = d === "Sat" || d === "Sun";
      return dayCurve(d, {
        morningPeak: weekend ? 70 : 82,
        afternoonDip: weekend ? 34 : 22, // <-- the problem the agent should find
        eveningBump: 10,
        weekend,
      });
    }),
    sales: salesSeries(1850, 1.25),
    reviews: [
      { author: "Dana R.", rating: 5, text: "Best morning bun in the city. Line is worth it at 8am.", date: "2026-10-18" },
      { author: "Marcus T.", rating: 4, text: "Love the sourdough. Wish they had more seating and afternoon deals.", date: "2026-10-12" },
      { author: "Priya S.", rating: 5, text: "The laminated pastries are incredible. Baristas are so friendly.", date: "2026-10-09" },
      { author: "Jon W.", rating: 3, text: "Great product but dead and understaffed in the afternoon, felt day-old.", date: "2026-10-05" },
      { author: "Elena K.", rating: 4, text: "Cute spot, perfect for a quick coffee. Instagram-worthy interior.", date: "2026-09-28" },
      { author: "Sam B.", rating: 2, text: "Showed up at 4pm and half the case was empty. Kind of a letdown.", date: "2026-09-21" },
    ],
  },
  {
    id: "rise-co",
    name: "Rise & Co.",
    address: "88 Divisadero St, San Francisco, CA",
    placeId: "demo_rise_co",
    rating: 4.6,
    reviewCount: 921,
    priceLevel: 2,
    categories: ["Bakery", "Cafe", "Brunch"],
    source: "seed",
    competitorNames: ["Sweet Crumb Bakery"],
    popularTimes: DAYS.map((d) => {
      const weekend = d === "Sat" || d === "Sun";
      return dayCurve(d, { morningPeak: 75, afternoonDip: 58, eveningBump: 40, weekend });
    }),
    sales: salesSeries(2600, 1.3),
    reviews: [
      { author: "Alex M.", rating: 5, text: "Their afternoon 'happy hour' pastry box is genius. Always packed.", date: "2026-10-15" },
      { author: "Nina L.", rating: 5, text: "Great TikTok presence got me in the door, stayed for the croissants.", date: "2026-10-02" },
    ],
  },
];

export function getSeedBakery(id: string): Bakery | undefined {
  return SEED_BAKERIES.find((b) => b.id === id);
}
