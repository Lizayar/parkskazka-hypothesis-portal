import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createParkSkazkaFixture } from "@portal/db/fixtures/park-skazka-fixture";
import { InMemoryPortalRepository } from "@portal/db/repositories/portal-repository";
import { coreConstraints } from "@portal/db/schema/core";
import { experimentConstraints } from "@portal/db/schema/experiments";
import { metricConstraints } from "@portal/db/schema/metrics";

describe("portal PostgreSQL-first schema contract", () => {
  it("ships database-level uniqueness and decision gate migration", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "packages/db/migrations/0001_portal_core.sql"),
      "utf8",
    );

    expect(migration).toContain("unique (source, account_id, object_level, external_id)");
    expect(migration).toContain("unique (source, account_id, period, content_hash)");
    expect(migration).toContain("unique (test_id, period, calculation_version)");
    expect(migration).toContain("TEST_NOT_DECISION_DUE");
  });

  it("declares immutable identity and period/version uniqueness keys", () => {
    expect(coreConstraints.sourceObjectIdentity).toEqual([
      "source",
      "accountId",
      "objectLevel",
      "externalId",
    ]);
    expect(coreConstraints.snapshotIdentity).toEqual([
      "source",
      "accountId",
      "period",
      "contentHash",
    ]);
    expect(metricConstraints.observationIdentity).toEqual([
      "testId",
      "period",
      "calculationVersion",
    ]);
    expect(experimentConstraints.decisionRequiresApprovedTest).toBe(true);
  });

  it("creates a minimal Park Skazka campaign-to-creative fixture", () => {
    const fixture = createParkSkazkaFixture();

    expect(fixture.workspace.slug).toBe("parkskazka");
    expect(fixture.sourceAccount.source).toBe("vk_ads");
    expect(fixture.campaign.accountId).toBe(fixture.sourceAccount.id);
    expect(fixture.adGroup.campaignId).toBe(fixture.campaign.id);
    expect(fixture.ad.creativeId).toBe(fixture.creative.id);
    expect(fixture.test.controlCreativeId).toBe(fixture.creative.id);
  });

  it("rejects duplicate source object identity", () => {
    const repository = new InMemoryPortalRepository();
    const account = repository.createSourceAccount({
      source: "vk_ads",
      externalId: "account-1",
      name: "Park Skazka VK",
      workspaceId: "workspace-1",
    });

    repository.createCampaign({
      source: "vk_ads",
      accountId: account.id,
      objectLevel: "campaign",
      externalId: "campaign-1",
      name: "Summer",
    });

    expect(() =>
      repository.createCampaign({
        source: "vk_ads",
        accountId: account.id,
        objectLevel: "campaign",
        externalId: "campaign-1",
        name: "Summer duplicate",
      }),
    ).toThrow("DUPLICATE_SOURCE_OBJECT");
  });

  it("rejects a decision for a draft test", () => {
    const repository = new InMemoryPortalRepository();
    repository.createTest({
      id: "test-draft",
      workspaceId: "workspace-1",
      hypothesisId: "hypothesis-1",
      status: "draft",
      startsOn: "2026-08-12",
      endsOn: "2026-08-19",
      primaryMetric: "cost_per_lead",
      controlCreativeId: "creative-control",
      challengerCreativeIds: ["creative-challenger"],
    });

    expect(() =>
      repository.createDecision({
        testId: "test-draft",
        outcome: "scale",
        decidedBy: "github|42",
      }),
    ).toThrow("TEST_NOT_DECISION_DUE");
  });
});

