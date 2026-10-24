import fs from "fs";
import path from "path";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Bakery, Analysis, GeneratedAsset } from "./types";
import { SEED_BAKERIES } from "./seed";

// Storage abstraction: Supabase when configured, otherwise an in-memory store
// seeded with demo bakeries so the app is fully functional with zero config.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase: SupabaseClient | null = null;
if (url && key) {
  supabase = createClient(url, key, { auth: { persistSession: false } });
}

export const storageMode = supabase ? "supabase" : "memory";

// --- in-memory fallback (module-level, survives within a server instance) ---
const g = globalThis as unknown as {
  __bakeries?: Map<string, Bakery>;
  __analyses?: Map<string, Analysis>;
  __assets?: GeneratedAsset[];
};
// Local file persistence so data survives restarts without any cloud (used
// whenever Supabase isn't configured). Seeds load first, then the file overlays.
const DATA_FILE = path.join(process.cwd(), ".data", "store.json");

if (!g.__bakeries) {
  g.__bakeries = new Map(SEED_BAKERIES.map((b) => [b.id, b]));
  g.__analyses = new Map();
  g.__assets = [];
  if (!supabase) {
    try {
      const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
      for (const b of raw.bakeries ?? []) g.__bakeries.set(b.id, b);
      for (const a of raw.analyses ?? []) g.__analyses.set(a.bakeryId, a);
      g.__assets.push(...(raw.assets ?? []));
    } catch {
      /* no file yet */
    }
  }
}
const mem = { bakeries: g.__bakeries!, analyses: g.__analyses!, assets: g.__assets! };

function persist() {
  if (supabase) return; // Supabase is the source of truth when configured
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ bakeries: [...mem.bakeries.values()], analyses: [...mem.analyses.values()], assets: mem.assets })
    );
  } catch {
    /* best-effort */
  }
}

export async function listBakeries(): Promise<Bakery[]> {
  if (supabase) {
    const { data } = await supabase.from("bakeries").select("data");
    if (data && data.length) return data.map((r) => r.data as Bakery);
  }
  return [...mem.bakeries.values()];
}

export async function getBakery(id: string): Promise<Bakery | undefined> {
  if (supabase) {
    const { data } = await supabase.from("bakeries").select("data").eq("id", id).maybeSingle();
    if (data) return data.data as Bakery;
  }
  return mem.bakeries.get(id);
}

export async function saveBakery(b: Bakery): Promise<void> {
  mem.bakeries.set(b.id, b);
  if (supabase) await supabase.from("bakeries").upsert({ id: b.id, data: b });
  persist();
}

export async function getAnalysis(bakeryId: string): Promise<Analysis | undefined> {
  if (supabase) {
    const { data } = await supabase.from("analyses").select("data").eq("bakery_id", bakeryId).maybeSingle();
    if (data) return data.data as Analysis;
  }
  return mem.analyses.get(bakeryId);
}

export async function saveAnalysis(a: Analysis): Promise<void> {
  mem.analyses.set(a.bakeryId, a);
  if (supabase) await supabase.from("analyses").upsert({ bakery_id: a.bakeryId, data: a });
  persist();
}

export async function listAssets(bakeryId: string): Promise<GeneratedAsset[]> {
  if (supabase) {
    const { data } = await supabase.from("assets").select("data").eq("bakery_id", bakeryId);
    if (data) return data.map((r) => r.data as GeneratedAsset);
  }
  return mem.assets.filter((a) => a.bakeryId === bakeryId);
}

export async function saveAsset(a: GeneratedAsset): Promise<void> {
  mem.assets.push(a);
  if (supabase) await supabase.from("assets").insert({ id: a.id, bakery_id: a.bakeryId, data: a });
  persist();
}

export async function getAsset(assetId: string): Promise<GeneratedAsset | undefined> {
  const found = mem.assets.find((a) => a.id === assetId);
  if (found) return found;
  if (supabase) {
    const { data } = await supabase.from("assets").select("data").eq("id", assetId).maybeSingle();
    if (data) return data.data as GeneratedAsset;
  }
  return undefined;
}

export async function patchAssetData(assetId: string, patch: Record<string, unknown>): Promise<void> {
  const found = mem.assets.find((a) => a.id === assetId);
  if (found) found.data = { ...found.data, ...patch };
  if (supabase && found) await supabase.from("assets").update({ data: found }).eq("id", assetId);
  persist();
}

export async function latestAssetOfKind(bakeryId: string, kind: GeneratedAsset["kind"]) {
  const all = await listAssets(bakeryId);
  return all.filter((a) => a.kind === kind).slice(-1)[0];
}
