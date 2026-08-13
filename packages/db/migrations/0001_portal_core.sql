-- PostgreSQL-first foundation for Park Skazka hypothesis analytics.
-- Raw payloads remain in object storage; PostgreSQL stores lineage and canonical facts.

create table if not exists workspace (
  id uuid primary key,
  slug text not null unique,
  name text not null,
  timezone text not null default 'Europe/Moscow',
  created_at timestamptz not null default now()
);

create table if not exists source_account (
  id uuid primary key,
  workspace_id uuid not null references workspace(id),
  source text not null check (source in ('vk_ads', 'yandex_metrica', 'avito_ads', 'telegram_ads')),
  external_id text not null,
  name text not null,
  status text not null default 'active' check (status in ('active', 'paused', 'revoked')),
  unique (workspace_id, source, external_id)
);

create table if not exists campaign (
  id uuid primary key,
  account_id uuid not null references source_account(id),
  source text not null,
  object_level text not null default 'campaign' check (object_level = 'campaign'),
  external_id text not null,
  name text not null,
  settings jsonb not null default '{}',
  unique (source, account_id, object_level, external_id)
);

create table if not exists ad_group (
  id uuid primary key,
  campaign_id uuid not null references campaign(id),
  source text not null,
  object_level text not null default 'ad_group' check (object_level = 'ad_group'),
  external_id text not null,
  name text not null,
  settings jsonb not null default '{}',
  unique (source, campaign_id, object_level, external_id)
);

create table if not exists creative (
  id uuid primary key,
  source text not null,
  object_level text not null default 'creative' check (object_level = 'creative'),
  external_id text not null,
  name text not null,
  content_hash text not null,
  visual_url text,
  copy text,
  hook text,
  offer text,
  cta text,
  unique (source, external_id, content_hash)
);

create table if not exists ad (
  id uuid primary key,
  ad_group_id uuid not null references ad_group(id),
  creative_id uuid not null references creative(id),
  source text not null,
  object_level text not null default 'ad' check (object_level = 'ad'),
  external_id text not null,
  name text not null,
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  unique (source, ad_group_id, object_level, external_id)
);

create table if not exists hypothesis (
  id uuid primary key,
  workspace_id uuid not null references workspace(id),
  title text not null,
  statement text not null,
  status text not null check (status in ('draft', 'planned', 'running', 'completed', 'stopped')),
  owner_subject_id text not null,
  starts_on date not null,
  ends_on date not null,
  primary_metric text not null,
  guardrail_metrics jsonb not null default '[]'
);

create table if not exists experiment_test (
  id uuid primary key,
  workspace_id uuid not null references workspace(id),
  hypothesis_id uuid not null references hypothesis(id),
  status text not null check (status in ('draft', 'planned', 'running', 'completed', 'approved', 'stopped')),
  starts_on date not null,
  ends_on date not null,
  primary_metric text not null,
  control_creative_id uuid not null references creative(id),
  challenger_creative_ids jsonb not null default '[]'
);

create table if not exists metric_observation (
  id uuid primary key,
  test_id uuid not null references experiment_test(id),
  period daterange not null,
  calculation_version text not null,
  metric_key text not null,
  numerator numeric not null,
  denominator numeric not null,
  value numeric not null,
  source text not null,
  attribution_model text not null,
  quality_status text not null check (quality_status in ('valid', 'partial', 'invalid')),
  unique (test_id, period, calculation_version)
);

create table if not exists snapshot (
  id uuid primary key,
  source text not null,
  account_id uuid not null references source_account(id),
  period daterange not null,
  content_hash text not null,
  schema_version text not null,
  raw_object_key text not null,
  extraction_method text not null check (extraction_method in ('api', 'browser_export', 'file_import')),
  quality_status text not null check (quality_status in ('valid', 'partial', 'needs_attention', 'invalid')),
  unique (source, account_id, period, content_hash)
);

create table if not exists sync_run (
  id uuid primary key,
  source text not null,
  account_id uuid not null references source_account(id),
  requested_from date not null,
  requested_to date not null,
  status text not null check (status in ('queued', 'running', 'completed', 'partial', 'failed')),
  snapshot_ids jsonb not null default '[]',
  started_at timestamptz,
  finished_at timestamptz
);

create table if not exists measurement_run (
  id uuid primary key,
  test_id uuid not null references experiment_test(id),
  period daterange not null,
  status text not null check (status in ('queued', 'running', 'completed', 'blocked')),
  calculation_version text not null
);

create table if not exists decision (
  id uuid primary key,
  test_id uuid not null references experiment_test(id),
  outcome text not null check (outcome in ('scale', 'iterate', 'stop', 'inconclusive')),
  decided_by text not null,
  rationale text,
  created_at timestamptz not null default now()
);

create or replace function enforce_decision_test_due()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from experiment_test
    where id = new.test_id
      and status in ('approved', 'completed')
  ) then
    raise exception 'TEST_NOT_DECISION_DUE';
  end if;
  return new;
end;
$$;

drop trigger if exists decision_test_due on decision;
create trigger decision_test_due
before insert on decision
for each row execute function enforce_decision_test_due();

create table if not exists audit_event (
  id uuid primary key,
  actor_subject_id text not null,
  action text not null,
  request_id text not null,
  reason text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

