// Single server-side wrapper for Context.dev (https://docs.context.dev).
// One API for web data: scrape, search, research answers, brand + styleguide.
// Key: CONTEXT_DEV_API_KEY (server-only). Every call routes through here.
//
// Endpoints used:
//  - POST /web/scrape      -> Google Maps listing / competitor pages   (docs: /api-reference/web-scraping/scrape)
//  - POST /web/search      -> local market & competitor research        (docs: /api-reference/web-scraping/search)
//  - POST /web/answers     -> sourced growth-strategy research (JSON)   (docs: /api-reference/web-extraction/answers)
//  - GET  /web/styleguide  -> brand colors/fonts for website gen        (docs: /api-reference/brand-intelligence/styleguide)
//  - POST /brand/retrieve  -> logo/colors/socials for website gen       (docs: /api-reference/brand-intelligence/brand)

const BASE = "https://api.context.dev/v1";

export function hasContext(): boolean {
  return !!process.env.CONTEXT_DEV_API_KEY;
}

async function call<T>(path: string, init: RequestInit, attempt = 0): Promise<T> {
  const key = process.env.CONTEXT_DEV_API_KEY;
  if (!key) throw new Error("CONTEXT_DEV_API_KEY not set");
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      ...(init.headers || {}),
    },
  });

  if (res.status === 429) {
    const retry = Number(res.headers.get("Retry-After") || "1");
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, retry * 1000));
      return call<T>(path, init, attempt + 1);
    }
  }
  if ((res.status === 408 || res.status >= 500) && attempt < 2) {
    await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    return call<T>(path, init, attempt + 1);
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`context.dev ${path} ${res.status}: ${body.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

export async function scrape(url: string, opts: Record<string, unknown> = {}) {
  return call<any>("/web/scrape", {
    method: "POST",
    body: JSON.stringify({ url, formats: { markdown: true }, sharedParams: { mainContentOnly: true }, ...opts }),
  });
}

export async function search(query: string, opts: Record<string, unknown> = {}) {
  return call<any>("/web/search", { method: "POST", body: JSON.stringify({ query, ...opts }) });
}

// Research a question and get back JSON shaped like `jsonFormat` (an EXAMPLE
// object, not a JSON Schema — that's what the API expects).
export async function answers(task: string, jsonFormat: Record<string, unknown>, mode: "fast" | "ultra" = "fast") {
  return call<any>("/web/answers", {
    method: "POST",
    body: JSON.stringify({ mode, task, json_format: jsonFormat }),
  });
}

export async function styleguide(domain: string) {
  return call<any>(`/web/styleguide?domain=${encodeURIComponent(domain)}`, { method: "GET" });
}

export async function retrieveBrand(identifier: string) {
  return call<any>("/brand/retrieve", { method: "POST", body: JSON.stringify({ identifier }) });
}

// Brand palette + heading font from a domain's live styleguide.
export async function brandOf(
  domain: string
): Promise<{ palette?: { bg: string; ink: string; accent: string; accent2: string }; font?: string; domain?: string }> {
  const sg = await styleguide(domain);
  const style = sg?.styleguide || sg;
  const c = style?.colors || {};
  const hex = (v: unknown) => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : undefined);
  const accent = hex(c.accent) || hex(c.primary) || hex(c.brand);
  const font = style?.typography?.headings?.h1?.fontFamily || style?.typography?.body?.fontFamily || undefined;
  const palette = accent
    ? {
        bg: hex(c.background) || "#fbf6ec",
        ink: hex(c.text) || "#2a1a12",
        accent,
        accent2: hex(c.secondary) || accent,
      }
    : undefined;
  return { palette, font, domain };
}

// Find a bakery's real website and extract its live brand palette + heading
// font, so the generated site matches their actual look. Gated: only returns a
// palette when the found domain shares a token with the bakery name, so fictional
// demo bakeries don't get a random site's colors. Best-effort, [] on failure.
export async function brandStyle(
  name: string
): Promise<{ palette?: { bg: string; ink: string; accent: string; accent2: string }; font?: string; domain?: string }> {
  if (!hasContext()) return {};
  try {
    const s = await search(`${name} official website`, { numResults: 5 });
    const results = (s?.results || []) as any[];
    const bad = /(facebook|instagram|yelp|tripadvisor|google|doordash|ubereats|grubhub|wikipedia|x\.com|twitter|tiktok|linkedin|mapquest)\./i;
    const hit = results.find((r) => r.url && !bad.test(r.url));
    if (!hit) return {};
    const domain = new URL(hit.url).hostname.replace(/^www\./, "");
    const tokens = name.toLowerCase().split(/\s+/).filter((t) => t.length > 3);
    const matches = tokens.some((t) => domain.toLowerCase().includes(t));
    if (!matches) return { domain };

    return brandOf(domain);
  } catch {
    return {};
  }
}

// Find the nearest FedEx Office to an address and derive its store email.
// We standardized on FedEx Office: empirically it's the only chain whose
// per-store email is both published on every location page AND deterministically
// derivable from the office number in the URL (office-4095 -> usa4095@fedex.com),
// so there's zero guessing about the recipient.
export type PrintShop = { name: string; address: string; email?: string; phone?: string; website?: string; distance?: string };
export async function findFedExOffice(address: string): Promise<PrintShop[]> {
  if (!hasContext()) return [];
  try {
    const r = await answers(
      `Find the single nearest FedEx Office Print & Ship Center to "${address}". Return its office/store number, full street address, phone number, and its local.fedex.com location page URL (format: local.fedex.com/en-us/<state>/<city>/office-NNNN).`,
      { officeNumber: "", address: "", phone: "", url: "" },
      "fast"
    );
    const j = r?.json_content || {};
    let num = String(j.officeNumber || "").match(/\d+/)?.[0];
    if (!num && j.url) num = String(j.url).match(/office-(\d+)/i)?.[1];
    if (!num) return [];
    const padded = num.padStart(4, "0"); // FedEx store emails are 4-digit: usa0289@fedex.com
    return [
      {
        name: `FedEx Office #${padded}`,
        address: j.address || "",
        email: `usa${padded}@fedex.com`, // confirmed scrapable pattern
        phone: j.phone || "",
        website: j.url || "https://local.fedex.com",
      },
    ];
  } catch {
    return [];
  }
}

