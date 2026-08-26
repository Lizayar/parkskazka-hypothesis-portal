import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const sourceDir = path.resolve(process.argv[2] ?? "");
const siteDir = path.resolve(process.argv[3] ?? "site");

if (!process.argv[2]) {
  throw new Error("Usage: node tools/build-vk-audit-site.mjs <snapshot-dir> [site-dir]");
}

const readJson = async (name) => JSON.parse(await readFile(path.join(sourceDir, name), "utf8"));
const readText = async (name) => readFile(path.join(sourceDir, name), "utf8");
const clean = (value) => value?.replaceAll('\\"', '"').replace(/\s+/g, " ").trim() || null;
const excludedCampaignIds = new Set([
  "1221944",
  "1898108",
  "16109752",
  "16262003",
  "17138676",
  "17416462",
  "17558021",
  "17558098",
  "17810751",
  "17931142",
]);
const moneyNumber = (value) => {
  if (!value) return null;
  const parsed = Number(value.replace(/\s/g, "").replace(",", ".").replace("₽", ""));
  return Number.isFinite(parsed) ? parsed : null;
};
const decimalNumber = (value) => {
  if (!value || value === "not_observed") return null;
  const parsed = Number(String(value).replace(/\s/g, "").replace(",", ".").replace("₽", ""));
  return Number.isFinite(parsed) ? parsed : null;
};
const integerNumber = (value) => {
  if (!value || value === "not_observed" || !/^\d[\d\s]*$/.test(String(value))) return null;
  const parsed = Number(String(value).replace(/\s/g, ""));
  return Number.isSafeInteger(parsed) ? parsed : null;
};
const formatInteger = (value) => value.toLocaleString("ru-RU").replace(/[\u00a0\u202f]/g, " ");
const formatMoney = (value) => `${value.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/[\u00a0\u202f]/g, " ")} ₽`;
const formatRate = (value) => value.toFixed(2).replace(".", ",");

function splitDeliveryCounts(impressionChunk, clickChunk, spend, cpc, ctr) {
  const tokens = `${impressionChunk ?? ""} ${clickChunk ?? ""}`.trim().split(/\s+/).filter(Boolean);
  const groupedNumber = (parts) => parts.length > 0 && /^\d{1,3}$/.test(parts[0]) && parts.slice(1).every((part) => /^\d{3}$/.test(part));
  const spendValue = moneyNumber(spend);
  const cpcValue = moneyNumber(cpc);
  const ctrValue = decimalNumber(ctr);
  const candidates = [];

  for (let index = 1; index < tokens.length; index += 1) {
    const impressionTokens = tokens.slice(0, index);
    const clickTokens = tokens.slice(index);
    if (!groupedNumber(impressionTokens) || !groupedNumber(clickTokens)) continue;
    const impressions = Number(impressionTokens.join(""));
    const clicks = Number(clickTokens.join(""));
    let score = 0;
    if (cpcValue !== null && spendValue !== null) {
      score += clicks > 0 && cpcValue > 0
        ? Math.abs((spendValue / clicks) - cpcValue) / cpcValue
        : clicks === 0 && cpcValue === 0 ? 0 : 1_000;
    }
    if (ctrValue !== null && impressions > 0) {
      const calculatedCtr = clicks / impressions * 100;
      score += Math.abs(calculatedCtr - ctrValue) / Math.max(ctrValue, 0.01);
    }
    candidates.push({ impressions, clicks, score });
  }

  return candidates.sort((left, right) => left.score - right.score)[0] ?? null;
}

const files = await readdir(sourceDir);
const active = await readJson("active-audit-records.json");
const summaries = await readJson("active-summaries.json");
const campaignIds = (await readText("vk-full-campaign-ids.txt")).trim().split(/\r?\n/).filter(Boolean)
  .filter((campaignId) => !excludedCampaignIds.has(campaignId));
const groupPairs = (await readText("vk-full-group-pairs.txt")).trim().split(/\r?\n/).filter(Boolean)
  .map((row) => {
    const [groupId, campaignId] = row.split("|");
    return { groupId, campaignId };
  })
  .filter(({ campaignId }) => !excludedCampaignIds.has(campaignId));
