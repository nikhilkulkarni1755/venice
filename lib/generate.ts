import type { Bakery, GeneratedAsset } from "./types";
import { counterItems, deadWindow, popularItems } from "./traffic";
import { DEFAULT_PALETTE, isDark, type Palette } from "./print";
import { dishImage } from "./images";
import { llmJson } from "./llm";
import { brandStyle } from "./context";
import { createPreorderLink } from "./stripe";

function id() {
  return Math.random().toString(36).slice(2, 10);
}

// ---------------------------------------------------------------- POSTER ----
type PosterCopy = { headline: string; name: string; address: string; items: string[] };

// Verified facts the agents may state; anything not here must not be claimed.
function facts(b: Bakery) {
  const p = b.brand?.palette;
  return {
    name: b.name,
    address: b.address,
    categories: b.categories,
    hours: b.hours ?? [],
    amenities: b.attributes ?? [],
    orderOnline: !!b.orderUrl,
    quietestWindow: deadWindow(b)?.label ?? null,
    menu: counterItems(b.menu).map((i) => `${i.name} $${i.price}`),
    websiteStyle: p
      ? `${isDark(p.bg) ? "dark" : "light"} background ${p.bg}, text ${p.ink}, accent ${p.accent}${b.brand?.font ? `, ${b.brand.font} headings` : ""}`
      : null,
  };
}

// A real pairing at menu prices (no invented discount): the signature pastry + a coffee.
function pairing(b: Bakery) {
  const items = counterItems(b.menu);
  const pastries = items.filter((i) => /viennois|bread|pastr/i.test(i.category));
  const coffees = items.filter((i) => /drink|coffee/i.test(i.category) && /coffee|espresso|americano/i.test(i.name));
  const pastry = pastries.find((i) => /croissant/i.test(i.name)) ?? pastries[0];
  const drink = coffees.find((i) => /drip/i.test(i.name)) ?? coffees.sort((x, y) => x.price - y.price)[0];
  return pastry && drink ? { text: `${pastry.name} + ${drink.name}`, price: Math.round((pastry.price + drink.price) * 100) / 100 } : null;
}

// Deterministic design from verified data (no model, nothing invented): "<Category> nearby!",
// name, address, then the dishes reviewers mention most (no prices) in the website's colors.
export async function generatePoster(b: Bakery): Promise<GeneratedAsset> {
  const cat = b.categories[0] || "Bakery";
  let items = popularItems(b);
  if (!items.length && b.reviewTags?.length) {
    // No menu to match against: let the model pick specific orderable dishes from the review tags only.
    const tags = b.reviewTags.map((t) => t.title);
    const picked = await llmJson<{ items: string[] }>(
      `From these review tags pick up to 2 that are specific food or drink items a customer can order (not services, atmosphere, adjectives or generic words like "pastries"). Return JSON {"items":[...]} using the exact tag text.`,
      JSON.stringify(tags),
      { items: [] }
    );
    items = picked.items.filter((t) => tags.includes(t)).slice(0, 2).map((t) => t.replace(/\b\w/g, (c) => c.toUpperCase()));
  }
  const copy: PosterCopy = { headline: `${cat[0].toUpperCase()}${cat.slice(1)} nearby!`, name: b.name, address: b.address, items };
  const palette = b.brand?.palette ?? DEFAULT_PALETTE;
  const images = await Promise.all(items.map((i) => dishImage(i, isDark(palette.bg))));
  return {
    id: id(),
    bakeryId: b.id,
    kind: "poster",
    title: `Poster — ${copy.headline}`,
    createdAt: new Date().toISOString(),
    provider: "Venice render",
    data: { copy, svg: posterSvg(copy, images, b.brand?.font, palette), palette, images },
  };
}

