// Domain model for FootfallAI.

export type HourPoint = { hour: number; busyness: number }; // 0-100, like Google popular times
export type DayTraffic = { day: string; hours: HourPoint[] };

export type Review = { author: string; rating: number; text: string; date: string };

export type Peer = { name: string; rating: number; reviewCount: number; reviewsPerMonth?: number; distanceM: number };

export type PosterSpot = {
  name: string;
  kind: string; // what we searched for: "library", "hardware store", ...
  address: string;
  miles: number;
  rating: number;
  reviewCount: number;
  busiest?: string; // e.g. "Sat 2pm", from popular times
  url: string; // Google Maps
};

export type Bakery = {
  id: string;
  name: string;
  address: string;
  placeId?: string;
  rating: number;
  reviewCount: number;
  priceLevel?: number; // 1-4
  categories: string[];
  photoUrl?: string;
  reviewTags?: { title: string; count: number }[]; // what reviewers mention most, with counts
  website?: string;
  location?: { lat: number; lng: number };
  orderUrl?: string; // the bakery's own online-ordering page
  hours?: string[]; // e.g. "Monday 8 AM to 6 PM"
  attributes?: string[]; // Google-listed amenities/services (only the true ones)
  brand?: { palette: { bg: string; ink: string; accent: string; accent2: string }; font?: string };
  reviewsPerMonth?: number; // from the dated reviews we fetched
  peers?: Peer[]; // nearest comparable places
  popularTimesAlt?: DayTraffic[]; // second provider (BestTime) as a cross-check
  updatedAt?: string;
  menu?: { category: string; name: string; price: number }[];
  avgTicket?: number; // mean price of counter items (pastries, desserts, drinks)
  // intelligence
  popularTimes: DayTraffic[];
  reviews: Review[];
  competitorNames?: string[];
};

export type Recommendation = {
  id: string;
  type: "poster" | "google_business" | "website" | "tiktok" | "ops";
  title: string;
  rationale: string;
  effort: "low" | "medium" | "high";
  buildable: boolean; // can the agent produce the asset here?
};

export type Analysis = {
  bakeryId: string;
  headline: string;
  summary: string;
  sentiment: { positive: string[]; negative: string[] };
  recommendations: Recommendation[];
  sources: { url: string; title: string }[]; // live web grounding (context.dev)
  generatedAt: string;
  model: string; // which brain produced it
};

export type GeneratedAsset = {
  id: string;
  bakeryId: string;
  kind: "poster" | "google_business" | "website" | "tiktok" | "spots";
  title: string;
  createdAt: string;
  // kind-specific payload
  data: Record<string, unknown>;
  provider: string; // which sponsor produced it
};