const adTriples = (await readText("vk-full-ad-triples.txt")).trim().split(/\r?\n/).filter(Boolean)
  .map((row) => {
    const [adId, groupId, campaignId] = row.split("|");
    return { adId, groupId, campaignId };
  })
  .filter(({ campaignId }) => !excludedCampaignIds.has(campaignId));

const activeCampaignById = new Map(active.campaigns.map((item) => [String(item.campaign_id), item]));
const campaignStatsById = new Map(active.campaignStatsLife.map((item) => [String(item.campaign_id), item]));
const activeGroupById = new Map(active.groups.map((item) => [String(item.group_id), item]));
const groupSummaryById = new Map(summaries.groupSummary.map((item) => [String(item.id), item]));
const activeAdById = new Map(active.ads.map((item) => [String(item.ad_id), item]));
const adSummaryById = new Map(summaries.adSummary.map((item) => [String(item.id), item]));

function hierarchyNames(snapshot) {
  const ignored = new Set([
    "Close", "More", "Сохранить", "Отмена", "Создать", "Действия", "Очистить поле",
    "Показать календарь", "Почему?", "Подробнее", "Перейти", "Пост", "В колонке",
    "Полноэкранный блок", "Нативный блок", "Ролик в видео", "Посмотреть на площадке",
    "Добавить ещё объявление", "Заменить",
  ]);
  const matches = [...snapshot.matchAll(/- button "((?:\\"|[^"])*)" \[ref=[^\]]+\](?: \[cursor=pointer\])?/g)]
    .map((match) => clean(match[1]))
    .filter((value) => value && !ignored.has(value) && !/^\d{2}\.\d{2}/.test(value));
  return [...new Set(matches)];
}

function editorTitle(snapshot) {
  return clean(snapshot.match(/\[box=463,87,[^\]]+\]: ([^\r\n]+)/)?.[1]);
}

function paragraphAfter(snapshot, label) {
  const index = snapshot.indexOf(label);
  if (index < 0) return null;
  const excerpt = snapshot.slice(index, index + 1400);
  return clean(excerpt.match(/- paragraph[^:\r\n]*: ([^\r\n]+)/)?.[1]);
}

function genericAfter(snapshot, label, maxLength = 700) {
  const index = snapshot.indexOf(label);
  if (index < 0) return null;
  const excerpt = snapshot.slice(index, index + maxLength);
  const values = [...excerpt.matchAll(/- generic(?: \[[^\]]+\])*: ([^\r\n]+)/g)]
    .map((match) => clean(match[1]))
    .filter((value) => value && value !== "*" && !/^\d+ \/ \d+$/.test(value));
  return values.at(-1) ?? null;
}

function linkFrom(snapshot) {
  return snapshot.match(/textbox "Рекламируемая страница сайта"[^:\r\n]*: ([^\r\n]+)/)?.[1]
    ?? snapshot.match(/- \/url: (https:\/\/parkskazka\.com\/[^\r\n]*)/)?.[1]
    ?? null;
}

function parseUtm(url) {
  if (!url) return {};
  try {
    const parsed = new URL(url);
    return Object.fromEntries([...parsed.searchParams.entries()].filter(([key]) => key.startsWith("utm_")));
  } catch {
    return {};
  }
}

function extractVisibleSettings(snapshot, labels) {
  const output = {};
  for (const label of labels) {
    const index = snapshot.indexOf(label);
    if (index < 0) continue;
    const excerpt = snapshot.slice(index, index + 900)
      .split(/\r?\n/)
      .map((line) => clean(line.match(/: ([^\r\n]+)/)?.[1]))
      .filter((value) => value && value !== label && !value.startsWith("/") && value !== "*");
    output[label] = [...new Set(excerpt)].slice(0, 8).join(" · ") || "not_observed";
  }
  return output;
}

