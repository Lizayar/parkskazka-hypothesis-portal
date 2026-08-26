export const sources = ["vk_ads", "yandex_metrica", "avito_ads", "telegram_ads"] as const;
export type Source = (typeof sources)[number];

export const objectLevels = ["campaign", "ad_group", "ad", "creative"] as const;
export type ObjectLevel = (typeof objectLevels)[number];

export type Workspace = {
  id: string;
  slug: string;
  name: string;
  timezone: string;
};

export type SourceAccount = {
  id: string;
  workspaceId: string;
  source: Source;
  externalId: string;
  name: string;
  status: "active" | "paused" | "revoked";
};

export type Campaign = {
  id: string;
  accountId: string;
  source: Source;
  objectLevel: "campaign";
  externalId: string;
  name: string;
  settings?: Readonly<Record<string, unknown>>;
};

export type AdGroup = {
  id: string;
  campaignId: string;
  source: Source;
  objectLevel: "ad_group";
  externalId: string;
  name: string;
  settings?: Readonly<Record<string, unknown>>;
};

export type Creative = {
  id: string;
  source: Source;
  objectLevel: "creative";
  externalId: string;
  name: string;
  contentHash: string;
  visualUrl?: string;
  copy?: string;
  hook?: string;
  offer?: string;
  cta?: string;
};

export type Ad = {
  id: string;
  adGroupId: string;
  creativeId: string;
  source: Source;
  objectLevel: "ad";
  externalId: string;
  name: string;
  status: "active" | "paused" | "archived";
};

export type Hypothesis = {
  id: string;
  workspaceId: string;
  title: string;
  statement: string;
  status: "draft" | "planned" | "running" | "completed" | "stopped";
  ownerSubjectId: string;
  startsOn: string;
  endsOn: string;
  primaryMetric: string;
  guardrailMetrics: readonly string[];
};

export const coreConstraints = {
  sourceObjectIdentity: ["source", "accountId", "objectLevel", "externalId"],
  snapshotIdentity: ["source", "accountId", "period", "contentHash"],
} as const;

