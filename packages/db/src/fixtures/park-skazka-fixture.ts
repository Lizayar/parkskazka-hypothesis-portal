import type {
  Ad,
  AdGroup,
  Campaign,
  Creative,
  Hypothesis,
  SourceAccount,
  Workspace,
} from "../schema/core.js";
import type { ExperimentTest } from "../schema/experiments.js";

export type ParkSkazkaFixture = {
  workspace: Workspace;
  sourceAccount: SourceAccount;
  campaign: Campaign;
  adGroup: AdGroup;
  creative: Creative;
  ad: Ad;
  hypothesis: Hypothesis;
  test: ExperimentTest;
};

export function createParkSkazkaFixture(): ParkSkazkaFixture {
  const workspace: Workspace = {
    id: "workspace-parkskazka",
    slug: "parkskazka",
    name: "Park Skazka",
    timezone: "Europe/Moscow",
  };
  const sourceAccount: SourceAccount = {
    id: "account-vk-parkskazka",
    workspaceId: workspace.id,
    source: "vk_ads",
    externalId: "vk-account-fixture",
    name: "Park Skazka VK Ads",
    status: "active",
  };
  const campaign: Campaign = {
    id: "campaign-summer-fixture",
    accountId: sourceAccount.id,
    source: sourceAccount.source,
    objectLevel: "campaign",
    externalId: "vk-campaign-fixture",
    name: "Summer Park Visit",
    settings: { objective: "traffic", budgetCurrency: "RUB" },
  };
  const adGroup: AdGroup = {
    id: "ad-group-fixture",
    campaignId: campaign.id,
    source: campaign.source,
    objectLevel: "ad_group",
    externalId: "vk-ad-group-fixture",
    name: "Families 25-44",
    settings: { rotation: "even" },
  };
  const creative: Creative = {
    id: "creative-control-fixture",
    source: campaign.source,
    objectLevel: "creative",
    externalId: "vk-creative-control-fixture",
    name: "Control: family weekend",
    contentHash: "sha256:fixture-control",
    copy: "Семейный выходной в Парке Сказка",
    hook: "Отдых рядом с городом",
    offer: "Билет на семейный день",
    cta: "Узнать программу",
  };
  const ad: Ad = {
    id: "ad-control-fixture",
    adGroupId: adGroup.id,
    creativeId: creative.id,
    source: campaign.source,
    objectLevel: "ad",
    externalId: "vk-ad-control-fixture",
    name: "Control rotation A",
    status: "active",
  };
  const hypothesis: Hypothesis = {
    id: "hypothesis-family-hook-fixture",
    workspaceId: workspace.id,
    title: "Hook про семейный выходной повысит intent",
    statement: "Если усилить hook близким семейным сценарием, то CPL снизится без роста bounce rate.",
    status: "planned",
    ownerSubjectId: "github|fixture-owner",
    startsOn: "2026-08-12",
    endsOn: "2026-08-19",
    primaryMetric: "cost_per_lead",
    guardrailMetrics: ["bounce_rate", "frequency"],
  };
  const test: ExperimentTest = {
    id: "test-family-hook-fixture",
    workspaceId: workspace.id,
    hypothesisId: hypothesis.id,
    status: "planned",
    startsOn: hypothesis.startsOn,
    endsOn: hypothesis.endsOn,
    primaryMetric: hypothesis.primaryMetric,
    controlCreativeId: creative.id,
    challengerCreativeIds: ["creative-challenger-fixture"],
  };

  return { workspace, sourceAccount, campaign, adGroup, creative, ad, hypothesis, test };
}

