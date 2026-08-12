# Полная логика портала

## 1. Назначение и результат

Портал должен отвечать не только на вопрос «сколько потратили», но и на вопросы:

- какие кампании, группы, объявления и креативы реально доставлялись;
- какая настройка, аудитория, оффер, hook или текст связаны с результатом;
- какая гипотеза сейчас запущена, когда она дозреет и какое решение будет принято;
- что можно масштабировать, что остановить и какое следующее изменение даст новый обучающий сигнал;
- насколько данным можно доверять.

Целевой объект продукта — не график, а доказательная цепочка:

`source snapshot → normalized facts → quality verdict → hypothesis/test → measurement → decision → next iteration`.

В MVP все действия в рекламных кабинетах read-only. Портал может создавать локальные брифы, тексты, версии креативов и задания на согласование, но не меняет бюджет, ставки, таргетинг, статус или публикацию без отдельного проекта и явного подтверждения.

## 2. Пользователи и права

| Роль | Возможности |
|---|---|
| Owner | Все проекты, источники, правила метрик, роли и решения |
| Analyst | Импорт/синхронизация, фильтры, сверки, расчёты, черновики гипотез |
| Marketer | Создание и запуск гипотез, креативные версии, комментарии, решения |
| Reviewer | Проверка брифа, критериев, brand/policy gates и финальное решение |
| Viewer | Только чтение дашбордов, объектов и утверждённых замеров |
| Service account | Только scoped read-only API и планировщик, без UI-публикации |

Права задаются по workspace → brand/project → source account. Секреты принадлежат backend-коннектору, не пользователю браузера.

## 3. Навигация и экраны

### 3.1 Сводка

Верхняя панель содержит диапазон дат, источник, аккаунт, канал, цель, кампанию, группу, статус и сохранённые представления. Карточки показывают расход, показы, клики, CTR, CPC, сессии, primary conversions, CPA, revenue, ROAS, долю сопоставления и свежесть данных. Рядом — карточки «тесты, требующие решения», «аномалии», «неполные источники».

Графики строятся по дням и позволяют переключать абсолютные значения, rate и comparison. При каждом показе видны `source`, `attribution_model`, `timezone`, `data_lag`, `sampled` и freshness.

### 3.2 Журнал гипотез

Таблица с колонками: ID, название, owner, offer, channel, level, status, start/end, days left, primary metric, current effect, confidence/quality, maturity, guardrail, next action. Фильтры сохраняются в URL и в named views.

Карточка гипотезы содержит:

- обучающий вопрос и формулировку «если → то → потому что»;
- evidence до запуска и ссылку на исходный замер;
- parent object и одну `variable_under_test`;
- control/challenger и матрицу экспозиции;
- primary, diagnostic и guardrail metrics;
- baseline/control values, target delta, minimum sample и stop rules;
- список связанных объектов рекламы, креативов и компонентов;
- timeline событий, комментарии и историю решений.

### 3.3 Обозреватель рекламы

Иерархический drill-down: источник → аккаунт → кампания → группа → объявление → креатив → компонент. На каждом уровне видны текущие настройки и исторические версии. Для любого объекта доступны «показать затронувшие гипотезы», «сравнить с control», «показать ротацию» и «проверить match quality».

### 3.4 Creative Lab

Реестр креативов с превью, версиями, текстами, хук-типом, оффером, CTA, посадочной, аудиторией, форматом и policy/brand checks. Матрица покрытия показывает, какие связки `offer × audience × hook × visual × CTA` уже тестировались, какие дали сигнал и где есть пробел.

### 3.5 Ротации

Таблица ячеек ротации: группа/тест, участники, доля экспозиции, фактические показы/клики/конверсии, частота, дата начала/окончания и дисбаланс. Дисбаланс не даёт считать эффект причинным, пока не исправлен или не принят как ограничение.

### 3.6 Данные и качество

Run history по каждому источнику: статус, период, аккаунт, snapshot hash, строки, freshness, ошибки, пропуски, дубли, currency/timezone mismatch, sampled/limited data, match rate. Quarantine-строки видны отдельно и не попадают в решения.