function parseAdMetricRows() {
  const rows = new Map();
  const snapshotFiles = files.filter((name) => /^vk-full-ads-(window|pass2)-.*\.md$/.test(name));
  return Promise.all(snapshotFiles.map(async (name) => {
    const text = await readText(name);
    for (const line of text.split(/\r?\n/)) {
      const triple = line.match(/([0-9]{8,9}) ([0-9]{8,9}) ([0-9]{7,8})"/);
      if (!triple) continue;
      const raw = clean(line.match(/- row "(.*)"/)?.[1]);
      if (!raw) continue;
      const [adId, groupId, campaignId] = triple.slice(1);
      const prefix = raw.replace(new RegExp(`\\s+${adId} ${groupId} ${campaignId}$`), "");
      const monies = [...prefix.matchAll(/([\d\s]+,\d{2}) ₽/g)];
      const delivery = prefix.match(/(\d{2}\.\d{2}\.\d{2})\s+(Принято|Отклонено|На проверке)\s+([\d\s]+)\s+([\d\s]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d\s]+,\d{2} ₽)/);
      const spend = monies[1]?.[0] ?? null;
      const counts = splitDeliveryCounts(delivery?.[3], delivery?.[4], spend, delivery?.[7], delivery?.[6]);
      const impressions = counts ? formatInteger(counts.impressions) : null;
      const clicks = counts ? formatInteger(counts.clicks) : null;
      const spendNumber = moneyNumber(spend);
      const impressionNumber = counts?.impressions ?? null;
      rows.set(adId, {
        result: monies[0] ? clean(prefix.slice(0, monies[0].index)) : "not_observed",
        result_cost: monies[0]?.[0] ?? "not_observed",
        spend: spend ?? "not_observed",
        created: delivery?.[1] ?? "not_observed",
        moderation: delivery?.[2] ?? "not_observed",
        impressions: impressions ?? "not_observed",
        clicks: clicks ?? "not_observed",
        cr: delivery?.[5] ?? "not_observed",
        ctr: delivery?.[6] ?? "not_observed",
        cpc: delivery?.[7] ?? "not_observed",
        cpm: spendNumber !== null && impressionNumber ? `${(spendNumber / impressionNumber * 1000).toFixed(2).replace(".", ",")} ₽` : "not_observed",
        raw: prefix,
      });
    }
  })).then(() => rows);
}

const adMetrics = await parseAdMetricRows();

const campaigns = [];
for (const campaignId of campaignIds) {
  const snapshot = await readText(`campaign-detail-${campaignId}.md`);
  const activeRecord = activeCampaignById.get(campaignId);
  const stats = campaignStatsById.get(campaignId);
  const names = hierarchyNames(snapshot);
  const name = activeRecord?.campaign_name ?? stats?.campaign_name ?? editorTitle(snapshot) ?? names[0] ?? `Кампания ${campaignId}`;
  const settings = extractVisibleSettings(snapshot, ["Какой формат будете использовать?", "Рекламируемый объект", "Целевое действие", "Даты показа", "Настроить частоту показов"]);
  const status = stats?.status ?? "Не транслируется";
  const isActive = status === "Транслируется";
  const namingOk = /_(0826|holidays|corporate)$/.test(name);
  campaigns.push({
    id: campaignId,
    name,
    status,
    active: isActive,
    promotion_object: activeRecord?.promotion_object ?? settings["Рекламируемый объект"] ?? "not_observed",
    destination: activeRecord?.destination ?? snapshot.match(/- \/url: (https?:\/\/[^\r\n]+)/)?.[1] ?? "not_observed",
    pixel_id: activeRecord?.pixel_id ?? snapshot.match(/ID пикселя: (\d+)/)?.[1] ?? "not_observed",
    target_action: activeRecord?.target_action ?? settings["Целевое действие"] ?? "not_observed",
    budget: activeRecord?.campaign_budget ?? stats?.budget ?? "Бюджет группы",
    start_date: activeRecord?.start_date ?? stats?.start_date ?? "not_observed",
    end_date: activeRecord?.end_date ?? stats?.end_date ?? "not_observed",
    spend: stats?.spend ?? "0,00 ₽",
    impressions: stats?.impressions ?? "0",
    clicks: stats?.clicks ?? "0",
    ctr: stats?.ctr ?? "0",
    cpc: stats?.cpc ?? "not_observed",
    naming_ok: namingOk,
    decision: !isActive ? "остановить" : namingOk ? "оставить" : "переработать",
    rationale: !isActive ? "Устаревшая или остановленная структура; не возвращать в открутку без новой гипотезы." : namingOk ? "Рабочая структура; бизнес-экономика требует свежей LIME-атрибуции." : "Название не описывает цель и период по принятому naming-контракту.",
    paid_tickets: "not_observed",
    ticket_cpa: "not_observed",
    revenue: "not_observed",
  });
}

