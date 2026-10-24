// Domain model for FootfallAI.

export type HourPoint = { hour: number; busyness: number }; // 0-100, like Google popular times
export type DayTraffic = { day: string; hours: HourPoint[] };

export type SalesPoint = { date: string; revenue: number; transactions: number };

export type Review = { author: string; rating: number; text: string; date: string };

export type Bakery = {
  id: string;
  name: string;
  address: string;
  placeId?: string;
  rating: number;
  reviewCount: number;
  priceLevel: number; // 1-4
  categories: string[];
  photoUrl?: string;
  // intelligence
  popularTimes: DayTraffic[];
  sales: SalesPoint[]; // last ~30 days
  reviews: Review[];
  competitorNames?: string[];
  source: "live" | "seed";
};

export type Recommendation = {
  id: string;
  type: "poster" | "google_business" | "website" | "tiktok" | "ops";
  title: string;
  rationale: string;
  projectedLift: string; // e.g. "+12% weekday afternoon footfall"
  effort: "low" | "medium" | "high";
  confidence: number; // 0-1
  buildable: boolean; // can the agent produce the asset here?
};

export type Analysis = {
  bakeryId: string;
  headline: string;
  summary: string;
  deadHours: string[]; // human readable dead windows
  peakHours: string[];
  weeklyRevenue: number;
  avgTicket: number;
  sentiment: { positive: string[]; negative: string[] };
  recommendations: Recommendation[];
  sources: { url: string; title: string }[]; // live web grounding (context.dev)
  generatedAt: string;
  model: string; // which brain produced it
};

export type GeneratedAsset = {
  id: string;
  bakeryId: string;
  kind: "poster" | "google_business" | "website" | "tiktok";
  title: string;
  createdAt: string;
  // kind-specific payload
  data: Record<string, unknown>;
  provider: string; // which sponsor produced it
};
