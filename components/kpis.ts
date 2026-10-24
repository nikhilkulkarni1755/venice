import type { Bakery, Analysis } from "@/lib/types";

// Client-safe KPI computation (does NOT import the server analyze module).
export function computeKpis(bakery: Bakery, analysis: Analysis | null) {
  const last7 = bakery.sales.slice(-7);
  const weekly = last7.reduce((a, s) => a + s.revenue, 0);
  const tx = last7.reduce((a, s) => a + s.transactions, 0);
  const avgTicket = tx ? weekly / tx : 0;

  // weekday afternoon (2-5pm) avg busyness vs morning peak
  const weekday = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  function avgWindow(from: number, to: number) {
    let total = 0;
    let n = 0;
    for (const d of bakery.popularTimes) {
      if (!weekday.includes(d.day)) continue;
      for (const h of d.hours) if (h.hour >= from && h.hour < to) {
        total += h.busyness;
        n++;
      }
    }
    return n ? Math.round(total / n) : 0;
  }
  const morning = avgWindow(8, 11);
  const afternoon = avgWindow(14, 17);
  const gap = morning ? Math.round(((morning - afternoon) / morning) * 100) : 0;

  return [
    { label: "Weekly revenue", value: `$${weekly.toLocaleString()}`, sub: "last 7 days" },
    { label: "Avg ticket", value: `$${avgTicket.toFixed(2)}`, sub: `${tx} orders/wk` },
    { label: "Afternoon gap", value: `-${gap}%`, sub: `vs morning peak (${morning}/100)` },
    {
      label: "Dead window",
      value: analysis?.deadHours?.[0] || "2–5pm",
      sub: `${afternoon}/100 busyness`,
    },
  ];
}