export async function pageMarkdown(url: string): Promise<string> {
  return (await scrape(url))?.markdown?.data || "";
}

// Floor/suite details make Google Maps pages and geocoders fail, so drop them from queries.
export const UNIT = /\s+(?:\d+(?:st|nd|rd|th) floor|(?:floor|suite|ste|unit|#)\s*\w+)/i;

// Live Google Maps listing: rating, review count, category, website, recent reviews.
// Star ratings on individual reviews are icon glyphs (\ue838), so we count them.
// Null when the page isn't this business (a results list or a different place).
export async function mapsListing(name: string, address: string) {
  if (!hasContext()) return null;
  try {
    const raw = await pageMarkdown(
      `https://www.google.com/maps/search/${encodeURIComponent(`${name} ${address.replace(UNIT, "")}`)}`
    );
    const text = raw.replace(/[\ue000-\uf8ff]/g, "");
    const title = text.match(/^# (.+)$/m)?.[1] || "";
    const tokens = name.toLowerCase().split(/\s+/).filter((t) => t.length > 3);
    if (!tokens.some((t) => title.toLowerCase().includes(t))) return null;
    const rc = text.match(/(\d\.\d)\s*\(([\d,]+)\)/) || text.match(/(\d\.\d)\s+([\d,]+) reviews/);
    if (!rc) return null;
    const reviews = [
      ...raw.split("## Reviews")[1]?.matchAll(
        /\n([^\n]{2,60})\n\n(?:[^\n]*\n\n){0,2}?(\ue838+)((?:an?|\d+) (?:day|week|month|year)s? ago)\n\n([^\n]+)/g
      ) ?? [],
    ].map((m) => ({ author: m[1], rating: m[2].length, date: m[3], text: m[4].replace(/\s*…\s*More$/, "") }));
    return {
      rating: Number(rc[1]),
      reviewCount: Number(rc[2].replace(/,/g, "")),
      category: text.match(/^([^\n·]+)·\s*$/m)?.[1]?.trim() || "Bakery",
      website: text.match(/\]\((https?:\/\/(?!(?:[\w-]+\.)?google\.)[^)\s]+)\)/)?.[1],
      reviews,
    };
  } catch {
    return null;
  }
}

// Ground the agent's recommendations in live web tactics. Returns compact
// sources the UI can cite. Safe: returns [] if no key or on any failure.
export async function researchTactics(bakeryName: string): Promise<{ url: string; title: string; description: string }[]> {
  if (!hasContext()) return [];
  try {
    const r = await search(
      `proven ways a bakery like ${bakeryName} can increase afternoon foot traffic and slow-hour sales`,
      { numResults: 4 }
    );
    const results = (r?.results || []) as any[];
    return results
      .filter((x) => x.relevance !== "low")
      .map((x) => ({ url: x.url, title: x.title, description: x.description || "" }));
  } catch {
    return [];
  }
}
