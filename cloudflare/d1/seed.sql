-- Safe demo seed for the public free preview. No credentials or customer data.
INSERT OR IGNORE INTO workspace (id, slug, name, timezone)
VALUES ('workspace-parkskazka', 'parkskazka', 'Park Skazka', 'Europe/Moscow');

INSERT OR IGNORE INTO hypothesis (id, workspace_id, title, statement, status, owner_subject_id, starts_on, ends_on, primary_metric, decision)
VALUES ('hypothesis-family-hook-d1', 'workspace-parkskazka', 'Hook про семейный выходной повысит intent', 'Семейный оффер с конкретным сценарием выходного увеличит лиды.', 'planned', 'github|fixture-owner', '2026-08-12', '2026-08-19', 'cost_per_lead', 'inconclusive');

INSERT OR IGNORE INTO metric_observation (id, hypothesis_id, period_from, period_to, metric_key, value, source, quality_status)
VALUES
  ('metric-family-spend-d1', 'hypothesis-family-hook-d1', '2026-08-12', '2026-08-12', 'spend', 12500, 'vk_ads', 'valid'),
  ('metric-family-impressions-d1', 'hypothesis-family-hook-d1', '2026-08-12', '2026-08-12', 'impressions', 42000, 'vk_ads', 'valid'),
  ('metric-family-clicks-d1', 'hypothesis-family-hook-d1', '2026-08-12', '2026-08-12', 'clicks', 980, 'vk_ads', 'valid'),
  ('metric-family-leads-d1', 'hypothesis-family-hook-d1', '2026-08-12', '2026-08-12', 'leads', 48, 'vk_ads', 'valid');

INSERT OR IGNORE INTO source_account (id, workspace_id, source, external_id, name)
VALUES ('account-vk-parkskazka', 'workspace-parkskazka', 'vk_ads', 'vk-account-fixture', 'Park Skazka VK Ads');

INSERT OR IGNORE INTO campaign (id, account_id, source, external_id, name)
VALUES ('campaign-summer-d1', 'account-vk-parkskazka', 'vk_ads', 'vk-campaign-fixture', 'Summer Park Visit');

INSERT OR IGNORE INTO ad_group (id, campaign_id, source, external_id, name)
VALUES ('ad-group-family-d1', 'campaign-summer-d1', 'vk_ads', 'vk-ad-group-fixture', 'Families 25-44');

INSERT OR IGNORE INTO creative (id, source, external_id, name, content_hash)
VALUES ('creative-family-d1', 'vk_ads', 'vk-creative-control-fixture', 'Control: family weekend', 'sha256:fixture-control');

INSERT OR IGNORE INTO ad (id, ad_group_id, creative_id, source, external_id, name, status)
VALUES ('ad-control-d1', 'ad-group-family-d1', 'creative-family-d1', 'vk_ads', 'vk-ad-control-fixture', 'Control rotation A', 'active');

INSERT OR IGNORE INTO source_snapshot (id, source, account_id, period_from, period_to, content_hash, schema_version, extraction_method, quality_status, fetched_at)
VALUES ('snapshot-vk-d1', 'vk_ads', 'account-vk-parkskazka', '2026-08-12', '2026-08-12', 'sha256:fixture-snapshot', 'd1-lineage-v1', 'file_import', 'valid', '2026-08-13T07:00:00Z');