const campaignNameById = new Map(campaigns.map((item) => [item.id, item.name]));
const groups = [];
for (const pair of groupPairs) {
  const snapshot = await readText(`group-detail-${pair.groupId}.md`);
  const activeRecord = activeGroupById.get(pair.groupId);
  const summary = groupSummaryById.get(pair.groupId);
  const names = hierarchyNames(snapshot);
  const name = activeRecord?.group_name ?? summary?.name ?? editorTitle(snapshot) ?? names[1] ?? `Группа ${pair.groupId}`;
  const settings = extractVisibleSettings(snapshot, ["Стратегия ставок", "Бюджет", "Даты показа", "Расписание показов", "География", "Пол и возраст", "Интересы", "Аудитории", "Устройства", "Места размещения", "Расширение аудитории"]);
  const parent = campaigns.find((item) => item.id === pair.campaignId);
  const isActive = activeRecord ? true : false;
  const buyersExcluded = activeRecord?.buyers_excluded ?? /Купили|купив|покупател/i.test(snapshot);
  const geoSeparated = activeRecord?.geo_separated_moscow_near_far ?? false;
  const hasUtm = activeRecord?.utm_mode ? !/Не добавлять/i.test(activeRecord.utm_mode) : /utm_/i.test(snapshot);
  const needsRework = !buyersExcluded || !geoSeparated || !hasUtm;
  groups.push({
    id: pair.groupId,
    campaign_id: pair.campaignId,
    campaign_name: campaignNameById.get(pair.campaignId) ?? parent?.name ?? "not_observed",
    name,
    status: isActive ? "Транслируется" : "Не транслируется",
    active: isActive,
    strategy: activeRecord?.strategy ?? settings["Стратегия ставок"] ?? "not_observed",
    budget: [activeRecord?.budget, activeRecord?.budget_period].filter(Boolean).join(" ") || settings["Бюджет"] || "not_observed",
    schedule: activeRecord?.hourly_schedule ?? settings["Расписание показов"] ?? "not_observed",
    geo: activeRecord?.geo?.join(" · ") ?? settings["География"] ?? "not_observed",
    geo_separated_moscow_near_far: geoSeparated,
    age: activeRecord ? `${activeRecord.age_from ?? "?"}–${activeRecord.age_to ?? "?"}` : settings["Пол и возраст"] ?? "not_observed",
    gender: activeRecord?.gender ?? settings["Пол и возраст"] ?? "not_observed",
    included_audiences: activeRecord?.included_audiences?.join(" · ") || settings["Аудитории"] || "not_observed",
    excluded_audiences: activeRecord?.excluded_audiences?.join(" · ") || "not_observed",
    buyers_excluded: buyersExcluded,
    audience_expansion: activeRecord?.audience_expansion ?? /Расширение аудитории[\s\S]{0,500}checked/i.test(snapshot),
    devices: activeRecord?.devices?.join(" · ") || settings["Устройства"] || "not_observed",
    placements: activeRecord?.placements_auto ? "Автоматические" : activeRecord?.placements_checked?.join(" · ") || settings["Места размещения"] || "not_observed",
    audience_size: activeRecord?.audience_size ?? "not_observed",
    utm_mode: activeRecord?.utm_mode ?? (hasUtm ? "UTM observed" : "not_observed"),
    decision: !isActive ? "остановить" : needsRework ? "переработать" : "оставить",
    rationale: !isActive ? "Группа остановлена; сохранять как историю, не возвращать без новой гипотезы." : needsRework ? "Нужно разделить географию, подтвердить исключение покупателей и унифицировать UTM." : "Базовые настройки согласованы; CPA билета пока не наблюдается.",
    paid_conversion: "not_observed",
    ticket_cpa: "not_observed",
  });
}

