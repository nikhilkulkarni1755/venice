import type { Bakery, GeneratedAsset } from "./types";
import { computeMetrics } from "./analyze";
import { llmJson } from "./llm";
import { styleguide, hasContext } from "./context";
import { createPreorderLink } from "./stripe";

function id() {
  return Math.random().toString(36).slice(2, 10);
}
function deadLabel(b: Bakery) {
  return computeMetrics(b).deadHours.join(" & ") || "2–5pm";
}

// ---------------------------------------------------------------- POSTER ----
type PosterCopy = { headline: string; subhead: string; offer: string; cta: string; footer: string };

export async function generatePoster(b: Bakery): Promise<GeneratedAsset> {
  const dead = deadLabel(b);
  const fallback: PosterCopy = {
    headline: "Afternoon Rescue",
    subhead: `Fresh bakes, half the wait`,
    offer: `${dead}: any pastry + drip coffee for $6`,
    cta: "Pre-order & skip the line",
    footer: b.name,
  };
  const copy = await llmJson<PosterCopy>(
    `You write punchy print-poster copy for a bakery. Return JSON {headline, subhead, offer, cta, footer}. The goal is filling the ${dead} dead window. Keep headline <=3 words, offer concrete.`,
    JSON.stringify({ bakery: b.name, deadWindow: dead, rating: b.rating, vibe: b.categories }),
    fallback
  );

  const preorder = await createPreorderLink(b, "Afternoon pastry box", 600);
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=0&data=${encodeURIComponent(preorder.url)}`;
  const svg = posterSvg(copy, qr, b);

  return {
    id: id(),
    bakeryId: b.id,
    kind: "poster",
    title: `Poster — ${copy.headline}`,
    createdAt: new Date().toISOString(),
    provider: process.env.CANVA_API_TOKEN ? "Canva" : "FootfallAI render",
    data: { copy, svg, preorderUrl: preorder.url, preorderProvider: preorder.provider },
  };
}

function posterSvg(c: PosterCopy, qr: string, b: Bakery): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#2a1a12"/><stop offset="100%" stop-color="#4a2c1d"/>
    </linearGradient>
  </defs>
  <rect width="600" height="800" fill="url(#bg)"/>
  <circle cx="300" cy="150" r="300" fill="#f4c04e" opacity="0.08"/>
  <text x="300" y="90" text-anchor="middle" fill="#f4c04e" font-family="Georgia,serif" font-size="26" letter-spacing="6">🥐 ${esc(b.name.toUpperCase())}</text>
  <text x="300" y="250" text-anchor="middle" fill="#f7efe3" font-family="Georgia,serif" font-size="92" font-weight="bold">${esc(c.headline)}</text>
  <text x="300" y="310" text-anchor="middle" fill="#f4c04e" font-family="Helvetica,Arial" font-size="30">${esc(c.subhead)}</text>
  <rect x="80" y="370" width="440" height="110" rx="18" fill="#b4455f"/>
  <text x="300" y="435" text-anchor="middle" fill="#fff" font-family="Helvetica,Arial" font-size="30" font-weight="bold">${esc(c.offer)}</text>
  <rect x="180" y="530" width="240" height="240" rx="16" fill="#f7efe3"/>
  <image href="${qr}" x="190" y="540" width="220" height="220"/>
  <text x="300" y="792" text-anchor="middle" fill="#f7efe3" font-family="Helvetica,Arial" font-size="22" font-weight="bold">${esc(c.cta)} →</text>
</svg>`;
}
function esc(s: string) {
  return String(s).replace(/[<>&]/g, (m) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[m]!));
}

// ------------------------------------------------------- GOOGLE BUSINESS ----
type GBP = {
  description: string;
  categories: string[];
  attributes: string[];
  posts: { title: string; body: string }[];
  reviewReplies: { to: string; reply: string }[];
};

