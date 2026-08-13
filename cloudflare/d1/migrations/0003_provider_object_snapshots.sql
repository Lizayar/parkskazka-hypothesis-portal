-- Normalized provider rows for the read-only ingestion boundary.
-- This table deliberately stores identifiers, labels, lineage references and metrics only;
-- raw provider payloads remain outside D1.

create table if not exists provider_object_snapshot (
  snapshot_id text not null references source_snapshot(id),
  source text not null,
  account_id text not null,
  object_level text not null,
  external_id text not null,
  name text not null,
  parent_external_id text,
  campaign_external_id text,
  ad_group_external_id text,
  ad_external_id text,
  channel_external_id text,
  content_hash text,
  row_date text,
  metric_json text,
  primary key (snapshot_id, object_level, external_id)
);

create index if not exists provider_object_source_external
  on provider_object_snapshot (source, account_id, object_level, external_id);

create index if not exists provider_object_snapshot_parent
  on provider_object_snapshot (snapshot_id, parent_external_id);

