-- FootfallAI schema. Paste into Supabase → SQL Editor → Run.
-- We talk to these with the service_role key (server-only), which bypasses RLS,
-- so no policies are needed for the demo. Each table is a simple jsonb store
-- matching lib/store.ts.

create table if not exists bakeries (
  id          text primary key,
  data        jsonb not null,
  created_at  timestamptz default now()
);

create table if not exists analyses (
  bakery_id   text primary key,
  data        jsonb not null,
  updated_at  timestamptz default now()
);

create table if not exists assets (
  id          text primary key,
  bakery_id   text not null,
  data        jsonb not null,
  created_at  timestamptz default now()
);

create index if not exists assets_bakery_idx on assets (bakery_id);

-- One row per (re)ingest: review counts + peers over time (feeds velocity validation).
create table if not exists snapshots (
  id          bigserial primary key,
  bakery_id   text not null,
  taken_at    timestamptz default now(),
  data        jsonb not null
);

create index if not exists snapshots_bakery_idx on snapshots (bakery_id, taken_at);
