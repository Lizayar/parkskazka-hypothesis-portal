const state = { data: null, view: "campaigns", query: "", status: "all", decision: "all" };
const content = document.querySelector("#content");
const resultCount = document.querySelector("#result-count");
const searchInput = document.querySelector("#search");
const statusFilter = document.querySelector("#status-filter");
const decisionFilter = document.querySelector("#decision-filter");
const creativeViewer = document.querySelector("#creative-viewer");
const creativeViewerImage = document.querySelector("#creative-viewer-image");
const creativeViewerTitle = document.querySelector("#creative-viewer-title");
const creativeViewerCaption = document.querySelector("#creative-viewer-caption");

const escapeHtml = (value) => String(value ?? "not_observed").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
const decisionClass = (value) => ({ "оставить": "leave", "переработать": "rework", "остановить": "stop", "протестировать повторно": "retest" })[value] ?? "retest";
const signalClass = (value) => ({ strong: "strong", weak: "weak", neutral: "neutral", low_data: "low-data" })[value] ?? "low-data";
const statusBadge = (item) => `<span class="status ${item.active || item.status === "Транслируется" ? "active" : "inactive"}">${escapeHtml(item.status)}</span>`;
const decisionBadge = (item) => `<span class="decision ${decisionClass(item.decision)}">${escapeHtml(item.decision)}</span>`;
const fact = (label, value) => `<div class="fact"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></div>`;

function filtered(items) {
  const query = state.query.toLowerCase();
  return items.filter((item) => {
    const lineage = [...(item.ad_ids ?? []), ...(item.campaign_ids ?? []), ...(item.group_ids ?? [])].join(" ");
    const haystack = `${item.id} ${item.cabinet_name ?? item.name} ${item.display_name ?? ""} ${item.campaign_name ?? ""} ${item.group_name ?? ""} ${lineage}`.toLowerCase();
    const active = item.active || item.status === "Транслируется";
    return (!query || haystack.includes(query))
      && (state.status === "all" || (state.status === "active" ? active : !active))
      && (state.decision === "all" || item.decision === state.decision);
  });
}

function mediaButton(item, label = item.id) {
  if (!item.creative) return `<span class="creative-unavailable">Предпросмотр не отдан VK<br />${escapeHtml(label)}</span>`;
  return `<button class="creative-open" type="button" data-src="${escapeHtml(item.creative)}" data-title="${escapeHtml(item.display_name ?? item.name)}" data-id="${escapeHtml(label)}" aria-label="Открыть креатив ${escapeHtml(label)} крупно"><img src="${escapeHtml(item.creative)}" alt="Предпросмотр креатива ${escapeHtml(label)}" loading="lazy" /><span class="creative-expand">Открыть крупно</span></button>`;
}

function adDrillCard(item) {
  return `<article class="ad-drill-card"><div class="ad-drill-media">${mediaButton(item)}</div><div class="ad-drill-body"><div class="creative-topline">${decisionBadge(item)}</div><h4>${escapeHtml(item.display_name)}</h4><p>${escapeHtml(item.title)}</p><div class="drill-metrics"><span><small>Расход</small><b>${escapeHtml(item.spend)}</b></span><span><small>CTR</small><b>${escapeHtml(item.ctr)}</b></span><span><small>CPC</small><b>${escapeHtml(item.cpc)}</b></span></div><div class="ad-drill-meta"><span><b>CTA</b>${escapeHtml(item.cta)}</span><span><b>Статус</b>${escapeHtml(item.status)}</span><span><b>Группа</b>#${escapeHtml(item.group_id)}</span></div></div></article>`;
}

function groupFacts(item) {
  return [
    fact("Кампания", item.campaign_name),
    fact("Стратегия", item.strategy),
    fact("Бюджет", item.budget),
    fact("Расписание", item.schedule),
    fact("География", item.geo),
    fact("Москва / ближняя / дальняя МО", item.geo_separated_moscow_near_far ? "разделены" : "не разделены"),
    fact("Возраст / пол", `${item.age} · ${item.gender}`),
    fact("Исключены покупатели", item.buyers_excluded ? "да" : "не подтверждено"),
    fact("Включённые аудитории", item.included_audiences),
    fact("Исключённые аудитории", item.excluded_audiences),
    fact("Устройства", item.devices),
    fact("Плейсменты", item.placements),
    fact("UTM", item.utm_mode),
    fact("CPA билета", item.ticket_cpa),
  ].join("");
}

