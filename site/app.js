const state = { data: null, view: "campaigns", query: "", status: "all", decision: "all" };
const content = document.querySelector("#content");
const resultCount = document.querySelector("#result-count");

const escapeHtml = (value) => String(value ?? "not_observed").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
const decisionClass = (value) => ({ "оставить": "leave", "переработать": "rework", "остановить": "stop", "протестировать повторно": "retest" })[value] ?? "retest";
const statusBadge = (item) => `<span class="status ${item.active || item.status === "Транслируется" ? "active" : "inactive"}">${escapeHtml(item.status)}</span>`;
const decisionBadge = (item) => `<span class="decision ${decisionClass(item.decision)}">${escapeHtml(item.decision)}</span>`;
const fact = (label, value) => `<div class="fact"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></div>`;

function filtered(items) {
  const query = state.query.toLowerCase();
  return items.filter((item) => {
    const haystack = `${item.id} ${item.name} ${item.campaign_name ?? ""} ${item.group_name ?? ""}`.toLowerCase();
    const active = item.active || item.status === "Транслируется";
    return (!query || haystack.includes(query))
      && (state.status === "all" || (state.status === "active" ? active : !active))
      && (state.decision === "all" || item.decision === state.decision);
  });
}

function registryRecord(item, type) {
  const isCampaign = type === "campaigns";
  const metrics = isCampaign ? [item.spend, item.ctr] : [item.budget ?? "not_observed", item.ticket_cpa];
  const body = isCampaign
    ? [fact("Объект", item.promotion_object), fact("Фактическая цель", item.target_action), fact("Пиксель", item.pixel_id), fact("Бюджет", item.budget), fact("Период", `${item.start_date} → ${item.end_date}`), fact("Показы", item.impressions), fact("Клики", item.clicks), fact("CPA билета", item.ticket_cpa)].join("")
    : [fact("Кампания", item.campaign_name), fact("Стратегия", item.strategy), fact("Бюджет", item.budget), fact("Расписание", item.schedule), fact("География", item.geo), fact("Москва / ближняя / дальняя МО", item.geo_separated_moscow_near_far ? "разделены" : "не разделены"), fact("Возраст / пол", `${item.age} · ${item.gender}`), fact("Исключены покупатели", item.buyers_excluded ? "да" : "не подтверждено"), fact("Включённые аудитории", item.included_audiences), fact("Исключённые аудитории", item.excluded_audiences), fact("Устройства", item.devices), fact("Плейсменты", item.placements), fact("UTM", item.utm_mode), fact("CPA билета", item.ticket_cpa)].join("");
  return `<details class="record"><summary><span class="id">#${escapeHtml(item.id)}</span><span class="record-title">${escapeHtml(item.name)}</span>${statusBadge(item)}<span class="metric"><small>${isCampaign ? "Расход" : "Бюджет"}</small><b>${escapeHtml(metrics[0])}</b></span>${decisionBadge(item)}</summary><div class="record-body"><div class="fact-grid">${body}</div><p class="rationale"><strong>Решение:</strong> ${escapeHtml(item.rationale)}</p></div></details>`;
}

function creativeCard(item) {
  const media = item.creative ? `<img src="${escapeHtml(item.creative)}" alt="Предпросмотр креатива объявления ${escapeHtml(item.id)}" loading="lazy" />` : `<span>Предпросмотр не отдан VK<br />${escapeHtml(item.id)}</span>`;
  return `<article class="creative-card"><div class="creative-media">${media}</div><div class="creative-copy"><div class="creative-topline"><span class="id">creative_id ${escapeHtml(item.creative_id)}</span>${decisionBadge(item)}</div><h2>${escapeHtml(item.name)}</h2><p class="headline">${escapeHtml(item.title)}</p><div class="creative-stats"><div><small>Расход</small><b>${escapeHtml(item.spend)}</b></div><div><small>CTR</small><b>${escapeHtml(item.ctr)}</b></div><div><small>CPC</small><b>${escapeHtml(item.cpc)}</b></div><div><small>CPA билета</small><b>${escapeHtml(item.ticket_cpa)}</b></div></div><div class="creative-meta"><span><b>CTA</b>${escapeHtml(item.cta)}</span><span><b>Статус</b>${escapeHtml(item.status)} · ${escapeHtml(item.moderation)}</span><span><b>Текст</b>${escapeHtml(item.short_text)}</span><span class="url"><b>Ссылка</b>${escapeHtml(item.url)}</span><span><b>UTM</b>${item.utm_complete ? "полная" : "неполная"}</span><span><b>Purchase / revenue</b>not_observed</span></div><p class="rationale">${escapeHtml(item.rationale)}</p></div></article>`;
}

function render() {
  const items = filtered(state.data[state.view]);
  resultCount.textContent = `Показано ${items.length} из ${state.data[state.view].length}`;
  if (!items.length) {
    content.replaceChildren(document.querySelector("#empty-template").content.cloneNode(true));
    return;
  }
  content.innerHTML = state.view === "ads"
    ? `<div class="creative-grid">${items.map(creativeCard).join("")}</div>`
    : `<div class="registry">${items.map((item) => registryRecord(item, state.view)).join("")}</div>`;
}

function renderSummary(data) {
  const cards = [
    [data.summary.campaigns, "кампаний, включая остановленные", true],
    [data.summary.groups, "групп во всём кабинете"],
    [data.summary.ads, "объявления без исключений", true],
    [data.summary.creatives_observed, "креативов прочитано из VK"],
    [data.summary.creatives_not_observed, "превью не отданы VK"],
    [data.summary.price_1550_ads, "объявления с 1 550 ₽"],
  ];
  document.querySelector("#summary").innerHTML = cards.map(([value, label, highlight]) => `<div class="summary-card ${highlight ? "highlight" : ""}"><b>${value}</b><span>${label}</span></div>`).join("");
  document.querySelector("#attribution-note").textContent = data.meta.attribution;
}

document.querySelectorAll(".tab").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("is-active", tab === button));
  state.view = button.dataset.view;
  render();
}));
document.querySelector("#search").addEventListener("input", (event) => { state.query = event.target.value; render(); });
document.querySelector("#status-filter").addEventListener("change", (event) => { state.status = event.target.value; render(); });
document.querySelector("#decision-filter").addEventListener("change", (event) => { state.decision = event.target.value; render(); });

try {
  const response = await fetch("data/audit.json");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  state.data = await response.json();
  renderSummary(state.data);
  render();
} catch (error) {
  content.innerHTML = `<div class="empty"><strong>Не удалось загрузить реестр</strong><span>${escapeHtml(error.message)}</span></div>`;
}