### 3.7 Интеграции и настройки

Подключение аккаунта, scope, последнее успешное чтение, health status, доступные capabilities, расписание, backfill window, UTM mapping, цели Метрики, currency, timezone, attribution defaults и правила уведомлений.

## 4. Фильтры и диапазоны дат

Глобальный фильтр имеет presets «вчера», «последние 7/14/30 дней», «текущий месяц», «предыдущий месяц», «период теста», «custom». Custom — включительные даты `date_from/date_to`, timezone по умолчанию `Europe/Moscow`; абсолютные timestamps хранятся в UTC.

Обязательные фильтры: channel/source, account, campaign, ad group, ad, creative, creative component, offer, audience, geo, placement, objective, status, hypothesis status, experiment design, landing/UTM и owner. Фильтры должны быть composable, иметь `include/exclude`, показывать число доступных значений и не менять исходные данные.

Если дата ещё не дозрела для источника, UI показывает `provisional`, а решение блокируется до maturity policy. Пересборка последних 7 дней не затирает прошлые снимки: создаётся новый run, а mart помечает актуальную версию.

## 5. Каноническая модель

Иерархия:

`workspace → brand → offer → channel/source → account → campaign → ad_group → ad → creative → component`.

Экспериментальный контур:

`hypothesis → test → cell(control/challenger) → exposure/rotation → measurement_run → decision`.

Основные сущности и обязательные поля:

| Сущность | Ключевые поля |
|---|---|
| `source_account` | `id`, `source`, `external_id`, `timezone`, `currency`, `capabilities`, `status` |
| `campaign` | `id`, `account_id`, `external_id`, `name`, `objective`, `budget`, `status`, `settings_json`, `valid_from/to` |
| `ad_group` | `campaign_id`, `external_id`, `audience_json`, `targeting_json`, `placement_json`, `bid_json` |
| `ad` | `ad_group_id`, `external_id`, `status`, `destination`, `utm_set`, `creative_id` |
| `creative` | `id`, `version`, `format`, `asset_hash`, `copy`, `hook_id`, `cta_id`, `offer_id`, `landing_id`, `policy_status` |
| `hypothesis` | `id`, `statement`, `learning_question`, `owner`, `status`, `level`, `variable_under_test`, `start_at`, `end_at`, `decision_at` |
| `test_cell` | `test_id`, `label`, `control`, `object_ids`, `allocation_target`, `allocation_actual` |
| `metric_definition` | `key`, `kind`, `numerator`, `denominator`, `source_semantics`, `window`, `direction` |
| `metric_observation` | `entity_id`, `period`, `metric_key`, `numerator`, `denominator`, `value`, `source`, `attribution_context` |
| `snapshot` | `source`, `account`, `requested_period`, `extracted_at`, `schema_version`, `content_hash`, `storage_uri`, `quality_status` |
| `measurement_run` | `test_id`, `period`, `snapshot_ids`, `quality_status`, `maturity`, `calculation_version`, `result_json` |
| `decision` | `test_id`, `outcome`, `effect`, `confidence`, `guardrail_result`, `reason`, `decided_by`, `decided_at` |
| `audit_event` | `actor`, `action`, `entity`, `before_hash`, `after_hash`, `created_at`, `request_id` |

История настроек и креативов append-only: новое состояние получает новую версию, а не изменяет старое.

## 6. Жизненный цикл гипотезы

`draft → ready_for_review → approved → scheduled → running → measuring → decision_due → scale | iterate | stop | continue | inconclusive → archived`.

Правила переходов:

- `draft`: можно редактировать всё, но нет запуска;
- `ready_for_review`: заданы primary, guardrails, baseline/control, срок, owner, variable и критерии;
- `approved`: reviewer подтвердил дизайн и brand/policy checks;
- `running`: есть факт доставки и зафиксирован старт;
- `measuring`: тест завершил период, но данные ещё дозревают;
- `decision_due`: gates пройдены, доступно решение;
- `scale`: primary достиг target, guardrails pass, match/quality pass;
- `iterate`: сигнал есть, но требуется следующая изменяемая переменная;
- `stop`: отрицательный эффект или safety stop;
- `continue`: зрелость/объём не достигнут;
- `inconclusive`: данные недостаточны, конфликтуют или контроль невалиден.