function adsSection(groupId) {
  const ads = state.data.ads.filter((item) => item.group_id === groupId);
  return `<section class="descendants"><div class="descendant-head"><div><span>Уровень 3</span><h3>Объявления</h3></div><b>${ads.length}</b></div>${ads.length ? `<div class="ad-drill-grid">${ads.map(adDrillCard).join("")}</div>` : `<p class="child-empty">Объявления не найдены.</p>`}</section>`;
}

function groupRecord(item, nested = false) {
  const adCount = state.data.ads.filter((ad) => ad.group_id === item.id).length;
  const summary = nested
    ? `<summary><span class="record-title">${escapeHtml(item.display_name)}</span>${statusBadge(item)}<span class="descendant-count">${adCount} объявлений</span></summary>`
    : `<summary><span class="record-title">${escapeHtml(item.display_name)}</span>${statusBadge(item)}<span class="metric"><small>Бюджет</small><b>${escapeHtml(item.budget)}</b></span>${decisionBadge(item)}</summary>`;
  return `<details class="${nested ? "child-group" : "record group-record"}">${summary}<div class="${nested ? "child-group-body" : "record-body"}"><div class="fact-grid">${groupFacts(item)}</div><p class="rationale"><strong>Решение:</strong> ${escapeHtml(item.rationale)}</p>${adsSection(item.id)}</div></details>`;
}

function campaignRecord(item) {
  const groups = state.data.groups.filter((group) => group.campaign_id === item.id);
  const body = [
    fact("Объект", item.promotion_object),
    fact("Фактическая цель", item.target_action),
    fact("Пиксель", item.pixel_id),
    fact("Бюджет", item.budget),
    fact("Период", `${item.start_date} → ${item.end_date}`),
    fact("Показы", item.impressions),
    fact("Клики", item.clicks),
    fact("CPA билета", item.ticket_cpa),
  ].join("");
  return `<details class="record campaign-record"><summary><span class="record-title">${escapeHtml(item.display_name)}</span>${statusBadge(item)}<span class="metric"><small>Расход</small><b>${escapeHtml(item.spend)}</b></span>${decisionBadge(item)}</summary><div class="record-body"><div class="fact-grid">${body}</div><p class="rationale"><strong>Решение:</strong> ${escapeHtml(item.rationale)}</p><section class="descendants"><div class="descendant-head"><div><span>Уровень 2</span><h3>Группы кампании</h3></div><b>${groups.length}</b></div><div class="child-groups">${groups.map((group) => groupRecord(group, true)).join("")}</div></section></div></details>`;
}

function creativeCard(item) {
  return `<article class="creative-card"><div class="creative-media">${mediaButton(item)}</div><div class="creative-copy"><div class="creative-topline"><span class="id">creative_id ${escapeHtml(item.creative_id)}</span>${decisionBadge(item)}</div><h2>${escapeHtml(item.display_name)}</h2><p class="headline">${escapeHtml(item.title)}</p><div class="creative-stats"><div><small>Расход</small><b>${escapeHtml(item.spend)}</b></div><div><small>CTR</small><b>${escapeHtml(item.ctr)}</b></div><div><small>CPC</small><b>${escapeHtml(item.cpc)}</b></div><div><small>CPA билета</small><b>${escapeHtml(item.ticket_cpa)}</b></div></div><div class="creative-meta"><span><b>CTA</b>${escapeHtml(item.cta)}</span><span><b>Статус</b>${escapeHtml(item.status)} · ${escapeHtml(item.moderation)}</span><span><b>Текст</b>${escapeHtml(item.short_text)}</span><span class="url"><b>Ссылка</b>${escapeHtml(item.url)}</span><span><b>UTM</b>${item.utm_complete ? "полная" : "неполная"}</span><span><b>Purchase / revenue</b>not_observed</span></div><p class="rationale">${escapeHtml(item.rationale)}</p></div></article>`;
}