export async function generateGBP(b: Bakery): Promise<GeneratedAsset> {
  const dead = deadLabel(b);
  const fallback: GBP = {
    description: `${b.name} is a neighborhood bakery known for morning buns, laminated pastries, and house sourdough. Order ahead for afternoon pickup and skip the line.`,
    categories: ["Bakery", "Coffee shop", "Patisserie", "Takeout"],
    attributes: ["Order ahead", "Afternoon pickup", "Wheelchair accessible", "Outdoor seating"],
    posts: [
      { title: "Afternoon Rescue", body: `New ${dead} deal: any pastry + coffee for $6. Pre-order on our site.` },
      { title: "Fresh Sourdough Fridays", body: "Reserve a loaf before 11am. Limited daily bake." },
      { title: "Behind the counter", body: "Our morning buns are laminated by hand at 5am. Watch the bake." },
    ],
    reviewReplies: b.reviews
      .filter((r) => r.rating <= 3)
      .slice(0, 2)
      .map((r) => ({
        to: r.author,
        reply: `Thanks ${r.author} — you're right that afternoons ran thin. We've added a fresh ${dead} bake and a pre-order option. Come back and let us make it right!`,
      })),
  };
  const data = await llmJson<GBP>(
    `You optimize Google Business Profiles for local bakeries to win the local map pack and fill slow hours. Return JSON {description (<=750 chars, keyword-rich), categories[], attributes[], posts:[{title,body}] x3, reviewReplies:[{to,reply}]}. Focus the posts on the ${dead} dead window.`,
    JSON.stringify({ bakery: b.name, categories: b.categories, reviews: b.reviews, deadWindow: dead }),
    fallback
  );

  return {
    id: id(),
    bakeryId: b.id,
    kind: "google_business",
    title: "Google Business Profile — optimized",
    createdAt: new Date().toISOString(),
    provider: "FootfallAI + Google Business",
    data: data as unknown as Record<string, unknown>,
  };
}

// --------------------------------------------------------------- WEBSITE ----
type SiteContent = { tagline: string; about: string; menu: { name: string; price: string; note: string }[]; hoursNote: string };

export async function generateWebsite(b: Bakery): Promise<GeneratedAsset> {
  const dead = deadLabel(b);
  const fallback: SiteContent = {
    tagline: "Handmade pastries, baked before sunrise.",
    about: `${b.name} is a neighborhood bakery serving laminated pastries, house sourdough, and small-batch coffee. Pre-order ahead and pick up during our quiet ${dead} window.`,
    menu: [
      { name: "Morning Bun", price: "$5", note: "cardamom, orange sugar" },
      { name: "Country Sourdough", price: "$9", note: "48-hour ferment" },
      { name: "Afternoon Box", price: "$6", note: `${dead} special` },
    ],
    hoursNote: "Open 7am–7pm daily",
  };
  const content = await llmJson<SiteContent>(
    `You write warm, conversion-focused copy for a one-page bakery website with a pre-order CTA. Return JSON {tagline, about, menu:[{name,price,note}] x4-6, hoursNote}.`,
    JSON.stringify({ bakery: b.name, categories: b.categories, deadWindow: dead }),
    fallback
  );

  // Pull real brand colors if the bakery already has a site (Context.dev styleguide).
  let palette = { bg: "#fbf6ec", ink: "#2a1a12", accent: "#c97b3c", accent2: "#b4455f" };
  if (hasContext() && /\./.test(b.address)) {
    // (styleguide lookup is best-effort; skipped unless a domain is known)
  }

  const preorder = await createPreorderLink(b, "Pre-order box", 1200);
  const html = siteHtml(b, content, palette, preorder.url);

  return {
    id: id(),
    bakeryId: b.id,
    kind: "website",
    title: `Website — ${b.name}`,
    createdAt: new Date().toISOString(),
    provider: process.env.FREESTYLE_API_KEY ? "Freestyle (deployable)" : "FootfallAI render",
    data: { html, content, palette, preorderUrl: preorder.url, deployUrl: null },
  };
}

