import { randomUUID } from "node:crypto";
import type {
  Campaign,
  Source,
  SourceAccount,
} from "../schema/core.js";
import type { Decision, DecisionOutcome, ExperimentTest } from "../schema/experiments.js";

export type CreateSourceAccount = {
  workspaceId: string;
  source: Source;
  externalId: string;
  name: string;
  status?: SourceAccount["status"];
};

export type CreateCampaign = Omit<Campaign, "id">;

export type CreateTest = ExperimentTest;

export type CreateDecision = {
  testId: string;
  outcome: DecisionOutcome;
  decidedBy: string;
  rationale?: string;
};

export class InMemoryPortalRepository {
  private readonly sourceAccounts = new Map<string, SourceAccount>();
  private readonly campaigns = new Map<string, Campaign>();
  private readonly tests = new Map<string, ExperimentTest>();
  private readonly decisions = new Map<string, Decision>();

  createSourceAccount(input: CreateSourceAccount): SourceAccount {
    const identity = `${input.workspaceId}:${input.source}:${input.externalId}`;
    if (this.sourceAccounts.has(identity)) {
      throw new Error("DUPLICATE_SOURCE_ACCOUNT");
    }

    const account: SourceAccount = {
      id: randomUUID(),
      workspaceId: input.workspaceId,
      source: input.source,
      externalId: input.externalId,
      name: input.name,
      status: input.status ?? "active",
    };
    this.sourceAccounts.set(identity, account);
    return { ...account };
  }

  createCampaign(input: CreateCampaign): Campaign {
    const identity = `${input.source}:${input.accountId}:${input.objectLevel}:${input.externalId}`;
    if (this.campaigns.has(identity)) {
      throw new Error("DUPLICATE_SOURCE_OBJECT");
    }

    const campaign: Campaign = { ...input, id: randomUUID() };
    this.campaigns.set(identity, campaign);
    return { ...campaign };
  }

  createTest(input: CreateTest): ExperimentTest {
    if (this.tests.has(input.id)) {
      throw new Error("DUPLICATE_TEST");
    }
    const test = {
      ...input,
      challengerCreativeIds: [...input.challengerCreativeIds],
    };
    this.tests.set(test.id, test);
    return { ...test, challengerCreativeIds: [...test.challengerCreativeIds] };
  }

  createDecision(input: CreateDecision): Decision {
    const test = this.tests.get(input.testId);
    if (!test) {
      throw new Error("TEST_NOT_FOUND");
    }
    if (test.status !== "approved" && test.status !== "completed") {
      throw new Error("TEST_NOT_DECISION_DUE");
    }

    const decision: Decision = {
      id: randomUUID(),
      testId: input.testId,
      outcome: input.outcome,
      decidedBy: input.decidedBy,
      ...(input.rationale ? { rationale: input.rationale } : {}),
      createdAt: new Date().toISOString(),
    };
    this.decisions.set(decision.id, decision);
    return { ...decision };
  }
}