await rm(path.join(siteDir, "assets", "creatives"), { recursive: true, force: true });
await mkdir(path.join(siteDir, "assets", "creatives"), { recursive: true });
await mkdir(path.join(siteDir, "data"), { recursive: true });

const ads = [];
for (const triple of adTriples) {
  const snapshot = await readText(`ad-detail-${triple.adId}.md`);
  const activeRecord = activeAdById.get(triple.adId);
  const summary = adSummaryById.get(triple.adId);
  const names = hierarchyNames(snapshot);
  const editorUnavailable = snapshot.includes('button "Перезагрузить"');
  const name = editorUnavailable
    ? `Объявление ${triple.adId} (карточка VK недоступна)`
    : activeRecord?.ad_name ?? summary?.name ?? editorTitle(snapshot) ?? names.at(-1) ?? `Объявление ${triple.adId}`;
  const title = activeRecord?.title ?? paragraphAfter(snapshot, "Заголовок") ?? "not_observed";
  const shortText = activeRecord?.short_text ?? paragraphAfter(snapshot, "Короткое описание") ?? paragraphAfter(snapshot, "Текст объявления") ?? "not_observed";
  const longText = activeRecord?.long_text ?? paragraphAfter(snapshot, "Длинное описание") ?? "not_observed";
  const url = activeRecord?.url ?? linkFrom(snapshot);
  const ctaCandidate = activeRecord?.cta
    ?? genericAfter(snapshot, "Надпись на кнопке")
    ?? (snapshot.includes("Выберите клип") ? "Без отдельной кнопки (клип)" : null)
    ?? (snapshot.includes('button "Пост"') ? "Без отдельной кнопки (пост)" : "not_observed");
  const cta = /Загружается/i.test(ctaCandidate) ? "not_observed" : ctaCandidate;
  const utm = { ...parseUtm(url),
    utm_source: activeRecord?.utm_source ?? parseUtm(url).utm_source,
    utm_medium: activeRecord?.utm_medium ?? parseUtm(url).utm_medium,
    utm_campaign: activeRecord?.utm_campaign ?? parseUtm(url).utm_campaign,
    utm_term: activeRecord?.utm_term ?? parseUtm(url).utm_term,
    utm_content: activeRecord?.utm_content ?? parseUtm(url).utm_content,
  };
  const metrics = activeRecord?.lifetime_stats ?? adMetrics.get(triple.adId) ?? {};
  const creativeSource = path.join(sourceDir, `creative-${triple.adId}.webp`);
  const creativeAvailable = files.includes(`creative-${triple.adId}.webp`);
  const creativeHash = creativeAvailable
    ? createHash("sha256").update(await readFile(creativeSource)).digest("hex")
    : null;
  if (creativeAvailable) {
    await copyFile(creativeSource, path.join(siteDir, "assets", "creatives", `${triple.adId}.webp`));
  }
  const price1550 = activeRecord?.price_1550 ?? /1\s?550/.test(`${title} ${shortText} ${longText}`);
  const genericLanding = url ? /^https:\/\/parkskazka\.com\/?(?:\?|$)/.test(url) : true;
  const utmComplete = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].every((key) => utm[key]);
  const activeStatus = activeRecord?.lifetime_stats?.status === "Транслируется";
  let decision = activeStatus ? "оставить" : "остановить";
  let rationale = activeStatus ? "Рабочая доставка; решение по масштабу требует CPA билета." : "Объявление остановлено; сохранять только как историю.";
  if (price1550) {
    decision = "переработать";
    rationale = "Цена 1 550 ₽ относится к вечернему кассовому тарифу после 20:00; нужен точный дисклеймер и соответствующий путь.";
  } else if (!utmComplete || genericLanding) {
    decision = activeStatus ? "переработать" : "остановить";
    rationale = !utmComplete ? "UTM неполная: обязателен utm_content с ID или концептом объявления." : "Общий маршрут не соответствует конкретному офферу; нужен продуктовый deep link.";
  } else if (!creativeAvailable) {
    decision = "протестировать повторно";
    rationale = "VK не отдал визуальный предпросмотр; перед повторным тестом требуется ручная визуальная проверка карточки.";
  }
  ads.push({
    id: triple.adId,
    group_id: triple.groupId,
    campaign_id: triple.campaignId,
    campaign_name: campaignNameById.get(triple.campaignId) ?? "not_observed",
    group_name: groups.find((item) => item.id === triple.groupId)?.name ?? "not_observed",
    name,
    creative_id: triple.adId,
    creative: creativeAvailable ? `assets/creatives/${triple.adId}.webp` : null,
    creative_sha256: creativeHash,
    creative_status: creativeAvailable ? "observed" : "not_observed: VK preview unavailable",
    format: activeRecord?.format ?? (snapshot.includes("00:") ? "video" : "static/post"),
    title,
    short_text: shortText,
    long_text: longText,
    cta,
    url: url ?? "not_observed",
    utm,
    utm_complete: utmComplete,
    price_1550: price1550,
    generic_landing: genericLanding,
    status: activeStatus ? "Транслируется" : "Не транслируется",
    moderation: metrics.moderation ?? "not_observed",
    spend: metrics.spend ?? "not_observed",
    impressions: metrics.impressions ?? "not_observed",
    clicks: metrics.clicks ?? "not_observed",
    ctr: metrics.ctr ?? "not_observed",
    cpc: metrics.cpc ?? "not_observed",
    cpm: metrics.cpm ?? "not_observed",
    spend_value: moneyNumber(metrics.spend),
    impressions_value: integerNumber(metrics.impressions),
    clicks_value: integerNumber(metrics.clicks),
    frequency: "not_observed",
    vtr: metrics.vtr ?? "not_observed",
    checkout: "not_observed",
    purchase: "not_observed",
    ticket_cpa: "not_observed",
    revenue: "not_observed",
    decision,
    rationale,
  });
}