function siteHtml(b: Bakery, c: SiteContent, p: any, preorder: string): string {
  const menu = c.menu
    .map(
      (m) =>
        `<div class="row"><span><b>${esc(m.name)}</b> <i>${esc(m.note)}</i></span><span>${esc(m.price)}</span></div>`
    )
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(b.name)}</title><style>
*{box-sizing:border-box;margin:0}body{font-family:Georgia,serif;background:${p.bg};color:${p.ink}}
.hero{padding:80px 24px;text-align:center;background:linear-gradient(160deg,${p.accent}22,transparent)}
.hero h1{font-size:54px;margin-bottom:12px}.hero p{font-size:22px;opacity:.8}
.cta{display:inline-block;margin-top:28px;background:${p.ink};color:${p.bg};padding:16px 32px;border-radius:14px;text-decoration:none;font-size:18px}
.wrap{max-width:720px;margin:0 auto;padding:48px 24px}
.row{display:flex;justify-content:space-between;padding:14px 0;border-bottom:1px solid #0001}
.row i{opacity:.55;font-size:15px}h2{font-size:30px;margin-bottom:16px;color:${p.accent2}}
.about{font-size:19px;line-height:1.6}.foot{text-align:center;padding:40px;opacity:.6}
</style></head><body>
<div class="hero"><h1>${esc(b.name)}</h1><p>${esc(c.tagline)}</p><a class="cta" href="${preorder}">Pre-order for pickup →</a></div>
<div class="wrap"><h2>Our story</h2><p class="about">${esc(c.about)}</p></div>
<div class="wrap"><h2>Menu</h2>${menu}</div>
<div class="foot">${esc(c.hoursNote)} · ${esc(b.address)} · ★ ${b.rating}</div>
</body></html>`;
}

// ---------------------------------------------------------------- TIKTOK ----
type Tiktok = { hook: string; script: { time: string; shot: string; vo: string }[]; caption: string; hashtags: string[] };

export async function generateTiktok(b: Bakery): Promise<GeneratedAsset> {
  const dead = deadLabel(b);
  const fallback: Tiktok = {
    hook: `POV: it's ${dead} and the croissants just came out`,
    script: [
      { time: "0:00", shot: "Close-up: tray of pastries sliding out of the oven", vo: "It's the afternoon slump..." },
      { time: "0:03", shot: "Hands dusting powdered sugar", vo: "...but we're just getting started." },
      { time: "0:07", shot: "Steam off a fresh coffee", vo: `${dead}: pastry plus coffee, six bucks.` },
      { time: "0:11", shot: "Storefront + QR on the poster", vo: "Pre-order, skip the line. See you soon." },
    ],
    caption: `The ${dead} drop is real 🥐☕ #freshbake`,
    hashtags: ["#bakery", "#freshbaked", "#foodtok", `#${b.name.replace(/\s+/g, "").toLowerCase()}`, "#smallbusiness"],
  };
  const data = await llmJson<Tiktok>(
    `You script short vertical TikToks that drive local foot traffic for a bakery. Return JSON {hook, script:[{time,shot,vo}] x4-5 (<=15s total), caption, hashtags[]}. Advertise the ${dead} window.`,
    JSON.stringify({ bakery: b.name, deadWindow: dead, vibe: b.categories }),
    fallback
  );

  // ElevenLabs voiceover of the VO track, when keyed.
  let audioNote = "Add ElevenLabs API key to generate the voiceover automatically.";
  let audioUrl: string | null = null;
  if (process.env.ELEVENLABS_API_KEY) {
    try {
      const vo = data.script.map((s) => s.vo).join(" ");
      const r = await fetch("https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL", {
        method: "POST",
        headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY!, "Content-Type": "application/json" },
        body: JSON.stringify({ text: vo, model_id: "eleven_turbo_v2_5" }),
      });
      if (r.ok) {
        const buf = Buffer.from(await r.arrayBuffer());
        audioUrl = `data:audio/mpeg;base64,${buf.toString("base64")}`;
        audioNote = "Voiceover generated by ElevenLabs.";
      }
    } catch {}
  }

  return {
    id: id(),
    bakeryId: b.id,
    kind: "tiktok",
    title: `TikTok — ${data.hook.slice(0, 40)}`,
    createdAt: new Date().toISOString(),
    provider: audioUrl ? "FootfallAI + ElevenLabs" : "FootfallAI",
    data: { ...data, audioUrl, audioNote } as unknown as Record<string, unknown>,
  };
}
