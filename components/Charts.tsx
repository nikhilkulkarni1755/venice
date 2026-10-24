"use client";

import type { Bakery, SalesPoint } from "@/lib/types";

// Average weekday busyness by hour, rendered as SVG bars with the dead window flagged.
export function PopularTimesChart({ bakery }: { bakery: Bakery }) {
  const weekday = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const byHour: { hour: number; v: number }[] = [];
  for (let h = 7; h <= 19; h++) {
    let total = 0;
    let n = 0;
    for (const d of bakery.popularTimes) {
      if (!weekday.includes(d.day)) continue;
      const hp = d.hours.find((x) => x.hour === h);
      if (hp) {
        total += hp.busyness;
        n++;
      }
    }
    byHour.push({ hour: h, v: n ? Math.round(total / n) : 0 });
  }
  const max = Math.max(1, ...byHour.map((x) => x.v));
  const avg = byHour.reduce((a, x) => a + x.v, 0) / byHour.length;
  const W = 560;
  const H = 180;
  const bw = W / byHour.length;

  function label(h: number) {
    const ap = h >= 12 ? "p" : "a";
    const hr = h % 12 === 0 ? 12 : h % 12;
    return `${hr}${ap}`;
  }

  return (
    <svg viewBox={`0 0 ${W} ${H + 24}`} className="w-full">
      {byHour.map((x, i) => {
        const bh = (x.v / max) * H;
        const dead = x.v > 0 && x.v <= Math.max(10, avg * 0.45);
        return (
          <g key={x.hour}>
            <rect
              x={i * bw + 3}
              y={H - bh}
              width={bw - 6}
              height={bh}
              rx={4}
              fill={dead ? "#b4455f" : "#c97b3c"}
              opacity={dead ? 0.95 : 0.85}
            />
            <text x={i * bw + bw / 2} y={H + 16} textAnchor="middle" fontSize="10" fill="#2a1a12" opacity="0.5">
              {label(x.hour)}
            </text>
          </g>
        );
      })}
      <line x1={0} y1={H - (avg / max) * H} x2={W} y2={H - (avg / max) * H} stroke="#6b8f71" strokeDasharray="4 4" />
    </svg>
  );
}

export function SalesChart({ sales }: { sales: SalesPoint[] }) {
  const data = sales.slice(-30);
  const max = Math.max(1, ...data.map((d) => d.revenue));
  const W = 560;
  const H = 160;
  const step = W / Math.max(1, data.length - 1);
  const pts = data.map((d, i) => `${i * step},${H - (d.revenue / max) * H}`).join(" ");
  const area = `0,${H} ${pts} ${W},${H}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f4c04e" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#f4c04e" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#g)" />
      <polyline points={pts} fill="none" stroke="#c97b3c" strokeWidth="2.5" />
    </svg>
  );
}
