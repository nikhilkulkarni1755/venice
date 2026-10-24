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
