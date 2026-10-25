import fsp from "fs/promises";
import path from "path";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Bakery, Analysis, GeneratedAsset } from "./types";

// Storage: Supabase when configured (the multi-instance, multi-user path), otherwise one JSON
// file per record under .data/ so concurrent requests never rewrite each other's data:
//   bakeries/<id>.json  analyses/<id>.json  assets/<bakeryId>/<assetId>.json  snapshots/<bakeryId>.jsonl
// Writes are atomic (temp file + rename) and serialized per file. File mode is single-instance.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase: SupabaseClient | null = null;
if (url && key) {
  supabase = createClient(url, key, { auth: { persistSession: false } });
}

export const storageMode = supabase ? "supabase" : "file";

const DIR = process.env.FOOTFALL_DATA_DIR || path.join(process.cwd(), ".data");
const safe = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, "_");
const dir = (...parts: string[]) => path.join(DIR, ...parts.map(safe));
const file = (...parts: string[]) => `${dir(...parts)}.json`;

const locks = new Map<string, Promise<unknown>>();
// Run fn after any earlier operation on the same file finishes (read-modify-write safety).
function locked<T>(f: string, fn: () => Promise<T>): Promise<T> {
  const run = (locks.get(f) ?? Promise.resolve()).then(fn);
  const tail = run.catch(() => {});
  locks.set(f, tail);
  tail.then(() => locks.get(f) === tail && locks.delete(f));
  return run;
}

async function readJson<T>(f: string): Promise<T | undefined> {
  try {
    return JSON.parse(await fsp.readFile(f, "utf8"));
  } catch {
    return undefined;
  }
}
const writeJson = (f: string, data: unknown) =>
  locked(f, async () => {
    await fsp.mkdir(path.dirname(f), { recursive: true });
    const tmp = `${f}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
    await fsp.writeFile(tmp, JSON.stringify(data));
    await fsp.rename(tmp, f);
  });
async function readDir<T>(dir: string): Promise<T[]> {
  const names = await fsp.readdir(dir).catch(() => [] as string[]);
  const all = await Promise.all(names.filter((n) => n.endsWith(".json")).map((n) => readJson<T>(path.join(dir, n))));
  return all.filter(Boolean) as T[];
}

export type Snapshot = { at: string; rating: number; reviewCount: number; reviewsPerMonth?: number; peers: { name: string; reviewCount: number; reviewsPerMonth?: number }[] };

export async function listBakeries(): Promise<Bakery[]> {
  let stored: Bakery[];
  if (supabase) stored = ((await supabase.from("bakeries").select("data")).data ?? []).map((r) => r.data as Bakery);
  else stored = await readDir<Bakery>(dir("bakeries"));
  return stored.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
}

export async function getBakery(id: string): Promise<Bakery | undefined> {
  if (supabase) return (await supabase.from("bakeries").select("data").eq("id", id).maybeSingle()).data?.data as Bakery | undefined;
  return readJson<Bakery>(file("bakeries", id));
}

// Saving also appends a snapshot, so every (re)ingest builds the bakery's history.
export async function saveBakery(b: Bakery): Promise<void> {
  const snap: Snapshot = {
    at: new Date().toISOString(),
    rating: b.rating,
    reviewCount: b.reviewCount,
    reviewsPerMonth: b.reviewsPerMonth,
    peers: (b.peers ?? []).map(({ name, reviewCount, reviewsPerMonth }) => ({ name, reviewCount, reviewsPerMonth })),
  };
  if (supabase) {
    await supabase.from("bakeries").upsert({ id: b.id, data: b });
    await supabase.from("snapshots").insert({ bakery_id: b.id, data: snap });
    return;
  }
  await writeJson(file("bakeries", b.id), b);
  const f = `${dir("snapshots", b.id)}.jsonl`;
  await locked(f, async () => {
    await fsp.mkdir(path.dirname(f), { recursive: true });
    await fsp.appendFile(f, JSON.stringify(snap) + "\n");
  });
}

export async function listSnapshots(bakeryId: string): Promise<Snapshot[]> {
  if (supabase) {
    const { data } = await supabase.from("snapshots").select("data").eq("bakery_id", bakeryId).order("taken_at");
    return (data ?? []).map((r) => r.data as Snapshot);
  }
  const raw = await fsp.readFile(`${dir("snapshots", bakeryId)}.jsonl`, "utf8").catch(() => "");
  return raw.split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

export async function getAnalysis(bakeryId: string): Promise<Analysis | undefined> {
  if (supabase) return (await supabase.from("analyses").select("data").eq("bakery_id", bakeryId).maybeSingle()).data?.data as Analysis | undefined;
  return readJson<Analysis>(file("analyses", bakeryId));
}

export async function saveAnalysis(a: Analysis): Promise<void> {
  if (supabase) await supabase.from("analyses").upsert({ bakery_id: a.bakeryId, data: a });
  else await writeJson(file("analyses", a.bakeryId), a);
}

export async function listAssets(bakeryId: string): Promise<GeneratedAsset[]> {
  const assets = supabase
    ? ((await supabase.from("assets").select("data").eq("bakery_id", bakeryId)).data ?? []).map((r) => r.data as GeneratedAsset)
    : await readDir<GeneratedAsset>(dir("assets", bakeryId));
  return assets.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function saveAsset(a: GeneratedAsset): Promise<void> {
  if (supabase) await supabase.from("assets").insert({ id: a.id, bakery_id: a.bakeryId, data: a });
  else await writeJson(file("assets", a.bakeryId, a.id), a);
}

export async function getAsset(assetId: string, bakeryId: string): Promise<GeneratedAsset | undefined> {
  if (supabase) return (await supabase.from("assets").select("data").eq("id", assetId).maybeSingle()).data?.data as GeneratedAsset | undefined;
  return readJson<GeneratedAsset>(file("assets", bakeryId, assetId));
}

export async function patchAssetData(assetId: string, bakeryId: string, patch: Record<string, unknown>): Promise<void> {
  const f = file("assets", bakeryId, assetId);
  if (supabase) {
    const found = await getAsset(assetId, bakeryId);
    if (found) await supabase.from("assets").update({ data: { ...found, data: { ...found.data, ...patch } } }).eq("id", assetId);
    return;
  }
  // Read-modify-write under the same per-file lock the writer uses.
  await locked(f, async () => {
    const found = await readJson<GeneratedAsset>(f);
    if (found) await fsp.writeFile(f, JSON.stringify({ ...found, data: { ...found.data, ...patch } }));
  });
}

export async function latestAssetOfKind(bakeryId: string, kind: GeneratedAsset["kind"]) {
  const all = await listAssets(bakeryId);
  return all.filter((a) => a.kind === kind).slice(-1)[0];
}
