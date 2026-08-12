-- Cloudflare D1 free-runtime starter schema.
-- Full PostgreSQL lineage remains in packages/db; migrate incrementally.

create table if not exists workspace (
  id text primary key,
  slug text not null unique,
  name text not null,
  timezone text not null default 'Europe/Moscow'
);

create table if not exists hypothesis (
  id text primary key,
  workspace_id text not null references workspace(id),
  title text not null,
  statement text not null,
  status text not null,
  owner_subject_id text not null,
  starts_on text not null,
  ends_on text not null,
  primary_metric text not null,
  decision text not null default 'inconclusive'
);

create table if not exists metric_observation (
  id text primary key,
  hypothesis_id text not null references hypothesis(id),
  period_from text not null,
  period_to text not null,
  metric_key text not null,
  value real,
  source text not null,
  quality_status text not null
);

create index if not exists hypothesis_workspace_dates
  on hypothesis (workspace_id, starts_on, ends_on);

create index if not exists metric_observation_hypothesis_period
  on metric_observation (hypothesis_id, period_from, period_to);

