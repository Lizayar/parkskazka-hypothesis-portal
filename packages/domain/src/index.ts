export type PortalHealth = {
  service: "web" | "api" | "worker";
  status: "ok" | "degraded" | "blocked";
  generatedAt: string;
};

export type ReadOnlySource = "yandex_metrica" | "avito_ads" | "vk_ads" | "telegram_ads";
export * from "./metrics/attribution.js";