Создание гипотезы требует шаблона:

```text
Если [изменим одну переменную X] для [объект/аудитория],
то [primary metric] изменится на [target delta] за [window],
потому что [механизм/инсайт].
```

До запуска записываются `impact`, `confidence`, `ease` по 1–10 для ICE-приоритета. ICE определяет порядок тестов, но никогда не считается доказательством эффекта.

## 7. Дизайн тестов и ротации

Поддерживаемые дизайны: `randomized_split`, `holdout`, `rotation_within_group`, `geo_split`, `time_split`, `observational`.

Для ротации внутри группы:

1. фиксируются исходные настройки группы, бюджет, аудитория, placement и landing;
2. создаётся control и один challenger, изменяется ровно одна основная переменная;
3. записываются целевая и фактическая доли экспозиции, eligibility и время входа/выхода каждого объявления;
4. одинаковые периоды дозревания исключают первые часы после запуска и поздние конверсии по measurement policy;
5. эффект считается только при достаточной экспозиции обеих ячеек и отсутствии крупных изменений бюджета/таргетинга;
6. если платформа сама перераспределяет показы, это фиксируется как `delivery_bias`, а причинный вывод блокируется или маркируется observational.

Генерация replacement batch допускается только для подтверждённо слабого креатива: ровно A/B/C, общий parent, одна переменная на вариант, разные диагностические объяснения, отсутствие semantic duplicates и ручное согласование.

## 8. Правила оценки

Оценщик выполняет gates в порядке:

1. `source completeness` — все обязательные снимки получены;
2. `identity/match` — расход и конверсии связаны с объектами;
3. `freshness/lag` — дата не нарушает окно дозревания;
4. `maturity` — выполнены минимальные дни/показы/клики/расход/конверсии;
5. `control validity` — контроль и challenger сопоставимы;
6. `guardrails` — нет safety stop;
7. `effect` — абсолютная и относительная разница;
8. `confidence` — статистическая или байесовская оценка только при достаточном дизайне и объёме.

Нельзя принимать `scale`, если любой критичный gate имеет `fail`. Если данных мало, итог только `continue` или `inconclusive`.

Минимальная запись результата:

```json
{
  "primary": {"metric": "cpa_primary", "control": 1200, "challenger": 960, "delta_pct": -20},
  "guardrails": [{"metric": "quality_rate", "status": "pass"}],
  "maturity": {"status": "pass", "days": 7, "clicks": 430},
  "quality": {"status": "pass", "match_rate": 0.94, "freshness_hours": 18},
  "design": "randomized_split",
  "recommendation": "scale"
}
```

## 9. Метрики и атрибуция

Портал хранит числители и знаменатели. CTR, CVR, CPA, CPM и ROAS пересчитываются после агрегации; среднее арифметическое дневных CTR не используется.

Контексты атрибуции не смешиваются:

- `platform_reported`: конверсии и стоимость как считает рекламная платформа;
- `utm_metrica_last_sign`: визит/цель Метрики по последнему значимому источнику;
- `utm_metrica_first_sign`: первое значимое касание для диагностических отчётов;
- `cross_device`: только если включено и раскрыто источником;
- `view_through`: отдельное поле и отдельное окно, не прибавляется к click-through без явного правила.

Join keys: `source`, `account_external_id`, campaign/ad/group external IDs, UTM set, landing, event timestamp and normalized naming map. Каждый расчёт хранит `attribution_model`, `conversion_window`, `timezone`, `source_snapshot_ids`, `match_rate` и `data_lag`.

## 10. Pipeline данных

