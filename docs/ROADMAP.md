# Roadmap разработки

## Этап 0 — discovery и measurement contract

Результат: подтверждённые аккаунты, scopes, timezone/currency, цели Метрики, UTM naming, доступные разрезы, лимиты API, согласованные primary/guardrail gates и Telegram destination.

Приёмка: capability matrix заполнена реальными ответами/экспортами, secrets не сохраняются, есть fixture на каждый источник.

## Этап 1 — MVP data foundation

PostgreSQL schema, raw snapshots, adapter contract, VK/Метрика adapters или validated imports, Avito/Telegram capability-gated stubs, idempotent runs, quality layer, daily facts and basic REST API.

Приёмка: повторный sync не создаёт дублей, период и timezone проверяются, stale/partial/fail не попадают в decision mart.

## Этап 2 — портал и журнал гипотез

Dashboard, date range, filters, saved views, campaign tree, creative registry, hypothesis CRUD, approval, audit, comments and notifications.

Приёмка: пользователь создаёт гипотезу от наблюдения до approved, видит связанные объекты и историю данных.

## Этап 3 — тестовый контур

Control/challenger, rotation cells, exposure balance, maturity gates, metric evaluator, measurement runs, decision card, `scale/iterate/stop/continue/inconclusive`.

Приёмка: fixture с одной ротацией выдаёт ожидаемый effect, guardrail and quality verdict; invalid control блокирует scale.

## Этап 4 — креативная итерация

Hook/copy/visual/CTA/offer matrix, semantic duplicate detection, replacement batch A/B/C, brand/policy checklist, локальные брифы и ассеты без автопубликации.

Приёмка: подтверждённо слабый креатив создаёт ровно три диагностических варианта с parent lineage и одной переменной.

## Этап 5 — эксплуатация и масштабирование

Managed scheduler, backfill, source health, anomaly detection, ClickHouse/warehouse при росте объёма, SSO/SCIM при необходимости, cost controls and retention policies.

## После MVP, отдельное решение

Изменение ставок, бюджета, таргетинга, статусов и публикация в кабинеты не включаются автоматически. Для этого потребуется отдельный threat model, approval workflow, dry-run, rollback, dual control и новая ADR.