const creativeGroups = new Map();
for (const ad of ads.filter((item) => item.creative_sha256)) {
  const group = creativeGroups.get(ad.creative_sha256) ?? [];
  group.push(ad);
  creativeGroups.set(ad.creative_sha256, group);
}

const creativeBenchmarkRows = ads.filter((item) => item.creative_sha256 && item.impressions_value !== null && item.clicks_value !== null);
const creativeBenchmarkImpressions = creativeBenchmarkRows.reduce((sum, item) => sum + item.impressions_value, 0);
const creativeBenchmarkClicks = creativeBenchmarkRows.reduce((sum, item) => sum + item.clicks_value, 0);
const creativeBenchmarkCtr = creativeBenchmarkImpressions > 0 ? creativeBenchmarkClicks / creativeBenchmarkImpressions * 100 : null;

const creatives = [...creativeGroups.entries()].map(([hash, relatedAds]) => {
  const representative = relatedAds[0];
  const spendRows = relatedAds.filter((item) => item.spend_value !== null);
  const impressionRows = relatedAds.filter((item) => item.impressions_value !== null);
  const clickRows = relatedAds.filter((item) => item.clicks_value !== null);
  const spendValue = spendRows.length ? spendRows.reduce((sum, item) => sum + item.spend_value, 0) : null;
  const impressionsValue = impressionRows.length ? impressionRows.reduce((sum, item) => sum + item.impressions_value, 0) : null;
  const clicksValue = clickRows.length ? clickRows.reduce((sum, item) => sum + item.clicks_value, 0) : null;
  const ctrValue = impressionsValue > 0 && clicksValue !== null ? clicksValue / impressionsValue * 100 : null;
  const cpcValue = clicksValue > 0 && spendValue !== null ? spendValue / clicksValue : null;
  const cpmValue = impressionsValue > 0 && spendValue !== null ? spendValue / impressionsValue * 1000 : null;
  const activeAds = relatedAds.filter((item) => item.status === "Транслируется").length;
  const decisions = new Set(relatedAds.map((item) => item.decision));
  const decision = decisions.has("переработать")
    ? "переработать"
    : activeAds > 0 ? "оставить" : decisions.has("протестировать повторно") ? "протестировать повторно" : "остановить";
  let signal = "Мало данных";
  let signalCode = "low_data";
  if (ctrValue !== null && creativeBenchmarkCtr !== null && impressionsValue >= 5_000) {
    if (ctrValue >= creativeBenchmarkCtr * 1.25) {
      signal = "CTR выше среднего";
      signalCode = "strong";
    } else if (ctrValue <= creativeBenchmarkCtr * 0.75) {
      signal = "CTR ниже среднего";
      signalCode = "weak";
    } else {
      signal = "CTR около среднего";
      signalCode = "neutral";
    }
  }

  const observedCtas = [...new Set(relatedAds.map((item) => item.cta))].filter((value) => value && value !== "not_observed");

  return {
    id: `visual_${hash.slice(0, 12)}`,
    name: representative.name,
    visual_sha256: hash,
    creative: representative.creative,
    ad_count: relatedAds.length,
    ad_ids: relatedAds.map((item) => item.id),
    campaign_ids: [...new Set(relatedAds.map((item) => item.campaign_id))],
    group_ids: [...new Set(relatedAds.map((item) => item.group_id))],
    active_ads: activeAds,
    active: activeAds > 0,
    status: activeAds > 0 ? "Есть активные" : "Только остановленные",
    decision,
    cta: observedCtas.join(" · ") || "not_observed",
    spend: spendValue !== null ? formatMoney(spendValue) : "not_observed",
    impressions: impressionsValue !== null ? formatInteger(impressionsValue) : "not_observed",
    clicks: clicksValue !== null ? formatInteger(clicksValue) : "not_observed",
    ctr: ctrValue !== null ? formatRate(ctrValue) : "not_observed",
    cpc: cpcValue !== null ? formatMoney(cpcValue) : "not_observed",
    cpm: cpmValue !== null ? formatMoney(cpmValue) : "not_observed",
    spend_value: spendValue,
    impressions_value: impressionsValue,
    clicks_value: clicksValue,
    ctr_value: ctrValue,
    cpc_value: cpcValue,
    cpm_value: cpmValue,
    metric_coverage: `${relatedAds.filter((item) => item.spend_value !== null && item.impressions_value !== null && item.clicks_value !== null).length} / ${relatedAds.length}`,
    signal,
    signal_code: signalCode,
    signal_basis: creativeBenchmarkCtr !== null ? `Средний CTR observed preview: ${formatRate(creativeBenchmarkCtr)}` : "not_observed",
    ticket_cpa: "not_observed",
  };
}).sort((left, right) => (right.spend_value ?? -1) - (left.spend_value ?? -1));

