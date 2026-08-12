import type { ReadOnlySource } from "@portal/domain/index";

export * from "./contracts.js";
export * from "./errors.js";
export * from "./yandex-metrica/adapter.js";
export * from "./yandex-metrica/fixtures.js";
export * from "./yandex-metrica/mapper.js";
export * from "./vk-ads/adapter.js";
export * from "./vk-ads/fixtures.js";
export * from "./vk-ads/mapper.js";
export * from "./avito-ads/adapter.js";
export * from "./avito-ads/fixtures.js";
export * from "./avito-ads/mapper.js";

export type AdapterCapability = {
  source: ReadOnlySource;
  status: "discovery" | "supported" | "unsupported";
  readOnly: true;
  lastCheckedAt?: string;
};

export const initialAdapterCapabilities: readonly AdapterCapability[] = [
  { source: "yandex_metrica", status: "discovery", readOnly: true },
  { source: "avito_ads", status: "discovery", readOnly: true },
  { source: "vk_ads", status: "discovery", readOnly: true },
  { source: "telegram_ads", status: "discovery", readOnly: true },
];

