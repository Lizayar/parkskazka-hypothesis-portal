-- Normalized read-only ad lineage and snapshot provenance for the free D1 contour.
-- Raw provider payloads stay outside D1; only identifiers, labels and hashes are stored.

create table if not exists source_account (
  id text primary key,
  workspace_id text not null references workspace(id),
  source text not null,
  external_id text not null,
  name text not null,
  status text not null default 'active',
  unique (workspace_id, source, external_id)
);

create table if not exists campaign (
  id text primary key,
  account_id text not null references source_account(id),
  source text not null,
  external_id text not null,
  name text not null,
  unique (source, account_id, external_id)
);

create table if not exists ad_group (
  id text primary key,
  campaign_id text not null references campaign(id),
  source text not null,
  external_id text not null,
  name text not null,
  unique (source, campaign_id, external_id)
);

create table if not exists creative (
  id text primary key,
  source text not null,
  external_id text not null,
  name text not null,
  content_hash text not null,
  unique (source, external_id, content_hash)
);

create table if not exists ad (
  id text primary key,
  ad_group_id text not null references ad_group(id),
  creative_id text not null references creative(id),
  source text not null,
  external_id text not null,
  name text not null,
  status text not null default 'active',
  unique (source, ad_group_id, external_id)
);

create table if not exists source_snapshot (
  id text primary key,
  source text not null,
  account_id text not null references source_account(id),
  period_from text not null,
  period_to text not null,
  content_hash text not null,
  schema_version text not null,
  extraction_method text not null,
  quality_status text not null,
  fetched_at text not null,
  unique (source, account_id, period_from, period_to, content_hash)
);

create index if not exists campaign_source_account on campaign (source, account_id);
create index if not exists ad_group_campaign on ad_group (campaign_id);
create index if not exists ad_group_source on ad_group (source);
create index if not exists ad_creative_group on ad (ad_group_id, creative_id);
create index if not exists snapshot_source_period on source_snapshot (source, period_from, period_to);