const audit = {
  meta: {
    account: "Парк Сказка",
    account_id: "17079495",
    metrica_counter: "37767130",
    captured_at: "2026-08-26T10:00:00+03:00",
    period: "24.08.2025–24.08.2026 (кабинетный lifetime-срез)",
    mode: "read-only",
    attribution: "Оплаченные билеты, CPA билета и выручка: not_observed без свежей LIME-выгрузки.",
    favorite_goals: "Визиты, отказы, глубина просмотра и достижения 5 избранных целей Метрики учитываются на уровне доступной кампанийной атрибуции.",
    excluded_campaign_ids: [...excludedCampaignIds],
  },
  summary: {
    campaigns: campaigns.length,
    active_campaigns: campaigns.filter((item) => item.active).length,
    groups: groups.length,
    active_groups: groups.filter((item) => item.active).length,
    ads: ads.length,
    active_ads: ads.filter((item) => item.status === "Транслируется").length,
    creatives_observed: ads.filter((item) => item.creative).length,
    creatives_not_observed: ads.filter((item) => !item.creative).length,
    unique_creatives: creatives.length,
    duplicate_creative_sets: creatives.filter((item) => item.ad_count > 1).length,
    ads_in_duplicate_creative_sets: creatives.filter((item) => item.ad_count > 1).reduce((sum, item) => sum + item.ad_count, 0),
    price_1550_ads: ads.filter((item) => item.price_1550).length,
  },
  campaigns,
  groups,
  ads,
  creatives,
};

const digest = createHash("sha256").update(JSON.stringify(audit)).digest("hex");
audit.meta.sha256 = digest;
await writeFile(path.join(siteDir, "data", "audit.json"), `${JSON.stringify(audit, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ summary: audit.summary, sha256: digest }, null, 2));
