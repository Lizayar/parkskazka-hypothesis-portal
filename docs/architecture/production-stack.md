# Production stack: Cloudflare free contour with optional paid storage

Елизавета, выбранная production-связка состоит из Render web/API, Render Background Worker и Cron Job, Render Postgres, Render Key Value (Redis-compatible Valkey) и Cloudflare R2 для объектов.

## Ресурсы

- `portal-web` — публичный web foundation, слушает `HOST`/`PORT` и проходит Render health check `/`.
- `portal-api` — read-only API foundation, слушает `API_HOST`/`API_PORT`; mutations остаются `405`.
- `portal-worker` — долгоживущий foundation-процесс для будущих очередей и ingestion.
- `portal-sync-cron` — часовой foundation-запуск синхронизации; реальные адаптеры подключаются отдельным этапом.
- `portal-postgres` — канонические гипотезы, lineage, snapshots, метрики и audit records.
- `portal-kv` — очереди, locks, idempotency keys и короткоживущий runtime-кэш; политика `noeviction`, journal snapshots и закрытый public IP allow-list заданы в Blueprint.
- Cloudflare R2 — S3-compatible object storage для raw exports, креативов и артефактов sync-run без egress fee со стороны R2.

## Секреты и переменные

`render.yaml` содержит только имена и Render references. Значения вводятся в Render Dashboard/secret manager и не коммитятся:

- `DATABASE_URL` — `fromDatabase` ссылка на Render Postgres.
- `REDIS_URL` — `fromService` ссылка на Render Key Value.
- `SESSION_ENCRYPTION_KEY` — Render `generateValue`.
- `R2_ENDPOINT` — private S3 endpoint вида `https://<account-id>.r2.cloudflarestorage.com`.
- `R2_BUCKET` — имя R2 bucket.
- `R2_ACCESS_KEY_ID` — R2 access key id.
- `R2_SECRET_ACCESS_KEY` — R2 secret access key.

R2 credentials должны быть scoped только на нужный bucket и операции portal; не использовать global API token. Приложение не должно логировать URL подписанных объектов или значения env.

## Порядок первичного запуска

1. В Render создать Blueprint из `render.yaml` и выбрать Frankfurt для всех региональных ресурсов.
2. На первом prompt заполнить `R2_*` значения; Postgres и Key Value references Render свяжет автоматически.
3. Проверить `/health` API, web `/`, read-only routes и `POST` → `405`.
4. Применить миграции Postgres отдельной защищённой pre-deploy процедурой после проверки backup/PITR.
5. Включить `PORTAL_READ_BACKEND=postgres` только после замены текущего JS bridge на собранный runtime с resolver-ом `@portal/*`; сейчас blueprint оставляет `fixture`, потому что Postgres HTTP route намеренно отвечает `501`, а silent fallback запрещён.

## Что не делает этот PR

Blueprint не создаёт Render workspace, не добавляет DNS/custom domain, не вводит OAuth callback URL и не публикует секреты. Эти действия выполняются вручную после ревью стоимости, backup/PITR и OAuth домена.

## Бесплатный preview-профиль

Для тестового запуска без платёжных данных используйте `render.free.yaml`. Он создаёт только два Free Web Service, Free Postgres и Free Key Value; Worker и Cron намеренно исключены, потому что Render не предлагает им Free instance types. Такой preview не выполняет автоматическую синхронизацию рекламных кабинетов.

Ограничения Render Free: Postgres имеет 1 GB и истекает через 30 дней без backup/PITR; Key Value работает только в памяти и теряет данные при restart; Web Services могут засыпать после простоя и делят месячный лимит часов workspace. Этот профиль предназначен для проверки UI/API, а не для production.

## Постоянный бесплатный контур Cloudflare

Если нельзя принимать платёжные условия Render, используйте `wrangler.toml` и `cloudflare/pages/index.html`:

- Pages публикует static shell;
- Worker `apps/edge/src/index.ts` обслуживает read-only API и Cron Trigger;
- D1 хранит реляционные данные вместо Postgres;
- Workers KV хранит кэш/locks вместо Render Key Value;
- Для варианта без оплаты R2 не используется: Pages публикует превью, GitHub Releases хранит публичные оригиналы, а D1 хранит только metadata/manifest.

Cloudflare free runtime не требует 30-дневного удаления D1, но имеет квоты и SQLite-семантику. 12 августа 2026 созданы D1 `parkskazka-hypotheses` и KV `CACHE`, применена миграция `0001_portal_core.sql`, а Worker опубликован с fixture backend. Статическая оболочка опубликована на Pages: `https://parkskazka-hypothesis-portal.pages.dev/`. R2 bucket не создаётся, потому что Dashboard предлагает подписку с автоматическим продлением; binding `MEDIA` намеренно закомментирован. Бесплатная media policy описана в `docs/architecture/free-media-strategy.md`. До подключения D1-читателя Worker явно остаётся на fixture backend и не выполняет silent fallback.