1. Scheduler создаёт idempotent `sync_run` по источнику, аккаунту и периоду.
2. Connector получает metadata, settings, delivery stats и creative payload в пределах capabilities.
3. Raw writer сохраняет неизменяемый JSON/CSV/XLSX snapshot с hash и schema version.
4. Validator проверяет типы, период, валюту, timezone, обязательные поля, дубли и контрольные totals.
5. Normalizer переводит объекты в каноническую схему и сохраняет `raw_payload`.
6. Identity resolver сопоставляет external IDs, UTM, naming map и вручную подтверждённые исключения.
7. Mart builder строит daily facts и агрегаты по уровням и фильтрам.
8. Quality service присваивает `pass`, `warning`, `fail`, `quarantine`.
9. Evaluator пересчитывает зрелые тесты и создаёт decision due/alert.
10. Notification service отправляет digest, ошибки, истечение теста и требующие решения гипотезы.

Повторный запуск с тем же `source/account/period/schema/content_hash` не создаёт дубль. Новый ответ сохраняется как новый snapshot и связывается с предыдущим через `supersedes`.

## 11. API портала

Backend REST API (внешний контракт можно заменить на GraphQL позже):

```text
GET  /api/v1/summary
GET  /api/v1/facts
GET  /api/v1/campaigns/:id/tree
GET  /api/v1/creatives/:id/lineage
GET  /api/v1/rotations
GET  /api/v1/hypotheses
POST /api/v1/hypotheses
PATCH /api/v1/hypotheses/:id
POST /api/v1/hypotheses/:id/approve
POST /api/v1/tests/:id/measure
POST /api/v1/tests/:id/decision
GET  /api/v1/data-quality/runs
POST /api/v1/sync-runs
GET  /api/v1/integrations/capabilities
```

API принимает `date_from`, `date_to`, `timezone`, `filters[]`, `attribution_model`, `comparison`, `page`, `sort` и возвращает `data_freshness`, `quality_summary`, `calculation_version` и pagination cursor.

## 12. Техническая архитектура

- Frontend: Next.js/React, TypeScript, server-side data fetching, table virtualization, URL-driven filters.
- Backend: TypeScript service с модульными adapters, REST API, RBAC and audit middleware.
- Canonical store: PostgreSQL; raw payload — JSONB, факты — типизированные таблицы, расчёты — versioned marts/materialized views.
- Object storage: S3-compatible bucket для snapshots и ассетов; в БД хранится URI, hash и metadata.
- Queue: Redis + durable jobs или managed queue для sync, normalization, backfill и evaluation.
- Scheduler: cron/managed scheduler; ручной запуск доступен через UI с idempotency key.
- Observability: structured logs without secrets, metrics for sync latency/rows/match rate, traces by `run_id`, alerting on quality fail.

Frontend не обращается к рекламным API напрямую. Только backend service account с минимальным read scope. Токены — secret manager, rotation, encryption at rest, redaction in logs.

## 13. История и аудит

Нельзя удалять snapshots, metric observations, test exposure и decisions физически в обычном UI. Исправление делается новой версией с причиной и ссылкой на исходную запись. Любое изменение гипотезы после `approved` создаёт audit event и переводит её обратно на review.

## 14. Уведомления

События: sync failed, source stale, match rate below threshold, data quality fail, test maturity reached, decision due, guardrail breach, rotation imbalance, creative fatigue, duplicate hypothesis and expiring credentials. Каналы: in-app first; Telegram/email/webhook подключаются после настройки безопасности.

## 15. Приёмка MVP

- Один workspace и один brand Park Skazka.
- Два источника с полноценным read-only коннектором или импортом: VK Ads и Яндекс Метрика; Avito и Telegram — capability-gated adapters.
- Сводка и drill-down до ad/creative.
- Custom date range, saved filters and URL sharing.
- Создание/approval/run/measurement/decision для гипотезы.
- Один control и один challenger, одна переменная, финальная карточка decision.
- Идемпотентный ручной sync, raw snapshot, quality checks, audit and test fixtures.
- Нет секретов в Git, UI не содержит mutation endpoint для рекламных кабинетов.


