"use client";

import type { Bakery } from "@/lib/types";
import { cohort, deadWindow } from "@/lib/traffic";

// Day x hour heatmap of popular times (darker = busier), with the emptiest 3 hours outlined.
export function PopularTimesChart({ bakery }: { bakery: Bakery }) {
  const dead = deadWindow(bakery);
  const hours = Array.from({ length: 13 }, (_, i) => i + 7);
  const L = 34;
  const cw = (560 - L) / hours.length;
  const rh = 22;
  const label = (h: number) => `${h % 12 || 12}${h >= 12 ? "p" : "a"}`;

  return (
    <svg viewBox={`0 0 560 ${bakery.popularTimes.length * rh + 34}`} className="w-full">
      {hours.map((h, i) => (
        <text key={h} x={L + i * cw + cw / 2} y={10} textAnchor="middle" fontSize="9" fill="#2a1a12" opacity="0.5">
          {label(h)}
        </text>
      ))}
      {bakery.popularTimes.map((d, r) => (
        <g key={d.day}>
          <text x={0} y={22 + r * rh + 12} fontSize="10" fill="#2a1a12" opacity="0.6">{d.day}</text>
          {hours.map((h, i) => {
            const v = d.hours.find((x) => x.hour === h)?.busyness ?? 0;
            const isDead = dead && dead.day === d.day && h >= dead.start && h < dead.start + 3;
            return (
              <rect key={h} x={L + i * cw + 1} y={18 + r * rh} width={cw - 2} height={rh - 2} rx={3} fill="#c97b3c"
                opacity={v ? 0.12 + 0.88 * (v / 100) : 0.04} stroke={isDead ? "#b4455f" : "none"} strokeWidth={2}>
                <title>{`${d.day} ${label(h)}: ${v}/100`}</title>
              </rect>
            );
          })}
        </g>
      ))}
      <text x={L} y={bakery.popularTimes.length * rh + 30} fontSize="9" fill="#2a1a12" opacity="0.5">
        darker = busier · outlined = emptiest 3 open hours
      </text>
    </svg>
  );
}

// Reviews per month for this bakery vs its nearest peers (falls back to lifetime reviews).
export function PeerChart({ bakery }: { bakery: Bakery }) {
  const rows = cohort(bakery).map((p, i) => ({ name: p.name, v: p.reviewsPerMonth ?? p.reviewCount, self: i === 0 }));
  const max = Math.max(1, ...rows.map((r) => r.v));
  return (
    <svg viewBox={`0 0 560 ${rows.length * 34}`} className="w-full">
      {rows.map((r, i) => (
        <g key={r.name}>
          <text x={0} y={i * 34 + 14} fontSize="11" fill="#2a1a12" opacity="0.7">{r.name.slice(0, 34)}</text>
          <rect x={0} y={i * 34 + 19} width={(r.v / max) * 520} height={9} rx={4} fill={r.self ? "#b4455f" : "#c97b3c"} opacity={r.self ? 0.95 : 0.7} />
          <text x={(r.v / max) * 520 + 6} y={i * 34 + 28} fontSize="10" fill="#2a1a12" opacity="0.6">{r.v}</text>
        </g>
      ))}
    </svg>
  );
}