function uniqueCreativeCard(item) {
  const relatedAds = item.ad_ids.map((adId) => `<button type="button" data-open-ad="${escapeHtml(adId)}">#${escapeHtml(adId)}</button>`).join("");
  return `<article class="unique-card"><div class="creative-media">${mediaButton(item, item.id)}</div><div class="unique-copy"><div class="creative-topline"><span class="id">${escapeHtml(item.id)}</span><span class="signal ${signalClass(item.signal_code)}">${escapeHtml(item.signal)}</span></div><h2>${escapeHtml(item.display_name)}</h2><p class="unique-definition">${item.ad_count > 1 ? `${item.ad_count} объявления с идентичным preview` : "Один уникальный preview"}</p><div class="unique-stats"><div><small>Расход</small><b>${escapeHtml(item.spend)}</b></div><div><small>Показы</small><b>${escapeHtml(item.impressions)}</b></div><div><small>Клики</small><b>${escapeHtml(item.clicks)}</b></div><div><small>CTR</small><b>${escapeHtml(item.ctr)}</b></div><div><small>CPC</small><b>${escapeHtml(item.cpc)}</b></div><div><small>CPM</small><b>${escapeHtml(item.cpm)}</b></div></div><div class="unique-meta"><span><b>Активные объявления</b>${escapeHtml(item.active_ads)} из ${escapeHtml(item.ad_count)}</span><span><b>CTA</b>${escapeHtml(item.cta)}</span><span><b>Покрытие метрик</b>${escapeHtml(item.metric_coverage)}</span><span><b>Основа сигнала</b>${escapeHtml(item.signal_basis)}</span><span><b>CPA билета</b>not_observed</span></div><div class="related-ads"><strong>Связанные объявления</strong><div>${relatedAds}</div></div><p class="unique-note">Сигнал оценивает платформенный CTR при ≥ 5 000 показов. Это не вывод по продажам.</p></div></article>`;
}

function render() {
  const items = filtered(state.data[state.view]);
  resultCount.textContent = `Показано ${items.length} из ${state.data[state.view].length}`;
  if (!items.length) {
    content.replaceChildren(document.querySelector("#empty-template").content.cloneNode(true));
    return;
  }
  if (state.view === "campaigns") content.innerHTML = `<div class="registry">${items.map(campaignRecord).join("")}</div>`;
  if (state.view === "groups") content.innerHTML = `<div class="registry">${items.map((item) => groupRecord(item)).join("")}</div>`;
  if (state.view === "ads") content.innerHTML = `<div class="creative-grid">${items.map(creativeCard).join("")}</div>`;
  if (state.view === "creatives") content.innerHTML = `<div class="unique-grid">${items.map(uniqueCreativeCard).join("")}</div>`;
}

function renderSummary(data) {
  const cards = [
    [data.summary.campaigns, "кампаний в рабочем реестре", true],
    [data.summary.groups, "групп с lineage"],
    [data.summary.ads, "объявлений"],
    [data.summary.creatives_observed, "preview прочитано из VK"],
    [data.summary.unique_creatives, "уникальных визуалов", true],
    [data.summary.creatives_not_observed, "preview не отданы VK"],
    [data.summary.price_1550_ads, "объявления с 1 550 ₽"],
  ];
  document.querySelector("#summary").innerHTML = cards.map(([value, label, highlight]) => `<div class="summary-card ${highlight ? "highlight" : ""}"><b>${value}</b><span>${label}</span></div>`).join("");
  document.querySelector("#attribution-note").textContent = data.meta.attribution;
}

function setView(view) {
  state.view = view;
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("is-active", tab.dataset.view === view));
  render();
}

content.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  const trigger = event.target.closest(".creative-open");
  if (trigger) {
    creativeViewerImage.src = trigger.dataset.src;
    creativeViewerImage.alt = `Креатив ${trigger.dataset.id}`;
    creativeViewerTitle.textContent = `Креатив ${trigger.dataset.id}`;
    creativeViewerCaption.textContent = trigger.dataset.title;
    creativeViewer.showModal();
    return;
  }
  const adLink = event.target.closest("[data-open-ad]");
  if (adLink) {
    state.query = adLink.dataset.openAd;
    state.status = "all";
    state.decision = "all";
    searchInput.value = state.query;
    statusFilter.value = "all";
    decisionFilter.value = "all";
    setView("ads");
    content.focus();
  }
});

document.querySelector("#creative-viewer-close").addEventListener("click", () => creativeViewer.close());
creativeViewer.addEventListener("click", (event) => {
  if (event.target === creativeViewer) creativeViewer.close();
});
document.querySelectorAll(".tab").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
searchInput.addEventListener("input", (event) => { state.query = event.target.value; render(); });
statusFilter.addEventListener("change", (event) => { state.status = event.target.value; render(); });
decisionFilter.addEventListener("change", (event) => { state.decision = event.target.value; render(); });

try {
  const response = await fetch("data/audit.json");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  state.data = await response.json();
  renderSummary(state.data);
  render();
} catch (error) {
  content.innerHTML = `<div class="empty"><strong>Не удалось загрузить реестр</strong><span>${escapeHtml(error.message)}</span></div>`;
}