function posterSvg(c: PosterCopy, images: (string | null)[], font: string | undefined, p: Palette): string {
  const family = `${font ? `'${esc(font)}', ` : ""}Georgia, serif`;
  // Shrink long text to fit the 600px poster (k = average glyph width / font size).
  const fit = (t: string, max: number, w: number, k = 0.56) => Math.min(max, Math.floor(w / (t.length * k)));
  const w = 230;
  const itemSize = Math.min(...c.items.map((t) => fit(t, 38, w - 30, 0.62))); // one size for all items
  const cards = c.items
    .map((item, i) => {
      const x = c.items.length === 1 ? 185 : 60 + i * 250;
      const ink = isDark(p.accent2) ? "#ffffff" : "#111111";
      if (!images[i]) {
        return `<rect x="${x}" y="470" width="${w}" height="250" rx="20" fill="${p.accent2}"/>
  <text x="${x + w / 2}" y="607" text-anchor="middle" fill="${ink}" font-family="${family}" font-size="${itemSize}" font-weight="bold">${esc(item)}</text>`;
      }
      // Full square dish image (uncropped, so its own corner label stays visible) above the name strip.
      return `<clipPath id="card${i}"><rect x="${x}" y="470" width="${w}" height="286" rx="20"/></clipPath>
  <g clip-path="url(#card${i})"><image href="${images[i]}" x="${x}" y="470" width="${w}" height="${w}"/><rect x="${x}" y="${470 + w}" width="${w}" height="56" fill="${p.accent2}"/></g>
  <text x="${x + w / 2}" y="${470 + w + 37}" text-anchor="middle" fill="${ink}" font-family="${family}" font-size="${fit(item, 28, w - 24, 0.62)}" font-weight="bold">${esc(item)}</text>`;
    })
    .join("\n  ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800">
  ${font ? `<defs><style>@import url('https://fonts.googleapis.com/css2?family=${esc(encodeURIComponent(font))}:wght@400;700&amp;display=swap');</style></defs>` : ""}
  <rect width="600" height="800" fill="${p.bg}"/>
  <circle cx="300" cy="200" r="330" fill="${p.accent}" opacity="0.08"/>
  <text x="300" y="210" text-anchor="middle" fill="${p.ink}" font-family="${family}" font-size="${fit(c.headline, 84, 540, 0.62)}" font-weight="bold">${esc(c.headline)}</text>
  <text x="300" y="295" text-anchor="middle" fill="${p.accent}" font-family="${family}" font-size="${fit(c.name, 40, 540, 0.62)}" font-weight="bold">${esc(c.name)}</text>
  <text x="300" y="345" text-anchor="middle" fill="${p.ink}" opacity="0.85" font-family="${family}" font-size="${fit(c.address, 26, 540)}">${esc(c.address)}</text>
  <line x1="60" y1="395" x2="540" y2="395" stroke="${p.accent}" stroke-width="2"/>
  ${cards}
</svg>`;
}
function esc(s: string) {
  return String(s).replace(/[<>&]/g, (m) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[m]!));
}

// ------------------------------------------------------- GOOGLE BUSINESS ----
type GBP = {
  description: string;
  posts: { title: string; body: string }[];
  reviewReplies: { to: string; reply: string }[];
};

export async function generateGBP(b: Bakery): Promise<GeneratedAsset> {
  const f = facts(b);
  const pair = pairing(b);
  const reviews = [...b.reviews].sort((x, y) => x.rating - y.rating).slice(0, 3);
  const fallback: GBP = {
    description: `${b.name} is a ${(b.categories[0] || "bakery").toLowerCase()} at ${b.address}.${b.orderUrl ? " Order online for pickup or delivery." : ""}`,
    posts: pair
      ? [{ title: "Coffee and pastry", body: `${pair.text}, $${pair.price.toFixed(2)} at menu prices. Find us at ${b.address}.` }]
      : [],
    reviewReplies: reviews.map((r) => ({
      to: r.author,
      reply:
        r.rating >= 4
          ? `Thank you, ${r.author}, for the kind words! We hope to see you again soon.`
          : `Thank you for the feedback, ${r.author}. We're sorry we fell short and would love to hear more.`,
    })),
  };
  const ai = await llmJson<GBP>(
    `You write Google Business Profile copy for a local bakery. Return JSON {description (<=750 chars), posts:[{title,body}] x3, reviewReplies:[{to,reply}]}. Use ONLY the facts provided: never invent amenities, products, prices, discounts, awards or hours, and avoid unverifiable quality claims (handcrafted, fresh, authentic, signature, traditional, daily, expertly). Posts may use the menu pairing at its listed price and the quietestWindow. Replies must answer only what the review says, thank the reviewer, make no claims about ingredients or quality, and promise nothing beyond listening.`,
    JSON.stringify({ facts: f, pairing: pair, reviews }),
    fallback
  );
  const cut = (t: string) => (t.length <= 750 ? t : t.slice(0, 750).replace(/\s+\S*$/, ""));

  return {
    id: id(),
    bakeryId: b.id,
    kind: "google_business",
    title: "Google Business Profile — optimized",
    createdAt: new Date().toISOString(),
    provider: "Venice + Google Business",
    data: {
      description: cut(ai.description || fallback.description),
      categories: b.categories,
      attributes: (b.attributes ?? []).slice(0, 12),
      posts: ai.posts ?? fallback.posts,
      reviewReplies: ai.reviewReplies ?? fallback.reviewReplies,
      notes: "Categories and attributes come from the live Google listing. Posts are suggestions: confirm any offer before publishing.",
    },
  };
}

// --------------------------------------------------------------- WEBSITE ----
type SiteContent = { tagline: string; about: string; menu: { name: string; price: string; note: string }[]; hoursNote: string };

export async function generateWebsite(b: Bakery): Promise<GeneratedAsset> {
  const dead = deadWindow(b)?.label ?? "afternoon";
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

  // Pull the bakery's REAL brand colors + font from their live site (Context.dev).
  const brand = await brandStyle(b.name);
  const palette = brand.palette || { bg: "#fbf6ec", ink: "#2a1a12", accent: "#c97b3c", accent2: "#b4455f" };
  const brandedFrom = brand.palette ? brand.domain : null;

  const preorder = await createPreorderLink(b, "Pre-order box", 1200);
  const html = siteHtml(b, content, palette, preorder.url, brand.font);

  return {
    id: id(),
    bakeryId: b.id,
    kind: "website",
    title: `Website — ${b.name}`,
    createdAt: new Date().toISOString(),
    provider: process.env.FREESTYLE_API_KEY ? "Freestyle (deployable)" : "Venice render",
    data: { html, content, palette, preorderUrl: preorder.url, deployUrl: null, brandedFrom },
  };
}

function siteHtml(b: Bakery, c: SiteContent, p: any, preorder: string, font?: string): string {
  const ff = font ? `${font}, Georgia, serif` : "Georgia, serif";
  const menu = c.menu
    .map(
      (m) =>
        `<div class="row"><span><b>${esc(m.name)}</b> <i>${esc(m.note)}</i></span><span>${esc(m.price)}</span></div>`
    )
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(b.name)}</title><style>
*{box-sizing:border-box;margin:0}body{font-family:${ff};background:${p.bg};color:${p.ink}}
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
  const dead = deadWindow(b)?.label ?? "afternoon";
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
    provider: audioUrl ? "Venice + ElevenLabs" : "Venice",
    data: { ...data, audioUrl, audioNote } as unknown as Record<string, unknown>,
  };
}
