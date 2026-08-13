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

