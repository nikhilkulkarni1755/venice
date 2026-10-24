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
if (!g.__bakeries) {
  g.__bakeries = new Map(SEED_BAKERIES.map((b) => [b.id, b]));
  g.__analyses = new Map();
  g.__assets = [];
}
const mem = { bakeries: g.__bakeries!, analyses: g.__analyses!, assets: g.__assets! };

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
}

export async function latestAssetOfKind(bakeryId: string, kind: GeneratedAsset["kind"]) {
  const all = await listAssets(bakeryId);
  return all.filter((a) => a.kind === kind).slice(-1)[0];
}
