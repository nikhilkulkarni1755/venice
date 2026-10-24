# FootfallAI — agent instructions & conventions

Foot-traffic growth agent for local bakeries. Reads Google foot-traffic + sales,
finds the biggest revenue leak (usually the afternoon lull), then generates the
assets to fix it: posters, Google Business copy, a deployable website, TikToks.

## Stack
- Next.js 15 (App Router, TS) + Tailwind. Single app; API routes under `app/api/*`.
- SVG charts are hand-rolled in `components/Charts.tsx` (no chart dep).
- Everything degrades gracefully: with **zero** env keys the app runs on seeded
  demo data + deterministic analytics. Keys upgrade each capability to live.

## Provider wrappers (one module per sponsor — never scatter calls)
- `lib/context.ts` — **Context.dev** web-data layer. Key: `CONTEXT_DEV_API_KEY` (server-only).
  - `search()` → `POST /web/search` — https://docs.context.dev/api-reference/web-scraping/search
  - `scrape()` → `POST /web/scrape` — https://docs.context.dev/api-reference/web-scraping/scrape
  - `answers()` → `POST /web/answers` — https://docs.context.dev/api-reference/web-extraction/answers
  - `styleguide()` → `GET /web/styleguide` — https://docs.context.dev/api-reference/brand-intelligence/styleguide
  - `retrieveBrand()` → `POST /brand/retrieve` — https://docs.context.dev/api-reference/brand-intelligence/brand
  - `researchTactics()` grounds recommendations in live sources (used in `lib/analyze.ts`).
  - Base `https://api.context.dev/v1`, Bearer auth, retries 429 (Retry-After) + 5xx/408.
- `lib/store.ts` — Supabase (persistence) w/ in-memory fallback.
- `lib/analyze.ts` — Anthropic brain w/ deterministic analytics fallback.
- `lib/omnara.ts` — agent-run logging/monitoring.
- `lib/ingest.ts` — bakery profile (Firecrawl optional + generated fallback).
- `lib/print.ts` — print-ready color PDF of the poster (pdf-lib) + print-order
  email draft. `context.findFedExOffice()` (Answers API) locates the nearest
  FedEx Office and derives its store email `usaNNNN@fedex.com`; `app/api/print`
  orchestrates. We standardized on FedEx Office: empirically the only chain whose
  per-store email is reliably published AND derivable from the office number
  (office-4095 -> usa4095@fedex.com). USPS has no store emails / emailed jobs.

## Conventions
- API keys are server-only. Never import a key into a client component.
- Each integration checks for its key and no-ops/falls back if absent.
- Keep code minimal; reuse existing helpers.
