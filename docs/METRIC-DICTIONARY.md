# Словарь метрик

## Базовые факты

| Ключ | Формула/значение | Назначение |
|---|---|---|
| `spend` | сумма фактических расходов | бюджет и CPA/ROAS |
| `impressions` | показы | delivery и зрелость |
| `reach` | уникальный охват, если доступен | охват |
| `frequency` | `impressions / reach` | усталость |
| `clicks` | клики в смысле источника | верх воронки |
| `outbound_clicks` | переходы на внешний ресурс | качество CTA/ссылки |
| `sessions` | визиты Метрики по контексту атрибуции | постклик |
| `engaged_sessions` | визиты, прошедшие заданный quality rule | качество трафика |
| `conversions_primary` | достижения primary goal | бизнес-результат |
| `conversions_diagnostic` | диагностические цели | объяснение воронки |
| `revenue` | доход с указанной модели атрибуции | ценность |

## Производные

| Ключ | Формула | Примечание |
|---|---|---|
| `ctr` | `clicks / impressions` | считать из сумм |
| `outbound_ctr` | `outbound_clicks / impressions` | отдельно от platform CTR |
| `cpm` | `spend / impressions * 1000` | валюта аккаунта |
| `cpc` | `spend / clicks` | ноль кликов → `null` |
| `cvr` | `conversions / sessions` или `conversions / clicks` | знаменатель обязателен в названии контекста |
| `cpa` | `spend / conversions` | primary/diagnostic явно разделены |
| `roas` | `revenue / spend` | одинаковые валюты и окно |
| `match_rate_spend` | matched spend / total spend | не качество рекламы, а качество join |
| `maturity_score` | min по нормализованным gates | не заменяет статусы gates |
| `effect_abs` | challenger − control | направление зависит от metric direction |
| `effect_pct` | `(challenger/control) − 1` | control=0 → `null` |

## Правила

- Нулевые знаменатели дают `null`, а не `0`.
- Rate не усредняется по дням без взвешивания знаменателем.
- Стоимость, доход и конверсии всегда хранятся с currency, attribution model и window.
- Источник сообщает семантику клика/конверсии; портал не переименовывает platform metric в универсальную без mapping.
- Дневные и сквозные значения вычисляются из фактов одной версии расчёта.

## Рекомендуемые gates по умолчанию

Это стартовые значения для конфигурации, а не универсальная истина: минимум 3 полных дня, 1 000 показов, 100 кликов или 3 primary conversions; для дорогих/редких конверсий gate задаётся вручную. Safety stop может сработать раньше при превышении CPA, жалобах, policy fail или критичной поломке посадочной.


