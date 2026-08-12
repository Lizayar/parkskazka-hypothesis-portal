import type { PortalReadRow } from "@portal/db/repositories/postgres-read-repository";
import {
  buildExplorerTree,
  type ExplorerInput,
  type ExplorerCampaign,
  type HypothesisJournalItem,
} from "./read-models.js";

export type MetricObservationInput = {
  metricKey: string;
  value: number | null;
  qualityStatus: "valid" | "partial" | "invalid";
};

export type PostgresReadModels = {
  hypotheses: readonly HypothesisJournalItem[];
  tree: readonly ExplorerCampaign[];
  metrics: {
    status: "ready" | "insufficient" | "not_loaded";
    observations: readonly MetricObservationInput[];
  };
};

const hypothesisStatuses = ["draft", "planned", "running", "completed", "stopped"] as const;
const decisions = ["scale", "iterate", "stop", "inconclusive"] as const;

function isOneOf<T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === "string" && values.includes(value);
}

function completeHypothesis(row: PortalReadRow): HypothesisJournalItem | undefined {
  if (
    !row.hypothesisId ||
    !row.hypothesisTitle ||
    !row.hypothesisOwnerSubjectId ||
    !row.primaryMetric ||
    !row.startsOn ||
    !row.endsOn ||
    !isOneOf(hypothesisStatuses, row.hypothesisStatus)
  ) {
    return undefined;
  }

  return {
    id: row.hypothesisId,
    title: row.hypothesisTitle,
    status: row.hypothesisStatus,
    ownerSubjectId: row.hypothesisOwnerSubjectId,
    source: row.source,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    primaryMetric: row.primaryMetric,
    decision: isOneOf(decisions, row.decisionOutcome) ? row.decisionOutcome : "inconclusive",
  };
}

function explorerInput(row: PortalReadRow): ExplorerInput | undefined {
  if (!row.adGroupId || !row.adGroupName || !row.adId || !row.adName || !row.creativeId || !row.creativeName) {
    return undefined;
  }
  return {
    campaignId: row.campaignId,
    campaignName: row.campaignName,
    adGroupId: row.adGroupId,
    adGroupName: row.adGroupName,
    adId: row.adId,
    adName: row.adName,
    creativeId: row.creativeId,
    creativeName: row.creativeName,
    source: row.source,
  };
}

export function mapPostgresRowsToReadModels(
  rows: readonly PortalReadRow[],
  observations: readonly MetricObservationInput[] = [],
): PostgresReadModels {
  const hypothesisById = new Map<string, HypothesisJournalItem>();
  const hierarchyRows: ExplorerInput[] = [];

  for (const row of rows) {
    const hypothesis = completeHypothesis(row);
    if (hypothesis && !hypothesisById.has(hypothesis.id)) hypothesisById.set(hypothesis.id, hypothesis);

    const hierarchy = explorerInput(row);
    if (hierarchy) hierarchyRows.push(hierarchy);
  }

  const metricsStatus = observations.length === 0
    ? "not_loaded"
    : observations.some((observation) => observation.qualityStatus === "invalid" || observation.value === null)
      ? "insufficient"
      : "ready";

  return {
    hypotheses: [...hypothesisById.values()],
    tree: buildExplorerTree(hierarchyRows),
    metrics: { status: metricsStatus, observations: observations.map((observation) => ({ ...observation })) },
  };
}

