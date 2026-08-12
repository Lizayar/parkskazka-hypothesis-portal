# Матрица интеграций

Статусы ниже описывают архитектурную готовность, а не подтверждённый доступ к аккаунтам Park Skazka. Перед реализацией каждый адаптер проходит discovery с реальным кабинетом, scope, rate limit и тестовым периодом.

| Источник | Что собирать | Основной маршрут | Fallback | Ограничения/решение |
|---|---|---|---|---|
| VK Ads | account, campaigns, ad groups, ads/banners, statuses, targeting/settings, creative text/assets, spend, impressions, clicks, conversions, placements | официальный доступный API/экспорт после capability spike | CSV/XLSX export с schema validator | не фиксировать endpoint и поля до подтверждения конкретного кабинета; только read-only |
| Яндекс Метрика | visits, sources/UTM, goals, revenue, attribution dimensions, time series, raw logs при необходимости | Reports API (`/stat/v1/data`, `/bytime`) и Logs API | CSV export из интерфейса | OAuth; Logs API не отдаёт текущий неполный день; учитывать sampling, data lag и квоты |
| Авито Реклама | account, campaigns, groups, creatives, statuses, budget/price metadata, views, clicks and campaign statistics | Avito Ads API / official SDK-compatible adapter | CSV/XLSX/manual export | exact limits and available fields validate against account documentation; no mutation in MVP |
| Telegram Ads | ads, text, destination, target channels, CPM, budget, views, joins/bot starts, status, statistics | capability spike: публичный read API не считать гарантированным | approved manual export or browser-assisted read-only import | official flow uses Telegram channel/bot destination; external `parkskazka.com` is not a default valid destination |

## Общий adapter contract

Каждый adapter реализует:

```text
discover_capabilities(account) -> capabilities
list_objects(account, level, cursor) -> raw pages
get_settings(account, object_ids, as_of) -> raw settings
get_stats(account, level, period, breakdown) -> raw facts
health(account) -> auth, rate_limit, freshness
```

Результат содержит `provider`, `account_external_id`, `requested_period`, `extracted_at`, `timezone`, `currency`, `schema_version`, `raw_payload`, `warnings` и `source_url_or_export_id` без токенов.

## Официальные контракты, которые влияют на реализацию

- [API Яндекс Метрики](https://yandex.ru/dev/metrika/ru/) предоставляет API управления, отчётов, импорта и Logs API; [Reports API](https://yandex.ru/dev/metrika/ru/stat/openapi/data) поддерживает dimensions/metrics и JSON/CSV, а [Logs API](https://yandex.ru/dev/metrika/ru/logs/) предназначен для неагрегированных данных и имеет задержку по текущему дню.
- [Avito Ads SDK](https://github.com/avito-tech/avito-ads-sdk-go) показывает отдельные сервисы для кампаний, групп, креативов и статистики, OAuth2 client credentials и production/sandbox; фактический scope нужно проверить на аккаунте.
- [Telegram Ads Getting Started](https://ads.telegram.org/getting-started) официально описывает Statistics tab и назначение рекламы на Telegram-канал/бот; [guidelines](https://ads.telegram.org/guidelines) ограничивают текст 160 символами. Поэтому сайт Park Skazka должен быть связан с Telegram destination через отдельную измеримую цепочку.

