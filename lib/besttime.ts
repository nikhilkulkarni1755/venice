import type { DayTraffic } from "./types";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// BestTime forecast: analysis[].day_raw = 24 values starting at 6am (day_int 0 = Monday).
// Used as a cross-check on Google's popular times; [] when unkeyed or on any failure.
export async function bestTime(name: string, address: string): Promise<DayTraffic[]> {
  const key = process.env.BESTTIME_API_KEY_PRIVATE;
  if (!key) return [];
  try {
    const q = new URLSearchParams({ api_key_private: key, venue_name: name, venue_address: address });
    const j = await (await fetch(`https://besttime.app/api/v1/forecasts?${q}`, { method: "POST" })).json();
    return (j.analysis || []).map((a: any) => ({
      day: DAYS[a.day_info.day_int],
      hours: a.day_raw.map((busyness: number, i: number) => ({ hour: (6 + i) % 24, busyness })),
    }));
  } catch {
    return [];
  }
}
